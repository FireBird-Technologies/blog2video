/** Spotlight template layout types. */
export type SpotlightLayoutType =
  | "impact_title"
  | "statement"
  | "word_punch"
  | "cascade_list"
  | "stat_stage"
  | "versus"
  | "spotlight_image"
  | "rapid_points"
  | "closer";

export interface SpotlightLayoutProps {
  title: string;
  narration: string;
  imageUrl?: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  // statement
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
}
