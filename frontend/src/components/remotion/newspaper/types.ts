/**
 * Blog2Video — shared prop interface.
 * Intentionally compatible with WhiteboardLayoutProps so both
 * template families can share the same Remotion composition inputs.
 */
export interface BlogLayoutProps {
  title: string;
  narration?: string;

  /** Primary highlight/accent color. Default: #FFE34D (yellow marker) */
  accentColor?: string;
  /** Background color. Default: #FAFAF8 (warm paper) */
  bgColor?: string;
  /** Main text color. Default: #111111 */
  textColor?: string;

  aspectRatio?: "landscape" | "portrait";
  titleFontSize?: number;
  descriptionFontSize?: number;

  /**
   * Generic data array — each component interprets these differently:
   *  - NewsHeadline  : stats[0].value = author, stats[1].value = date
   *  - ArticleLead   : stats[0].value = pull-stat number, stats[0].label = pull-stat caption
   *  - DataSnapshot  : up to 4 items, each { value, label }
   *  - NewsTimeline  : each item { value = date string, label = event description }
   *  - FactCheck     : stats[0].label / stats[1].label = verdict labels
   */
  stats?: Array<{ label: string; value: string }>;

  /** FactCheck: left claim. ArticleLead: highlighted words (comma-separated). */
  leftThought?: string;
  /** FactCheck: right claim. */
  rightThought?: string;

  /** e.g. "Politics", "Technology", "Health" */
  category?: string;

  /** Optional image URL for hero (news_headline). */
  imageUrl?: string;
}

export type NewspaperLayoutType =
  | "news_headline"
  | "article_lead"
  | "pull_quote"
  | "data_snapshot"
  | "fact_check"
  | "news_timeline";
