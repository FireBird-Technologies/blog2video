import type { SocialsMap } from "../SocialIcons";

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

  /** data_visualization (nightfall-compatible keys) */
  barChartRows?: Array<{ label?: string; value?: string }>;
  /** Same data as `barChartRows` in `{ labels, values }` form (AI / Nightfall). */
  barChart?: { labels?: string[]; values?: (string | number)[] };
  lineChartLabels?: string[];
  lineChartDatasets?: Array<{ label?: string; valuesStr?: string; color?: string }>;
  pieChartRows?: Array<{ label?: string; value?: string }>;

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
  | "cinematic_title"
  | "glass_narrative"
  | "glow_metric"
  | "glass_code"
  | "kinetic_insight"
  | "glass_stack"
  | "split_glass"
  | "chapter_break"
  | "glass_image"
  | "data_visualization"
  | "ending_socials";

