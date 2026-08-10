import { useCallback, useEffect, useRef, useState } from "react";
import { MicrophoneIcon } from "@heroicons/react/24/outline";
import {
  AVATAR_PRESETS,
  MAIN_AVATAR_PRESET_IDS,
  deleteSceneAvatar,
  getSceneAvatarStatus,
  matteSceneAvatar,
  updateSceneAvatarAppearance,
  updateSceneAvatarFocus,
  uploadAvatarPortrait,
  type CraftedTemplateDetail,
  type Project,
} from "../api/client";
import {
  AVATAR_CUSTOM_PRESET_ID,
  avatarBgWantsCutout,
  type AvatarBg,
  type AvatarCorner,
  type AvatarShape,
} from "../api/types";
import AvatarPhotoGuide from "./AvatarPhotoGuide";
import AvatarPresetMedia from "./AvatarPresetMedia";
import AvatarJobCallout from "./AvatarJobCallout";
import AvatarAppearanceControls, {
  type AvatarAppearanceInherited,
  type AvatarAppearanceValue,
} from "./AvatarAppearanceControls";

/** Matches the backend clamps for avatar_zoom. */
const MIN_ZOOM = 1;

/** How often to poll a running render. Matches VoiceOperationModal. */
const POLL_MS = 1200;

/** "1m 42s" / "48s" — a render is minutes, so seconds alone reads badly. */
function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

/**
 * Tell the user a render finished when they are not looking at this section.
 *
 * A render is minutes long and the whole point of the job model is that the user
 * can walk away — so completion has to reach them somewhere other than a spinner
 * they closed. A browser notification does that even from another tab; if it is
 * blocked or unsupported we simply skip it (the section still updates on return).
 * Permission is requested only when a render actually starts, never on page load.
 */
function notifyDone(sceneOrder: number | undefined, ok: boolean) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    // Don't interrupt someone who is already watching it happen.
    if (typeof document !== "undefined" && document.visibilityState === "visible") return;
    const where = sceneOrder ? `Scene ${sceneOrder}` : "Your scene";
    new Notification(
      ok ? "Avatar ready" : "Avatar failed",
      { body: ok ? `${where}'s avatar has finished generating.` : `${where}'s avatar could not be generated.` },
    );
  } catch {
    /* notifications are a nicety — never let one break the flow */
  }
}

/** Small on/off switch. "Do I want an avatar" is a free, instant choice —
 *  distinct from Generate, which is the costly async action that builds one. */
