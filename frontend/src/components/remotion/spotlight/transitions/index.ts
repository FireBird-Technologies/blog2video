import type { TransitionPresentation, TransitionTiming } from "@remotion/transitions";
import { springTiming, linearTiming } from "@remotion/transitions";
import type { SpotlightLayoutType } from "../types";
import {
  slamZoom,
  accentBarWipe,
  kineticPush,
  wordSlam,
  barSplit,
  whipBlur,
} from "./presentations";

/**
 * Spotlight scene-transition selection.
 *
 * Every cut is a bold, kinetic, Spotlight-branded move (slam / wipe / push /
 * split) built on @remotion/transitions custom presentations — no stock
 * cross-dissolves. A pool is cycled by the OUTGOING scene's index so consecutive
 * cuts always differ and the rhythm alternates calm (push) and punchy (slam /
 * bar / split / word). Two hero boundaries get dedicated moves.
 *
 * Keying off the outgoing scene index makes output deterministic: identical
 * input data renders identical transitions, so the metadata frame-count and the
 * render agree on how many frames each transition overlaps (audio stays in sync).
 *
 * The pool is parameterised by canvas size (w, h) so push/wipe travel is correct
 * in both 16:9 and 9:16. The metadata pass only reads `.frames` (size-independent),
 * so passing landscape defaults there is harmless; the render site passes the
 * real useVideoConfig() dimensions.
 */

export const HERO_LAYOUTS_FROM = new Set<SpotlightLayoutType>(["impact_title"]);
export const HERO_LAYOUTS_TO = new Set<SpotlightLayoutType>(["ending_socials"]);

export interface SpotlightTransitionChoice {
  presentation: TransitionPresentation<Record<string, unknown>>;
  timing: TransitionTiming;
  frames: number;
}

const p = (x: unknown) => x as TransitionPresentation<Record<string, unknown>>;

// Stiff spring with no overshoot wobble — for slams. Linear for hard wipes.
const SPRING = (frames: number): TransitionTiming =>
  springTiming({ durationInFrames: frames, config: { damping: 200 }, durationRestThreshold: 0.001 });
const LINEAR = (frames: number): TransitionTiming => linearTiming({ durationInFrames: frames });

// Hero exit (leaving the opener): a big slam zoom.
const heroFromChoice = (): SpotlightTransitionChoice => ({
  presentation: p(slamZoom()),
  timing: SPRING(30),
  frames: 30,
});

// Hero arrival (landing on the closing card): an accent-red bar stamp.
const heroToChoice = (): SpotlightTransitionChoice => ({
  presentation: p(accentBarWipe({ direction: "from-left" })),
  timing: LINEAR(28),
  frames: 28,
});

// Mid-roll pool — alternates calm (kineticPush) and punchy (slam/bar/word/split).
const POOL: Array<(w: number, h: number) => SpotlightTransitionChoice> = [
  // 0  slamZoom — the signature punch
  () => ({ presentation: p(slamZoom()), timing: SPRING(26), frames: 26 }),
  // 1  kineticPush right — calm "next point" momentum
  (w) => ({ presentation: p(kineticPush({ direction: "from-right", distance: w })), timing: SPRING(24), frames: 24 }),
  // 2  accentBarWipe left — branded red hard wipe
  () => ({ presentation: p(accentBarWipe({ direction: "from-left" })), timing: LINEAR(24), frames: 24 }),
  // 3  kineticPush up — calm, varies direction
  (_w, h) => ({ presentation: p(kineticPush({ direction: "from-bottom", distance: h })), timing: SPRING(24), frames: 24 }),
  // 4  barSplit — two red bars meet + part (high-contrast stage reveal)
  () => ({ presentation: p(barSplit()), timing: LINEAR(30), frames: 30 }),
  // 5  kineticPush left — calm, the other way
  (w) => ({ presentation: p(kineticPush({ direction: "from-left", distance: w })), timing: SPRING(24), frames: 24 }),
  // 6  wordSlam — black-out + scale punch
  () => ({ presentation: p(wordSlam()), timing: LINEAR(28), frames: 28 }),
  // 7  whipBlur right — fast motion-blur whip (snappy)
  (w) => ({ presentation: p(whipBlur({ direction: "from-right", distance: w })), timing: SPRING(20), frames: 20 }),
];

export const SPOTLIGHT_TRANSITION_POOL_SIZE = POOL.length;

export const pickSpotlightTransition = (
  fromIdx: number,
  fromLayout: SpotlightLayoutType,
  toLayout: SpotlightLayoutType,
  w = 1920,
  h = 1080,
): SpotlightTransitionChoice => {
  if (HERO_LAYOUTS_TO.has(toLayout)) return heroToChoice();
  if (HERO_LAYOUTS_FROM.has(fromLayout)) return heroFromChoice();
  return POOL[fromIdx % POOL.length](w, h);
};
