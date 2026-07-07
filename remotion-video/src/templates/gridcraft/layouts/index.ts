import { BentoHero } from "./BentoHero";
import { BentoFeatures } from "./BentoFeatures";
import { BentoHighlight } from "./BentoHighlight";
import { Editorial } from "./Editorial";
import { KpiGrid } from "./KpiGrid";
import { BentoCompare } from "./BentoCompare";
import { BentoCode } from "./BentoCode";
import { PullQuote } from "./PullQuote";
import { BentoSteps } from "./BentoSteps";
<<<<<<< HEAD
import { EndingSocials } from "./EndingSocials";
=======
import { GridcraftDataViz } from "./GridcraftDataViz";
import { EndingSocials } from "./EndingSocials";
import { GridcraftTickerTable } from "./GridcraftTickerTable";
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
import { GridcraftLayoutType } from "../types";

export const GRIDCRAFT_LAYOUT_REGISTRY: Record<
  GridcraftLayoutType | string,
  React.FC<any>
> = {
  bento_hero: BentoHero,
  bento_features: BentoFeatures,
  bento_highlight: BentoHighlight,
  editorial_body: Editorial,
  kpi_grid: KpiGrid,
  bento_compare: BentoCompare,
  bento_code: BentoCode,
  pull_quote: PullQuote,
  bento_steps: BentoSteps,
<<<<<<< HEAD
  ending_socials: EndingSocials,
  
=======
  data_visualisation: GridcraftDataViz,
  ending_socials: EndingSocials,
  ticker_table: GridcraftTickerTable,

>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
  // Backward compatibility alias if needed
  intro: BentoHero,
};

export * from "./BentoHero";
export * from "./BentoFeatures";
export * from "./BentoHighlight";
export * from "./Editorial";
export * from "./KpiGrid";
export * from "./BentoCompare";
export * from "./BentoCode";
export * from "./PullQuote";
export * from "./BentoSteps";
<<<<<<< HEAD
=======
export * from "./GridcraftDataViz";
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
export * from "./EndingSocials";
