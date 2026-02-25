/**
 * Newspaper template — layout prop interface and layout type.
 */
export interface BlogLayoutProps {
  title: string;
  narration?: string;
  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  aspectRatio?: "landscape" | "portrait";
  titleFontSize?: number;
  descriptionFontSize?: number;
  stats?: Array<{ label: string; value: string }>;
  leftThought?: string;
  rightThought?: string;
  category?: string;
  imageUrl?: string;
}

export type NewspaperLayoutType =
  | "news_headline"
  | "article_lead"
  | "pull_quote"
  | "data_snapshot"
  | "fact_check"
  | "news_timeline";
