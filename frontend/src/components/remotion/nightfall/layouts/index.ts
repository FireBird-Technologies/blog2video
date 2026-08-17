import { CinematicTitle } from "./CinematicTitle";
import { CinematicTitleV2 } from "./CinematicTitleV2";
import { GlassNarrative } from "./GlassNarrative";
import { GlassNarrativeV2 } from "./GlassNarrativeV2";
import { GlowMetric } from "./GlowMetric";
import { GlassCode } from "./GlassCode";
import { KineticInsight } from "./KineticInsight";
import { GlassStack } from "./GlassStack";
import { SplitGlass } from "./SplitGlass";
import { ChapterBreak } from "./ChapterBreak";
import { GlassImage } from "./GlassImage";
import { NightfallDataChart } from "./NightfallDataChart";
import { NightfallTable } from "./NightfallTable";
import { EndingSocials } from "./EndingSocials";
import { EndingSocialsV2 } from "./EndingSocialsV2";
import type { NightfallLayoutType, NightfallLayoutProps } from "../types";

export type { NightfallLayoutType, NightfallLayoutProps };

export const NIGHTFALL_LAYOUT_REGISTRY: Record<
  NightfallLayoutType,
  React.FC<NightfallLayoutProps>
> = {
  cinematic_title: CinematicTitle,
  cinematic_title__v2: CinematicTitleV2,
  glass_narrative: GlassNarrative,
  glass_narrative__v2: GlassNarrativeV2,
  glow_metric: GlowMetric,
  glass_code: GlassCode,
  kinetic_insight: KineticInsight,
  glass_stack: GlassStack,
  split_glass: SplitGlass,
  chapter_break: ChapterBreak,
  glass_image: GlassImage,
  nightfall_data_visualization: NightfallDataChart,
  nightfall_ticker: NightfallTable,
  ending_socials: EndingSocials,
  ending_socials__v2: EndingSocialsV2,
};
