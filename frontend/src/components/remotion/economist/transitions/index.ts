import type { TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { iris } from "@remotion/transitions/iris";
import type { EconomistLayoutType } from "../types";
import { ECONOMIST_COLORS } from "../constants";
import { pagePush, whipBlur, inkBar, coverLift } from "./presentations";

/**
 * Economist transition selection.
 *
 * Editorial but kinetic — the moves a motion designer would cut a financial /
 * news explainer with, not a plain cross-dissolve every time. The hero gets a
 * special move: leaving the cover plays a cinematic page-LIFT (the front cover
 * tilts back and turns up, revealing the first spread settling beneath it).
 * Arriving at the closing ending_socials gets a branded ink-bar "stamp". Every
 * other scene-pair cycles deterministically through a pool that alternates a
 * calm move (fade / push) with a punchy one (whip-blur / clock-wipe / ink-bar)
 * so the rhythm has lift without ever feeling busy.
 *
 * Pool (cycle order, keyed by OUTGOING scene index):
 *   0  pagePush(right)  — parallax page-push, the workhorse "next spread"
 *   1  whipBlur(left)   — fast directional motion-blur whip (punch)
 *   2  fade             — clean editorial cross-dissolve (breather)
 *   3  clockWipe        — radial sweep, reads "data / dashboard"
 *   4  pagePush(left)   — page-push the other way (keeps direction varied)
 *   5  inkBar(right)    — branded red bar wipe (accent)
 *   6  iris             — circular spotlight reveal (breather)
 *   7  whipBlur(right)  — whip the other way
 *
 * Picking is keyed by the OUTGOING scene index so identical input always
 * renders identical transitions — reproducible output, and the metadata
 * frame-count + render agree on overlap (audio stays in sync).
 */

export const HERO_LAYOUTS_FROM = new Set<EconomistLayoutType>(["cover_reveal"]);
export const HERO_LAYOUTS_TO = new Set<EconomistLayoutType>(["ending_socials"]);

export interface EconomistTransitionChoice {
  presentation: TransitionPresentation<Record<string, unknown>>;
  frames: number;
}

type P = TransitionPresentation<Record<string, unknown>>;
// TransitionPresentation is invariant in its prop type, so each presentation is
// erased to the shared pool type at the boundary (the composition only reads
// `.presentation` + `.frames`). Mirrors the original `as` casts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cast = (p: TransitionPresentation<any>): P => p as unknown as P;

// Leaving the cover: a cinematic page-lift (the front cover turns up and away).
const coverExitChoice = (): EconomistTransitionChoice => ({
  presentation: cast(coverLift({ color: ECONOMIST_COLORS.accent })),
  frames: 46,
});

// Arriving at the closing scene: a branded ink-bar stamp.
const endingEntryChoice = (): EconomistTransitionChoice => ({
  presentation: cast(inkBar({ direction: "right", color: ECONOMIST_COLORS.accent })),
  frames: 42,
});

/**
 * The pool is parameterised by canvas size so clockWipe/iris centre + radius
 * are correct in both 16:9 and 9:16. The metadata pass only reads `.frames`
 * (which never depend on size), so the landscape defaults are harmless there;
 * the render site passes the real dimensions.
 */
const buildPool = (
  w: number,
  h: number,
): Array<() => EconomistTransitionChoice> => [
  () => ({ presentation: cast(pagePush({ direction: "right", distance: w })), frames: 32 }),
  () => ({ presentation: cast(whipBlur({ direction: "left" })), frames: 20 }),
  () => ({ presentation: cast(fade()), frames: 26 }),
  () => ({ presentation: cast(clockWipe({ width: w, height: h })), frames: 34 }),
  () => ({ presentation: cast(pagePush({ direction: "left", distance: w })), frames: 32 }),
  () => ({ presentation: cast(inkBar({ direction: "right", color: ECONOMIST_COLORS.accent })), frames: 30 }),
  () => ({ presentation: cast(iris({ width: w, height: h })), frames: 32 }),
  () => ({ presentation: cast(whipBlur({ direction: "right" })), frames: 20 }),
];

export const pickEconomistTransition = (
  fromIdx: number,
  fromLayout: EconomistLayoutType,
  toLayout: EconomistLayoutType,
  width = 1920,
  height = 1080,
): EconomistTransitionChoice => {
  if (HERO_LAYOUTS_FROM.has(fromLayout)) {
    return coverExitChoice();
  }
  if (HERO_LAYOUTS_TO.has(toLayout)) {
    return endingEntryChoice();
  }
  const pool = buildPool(width, height);
  return pool[fromIdx % pool.length]();
};
