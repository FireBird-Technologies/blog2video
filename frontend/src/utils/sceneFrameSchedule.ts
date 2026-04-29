import type { Project, Scene } from "../api/client";
import { getSceneDurationFrames } from "../components/remotion/playbackSpeed";

const FPS = 30;

/** Where within each scene to sample (0–1). 0.5 looked too early; ~0.85 matches full layout + imagery. */
export const SCENE_EXPORT_TIMELINE_FRACTION = 0.85;

function framesForScene(scene: Scene): number {
  const base = Number(scene.duration_seconds) || 5;
  const extra = Number(scene.extra_hold_seconds) || 0;
  return getSceneDurationFrames(base + extra, FPS, 1);
}

function normalizeTimelineFractions(length: number, timelineFractions?: number[]): number[] {
  const def = SCENE_EXPORT_TIMELINE_FRACTION;
  if (!timelineFractions || timelineFractions.length === 0) {
    return Array.from({ length }, () => def);
  }
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    const v = timelineFractions[i];
    out.push(
      typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : def
    );
  }
  return out;
}

/**
 * Global composition frame for `sceneIndex` at `timelineFraction` (0–1 through that scene only).
 */
export function getSceneExportGlobalFrame(
  project: Project,
  sceneIndex: number,
  timelineFraction: number
): number {
  const t = Math.min(1, Math.max(0, timelineFraction));
  const scenes = project.scenes;
  if (!scenes?.length || sceneIndex < 0 || sceneIndex >= scenes.length) return 0;

  let offset = 0;
  for (let i = 0; i < sceneIndex; i++) {
    offset += framesForScene(scenes[i]!);
  }

  const scene = scenes[sceneIndex]!;
  const durationFrames = framesForScene(scene);
  const local = Math.floor(durationFrames * t);
  const clampedLocal = Math.max(0, Math.min(durationFrames - 1, local));
  return offset + clampedLocal;
}

/**
 * Per-scene target frame (global composition frames), matching VideoPreview / Remotion sequencing:
 * duration = duration_seconds + extra_hold_seconds at playback 1×.
 * Export frame = start + clamp(floor(duration * fraction)) per scene.
 *
 * @param timelineFractions Optional per-scene 0–1 positions; omitted entries fall back to {@link SCENE_EXPORT_TIMELINE_FRACTION}.
 */
export function getSceneExportFrameSchedule(
  project: Project,
  timelineFractions?: number[]
): {
  frame: number;
  title: string;
  order: number;
  safeSlug: string;
}[] {
  if (!project.scenes?.length) return [];
  const fracs = normalizeTimelineFractions(project.scenes.length, timelineFractions);
  let offset = 0;
  return project.scenes.map((s, i) => {
    const durationFrames = framesForScene(s);
    const startFrame = offset;
    offset += durationFrames;
    const local = Math.floor(durationFrames * fracs[i]!);
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
