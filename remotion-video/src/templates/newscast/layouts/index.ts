import type { NewscastLayoutProps, NewscastLayoutType } from "./types";
import { ChapterBreak } from "./ChapterBreak";
import { CinematicTitle } from "./CinematicTitle";
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
  opening: CinematicTitle,
  anchor_narrative: GlassNarrative,
  live_metrics_board: GlowMetric,
  briefing_code_panel: GlassCode,
  headline_insight: KineticInsight,
  story_stack: GlassStack,
  side_by_side_brief: SplitGlass,
  segment_break: ChapterBreak,
  field_image_focus: GlassImage,
  ending_socials: EndingSocials,
};

