import type { SocialsMap, SocialsRow } from "../SocialIcons";

export type MagazineLayoutType =
  | "magazine_cover" | "feature_spread" | "editorial_quote" | "photo_essay" | "by_the_numbers" | "interview_qa" | "comparison_spread" | "magazine_data_visualization" | "timeline_journey" | "expert_spotlight" | "text_narration" | "ending_socials" | "magazine_ticker";

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
  // Publication/brand wordmark for the cover masthead (from project name)
  brandName?: string;
  attribution?: string;
  caption?: string;
  stats?: Array<{ label?: string; value?: string }>;
  leftSpeaker?: string;
  rightSpeaker?: string;
  leftQuote?: string;
  rightQuote?: string;
  leftHeader?: string;
  rightHeader?: string;
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
