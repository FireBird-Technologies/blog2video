/**
 * Newspaper template — layout prop interface and layout type.
 */
import type { SocialsMap } from "../SocialIcons";
export interface BlogLayoutProps {
  title: string;
  narration?: string;
  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  aspectRatio?: "landscape" | "portrait";
  titleFontSize?: number;
  descriptionFontSize?: number;
  stats?: Array<{ label: string; value: string }>;
  leftThought?: string;
  rightThought?: string;
  category?: string;
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;

  /** Project-level font override; when set, used for all text in the layout. */
  fontFamily?: string;

  // ── data_visualisation (chart) — shared chartTable data-viz contract ──
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

  // ending_socials
  socials?: SocialsMap;
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
  /** Optional multi-CTA array (up to 3). When present, renderer renders columns. */
  ctas?: Array<{ ctaButtonText?: string; websiteLink?: string; showWebsiteButton?: boolean }>;
}

export type NewspaperLayoutType =
  | "news_headline"
  | "article_lead"
  | "pull_quote"
  | "data_snapshot"
  | "fact_check"
  | "news_timeline"
  | "data_visualisation"
  | "ending_socials";