function Switch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
        checked ? "bg-purple-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : ""
        }`}
      />
    </button>
  );
}

/** Explicit commit point for the appearance/zoom draft — nothing reaches the
 *  server until Save is clicked, with Discard to back out unsaved edits. */
function SaveBar({
  dirty,
  saving,
  savedFlash,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  savedFlash: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      {savedFlash && !dirty && (
        <span className="text-[11px] text-green-600 mr-auto">Saved ✓</span>
      )}
      <button
        type="button"
        disabled={!dirty || saving}
        onClick={onDiscard}
        className="px-3 py-1.5 text-[11px] font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200/60 transition-colors disabled:opacity-50"
      >
        Discard
      </button>
      <button
        type="button"
        disabled={!dirty || saving}
        onClick={onSave}
        className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-[11px] font-semibold rounded-lg transition-all"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}


/**
 * On-demand talking-head avatar for a SINGLE scene.
 *
 * A render takes ~2.6 min, so unlike GenerateSceneImageModal (which freezes its
 * modal for the duration) this is deliberately NON-BLOCKING: the job runs
 * server-side and the user may close the Scene Edit modal while it works. On
 * mount we ask the server whether a render is already in flight, so reopening
 * the modal — or refreshing the page — resumes the progress display.
 */
export default function SceneAvatarSection({
  projectId,
  sceneId,
  sceneOrder,
  hasVoiceover,
  hasAvatar,
  avatarPreset,
  hasMatte = false,
  customPortraitUrl,
  aspectRatio,
  sceneFocus,
  sceneAppearance,
  projectAppearance,
  onChanged,
  onSaved,
  onGoToNarration,
  onGoToAvatarTab,
  project,
  ownerScopedProjectId,
  precompiledCraftedDetail,
  precompiledTemplateData,
}: {
  projectId: number;
  sceneId: number;
  /** 1-based scene number, used only to name the scene in a notification. */
  sceneOrder?: number;
  hasVoiceover: boolean;
  hasAvatar: boolean;
  avatarPreset?: string | null;
  /** True once this scene's clip has been cut out (needed for a custom background). */
  hasMatte?: boolean;
  /** The project's uploaded presenter photo; adds a "Your photo" tile when set. */
  customPortraitUrl?: string | null;
  /** "landscape" | "portrait" — the preview frame mirrors the real video shape. */
  aspectRatio?: string;
  /** Stored frame focus for this scene (null fields = default framing). */
  sceneFocus?: { x?: number | null; y?: number | null; zoom?: number | null };
  /** This scene's overrides; null on a field means "inherit the project setting". */
  sceneAppearance?: AvatarAppearanceValue;
  /** The project-level values this scene falls back to. */
  projectAppearance?: AvatarAppearanceInherited;
  /** Refetch the project so the preview picks up the new clip. */
  onChanged: () => void | Promise<void>;
  /** Fired ONLY after an appearance save that actually succeeded.
   *
   *  Optional because this component has two parents with different lifetimes:
   *  AvatarEditModal is a modal and wants to dismiss itself once the work is
   *  committed, while SceneEditModal renders the same section as a collapsible
   *  card that must stay put. Making it a prop rather than closing from in here
   *  is what keeps those two behaviours apart. */
  onSaved?: () => void;
  /** Jump to wherever narration is authored, shown only when there is none yet. */
  onGoToNarration?: () => void;
  /** Jump to the project-wide Avatar tab.
   *
   *  This is the ONLY route to a first render. A scene with no finished clip —
   *  including one that is queued, rendering or failed — sends the user there
   *  rather than offering a per-scene Generate button, for two reasons:
   *
   *    1. per-scene generation goes through an endpoint that charges nothing,
   *       so it was a free path to work the batch wizard prices at
   *       AVATAR_CREDIT_COST_PER_SCENE credits a scene;
   *    2. a single scene's spinner hides the batch it belongs to — the Avatar
   *       tab shows every scene's status at once, which is what someone
   *       checking on a render actually wants.
   *
   *  Optional: AvatarEditModal only ever opens for scenes that already have a
   *  clip, so it has no un-rendered state to redirect out of. */
  onGoToAvatarTab?: () => void;
  /** The full project — when provided, the Appearance preview shows the real
   *  scene (via VideoPreview) instead of a generic mock. */
  project?: Project;
  /** Pass-through VideoPreview props for the real preview — see VideoPreview.tsx. */
  ownerScopedProjectId?: number;
  precompiledCraftedDetail?: CraftedTemplateDetail | null;
  precompiledTemplateData?: {
    intro_code: string | null;
    content_codes: string[] | null;
    outro_code: string | null;
  };
}) {
  const [preset, setPreset] = useState<string>(
    avatarPreset || MAIN_AVATAR_PRESET_IDS[0]
  );
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set only once a job has actually failed — distinct from `error`, which is
  // cleared as soon as a new attempt starts. Drives the "Retry" button label.
  // 0-based position among still-queued jobs system-wide (this project's job
  // may be waiting behind another project's), or null once running/terminal.
  const [ready, setReady] = useState(hasAvatar);
  const [tookSeconds, setTookSeconds] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const [matted, setMatted] = useState(hasMatte);
  const [uploading, setUploading] = useState(false);
  // Which tile is hovered. Only the hovered (or selected) tile plays its sample
  // clip — five simultaneously-decoding videos is real CPU for a glance.
  const portraitInputRef = useRef<HTMLInputElement>(null);
  const emptyAppearance: AvatarAppearanceValue = {
    shape: null, size: null, position: null, bg: null, opacity: null,
  };
  // Per-scene overrides. A null field means "inherit the project value".
  // This is a DRAFT — edits only reach the server via the explicit Save
  // button below, so the user can try several things before committing.
  const [appearance, setAppearance] = useState<AvatarAppearanceValue>(
    sceneAppearance ?? emptyAppearance,
  );
  const [savedAppearance, setSavedAppearance] = useState<AvatarAppearanceValue>(
    sceneAppearance ?? emptyAppearance,
  );

  // Whether the user wants an avatar on this scene at all — the explicit
  // on/off state, decoupled from whether a clip has actually finished
  // rendering (`ready`). Starting true when one already exists.
  const [wantsAvatar, setWantsAvatar] = useState(hasAvatar);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  // Zoom crops the rendered clip itself (a separate endpoint from appearance),
  // folded into the Appearance step as a slider rather than its own tab. Also
  // a draft — committed together with the rest of the appearance on Save.
  const [zoom, setZoom] = useState(sceneFocus?.zoom ?? MIN_ZOOM);
  const [savedZoom, setSavedZoom] = useState(sceneFocus?.zoom ?? MIN_ZOOM);

  const [savingAppearance, setSavingAppearance] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashSaved = useCallback(() => {
    setSavedFlash(true);
    if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
    savedFlashTimer.current = setTimeout(() => setSavedFlash(false), 1500);
  }, []);

  const appearanceDirty =
    JSON.stringify(appearance) !== JSON.stringify(savedAppearance) ||
    zoom !== savedZoom;

  useEffect(() => {
    setAppearance(sceneAppearance ?? emptyAppearance);
    setSavedAppearance(sceneAppearance ?? emptyAppearance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneAppearance]);
  useEffect(() => setMatted(hasMatte), [hasMatte]);
  useEffect(() => {
    setZoom(sceneFocus?.zoom ?? MIN_ZOOM);
    setSavedZoom(sceneFocus?.zoom ?? MIN_ZOOM);
  }, [sceneFocus?.zoom]);

  /** Commit the appearance + zoom draft in one action — the explicit Save. */
  const handleSaveAppearance = async () => {
    setSavingAppearance(true);
    setError(null);
    try {
      await updateSceneAvatarAppearance(projectId, sceneId, {
        avatar_shape: appearance.shape as AvatarShape | null,
        avatar_size: appearance.size,
        avatar_position: appearance.position as AvatarCorner | null,
        avatar_bg: appearance.bg as AvatarBg,
        avatar_opacity: appearance.opacity,
      });
      if (ready && sceneOrder != null && zoom !== savedZoom) {
        await updateSceneAvatarFocus(projectId, sceneId, {
          avatar_focus_x: sceneFocus?.x ?? 50,
          avatar_focus_y: sceneFocus?.y ?? 35,
          avatar_zoom: zoom,
        });
      }
      setSavedAppearance(appearance);
      setSavedZoom(zoom);
      // Picking a background IS the request to see it, and a colour is only
      // visible once the presenter is cut out of their filmed room — so queue
      // the cutout here rather than saving a setting that silently does nothing.
      // Mirrors what the project-wide card does on ITS save.
      //
      // Gated on the matte being MISSING, not on the field being dirty: a scene
      // can already carry the right colour and still have no cutout (a render
      // that finished after the background was chosen), and that scene needs
      // this exactly as much as one being changed now.
      //
      // BG-REMOVAL-DISABLED: commented out. avatarBgWantsCutout() is hard-wired to
      // false, so this branch was already unreachable — it is commented anyway so
      // the dead call to matteSceneAvatar is visible here rather than implied by a
      // predicate in another file. TO RE-ENABLE: uncomment.
      // if (ready && !matted && avatarBgWantsCutout(appearance.bg as AvatarBg)) {
      //   try {
      //     await matteSceneAvatar(projectId, sceneId);
      //     setMatted(true);
      //   } catch {
      //     /* non-fatal: the avatar still shows with its original background, and
      //        the settings card surfaces a Retry for cutouts that failed. */
      //   }
      // }
      await onChanged();
      flashSaved();
      // INSIDE the try, never in finally: this fires only when the save really
      // succeeded. A modal parent dismisses itself here, and closing on the
      // error path would hide the message set below and look like it worked.
      onSaved?.();
    } catch {
      setError("Could not save the avatar appearance.");
    } finally {
      setSavingAppearance(false);
    }
  };

  const handleDiscardAppearance = () => {
    setAppearance(savedAppearance);
    setZoom(savedZoom);
  };

  const handleZoomChange = (next: number) => setZoom(next);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guards against a second finish() while the first is still awaiting onChanged.
  const finishingRef = useRef(false);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finish = useCallback(
    async (err: string | null, nowHasAvatar: boolean, retryable: boolean | null) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      stop();
      setError(err);
      setReady(nowHasAvatar);
      // Refresh BEFORE dropping the spinner so the preview is already correct.
      if (!err) await onChanged();
      notifyDone(sceneOrder, !err);
      setRunning(false);
      setPhase(null);
      finishingRef.current = false;
    },
    [onChanged, stop, sceneOrder]
  );

  const poll = useCallback(async () => {
    try {
      const { data } = await getSceneAvatarStatus(projectId, sceneId);
      if (data.done) {
        setTookSeconds(data.duration_seconds);
        await finish(data.error, data.has_avatar, data.retryable);
      }
      else if (data.active) {
        setRunning(true);
        setPhase(data.phase);
      }
    } catch {
      // Transient failures are ignored — keep polling, like VoiceOperationModal.
    }
  }, [projectId, sceneId, finish]);

  const startPolling = useCallback(() => {
    stop();
    timerRef.current = setInterval(() => void poll(), POLL_MS);
  }, [poll, stop]);

  // Resume-on-mount: a render started earlier may still be running.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await getSceneAvatarStatus(projectId, sceneId);
        if (cancelled) return;
        setReady(data.has_avatar);
        if (data.has_avatar) setWantsAvatar(true);
        if (data.avatar_preset) setPreset(data.avatar_preset);
        if (data.active) {
          setRunning(true);
            startPolling();
        }
      } catch {
        /* non-fatal — the section just shows its idle state */
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [projectId, sceneId, startPolling, stop]);

  // NOTE: there is deliberately no handleGenerate here any more. Starting a
  // render from this section POSTed to /scenes/{id}/avatar, which charges
  // nothing, while the batch wizard charges AVATAR_CREDIT_COST_PER_SCENE for the
  // same GPU work — and this section mounts for every scene in SceneEditModal,
  // so it was a free route to paid work. A scene with no finished clip now
  // redirects to the Avatar tab (see the !ready branch below), which is the one
  // priced entry point. The endpoint itself stays for the fallback matte path.

  /** Upload a presenter photo and immediately select it, since choosing it is the
   *  only reason to have uploaded one here. */
  const handlePortraitUpload = async (file: File | null) => {
    if (!file) return;
    // Validate client-side so the user is not made to wait for an 8 MB round trip
    // just to be refused. The server enforces both limits regardless.
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Photo must be a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Photo is too large. Maximum size is 8 MB.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await uploadAvatarPortrait(projectId, file);
      setPreset(AVATAR_CUSTOM_PRESET_ID);
      await onChanged();
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Could not upload that photo.";
      setError(detail);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);
    try {
      await deleteSceneAvatar(projectId, sceneId);
      setReady(false);
      setWantsAvatar(false);
      setConfirmingRemove(false);
      await onChanged();
    } catch {
      setError("Could not remove the avatar.");
    } finally {
      setRemoving(false);
    }
  };

  /** Flip the top-level on/off switch. Only shown once a clip exists, so
   *  turning it off always means discarding an existing render — ask first
   *  instead of firing immediately. */
  const handleToggle = (next: boolean) => {
    if (!next) {
      setConfirmingRemove(true);
      return;
    }
    setWantsAvatar(next);
  };

  /** Update the local appearance draft. Nothing reaches the server until
   *  Save is clicked. */
  const handleAppearanceChange = (patch: Partial<AvatarAppearanceValue>) => {
    setAppearance((prev) => ({ ...prev, ...patch }));
  };

  if (!hasVoiceover) {
    return (
      <div className="rounded-xl bg-gray-50/80 border border-gray-200/60 px-4 py-5 text-center">
        <MicrophoneIcon className="w-6 h-6 text-gray-300 mx-auto mb-2" />
        <p className="text-xs text-gray-500 mb-1">Avatar needs narration first</p>
        <p className="text-[11px] text-gray-400 max-w-xs mx-auto leading-relaxed mb-3">
          The avatar lip-syncs to this scene's voiceover, so add narration before
          generating one.
        </p>
        {onGoToNarration && (
          <button
            type="button"
            onClick={onGoToNarration}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold rounded-lg transition-all"
          >
            Go to narration
          </button>
        )}
      </div>
    );
  }

  const presetLabel =
    preset === AVATAR_CUSTOM_PRESET_ID
      ? "Your photo"
      : (AVATAR_PRESETS.find((p) => p.id === preset)?.label ?? "Presenter");

  // NOTE: the presenter picker that lived here is gone. Choosing a presenter is
  // now part of the Avatar tab's wizard, which is the single priced entry point
  // to a render; a scene with no finished clip redirects there instead. Once a
  // clip exists the ready view below shows the presenter read-only, as it always
  // did — switching presenters still means removing the avatar first.

  // Queued (not yet claimed by the dispatcher) shows real queue depth rather
  // than an unchanging spinner — the server-side queue is system-wide, so
  // this project's job may be waiting behind another project's.

  // NOTE: the per-scene progress callout and Generate/Retry button that used to
  // live here are gone with the !ready branch below. A scene that is queued,
  // rendering or failed now redirects to the Avatar tab, which shows the whole
  // batch rather than this one scene in isolation.

  const appearanceControls = projectAppearance && (
    <AvatarAppearanceControls
      scope="scene"
      value={appearance}
      inherited={projectAppearance}
      previewPresetId={preset}
      customPortraitUrl={customPortraitUrl}
      aspectRatio={aspectRatio}
      framing={
        ready && sceneOrder != null
          ? { zoom, onZoomChange: handleZoomChange }
          : undefined
      }
      onChange={handleAppearanceChange}
      project={project}
      sceneId={sceneId}
      hasRenderedClip={ready}
      ownerScopedProjectId={ownerScopedProjectId}
      precompiledCraftedDetail={precompiledCraftedDetail}
      precompiledTemplateData={precompiledTemplateData}
    />
  );

  // NO FINISHED CLIP — including queued, rendering and failed. Everything about
  // starting or watching a render lives on the project-wide Avatar tab, so send
  // the user there instead of duplicating it per scene.
  //
  // This replaced a per-scene presenter picker + "Generate avatar" button. That
  // button POSTed to an endpoint which charges NOTHING, while the batch wizard
  // charges AVATAR_CREDIT_COST_PER_SCENE credits a scene for the same GPU work —
  // and the section mounts for every scene in SceneEditModal, so it was a free
  // route to paid work. It also showed a lone spinner for a scene that is usually
  // one of several rendering together; the Avatar tab shows them all.
  //
  // The condition is deliberately "is there something to EDIT?", not "does a job
  // exist": a failed scene redirects too, because retrying belongs next to the
  // batch-wide retry rather than in a modal for one scene.
  if (!ready) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-gray-400">
          {running
            ? "This scene's presenter is being generated. The Avatar tab shows progress for every scene."
            : "Presenters are generated for the whole video from the Avatar tab, where you pick the presenter and see the cost before anything starts."}
        </p>

        {onGoToAvatarTab && (
          <button
            type="button"
            onClick={onGoToAvatarTab}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-all"
          >
            {running ? "View progress" : "Go to Avatar tab"}
          </button>
        )}

        {error && (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* On/off — only shown once a clip exists, since turning off means
          discarding it. Separate from the async render that builds a new one. */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">Avatar overlay</p>
          <p className="text-[11px] text-gray-400">
            {wantsAvatar ? "Showing on this scene" : "Not shown on this scene"}
          </p>
        </div>
        {confirmingRemove ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500">Remove this avatar?</span>
            <button
              type="button"
              onClick={() => setConfirmingRemove(false)}
              className="px-2.5 py-1 text-[11px] font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-md border border-gray-200/60"
            >
              Keep
            </button>
            <button
              type="button"
              disabled={removing}
              onClick={handleRemove}
              className="px-2.5 py-1 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          </div>
        ) : (
          <Switch checked={wantsAvatar} onChange={handleToggle} disabled={running} />
        )}
      </div>

      {wantsAvatar && (
        <div className="space-y-4">
          {/* Read-only presenter summary — once a clip exists there is no
              in-place regenerate, so this is informational rather than a
              picker. Switching presenters means removing this avatar (above)
              and generating a fresh one. */}
          <div className="flex items-center gap-3 rounded-xl bg-gray-50/80 border border-gray-200/60 px-3.5 py-3">
            <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">
              <AvatarPresetMedia
                presetId={preset}
                label={presetLabel}
                srcOverride={preset === AVATAR_CUSTOM_PRESET_ID ? customPortraitUrl : undefined}
                className="w-full h-full object-cover"
                style={{ objectPosition: "50% 28%" }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-900">{presetLabel}</p>
              <p className="text-[11px] text-gray-400">
                This scene has an avatar overlay
                {tookSeconds != null && ` — generated in ${formatDuration(tookSeconds)}`}.
              </p>
            </div>
          </div>

          <p className="text-[11px] text-gray-400">
            Appearance for this scene only. Anything left untouched follows
            the project-wide Avatar settings.
          </p>

          {appearanceControls}

          <SaveBar
            dirty={appearanceDirty}
            saving={savingAppearance}
            savedFlash={savedFlash}
            onSave={() => void handleSaveAppearance()}
            onDiscard={handleDiscardAppearance}
          />

          {/* No per-scene "remove background" prompt. Choosing a background is
              itself the request to see it, so the project Avatar tab starts the
              cutout on save and reports it there scene by scene — asking again
              here was asking twice, for work already under way. */}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
