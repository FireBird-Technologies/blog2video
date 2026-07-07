import type { SocialsMap } from "../SocialIcons";
<<<<<<< HEAD
import type { BarChartData, LineChartData } from "../nightfall/types";
=======
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb

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
<<<<<<< HEAD
  | "data_visualization"
=======
  | "default_data_visualization"
  | "default_ticker"
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
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
  aspectRatio?: string;  // "landscape" or "portrait"
  fontFamily?: string;
<<<<<<< HEAD
=======
  /** Index of this scene in the video — used to vary the background fly-in direction per scene. */
  sceneIndex?: number;
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
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
<<<<<<< HEAD
  // data_visualization (converted from *Rows in DefaultVideo)
  barChart?: BarChartData;
  lineChart?: LineChartData;
  /** Same shape as bar chart — bin labels + counts */
  histogram?: BarChartData;
=======
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
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
  // typography overrides
  titleFontSize?: number;
  descriptionFontSize?: number;
  // ending_socials
  socials?: SocialsMap;
  websiteLink?: string;
  showWebsiteButton?: boolean;
  /** Short label on the CTA pill above the link (from script / editor). */
  ctaButtonText?: string;
<<<<<<< HEAD
=======
  /** Optional multi-CTA array (up to 3). When present, renderer renders columns. */
  ctas?: Array<{ ctaButtonText?: string; websiteLink?: string; showWebsiteButton?: boolean }>;
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
}
