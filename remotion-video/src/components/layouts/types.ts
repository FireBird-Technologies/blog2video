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
  | "timeline";

export interface SceneLayoutProps {
  title: string;
  narration: string;
  imageUrl?: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
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
}
