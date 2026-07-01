import type { TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type { MagazineLayoutType, MagazineTransitionName } from "../types";
import {
  zoomBlurDive,
  slideDownReveal,
  magazineRiffleOpen,
  singlePageTurn,
  pageSettle,
  liftAway,
  pageSlide,
  gatefoldUnfold,
  contactSheetZoom,
  dieCutReveal,
  diagonalCut,
  centerDoors,
  breakFromBehind,
  windowOpen,
  pressPrint,
  pageStackDrop,
  pageSweep,
  tickerTapeCrawl,
  alternatingQuoteSwing,
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

// Page-motion family. The deck now leans into tactile magazine moves — a single
// sheet that turns about the spine, a clean horizontal page slide, a settle-into-
// view and a lift-away reveal. These are all built paint-safe (baked gradients,
// no animated box-shadow / blur, the transition owns the frame), so they read as
// real page turns without re-introducing the old jerky 3D playback that fought
// the per-scene cinematic camera ([[magazine-preview-paint-cost]]). The composition
// holds each scene for exactly its own outgoing transition (this `frames` value), so
// the page-turn overlaps the hold rather than the narration and the next voiceover
// starts the instant the current one ends — no fixed max-length pad, no dead air.
const DUR = {
  fade: 49,
  zoomBlur: 122, // slow zoom-in-blur out → zoom-out-blur in, around data scenes
  slideDown: 60, // next scene slides straight down from the top, LEAVING the by-the-numbers page
  slideDownFast: 46, // snappier slide-down used leaving the interview Q/A page
  riffle: 58, // magazine pages riffle past, revealing the next scene (ticker entrance)
  singleTurn: 64, // one sheet hinged at the spine swings open (the hero page turn)
  gatefold: 60, // spread splits at the spine; both halves swing open (the gatefold unfold)
  bento: 104, // scene zooms out to a 3×3 contact sheet, then dives into the next cell
  dieCut: 58, // a circular die-cut hole opens and grows to reveal the next page
  diagonal: 56, // a hard diagonal edge sweeps the next page in, LEAVING by-the-numbers
  press: 62, // printing-press roller sweeps down, "printing" the next page, LEAVING the ticker
  settle: 42, // next page eases in + settles flat ("scene comes into view")
  lift: 56, // old page lifts off to reveal the next underneath
  pageSlide: 40, // clean horizontal push — new page slides in, pushing the old off (fast, no bg gap)
  centerDoors: 58, // outgoing splits at the spine; halves slide apart, new revealed behind
  breakBehind: 60, // outgoing breaks into panels that fly off, new revealed behind
  windowOpen: 56, // new revealed through a growing rectangular window (rect die-cut)
  stack: 84, // a magazine stack drops in, settles, then the top page opens full-bleed
  sweep: 44, // fast, gap-free directional page sweep (incoming slides over, no dark bg)
  tickerTape: 64, // a ticker-tape print carriage crawls L→R, printing the ledger in
  quoteSwing: 76, // the spread's two leaves swing in flat, staggered (call-and-response)
};

export interface MagazineTransitionChoice {
  presentation: TransitionPresentation<Record<string, unknown>>;
  frames: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cast = (p: TransitionPresentation<any>): TransitionPresentation<Record<string, unknown>> =>
  p as unknown as TransitionPresentation<Record<string, unknown>>;

// Generic boundaries cycle through the page-motion family so every plain scene
// change reads as a tactile magazine move and never repeats the same gesture
// back-to-back: page turn (forward hinge) → horizontal slide → settle-into-view →
// page turn (back hinge) → lift-away.
const POOL: Array<(accentColor?: string) => MagazineTransitionChoice> = [
  (accentColor) => ({ presentation: cast(singlePageTurn({ direction: "forward", accentColor })), frames: DUR.singleTurn }),
  () => ({ presentation: cast(pageSlide()), frames: DUR.pageSlide }),
  () => ({ presentation: cast(pageSettle()), frames: DUR.settle }),
  (accentColor) => ({ presentation: cast(singlePageTurn({ direction: "back", accentColor })), frames: DUR.singleTurn }),
  () => ({ presentation: cast(liftAway()), frames: DUR.lift }),
];

// Named transition registry — maps a stable string name (MagazineTransitionName)
// to its presentation + duration. This is what the per-scene `enterTransition` /
// `exitTransition` overrides and the ENTER_BY_LAYOUT / EXIT_BY_LAYOUT maps below
// reference, so a transition can be pinned to a specific scene deterministically
// (independent of the scene's order in the deck — not the POOL cycling).
const TRANSITION_REGISTRY: Record<
  MagazineTransitionName,
  (accentColor?: string) => MagazineTransitionChoice
> = {
  center_doors: (a) => ({ presentation: cast(centerDoors({ accentColor: a })), frames: DUR.centerDoors }),
  break_behind: (a) => ({ presentation: cast(breakFromBehind({ accentColor: a })), frames: DUR.breakBehind }),
  break_split: (a) => ({ presentation: cast(breakFromBehind({ accentColor: a, pieces: 2 })), frames: DUR.breakBehind }),
  window_open: (a) => ({ presentation: cast(windowOpen({ accentColor: a })), frames: DUR.windowOpen }),
  page_turn: (a) => ({ presentation: cast(singlePageTurn({ direction: "forward", accentColor: a })), frames: DUR.singleTurn }),
  page_turn_back: (a) => ({ presentation: cast(singlePageTurn({ direction: "back", accentColor: a })), frames: DUR.singleTurn }),
  page_turn_up: (a) => ({ presentation: cast(singlePageTurn({ direction: "up", accentColor: a })), frames: DUR.singleTurn }),
  page_slide: () => ({ presentation: cast(pageSlide()), frames: DUR.pageSlide }),
  slide_down: () => ({ presentation: cast(slideDownReveal()), frames: DUR.slideDown }),
  die_cut: (a) => ({ presentation: cast(dieCutReveal({ accentColor: a })), frames: DUR.dieCut }),
  gatefold: (a) => ({ presentation: cast(gatefoldUnfold({ accentColor: a })), frames: DUR.gatefold }),
  bento: (a) => ({ presentation: cast(contactSheetZoom({ accentColor: a })), frames: DUR.bento }),
  zoom_blur: (a) => ({ presentation: cast(zoomBlurDive({ accentColor: a })), frames: DUR.zoomBlur }),
  riffle: (a) => ({ presentation: cast(magazineRiffleOpen({ accentColor: a })), frames: DUR.riffle }),
  settle: () => ({ presentation: cast(pageSettle()), frames: DUR.settle }),
  lift: () => ({ presentation: cast(liftAway()), frames: DUR.lift }),
  diagonal: (a) => ({ presentation: cast(diagonalCut({ accentColor: a })), frames: DUR.diagonal }),
  press: (a) => ({ presentation: cast(pressPrint({ accentColor: a })), frames: DUR.press }),
  stack: (a) => ({ presentation: cast(pageStackDrop({ accentColor: a })), frames: DUR.stack }),
  sweep_up: (a) => ({ presentation: cast(pageSweep({ direction: "up", accentColor: a })), frames: DUR.sweep }),
  sweep_left: (a) => ({ presentation: cast(pageSweep({ direction: "left", accentColor: a })), frames: DUR.sweep }),
  sweep_tl: (a) => ({ presentation: cast(pageSweep({ direction: "tl", accentColor: a })), frames: DUR.sweep }),
  sweep_br: (a) => ({ presentation: cast(pageSweep({ direction: "br", accentColor: a })), frames: DUR.sweep }),
  ticker_tape: (a) => ({ presentation: cast(tickerTapeCrawl({ accentColor: a })), frames: DUR.tickerTape }),
  quote_swing: (a) => ({ presentation: cast(alternatingQuoteSwing({ accentColor: a })), frames: DUR.quoteSwing }),
  fade: () => ({ presentation: cast(fade()), frames: DUR.fade }),
};

// Deterministic per-scene assignment, keyed by layout type (each scene is a layout
// type here). "When a scene of this layout STARTS, always enter with X" /
// "…when it ENDS, always exit with X" — applied regardless of the scene's position
// in the deck, so the gesture follows the scene, not the slot. One-line editable;
// a per-scene `enterTransition` / `exitTransition` in layoutProps overrides these.
// Every layout gets its OWN signature entrance so each new scene appears in a
// visibly different way. The moves are chosen so the page being revealed is always
// static or only translated (never scaled / 3D-swung when it's a heavy page), so
// they stay smooth. magazine_cover is intentionally omitted — it's scene 1 (no
// entrance); if it ever enters mid-deck it falls through to the POOL.
const ENTER_BY_LAYOUT: Partial<Record<MagazineLayoutType, MagazineTransitionName>> = {
  magazine_cover: "page_turn",
  editorial_quote: "zoom_blur",
  by_the_numbers: "page_turn_back",
  interview_qa: "quote_swing",
  timeline_journey: "page_turn_up",
  text_narration: "lift",
  ending_socials: "page_slide",
  magazine_ticker: "die_cut",
  colorblock: "gatefold",
  feature: "sweep_br",
  comparison: "die_cut",
  magazine_data_visualization: "slide_down",
};
// Per-layout EXIT-to-black gesture, mirroring the ENTER map: "when a scene of this
// layout ENDS, clear it to the black bridge with X". These run scene→black (only the
// real page is heavy — the bridge is a solid fill), so even a 3D swing here is cheap.
// Chosen to read as the magazine page leaving (turn/lift/slide), distinct from its
// neighbour's entrance. A per-scene `exitTransition` in layoutProps overrides this.
const EXIT_BY_LAYOUT: Partial<Record<MagazineLayoutType, MagazineTransitionName>> = {
  magazine_cover: "page_turn",
  editorial_quote: "page_turn",
  by_the_numbers: "riffle",
  interview_qa: "slide_down",
  timeline_journey: "page_turn",
  text_narration: "page_turn_up",
  ending_socials: "page_slide", // last scene has no exit; harmless default
  magazine_ticker: "riffle",
  colorblock: "center_doors",
  feature: "lift",
  comparison: "page_turn_up",
  magazine_data_visualization: "zoom_blur",
};

// Neutral exit when a layout has no signature exit-to-black (keeps the page clearing
// cleanly to the black bridge rather than hard-cutting).
const DEFAULT_EXIT: MagazineTransitionName = "lift";

// Global slow-motion factor for the black-bridged enter/exit transitions. >1 = slower
// (every page-move stretches by this factor); 1 = original speed. Applied in the two
// resolver helpers below so it scales every transition from one dial — the composition
// clamps it to half the adjacent scene, so short scenes degrade gracefully. Keep the
// frontend and remotion-video copies of this value equal ([[magazine-dual-tree-and-camera]]).
const TRANSITION_SPEED = 1.25;
const slow = (c: MagazineTransitionChoice): MagazineTransitionChoice => ({
  ...c,
  frames: Math.round(c.frames * TRANSITION_SPEED),
});

/**
 * Resolve the ENTER half of a boundary for the black-bridged TransitionSeries: the
 * entering scene flies in from solid black with its layout's signature 3D move.
 * Precedence: per-scene `enterTransition` override → ENTER_BY_LAYOUT[toLayout] →
 * page_turn (the lone unsignatured layout, magazine_cover).
 */
export const pickEnterTransition = (
  toLayout: MagazineLayoutType,
  accentColor?: string,
  toEnter?: MagazineTransitionName,
): MagazineTransitionChoice => {
  if (toEnter) return slow(TRANSITION_REGISTRY[toEnter](accentColor));
  const sig = ENTER_BY_LAYOUT[toLayout];
  return slow(TRANSITION_REGISTRY[sig ?? "page_turn"](accentColor));
};

/**
 * Resolve the EXIT half of a boundary: the leaving scene clears to solid black with
 * its layout's signature exit-to-black move. Precedence: per-scene `exitTransition`
 * override → EXIT_BY_LAYOUT[fromLayout] → DEFAULT_EXIT.
 */
export const pickExitTransition = (
  fromLayout: MagazineLayoutType,
  accentColor?: string,
  fromExit?: MagazineTransitionName,
): MagazineTransitionChoice => {
  if (fromExit) return slow(TRANSITION_REGISTRY[fromExit](accentColor));
  const sig = EXIT_BY_LAYOUT[fromLayout];
  return slow(TRANSITION_REGISTRY[sig ?? DEFAULT_EXIT](accentColor));
};

export const pickMagazineTransition = (
  fromIdx: number,
  fromLayout: MagazineLayoutType,
  toLayout: MagazineLayoutType,
  _width = 1920,
  accentColor?: string,
  toEnter?: MagazineTransitionName,
  fromExit?: MagazineTransitionName,
): MagazineTransitionChoice => {
  // 1. Explicit per-scene overrides always win (the entering scene's
  //    `enterTransition` beats the leaving scene's `exitTransition`).
  if (toEnter) return TRANSITION_REGISTRY[toEnter](accentColor);
  if (fromExit) return TRANSITION_REGISTRY[fromExit](accentColor);
  // 1b. Opening: the cover holds, then turns like a real magazine front cover to
  //     reveal the first scene. page_turn is reserved for this one boundary, so it
  //     stays unique — no content scene uses it.
  if (HERO_LAYOUTS_FROM.has(fromLayout)) return TRANSITION_REGISTRY.page_turn(accentColor);
  // 2. Otherwise every layout maps to exactly ONE unique signature entrance — a flat
  //    deterministic lookup with NO predecessor / precedence / substitution, so each
  //    scene always enters in its own distinct way and no gesture is reused. Every
  //    layout is mapped, so no branch below this ever executes (kept only as a
  //    safety fallback for a brand-new, unmapped layout).
  const sig = ENTER_BY_LAYOUT[toLayout];
  if (sig) return TRANSITION_REGISTRY[sig](accentColor);
  // 3. Iconic cover page turn — fallback only for the one layout without a signature
  //    (magazine_cover); reached when an unsignatured scene leaves the cover/hero.
  if (HERO_LAYOUTS_FROM.has(fromLayout)) {
    return { presentation: cast(singlePageTurn({ direction: "forward", accentColor })), frames: DUR.singleTurn };
  }
  const exitAssigned = EXIT_BY_LAYOUT[fromLayout];
  if (exitAssigned) {
    return TRANSITION_REGISTRY[exitAssigned](accentColor);
  }
  // (feature → comparison deliberately has NO bento here: the feature spread runs a
  // continuous preserve-3d camera its whole duration, and scaling that heavy 3D page
  // inside the contact sheet re-rasterizes it every frame and jitters badly
  // ([[magazine-preview-paint-cost]]). It falls through to the generic feature riffle
  // below; the bento plays entering `comparison` only from lighter pages — see the
  // `toLayout === "comparison"` rule further down.)
  // Leaving the feature spread INTO the timeline → the spread unfolds as a gatefold:
  // it splits at the centre spine and both halves swing open like double doors,
  // revealing the timeline beneath. Placed above the generic feature-riffle exit so
  // this specific boundary wins.
  if (fromLayout === "feature" && toLayout === "timeline_journey") {
    return { presentation: cast(gatefoldUnfold({ accentColor })), frames: DUR.gatefold };
  }
  // Leaving the feature spread → riffle the magazine pages forward into the next
  // scene. Guarded so that entering a self-revealing scene (colorblock/feature)
  // still falls through to the instant cut below.
  if (fromLayout === "feature" && toLayout !== "colorblock" && toLayout !== "feature") {
    return { presentation: cast(magazineRiffleOpen({ accentColor })), frames: DUR.riffle };
  }
  // Leaving the ticker page INTO the colorblock spread → a circular die-cut hole
  // opens at centre and grows, the colorblock showing through the punched hole
  // (real magazines punch die-cut holes through to the page beneath). Placed above
  // the generic ticker-riffle exit and the colorblock instant-cut so this specific
  // boundary wins.
  if (fromLayout === "magazine_ticker" && toLayout === "colorblock") {
    return { presentation: cast(dieCutReveal({ accentColor })), frames: DUR.dieCut };
  }
  // Leaving the ticker page → riffle the magazine pages forward into the next
  // scene. Placed ABOVE the colorblock/feature instant-cut below so the ticker
  // still riffles out even into a self-revealing colorblock spread (the riffle
  // pages cover the frame, then clear as colorblock's blocks settle).
  if (fromLayout === "magazine_ticker") {
    return { presentation: cast(magazineRiffleOpen({ accentColor })), frames: DUR.riffle };
  }
  // colorblock and feature carry their own internal reveal (sequential blocks /
  // word-by-word written body); play an instant cut on either side so no
  // cross-page transition competes with it.
  if (
    fromLayout === "colorblock" || toLayout === "colorblock" ||
    fromLayout === "feature" || toLayout === "feature"
  ) {
    return { presentation: cast(fade()), frames: 1 };
  }
  // Off the cover/hero → a single page turn: the cover sheet, hinged at the spine,
  // swings forward to reveal the first interior spread beneath.
  if (HERO_LAYOUTS_FROM.has(fromLayout)) {
    return { presentation: cast(singlePageTurn({ direction: "forward", accentColor })), frames: DUR.singleTurn };
  }
  // Into the ending card → a clean horizontal page slide.
  if (HERO_LAYOUTS_TO.has(toLayout)) {
    return { presentation: cast(pageSlide()), frames: DUR.pageSlide };
  }
  // After the timeline scene → the gatefold unfold: the spread splits at the centre
  // spine and both halves swing open like double doors into the next section. Timeline
  // is light enough to 3D-swing (it page-turned out smoothly before), so the gatefold
  // reads clean — unlike the heavy self-revealing feature/colorblock pages, which
  // jitter when swung ([[magazine-preview-paint-cost]]).
  if (fromLayout === "timeline_journey") {
    return { presentation: cast(gatefoldUnfold({ accentColor })), frames: DUR.gatefold };
  }
  // Entering the by-the-numbers stat grid FROM the interview → always play the bento:
  // the 3×3 contact sheet assembles and the camera dives into the cell that becomes the
  // stats spread (echoing its compartmentalised grid). Placed above the interview's
  // generic slide-down so this boundary ALWAYS bentos in. Heavy predecessors
  // (feature/colorblock/ticker/data-viz) keep their own exits higher up and never reach
  // a bento, so the scaled outgoing page is always light — no jitter
  // ([[magazine-preview-paint-cost]]). (Other light predecessors are covered by the
  // generic `toLayout === "by_the_numbers"` rule further down.)
  if (fromLayout === "interview_qa" && toLayout === "by_the_numbers") {
    return { presentation: cast(contactSheetZoom({ accentColor })), frames: DUR.bento };
  }
  // Leaving the interview Q/A page → quicker slide-down reveal.
  if (fromLayout === "interview_qa") {
    return { presentation: cast(slideDownReveal()), frames: DUR.slideDownFast };
  }
  // Leaving the by-the-numbers page → a circular die-cut hole opens at centre and
  // grows, the next scene showing through the punched hole. Checked before the
  // data-scene dive below so this exit wins.
  if (fromLayout === "by_the_numbers") {
    return { presentation: cast(dieCutReveal({ accentColor })), frames: DUR.dieCut };
  }
  // Leaving the data-visualization page → riffle the magazine pages forward into
  // the next scene (overrides the data-scene zoom-blur dive on the exit only;
  // entering a data scene still dives so the chart resolves crisp-and-flat).
  if (fromLayout === "magazine_data_visualization") {
    return { presentation: cast(magazineRiffleOpen({ accentColor })), frames: DUR.riffle };
  }
  // Leaving the editorial pull-quote → a clean horizontal side slide: the next
  // scene slides in from the right, pushing the pull-quote off to the left. Placed
  // above the by-the-numbers bento entry and the data-scene dive so the pull-quote
  // always slides out (it no longer gets captured by the bento when a stats page
  // follows it). The colorblock/feature instant-cut above still wins for those.
  if (fromLayout === "editorial_quote") {
    return { presentation: cast(pageSlide()), frames: DUR.pageSlide };
  }
  // Entering the by-the-numbers stats page → a contact-sheet / bento grid of
  // pages assembles, then the camera dives into the cell that becomes the stats
  // spread (echoing its compartmentalised stat grid). Placed before the data-scene
  // dive so this entrance wins; the stats still resolve crisp-and-flat after the
  // dive. Stronger exit signatures above (feature / data-viz riffle, cover) still
  // take precedence.
  if (toLayout === "by_the_numbers") {
    return { presentation: cast(contactSheetZoom({ accentColor })), frames: DUR.bento };
  }
  // Entering the ticker page → a circular die-cut hole opens at centre and grows
  // to reveal it (real magazines punch die-cut holes through to the page beneath).
  // Placed before the data-scene dive so this entrance wins.
  if (toLayout === "magazine_ticker") {
    return { presentation: cast(dieCutReveal({ accentColor })), frames: DUR.dieCut };
  }
  // Entering the before/after comparison spread → the contact-sheet / bento grid
  // assembles, then the camera dives into the cell that becomes the comparison.
  // feature/colorblock sources never reach here — they return earlier via the feature
  // riffle / colorblock instant-cut above — so those heavy, continuously-animating 3D
  // pages are never scaled inside the sheet (which jitters; see the note at the top).
  if (toLayout === "comparison") {
    return { presentation: cast(contactSheetZoom({ accentColor })), frames: DUR.bento };
  }
  // Any boundary touching a data scene → zoom-blur dive. Entering one, the data
  // page zooms out of the blur and aligns flat; leaving one, it zooms in + blurs
  // away onto the next page.
  if (DATA_LAYOUTS.has(fromLayout) || DATA_LAYOUTS.has(toLayout)) {
    return { presentation: cast(zoomBlurDive({ accentColor })), frames: DUR.zoomBlur };
  }
  // Entering the editorial pull-quote: the next scene slides straight down from the
  // top (pure-transform reveal). The old accent-band wipe animated clip-path + scale
  // together on this heavy preserve-3d page, which saturated Chrome's shared
  // compositor and glitched the whole frontend — see [[magazine-preview-paint-cost]].
  if (toLayout === "editorial_quote") {
    return { presentation: cast(slideDownReveal()), frames: DUR.slideDown };
  }
  // Entering the field-notes / text-narration index → the page settles into view
  // (gentle scale + drop) before the dense numbered list reads.
  if (toLayout === "text_narration") {
    return { presentation: cast(pageSettle()), frames: DUR.settle };
  }
  return POOL[fromIdx % POOL.length](accentColor);
};
