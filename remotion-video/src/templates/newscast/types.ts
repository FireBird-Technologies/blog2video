import type { SocialsMap } from "../SocialIcons";

export type NewscastChartType = "auto" | "line" | "bar" | "histogram";

export interface NewscastChartRow {
  label: string;
  value: string | number;
}

export interface NewscastChartSeriesInput {
  label?: string;
  valuesStr: string;
}

export interface NewscastChartTableInput {
  headers?: string[];
  rows?: Array<Array<string | number>>;
}

export interface NewscastLayoutProps {
  title: string;
  narration?: string;

  /** Composition timeline: scene start frame for continuous globe rotation across sequences. */
  globeRotationFrameOffset?: number;

  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  aspectRatio?: "landscape" | "portrait";

  titleFontSize?: number;
  descriptionFontSize?: number;

  /**
   * Persistent chrome (ticker + lower-third).
   * Optional for backward compatibility with older saved projects.
   */
  tickerItems?: string[];
  lowerThirdTag?: string;
  lowerThirdHeadline?: string;
  lowerThirdSub?: string;

  /** glass_narrative + glass_image category badge */
  category?: string;

  /** glow_metric */
  metrics?: Array<{ value: string; label: string; suffix?: string }>;

  /** data_visualization */
  marketSymbol?: string;
  marketValue?: string;
  marketDelta?: string;
  marketPercent?: string;
  marketTrend?: "up" | "down" | "crash";
  chartType?: NewscastChartType;
  barChartRows?: NewscastChartRow[];
  histogramRows?: NewscastChartRow[];
  lineChartLabels?: string[];
  lineChartDatasets?: NewscastChartSeriesInput[];
  chartTable?: NewscastChartTableInput;
  barPrimaryColor?: string;
  barSecondaryColor?: string;
  barTertiaryColor?: string;
  lineUpColor?: string;
  lineDownColor?: string;
  yAxisLabel?: string;

  /** glass_code */
  codeLanguage?: string;
  codeLines?: string[];

  /** kinetic_insight */
  quote?: string;
  highlightWord?: string;
  attribution?: string;

  /** glass_stack */
  sectionLabel?: string;
  items?: string[];

  /** split_glass */
  leftLabel?: string;
  rightLabel?: string;
  leftTitle?: string;
  rightTitle?: string;
  leftBody?: string;
  rightBody?: string;

  /** chapter_break */
  chapterNumber?: number;
  chapterLabel?: string;
  subtitle?: string;

  /** Optional full-bleed background image URL; supported on all newscast layouts. */
  imageUrl?: string;

  fontFamily?: string;

  /** ending_socials */
  socials?: SocialsMap;
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
}

export type NewscastLayoutType =
  | "opening"
  | "anchor_narrative"
  | "live_metrics_board"
  | "data_visualization"
  | "briefing_code_panel"
  | "headline_insight"
  | "story_stack"
  | "side_by_side_brief"
  | "segment_break"
  | "field_image_focus"
  | "ending_socials";

