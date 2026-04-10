export type BlackswanLayoutType =
  | "droplet_intro"
  | "swan_title"
  | "neon_narrative"
  | "arc_features"
  | "pulse_metric"
  | "signal_split"
  | "dive_insight"
  | "wing_stack"
  | "reactor_code"
  | "flight_path"
  | "frequency_chart";

export interface BlackswanMetric {
  value: string;
  label: string;
  suffix?: string;
}

export interface BlackswanRow {
  label: string;
  value: string;
}

export interface BlackswanLayoutProps {
  title: string;
  narration: string;
  imageUrl?: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  fontFamily?: string;
  titleFontSize?: number;
  descriptionFontSize?: number;
  layoutType?: BlackswanLayoutType;
  items?: string[];
  metrics?: BlackswanMetric[];
  leftLabel?: string;
  rightLabel?: string;
  leftDescription?: string;
  rightDescription?: string;
  quote?: string;
  highlightWord?: string;
  codeLanguage?: string;
  codeLines?: string[];
  phrases?: string[];
  barChartRows?: BlackswanRow[];
}
