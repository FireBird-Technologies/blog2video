import type { SocialsMap, SocialsRow } from "../SocialIcons";

export type MagazineLayoutType =
  | "magazine_cover" | "feature_spread" | "editorial_quote" | "by_the_numbers" | "interview_qa" | "comparison_spread" | "magazine_data_visualization" | "timeline_journey" | "expert_spotlight" | "text_narration" | "ending_socials" | "magazine_ticker";

// Cinematic camera move applied to a scene's 3D spread. Each maps to a frame-
// driven path in useMagazineCamera (magazineStyle.tsx). A scene can override its
// per-layout signature move by setting `cameraMove` in its layoutProps.
export type MagazineCameraMove =
  | "crane_down"   // start far + high, descend + dolly in onto the spread (establishing)
  | "punch_in"     // sustained dolly-in toward a focal point (stats, charts)
  | "dolly_out"    // pull back to reveal the whole spread + desk (endings)
  | "dolly_zoom"   // Hitchcock vertigo — widen FOV while holding the sheet's size
  | "orbit_sweep"  // arc the camera across the spread (features)
  | "tracking_pan" // lateral dolly glide along the table edge (comparisons)
  | "whip_settle"  // fast whip-pan that snaps into the rest pose
  | "gods_eye"     // near-overhead flat-lay drifting to a readable tilt
  | "dutch_roll"   // enters rolled (Dutch angle) and levels out
  | "low_hero"     // imposing fill-frame push (cover, expert authority)
  | "book_open"    // spread swings open around the centre binding (features, interviews)
  | "breathe";     // gentle settle + drift, the calm baseline

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
  // Publication/brand wordmark for the cover masthead (from project name)
  brandName?: string;
  attribution?: string;
  caption?: string;
  stats?: Array<{ label?: string; value?: string }>;
  // feature_spread — optional italic standfirst deck + ruled key-point takeaways
  // that fill the lower band of the page. Absent => the legacy first-sentence
  // deck heuristic and a body-only page are used.
  standfirst?: string;
  keyPoints?: string[];
  // feature_spread — directly-editable article body copy that flows across both
  // pages. Absent => the body falls back to the scene narration.
  body?: string;
  leftSpeaker?: string;
  rightSpeaker?: string;
  leftQuote?: string;
  rightQuote?: string;
  // interview_qa — up to 3 question/answer exchanges. Supersedes the legacy
  // title + leftQuote/rightQuote pair when present.
  exchanges?: Array<{ q?: string; a?: string }>;
  leftHeader?: string;
  rightHeader?: string;
  // comparison_spread — a bullet list per column. leftContent/rightContent are
  // legacy paragraph props kept only as a fallback for older saved scenes.
  leftPoints?: Array<{ value?: string }>;
  rightPoints?: Array<{ value?: string }>;
  leftContent?: string;
  rightContent?: string;
  // Data-visualization props (magazine_data_visualization) — shared chart contract
  chartTable?: { headers: string[]; rows: string[][] };
  chartType?: string;
  chartSummary?: string;
  yAxisLabel?: string;
  chartYAxisTicks?: string[];
  barPrimaryColor?: string;
  barSecondaryColor?: string;
  milestones?: Array<{ label?: string; value?: string }>;
  expertName?: string;
  expertRole?: string;
  credential?: string;
  ctaText?: string;
  websiteUrl?: string;
  ctas?: unknown;
  tickerTable?: { headers: string[]; rows: string[][] };
  tickerTitle?: string;
  tickerFootnote?: string;
  tickerHighlightCol?: number;
}
