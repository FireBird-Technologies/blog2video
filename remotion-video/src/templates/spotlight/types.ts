/** Spotlight template layout types. */
import type { SocialsMap } from "../SocialIcons";

export type SpotlightLayoutType =
  | "impact_title"
  | "statement"
  | "word_punch"
  | "cascade_list"
  | "stat_stage"
  | "versus"
  | "spotlight_image"
  | "rapid_points"
  | "closer"
  | "ending_socials";

export interface SpotlightLayoutProps {
  title: string;
  narration: string;
  imageUrl?: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  fontFamily?: string;
  // statement / impact_title
  highlightWord?: string;
  // word_punch
  word?: string;
  // cascade_list / glass_stack equivalent
  items?: string[];
  // stat_stage
  metrics?: { value: string; label: string; suffix?: string }[];
  // versus
  leftLabel?: string;
  rightLabel?: string;
  leftDescription?: string;
  rightDescription?: string;
  // rapid_points
  phrases?: string[];
  // closer
  highlightPhrase?: string;
  cta?: string;
  // typography overrides
  titleFontSize?: number;
  descriptionFontSize?: number;

  // ending_socials
  socials?: SocialsMap;
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
}
