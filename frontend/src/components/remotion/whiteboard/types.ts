import type { SocialsMap } from "../SocialIcons";

export type WhiteboardLayoutType =
  | "drawn_title"
  | "marker_story"
  | "stick_figure_scene"
  | "stats_figures"
  | "stats_chart"
  | "comparison"
  | "countdown_timer"
  | "handwritten_equation"
  | "speech_bubble_dialogue"
  | "data_visualisation"
  | "ending_socials";

export interface WhiteboardStatItem {
  label: string;
  value: string;
}

export interface WhiteboardLayoutProps {
  title: string;
  narration: string;
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  titleFontSize?: number;
  descriptionFontSize?: number;
  stats?: WhiteboardStatItem[];
  leftThought?: string;
  rightThought?: string;
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
