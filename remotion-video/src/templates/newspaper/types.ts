/**
 * Newspaper template — layout prop interface and layout type.
 */
import type { SocialsMap } from "../SocialIcons";
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

  /** Project-level font override; when set, used for all text in the layout. */
  fontFamily?: string;

  // ending_socials
  socials?: SocialsMap;
  websiteLink?: string;
  showWebsiteButton?: boolean;
}

export type NewspaperLayoutType =
  | "news_headline"
  | "article_lead"
  | "pull_quote"
  | "data_snapshot"
  | "fact_check"
  | "news_timeline"
  | "ending_socials";
