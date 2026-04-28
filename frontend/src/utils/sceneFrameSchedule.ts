import type { Project } from "../api/client";
import { getSceneDurationFrames } from "../components/remotion/playbackSpeed";

const FPS = 30;

/** Where within each scene to sample (0–1). 0.5 looked too early; ~0.65 matches full layout + imagery. */
export const SCENE_EXPORT_TIMELINE_FRACTION = 0.85;

/**
 * Per-scene target frame (global composition frames), matching VideoPreview / Remotion sequencing:
 * duration = duration_seconds + extra_hold_seconds at playback 1×.
 * Export frame = start + clamp(floor(duration * SCENE_EXPORT_TIMELINE_FRACTION)).
 */
export function getSceneExportFrameSchedule(project: Project): {
  frame: number;
  title: string;
  order: number;
  safeSlug: string;
}[] {
  if (!project.scenes?.length) return [];
  let offset = 0;
  return project.scenes.map((s, i) => {
    const base = Number(s.duration_seconds) || 5;
    const extra = Number(s.extra_hold_seconds) || 0;
    const durationFrames = getSceneDurationFrames(base + extra, FPS, 1);
    const startFrame = offset;
    offset += durationFrames;
    const local = Math.floor(durationFrames * SCENE_EXPORT_TIMELINE_FRACTION);
    const clampedLocal = Math.max(0, Math.min(durationFrames - 1, local));
    const exportFrame = startFrame + clampedLocal;
    const title = s.title || `Scene ${i + 1}`;
    const safeSlug = `${String(i + 1).padStart(2, "0")}_${title
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || "scene"}`;
    return { frame: exportFrame, title, order: i + 1, safeSlug };
  });
}
