export type NightfallLayoutType =
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

// Chart data types
export interface BarChartData {
  labels: string[];
  values: number[];
  colors?: string[];
}

export interface LineChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    values: number[];
    color?: string;
  }>;
}

export interface PieChartData {
  labels: string[];
  values: number[];
  colors?: string[];
}

export interface NightfallLayoutProps {
  title: string;
  narration: string;
  imageUrl?: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  metrics?: { value: string; label: string; suffix?: string }[];
  codeLines?: string[];
  codeLanguage?: string;
  quote?: string;
  highlightWord?: string;
  items?: string[];
  leftLabel?: string;
  rightLabel?: string;
  leftDescription?: string;
  rightDescription?: string;
  chapterNumber?: number;
  subtitle?: string;
  // data visualization charts
  barChart?: BarChartData;
  lineChart?: LineChartData;
  pieChart?: PieChartData;
}
