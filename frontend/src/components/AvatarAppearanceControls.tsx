import { useMemo, useState } from "react";
import {
  ArrowDownLeftIcon,
  ArrowDownRightIcon,
  ArrowUpLeftIcon,
  ArrowUpRightIcon,
} from "@heroicons/react/24/outline";
import type { CraftedTemplateDetail, Project } from "../api/client";
import { AVATAR_BG_ORIGINAL } from "../api/types";
import AvatarPresetMedia from "./AvatarPresetMedia";
import VideoPreview from "./VideoPreview";
import { getSceneExportGlobalFrame, SCENE_EXPORT_TIMELINE_FRACTION } from "../utils/sceneFrameSchedule";
import { resolveAvatarClipUrl } from "../utils/avatarClipUrl";
import {
  AVATAR_BG_PRESETS,
  AVATAR_CUSTOM_PRESET_ID,
  AVATAR_MAX_SIZE,
  AVATAR_MIN_OPACITY,
  AVATAR_MIN_SIZE,
  type AvatarBg,
  type AvatarCorner,
  type AvatarShape,
} from "../api/types";

const SHAPES: { value: AvatarShape; label: string }[] = [
  { value: "circle", label: "Circle" },
  { value: "rounded", label: "Rounded" },
  { value: "square", label: "Square" },
];

const POSITIONS: {
  value: AvatarCorner;
  label: string;
  Icon: typeof ArrowUpLeftIcon;
}[] = [
  { value: "top_left", label: "Top Left", Icon: ArrowUpLeftIcon },
  { value: "top_right", label: "Top Right", Icon: ArrowUpRightIcon },
  { value: "bottom_left", label: "Bottom Left", Icon: ArrowDownLeftIcon },
  { value: "bottom_right", label: "Bottom Right", Icon: ArrowDownRightIcon },
];

/** Small literal shape swatch shown inline in the Shape buttons — reads faster
 *  than the word alone. */
function ShapeGlyph({ shape, className = "w-2.5 h-2.5" }: { shape: AvatarShape; className?: string }) {
  return (
    <span
      className={`inline-block bg-current flex-shrink-0 ${className}`}
      style={{
        borderRadius: shape === "circle" ? "50%" : shape === "rounded" ? "30%" : 0,
      }}
    />
  );
}

/** The four settings, as stored. NULL in scene scope means "inherit". */
export interface AvatarAppearanceValue {
  shape: AvatarShape | null;
  size: number | null;
  position: AvatarCorner | null;
  bg: AvatarBg;
  opacity: number | null;
}

/** Concrete project-level values a scene falls back to. */
export interface AvatarAppearanceInherited {
  shape: AvatarShape;
  size: number;
  position: AvatarCorner;
  bg: AvatarBg;
  opacity: number;
}

const DEFAULT_COLOR = "#1E293B";

/** Per-scene framing (crop of the rendered clip), shown as a slider alongside
 *  the rest of the appearance controls rather than in a tab of its own. Only
 *  meaningful once a clip exists, so the caller omits these props until then. */
