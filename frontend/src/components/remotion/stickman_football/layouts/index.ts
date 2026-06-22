import { KickoffTitle } from "./KickoffTitle";
import { PassingPlay } from "./PassingPlay";
import { FreekickSetup } from "./FreekickSetup";
import { GoalMoment } from "./GoalMoment";
import { MatchStats } from "./MatchStats";
import { InjuryBreak } from "./InjuryBreak";
import { BallControl } from "./BallControl";
import { TextNarration } from "./TextNarration";
import { EndingSocials } from "./EndingSocials";
import { FootballDataViz } from "./FootballDataViz";
import { FootballTicker } from "./FootballTicker";
import { CornerKick } from "./CornerKick";
import type { StickmanFootballLayoutType, SceneLayoutProps } from "../types";

export type { StickmanFootballLayoutType, SceneLayoutProps };

export const STICKMAN_FOOTBALL_LAYOUT_REGISTRY: Record<StickmanFootballLayoutType, React.FC<SceneLayoutProps>> = {
  kickoff_title: KickoffTitle,
  passing_play: PassingPlay,
  freekick_setup: FreekickSetup,
  goal_moment: GoalMoment,
  match_stats: MatchStats,
  injury_break: InjuryBreak,
  ball_control: BallControl,
  text_narration: TextNarration,
  ending_socials: EndingSocials,
  football_data_viz: FootballDataViz,
  football_ticker: FootballTicker,
  corner_kick: CornerKick,
};
