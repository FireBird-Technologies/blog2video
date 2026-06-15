import type { SocialsMap, SocialsRow } from "../SocialIcons";

export type Stickman2LayoutType =
  | "chalk_title" | "night_walk" | "shooting_star" | "constellation_stats" | "moonphase_chart" | "shadow_comparison" | "signal_fire_scene" | "neon_countdown" | "lantern_dialogue" | "data_visualisation" | "ending_socials" | "ticker_table";

export interface SceneLayoutProps {
  title: string;
  narration: string;
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  // sceneDurationInFrames is THIS scene's exact length — drive entrance/exit from it
  sceneDurationInFrames?: number;
  fontFamily?: string;
  titleFontSize?: number;
  descriptionFontSize?: number;
  // socials / website are used by the ending_socials layout, which
  // renders the shared <SocialIcons> component (../../SocialIcons)
  socials?: SocialsMap | SocialsRow[];
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
  // object_array props use the standard label/value pair shape so the editor can render both fields
  stats?: Array<{ label?: string; value?: string }>;
  bars?: Array<{ label?: string; value?: string }>;
  leftThought?: string;
  rightThought?: string;
  startFrom?: number;
  label?: string;
  leftBubble?: string;
  rightBubble?: string;
  speakers?: Array<{ label?: string; value?: string }>;
  handles?: string[];

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

  // ── ticker_table ──────────────────────────────────────────────────────────
  tickerTable?: { headers?: string[]; rows?: string[][] };
  tickerTitle?: string;
  tickerFootnote?: string;
  tickerHighlightCol?: number;
}
