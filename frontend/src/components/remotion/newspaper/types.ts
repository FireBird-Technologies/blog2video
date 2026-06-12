import type { SocialsMap } from "../SocialIcons";

/**
 * Blog2Video — shared prop interface.
 * Intentionally compatible with WhiteboardLayoutProps so both
 * template families can share the same Remotion composition inputs.
 */
export interface BlogLayoutProps {
  title: string;
  narration?: string;

  /** Primary highlight/accent color. Default: #FFE34D (yellow marker) */
  accentColor?: string;
  /** Background color. Default: #FAFAF8 (warm paper) */
  bgColor?: string;
  /** Main text color. Default: #111111 */
  textColor?: string;

  aspectRatio?: "landscape" | "portrait";
  titleFontSize?: number;
  descriptionFontSize?: number;

  /**
   * Generic data array — each component interprets these differently:
   *  - NewsHeadline  : stats[0].value = author, stats[1].value = date
   *  - ArticleLead   : stats[0].value = pull-stat number, stats[0].label = pull-stat caption
   *  - DataSnapshot  : up to 4 items, each { value, label }
   *  - NewsTimeline  : each item { value = date string, label = event description }
   *  - FactCheck     : stats[0].label / stats[1].label = verdict labels
   */
  stats?: Array<{ label: string; value: string }>;

  /** FactCheck: left claim. ArticleLead: highlighted words (comma-separated). */
  leftThought?: string;
  /** FactCheck: right claim. */
  rightThought?: string;

  /** e.g. "Politics", "Technology", "Health" */
  category?: string;

  /** Optional image URL for hero (news_headline). */
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
