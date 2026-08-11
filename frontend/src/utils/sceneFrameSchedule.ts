import type { Project, Scene } from "../api/client";
import { getSceneDurationFrames } from "../components/remotion/playbackSpeed";
import {
  planMagazineBoundaries,
  resolveMagazineLayout,
} from "../components/remotion/magazine/MagazineVideoComposition";
import type { MagazineTransitionName } from "../components/remotion/magazine/types";
import {
  getTemplateConfig,
  normalizeBuiltInTemplateId,
} from "../components/remotion/templateConfig";
import {
  getCompositionSchedule,
  hasTransitionAwareSchedule,
} from "../components/remotion/scheduleRegistry";
import { resolveScheduleFrame } from "../components/remotion/sceneSchedule";

const FPS = 30;

/**
 * Closing animations a magazine layout plays on its OWN, independent of any
 * TransitionSeries boundary. Only the final scene needs these: every other scene's
 * tail is already covered by its boundary `exitFrames`.
 *
 * `ending_socials` floats its back cover away and fades it to opacity 0 over its
 * last `CLOSE` frames (see EndingSocials.tsx — keep this in sync with that
 * constant), so a frame sampled inside that window exports as a near-black page.
 */
const MAGAZINE_CLOSING_TAIL_FRAMES: Partial<Record<string, number>> = {
  ending_socials: 130,
};

/** Where within each scene to sample (0–1). 0.5 looked too early; ~0.85 matches full layout + imagery. */
export const SCENE_EXPORT_TIMELINE_FRACTION = 0.85;

/** Zero-padded, filesystem-safe slide name: `03_Scene_Title`. */
function buildSafeSlug(title: string, index: number): string {
  const cleaned = title
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return `${String(index + 1).padStart(2, "0")}_${cleaned || "scene"}`;
}

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
 *
 * Delegates to {@link getSceneExportFrameSchedule} so the frame the wizard PREVIEWS
 * is byte-for-byte the frame the capture EXPORTS. These were previously two
 * independent calculations, and the magazine template desynced them: the schedule
 * accounts for TransitionSeries overlap (scene starts are not a plain sum of
 * durations, and the sampled point is pulled out of the 3D exit) while this
 * function summed raw durations. Scene 1 previewed frame 178 but exported 152, and
 * the drift grew by ~6 frames per scene down the deck.
 */
export function getSceneExportGlobalFrame(
  project: Project,
  sceneIndex: number,
  timelineFraction: number
): number {
  const scenes = project.scenes;
  if (!scenes?.length || sceneIndex < 0 || sceneIndex >= scenes.length) return 0;

  // Only this scene's fraction matters; the rest fall back to the default and do
  // not influence the returned frame.
  const fractions = scenes.map((_, i) =>
    i === sceneIndex ? timelineFraction : SCENE_EXPORT_TIMELINE_FRACTION
  );
  return getSceneExportFrameSchedule(project, fractions)[sceneIndex]?.frame ?? 0;
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

  // Templates whose composition publishes a transition-aware schedule resolve the
  // fraction against the REAL timeline. In a TransitionSeries each transition
  // overlaps its neighbours, so a naive running sum drifts further with every
  // boundary — on a 15-scene chronicle deck it asked for frame 4829 in a
  // composition ending at 4556 (RangeError on the last slide, wrong-scene content
  // well before that).
  if (hasTransitionAwareSchedule(project)) {
    const schedule = getCompositionSchedule(project);
    return project.scenes.map((scene, i) => ({
      frame: resolveScheduleFrame(schedule, i, fracs[i]!),
      title: scene.title || `Scene ${i + 1}`,
      order: i + 1,
      safeSlug: buildSafeSlug(scene.title || `Scene ${i + 1}`, i),
    }));
  }

  // Magazine uses a TransitionSeries with scene→black→scene boundaries. Its
  // scene starts therefore do not equal a simple sum of durations, and sampling
  // 85% of the raw duration can land in the 3D exit (a cover seen edge-on as a
  // thin line). Map the requested fraction into each scene's transition-free
  // body and use the composition's own boundary planner for global frame offsets.
  if (normalizeBuiltInTemplateId(project.template) === "magazine") {
    const config = getTemplateConfig(project.template);
    const durations = project.scenes.map(framesForScene);
    const descriptors = project.scenes.map((scene) => {
      let layout = scene.order === 1 ? config.heroLayout : config.fallbackLayout;
      let layoutProps: Record<string, unknown> = {};
      if (scene.remotion_code) {
        try {
          const descriptor = JSON.parse(scene.remotion_code) as {
            layout?: string;
            layoutProps?: Record<string, unknown>;
          };
          layout = descriptor.layout || config.fallbackLayout;
          layoutProps = descriptor.layoutProps || {};
        } catch {
          // Keep the same template defaults used by VideoPreview.
        }
      }
      return { layout: resolveMagazineLayout(layout), layoutProps };
    });
    const { boundaries, startFrames } = planMagazineBoundaries(
      descriptors.map((d) => d.layout),
      durations,
      project.accent_color || "#D71921",
      descriptors.map(
        (d) => d.layoutProps.enterTransition as MagazineTransitionName | undefined,
      ),
      descriptors.map(
        (d) => d.layoutProps.exitTransition as MagazineTransitionName | undefined,
      ),
    );

    return project.scenes.map((scene, i) => {
      const stableStart = i > 0 ? boundaries[i - 1]!.enterFrames : 0;
      // The tail to keep clear. Mid-deck that is the boundary's exit transition.
      // The LAST scene has no boundary, so its tail is instead whatever
      // self-contained closing animation its layout plays — ending_socials floats
      // the back cover away over its final CLOSE frames and fades it to opacity 0,
      // so sampling 85% of the raw duration lands inside that fade and exports a
      // near-black frame with the scene ghosted behind it.
      const tailFrames =
        boundaries[i]?.exitFrames ??
        MAGAZINE_CLOSING_TAIL_FRAMES[descriptors[i]!.layout] ??
        0;
      const stableEnd = Math.max(
        stableStart,
        durations[i]! - tailFrames - 1,
      );
      const local = Math.floor(
        stableStart + (stableEnd - stableStart) * fracs[i]!,
      );
      const title = scene.title || `Scene ${i + 1}`;
      const safeSlug = `${String(i + 1).padStart(2, "0")}_${title
        .replace(/[^a-z0-9]+/gi, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 40) || "scene"}`;
      return {
        frame: startFrames[i]! + local,
        title,
        order: i + 1,
        safeSlug,
      };
    });
  }

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
