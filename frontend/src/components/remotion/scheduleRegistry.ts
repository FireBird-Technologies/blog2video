import type { Project, Scene } from "../../api/client";
import { getSceneDurationFrames } from "./playbackSpeed";
import { normalizeBuiltInTemplateId } from "./templateConfig";
import {
  buildLinearSchedule,
  type CompositionSchedule,
} from "./sceneSchedule";
import { computeChronicleSchedule } from "./chronicle/ChronicleVideoComposition";
import { computeSpotlightSchedule } from "./spotlight/SpotlightVideoComposition";
import { computeMatrixSchedule } from "./matrix/MatrixVideoComposition";
import { computeSakuraSchedule } from "./sakura/SakuraVideoComposition";

const FPS = 30;

/**
 * The minimal per-scene shape every scheduler needs.
 *
 * Deliberately derived from the raw `project` rather than from VideoPreview's
 * richer `scenes` memo: slide export runs outside the preview component and only
 * has the project. The fields below are the ones the timeline math actually reads
 * — layout (transition choice + per-layout minimums), duration, and whether the
 * scene has a voiceover (chronicle trims the last scene only when it does not).
 */
export interface ScheduleSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  voiceoverUrl?: string;
}

/** Scene duration in seconds, matching what the render receives. */
function sceneDurationSeconds(scene: Scene): number {
  return (Number(scene.duration_seconds) || 5) + (Number(scene.extra_hold_seconds) || 0);
}

function toScheduleScenes(project: Project): ScheduleSceneInput[] {
  return (project.scenes ?? []).map((scene, i) => {
    let layout = "";
    let layoutProps: Record<string, unknown> = {};
    if (scene.remotion_code) {
      try {
        const descriptor = JSON.parse(scene.remotion_code) as {
          layout?: string;
          layoutProps?: Record<string, unknown>;
        };
        layout = descriptor.layout || "";
        layoutProps = descriptor.layoutProps || {};
      } catch {
        // Malformed descriptor: fall through to the template's own default,
        // which is what the composition does too.
      }
    }
    return {
      id: scene.id ?? i,
      order: scene.order ?? i + 1,
      title: scene.title ?? "",
      narration: scene.narration_text ?? "",
      layout,
      layoutProps,
      durationSeconds: sceneDurationSeconds(scene),
      // Only presence matters to the timeline math, never the value.
      voiceoverUrl: scene.voiceover_path ? "v" : undefined,
    };
  });
}

type Scheduler = (scenes: ScheduleSceneInput[], project: Project) => CompositionSchedule;

/**
 * Templates whose real timeline differs from a back-to-back sum because they use
 * Remotion's `TransitionSeries` (transitions OVERLAP their neighbours).
 *
 * Deliberately absent:
 * - `generated` (crafted + custom) uses TransitionSeries but pads every non-last
 *   sequence by exactly its own transition length
 *   (`VideoPreview.tsx`: `durationInFrames={frameDurations[i] + t.frames}`), so the
 *   overlap cancels out and the timeline IS the back-to-back sum. Confirmed by
 *   `npx remotion compositions`: GeneratedVideo measured 4884 — identical to the
 *   naive sum. The linear fallback is already correct for it.
 * - `magazine` keeps its dedicated branch in sceneFrameSchedule.ts.
 * - `economist`, `fj_market_brief`, `wealth_your_way` remain on the linear fallback
 *   (unchanged behaviour) and are protected from hard failures by the backend clamp.
 */
const SCHEDULERS: Record<string, Scheduler> = {
  chronicle: (scenes) => computeChronicleSchedule(scenes as never, 1),
  spotlight: (scenes) => computeSpotlightSchedule(scenes as never, 1),
  matrix: (scenes) => computeMatrixSchedule(scenes as never, 1),
  sakura: (scenes) => computeSakuraSchedule(scenes as never),
};

/** Back-to-back sum. Correct only for templates without a TransitionSeries. */
function linearSchedule(scenes: ScheduleSceneInput[]): CompositionSchedule {
  const durations = scenes.map((s) => getSceneDurationFrames(s.durationSeconds, FPS, 1));
  const schedule = buildLinearSchedule(durations);
  return { ...schedule, totalFrames: Math.max(schedule.totalFrames, FPS * 5) };
}

/**
 * The composition's real per-scene timeline.
 *
 * One source of truth for slide export, the export wizard's preview frame, and
 * the Player's declared duration — so those three can never disagree.
 */
export function getCompositionSchedule(project: Project): CompositionSchedule {
  const scenes = toScheduleScenes(project);
  if (!scenes.length) return { scenes: [], totalFrames: FPS * 5 };
  const templateId = normalizeBuiltInTemplateId(project.template);
  const scheduler = SCHEDULERS[templateId];
  return scheduler ? scheduler(scenes, project) : linearSchedule(scenes);
}

/** True when this template's schedule is transition-aware (not the linear fallback). */
export function hasTransitionAwareSchedule(project: Project): boolean {
  return normalizeBuiltInTemplateId(project.template) in SCHEDULERS;
}

/**
 * Schedule for scenes ALREADY derived by VideoPreview.
 *
 * VideoPreview's `scenes` memo carries state the raw project rows do not — pending
 * voiceover recordings applied before save, and voiceover stripped when muted — and
 * chronicle's last-scene trim keys off exactly that. Passing them straight through
 * keeps the Player's declared duration matching what it actually renders.
 */
export function getScheduleForScenes(
  templateId: string,
  scenes: ScheduleSceneInput[],
  project: Project,
): CompositionSchedule {
  if (!scenes.length) return { scenes: [], totalFrames: FPS * 5 };
  const scheduler = SCHEDULERS[normalizeBuiltInTemplateId(templateId)];
  return scheduler ? scheduler(scenes, project) : linearSchedule(scenes);
}
