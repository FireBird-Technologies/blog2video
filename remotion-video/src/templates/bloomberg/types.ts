export type BloombergLayoutType =
  | "terminal_boot"
  | "terminal_narrative"
  | "terminal_chart"
  | "terminal_dashboard"
  | "terminal_ticker"
  | "terminal_table"
  | "terminal_split"
  | "terminal_quote"
  | "terminal_list"
  | "terminal_metric"
  | "terminal_profile"
  | "terminal_options"
  | "ending_socials";

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

  // terminal_split
  leftLabel?: string;
  rightLabel?: string;
  leftDescription?: string;
  rightDescription?: string;

  // terminal_quote
  quote?: string;
  highlightWord?: string;

  // ending_socials
  socials?: BloombergSocial[] | Record<string, string>;
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
}
