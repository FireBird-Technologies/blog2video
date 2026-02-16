import { CinematicTitle } from "./CinematicTitle";
import { GlassNarrative } from "./GlassNarrative";
import { GlowMetric } from "./GlowMetric";
import { GlassCode } from "./GlassCode";
import { KineticInsight } from "./KineticInsight";
import { GlassStack } from "./GlassStack";
import { SplitGlass } from "./SplitGlass";
import { ChapterBreak } from "./ChapterBreak";
import { GlassImage } from "./GlassImage";
import type { NightfallLayoutType, NightfallLayoutProps } from "../types";

export type { NightfallLayoutType, NightfallLayoutProps };

export const NIGHTFALL_LAYOUT_REGISTRY: Record<
  NightfallLayoutType,
  React.FC<NightfallLayoutProps>
> = {
  cinematic_title: CinematicTitle,
  glass_narrative: GlassNarrative,
  glow_metric: GlowMetric,
  glass_code: GlassCode,
  kinetic_insight: KineticInsight,
  glass_stack: GlassStack,
  split_glass: SplitGlass,
  chapter_break: ChapterBreak,
  glass_image: GlassImage,
};
