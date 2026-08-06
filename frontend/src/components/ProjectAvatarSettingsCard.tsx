import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAvatarProgress,
  getCachedAvatarProgress,
  matteAllSceneAvatars,
  updateProject,
  type AvatarProgressScene,
  type CraftedTemplateDetail,
  type Project,
} from "../api/client";
import type { AvatarBg, AvatarCorner, AvatarShape } from "../api/types";
import { avatarBgWantsCutout } from "../api/types";
import AvatarAppearanceControls, {
  type AvatarAppearanceValue,
} from "./AvatarAppearanceControls";
import AvatarSceneStatusList from "./AvatarSceneStatusList";
import AvatarBatchWizard from "./AvatarBatchWizard";
import AvatarPortraitUpload from "./AvatarPortraitUpload";

/** Matches SceneAvatarSection — a matte is minutes-scale, same as a render. */
const POLL_MS = 1200;

/** Scenes that need a cutout before a custom background can show on them. */
export interface AvatarSceneNeedingMatte {
  id: number;
  order: number;
}

/** Matte rows from the last rollup this session saw, for seeding initial state.
 *  Switching tabs unmounts this card, so without these seeds every return
 *  repainted a settled panel over work that was really still running. */
function cachedMatteRows(projectId: number): AvatarProgressScene[] {
  return (
    getCachedAvatarProgress(projectId)?.scenes.filter(
      (s) => s.kind === "matte",
    ) ?? []
  );
}

/**
 * Presentation controls for the talking-head avatar overlay.
 *
 * These are project-wide defaults: they describe how any avatar LOOKS, while
 * which scenes have one is decided per scene (Scene Edit modal → Avatar), and a
 * scene may override any of these for itself. Only editable once at least one
 * scene has a clip, since there is nothing to position otherwise.
 */
