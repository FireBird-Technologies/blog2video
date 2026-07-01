import type { SocialsMap, SocialsRow } from "../SocialIcons";

export type MagazineLayoutType =
  | "magazine_cover" | "editorial_quote" | "by_the_numbers" | "interview_qa" | "magazine_data_visualization" | "timeline_journey" | "text_narration" | "ending_socials" | "magazine_ticker" | "colorblock" | "feature" | "comparison";

// Cinematic camera move applied to a scene's 3D spread. Each maps to a frame-
// driven path in useMagazineCamera (magazineStyle.tsx). A scene can override its
// per-layout signature move by setting `cameraMove` in its layoutProps.
export type MagazineCameraMove =
  | "crane_down"   // start far + high, descend + dolly in onto the spread (establishing)
  | "punch_in"     // sustained dolly-in toward a focal point (stats, charts)
  | "dolly_out"    // pull back to reveal the whole spread + desk (endings)
  | "dolly_zoom"   // Hitchcock vertigo — widen FOV while holding the sheet's size
  | "orbit_sweep"  // arc the camera across the spread (features)
  | "tracking_pan" // lateral dolly glide along the table edge
  | "whip_settle"  // fast whip-pan that snaps into the rest pose
  | "gods_eye"     // near-overhead flat-lay drifting to a readable tilt
  | "dutch_roll"   // enters rolled (Dutch angle) and levels out
  | "low_hero"     // imposing fill-frame push (cover, expert authority)
  | "book_open"    // spread swings open around the centre binding (features, interviews)
  | "read_lift"    // page lifts gently toward the reader, then holds (pick-up & read)
  | "settle_read"  // drifts from a slight angle into a comfortable reading tilt, then holds
  | "pinned"       // fully static, head-on, no motion (reading spreads — e.g. Q&A)
  | "breathe";     // gentle settle + drift, the calm baseline

// Single-scene EXIT page-move played over a scene's last frames (see SceneExit in
// magazineStyle.tsx). Only ONE page is ever mounted — the move animates it away to
// reveal the desk, then the next scene flies in on its camera. "lift" is the fallback.
export type SceneExitVariant =
  | "riffle_left"    // blank sheets flip R→L around the left spine, staggered (riffle)
  | "page_turn"      // one sheet turns around the right edge
  | "page_turn_back" // one sheet turns around the left edge
  | "page_turn_up"   // one sheet flips around the bottom edge, turns up
  | "flip_up"        // alias of page_turn_up (rotateX around the bottom edge)
  | "spread_close"   // two cover panels swing shut at the centre spine
  | "corner_peel"    // the page peels back from the top-right corner
  | "riffle_zoom"    // riffle + a forward push (the dive used on data)
  | "slide_down"     // the page slides straight down off the bottom
  | "page_slide"     // the page slides off to the left
  | "zoom_blur"      // the page scales up toward camera and fades
  | "lift";          // plain lift + fade fallback

// Stable string names for the scene-entering transitions, used to pin a specific
// transition to a specific scene (see `enterTransition`/`exitTransition` below and
// the TRANSITION_REGISTRY in transitions/index.ts). Deterministic per scene — not
// the order-based POOL cycling.
export type MagazineTransitionName =
  | "center_doors"  // outgoing splits at the spine; halves slide apart, new revealed behind
  | "break_behind"  // outgoing breaks into 4 panels that fly off, new revealed behind
  | "break_split"   // break_behind, 2-piece top/bottom variant
  | "window_open"   // new revealed through a growing rectangular window (rect die-cut)
  | "page_turn"     // single sheet hinged at the spine swings forward
  | "page_turn_back" // single sheet hinged the opposite way (distinct from the cover turn)
  | "page_turn_up"  // single sheet hinged at the bottom edge, turns up to reveal
  | "page_slide"    // clean horizontal push — new slides in, old slides off
  | "slide_down"    // new slides straight down from the top
  | "die_cut"       // circular die-cut hole opens to reveal the new page
  | "gatefold"      // spread splits at the spine; both halves swing open (3D)
  | "bento"         // zoom out to a 3×3 contact sheet, then dive into the next cell
  | "zoom_blur"     // zoom-in-blur out → zoom-out-blur in (data scenes)
  | "riffle"        // magazine pages riffle past, revealing the next scene
  | "settle"        // new page eases in + settles flat
  | "lift"          // old page lifts off to reveal the next underneath
  | "diagonal"      // a hard diagonal edge sweeps the next page in
  | "press"         // printing-press roller sweeps down, printing the next page top→down
  | "stack"         // a magazine stack drops in and the top page opens to the next scene
  | "sweep_up"      // page sweeps up from the bottom (gap-free)
  | "sweep_left"    // page sweeps in from the left (gap-free)
  | "sweep_tl"      // page sweeps in diagonally from the top-left (gap-free)
  | "sweep_br"      // page sweeps in diagonally from the bottom-right (gap-free)
  | "ticker_tape"   // a ticker-tape print carriage crawls L→R, printing the ledger in
  | "quote_swing"   // spread's two leaves swing in flat, staggered (call-and-response)
  | "fade";         // simple crossfade

