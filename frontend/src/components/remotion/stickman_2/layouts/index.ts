import { ChalkTitle } from "./ChalkTitle";
import { NightWalk } from "./NightWalk";
import { ShootingStar } from "./ShootingStar";
import { ConstellationStats } from "./ConstellationStats";
import { MoonphaseChart } from "./MoonphaseChart";
import { ShadowComparison } from "./ShadowComparison";
import { SignalFireScene } from "./SignalFireScene";
import { NeonCountdown } from "./NeonCountdown";
import { LanternDialogue } from "./LanternDialogue";
import { EndingSocials } from "./EndingSocials";
import type { Stickman2LayoutType, SceneLayoutProps } from "../types";

export type { Stickman2LayoutType, SceneLayoutProps };

export const STICKMAN_2_LAYOUT_REGISTRY: Record<Stickman2LayoutType, React.FC<SceneLayoutProps>> = {
  chalk_title: ChalkTitle,
  night_walk: NightWalk,
  shooting_star: ShootingStar,
  constellation_stats: ConstellationStats,
  moonphase_chart: MoonphaseChart,
  shadow_comparison: ShadowComparison,
  signal_fire_scene: SignalFireScene,
  neon_countdown: NeonCountdown,
  lantern_dialogue: LanternDialogue,
  ending_socials: EndingSocials,
};
