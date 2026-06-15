import type { SocialsMap } from "../SocialIcons";

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
  | "default_data_visualization"
  | "default_ticker"
  | "ending_socials";

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
  fontFamily?: string;
  /** Index of this scene in the video — used to vary the background fly-in direction per scene. */
  sceneIndex?: number;
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
  // default_data_visualization
  chartTable?: { headers: string[]; rows: string[][] };
  chartType?: string;
  chartSummary?: string;
  subtitle?: string;
  yAxisLabel?: string;
  chartYAxisTicks?: string[];
  barPrimaryColor?: string;
  barSecondaryColor?: string;
  // default_ticker
  tickerTable?: { headers: string[]; rows: string[][] };
  tickerTitle?: string;
  tickerFootnote?: string;
  tickerHighlightCol?: number;
  // typography overrides
  titleFontSize?: number;
  descriptionFontSize?: number;
  socials?: SocialsMap;
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
  /** Optional multi-CTA array (up to 3). When present, renderer renders columns. */
  ctas?: Array<{ ctaButtonText?: string; websiteLink?: string; showWebsiteButton?: boolean }>;
}
