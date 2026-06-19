import type { TransitionPresentation } from "@remotion/transitions";
import type { MagazineLayoutType } from "../types";
import {
  glossyPageFlip,
  dramaticPageFlip,
  cornerPeelFlip,
  magazineRiffleOpen,
  magazineRiffleZoom,
  magazineCoverOpen,
  magazineTear,
  realisticCornerFold,
  pageFoldOver,
  pageSlide,
} from "./presentations";

export const HERO_LAYOUTS_FROM = new Set<MagazineLayoutType>(["magazine_cover"]);
export const HERO_LAYOUTS_TO = new Set<MagazineLayoutType>(["ending_socials"]);
const METRIC_LAYOUTS = new Set<MagazineLayoutType>(["by_the_numbers", "magazine_data_visualization"]);
const QUOTE_LAYOUTS = new Set<MagazineLayoutType>(["editorial_quote"]);
// Image-heavy layouts — leaving these uses a page-turn style (reinforcing the
// "turning to the next page" feel), but rotated so consecutive turns differ.
const IMAGE_LAYOUTS = new Set<MagazineLayoutType>([
  "feature_spread",
  "photo_essay",
  "expert_spotlight",
]);

// Transition durations (frames @30fps). Slower + deliberate than before, and
// each distinct so the deck doesn't feel like one repeated speed. The
// composition's EXTRA_HOLD must be >= the largest of these (currently 42) or
// narration gets clipped under the overlap.
const DUR = {
  coverOpen: 42, // the grand opening — slowest
  dramatic: 40, // pull-quote page-turn
  foldOver: 38,
  cornerPeel: 38,
  riffleZoom: 38, // riffle then dive into the page
  cornerFold: 36,
  glossy: 34,
  tear: 32,
  slide: 30,
  riffle: 32,
  ending: 36,
};

export interface MagazineTransitionChoice {
  presentation: TransitionPresentation<Record<string, unknown>>;
  frames: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cast = (p: TransitionPresentation<any>): TransitionPresentation<Record<string, unknown>> =>
  p as unknown as TransitionPresentation<Record<string, unknown>>;

const heroExitChoice = (accentColor?: string): MagazineTransitionChoice => ({
  presentation: cast(magazineCoverOpen({ accentColor })),
  frames: DUR.coverOpen,
});

const endingEntryChoice = (accentColor?: string): MagazineTransitionChoice => ({
  presentation: cast(glossyPageFlip({ direction: "forward", accentColor })),
  frames: DUR.ending,
});

// A deliberately varied pool that leans on the (smooth) page riffle — half the
// boundaries ruffle, alternating the plain riffle and the riffle-then-zoom, and
// interleaved with other distinct page motions so it never feels repetitive.
const buildPool = (
  _w: number,
  accentColor?: string,
): Array<() => MagazineTransitionChoice> => [
  () => ({ presentation: cast(magazineRiffleOpen({ accentColor })), frames: DUR.riffle }),
  () => ({ presentation: cast(glossyPageFlip({ direction: "forward", accentColor })), frames: DUR.glossy }),
  () => ({ presentation: cast(magazineRiffleZoom({ accentColor })), frames: DUR.riffleZoom }),
  () => ({ presentation: cast(cornerPeelFlip({ accentColor })), frames: DUR.cornerPeel }),
  () => ({ presentation: cast(magazineRiffleOpen({ accentColor })), frames: DUR.riffle }),
  () => ({ presentation: cast(pageFoldOver()), frames: DUR.foldOver }),
  () => ({ presentation: cast(magazineRiffleZoom({ accentColor })), frames: DUR.riffleZoom }),
  () => ({ presentation: cast(realisticCornerFold({ accentColor })), frames: DUR.cornerFold }),
];

// Styles cycled when leaving an image-heavy scene — a page-turn or a riffle-zoom
// (dive into the next page), rotated so those turns vary instead of repeating.
const imageExitPool = (
  accentColor?: string,
): Array<() => MagazineTransitionChoice> => [
  () => ({ presentation: cast(magazineRiffleZoom({ accentColor })), frames: DUR.riffleZoom }),
  () => ({ presentation: cast(glossyPageFlip({ direction: "forward", accentColor })), frames: DUR.glossy }),
  () => ({ presentation: cast(pageFoldOver()), frames: DUR.foldOver }),
];

export const pickMagazineTransition = (
  fromIdx: number,
  fromLayout: MagazineLayoutType,
  toLayout: MagazineLayoutType,
  width = 1920,
  accentColor?: string,
): MagazineTransitionChoice => {
  if (HERO_LAYOUTS_FROM.has(fromLayout)) {
    return heroExitChoice(accentColor);
  }
  if (HERO_LAYOUTS_TO.has(toLayout)) {
    return endingEntryChoice(accentColor);
  }
  // Into or out of a pull-quote scene — slow, dramatic 3D page flip with
  // cubic easing so the turn is clearly visible (not a quint blur).
  if (QUOTE_LAYOUTS.has(toLayout) || QUOTE_LAYOUTS.has(fromLayout)) {
    return { presentation: cast(dramaticPageFlip({ accentColor })), frames: DUR.dramatic };
  }
  // Going INTO a metric/data page → a sweeping corner fold (3D page motion).
  if (METRIC_LAYOUTS.has(toLayout)) {
    return { presentation: cast(realisticCornerFold({ accentColor })), frames: DUR.cornerFold };
  }
  // After an image-heavy scene, turn the page forward — but rotate the style.
  if (IMAGE_LAYOUTS.has(fromLayout)) {
    const pool = imageExitPool(accentColor);
    return pool[fromIdx % pool.length]();
  }
  const pool = buildPool(width, accentColor);
  return pool[fromIdx % pool.length]();
};
