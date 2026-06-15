import type { SocialsMap } from "../SocialIcons";

export type MosaicLayoutType =
  | "mosaic_title"
  | "mosaic_text"
  | "mosaic_punch"
  | "mosaic_stream"
  | "mosaic_metric"
  | "mosaic_phrases"
  | "mosaic_close"
  | "mosaic_data_visualization"
  | "mosaic_ticker"
  | "ending_socials";

export interface MosaicLayoutProps {
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
  highlightPhrase?: string;
  word?: string;
  items?: string[];
  metrics?: { value: string; label: string; suffix?: string }[];
  phrases?: string[];
  cta?: string;
  titleFontSize?: number;
  descriptionFontSize?: number;
  socials?: SocialsMap;
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
  /** Optional multi-CTA array (up to 3). When present, renderer renders columns. */
  ctas?: Array<{ ctaButtonText?: string; websiteLink?: string; showWebsiteButton?: boolean }>;
  // Mosaic tile customization
  mosaicPattern?: "linear" | "diagonal" | "center" | "scatter";
  mosaicIntensity?: number;
  mosaicTileSize?: number;
  mosaicTileGap?: number;
  // Data chart props (mosaic_data_visualization / mosaic_data_visualization_bar / mosaic_data_visualization_histogram)
  chartTable?: { headers: string[]; rows: string[][] };
  chartType?: string;
  chartSummary?: string;
  subtitle?: string;
  yAxisLabel?: string;
  chartYAxisTicks?: string[];
  barPrimaryColor?: string;
  barSecondaryColor?: string;
  // Data table props (mosaic_ticker)
  tickerTable?: { headers: string[]; rows: string[][] };
  tickerTitle?: string;
  tickerFootnote?: string;
  tickerHighlightCol?: number;
}
