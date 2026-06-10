import type { TransitionPresentation } from "@remotion/transitions";
import type { TransitionTiming } from "@remotion/transitions";
import { springTiming, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";

/**
 * Matrix scene-transition pool.
 *
 * Smooth, professional transitions built from Remotion's official presentations
 * (fade / slide / wipe) with gentle spring or linear timing. They flow cleanly
 * from one scene to the next — no glitch, tear, or mosaic effects (those made
 * the cuts feel stuck). Cycled by the OUTGOING scene's index so consecutive
 * cuts still vary (crossfade → push left → reveal → push up → crossfade …),
 * while every one stays soft and continuous.
 *
 * Keying off the index keeps output deterministic — the metadata frame-count
 * and the render agree on how many frames each transition overlaps.
 */

export interface MatrixTransitionChoice {
  presentation: TransitionPresentation<Record<string, unknown>>;
  timing: TransitionTiming;
  frames: number;
}

// Soft spring (no overshoot) for slides/wipes; plain linear for fades.
const SPRING = (frames: number): TransitionTiming =>
  springTiming({ durationInFrames: frames, config: { damping: 200 }, durationRestThreshold: 0.001 });
const LINEAR = (frames: number): TransitionTiming => linearTiming({ durationInFrames: frames });

const p = (x: unknown) => x as TransitionPresentation<Record<string, unknown>>;

const POOL: Array<() => MatrixTransitionChoice> = [
  // Soft crossfade
  () => ({ presentation: p(fade()), timing: LINEAR(20), frames: 20 }),
  // Push in from the right
  () => ({ presentation: p(slide({ direction: "from-right" })), timing: SPRING(24), frames: 24 }),
  // Smooth wipe revealing the new scene from the left
  () => ({ presentation: p(wipe({ direction: "from-left" })), timing: SPRING(26), frames: 26 }),
  // Push up from the bottom
  () => ({ presentation: p(slide({ direction: "from-bottom" })), timing: SPRING(24), frames: 24 }),
  // Soft crossfade (keeps the rhythm calm between heavier scenes)
  () => ({ presentation: p(fade()), timing: LINEAR(20), frames: 20 }),
  // Push in from the left
  () => ({ presentation: p(slide({ direction: "from-left" })), timing: SPRING(24), frames: 24 }),
];

export const pickMatrixTransition = (fromIdx: number): MatrixTransitionChoice =>
  POOL[fromIdx % POOL.length]();

export const MATRIX_TRANSITION_POOL_SIZE = POOL.length;
