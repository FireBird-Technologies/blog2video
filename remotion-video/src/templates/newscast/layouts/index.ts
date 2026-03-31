import type { NewscastLayoutProps, NewscastLayoutType } from "./types";
import { ChapterBreak } from "./ChapterBreak";
import { CinematicTitle } from "./CinematicTitle";
import { DataVisualization } from "./DataVisualization";
import { GlassCode } from "./GlassCode";
import { GlassImage } from "./GlassImage";
import { GlassNarrative } from "./GlassNarrative";
import { GlassStack } from "./GlassStack";
import { GlowMetric } from "./GlowMetric";
import { KineticInsight } from "./KineticInsight";
import { SplitGlass } from "./SplitGlass";
import { EndingSocials } from "./EndingSocials";

import type React from "react";

export type { NewscastLayoutType, NewscastLayoutProps };

export const NEWSCAST_LAYOUT_REGISTRY: Record<
  NewscastLayoutType,
  React.FC<NewscastLayoutProps>
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
  data_visualization: DataVisualization,
  ending_socials: EndingSocials,
};

