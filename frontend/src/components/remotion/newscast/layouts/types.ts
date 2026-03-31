import type { BlogLayoutProps } from "../../newspaper/types";

/**
 * Props for NEWSCAST layouts. Extends `BlogLayoutProps`, including optional `imageUrl`
 * for a full-bleed editorial background on **every** layout (hero through data viz).
 */
export interface NewscastLayoutProps extends BlogLayoutProps {
  /**
   * Composition-only: scene start frame so the hero globe can share continuous rotation with later scenes.
   */
  globeRotationFrameOffset?: number;

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

  /** data_visualization (nightfall-compatible schema keys) */
  barChartRows?: Array<{ label?: string; value?: string }>;
  /** Same data as `barChartRows` but `{ labels, values }` (AI / Nightfall exports). */
  barChart?: { labels?: string[]; values?: (string | number)[] };
  lineChartLabels?: string[];
  lineChartDatasets?: Array<{ label?: string; valuesStr?: string; color?: string }>;
  pieChartRows?: Array<{ label?: string; value?: string }>;
}

export type NewscastLayoutType =
  | "cinematic_title"
  | "glass_narrative"
  | "glow_metric"
  | "glass_code"
  | "kinetic_insight"
  | "glass_stack"
  | "split_glass"
  | "chapter_break"
  | "glass_image"
  | "data_visualization";

