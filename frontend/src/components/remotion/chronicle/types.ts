/**
 * Chronicle template — old history book / medieval tome aesthetic.
 * Types mirror the shape used by other templates (see newspaper/types.ts).
 */
import type { SocialsMap } from "../SocialIcons";

export type ChronicleLayoutType =
  | "book_open"
  | "parchment_scroll"
  | "chapter_plate"
  | "illuminated_quote"
  | "ledger_stats"
  | "versus_folio"
  | "chronicle_timeline"
  | "map_reveal"
  | "decree_seal"
  | "chronicle_data"
  | "chronicle_table"
  | "ending_socials";

export interface ChronicleStat {
  value: string;
  label: string;
}

export interface ChronicleLayoutProps {
  title: string;
  narration?: string;

  // Global theming
  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  aspectRatio?: "landscape" | "portrait";
  fontFamily?: string;

  // Responsive typography (drives scene editor)
  titleFontSize?: number;
  descriptionFontSize?: number;

  // Image adjustment modal props
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;

  // Layout-specific inputs
  stats?: ChronicleStat[];
  category?: string;

  // illuminated_quote
  quote?: string;
  attribution?: string;
  highlightPhrase?: string;

  // chapter_plate
  chapterNumber?: number;
  subtitle?: string;

  // versus_folio / fact_check style
  leftLabel?: string;
  rightLabel?: string;
  leftDescription?: string;
  rightDescription?: string;

  // decree_seal
  word?: string;
  highlightWord?: string;
  cta?: string;

  // parchment_scroll drop cap override
  illuminatedLetter?: string;

  // ── chronicle_data (chart) — uses the shared chartTable data-viz contract ──
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
  /** Chart series color overrides. */
  barPrimaryColor?: string;
  barSecondaryColor?: string;

  // ── chronicle_table (data table) — uses the shared tickerTable contract ──
  tickerTable?: { headers: string[]; rows: string[][] };
  tickerTitle?: string;
  tickerFootnote?: string;
  /** 0-based column index to color-code +/- (e.g. % change). -1 disables. */
  tickerHighlightCol?: number;

  // ending_socials
  socials?: SocialsMap | Array<Record<string, unknown>>;
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
  /** Optional multi-CTA array (up to 3). When present, renderer renders columns. */
  ctas?: Array<{ ctaButtonText?: string; websiteLink?: string; showWebsiteButton?: boolean }>;
}
