/** Spotlight template layout types. */
import type { SocialsMap } from "../SocialIcons";

export type SpotlightLayoutType =
  | "impact_title"
  | "statement"
  | "word_punch"
  | "cascade_list"
  | "stat_stage"
  | "versus"
  | "spotlight_image"
  | "rapid_points"
  | "spotlight_data"
  | "spotlight_data_bar"
  | "spotlight_data_histogram"
  | "spotlight_table"
  | "closer"
  | "ending_socials";

export interface SpotlightLayoutProps {
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
  // statement / impact_title
  highlightWord?: string;
  // word_punch
  word?: string;
  // cascade_list / glass_stack equivalent
  items?: string[];
  // stat_stage
  metrics?: { value: string; label: string; suffix?: string }[];
  // versus
  leftLabel?: string;
  rightLabel?: string;
  leftDescription?: string;
  rightDescription?: string;
  // rapid_points
  phrases?: string[];
  // closer
  highlightPhrase?: string;
  cta?: string;
  // typography overrides
  titleFontSize?: number;
  descriptionFontSize?: number;

  // ── spotlight_data (chart) — uses the shared chartTable data-viz contract ──
  /** Column 0 = X labels; columns 1–3 = up to three numeric series. */
  chartTable?: { headers?: string[]; rows?: Array<Array<string | number>> };
  /** "line" | "bar" | "histogram" | "auto" (infer from label shape). */
  chartType?: "auto" | "line" | "bar" | "histogram";
  /** Prose beside the chart; empty → auto-summary from chartTable. */
  chartSummary?: string;
  /** Y-axis tick label overrides (top → bottom). */
  chartYAxisTicks?: string[];
  /** X-axis / category caption; empty uses chartTable.headers[0]. */
  subtitle?: string;
  /** Y-axis title; empty uses chartTable.headers[1]. */
  yAxisLabel?: string;
  /** Chart color overrides. */
  barPrimaryColor?: string;
  barSecondaryColor?: string;

  // ── spotlight_table (data table) — uses the shared tickerTable contract ──
  tickerTable?: { headers: string[]; rows: string[][] };
  tickerTitle?: string;
  tickerFootnote?: string;
  /** 0-based column index to color-code +/- (e.g. % change). -1 disables. */
  tickerHighlightCol?: number;

  // ending_socials
  socials?: SocialsMap;
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
  /** Optional multi-CTA array (up to 3). When present, renderer renders columns. */
  ctas?: Array<{ ctaButtonText?: string; websiteLink?: string; showWebsiteButton?: boolean }>;
}
