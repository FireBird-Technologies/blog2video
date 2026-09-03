import { CinematicTitle } from "./CinematicTitle";
import { GlassNarrative } from "./GlassNarrative";
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
import type { NightfallLayoutType, NightfallLayoutProps } from "../types";
import { withAutoFitLayout } from "../components/useFitText";

export type { NightfallLayoutType, NightfallLayoutProps };

export const NIGHTFALL_LAYOUT_REGISTRY: Record<
  NightfallLayoutType,
  React.FC<NightfallLayoutProps>
> = {
  cinematic_title: withAutoFitLayout(CinematicTitle, { title: { portrait: 113, landscape: 140 }, description: { portrait: 43, landscape: 36 } }),
  glass_narrative: withAutoFitLayout(GlassNarrative, { title: { portrait: 76, landscape: 63 }, description: { portrait: 43, landscape: 36 } }),
  glow_metric: withAutoFitLayout(GlowMetric, { title: { portrait: 86, landscape: 50 }, description: { portrait: 42, landscape: 30 } }),
  glass_code: withAutoFitLayout(GlassCode, { title: { portrait: 51, landscape: 55 }, description: 22 }),
  kinetic_insight: withAutoFitLayout(KineticInsight, { title: { portrait: 169, landscape: 112 }, description: { portrait: 83, landscape: 92 } }),
  glass_stack: withAutoFitLayout(GlassStack, { title: { portrait: 81, landscape: 71 }, description: { portrait: 44, landscape: 40 } }),
  split_glass: withAutoFitLayout(SplitGlass, { title: { portrait: 65, landscape: 61 }, description: { portrait: 35, landscape: 28 } }),
  chapter_break: withAutoFitLayout(ChapterBreak, { title: { portrait: 36, landscape: 55 }, description: { portrait: 18, landscape: 40 } }),
  glass_image: withAutoFitLayout(GlassImage, { title: { portrait: 78, landscape: 64 }, description: { portrait: 42, landscape: 35 } }),
  nightfall_data_visualization: withAutoFitLayout(NightfallDataChart, { title: { portrait: 64, landscape: 58 }, description: { portrait: 32, landscape: 28 } }),
  nightfall_ticker: withAutoFitLayout(NightfallTable, { title: { portrait: 58, landscape: 50 }, description: { portrait: 26, landscape: 22 } }),
  ending_socials: withAutoFitLayout(EndingSocials, { title: { portrait: 88, landscape: 72 }, description: { portrait: 32, landscape: 30 } }),
};