export interface AvatarFramingControls {
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

/**
 * Shape / size / placement / background controls for the talking-head overlay.
 *
 * Used in THREE places — the project Avatar tab, the Scene Edit modal, and the
 * Scenes-tab row — so it lives here rather than being written out three times.
 * The two AvatarOverlay twins are already a standing reminder of how quickly
 * duplicated avatar code drifts.
 *
 * scope="project"  values are always concrete; this is the video-wide default.
 * scope="scene"    values may be null, meaning "inherit the project setting".
 *                  Each control shows that state and offers a reset.
 */
export default function AvatarAppearanceControls({
  value,
  inherited,
  scope,
  disabled = false,
  previewPresetId,
  customPortraitUrl,
  aspectRatio = "landscape",
  framing,
  onChange,
  project,
  sceneId,
  hasRenderedClip = false,
  ownerScopedProjectId,
  precompiledCraftedDetail,
  precompiledTemplateData,
}: {
  value: AvatarAppearanceValue;
  /** Project-level values a scene inherits. In project scope, pass the same values. */
  inherited: AvatarAppearanceInherited;
  scope: "project" | "scene";
  disabled?: boolean;
  /** Show only this presenter in the preview row (the scene's own). */
  previewPresetId?: string | null;
  /** The project's uploaded portrait, for previewing the "custom" presenter. */
  customPortraitUrl?: string | null;
  /** "landscape" | "portrait" — the preview frame mirrors the real video shape. */
  aspectRatio?: string;
  /** Zoom slider for cropping the rendered clip. Omitted where there's no clip yet. */
  framing?: AvatarFramingControls;
  onChange: (patch: Partial<AvatarAppearanceValue>) => void;
  /** The full project — needed to render the real scene as the live preview. */
  project?: Project;
  /** Which scene's appearance is being edited (scope="scene" only). */
  sceneId?: number;
  /** Whether this scene already has a rendered avatar clip — gates the
   *  real before/after preview (nothing to render before that). */
  hasRenderedClip?: boolean;
  /** Pass-through VideoPreview props — see VideoPreview.tsx for what each does. */
  ownerScopedProjectId?: number;
  precompiledCraftedDetail?: CraftedTemplateDetail | null;
  precompiledTemplateData?: {
    intro_code: string | null;
    content_codes: string[] | null;
    outro_code: string | null;
  };
}) {
  const isScene = scope === "scene";

  // What the overlay will ACTUALLY use, which is what the preview must show.
  const shape = value.shape ?? inherited.shape;
  const size = value.size ?? inherited.size;
  const position = value.position ?? inherited.position;
  const bg = value.bg !== undefined && value.bg !== null ? value.bg : inherited.bg;
  const opacity = value.opacity ?? inherited.opacity ?? 1;

  // null and "original" both select the Original swatch. They are stored
  // differently — project-scope null has always meant Original, while a scene
  // needs the explicit sentinel because null there means "inherit" — but they
  // describe the same picture, so the control must not distinguish them.
  const bgMode: "original" | "color" | "transparent" =
    bg === null || bg === undefined || bg === AVATAR_BG_ORIGINAL
      ? "original"
      : bg === "transparent"
        ? "transparent"
        : "color";

  // No override tracking here any more — no "custom appearance" summary, no
  // per-field reset, no reset-all. Every control is a direct picker, so putting
  // a value back is just picking it; and since the project-wide Avatar tab now
  // stamps its settings onto every scene, a per-scene "reset to project" had no
  // durable meaning — the next global save would overwrite it regardless.

  // ── Real-scene preview ──────────────────────────────────────────────────
  // Shows the actual scene (via the same VideoPreview the rest of the app
  // uses), paused on one representative frame, instead of a hand-drawn mock.
  // Only meaningful once this scene has a rendered avatar clip to show. Not
  // restricted to scope="scene" — the project-level Avatar tab shows the same
  // Before/After (saved defaults vs. the draft being edited) once any scene
  // has a clip to preview against.
  const sceneIndex = project?.scenes.findIndex((s) => s.id === sceneId) ?? -1;
  const canShowRealPreview = hasRenderedClip && !!project && sceneIndex >= 0;
  // Before any avatar clip exists at all (e.g. picking a presenter for the
  // first time), there is nothing to composite yet, but the real scene
  // BACKGROUND can still be shown behind a mocked-up corner overlay — reads
  // far better than a flat gray placeholder. VideoPreview simply omits the
  // AvatarOverlay layer when the scene has no avatar_video_path, so passing
  // the project as-is naturally renders background-only.
  const canShowRealBackground = !canShowRealPreview && !!project && sceneIndex >= 0;

  // "After" = this scene's saved fields overridden by the current draft, the
  // same null-coalescing resolution used above for `shape`/`size`/etc., so the
  // preview always matches exactly what Save would persist. "Before" is the
  // project as-is (last-saved fields). Shown side by side, not as a toggle,
  // so the effect of a change is visible immediately without an extra click.
  const afterProject = useMemo<Project | null>(() => {
    if (!project || sceneIndex < 0) return null;
    return {
      ...project,
      // PROJECT scope edits the video-wide default, which reaches AvatarOverlay
      // as context — so the draft has to land on these fields too, not only on
      // the previewed scene. Without this the preview ignored every change on
      // this tab whenever the scene carried its own overrides (which it always
      // does once Save has stamped them onto every scene), because the overlay
      // resolves `sceneProp ?? ctx.value` and the stale scene prop won.
      ...(isScene
        ? null
        : {
            avatar_shape: shape,
            avatar_size: size,
            avatar_position: position,
            avatar_bg: bg,
            avatar_opacity: opacity,
          }),
      scenes: project.scenes.map((s, i) =>
        i === sceneIndex
          ? {
              ...s,
              // Scene scope: the draft IS this scene's override, so write it.
              // Project scope: clear the overrides instead, so the project-level
              // draft above is what the overlay falls back to — otherwise this
              // scene's saved values would keep beating the value being edited.
              avatar_shape: isScene ? shape : null,
              avatar_size: isScene ? size : null,
              avatar_position: isScene ? position : null,
              avatar_bg: isScene ? bg : null,
              avatar_opacity: isScene ? opacity : null,
              avatar_zoom: framing ? framing.zoom : s.avatar_zoom,
            }
          : s
      ),
    };
  }, [project, sceneIndex, isScene, shape, size, position, bg, opacity, framing]);

  const beforeFrame =
    sceneIndex >= 0 && project
      ? getSceneExportGlobalFrame(project, sceneIndex, SCENE_EXPORT_TIMELINE_FRACTION)
      : 0;
  const afterFrame =
    sceneIndex >= 0 && afterProject
      ? getSceneExportGlobalFrame(afterProject, sceneIndex, SCENE_EXPORT_TIMELINE_FRACTION)
      : 0;

  const previewW = aspectRatio === "portrait" ? 180 : 320;
  const previewH = aspectRatio === "portrait" ? 320 : 180;

  // "With avatar" (the composited scene, via VideoPreview) vs. "Avatar only"
  // (the raw talking-head clip, plain <video>) — switched by tab rather than
  // shown side by side, since both are full clips now rather than a single
  // before/after frame.
  const [previewTab, setPreviewTab] = useState<"scene" | "avatar">("scene");
  const activeScene = sceneIndex >= 0 ? project?.scenes[sceneIndex] : undefined;
  const avatarOnlyUrl =
    project && activeScene ? resolveAvatarClipUrl(project, activeScene) : undefined;

  return (
    <div className="space-y-6">
      {/* Live preview — the actual scene (via VideoPreview, the same player used
          everywhere else in the app), paused on a representative frame. Before
          (current saved settings) and After (the settings being tested) sit
          side by side so the effect of a change is visible right away. */}
      <div className="flex flex-col items-center">
        <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2.5">
          Preview
        </label>

        {canShowRealPreview && project && afterProject ? (
          <div className="flex flex-col items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              <button
                type="button"
                onClick={() => setPreviewTab("scene")}
                className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                  previewTab === "scene"
                    ? "bg-white text-purple-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                With avatar
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("avatar")}
                disabled={!avatarOnlyUrl}
                className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  previewTab === "avatar"
                    ? "bg-white text-purple-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Avatar only
              </button>
            </div>

            {previewTab === "scene" ? (
              <div
                className="relative overflow-hidden rounded-xl border border-purple-300 bg-black"
                style={{ width: previewW, height: previewH }}
              >
                <VideoPreview
                  key={`avatar-preview-after-${sceneId}`}
                  project={afterProject}
                  initialFrame={afterFrame}
                  hideControls
                  ownerScopedProjectId={ownerScopedProjectId}
                  precompiledCraftedDetail={precompiledCraftedDetail}
                  precompiledTemplateData={precompiledTemplateData}
                />
              </div>
            ) : (
              <div
                className="relative overflow-hidden rounded-xl border border-gray-200/70 bg-black flex items-center justify-center"
                style={{ width: previewW, height: previewH }}
              >
                {avatarOnlyUrl && (
                  <video
                    key={`avatar-preview-only-${sceneId}`}
                    src={avatarOnlyUrl}
                    className="w-full h-full object-contain"
                    controls
                    playsInline
                  />
                )}
              </div>
            )}
          </div>
        ) : previewPresetId || customPortraitUrl ? (
          // No rendered clip to show yet (nothing generated), but a presenter
          // has been chosen. Mock a video frame with the presenter shown as the
          // small corner overlay it will actually be — same box math (size,
          // shape, position, margin) as the real AvatarOverlay — rather than a
          // full-bleed photo, so "Preview" previews the real placement too.
          (() => {
            const mockW = previewW;
            const mockH = previewH;
            const boxW = Math.round(mockW * size);
            const boxH = shape === "rounded" ? Math.round(boxW * 1.25) : boxW;
            const boxRadius =
              shape === "circle" ? "50%" : shape === "square" ? 0 : Math.round(boxW * 0.08);
            const mockMargin = Math.round(mockW * 0.03);
            const [vert, horiz] = position.split("_");
            const isCutout = bgMode === "transparent";
            return (
              <div
                className="relative overflow-hidden rounded-xl border border-gray-200/70 bg-black"
                style={{
                  width: mockW,
                  height: mockH,
                  background: canShowRealBackground
                    ? undefined
                    : "linear-gradient(135deg,#e2e8f0 0%,#cbd5e1 50%,#b9c3d1 100%)",
                }}
              >
                {canShowRealBackground && project && (
                  // VideoPreview always renders its own CC/speed buttons pinned to
                  // its bottom-right regardless of `hideControls` (that prop only
                  // hides the Remotion scrubber bar) — this is a static mock
                  // preview, so no interactive controls belong on it. Hidden via a
                  // scoped stylesheet targeting their stable data-tour attributes,
                  // since Tailwind's arbitrary descendant-selector syntax doesn't
                  // reliably match unquoted attribute values and overflow clipping
                  // alone doesn't help when they sit right at this box's edge.
                  <div
                    className="avatar-mock-preview-frame absolute inset-0 overflow-hidden pointer-events-none"
                    style={{ width: mockW, height: mockH }}
                  >
                    <style>{`
                      .avatar-mock-preview-frame [data-tour="captions"],
                      .avatar-mock-preview-frame [data-tour="playback-speed"] {
                        display: none !important;
                      }
                    `}</style>
                    <VideoPreview
                      key={`avatar-bg-preview-${project.id}-${sceneIndex}`}
                      project={project}
                      initialFrame={beforeFrame}
                      hideControls
                      ownerScopedProjectId={ownerScopedProjectId}
                      precompiledCraftedDetail={precompiledCraftedDetail}
                      precompiledTemplateData={precompiledTemplateData}
                    />
                  </div>
                )}
                <div
                  className="absolute overflow-hidden"
                  style={{
                    width: boxW,
                    height: boxH,
                    [vert === "top" ? "top" : "bottom"]: mockMargin,
                    [horiz === "right" ? "right" : "left"]: mockMargin,
                    // Radius follows the SHAPE even for a transparent background.
                    // This mock draws a rectangular preset photo (nothing has been
                    // rendered or matted yet), so zeroing the radius here made the
                    // Shape control look broken: picking "rounded" changed only the
                    // box's height and left hard corners. The drop-shadow stays
                    // suppressed for a cutout, where there is no box edge to cast one.
                    borderRadius: boxRadius,
                    boxShadow: isCutout ? undefined : "0 2px 8px rgba(0,0,0,0.28)",
                    backgroundColor:
                      bgMode === "color" && bg && !isCutout ? bg : undefined,
                    opacity,
                  }}
                >
                  <AvatarPresetMedia
                    presetId={previewPresetId ?? AVATAR_CUSTOM_PRESET_ID}
                    label={previewPresetId ?? "Your photo"}
                    srcOverride={previewPresetId ? undefined : customPortraitUrl}
                    playing
                    className="w-full h-full object-cover"
                    style={{ objectPosition: "50% 28%" }}
                  />
                </div>
              </div>
            );
          })()
        ) : (
          <div
            className="relative overflow-hidden rounded-xl border border-gray-200/70 flex items-center justify-center"
            style={{
              width: previewW,
              height: previewH,
              background: "linear-gradient(135deg,#f8fafc 0%,#eef2f7 50%,#e7ecf3 100%)",
            }}
          >
            <p className="text-[10px] text-gray-400 text-center px-4">
              Generate the avatar to preview it on this scene
            </p>
          </div>
        )}

        <p className="mt-2 text-[10px] text-gray-400 text-center">
          {Math.round(size * 100)}% of frame width ·{" "}
          {position.replace("_", " ")}
        </p>
      </div>

      <div className="space-y-4">
      {/* No override summary or reset control. These fields are all direct
          pickers, so "differs from the project" is something the user can see
          in the controls themselves — and the project-wide Avatar tab now
          stamps its values onto every scene anyway, so a per-scene reset had
          no lasting meaning: the next global save would overwrite it. */}

      {/* Two columns: Placement/Shape (silhouette controls) on the left,
          fine-adjustment sliders on the right. */}
      <div className="grid grid-cols-2 gap-5">
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">
              Placement
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {POSITIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ position: p.value })}
                  title={p.label}
                  aria-label={p.label}
                  className={`flex items-center justify-center px-2 py-1.5 rounded-lg transition-all disabled:opacity-50 ${
                    position === p.value
                      ? "bg-purple-600 text-white border border-purple-600"
                      : "bg-white text-gray-700 border border-gray-300 hover:border-purple-300 hover:bg-purple-50/40"
                  }`}
                >
                  <p.Icon className="w-4 h-4 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">
              Shape
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {SHAPES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ shape: s.value })}
                  title={s.label}
                  aria-label={s.label}
                  className={`flex items-center justify-center px-2 py-1.5 rounded-lg transition-all disabled:opacity-50 ${
                    shape === s.value
                      ? "bg-purple-600 text-white border border-purple-600"
                      : "bg-white text-gray-700 border border-gray-300 hover:border-purple-300 hover:bg-purple-50/40"
                  }`}
                >
                  <ShapeGlyph shape={s.value} className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
              Size{" "}
              <span className="text-gray-500 normal-case tracking-normal">
                {Math.round(size * 100)}% of width
              </span>
            </label>
            <input
              type="range"
              min={Math.round(AVATAR_MIN_SIZE * 100)}
              max={Math.round(AVATAR_MAX_SIZE * 100)}
              step={1}
              value={Math.round(size * 100)}
              disabled={disabled}
              onChange={(e) => onChange({ size: parseInt(e.target.value, 10) / 100 })}
              className="w-full h-1.5 bg-gray-300 rounded-full appearance-none cursor-pointer accent-purple-600 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
              Opacity{" "}
              <span className="text-gray-500 normal-case tracking-normal">
                {Math.round(opacity * 100)}%
              </span>
            </label>
            <input
              type="range"
              min={Math.round(AVATAR_MIN_OPACITY * 100)}
              max={100}
              step={1}
              value={Math.round(opacity * 100)}
              disabled={disabled}
              onChange={(e) => onChange({ opacity: parseInt(e.target.value, 10) / 100 })}
              className="w-full h-1.5 bg-gray-300 rounded-full appearance-none cursor-pointer accent-purple-600 disabled:opacity-50"
            />
          </div>

          {framing && (
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                Zoom{" "}
                <span className="text-gray-500 normal-case tracking-normal">
                  {framing.zoom.toFixed(1)}×
                </span>
              </label>
              <input
                type="range"
                min={10}
                max={30}
                step={1}
                value={Math.round(framing.zoom * 10)}
                disabled={disabled}
                onChange={(e) => framing.onZoomChange(parseInt(e.target.value, 10) / 10)}
                className="w-full h-1.5 bg-gray-300 rounded-full appearance-none cursor-pointer accent-purple-600 disabled:opacity-50"
              />
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">
          Background
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            // Scope decides which value means "Original":
            //   SCENE   -> the explicit sentinel. null would mean "inherit", which
            //              is a different request and is what the reset X sends —
            //              emitting null here made the two indistinguishable, and
            //              left Save disabled because nothing had changed.
            //   PROJECT -> null, which has always meant Original there. Writing
            //              the sentinel instead would churn every existing row for
            //              no behavioural gain, and make the card's dirty check
            //              (bg !== (avatarBg ?? null)) fire on load.
            onClick={() => onChange({ bg: isScene ? AVATAR_BG_ORIGINAL : null })}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
              bgMode === "original"
                ? "bg-purple-600 text-white border border-purple-600"
                : "bg-white text-gray-700 border border-gray-300 hover:border-purple-300 hover:bg-purple-50/40"
            }`}
          >
            Original
          </button>

          <span className="w-px self-stretch bg-gray-200" aria-hidden />

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              title="Transparent"
              disabled={disabled}
              onClick={() => onChange({ bg: "transparent" })}
              style={{
                backgroundImage:
                  "linear-gradient(45deg,#e5e7eb 25%,transparent 25%,transparent 75%,#e5e7eb 75%),linear-gradient(45deg,#e5e7eb 25%,transparent 25%,transparent 75%,#e5e7eb 75%)",
                backgroundSize: "6px 6px",
                backgroundPosition: "0 0, 3px 3px",
              }}
              className={`w-6 h-6 rounded-full border-2 transition-all disabled:opacity-50 ${
                bgMode === "transparent"
                  ? "border-purple-600 scale-110"
                  : "border-gray-200"
              }`}
            />
            {AVATAR_BG_PRESETS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                disabled={disabled}
                onClick={() => onChange({ bg: c.value })}
                style={{ backgroundColor: c.value }}
                className={`w-6 h-6 rounded-full border-2 transition-all disabled:opacity-50 ${
                  bgMode === "color" && (bg as string)?.toLowerCase() === c.value.toLowerCase()
                    ? "border-purple-600 scale-110"
                    : "border-gray-200"
                }`}
              />
            ))}
            <input
              type="color"
              value={bgMode === "color" ? (bg as string) || DEFAULT_COLOR : DEFAULT_COLOR}
              disabled={disabled}
              onChange={(e) => onChange({ bg: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer disabled:opacity-50 bg-transparent border border-gray-200"
              title="Custom colour"
            />
          </div>
        </div>

        {/* No explainer here. The swatches already say what they do, and how the
            cutout is produced (reusing the existing clip rather than
            re-rendering) is an implementation detail the user did not ask about.
            The only background message worth showing is progress on an actual
            pass — which lives in ProjectAvatarSettingsCard, next to the Save
            that starts it. */}
      </div>
      </div>
    </div>
  );
}
