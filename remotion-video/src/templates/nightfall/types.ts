/** Nightfall template layout types. */
import type { SocialsMap } from "../SocialIcons";

// The `__vN` members are visual variants (see backend/templates/nightfall/meta.json
// `layout_variants`). A variant takes the SAME props as its base layout — switching
// between them must never require a prop migration.
export type NightfallLayoutType =
  | "cinematic_title"
  | "cinematic_title__v2"
  | "glass_narrative"
  | "glass_narrative__v2"
  | "glow_metric"
  | "glass_code"
  | "kinetic_insight"
  | "glass_stack"
  | "split_glass"
  | "chapter_break"
  | "glass_image"
  | "nightfall_data_visualization"
  | "nightfall_ticker"
  | "ending_socials"
  | "ending_socials__v2";

export interface NightfallLayoutProps {
  title: string;
  narration: string;
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  // Stock footage: when videoUrl is set it REPLACES imageUrl in the same slot.
  // Framing reuses imageObjectPosition + imageZoom, so the adjust UI works on
  // clips unchanged.
  videoUrl?: string;
  videoMuted?: boolean;
  videoVolume?: number;
  /** Clip length in frames, for <Loop>. Absent = play once. */
  videoDurationInFrames?: number;
  /** Start offset into the clip, in frames (the adjust-modal trim). */
  videoStartInFrames?: number;
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
