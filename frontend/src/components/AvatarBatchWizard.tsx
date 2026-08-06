import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  AVATAR_BATCH_MAX_SCENES,
  AVATAR_BATCH_MIN_SCENES,
  AVATAR_CREDIT_COST_PER_SCENE,
  AVATAR_PRESETS,
  MAIN_AVATAR_PRESET_IDS,
  authorizeAvatarBatch,
  generateSceneAvatar,
  getAvatarProgress,
  getCachedAvatarProgress,
  matteAllSceneAvatars,
  retryFailedSceneAvatars,
  uploadAvatarPortrait,
  type AvatarProgressScene,
  type CraftedTemplateDetail,
  type Project,
} from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { AVATAR_CUSTOM_PRESET_ID, avatarBgWantsCutout } from "../api/types";
import type { AvatarBg, AvatarCorner, AvatarShape } from "../api/types";
import AvatarPhotoGuide from "./AvatarPhotoGuide";
import AvatarSceneStatusList, {
  type DisplayRow,
} from "./AvatarSceneStatusList";
import AvatarPresetMedia from "./AvatarPresetMedia";
import ImageCropOverlay from "./ImageCropOverlay";

/** Matches SceneAvatarSection/ProjectAvatarSettingsCard — a render is minutes-scale. */
const POLL_MS = 1200;

/** If the rollup reports nothing new for this long, stop pretending progress is
 *  happening and say so. Generous, because a scene waiting behind other
 *  projects' jobs in the system-wide FIFO queue legitimately reports the same
 *  `queued` state for a long time — this is a "nothing exists to report" guard
 *  (e.g. every enqueue POST failed), not a per-render timeout. */
const STALL_MS = 10 * 60 * 1000;

/** The crop dialog runs on the "instructions" step, and the wizard never asks
 *  about shape at all — that is chosen afterward in ProjectAvatarSettingsCard —
 *  so it can't know the final shape here. "rounded" is the most-used shape in
 *  practice, so the crop targets ITS box ratio (4:5 — see AvatarOverlay's
 *  boxHeight = boxWidth * 1.25 for "rounded"), which keeps the framing sensible
 *  for the shape the result most likely ends up in. */
const AVATAR_UPLOAD_ASPECT_RATIO = "4 / 5";

/** Cycled purely for texture while jobs are in flight — real progress still
 *  comes from polling, this just keeps a long wait from feeling stuck. */
const LOADING_MESSAGES = [
  "Rendering…",
  "This may take a while — please hold.",
  "Still rendering, you can switch tabs.",
  "Warming up the render service…",
  "Almost there…",
];

type WizardStep =
  | "pick"
  | "instructions"
  | "pricing"
  | "generating"
  | "done";

/** How far the AUTOMATIC background cutout has got, within step "generating".
 *
 *  Only ever leaves "none" when the user picked a background that needs a cutout
 *  (see avatarBgWantsCutout) — "Original" means the presenter keeps their filmed
 *  room, so no cutout is owed and none is ever queued.
 *
 *  "pending" is the gap this type exists for: avatar-matte-all has been POSTed
 *  but its job rows don't exist yet, so the rollup still describes the finished
 *  RENDER jobs. Without a phase the UI reads those rows and claims it is still
 *  rendering. */
type MattePhase = "none" | "pending" | "running";

interface SceneLite {
  id: number;
  order: number;
  hasVoiceover: boolean;
}

/**
 * Whole-video avatar onboarding, shown in the Avatar tab when no scene has one
 * yet. Walks: pick a presenter (big video preview + Elena/Marcus/Your-photo
 * strip) → a setup modal (instructions first only if uploading a photo, then
 * the pricing step) → a live batch generation run → a done summary, then the
 * caller falls back to the normal per-scene-editable settings card.
 *
 * Deliberately does NOT ask how the avatar should LOOK. Placement, shape, size,
 * opacity and background are all chosen afterward — project-wide in
 * ProjectAvatarSettingsCard, per scene in SceneAvatarSection — where there is a
 * real rendered clip to preview against instead of a guess before paying.
 *
 * Presenter *identity* is still stored per scene (there is no project-level
 * preset column — see ProjectAvatarSettingsCard's doc-comment), so "one avatar
 * for the whole video" here means: the same preset is enqueued for every scene
 * that has narration, via generateSceneAvatar (same endpoint
 * SceneAvatarSection uses). All jobs land on the same system-wide FIFO queue
 * (see services/avatar_queue.py on the backend) — this wizard just enqueues
 * everything up front and polls getAvatarProgress for the server-computed
 * rollup, rather than sequencing scenes itself.
 */
