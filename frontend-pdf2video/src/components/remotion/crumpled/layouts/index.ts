import type React from "react";
import type { SceneLayoutProps } from "../types";
import { PaperHero } from "./PaperHero";
import { SketchNarration } from "./SketchNarration";
import { TapedImage } from "./TapedImage";
import { PencilStat } from "./PencilStat";
import { StickyList } from "./StickyList";
import { TornQuote } from "./TornQuote";
import { FoldComparison } from "./FoldComparison";
import { DataVisualisation } from "./DataVisualisation";
import { EndingSocials } from "./EndingSocials";

export const CRUMPLED_LAYOUT_REGISTRY: Record<string, React.FC<SceneLayoutProps>> = {
  paper_hero: PaperHero,
  sketch_narration: SketchNarration,
  taped_image: TapedImage,
  pencil_stat: PencilStat,
  sticky_list: StickyList,
  torn_quote: TornQuote,
  fold_comparison: FoldComparison,
  data_visualisation: DataVisualisation,
  ending_socials: EndingSocials,
};
