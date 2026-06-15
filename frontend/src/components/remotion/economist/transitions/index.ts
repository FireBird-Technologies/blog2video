import type { TransitionPresentation } from "@remotion/transitions";
import type { EconomistLayoutType } from "../types";
import { ECONOMIST_COLORS } from "../constants";
import {
  pagePush,
  whipBlur,
  inkBar,
  coverLift,
  pageFold,
  pressRoll,
  halftoneWipe,
} from "./presentations";

/**
 * Economist transition selection.
 *
 * Every move in the pool is print-craft: pages pushed, folded and rolled off
 * the press, ink bars and halftone plates sweeping the cut — no stock
 * cross-dissolves. The hero gets a special move: leaving the cover plays a
 * cinematic page-LIFT (the front cover tilts back and turns up, revealing the
 * first spread settling beneath it). Arriving at the closing ending_socials
 * gets a branded ink-bar "stamp". Every other scene-pair cycles
 * deterministically through a pool that alternates calm moves (push / fold)
 * with punchy ones (press-roll / ink-bar / halftone / whip) so the rhythm has
 * lift without ever feeling busy.
 *
 * Pool (cycle order, keyed by OUTGOING scene index):
 *   0  pagePush(right)    — parallax page-push, the workhorse "next spread"
 *   1  pressRoll          — next page rolls up under the ink-roller cylinder
 *   2  pageFold(forward)  — crisp broadsheet half-page fold (calm, tactile)
 *   3  inkBar(right)      — branded red bar wipe (accent)
 *   4  pagePush(left)     — page-push the other way (keeps direction varied)
 *   5  halftoneWipe(left) — red wipe dissolving into printer's process dots
 *   6  pageFold(backward) — the fold turned back the other way
 *   7  whipBlur(right)    — fast motion-blur whip (punch)
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
 * The pool is parameterised by canvas size so pagePush travel distance is
 * correct in both 16:9 and 9:16. The metadata pass only reads `.frames`
 * (which never depend on size), so the landscape defaults are harmless there;
 * the render site passes the real dimensions.
 */
const buildPool = (
  w: number,
  _h: number,
): Array<() => EconomistTransitionChoice> => [
  () => ({ presentation: cast(pagePush({ direction: "right", distance: w })), frames: 32 }),
  () => ({ presentation: cast(pressRoll()), frames: 28 }),
  () => ({ presentation: cast(pageFold({ direction: "forward" })), frames: 36 }),
  () => ({ presentation: cast(inkBar({ direction: "right", color: ECONOMIST_COLORS.accent })), frames: 30 }),
  () => ({ presentation: cast(pagePush({ direction: "left", distance: w })), frames: 32 }),
  () => ({ presentation: cast(halftoneWipe({ direction: "left", color: ECONOMIST_COLORS.accent })), frames: 30 }),
  () => ({ presentation: cast(pageFold({ direction: "backward" })), frames: 36 }),
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
