/** Gridcraft template layout types. */
export type GridcraftLayoutType =
  | "bento_hero"
  | "bento_features"
  | "bento_highlight"
  | "editorial_body"
  | "kpi_grid"
  | "bento_compare"
  | "bento_code"
  | "pull_quote"
  | "bento_steps";

export interface DataPoint {
  label: string;
  value?: string;
  trend?: "up" | "down" | "neutral" | string;
  icon?: string;
  title?: string; // For features/compare
  description?: string; // For features/compare
  [key: string]: any;
}

export interface GridcraftLayoutProps {
  title: string;
  subtitle?: string; // Added
  narration: string;
  imageUrl?: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  
  // Shared data points (used by KPI, Steps)
  dataPoints?: DataPoint[];
  
  // Bento Features
  features?: { icon: string; label: string; description: string }[];
  highlightIndex?: number;

  // Bento Code
  codeSnippet?: string; // Legacy/Fallback
  codeLines?: string[]; // Backend standard
  codeLanguage?: string;

  // Bento Compare
  leftLabel?: string;
  rightLabel?: string;
  leftDescription?: string;
  rightDescription?: string;
  verdict?: string;

  // Bento Highlight
  mainPoint?: string;
  supportingFacts?: string[];

  // Pull Quote
  quote?: string;
  attribution?: string;
  highlightPhrase?: string;

  // Bento Steps steps
  steps?: { label: string; description?: string }[];

  // General
  version?: string;

  // Bento Hero - category/icon for small cells
  category?: string;
  icon?: string;
  // typography overrides
  titleFontSize?: number;
  descriptionFontSize?: number;
}
