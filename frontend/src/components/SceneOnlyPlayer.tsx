import { forwardRef, memo, useMemo } from "react";
import type { PlayerRef } from "@remotion/player";
import type { CraftedTemplateDetail, Project } from "../api/client";
import VideoPreview, { type PrecompiledTemplateData } from "./VideoPreview";

export interface SceneOnlyPlayerProps {
  /**
   * The FULL project. Required even though only one scene renders: a scene's
   * type (intro/content/outro), its content variant and its image are all
   * derived from its position among its siblings, not from the scene row. Given
   * only the scene, a middle scene would render as an intro with the wrong image.
   */
  project: Project;
  /** Scene to play, addressed by id so reordering can't shift it. */
  sceneId: number;
  /** Player length in seconds. Defaults to the scene's own duration. */
  durationSeconds?: number;
  /** Start muted. Use while recording so the old voiceover can't bleed into the mic. */
  muted?: boolean;
  className?: string;

  // ─── Passthroughs VideoPreview needs in owner-scoped / precompiled contexts ───
  layoutPropSchema?: Record<string, { defaults?: Record<string, unknown> }>;
  /** Forwarded verbatim to VideoPreview — see PrecompiledTemplateData for why
   *  this is the shared type rather than a local copy. */
  precompiledTemplateData?: PrecompiledTemplateData;
  precompiledCraftedDetail?: CraftedTemplateDetail | null;
  ownerScopedProjectId?: number;
}

/**
 * Plays a SINGLE scene of a project.
 *
 * Thin wrapper over {@link VideoPreview} rather than its own `<Player>`: that
 * reuses the crafted-template fetch + JIT compile, custom-template compile,
 * layout-schema fetch and media preloading that already live there, so crafted
 * and custom templates work here for free and this path can't drift from the
 * main preview.
 *
 * Forwards a `PlayerRef`, so callers can drive `play()` / `pause()` / `seekTo()`
 * / `getCurrentFrame()` — e.g. to run a scene in lockstep with a voiceover
 * recording.
 */
const SceneOnlyPlayer = forwardRef<PlayerRef | null, SceneOnlyPlayerProps>(
  function SceneOnlyPlayer(
    {
      project,
      sceneId,
      durationSeconds,
      muted = false,
      className,
      layoutPropSchema,
      precompiledTemplateData,
      precompiledCraftedDetail,
      ownerScopedProjectId,
    },
    ref,
  ) {
    const sceneIndex = useMemo(
      () => project.scenes?.findIndex((s) => s.id === sceneId) ?? -1,
      [project.scenes, sceneId],
    );

    // Scene isn't in the project (optimistic/unsaved row) — render nothing
    // rather than showing an unrelated scene.
    if (sceneIndex < 0) return null;

    const isPortrait = project.aspect_ratio === "portrait";

    return (
      <div
        className={`relative rounded-xl overflow-hidden bg-black ${className ?? ""}`}
        style={
          isPortrait
            ? // Give portrait an explicit height: VideoPreview's own wrapper uses
              // `max(100%, 80vh)`, which fights a parent constrained only by aspect-ratio.
              { height: "min(60vh, 420px)", aspectRatio: "9/16", margin: "0 auto" }
            : { width: "100%", aspectRatio: "16/9" }
        }
      >
        <VideoPreview
          key={`scene-only-${sceneId}`}
          ref={ref}
          project={project}
          sceneOnlyIndex={sceneIndex}
          sceneOnlyDurationSeconds={durationSeconds}
          initiallyMuted={muted}
          // If playback ever reaches the end, hold there rather than rewinding
          // to frame 0 (Remotion's default).
          holdOnLastFrame
          hideControls
          hideOverlayControls
          layoutPropSchema={layoutPropSchema}
          precompiledTemplateData={precompiledTemplateData}
          precompiledCraftedDetail={precompiledCraftedDetail}
          ownerScopedProjectId={ownerScopedProjectId}
        />
      </div>
    );
  },
);

/**
 * Memoised: this mounts a full Remotion Player, whose frame loop runs on
 * requestAnimationFrame. A parent that re-renders rapidly — e.g. the record
 * modal driving a live mic-level meter — would otherwise re-run VideoPreview's
 * whole body on every tick and starve that loop, making the scene crawl.
 */
export default memo(SceneOnlyPlayer);
