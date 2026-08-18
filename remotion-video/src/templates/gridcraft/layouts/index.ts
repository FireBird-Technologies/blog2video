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
import { BentoHeroV2 } from "./BentoHeroV2";
import { EditorialBodyV2 } from "./EditorialBodyV2";
import { EndingSocialsV2 } from "./EndingSocialsV2";
import { GridcraftLayoutType } from "../types";

/**
 * Exhaustive over `GridcraftLayoutType` ON PURPOSE — do not re-add a `| string`
 * index signature. With one, a layout id missing from this map compiled fine and
 * silently rendered `editorial_body` (the composition's fallback), which is how a
 * visual variant can ship looking like the wrong scene. Closed, TypeScript fails the
 * build until every union member has a component.
 */
export const GRIDCRAFT_LAYOUT_REGISTRY: Record<
  GridcraftLayoutType,
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

  // Visual variants — same props as their base, different composition.
  bento_hero__v2: BentoHeroV2,
  editorial_body__v2: EditorialBodyV2,
  ending_socials__v2: EndingSocialsV2,

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