export default function ProjectAvatarSettingsCard({
  projectId,
  hasAnyAvatar,
  avatarShape,
  avatarSize,
  avatarPosition,
  avatarBg,
  avatarOpacity,
  avatarCustomImageUrl,
  aspectRatio,
  scenesNeedingMatte = [],
  batchScenes = [],
  scenesMissingAvatar = [],
  avatarBatchUnlocked = false,
  disabled = false,
  onError,
  onSaved,
  project,
  ownerScopedProjectId,
  precompiledCraftedDetail,
  precompiledTemplateData,
}: {
  projectId: number;
  /** True when at least one scene has a rendered avatar clip. */
  hasAnyAvatar: boolean;
  avatarShape?: AvatarShape;
  avatarSize?: number;
  avatarPosition?: AvatarCorner;
  avatarBg?: AvatarBg;
  avatarOpacity?: number;
  /** The user's uploaded presenter photo, if any. */
  avatarCustomImageUrl?: string | null;
  /** "landscape" | "portrait" — the preview frame mirrors the real video shape. */
  aspectRatio?: string;
  /** Scenes with an avatar but no cutout yet. */
  scenesNeedingMatte?: AvatarSceneNeedingMatte[];
  /** Every scene in the project, for the whole-video batch wizard. */
  batchScenes?: { id: number; order: number; hasVoiceover: boolean }[];
  /** Scenes with narration but no avatar yet, once at least one sibling scene
   *  already has one (a pencil-icon click on one of these lands here instead
   *  of opening the single-scene modal — see ProjectView.tsx). */
  scenesMissingAvatar?: { id: number; order: number; hasVoiceover: boolean }[];
  /** Whether the batch wizard's placeholder paywall has been cleared. */
  avatarBatchUnlocked?: boolean;
  disabled?: boolean;
  onError: (msg: string) => void;
  onSaved: () => void | Promise<void>;
  /** The full project — lets the batch wizard's setup modal preview show the
   *  real scene background behind the mocked-up corner overlay. */
  project?: Project;
  ownerScopedProjectId?: number;
  precompiledCraftedDetail?: CraftedTemplateDetail | null;
  precompiledTemplateData?: {
    intro_code: string | null;
    content_codes: string[] | null;
    outro_code: string | null;
  };
}) {
  const [shape, setShape] = useState<AvatarShape>(avatarShape ?? "circle");
  const [size, setSize] = useState<number>(avatarSize ?? 0.16);
  const [position, setPosition] = useState<AvatarCorner>(
    avatarPosition ?? "bottom_left",
  );
  const [bg, setBg] = useState<AvatarBg>(avatarBg ?? null);
  const [opacity, setOpacity] = useState<number>(avatarOpacity ?? 1);
  const [saving, setSaving] = useState(false);
  // Seeded from the cached rollup for the same reason as matteRows below: a tab
  // switch unmounts this card, and starting at false meant a live cutout showed
  // no progress panel at all until the next response landed. Mirrors the
  // `active` derivation in the adopt-effect so the seed and the first real
  // response agree. `watchMatteProgress` is still started by that effect — this
  // only decides what is PAINTED in the meantime.
  const [matting, setMatting] = useState(() =>
    cachedMatteRows(projectId).some(
      (s) => s.status === "queued" || s.status === "running",
    ),
  );
  const [mattingLeft, setMattingLeft] = useState(
    () =>
      cachedMatteRows(projectId).filter(
        (s) => s.status === "queued" || s.status === "running",
      ).length,
  );
  // The polled matte rows, rendered per scene. Held as the server reported them
  // rather than as a derived count, so the card shows WHICH scene is being cut
  // out right now — and keeps showing the failed ones after a pass ends, which
  // is what the Retry button acts on.
  //
  // Seeded from the last rollup this session saw, for the same reason the batch
  // wizard is: switching tabs unmounts this card entirely, so without the seed
  // every return started from an empty list.
  const [matteRows, setMatteRows] = useState<AvatarProgressScene[]>(() =>
    cachedMatteRows(projectId),
  );
  // Has the rollup answered AT LEAST ONCE? Same three-state trick as
  // batchActive below, and for the same reason. On a fresh load `matting` is
  // false and `matteRows` is empty, which LOOKS identical to "nothing is
  // happening" — so the card rendered a settled panel for the ~1s until the
  // first poll landed, even while a cutout was running on the server. Showing
  // nothing for that moment is honest; asserting there is no work is not.
  //
  // Latches true and never goes back: the effect that sets it re-runs when the
  // project refetches, and un-answering on every re-run would flash the
  // "checking…" placeholder back up each time.
  //
  // A cached rollup counts as answered — those rows came from a real response
  // earlier this session, so a remount can skip straight to showing them.
  const [matteKnown, setMatteKnown] = useState(
    () => getCachedAvatarProgress(projectId) !== null,
  );
  // Is a batch still in flight right now? Answered ONCE from the rollup the
  // adopt-effect below already fetches — no extra request, no second poll.
  //
  // null = "not known yet". The fetch is async, so without a third value an
  // unlocked project would render the settings panel for a frame before
  // flipping back to the wizard. Treated as "assume active when unlocked".
  //
  // Seeded from the cached rollup when there is one: this flag is what
  // wizardOwnsView needs to be TRUE to keep the generating view mounted, so
  // starting at null on every tab switch meant a live batch painted the settled
  // settings panel first and only swapped to the progress view once the fetch
  // came back. The effect below still recomputes it (including the owed-cutout
  // case, which needs project data this seed can't see) — this only decides
  // what the first frame shows.
  const [batchActive, setBatchActive] = useState<boolean | null>(
    () => {
      const cached = getCachedAvatarProgress(projectId);
      return cached ? cached.batch_status === "running" : null;
    },
  );
  // Auto-resume rather than waiting for a click: a scene can end up here with
  // no avatar not just because it had no narration at generation time, but
  // because the batch was interrupted mid-run (tab closed/navigated away
  // between scenes — the wizard has no persistence to resume itself once
  // unmounted). If a batch was already unlocked and scenes are still missing,
  // that's exactly the interrupted-batch case, so pick generation back up
  // automatically instead of showing a "Generate N scenes" button and hoping
  // the user notices it.
  const [showRemainingWizard, setShowRemainingWizard] = useState(
    avatarBatchUnlocked && scenesMissingAvatar.length > 0,
  );
  useEffect(() => {
    if (avatarBatchUnlocked && scenesMissingAvatar.length > 0) {
      setShowRemainingWizard(true);
    }
  }, [avatarBatchUnlocked, scenesMissingAvatar.length]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => stopPolling, [stopPolling]);

  /** Does the batch wizard own the view right now?
   *
   *  It does on a first visit (nothing generated yet), and it KEEPS ownership
   *  while a batch is in flight. That second half matters: the first scene's
   *  render landing flips `hasAnyAvatar`, which used to swap the wizard out
   *  mid-batch and take its polling — and its automatic cutout — with it.
   *
   *  Deliberately does NOT consult `avatarBatchUnlocked` while `batchActive` is
   *  still null (the ~1s before the rollup replies). That flag stays set forever
   *  once a batch has run, so trusting it mounted the wizard on projects whose
   *  avatars finished long ago — every scene flashing "Starting…" before the
   *  panel appeared. `hasAnyAvatar` comes straight from props and needs no
   *  fetch, so an already-generated project renders this panel immediately, and
   *  the wizard reclaims the view only once `batchActive` actually comes back
   *  true — which is the genuine mid-batch case this rule exists for. */
  const wizardOwnsView =
    batchScenes.length > 0 && (!hasAnyAvatar || batchActive === true);
  // Read inside the adopt-effect's async body instead of closing over it: that
  // body resolves AFTER the fetch, by which point ownership may have been
  // settled by the very response it is handling.
  const wizardOwnsViewRef = useRef(wizardOwnsView);
  wizardOwnsViewRef.current = wizardOwnsView;
  // Same reason: the mount effect runs once, but resolves after its fetch, so
  // it must read the CURRENT background/pending-cutout values, not the ones
  // captured when it was created.
  const bgRef = useRef(bg);
  bgRef.current = bg;
  const scenesNeedingMatteRef = useRef(scenesNeedingMatte);
  scenesNeedingMatteRef.current = scenesNeedingMatte;

  /** Adopt a cutout pass that is ALREADY running, whoever started it.
   *
   *  `scenesNeedingMatte` comes from the project prop, which is fetched once —
   *  so when the batch wizard kicks off matting, this card had no idea and
   *  showed a stale "N scenes still show the original background / Remove them
   *  now" prompt on top of work already in flight. Ask the server instead: if
   *  any matte job is queued/running, show progress, never the prompt.
   *
   *  Also answers `batchActive` from the same response, so keeping the wizard
   *  mounted through a live batch costs no extra request and no second poll. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await getAvatarProgress(projectId);
        if (cancelled) return;
        // "Settled" does NOT mean finished when a background was chosen and no
        // cutout has run for it — that batch is only half done, and handing the
        // view to this panel is exactly what stranded the user on "Remove them
        // now" with their chosen background silently not applied. Treat an owed
        // cutout as live work so the wizard stays mounted and starts it.
        const owesCutout =
          avatarBgWantsCutout(bgRef.current) &&
          scenesNeedingMatteRef.current.length > 0;
        setBatchActive(data.batch_status === "running" || owesCutout);
        const active = data.scenes.filter(
          (s) =>
            s.kind === "matte" &&
            (s.status === "queued" || s.status === "running"),
        );
        // Only ONE owner may drive a cutout. When the wizard is mounted it is
        // already polling this same pass; adopting it here too would double the
        // progress watchers and race their onSaved refetches.
        // Seed the rows from THIS response so the list paints immediately on
        // adopt, rather than staying empty until the first interval tick.
        setMatteRows(data.scenes.filter((s) => s.kind === "matte"));
        setMatteKnown(true);
        if (active.length > 0 && !wizardOwnsViewRef.current) {
          setMatting(true);
          setMattingLeft(active.length);
          watchMatteProgress();
        } else if (active.length === 0) {
          // Clear the optimistic seed. `matting` is initialised from the CACHED
          // rollup so a live pass paints instantly on remount, but that cache
          // can describe work which finished while the tab was away — and no
          // watcher is started on this branch to ever turn it off, so without
          // this the panel would spin forever on a completed pass.
          setMatting(false);
          setMattingLeft(0);
        }
      } catch {
        // Stop "checking…" even on failure. Leaving matteKnown false spins that
        // placeholder forever on a transient error — and an indefinite spinner
        // is a worse lie than showing the card as settled, because it claims
        // work is being looked for that nothing will ever look for again.
        if (!cancelled) setMatteKnown(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-runs when the owed-cutout inputs arrive, not just on mount: on a fresh
    // page load the project fetch has not landed yet, so scenesNeedingMatte is
    // still empty here and a one-shot [projectId] effect would conclude nothing
    // is owed and hand the view to this panel. Keyed on the COUNT rather than
    // the array identity, which changes every render.
    //
    // NOT on `bg`. That is the DRAFT background, which changes on every swatch
    // click — so each click cancelled the in-flight fetch and started another,
    // and while the user was picking a colour the answer never arrived and
    // "Checking background removal…" span indefinitely. The saved value is read
    // through bgRef inside the effect body, so re-running on a draft edit buys
    // nothing anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, scenesNeedingMatte.length]);

  // Re-hydrate when the project reloads (e.g. after a save elsewhere).
  useEffect(() => {
    setShape(avatarShape ?? "circle");
    setSize(avatarSize ?? 0.16);
    setPosition(avatarPosition ?? "bottom_left");
    setBg(avatarBg ?? null);
    setOpacity(avatarOpacity ?? 1);
  }, [avatarShape, avatarSize, avatarPosition, avatarBg, avatarOpacity]);

  // No `dirty` flag: Save is a "push these to every scene" action, not just a
  // project write, so it is always available (see the button below).

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProject(projectId, {
        avatar_shape: shape,
        avatar_size: size,
        avatar_position: position,
        // Explicit null is meaningful here — it means "back to the photo's own
        // background" — and updateProject is allowed to null this field.
        avatar_bg: bg,
        avatar_opacity: opacity,
      });
      await onSaved();
      // Picking a background IS the request to see it. The cutout is a required
      // implementation step of that request (roster portraits have their rooms
      // baked in), not a separate decision — so run it rather than asking the
      // user to confirm work they already asked for. Cheap and safe: it reuses
      // the existing clip, never re-renders, and _queue_matte skips scenes that
      // are already matted or have a job in flight.
      //
      // Via the predicate, NOT `bg !== null`: "original" is an explicit request
      // to KEEP the filmed room, so treating it as a background would spend CPU
      // cutting out a presenter the user just asked not to cut out.
      if (avatarBgWantsCutout(bg) && scenesNeedingMatte.length > 0) {
        await handleMatteAll();
      }
    } catch {
      onError("Failed to save avatar settings.");
    } finally {
      setSaving(false);
    }
  };

  /** Poll the project rollup until no cutout is still in flight, then refresh the
   *  project so the preview picks up the finished cutouts. Shared by the "adopt a
   *  running pass" effect and handleMatteAll below, so progress looks identical
   *  however the pass was started.
   *
   *  Polls getAvatarProgress (ONE request) rather than getSceneAvatarStatus per
   *  scene per tick. Two reasons: N-times fewer requests, and — the point —
   *  SceneAvatarStatus carries no kind/phase/queue_position, so it can only yield
   *  a count. The rollup rows are exactly what AvatarSceneStatusList renders, so
   *  the card can show the same per-scene detail the batch wizard does instead of
   *  reducing a whole pass to "3 scenes to go". */
  const watchMatteProgress = useCallback(() => {
    stopPolling();
    timerRef.current = setInterval(() => {
      void (async () => {
        try {
          const { data } = await getAvatarProgress(projectId);
          const matteRows = data.scenes.filter((s) => s.kind === "matte");
          setMatteRows(matteRows);
          const stillGoing = matteRows.filter(
            (s) => s.status === "queued" || s.status === "running",
          ).length;
          setMattingLeft(stillGoing);
          if (stillGoing === 0) {
            stopPolling();
            setMatting(false);
            // Refreshes the project, which re-renders the preview with the
            // cutouts now applied — the visible payoff of the whole pass. Any
            // failures stay on the rows themselves, where the Retry button is.
            await onSaved();
          }
        } catch {
          /* transient — keep polling, matching SceneAvatarSection */
        }
      })();
    }, POLL_MS);
  }, [projectId, stopPolling, onSaved]);

  /** Cut the presenter out of every scene that still needs it.
   *
   *  Called automatically from handleSave (picking a background IS the request to
   *  see it), and from the Retry button after a pass has failed. Idempotent: the
   *  endpoint only selects scenes with a clip and no matte, and _queue_matte
   *  skips anything already matted or in flight — so a retry naturally targets
   *  exactly the scenes that still need one. */
  const handleMatteAll = async () => {
    setMatting(true);
    setMattingLeft(scenesNeedingMatte.length);
    try {
      const { data } = await matteAllSceneAvatars(projectId);
      // `started` is a COUNT of queued jobs, not a boolean — compare explicitly
      // rather than leaning on 0 being falsy.
      if (data.started === 0) {
        setMatting(false);
        await onSaved();
        return;
      }
      watchMatteProgress();
    } catch {
      setMatting(false);
      onError("Could not start background removal.");
    }
  };

  // Deliberately NOT gated on hasAnyAvatar — the settings are editable before any
  // avatar exists so the user can set their preference up front.
  const controlsDisabled = disabled || saving || matting;
  const value: AvatarAppearanceValue = { shape, size, position, bg, opacity };
  // Scenes whose cutout FAILED. Kept visible after a pass ends because that is
  // what the Retry button acts on — without it a failure would just leave those
  // scenes silently showing the original background.
  const failedMatteRows = matteRows.filter((s) => s.status === "failed");

  // Show the progress panel only when there is real work or a real failure to
  // report. Deliberately NOT "a cutout is owed": that was the old prompt, which
  // appeared BEFORE anything was attempted and asked the user to confirm work
  // they had already requested by picking a background. Saving starts the pass;
  // this panel reports it.
  const showMatteProgress = matting || failedMatteRows.length > 0;

  // On a fresh load the rollup has not answered yet, so `matting` is false and
  // the panel above would be hidden — the card looks settled for ~1s even when
  // a cutout is running on the server, which reads as "nothing is happening"
  // and then abruptly corrects itself. Say we are checking instead of implying
  // there is nothing to check.
  const checkingForMatte = !matteKnown && avatarBgWantsCutout(bg);

  // scene id -> the number the user recognises, for the per-scene rows.
  const sceneOrderById = new Map(
    (project?.scenes ?? []).map((s) => [s.id, s.order]),
  );

  // Once at least one scene has a real avatar clip, show the same real
  // before/after preview the Scene Edit modal uses (via VideoPreview) instead
  // of the pre-creation mock — pick any scene that actually has one.
  const previewScene = hasAnyAvatar
    ? (project?.scenes ?? []).find((s) => !!s.avatar_video_path)
    : undefined;

  const applyPatch = (patch: Partial<AvatarAppearanceValue>) => {
    if (patch.shape !== undefined && patch.shape !== null) setShape(patch.shape);
    if (patch.size !== undefined && patch.size !== null) setSize(patch.size);
    if (patch.position !== undefined && patch.position !== null)
      setPosition(patch.position);
    if (patch.bg !== undefined) setBg(patch.bg);
    if (patch.opacity !== undefined && patch.opacity !== null)
      setOpacity(patch.opacity);
  };

  return (
    <div>
      <h2 className="text-base font-medium text-gray-900 mb-1">Avatar Overlay</h2>
      <p className="text-xs text-gray-400 mb-5">
        How talking-head presenters are shown, in both the preview and the final
        video. Any scene can override these from its own Avatar settings.
      </p>
      {/* No avatar anywhere yet and there is at least one scene to generate for:
          lead with the batch wizard rather than the settings panel — picking a
          presenter and starting generation IS the point of a first visit here.
          The settings panel (appearance, portrait upload, matte) is still the
          right view once something exists, or if there is nothing to batch.

          The wizard also KEEPS the view while a batch is live (see
          wizardOwnsView). Swapping to this panel the moment the first render
          landed used to unmount the wizard mid-run, taking its polling and its
          automatic background cutout with it — which is how a chosen background
          ended up silently not applied. */}
      {wizardOwnsView ? (
        <div className="glass-card px-6 py-8">
          <AvatarBatchWizard
            projectId={projectId}
            scenes={batchScenes}
            customPortraitUrl={avatarCustomImageUrl}
            avatarBatchUnlocked={avatarBatchUnlocked}
            // Now that this branch survives past the first render landing, a
            // remount mid-batch can happen once scenes already have avatars —
            // and the wizard mounts straight into "generating" with no "pick"
            // step to set a presenter. Seed it from a scene that has one.
            initialPreset={
              (project?.scenes ?? []).find((s) => !!s.avatar_video_path)
                ?.avatar_preset ?? null
            }
            avatarShape={avatarShape}
            avatarSize={avatarSize}
            avatarPosition={avatarPosition}
            avatarBg={avatarBg}
            avatarOpacity={avatarOpacity}
            aspectRatio={aspectRatio}
            onError={onError}
            onChanged={onSaved}
            project={project}
            ownerScopedProjectId={ownerScopedProjectId}
            precompiledCraftedDetail={precompiledCraftedDetail}
            precompiledTemplateData={precompiledTemplateData}
          />
        </div>
      ) : (
      <div className="glass-card px-6 py-8">
          <div className="space-y-5">
            {/* The controls stay usable with no avatar yet: this is a tab the user
                navigates to deliberately, so landing on a dead end would be wrong.
                Settings chosen now simply apply to avatars generated later. */}
            {!hasAnyAvatar && (
              <div className="rounded-xl bg-gray-50/80 border border-gray-200/60 px-4 py-3">
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  No scene has an avatar yet — these settings will apply to any you
                  generate. Open a scene and expand{" "}
                  <strong className="text-gray-600">Avatar</strong> to add one (it
                  needs narration audio, since it lip-syncs to the voice).
                </p>
              </div>
            )}

            {/* Mixed state: some scenes already have an avatar, others don't
                (e.g. they had no narration yet at generation time). A pencil
                click on one of the missing scenes lands here rather than
                opening a single-scene wizard — offer to fill in just those,
                reusing the same presenter/appearance already in use. */}
            {hasAnyAvatar && scenesMissingAvatar.length > 0 && (
              <div className="rounded-xl bg-purple-50/60 border border-purple-100 px-4 py-3">
                {showRemainingWizard ? (
                  <AvatarBatchWizard
                    projectId={projectId}
                    scenes={scenesMissingAvatar}
                    customPortraitUrl={avatarCustomImageUrl}
                    avatarBatchUnlocked={avatarBatchUnlocked}
                    initialPreset={
                      (project?.scenes ?? []).find((s) => !!s.avatar_video_path)
                        ?.avatar_preset ?? null
                    }
                    avatarShape={avatarShape}
                    avatarSize={avatarSize}
                    avatarPosition={avatarPosition}
                    avatarBg={avatarBg}
                    avatarOpacity={avatarOpacity}
                    aspectRatio={aspectRatio}
                    onError={onError}
                    onChanged={onSaved}
                    project={project}
                    ownerScopedProjectId={ownerScopedProjectId}
                    precompiledCraftedDetail={precompiledCraftedDetail}
                    precompiledTemplateData={precompiledTemplateData}
                  />
                ) : (
                  <>
                    <p className="text-[11px] text-gray-600 leading-relaxed">
                      {scenesMissingAvatar.length} scene
                      {scenesMissingAvatar.length === 1 ? "" : "s"} (
                      {scenesMissingAvatar.map((s) => s.order).join(", ")}) still{" "}
                      {scenesMissingAvatar.length === 1 ? "doesn't" : "don't"} have
                      an avatar. Generate {scenesMissingAvatar.length === 1 ? "it" : "them"}{" "}
                      with the same presenter and appearance already in use.
                    </p>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => setShowRemainingWizard(true)}
                      className="mt-2.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-[11px] font-semibold rounded-lg transition-all"
                    >
                      Generate {scenesMissingAvatar.length} scene
                      {scenesMissingAvatar.length === 1 ? "" : "s"}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Uploading/replacing the presenter photo only makes sense before
                any avatar exists — once scenes already have a generated clip,
                the presenter is fixed and this section is editing appearance
                only, matching the per-scene Avatar Edit modal. */}
            {!hasAnyAvatar && (
              <AvatarPortraitUpload
                projectId={projectId}
                currentUrl={avatarCustomImageUrl}
                disabled={disabled || saving || matting}
                onChanged={onSaved}
                onError={onError}
              />
            )}

            <div className={hasAnyAvatar ? "" : "border-t border-gray-200/60 pt-5"}>
            <AvatarAppearanceControls
              scope="project"
              value={value}
              inherited={{
                shape: shape ?? "circle",
                size: size ?? 0.16,
                position: position ?? "bottom_left",
                bg,
                opacity,
              }}
              previewPresetId={previewScene?.avatar_preset}
              customPortraitUrl={avatarCustomImageUrl}
              aspectRatio={aspectRatio}
              disabled={controlsDisabled}
              onChange={applyPatch}
              project={project}
              sceneId={previewScene?.id}
              hasRenderedClip={!!previewScene}
              ownerScopedProjectId={ownerScopedProjectId}
              precompiledCraftedDetail={precompiledCraftedDetail}
              precompiledTemplateData={precompiledTemplateData}
            />
            </div>

            {/* The ~1s before the rollup answers on a fresh load. Without this
                the card looks completely settled while a cutout may well be
                running, then jumps to a progress panel — which reads as the
                work having only just started. */}
            {checkingForMatte && !showMatteProgress && (
              <div className="rounded-xl bg-gray-50/80 border border-gray-200/60 px-4 py-3 flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin shrink-0" />
                <p className="text-[11px] text-gray-500">
                  Checking background removal…
                </p>
              </div>
            )}

            {/* Cutout progress, scene by scene. There is no "remove them now"
                prompt any more — saving a background starts the pass, so asking
                the user to confirm it was asking twice. This panel only appears
                once there is something real to report: work in flight, or a
                failure with a Retry. */}
            {showMatteProgress && (
              <div className="rounded-xl bg-amber-50/60 border border-amber-100 px-4 py-3">
                {matting ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin shrink-0" />
                      <p className="text-[11px] text-gray-600">
                        Updating backgrounds…{" "}
                        {mattingLeft > 0 && `${mattingLeft} scene${mattingLeft === 1 ? "" : "s"} to go.`}
                        <span className="block text-[10px] text-gray-400 mt-0.5">
                          This runs on the server — the preview updates
                          automatically when it finishes, and you can switch tabs
                          or close this page while it does.
                        </span>
                      </p>
                    </div>
                    <AvatarSceneStatusList
                      rows={matteRows}
                      orderOf={sceneOrderById}
                      hasPolled
                      className="mt-3 space-y-1.5"
                    />
                  </>
                ) : (
                  // Reached only AFTER a pass has actually failed — a recovery,
                  // not a confirmation. Retry re-runs the same endpoint, which
                  // skips scenes already matted or in flight, so it targets
                  // exactly the ones still owed a cutout.
                  <>
                    <p className="text-[11px] text-gray-600 leading-relaxed">
                      Background removal didn&apos;t finish for{" "}
                      {failedMatteRows.length} scene
                      {failedMatteRows.length === 1 ? "" : "s"}. Those scenes
                      still show the presenter&apos;s original background.
                    </p>
                    <AvatarSceneStatusList
                      rows={matteRows}
                      orderOf={sceneOrderById}
                      hasPolled
                      className="mt-2 space-y-1.5"
                    />
                    <button
                      type="button"
                      disabled={disabled || saving}
                      onClick={handleMatteAll}
                      className="mt-2.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-[11px] font-semibold rounded-lg transition-all"
                    >
                      Retry
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                // NOT gated on `dirty`: Save pushes these values onto EVERY
                // scene, so it stays useful even when the project's own values
                // are unchanged — a scene that diverged could otherwise never be
                // re-stamped without pointlessly editing a field and undoing it.
                disabled={controlsDisabled}
                onClick={handleSave}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-semibold rounded-xl transition-all"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
      </div>
      )}
    </div>
  );
}
