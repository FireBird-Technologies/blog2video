import { BentoHero } from "./BentoHero";
import { BentoFeatures } from "./BentoFeatures";
import { BentoHighlight } from "./BentoHighlight";
import { EditorialBody } from "./EditorialBody";
import { KpiGrid } from "./KpiGrid";
import { BentoCompare } from "./BentoCompare";
import { BentoCode } from "./BentoCode";
import { PullQuote } from "./PullQuote";
import { BentoSteps } from "./BentoSteps";
import type { GridcraftLayoutType, GridcraftLayoutProps } from "../types";

export type { GridcraftLayoutType, GridcraftLayoutProps };

export const GRIDCRAFT_LAYOUT_REGISTRY: Record<
  GridcraftLayoutType,
  React.FC<GridcraftLayoutProps>
> = {
  bento_hero: BentoHero,
  bento_features: BentoFeatures,
  bento_highlight: BentoHighlight,
  editorial_body: EditorialBody,
  kpi_grid: KpiGrid,
  bento_compare: BentoCompare,
  bento_code: BentoCode,
  pull_quote: PullQuote,
  bento_steps: BentoSteps,
};
