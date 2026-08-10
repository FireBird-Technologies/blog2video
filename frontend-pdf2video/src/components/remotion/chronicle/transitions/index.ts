import type { TransitionPresentation } from "@remotion/transitions";
import type { ChronicleLayoutType } from "../types";
import { bookPageFlip } from "./bookPageFlip";
import { pageCurl } from "./pageCurl";
import { storyFade } from "./storyFade";
import { inkBleed } from "./inkBleed";

/**
 * Chronicle transition selection.
 *
 * The whole video should feel like leafing through an actual history book.
 * Hero boundaries (book_open out / ending_socials in) always get the
 * cinematic full-page-around-the-spine flip. Every other scene-pair cycles
 * deterministically through five distinct book-themed transitions so
 * consecutive cuts always feel different.
 *
 * Pool entries (in cycle order):
 *   0  bookPageFlip forward   — page rotates around spine, right→left
 *   1  storyFade              — slow sepia-mist fade ("time passed…")
 *   2  pageCurl right→left    — corner-curl flip
 *   3  inkBleed               — radial ink wash from center
 *   4  bookPageFlip backward  — page rotates around spine, left→right
 *
 * Picking is keyed by the OUTGOING scene's index so the same input data
 * always renders the same transitions — reproducible output, and the
 * metadata frame-count + render agree on overlap.
 */

export const HERO_LAYOUTS_FROM = new Set<ChronicleLayoutType>(["book_open"]);
export const HERO_LAYOUTS_TO = new Set<ChronicleLayoutType>(["ending_socials"]);

export interface ChronicleTransitionChoice {
  presentation: TransitionPresentation<Record<string, unknown>>;
  frames: number;
}

const heroChoice = (): ChronicleTransitionChoice => ({
  presentation: bookPageFlip({
    direction: "forward",
  }) as TransitionPresentation<Record<string, unknown>>,
  frames: 44,
});

const POOL: Array<() => ChronicleTransitionChoice> = [
  () => ({
    presentation: bookPageFlip({
      direction: "forward",
    }) as TransitionPresentation<Record<string, unknown>>,
    frames: 40,
  }),
  () => ({
    presentation: storyFade() as TransitionPresentation<
      Record<string, unknown>
    >,
    frames: 38,
  }),
  () => ({
    presentation: pageCurl({
      direction: "right-to-left",
      perspective: 1800,
    }) as TransitionPresentation<Record<string, unknown>>,
    frames: 32,
  }),
  () => ({
    presentation: inkBleed() as TransitionPresentation<
      Record<string, unknown>
    >,
    frames: 30,
  }),
  () => ({
    presentation: bookPageFlip({
      direction: "backward",
    }) as TransitionPresentation<Record<string, unknown>>,
    frames: 40,
  }),
];

export const pickChronicleTransition = (
  fromIdx: number,
  fromLayout: ChronicleLayoutType,
  toLayout: ChronicleLayoutType,
): ChronicleTransitionChoice => {
  if (HERO_LAYOUTS_FROM.has(fromLayout) || HERO_LAYOUTS_TO.has(toLayout)) {
    return heroChoice();
  }
  return POOL[fromIdx % POOL.length]();
};
