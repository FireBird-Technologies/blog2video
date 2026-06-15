export type BlackswanLayoutType =
  | "droplet_intro"
  | "neon_narrative"
  | "arc_features"
  | "pulse_metric"
  | "signal_split"
  | "dive_insight"
  | "reactor_code"
  | "flight_path"
  | "data_visualisation"
  | "ending_socials"
  | "ticker_table";

export interface BlackswanMetric {
  value: string;
  label: string;
  suffix?: string;
}

export interface BlackswanRow {
  label: string;
  value: string;
}

export interface BlackswanLayoutProps {
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
  titleFontSize?: number;
  descriptionFontSize?: number;
  layoutType?: BlackswanLayoutType;
  items?: string[];
  metrics?: BlackswanMetric[];
  leftLabel?: string;
  rightLabel?: string;
  leftDescription?: string;
  rightDescription?: string;
  quote?: string;
  highlightWord?: string;
  codeLanguage?: string;
  codeLines?: string[];
  phrases?: string[];
  barChartRows?: BlackswanRow[];

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
  barTertiaryColor?: string;

  // ── ticker_table ──────────────────────────────────────────────────────────
  tickerTable?: { headers?: string[]; rows?: string[][] };
  tickerTitle?: string;
  tickerFootnote?: string;
  tickerHighlightCol?: number;

  socials?: Record<string, unknown> | Array<Record<string, unknown>>;
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
  /** Optional multi-CTA array (up to 3). When present, renderer renders columns. */
  ctas?: Array<{ ctaButtonText?: string; websiteLink?: string; showWebsiteButton?: boolean }>;
}
