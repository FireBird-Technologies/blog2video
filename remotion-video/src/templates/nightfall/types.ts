/** Nightfall template layout types. */
import type { SocialsMap } from "../SocialIcons";

export type NightfallLayoutType =
  | "cinematic_title"
  | "glass_narrative"
  | "glow_metric"
  | "glass_code"
  | "kinetic_insight"
  | "glass_stack"
  | "split_glass"
  | "chapter_break"
  | "glass_image"
  | "nightfall_data_visualization"
  | "nightfall_ticker"
  | "ending_socials";

export interface NightfallLayoutProps {
  title: string;
  narration: string;
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  fontFamily?: string;
  // glow_metric
  metrics?: { value: string; label: string; suffix?: string }[];
  // glass_code
  codeLines?: string[];
  codeLanguage?: string;
  // kinetic_insight
  quote?: string;
  highlightWord?: string;
  // glass_stack
  items?: string[];
  // split_glass
  leftLabel?: string;
  rightLabel?: string;
  leftDescription?: string;
  rightDescription?: string;
  // chapter_break
  chapterNumber?: number;
  subtitle?: string;
  // nightfall_data_visualization
  chartTable?: { headers: string[]; rows: string[][] };
  chartType?: string;
  chartSummary?: string;
  yAxisLabel?: string;
  chartYAxisTicks?: string[];
  barPrimaryColor?: string;
  barSecondaryColor?: string;
  // nightfall_ticker
  tickerTable?: { headers: string[]; rows: string[][] };
  tickerTitle?: string;
  tickerFootnote?: string;
  tickerHighlightCol?: number;
  // typography overrides
  titleFontSize?: number;
  descriptionFontSize?: number;
  // ending_socials
  socials?: SocialsMap;
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
  /** Optional multi-CTA array (up to 3). When present, renderer renders columns. */
  ctas?: Array<{ ctaButtonText?: string; websiteLink?: string; showWebsiteButton?: boolean }>;
}
