export type WhiteboardLayoutType =
  | "drawn_title"
  | "marker_story"
  | "stick_figure_scene"
  | "stats_figures"
  | "stats_chart"
  | "comparison"
  | "countdown_timer"
  | "handwritten_equation"
  | "speech_bubble_dialogue";

export interface WhiteboardStatItem {
  label: string;
  value: string;
}

export interface WhiteboardLayoutProps {
  title: string;
  narration: string;
  imageUrl?: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  titleFontSize?: number;
  descriptionFontSize?: number;
  /** Optional stats for stats_figures and stats_chart layouts */
  stats?: WhiteboardStatItem[];
  /** For comparison layout: thought cloud content for left and right stick figures */
  leftThought?: string;
  rightThought?: string;
}