export default function AvatarBatchWizard({
  projectId,
  scenes,
  customPortraitUrl,
  avatarBatchUnlocked,
  initialPreset,
  // avatarShape/Size/Position/Opacity are accepted (see the type below) but not
  // destructured: nothing in the wizard reads them since it stopped seeding the
  // project row. Only avatarBg is still used.
  avatarBg,
  aspectRatio,
  project,
  onError,
  onChanged,
}: {
  projectId: number;
  scenes: SceneLite[];
  customPortraitUrl?: string | null;
  avatarBatchUnlocked: boolean;
  /**
   * Seeds the presenter when the wizard mounts straight into "generating"
   * (because `avatarBatchUnlocked` is already true) rather than being picked
   * via its own "pick" step — e.g. resuming after a reload, or generating the
   * remaining scenes of an already-unlocked project. Without this, `preset`
   * stays null and generation would send an invalid preset.
   */
  initialPreset?: string | null;
  avatarShape?: AvatarShape;
  avatarSize?: number;
  avatarPosition?: AvatarCorner;
  avatarBg?: AvatarBg;
  avatarOpacity?: number;
  /** "landscape" | "portrait" — the preview frame mirrors the real video shape. */
  aspectRatio?: string;
  onError: (msg: string) => void;
  /** Refetch the project — called after unlocking and again once the batch finishes. */
  onChanged: () => void | Promise<void>;
  /** Needed for the owner-pays credit balance: on a shared project the pricing
   *  step must show (and spend) the OWNER's pool, which arrives on the project as
   *  `owner_ai_edit_credits`. Optional, so a call site that omits it falls back
   *  to the acting user's own balance. */
  project?: Project;
  ownerScopedProjectId?: number;
  precompiledCraftedDetail?: CraftedTemplateDetail | null;
  precompiledTemplateData?: {
    intro_code: string | null;
    content_codes: string[] | null;
    outro_code: string | null;
  };
}) {
  // MEMOISED because the polling effect depends on it. `scenes.filter(...)`
  // returns a new array identity on EVERY render, which would invalidate
  // startPolling's useCallback, re-run the subscribe effect, and start another
  // interval on top of the last one — each poll's setState triggering another
  // render and another interval, until the endpoint is being hit dozens of
  // times a second. Key it on the scene ids/eligibility instead.
  const eligibleKey = scenes
    .map((s) => `${s.id}:${s.hasVoiceover ? 1 : 0}:${s.order}`)
    .join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const eligibleScenes = useMemo(() => scenes.filter((s) => s.hasVoiceover), [eligibleKey]);
  const skippedScenes = scenes.filter((s) => !s.hasVoiceover);

  // How small a batch this project may authorize. Normally 5, but a project
  // with fewer eligible scenes — or one down to its last few without an avatar —
  // could otherwise never use the feature. Mirrors avatar_batch_min_scenes on
  // the backend, which enforces the same rule.
  const minSelectable = Math.min(AVATAR_BATCH_MIN_SCENES, eligibleScenes.length);

  // Which scenes get an avatar. Defaults to the first MAX, in scene order —
  // most projects are at or under the cap, so the common case is "everything".
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    () =>
      new Set(
        eligibleScenes.slice(0, AVATAR_BATCH_MAX_SCENES).map((s) => s.id),
      ),
  );
  // Re-seed if the eligible set itself changes (a voiceover lands, or the card
  // remounts this wizard for the REMAINING scenes). Keyed on the same string as
  // the memo above rather than the array identity, which changes every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setSelectedIds(
      new Set(eligibleScenes.slice(0, AVATAR_BATCH_MAX_SCENES).map((s) => s.id)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleKey]);

  const selectedScenes = eligibleScenes.filter((s) => selectedIds.has(s.id));
  const creditCost = selectedScenes.length * AVATAR_CREDIT_COST_PER_SCENE;

  const toggleScene = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        // Never below the floor — the server would reject it anyway, and a
        // disabled checkbox explains the limit better than a 400 does.
        if (next.size <= minSelectable) return prev;
        next.delete(id);
      } else {
        if (next.size >= AVATAR_BATCH_MAX_SCENES) return prev;
        next.add(id);
      }
      return next;
    });
  };

  // Credit balance, mirroring SceneEditor's derivation with ONE deliberate
  // difference: there is no `effectiveIsPro` exemption. Avatars are per-scene GPU
  // spend, so PRO/STANDARD pay too (see can_afford_avatars on the backend, which
  // enforces the same rule). Owner-pays still applies, hence the collaborator
  // branch reading the owner's pool off the project.
  const { user, refreshUser } = useAuth();
  const isCollaborator = user != null && project != null && project.user_id !== user.id;
  const aiCreditRemaining = isCollaborator
    ? (project?.owner_ai_edit_credits ?? 0)
    : (user?.ai_edit_credits ?? 0);
  const canAfford = aiCreditRemaining >= creditCost;
  // How many scenes the current balance WOULD cover — turns "you're short" into
  // an actionable "pick this many instead".
  const affordableScenes = Math.floor(aiCreditRemaining / AVATAR_CREDIT_COST_PER_SCENE);

  const [step, setStep] = useState<WizardStep>(
    avatarBatchUnlocked ? "generating" : "pick",
  );
  const mainPresets = AVATAR_PRESETS.filter((p) => MAIN_AVATAR_PRESET_IDS.includes(p.id));
  // No preset is pre-selected by default — the user must explicitly choose a
  // presenter (or upload their own) rather than one being implicitly picked
  // for them. `initialPreset` overrides this only when the wizard skips the
  // "pick" step entirely (mounts straight into "generating").
  const [preset, setPreset] = useState<string | null>(initialPreset ?? null);
  const [unlocking, setUnlocking] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  // The polled rollup, rendered directly. NOT a derived summary held in state:
  // the server is the only owner of batch progress, so a reopened tab shows
  // exactly what is really happening instead of a stale local count.
  //
  // Seeded from the last rollup this session saw (see getCachedAvatarProgress).
  // Switching tabs UNMOUNTS this whole component — ProjectView renders the tab
  // as `{activeTab === "avatar" && …}` — so without the seed, coming back meant
  // an empty list and a blank status column for one round-trip, which read as
  // the batch having lost track of itself. Filtered to eligible scenes exactly
  // as the poll tick does, so the seed and the first real response agree.
  const [sceneRows, setSceneRows] = useState<AvatarProgressScene[]>(() => {
    const cached = getCachedAvatarProgress(projectId);
    if (!cached) return [];
    const eligibleIds = new Set(eligibleScenes.map((s) => s.id));
    return cached.scenes.filter((s) => eligibleIds.has(s.scene_id));
  });
  const [stalled, setStalled] = useState(false);
  // How many scenes the last bulk retry refused because they had exhausted
  // their per-scene attempt budget.
  const [exhaustedNotice, setExhaustedNotice] = useState(0);
  // Where the automatic cutout pass has got to. STATE, not a ref, because the
  // generating view has to RENDER it: between "we POSTed avatar-matte-all" and
  // "the rollup reports matte rows" the server still returns the old render
  // rows, so without this the headline fell back to "Creating your avatar…"
  // even though rendering was finished. Only ever leaves "none" when a
  // background needing a cutout was chosen (see avatarBgWantsCutout).
  const [mattePhase, setMattePhase] = useState<MattePhase>("none");
  // Has the rollup answered at least once? Before it has, a scene with no job
  // row is simply not reported YET, so "Starting…" is honest. Afterwards the
  // server has spoken: a scene still missing a row never got one (its enqueue
  // POST failed — see enqueueScenes, which swallows those), and leaving it on
  // "Starting…" would spin a lie forever.
  //
  // A cache hit counts as "answered": those rows came from a real response
  // earlier this session, so the labels derived from them are real too. Only a
  // genuine cold start (first visit, hard reload) begins false.
  const [hasPolled, setHasPolled] = useState(
    () => getCachedAvatarProgress(projectId) !== null,
  );

  const doneRows = sceneRows.filter(
    (s) => s.status === "completed" || s.status === "failed",
  );
  const failedScenes = sceneRows
    .filter((s) => s.status === "failed")
    .map((s) => s.scene_id);
  const retryableFailures = sceneRows.filter(
    (s) => s.status === "failed" && s.retryable !== false && !s.attempts_exhausted,
  );

  // Upload/crop state for the "instructions" step (a presenter photo upload).
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // The raw file just selected, held only long enough to run it through the
  // crop overlay — the upload itself sends the CROPPED result, never the
  // original, so only the framed region is ever sent.
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const portraitInputRef = useRef<HTMLInputElement>(null);

  // How the avatar overlay LOOKS. The wizard no longer ASKS about any of this —
  // choosing placement/background before a single clip exists meant guessing
  // with nothing to preview against, so appearance now lives entirely in
  // ProjectAvatarSettingsCard (project-wide) and SceneAvatarSection (per scene),
  // which the user reaches once the batch has actually rendered something.
  //
  // Shape/size/position/opacity used to be mirrored here to seed the project row
  // on unlock. That write was redundant — the values either came FROM the row or
  // equalled the DB column defaults — so it went away with the batch-authorize
  // rewrite, and only `bg` (which is actually read) remains.
  //
  // Stays null ("Original") absent a picker, so avatarBgWantsCutout is false and
  // the batch queues no automatic matte pass — users cut out the background
  // afterward from the settings card, which shows a Retry if a cutout fails.
  const bg: AvatarBg = avatarBg ?? null;

  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Last time the rollup actually CHANGED, used to bound the spinner. A batch
  // that stops moving entirely (e.g. every enqueue POST failed, so no job rows
  // exist to report on) must surface an error rather than spin forever.
  const lastChangeRef = useRef<number>(Date.now());
  const lastSignatureRef = useRef<string>("");
  // Read inside the poll tick instead of closing over it, so the polling
  // callback's identity never depends on the scene array — that dependency is
  // what let a new array identity per render restart the interval.
  const eligibleScenesRef = useRef(eligibleScenes);
  eligibleScenesRef.current = eligibleScenes;
  // Same reason as eligibleScenesRef: read the chosen background inside the
  // poll tick without making the polling callback depend on it.
  const bgRef = useRef(bg);
  bgRef.current = bg;
  // Mirror of mattePhase for the same reason as bgRef/eligibleScenesRef above:
  // the poll tick reads it WITHOUT the polling callback depending on it, so a
  // phase change can't invalidate startPolling and restack the interval.
  //
  // `!== "none"` is also the one-shot guard for the automatic cutout pass. The
  // POST takes a moment to create its rows, so without a guard the next 1.2s
  // tick would still see only render rows and fire it a second time (which is
  // what produced a duplicate matte job for one scene). Unlike the bare ref
  // this replaces, it is set from state — so a REMOUNT re-derives it from the
  // server rollup instead of resetting to false and re-POSTing.
  const mattePhaseRef = useRef(mattePhase);
  mattePhaseRef.current = mattePhase;
  // Which scenes have finished, so the project can be refetched the moment a
  // clip lands rather than only at phase boundaries. Without this the preview
  // holds stale scene data for the whole render phase and a freshly generated
  // presenter doesn't appear until the batch settles. `null` = not yet seeded;
  // the first tick records the baseline instead of firing, so a wizard mounting
  // onto an already-part-finished batch doesn't trigger a pointless refetch.
  const lastCompletedSignatureRef = useRef<string | null>(null);
  // Read onChanged through a ref, for the SAME reason as eligibleScenesRef and
  // bgRef above. The parent passes a new function identity on every render, so
  // depending on it directly made startPolling a new callback each time the
  // project refetched — which re-ran the subscribe effect and stacked ANOTHER
  // interval on top of the live one. Each poll's setState then caused another
  // render, another interval, and the endpoint ended up being hit several times
  // a second (visible as a new source port per client in the server log). This
  // is precisely the failure the comment on eligibleScenes warns about.
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  // The visibilitychange handler currently attached, so it is torn down by the
  // SAME path as the intervals. A listener that outlived its effect would poll
  // on a dead closure — the exact class of bug the interval comments above
  // describe, just with an event instead of a timer.
  const visibilityHandlerRef = useRef<(() => void) | null>(null);

  const stopAllPolling = useCallback(() => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    if (messageTimer.current) {
      clearInterval(messageTimer.current);
      messageTimer.current = null;
    }
    if (visibilityHandlerRef.current) {
      document.removeEventListener(
        "visibilitychange",
        visibilityHandlerRef.current,
      );
      visibilityHandlerRef.current = null;
    }
  }, []);

  useEffect(() => stopAllPolling, [stopAllPolling]);

  const isCustom = preset === AVATAR_CUSTOM_PRESET_ID;

  /** Enqueue every eligible scene that does not already have live or finished
   *  work. Called ONLY from the pricing step's Confirm — never from a mount
   *  effect, or reopening the tab would re-POST the whole batch.
   *
   *  Skips scenes whose latest job is queued/running/completed, but deliberately
   *  INCLUDES `failed` ones: testing mere row PRESENCE (as this once did) meant a
   *  scene that failed was treated as "already handled" and never retried. A 409
   *  that slips through anyway (a job started between the check and the POST) is
   *  swallowed — it just means "already started." */
  const enqueueScenes = useCallback(
    async (scenesToRun: SceneLite[]) => {
      let skip = new Set<number>();
      try {
        const { data } = await getAvatarProgress(projectId);
        skip = new Set(
          data.scenes
            .filter(
              (s) =>
                s.status === "queued" ||
                s.status === "running" ||
                s.status === "completed",
            )
            .map((s) => s.scene_id),
        );
      } catch {
        /* if the rollup fetch fails, fall through and just try enqueueing
           everything — the per-scene 409 guard still prevents duplicates */
      }
      await Promise.all(
        scenesToRun
          .filter((scene) => !skip.has(scene.id))
          .map(async (scene) => {
            try {
              await generateSceneAvatar(projectId, scene.id, preset as string);
            } catch (err: any) {
              if (err?.response?.status === 409) return;
              // Swallow — the rollup poll is the source of truth for whether a
              // scene ultimately succeeded. A POST failure just means no job row
              // was created, which `batch_status` accounts for.
            }
          }),
      );
    },
    [projectId, preset],
  );

  /** Subscribe to the server-computed rollup. This is the ONLY thing that
   *  drives the generating view — there is no client-side sequencing, no
   *  promise chain owning the batch, and no state that a page reload could
   *  lose. Reopening the tab mid-batch therefore shows real live progress
   *  instead of restarting at "0 of N".
   *
   *  Terminal state comes from the server's `batch_status`, never from
   *  comparing array lengths: a scene whose enqueue POST failed has no job row,
   *  which made the old length comparison unsatisfiable and spun forever. */
  const startPolling = useCallback(() => {
    if (progressTimer.current) return; // already subscribed
    lastChangeRef.current = Date.now();
    lastSignatureRef.current = "";

    const tick = async () => {
      try {
        const { data } = await getAvatarProgress(projectId);
        const eligibleIds = new Set(eligibleScenesRef.current.map((s) => s.id));
        const relevant = data.scenes.filter((s) => eligibleIds.has(s.scene_id));
        setSceneRows(relevant);
        setHasPolled(true);

        // Bound the spin: if nothing about the rollup changes for STALL_MS, the
        // batch is not progressing (e.g. every enqueue POST failed, so there is
        // nothing to report) — surface that instead of spinning indefinitely.
        // `kind` is part of the signature because a scene goes completed(render)
        // → completed(matte) across the handoff. Without it those two states are
        // indistinguishable here, and a slow queue could trip STALL_MS on a
        // batch that is in fact progressing normally into its second phase.
        const signature = relevant
          .map(
            (s) =>
              `${s.scene_id}:${s.kind}:${s.status}:${s.phase ?? ""}:${s.attempt_count ?? ""}`,
          )
          .join("|");
        if (signature !== lastSignatureRef.current) {
          lastSignatureRef.current = signature;
          lastChangeRef.current = Date.now();
          setStalled(false);
        } else if (Date.now() - lastChangeRef.current > STALL_MS) {
          setStalled(true);
        }

        // Promote out of "pending" as soon as the server confirms the matte rows
        // exist. Sits BEFORE the settled check on purpose: those rows push
        // batch_status back to "running", so this is the only tick that sees
        // them while the cutout is actually in flight.
        if (hasMatteRows(relevant) && mattePhaseRef.current !== "running") {
          setMattePhase("running");
        }

        // Refetch the project whenever a scene FINISHES, so the preview picks up
        // each clip as it lands. Keyed on completions only — not the full
        // signature above — so ordinary status churn (queued → running, attempt
        // counters, queue positions) doesn't refetch, and playback is only
        // interrupted when the avatar set genuinely changed. `kind` is included
        // because a scene completing its matte flips the preview from the opaque
        // mp4 to the cut-out webm, which is just as much a change.
        const completedSignature = relevant
          .filter((s) => s.status === "completed")
          .map((s) => `${s.scene_id}:${s.kind}`)
          .sort()
          .join("|");
        if (lastCompletedSignatureRef.current === null) {
          lastCompletedSignatureRef.current = completedSignature; // seed, don't fire
        } else if (completedSignature !== lastCompletedSignatureRef.current) {
          lastCompletedSignatureRef.current = completedSignature;
          void onChangedRef.current(); // fire-and-forget: never delay the next poll
        }

        if (data.batch_status === "settled") {
          // The rollup keys each scene on its MOST RECENT job, so once matte
          // rows exist they replace the render rows here and batch_status goes
          // back to "running" — which is what lets one poll drive both phases.
          if (
            matteStillOwed(relevant, bgRef.current) &&
            mattePhaseRef.current === "none"
          ) {
            // Renders are done and a background was chosen: the cutout is what
            // makes it visible (roster portraits have their rooms baked in), so
            // run it rather than dropping the user on a settings card asking
            // them to confirm work they already requested. Guarded by the phase
            // so a slow POST can't be fired twice by the next tick.
            setMattePhase("pending");
            void (async () => {
              try {
                await matteAllSceneAvatars(projectId);
              } catch {
                /* the settings card shows a Retry for failed cutouts */
              }
              await onChangedRef.current();
            })();
            return; // stay on "generating"; the next tick reports matte progress
          }

          // Settled with nothing owed: either no background was chosen (the
          // "Original" case — renders were the whole job) or the cutout has
          // already run. Either way this batch is finished.
          stopAllPolling();
          setStep("done");
          void onChangedRef.current();
        }
      } catch {
        /* transient — keep polling */
      }
    };

    void tick();
    progressTimer.current = setInterval(() => void tick(), POLL_MS);
    messageTimer.current = setInterval(() => {
      setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 4000);

    // Browsers throttle setInterval in a BACKGROUNDED tab to roughly once a
    // minute, so the poll above effectively stalls while the user is away and
    // what they see on return can be a minute out of date. Catch up the moment
    // the tab is visible again rather than waiting out the throttled interval.
    //
    // Fires an extra tick, never a second loop: the interval is untouched, and
    // this is registered only here — inside the `progressTimer.current` guard
    // at the top of startPolling — so re-entry cannot stack listeners.
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    visibilityHandlerRef.current = onVisible;
    // NOT onChanged — it is read through onChangedRef precisely so a project
    // refetch cannot invalidate this callback and stack a second interval.
  }, [projectId, stopAllPolling]);

  /** Re-attach on mount (and whenever the step becomes "generating"), mirroring
   *  SceneAvatarSection's resume behaviour. Crucially this never enqueues a
   *  RENDER and never retries, so opening or refreshing the page cannot start
   *  paid work. That was the cause of scenes appearing to restart on refresh:
   *  the old mount effect ran the whole batch, including a project-wide retry.  */
  useEffect(() => {
    if (step !== "generating") return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await getAvatarProgress(projectId);
        if (cancelled) return;
        setHasPolled(true);
        if (data.batch_status === "settled") {
          const eligibleIds = new Set(eligibleScenesRef.current.map((s) => s.id));
          const relevant = data.scenes.filter((s) => eligibleIds.has(s.scene_id));
          setSceneRows(relevant);

          // A settled batch is NOT necessarily a finished one. If a background
          // was chosen and no cutout has been queued for it, the renders were
          // only half the job — jumping to "done" here is what let a reload
          // skip the cutout permanently, leaving the user with the background
          // they picked silently not applied.
          if (matteStillOwed(relevant, bgRef.current)) {
            setMattePhase("pending");
            try {
              // NOT a violation of the "never enqueue from a mount effect" rule
              // above: that is about generateSceneAvatar re-running the PAID
              // batch. This is free, idempotent (_queue_matte skips scenes
              // already matted or in flight), and reuses the rendered mp4
              // rather than re-rendering it.
              await matteAllSceneAvatars(projectId);
            } catch {
              /* the settings card shows a Retry for failed cutouts */
            }
            if (cancelled) return;
            await onChangedRef.current();
            if (cancelled) return;
            startPolling(); // observe the matte rows we just created
            return;
          }

          // Settled and nothing owed — either no background was chosen, or the
          // cutout has already run.
          if (hasMatteRows(relevant)) setMattePhase("running");
          setStep("done");
          return;
        }
      } catch {
        /* fall through and poll anyway */
      }
      if (!cancelled) startPolling();
    })();
    return () => {
      cancelled = true;
      // Tear the interval down with the effect. Without this, any re-run (a
      // changed dependency, StrictMode's double-invoke) would leave the old
      // timer polling forever and stack a new one on top of it.
      stopAllPolling();
    };
    // onChanged is deliberately absent — read via onChangedRef, so a refetch
    // cannot re-run this effect and restart polling on top of itself.
  }, [step, projectId, startPolling, stopAllPolling]);

  /** Manual retry from the "done" screen — the project-wide retry-failed
   *  endpoint, which re-enters the back of the server-side FIFO queue. Scenes
   *  that exhausted their per-scene attempt budget are skipped by the server;
   *  only an explicit per-scene Generate resets that. */
  const retryFailed = useCallback(async () => {
    if (failedScenes.length === 0) return;
    setStalled(false);
    // Re-derive the phase from the rollup rather than carrying it over. A retry
    // of a failed RENDER would otherwise keep saying "Generating background"
    // (left over from the earlier cutout pass) while it re-renders — and the
    // "none" reset is also what re-arms the automatic cutout for the scenes
    // this retry is about to produce clips for.
    setMattePhase("none");
    // New rows are about to be created; until the rollup reports them a scene
    // without one is "Starting…" again, not "Not started".
    setHasPolled(false);
    setStep("generating");
    try {
      const { data } = await retryFailedSceneAvatars(projectId);
      if (data.retried === 0) {
        // Nothing was eligible (all exhausted) — don't spin waiting for work
        // that will never be enqueued.
        setStep("done");
        setExhaustedNotice(data.skipped_exhausted);
        return;
      }
      setExhaustedNotice(data.skipped_exhausted);
    } catch {
      /* the poll will just show these scenes still failed */
    }
    startPolling();
  }, [failedScenes, projectId, startPolling]);

  /** Seed the project's appearance columns alongside the presenter choice,
   *  unlock the batch, and start generating — the modal's final "Pay" action.
   *  The appearance values written here are the inherited-or-default ones (the
   *  wizard no longer asks); they exist so the row is consistent with what
   *  ProjectAvatarSettingsCard will show when the user edits it afterward.
   *
   *  This is the ONLY place scenes are enqueued. It used to be a mount effect
   *  keyed on `avatarBatchUnlocked`, which never gets cleared — so every
   *  subsequent page load re-ran the whole batch and fired a project-wide
   *  retry, which is what made scenes appear to restart on refresh. */
  const handleConfirm = async () => {
    setUnlocking(true);
    try {
      // Charge FIRST, and for the whole batch in one call. It also flips
      // avatar_batch_unlocked, so there is no separate updateProject for that.
      // If this 403s (not enough credits) nothing below runs, so no scene is
      // enqueued and no credits are spent.
      const { data } = await authorizeAvatarBatch(
        projectId,
        selectedScenes.map((s) => s.id),
      );
      // Reflect the new balance without waiting for a page-level refetch.
      await refreshUser();
      await onChanged();
      setStep("generating");
      // Only what was paid for — NOT every eligible scene.
      await enqueueScenes(
        eligibleScenes.filter((s) => data.scene_ids.includes(s.id)),
      );
    } catch (err: unknown) {
      // Surface the server's message: on a 403 it names the shortfall and the
      // remedy, which a generic string cannot.
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      onError(detail || "Could not start avatar generation. Please try again.");
      setUnlocking(false);
      return;
    }
    setUnlocking(false);
  };

  const selectedLabel = isCustom
    ? "Your photo"
    : mainPresets.find((p) => p.id === preset)?.label;
  const previewLabel = mainPresets[0]?.label;

  const handleFileSelected = (file: File | null) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setUploadError("Photo must be a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadError("Photo is too large. Maximum size is 8 MB.");
      return;
    }
    setUploadError(null);
    setPendingCropFile(file);
  };

  const handleCropped = async (cropped: File) => {
    setPendingCropFile(null);
    setUploading(true);
    try {
      await uploadAvatarPortrait(projectId, cropped);
      setPreset(AVATAR_CUSTOM_PRESET_ID);
      await onChanged();
      setStep("pricing");
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Could not upload that photo.";
      setUploadError(detail);
    } finally {
      setUploading(false);
    }
  };

  if (step === "pick") {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Choose a presenter for this video
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Pick one of our presenters or use your own photo. Click a card to
            get started.
          </p>
        </div>

        {/* Big, dominant, FIXED preview — always the same demo clip regardless
            of which tile is clicked. It's a "here's what this looks like"
            demo, not tied to the selection; picking a tile opens the setup
            modal directly rather than swapping this preview. */}
        <div className="max-w-md mx-auto rounded-2xl overflow-hidden border border-gray-200/70 bg-gray-50">
          <iframe
            width="560"
            height="315"
            src="https://www.youtube.com/embed/B67hdVtYWxI?si=GLWGFrNyrbGUEgO1"
            title="YouTube video player"
            className="w-full aspect-[4/3] bg-black border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
          <p className="text-[10px] text-gray-400 text-center py-1.5 bg-white/60">
            Preview · {previewLabel}
          </p>
        </div>

        {/* Compact picker strip below the preview — just Elena, Marcus, and
            "Your photo". Clicking any tile opens the setup modal directly
            (straight to pricing, or instructions first for "Your photo"). */}
        <p className="text-[11px] font-medium text-gray-500">
          Select a presenter to continue
        </p>
        <div className="grid grid-cols-3 gap-2.5 max-w-sm">
          {mainPresets.map((p) => {
            const selected = preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPreset(p.id);
                  setStep("pricing");
                }}
                title={p.label}
                className="flex flex-col items-center"
              >
                <div
                  className={`relative w-full aspect-[3/4] rounded-lg overflow-hidden bg-gradient-to-b from-gray-100 to-gray-200 transition-all ${
                    selected
                      ? "ring-2 ring-purple-600 ring-offset-1"
                      : "ring-1 ring-gray-200 hover:ring-gray-300"
                  }`}
                >
                  <AvatarPresetMedia
                    presetId={p.id}
                    label={p.label}
                    className="w-full h-full object-cover"
                    style={{ objectPosition: "50% 28%" }}
                  />
                  {selected && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-sm">
                      <CheckMark className="w-2.5 h-2.5 text-white" />
                    </span>
                  )}
                </div>
                <span
                  className={`text-[11px] font-medium mt-1 text-center ${
                    selected ? "text-purple-700" : "text-gray-700"
                  }`}
                >
                  {p.label}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setStep("instructions")}
            title={
              isCustom
                ? "Your photo"
                : customPortraitUrl
                  ? "Upload or use your saved photo"
                  : "Upload your own photo"
            }
            className="flex flex-col items-center"
          >
            <div
              className={`relative w-full aspect-[3/4] rounded-lg overflow-hidden transition-all flex flex-col items-center justify-center gap-1 ${
                isCustom
                  ? "ring-2 ring-purple-600 ring-offset-1"
                  : "border-2 border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50/40"
              }`}
            >
              {isCustom && customPortraitUrl ? (
                <>
                  <img
                    src={customPortraitUrl}
                    alt="Your uploaded presenter"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-sm">
                    <CheckMark className="w-2.5 h-2.5 text-white" />
                  </span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span className="text-[10px] font-medium text-gray-400">Upload</span>
                </>
              )}
            </div>
            <span
              className={`text-[11px] font-medium mt-1 text-center ${
                isCustom ? "text-purple-700" : "text-gray-700"
              }`}
            >
              {isCustom ? "Your photo" : "Upload photo"}
            </span>
          </button>
        </div>
      </div>
    );
  }

  if (step === "instructions") {
    if (pendingCropFile) {
      return (
        <StepModal onClose={() => setPendingCropFile(null)}>
          <ImageCropOverlay
            file={pendingCropFile}
            aspectRatio={AVATAR_UPLOAD_ASPECT_RATIO}
            onCancel={() => setPendingCropFile(null)}
            onCropped={(cropped) => void handleCropped(cropped)}
          />
        </StepModal>
      );
    }
    return (
      <StepModal onClose={() => setStep("pick")}>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Upload your photo</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              A few guidelines so the render comes out well.
            </p>
          </div>

          <AvatarPhotoGuide variant="expanded" />

          <div className="flex items-center gap-3">
            {customPortraitUrl && (
              <img
                src={customPortraitUrl}
                alt="Your uploaded presenter"
                className="w-14 h-14 rounded-lg object-cover border border-gray-200/60 flex-shrink-0"
              />
            )}
            {/* While uploading the button is replaced outright by a bare purple
                spinner — no button chrome, no label. */}
            {uploading ? (
              <span className="w-6 h-6 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin flex-shrink-0" />
            ) : (
              <button
                type="button"
                onClick={() => portraitInputRef.current?.click()}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-all"
              >
                {customPortraitUrl ? "Upload a different photo" : "Choose photo"}
              </button>
            )}
            <span className="text-[10px] text-gray-400">PNG, JPEG or WebP · up to 8 MB</span>
          </div>

          {/* A photo from a previous session exists but hasn't been committed
              to yet (the picker tile keeps showing "+ Upload" until it is) —
              offer to use it as-is without requiring a re-upload. */}
          {customPortraitUrl && !isCustom && (
            <button
              type="button"
              disabled={uploading}
              onClick={async () => {
                setPreset(AVATAR_CUSTOM_PRESET_ID);
                await onChanged();
                setStep("pricing");
              }}
              className="text-xs font-medium text-purple-600 hover:text-purple-700"
            >
              Use this photo →
            </button>
          )}

          {uploadError && (
            <p className="text-xs text-red-600" role="alert">
              {uploadError}
            </p>
          )}

          <input
            ref={portraitInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              handleFileSelected(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />

          <button
            type="button"
            onClick={() => setStep("pick")}
            className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            Back
          </button>
        </div>
      </StepModal>
    );
  }

  if (step === "pricing") {
    return (
      <StepModal
        onClose={() => setStep(isCustom ? "instructions" : "pick")}
        onGradientHeader
      >
        <div className="-m-8 rounded-2xl overflow-hidden">
          <div className="relative bg-gradient-to-br from-purple-600 to-violet-600 px-7 pt-7 pb-6 text-white overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" aria-hidden />
            <div className="absolute -bottom-10 -left-6 w-28 h-28 rounded-full bg-white/10 blur-2xl" aria-hidden />

            <p className="text-[11px] font-semibold tracking-wider text-white/80 uppercase mb-1">
              Premium avatar render
            </p>
            <h2 className="text-2xl font-bold leading-tight drop-shadow-sm">
              {selectedLabel ?? "Your presenter"}, brought to life on{" "}
              {selectedScenes.length} scene{selectedScenes.length === 1 ? "" : "s"}
            </h2>
            <p className="mt-2 text-sm text-white/90 leading-relaxed">
              To get the highest-quality result, we run this on advanced
              lip-sync models and dedicated GPU compute.{" "}
              <strong className="font-semibold text-white">
                Each scene costs {AVATAR_CREDIT_COST_PER_SCENE} AI credits.
              </strong>
            </p>
          </div>

          <div className="px-7 pt-5 pb-6 bg-white">
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2.5 text-sm text-gray-600">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center">
                  <CheckMark className="w-3 h-3 text-purple-600" />
                </span>
                <span>
                  <strong className="text-gray-700">Advanced AI models on
                  dedicated GPUs</strong> — the same premium pipeline used for
                  studio-grade lip-sync
                </span>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-gray-600">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center">
                  <CheckMark className="w-3 h-3 text-purple-600" />
                </span>
                {selectedScenes.length} scene{selectedScenes.length === 1 ? "" : "s"} rendered
                with your chosen presenter, precisely lip-synced to its narration
              </li>
              <li className="flex items-start gap-2.5 text-sm text-gray-600">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center">
                  <CheckMark className="w-3 h-3 text-purple-600" />
                </span>
                Full control afterward — adjust position or background on
                any scene
              </li>
            </ul>

            {/* Which scenes to spend on. Shown whenever there is a real choice
                to make — a project at or under the floor has none, so the list
                would only be a row of permanently-disabled checkboxes. */}
            {eligibleScenes.length > minSelectable && (
              <div className="mt-5">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-semibold text-gray-700">
                    Scenes to generate
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Selected {selectedScenes.length} of {eligibleScenes.length}
                  </p>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {minSelectable === AVATAR_BATCH_MIN_SCENES
                    ? `Choose between ${AVATAR_BATCH_MIN_SCENES} and ${AVATAR_BATCH_MAX_SCENES} scenes.`
                    : `Choose up to ${AVATAR_BATCH_MAX_SCENES} scenes.`}
                </p>
                <ul className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-50">
                  {eligibleScenes.map((s, i) => {
                    const checked = selectedIds.has(s.id);
                    // Disabled for a REASON, not just "at the limit": ticking is
                    // capped by the ceiling, unticking by the floor. Each row
                    // knows only its own direction.
                    const disabled = checked
                      ? selectedIds.size <= minSelectable
                      : selectedIds.size >= AVATAR_BATCH_MAX_SCENES;
                    return (
                      <li key={s.id}>
                        <label
                          className={`flex items-center gap-2.5 px-3 py-2 text-xs ${
                            disabled
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-gray-600 cursor-pointer hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleScene(s.id)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:opacity-40"
                          />
                          <span className="font-medium">Scene {s.order ?? i + 1}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {skippedScenes.length > 0 && (
              <p className="text-[11px] text-amber-600 mt-3">
                {skippedScenes.length} scene{skippedScenes.length === 1 ? "" : "s"} will be
                skipped (no narration yet).
              </p>
            )}

            {/* Short on credits: a warning, not a lock. The user can deselect
                scenes until the cost fits, so the modal stays usable — naming
                how many they CAN afford is what makes that actionable. */}
            {!canAfford && (
              <p className="text-[11px] text-amber-600 mt-3">
                This needs {creditCost} AI credits and you have{" "}
                {aiCreditRemaining}.{" "}
                {affordableScenes >= minSelectable
                  ? `Select ${affordableScenes} scene${affordableScenes === 1 ? "" : "s"} or fewer to continue.`
                  : "Top up your credits to continue."}
              </p>
            )}

            <button
              type="button"
              disabled={unlocking || !canAfford || selectedScenes.length === 0}
              onClick={() => void handleConfirm()}
              className="mt-6 w-full py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 disabled:opacity-60 rounded-xl shadow-[0_8px_24px_-6px_rgba(124,58,237,0.5)] transition-all hover:-translate-y-0.5 active:scale-[0.99]"
            >
              {unlocking ? "Starting…" : `Generate Avatar (${creditCost} AI credits)`}
            </button>
            <button
              type="button"
              onClick={() => setStep(isCustom ? "instructions" : "pick")}
              className="mt-2 w-full py-2 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      </StepModal>
    );
  }

  if (step === "generating") {
    const total = eligibleScenes.length;
    const done = doneRows.length;
    // Scene order is what the user recognises, not the DB id.
    const orderOf = new Map(eligibleScenes.map((s, i) => [s.id, s.order ?? i + 1]));
    // `rows` stays the pure SERVER mirror — hasMatteRows, the progress count and
    // everything else derived below must never see a synthetic row.
    const rows = [...sceneRows].sort(
      (a, b) => (orderOf.get(a.scene_id) ?? 0) - (orderOf.get(b.scene_id) ?? 0),
    );
    // What the list actually renders: one entry per eligible scene from the very
    // first paint, so the breakdown doesn't pop in a second later and shove the
    // layout down when the first poll lands. Server rows replace the
    // placeholders as they arrive.
    const rowByScene = new Map(sceneRows.map((r) => [r.scene_id, r]));
    const displayRows: DisplayRow[] = [...eligibleScenes]
      .sort((a, b) => (orderOf.get(a.id) ?? 0) - (orderOf.get(b.id) ?? 0))
      .map((s) => rowByScene.get(s.id) ?? { scene_id: s.id, placeholder: true as const });
    // Say we are on the background phase from the moment it is REQUESTED, not
    // from the moment its rows appear. Driving this off the rows alone left a
    // window where the cutout had been POSTed but the rollup still described
    // the finished renders, so the headline claimed it was still rendering.
    const inBackgroundPhase = mattePhase !== "none" || hasMatteRows(rows);
    // In "pending" the matte rows do not exist yet, so `done` still counts the
    // finished RENDERS. Showing that as "0 of N" (or snapping the bar back to
    // empty) right after the render phase read "N of N" looks like failure —
    // hold the bar full and drop the count until real matte rows arrive.
    const awaitingMatteRows = mattePhase === "pending" && !hasMatteRows(rows);
    const progressPct = awaitingMatteRows
      ? 100
      : total
        ? (done / total) * 100
        : 0;
    return (
      <div className="glass-card p-8">
        <div className="text-center">
          <div className="w-10 h-10 border-[3px] border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-gray-900">
            {stalled
              ? "Still waiting…"
              : inBackgroundPhase
                ? "Generating background"
                : LOADING_MESSAGES[messageIndex]}
          </p>
          <p className="text-xs text-gray-400 mt-1.5">
            {awaitingMatteRows
              ? "Applying your background to every scene…"
              : inBackgroundPhase
                ? `Cutting the presenter out — ${done} of ${total} scene${total === 1 ? "" : "s"} done`
                : `${done} of ${total} scene${total === 1 ? "" : "s"} finished`}
          </p>
          {inBackgroundPhase && (
            <p className="text-[11px] text-gray-400 mt-1">
              The avatars are rendered. This reuses them and does not re-render.
            </p>
          )}
          <div className="w-full max-w-xs mx-auto h-1.5 bg-gray-100 rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-purple-600 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Per-scene detail. One entry per eligible scene from the first paint
            (placeholders until the rollup reports them), then real live state —
            so a reopened tab never restarts at 0 and the list never pops in
            late and shoves the layout down. */}
        <AvatarSceneStatusList
          rows={displayRows}
          orderOf={orderOf}
          hasPolled={hasPolled}
        />

        {stalled && (
          <p className="text-[11px] text-amber-600 mt-4 text-center" role="alert">
            Nothing has changed for a while. Generation may not have started —
            try again from the Scenes tab if this persists.
          </p>
        )}
        <p className="text-[11px] text-gray-400 mt-4 text-center">
          This may take a while. You can switch tabs or close this page —
          generation keeps running in the background.
        </p>
      </div>
    );
  }

  // step === "done"
  const successCount = sceneRows.filter((s) => s.status === "completed").length;
  const hasFailures = failedScenes.length > 0;
  // Whose failure was it? After the cutout phase these rows are MATTE jobs, so
  // an unqualified "couldn't be generated" would blame the render for work that
  // actually rendered fine and only failed to have its background removed. The
  // avatar is still usable in that case — it just keeps its original
  // background, and the settings card offers a Retry for the failed cutouts.
  const failedAreMatte =
    hasFailures &&
    sceneRows.every((s) => s.status !== "failed" || s.kind === "matte");
  // Only offer Retry for failures the server would actually act on: a scene
  // that exhausted its per-scene attempt budget is skipped by the bulk endpoint
  // (only an explicit per-scene Generate resets it), so offering a button that
  // silently does nothing would be worse than not offering one.
  const canRetry = retryableFailures.length > 0;
  return (
    <div
      className={`rounded-xl px-4 py-3.5 border ${
        hasFailures
          ? "bg-amber-50/60 border-amber-100"
          : "bg-green-50/60 border-green-100"
      }`}
    >
      <p className="text-[11px] text-gray-700 leading-relaxed">
        <strong className={hasFailures ? "text-amber-700" : "text-green-700"}>
          {successCount} of {eligibleScenes.length} scene{eligibleScenes.length === 1 ? "" : "s"}
        </strong>{" "}
        now have an avatar.
        {hasFailures &&
          (failedAreMatte
            ? " Some backgrounds couldn't be applied — those scenes keep the presenter's original background."
            : " Some scenes couldn't be generated.")}
      </p>
      {(exhaustedNotice > 0 || (hasFailures && !canRetry)) && (
        <p className="text-[11px] text-gray-500 mt-1.5">
          {exhaustedNotice > 0 ? exhaustedNotice : failedScenes.length} scene
          {(exhaustedNotice > 0 ? exhaustedNotice : failedScenes.length) === 1 ? "" : "s"}{" "}
          failed too many times to retry automatically — open the scene in the
          Scenes tab to try again.
        </p>
      )}
      {canRetry && (
        <button
          type="button"
          onClick={() => void retryFailed()}
          className="mt-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold rounded-lg transition-all"
        >
          {/* avatar-retry-failed re-enqueues each scene with its OWN latest
              kind, so this retries a failed cutout as a cutout — it never
              re-runs (or re-charges for) a render that already succeeded. */}
          {failedAreMatte ? "Retry background" : "Retry"}
        </button>
      )}
    </div>
  );
}

/** Has the cutout phase begun, as far as the SERVER is concerned?
 *
 *  Deliberately `some`, not `every`. A scene whose render failed never gets a
 *  matte row at all (_queue_matte skips rows with no avatar_video_path), so
 *  `every` can never become true in a partially-failed batch — which left the
 *  wizard spinning on "generating" forever once the successful scenes' cutouts
 *  finished, and suppressed the cutout headline for the whole batch. */
function hasMatteRows(rows: AvatarProgressScene[]): boolean {
  return rows.some((s) => s.kind === "matte");
}

/** Is a cutout still owed — i.e. renders are done but nothing has been queued
 *  to make the chosen background visible?
 *
 *  Returns false for any background that does not need a cutout — null, and the
 *  explicit "original". In both cases the presenter keeps the photographic
 *  background baked into their clip, there is nothing to cut out, and no matte
 *  job may EVER be queued. Every automatic-cutout path in this component goes
 *  through this predicate, so that one check is what guarantees a background the
 *  user did not ask to replace costs nothing. */
function matteStillOwed(rows: AvatarProgressScene[], bg: AvatarBg): boolean {
  if (!avatarBgWantsCutout(bg)) return false;
  if (hasMatteRows(rows)) return false; // already under way (or finished)
  // At least one scene actually produced a clip to cut out. Without this a
  // batch where every render failed would loop asking for a matte that
  // _queue_matte would decline to create.
  return rows.some((s) => s.kind === "render" && s.status === "completed");
}


function CheckMark({ className = "w-3.5 h-3.5 text-purple-500 flex-shrink-0 mt-0.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

/**
 * Popup shell for the instructions/pricing steps — the "pick" step stays
 * inline on the Avatar tab, but picking a card should feel like committing to
 * something, the same way it did before those steps were folded into the
 * wizard's inline flow. This is the ONLY modal in the
 * pick→instructions→pricing chain (never nested inside another modal), so
 * it's safe at z-[100] like any standalone dialog in this app.
 */
function StepModal({
  onClose,
  onGradientHeader = false,
  children,
}: {
  onClose: () => void;
  /** The pricing step bleeds a colored gradient header to the card's edges
   *  (via -m-8), so its close button needs a light pill against that header
   *  instead of the plain gray X that reads fine on a white background. */
  onGradientHeader?: boolean;
  children: React.ReactNode;
}) {
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto p-8 animate-in fade-in zoom-in">
        <button
          onClick={onClose}
          className={
            onGradientHeader
              ? "absolute top-4 right-4 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white/15 text-white/90 hover:bg-white/25 transition-colors"
              : "absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          }
        >
          <svg
            className={onGradientHeader ? "w-3.5 h-3.5" : "w-5 h-5"}
            fill="none"
            stroke="currentColor"
            strokeWidth={onGradientHeader ? 2.5 : 2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
