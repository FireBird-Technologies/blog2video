import type { BlogLayoutProps } from "../../newspaper/types";

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

/**
 * Props for NEWSCAST layouts. Extends `BlogLayoutProps`, including optional `imageUrl`
 * for a full-bleed editorial background on **every** layout.
 */
export interface NewscastLayoutProps extends BlogLayoutProps {
  /**
   * Composition-only: scene start frame so the hero globe can share continuous rotation with later scenes.
   */
  globeRotationFrameOffset?: number;

  /**
   * Stock footage. When `videoUrl` is set it REPLACES `imageUrl` in the same
   * visual slot — a scene never shows both. Framing reuses imageFocusX/Y +
   * imageZoom, so the existing Adjust-framing UI works on clips unchanged.
   */
  videoUrl?: string;
  videoMuted?: boolean;
  videoVolume?: number;
  /** Clip length in frames, for <Loop>. Absent = play once (see ZoomCropVideo). */
  videoDurationInFrames?: number;
  /** Start offset into the clip, in frames (the adjust-modal trim). */
  videoStartInFrames?: number;

  /**
   * Persistent chrome (ticker + lower third).
   * These are optional because older saved projects/layouts may not include them.
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
  lineThirdColor?: string;
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
}

// The `__vN` members are visual variants (see backend/templates/newscast/meta.json
// `layout_variants`). A variant takes the SAME props as its base layout — switching
// between them must never require a prop migration.
export type NewscastLayoutType =
  | "opening"
  | "opening__v2"
  | "anchor_narrative"
  | "anchor_narrative__v2"
  | "live_metrics_board"
  | "data_visualization"
  | "briefing_code_panel"
  | "headline_insight"
  | "story_stack"
  | "side_by_side_brief"
  | "segment_break"
  | "field_image_focus"
  | "ending_socials"
  | "ending_socials__v2";

