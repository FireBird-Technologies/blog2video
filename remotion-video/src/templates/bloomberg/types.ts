export type BloombergLayoutType =
  | "terminal_boot"
  | "terminal_narrative"
  | "terminal_chart"
  | "terminal_dashboard"
  | "terminal_ticker"
  | "terminal_table"
  | "terminal_split"
  | "terminal_dataviz"
  | "terminal_list"
  | "terminal_metric"
  | "terminal_profile"
  | "terminal_options"
  | "ending_socials";

export type BloombergChartType = "auto" | "bar" | "line" | "histogram";

export interface BloombergMetric {
  value: string;
  label: string;
  suffix?: string;
}

export interface BloombergSocial {
  platform: string;
  enabled: string | boolean;
  label?: string;
}

export interface BloombergLayoutProps {
  // Global scene fields
  title: string;
  narration: string;
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;

  // Global color/style
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  fontFamily?: string;

  // Font sizes
  titleFontSize?: number;
  descriptionFontSize?: number;

  // Layout type hint
  layoutType?: BloombergLayoutType;

  // Shared structured props
  items?: string[];
  metrics?: BloombergMetric[];

  // Raw OHLCV table for terminal_chart (editable in modal, parsed directly by component)
  ohlcvTable?: { headers: string[]; rows: string[][] };

  // terminal_chart — short symbol/tag shown in the indicator signals panel header (e.g. "AAPL US")
  ticker?: string;

  // terminal_split
  leftLabel?: string;
  rightLabel?: string;
  leftDescription?: string;
  rightDescription?: string;

  // terminal_dataviz
  chartType?: BloombergChartType;
  chartTable?: { headers?: string[]; rows?: Array<Array<string | number>> };

  // ending_socials
  socials?: BloombergSocial[] | Record<string, string>;
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
}

export interface BloombergSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: BloombergLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}
