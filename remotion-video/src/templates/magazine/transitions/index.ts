import type { TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import type { MagazineLayoutType } from "../types";
import {
  zoomBlurDive,
  quoteDropReveal,
  slideDownReveal,
  singlePageTurnZoom,
  maskingZoom,
} from "./presentations";

export const HERO_LAYOUTS_FROM = new Set<MagazineLayoutType>(["magazine_cover"]);
export const HERO_LAYOUTS_TO = new Set<MagazineLayoutType>(["ending_socials"]);

// Data scenes (charts / stats / table). Any boundary touching one plays the
// zoom-blur dive: the outgoing page zooms in + softly blurs, then the incoming
// page zooms out of the blur, tilts on its paper plane and aligns flat. Used on
// both sides, so a data page resolves crisp-and-flat when it arrives and dives
// away when it leaves.
const DATA_LAYOUTS = new Set<MagazineLayoutType>([
  "magazine_data_visualization",
  "by_the_numbers",
  "magazine_ticker",
]);

// Calm 2D transitions only. The scenes already carry a subtle cinematic camera
// entrance; running a 3D page-flip on top of it made two 3D transforms fight on
// the overlapping frames (the old "jerky" turns). A cross-fade / clean slide
// reads smooth and never competes with the camera.
const DUR = {
  fade: 49,
  slide: 51,
  zoomBlur: 122, // slow zoom-in-blur out → zoom-out-blur in, around data scenes
  quoteDrop: 80, // glyph enlarges + swipes down, next scene drops in, LEAVING the pull-quote
  slideDown: 60, // next scene slides straight down from the top, LEAVING the by-the-numbers page
  pageTurn: 100, // single full page-turn → zoom-in, leaving the expert spotlight
  masking: 100, // zoom into the feature drop-cap, then teasingly zoom back out
};

export interface MagazineTransitionChoice {
  presentation: TransitionPresentation<Record<string, unknown>>;
  frames: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cast = (p: TransitionPresentation<any>): TransitionPresentation<Record<string, unknown>> =>
  p as unknown as TransitionPresentation<Record<string, unknown>>;

const fadeChoice = (): MagazineTransitionChoice => ({
  presentation: cast(fade()),
  frames: DUR.fade,
});

// A light, varied pool: mostly cross-fades with the occasional gentle slide so
// the deck doesn't feel like one repeated motion.
const POOL: Array<() => MagazineTransitionChoice> = [
  fadeChoice,
  () => ({ presentation: cast(slide({ direction: "from-right" })), frames: DUR.slide }),
  fadeChoice,
  () => ({ presentation: cast(slide({ direction: "from-left" })), frames: DUR.slide }),
];

export const pickMagazineTransition = (
  fromIdx: number,
  fromLayout: MagazineLayoutType,
  toLayout: MagazineLayoutType,
  _width = 1920,
  accentColor?: string,
): MagazineTransitionChoice => {
  // The grand opening (off the cover) and the entry into the ending card both
  // settle best as a clean fade — no competing motion with the hero camera.
  if (HERO_LAYOUTS_FROM.has(fromLayout) || HERO_LAYOUTS_TO.has(toLayout)) {
    return fadeChoice();
  }
  // Leaving a feature spread → masking zoom: push into the red drop-cap initial,
  // then teasingly zoom back out to reveal the next scene.
  if (fromLayout === "feature_spread") {
    return { presentation: cast(maskingZoom({ accentColor })), frames: DUR.masking };
  }
  // Leaving the by-the-numbers / timeline / interview pages: the next scene is
  // revealed by sliding straight down from the top, covering the outgoing page as
  // it descends. Checked before the data-scene dive below so this exit wins.
  if (
    fromLayout === "by_the_numbers" ||
    fromLayout === "timeline_journey" ||
    fromLayout === "interview_qa"
  ) {
    return { presentation: cast(slideDownReveal()), frames: DUR.slideDown };
  }
  // Any boundary touching a data scene → zoom-blur dive. Entering one, the data
  // page zooms out of the blur and aligns flat; leaving one, it zooms in + blurs
  // away onto the next page.
  if (DATA_LAYOUTS.has(fromLayout) || DATA_LAYOUTS.has(toLayout)) {
    return { presentation: cast(zoomBlurDive({ accentColor })), frames: DUR.zoomBlur };
  }
  // Leaving the expert spotlight: one full page physically turns over (watched
  // end-to-end), then the next scene zooms in from inside the frame and fades up.
  if (fromLayout === "expert_spotlight") {
    return { presentation: cast(singlePageTurnZoom({ accentColor })), frames: DUR.pageTurn };
  }
  // Leaving the editorial pull-quote: the oversized quotation mark enlarges and
  // swipes down off the page, then the next scene slides in from the top.
  if (fromLayout === "editorial_quote") {
    return { presentation: cast(quoteDropReveal({ accentColor })), frames: DUR.quoteDrop };
  }
  // Entering the editorial pull-quote: the next scene slides straight down from the
  // top (pure-transform reveal). The old accent-band wipe animated clip-path + scale
  // together on this heavy preserve-3d page, which saturated Chrome's shared
  // compositor and glitched the whole frontend — see [[magazine-preview-paint-cost]].
  if (toLayout === "editorial_quote") {
    return { presentation: cast(slideDownReveal()), frames: DUR.slideDown };
  }
  return POOL[fromIdx % POOL.length]();
};
