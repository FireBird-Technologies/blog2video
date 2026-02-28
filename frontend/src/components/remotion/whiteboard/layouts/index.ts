import { DrawnTitle } from "./DrawnTitle";
import { MarkerStory } from "./MarkerStory";
import { StickFigureScene } from "./StickFigureScene";
import { StatsFigures } from "./StatsFigures";
import { StatsChart } from "./StatsChart";
import { ComparisonThoughts } from "./ComparisonThoughts";
import { CountdownTimer } from "./countdowntimer";
import { HandwrittenEquation } from "./handwrittenequation";
import { SpeechBubbleDialogue } from "./speechbubbledialogue";
import type { WhiteboardLayoutType, WhiteboardLayoutProps } from "../types";

export type { WhiteboardLayoutType, WhiteboardLayoutProps };

export const WHITEBOARD_LAYOUT_REGISTRY: Record<
  WhiteboardLayoutType,
  React.FC<WhiteboardLayoutProps>
> = {
  drawn_title: DrawnTitle,
  marker_story: MarkerStory,
  stick_figure_scene: StickFigureScene,
  stats_figures: StatsFigures,
  stats_chart: StatsChart,
  comparison: ComparisonThoughts,
  countdown_timer: CountdownTimer,
  handwritten_equation: HandwrittenEquation,
  speech_bubble_dialogue: SpeechBubbleDialogue,
};
