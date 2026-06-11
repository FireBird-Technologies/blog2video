import type { TransitionPresentation, TransitionTiming } from "@remotion/transitions";
import { springTiming, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import type { MatrixLayoutType } from "../types";
import { rainWall, decodeWipe, neonWhip, derez } from "./presentations";

/**
 * Matrix scene-transition selection.
 *
 * Every cut is a Matrix-branded move (rain wall / decode scanline / neon whip /
 * de-rez) built on custom @remotion/transitions presentations, with a couple of
 * soft stock moves kept in the rotation for rhythm. Unlike the old reverted
 * glitch pool, every presentation keeps BOTH scenes moving for the whole overlap
 * — nothing holds a static frame, so cuts never feel stuck.
 *
 * A pool is cycled by the OUTGOING scene's index so consecutive cuts always
 * differ. Two hero boundaries get dedicated moves. Keying off the outgoing scene
 * index keeps output deterministic: the metadata frame-count and the render
 * agree on how many frames each transition overlaps (audio stays in sync).
 *
 * The pool is parameterised by canvas size (w, h) so whip travel is correct in
 * both 16:9 and 9:16. The metadata pass only reads `.frames` (size-independent),
 * so passing landscape defaults there is harmless; the render site passes the
 * real useVideoConfig() dimensions.
 */

export const HERO_LAYOUTS_FROM = new Set<MatrixLayoutType>(["matrix_title"]);
export const HERO_LAYOUTS_TO = new Set<MatrixLayoutType>(["awakening", "ending_socials"]);

export interface MatrixTransitionChoice {
  presentation: TransitionPresentation<Record<string, unknown>>;
  timing: TransitionTiming;
  frames: number;
}

const p = (x: unknown) => x as TransitionPresentation<Record<string, unknown>>;

// Soft spring (no overshoot) for slides/whips; linear for wipes and fades.
const SPRING = (frames: number): TransitionTiming =>
  springTiming({ durationInFrames: frames, config: { damping: 200 }, durationRestThreshold: 0.001 });
const LINEAR = (frames: number): TransitionTiming => linearTiming({ durationInFrames: frames });

// Hero exit (leaving the decode opener): the signature rain wall.
const heroFromChoice = (): MatrixTransitionChoice => ({
  presentation: p(rainWall({ direction: "from-left" })),
  timing: LINEAR(32),
  frames: 32,
});

// Hero arrival (landing on the closer / socials): a clean decode scanline.
const heroToChoice = (): MatrixTransitionChoice => ({
  presentation: p(decodeWipe()),
  timing: LINEAR(30),
  frames: 30,
});

// Mid-roll pool — alternates punchy (rainWall/decodeWipe/derez/whip) and calm
// (slide/fade) so the rhythm has lift without exhausting the viewer.
const POOL: Array<(w: number, h: number) => MatrixTransitionChoice> = [
  // 0  rainWall left — the signature code sweep
  () => ({ presentation: p(rainWall({ direction: "from-left" })), timing: LINEAR(28), frames: 28 }),
  // 1  neonWhip right — fast phosphor whip
  (w) => ({ presentation: p(neonWhip({ direction: "from-right", distance: w })), timing: SPRING(22), frames: 22 }),
  // 2  decodeWipe — scanline decodes the next scene
  () => ({ presentation: p(decodeWipe()), timing: LINEAR(26), frames: 26 }),
  // 3  slide up — calm "next point" momentum
  () => ({ presentation: p(slide({ direction: "from-bottom" })), timing: SPRING(24), frames: 24 }),
  // 4  derez — outgoing slices apart and recedes
  () => ({ presentation: p(derez()), timing: LINEAR(26), frames: 26 }),
  // 5  neonWhip left — the other way
  (w) => ({ presentation: p(neonWhip({ direction: "from-left", distance: w })), timing: SPRING(22), frames: 22 }),
  // 6  rainWall right — code sweep, mirrored
  () => ({ presentation: p(rainWall({ direction: "from-right" })), timing: LINEAR(28), frames: 28 }),
  // 7  soft crossfade — one calm beat per cycle
  () => ({ presentation: p(fade()), timing: LINEAR(18), frames: 18 }),
];

export const MATRIX_TRANSITION_POOL_SIZE = POOL.length;

export const pickMatrixTransition = (
  fromIdx: number,
  fromLayout?: MatrixLayoutType,
  toLayout?: MatrixLayoutType,
  w = 1920,
  h = 1080,
): MatrixTransitionChoice => {
  if (toLayout && HERO_LAYOUTS_TO.has(toLayout)) return heroToChoice();
  if (fromLayout && HERO_LAYOUTS_FROM.has(fromLayout)) return heroFromChoice();
  return POOL[fromIdx % POOL.length](w, h);
};
