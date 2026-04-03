import type { BlogLayoutProps } from "../../newspaper/types";

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
}

export type NewscastLayoutType =
  | "opening"
  | "anchor_narrative"
  | "live_metrics_board"
  | "briefing_code_panel"
  | "headline_insight"
  | "story_stack"
  | "side_by_side_brief"
  | "segment_break"
  | "field_image_focus"
  | "ending_socials";