export interface SceneLayoutProps {
  title: string;
  narration: string;
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  // Where a scene's photo sits. "center" = full-bleed (no spine/gutter);
  // "top_left" = boxed in the upper-left with text reflowed; "none" = ignore image.
  // Optional override — each layout has a sensible default placement.
  imagePlacement?: "center" | "top_left" | "none";
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  // sceneDurationInFrames is THIS scene's exact length — drive entrance/exit from it
  sceneDurationInFrames?: number;
  fontFamily?: string;
  titleFontSize?: number;
  descriptionFontSize?: number;
  // socials / website are used by the ending_socials layout, which
  // renders the shared <SocialIcons> component (../../SocialIcons)
  socials?: SocialsMap | SocialsRow[];
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
  // ending_socials back-cover column headings — the tracked uppercase labels above
  // the social handles ("Follow") and the CTA cards ("Online"). Editable per scene.
  followLabel?: string;
  onlineLabel?: string;
  // object_array props use the standard label/value pair shape so the editor can render both fields
  subtitle?: string;
  issueLabel?: string;
  sectionLabel?: string;
  // Folio page number injected by the composition (1-based scene order, zero-padded)
  pageNumber?: string;
  // True only for the first scene — plays the one-time establishing fly-in.
  establishingShot?: boolean;
  // Cinematic camera move for this scene's 3D spread. The composition fills this
  // with a per-layout signature default; an explicit value here overrides it.
  cameraMove?: MagazineCameraMove;
  // Pin a specific transition to THIS scene, always applied regardless of the
  // scene's position in the deck (overrides the per-layout maps + the order-based
  // POOL). `enterTransition` plays when this scene STARTS; `exitTransition` plays
  // when this scene ENDS. An enter override on the next scene wins over an exit
  // override on this one at a shared boundary. See transitions/index.ts.
  enterTransition?: MagazineTransitionName;
  exitTransition?: MagazineTransitionName;
  // Override this scene's single-scene EXIT page-move (defaults to the per-layout
  // signature in exitAnimFor; the entry is the scene's camera fly-in).
  exitAnim?: SceneExitVariant;
  // Publication/brand wordmark for the cover masthead (from project name)
  brandName?: string;
  attribution?: string;
  caption?: string;
  stats?: Array<{ label?: string; value?: string }>;
  leftSpeaker?: string;
  rightSpeaker?: string;
  leftQuote?: string;
  rightQuote?: string;
  // colorblock — generic two-panel color-block scene. leftQuote drives the ink
  // panel statement; the panel* fields fill the accent panel's label stack.
  panelLabel?: string;
  panelHeading?: string;
  panelSubline?: string;
  panelTag?: string;
  // feature — original feature-article prose (distilled from the source script by
  // the generation pipeline); falls back to narration. The first letter renders as
  // the red drop cap. keyPoints are 2–4 short takeaways shown along the bottom.
  body?: string;
  keyPoints?: Array<{ value?: string }>;
  // interview_qa — up to 3 question/answer exchanges. Supersedes the legacy
  // title + leftQuote/rightQuote pair when present.
  exchanges?: Array<{ q?: string; a?: string }>;
  // comparison — two-column before/after spread with a centre "VS" badge.
  // leftPoints/rightPoints are short bullets; leftContent/rightContent are the
  // legacy paragraph fallbacks split into sentence bullets when no points exist.
  leftHeader?: string;
  rightHeader?: string;
  leftPoints?: Array<{ value?: string }>;
  rightPoints?: Array<{ value?: string }>;
  leftContent?: string;
  rightContent?: string;
  vsLabel?: string;
  // Data-visualization props (magazine_data_visualization) — shared chart contract
  chartTable?: { headers: string[]; rows: string[][] };
  chartType?: string;
  chartSummary?: string;
  yAxisLabel?: string;
  chartYAxisTicks?: string[];
  barPrimaryColor?: string;
  barSecondaryColor?: string;
  milestones?: Array<{ label?: string; value?: string; desc?: string }>;
  // text_narration — the bulleted field-notes. Each item is one note/bullet.
  // Falls back to sentence-splitting `narration` when absent (legacy scenes).
  points?: Array<{ value?: string }>;
  ctaText?: string;
  websiteUrl?: string;
  ctas?: unknown;
  tickerTable?: { headers: string[]; rows: string[][] };
  tickerTitle?: string;
  tickerFootnote?: string;
  tickerHighlightCol?: number;
}
