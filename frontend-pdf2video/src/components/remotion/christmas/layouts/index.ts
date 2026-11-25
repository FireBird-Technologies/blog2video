import type React from "react";
import type { SceneLayoutProps } from "../types";
import { SantaHero } from "./SantaHero";
import { SnowyNarration } from "./SnowyNarration";
import { FrostedWindow } from "./FrostedWindow";
import { GiftStat } from "./GiftStat";
import { TreeList } from "./TreeList";
import { LetterQuote } from "./LetterQuote";
import { SnowCompare } from "./SnowCompare";
import { SnowballSteps } from "./SnowballSteps";
import { DataVisualisation } from "./DataVisualisation";
import { EndingSocials } from "./EndingSocials";

export const CHRISTMAS_LAYOUT_REGISTRY: Record<string, React.FC<SceneLayoutProps>> = {
  santa_hero: SantaHero,
  snowy_narration: SnowyNarration,
  frosted_window: FrostedWindow,
  gift_stat: GiftStat,
  tree_list: TreeList,
  letter_quote: LetterQuote,
  snow_compare: SnowCompare,
  snowball_steps: SnowballSteps,
  data_visualisation: DataVisualisation,
  ending_socials: EndingSocials,
};
