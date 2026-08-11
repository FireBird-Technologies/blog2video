/**
 * A composition's real per-scene timeline.
 *
 * Templates built on Remotion's `TransitionSeries` do NOT lay their scenes out
 * back to back: every transition OVERLAPS its two neighbours, so the composition
 * is shorter than the sum of the scene durations and each scene after the first
 * starts earlier than a naive sum predicts.
 *
 * Slide export and the export wizard's preview both need to resolve "85% through
 * scene 5" to a global frame. Computing that with a naive sum drifts further with
 * every boundary — on a 15-scene chronicle deck it asked for frame 4829 in a
 * composition that ends at 4556 (hard RangeError on the last slide, and wrong-scene
 * content well before that). This type is the shared shape that lets each template
 * publish the same schedule its own render uses.
 */
export interface SceneScheduleEntry {
  /** Global composition frame where this scene's Sequence begins. */
  start: number;
  /** The scene's own duration in frames (excluding any sequence padding). */
  duration: number;
  /** Frames at the head consumed by the incoming transition. 0 for scene 0. */
  enterFrames: number;
  /**
   * Frames at the tail consumed by the outgoing transition, or by a
   * self-contained closing animation on the final scene.
   */
  exitFrames: number;
}

export interface CompositionSchedule {
  scenes: SceneScheduleEntry[];
  /** The composition's real `durationInFrames` — the authoritative clamp bound. */
  totalFrames: number;
}

/**
 * Resolve a 0–1 position within a scene to a global composition frame.
 *
 * Samples strictly BETWEEN the incoming and outgoing transitions so an exported
 * slide shows the scene itself rather than a half-finished crossfade, and clamps
 * the result into the composition so a caller can never request a frame that does
 * not exist.
 */
export function resolveScheduleFrame(
  schedule: CompositionSchedule,
  sceneIndex: number,
  fraction: number,
): number {
  const entry = schedule.scenes[sceneIndex];
  if (!entry) return 0;

  const safeFraction = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  const lo = entry.enterFrames;
  // `Math.max(lo, …)` keeps this sane when a scene is shorter than its own
  // transitions — the window collapses to a single frame rather than inverting.
  const hi = Math.max(lo, entry.duration - entry.exitFrames - 1);
  const local = Math.floor(lo + (hi - lo) * safeFraction);

  const maxFrame = Math.max(0, schedule.totalFrames - 1);
  return Math.max(0, Math.min(maxFrame, entry.start + local));
}

/**
 * Back-to-back schedule: every scene starts where the previous one ended.
 *
 * Correct ONLY for templates that do not use `TransitionSeries`. Used as the
 * registry fallback so an unmapped template behaves exactly as it does today.
 */
export function buildLinearSchedule(durations: number[]): CompositionSchedule {
  const scenes: SceneScheduleEntry[] = [];
  let start = 0;
  for (const duration of durations) {
    scenes.push({ start, duration, enterFrames: 0, exitFrames: 0 });
    start += duration;
  }
  return { scenes, totalFrames: start };
}
