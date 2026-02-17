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

export interface GridcraftLayoutProps {
  title: string;
  narration: string;
  imageUrl?: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  // bento_features
  features?: { icon: string; label: string; description: string }[];
  highlightIndex?: number;
  // bento_highlight
  mainPoint?: string;
  supportingFacts?: string[];
  // kpi_grid
  dataPoints?: { label: string; value: string; trend?: string }[];
  // bento_compare
  leftLabel?: string;
  rightLabel?: string;
  leftDescription?: string;
  rightDescription?: string;
  verdict?: string;
  // bento_code
  codeLines?: string[];
  codeLanguage?: string;
  description?: string;
  // pull_quote
  quote?: string;
  attribution?: string;
  highlightPhrase?: string;
  // bento_steps
  steps?: { label: string; description?: string }[];
}
