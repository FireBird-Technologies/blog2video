import type { SocialsMap } from "../SocialIcons";
import type { BarChartData, LineChartData } from "../nightfall/types";

export type LayoutType =
  | "hero_image"
  | "text_narration"
  | "code_block"
  | "bullet_list"
  | "flow_diagram"
  | "comparison"
  | "metric"
  | "quote_callout"
  | "image_caption"
  | "timeline"
  | "data_visualization"
  | "ending_socials";

export interface SceneLayoutProps {
  title: string;
  narration: string;
  imageUrl?: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;  // "landscape" or "portrait"
  fontFamily?: string;
  // code_block
  codeLines?: string[];
  codeLanguage?: string;
  // bullet_list
  bullets?: string[];
  // flow_diagram
  steps?: string[];
  // metric
  metrics?: { value: string; label: string; suffix?: string }[];
  // quote_callout
  quote?: string;
  quoteAuthor?: string;
  // comparison
  leftLabel?: string;
  rightLabel?: string;
  leftDescription?: string;
  rightDescription?: string;
  // timeline
  timelineItems?: { label: string; description: string }[];
  // data_visualization (converted from *Rows in DefaultVideo)
  barChart?: BarChartData;
  lineChart?: LineChartData;
  /** Same shape as bar chart — bin labels + counts */
  histogram?: BarChartData;
  // typography overrides
  titleFontSize?: number;
  descriptionFontSize?: number;
  // ending_socials
  socials?: SocialsMap;
  websiteLink?: string;
  showWebsiteButton?: boolean;
  /** Short label on the CTA pill above the link (from script / editor). */
  ctaButtonText?: string;
}
