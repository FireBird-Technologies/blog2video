import type { SocialsMap } from "../SocialIcons";

/** Gridcraft template layout types (frontend mirror). */
export type GridcraftLayoutType =
  | "bento_hero"
  | "bento_features"
  | "bento_highlight"
  | "editorial_body"
  | "kpi_grid"
  | "bento_compare"
  | "bento_code"
  | "pull_quote"
  | "bento_steps"
  | "data_visualisation"
  | "ending_socials"
  | "ticker_table";

export interface DataPoint {
  label: string;
  value?: string;
  trend?: "up" | "down" | "neutral" | string;
  icon?: string;
  title?: string; // For features/compare
  description?: string; // For features/compare
  [key: string]: any;
}

export interface GridcraftLayoutProps {
  title: string;
  subtitle?: string;
  narration: string;
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  fontFamily?: string;

  // Shared data points (used by KPI, Steps)
  dataPoints?: DataPoint[];

  // Bento Features
  features?: { icon: string; label: string; description: string }[];
  highlightIndex?: number;

  // Bento Code
  codeSnippet?: string;
  codeLines?: string[];
  codeLanguage?: string;

  // Bento Compare
  leftLabel?: string;
  rightLabel?: string;
  leftDescription?: string;
  rightDescription?: string;
  verdict?: string;

  // Bento Highlight
  mainPoint?: string;
  supportingFacts?: string[];

  // Pull Quote
  quote?: string;
  attribution?: string;
  highlightPhrase?: string;

  // Bento Steps
  steps?: { label: string; description?: string }[];

  // ── data_visualisation (chart) — shared chartTable data-viz contract ──
  // (reuses the existing `subtitle` prop above as the X-axis / category caption)
  /** Column 0 = X labels; columns 1–3 = up to three numeric series. */
  chartTable?: { headers?: string[]; rows?: Array<Array<string | number>> };
  /** "line" | "bar" | "histogram" | "auto" (infer from label shape). */
  chartType?: "auto" | "line" | "bar" | "histogram";
  /** Prose beside the chart; empty → auto-summary from chartTable. */
  chartSummary?: string;
  /** Y-axis tick label overrides (top → bottom). */
  chartYAxisTicks?: string[];
  /** Y-axis title; empty uses chartTable.headers[1]. */
  yAxisLabel?: string;
  /** Chart color overrides. */
  barPrimaryColor?: string;
  barSecondaryColor?: string;

  // ── ticker_table ──────────────────────────────────────────────────────────
  tickerTable?: { headers?: string[]; rows?: string[][] };
  tickerTitle?: string;
  tickerFootnote?: string;
  tickerHighlightCol?: number;

  // General
  version?: string;

  // Bento Hero - category/icon for small cells
  category?: string; // e.g. "Featured", "Census"
  icon?: string; // emoji or short text for icon cell
  // typography overrides
  titleFontSize?: number;
  descriptionFontSize?: number;
  categoryFontSize?: number;
  socials?: SocialsMap;
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
  /** Optional multi-CTA array (up to 3). When present, renderer renders columns. */
  ctas?: Array<{ ctaButtonText?: string; websiteLink?: string; showWebsiteButton?: boolean }>;
}
