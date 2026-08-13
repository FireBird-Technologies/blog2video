import { DrawnTitle } from "./DrawnTitle";
import { DrawnTitleV2 } from "./DrawnTitleV2";
import { MarkerStory } from "./MarkerStory";
import { MarkerStoryV2 } from "./MarkerStoryV2";
import { StickFigureScene } from "./StickFigureScene";
import { StickFigureSceneV2 } from "./StickFigureSceneV2";
import { StatsFigures } from "./StatsFigures";
import { StatsChart } from "./StatsChart";
import { ComparisonThoughts } from "./ComparisonThoughts";
import { CountdownTimer } from "./countdowntimer";
import { HandwrittenEquation } from "./handwrittenequation";
import { SpeechBubbleDialogue } from "./speechbubbledialogue";
import { WhiteboardDataViz } from "./WhiteboardDataViz";
import { EndingSocials } from "./EndingSocials";
import { EndingSocialsV2 } from "./EndingSocialsV2";
import { WhiteboardTickerTable } from "./WhiteboardTickerTable";
import type { WhiteboardLayoutType, WhiteboardLayoutProps } from "../types";

export type { WhiteboardLayoutType, WhiteboardLayoutProps };

export const WHITEBOARD_LAYOUT_REGISTRY: Record<
  WhiteboardLayoutType,
  React.FC<WhiteboardLayoutProps>
> = {
  drawn_title: DrawnTitle,
  drawn_title__v2: DrawnTitleV2,
  marker_story: MarkerStory,
  marker_story__v2: MarkerStoryV2,
  stick_figure_scene: StickFigureScene,
  stick_figure_scene__v2: StickFigureSceneV2,
  stats_figures: StatsFigures,
  stats_chart: StatsChart,
  comparison: ComparisonThoughts,
  countdown_timer: CountdownTimer,
  handwritten_equation: HandwrittenEquation,
  speech_bubble_dialogue: SpeechBubbleDialogue,
  data_visualisation: WhiteboardDataViz,
  ending_socials: EndingSocials,
  ending_socials__v2: EndingSocialsV2,
  ticker_table: WhiteboardTickerTable,
};
