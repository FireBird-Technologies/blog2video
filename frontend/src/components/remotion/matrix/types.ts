/** Matrix template layout types. */
import type { SocialsMap } from "../SocialIcons";

export type MatrixLayoutType =
  | "matrix_title"
  | "terminal_text"
  | "glitch_punch"
  | "data_stream"
  | "cipher_metric"
  | "fork_choice"
  | "matrix_image"
  | "transmission"
  | "awakening"
  | "matrix_data"
  | "matrix_data_bar"
  | "matrix_data_histogram"
  | "matrix_ticker"
  | "ending_socials";

export interface MatrixLayoutProps {
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
  // terminal_text
  highlightWord?: string;
  // glitch_punch
  word?: string;
  // data_stream
  items?: string[];
  // cipher_metric
  metrics?: { value: string; label: string; suffix?: string }[];
  // fork_choice
  leftLabel?: string;
  rightLabel?: string;
  leftDescription?: string;
  rightDescription?: string;
  // transmission
  phrases?: string[];
  // awakening
  highlightPhrase?: string;
  cta?: string;
  // typography overrides
  titleFontSize?: number;
  descriptionFontSize?: number;

  // ── matrix_data (chart) — uses the shared chartTable data-viz contract ──
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

  // ── matrix_ticker (data table) — uses the shared tickerTable contract ──
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
