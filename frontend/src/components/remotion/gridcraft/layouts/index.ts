import { BentoHero } from "./BentoHero";
import { BentoFeatures } from "./BentoFeatures";
import { BentoHighlight } from "./BentoHighlight";
import { Editorial } from "./Editorial";
import { KpiGrid } from "./KpiGrid";
import { BentoCompare } from "./BentoCompare";
import { BentoCode } from "./BentoCode";
import { PullQuote } from "./PullQuote";
import { BentoSteps } from "./BentoSteps";
import { GridcraftDataViz } from "./GridcraftDataViz";
import { EndingSocials } from "./EndingSocials";
import { GridcraftTickerTable } from "./GridcraftTickerTable";
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
  data_visualisation: GridcraftDataViz,
  ending_socials: EndingSocials,
  ticker_table: GridcraftTickerTable,

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
export * from "./GridcraftDataViz";
export * from "./EndingSocials";
