import type React from "react";
import type { EconomistLayoutProps, EconomistLayoutType } from "../types";
import { CoverReveal } from "./CoverReveal";
import { LeaderArticle } from "./LeaderArticle";
import { SectionDivider } from "./SectionDivider";
import { ChartLine } from "./ChartLine";
import { ChartBar } from "./ChartBar";
import { DataTable } from "./DataTable";
import { ProsCons } from "./ProsCons";
import { KeyIndicators } from "./KeyIndicators";
import { LeaderQuote } from "./LeaderQuote";
import { ImageFeature } from "./ImageFeature";
import { EndingSocials } from "./EndingSocials";

/** ECONOMIST_LAYOUT_REGISTRY — maps each layout id to its component. */
export const ECONOMIST_LAYOUT_REGISTRY: Record<
  EconomistLayoutType,
  React.FC<EconomistLayoutProps>
> = {
  cover_reveal: CoverReveal,
  leader_article: LeaderArticle,
  section_divider: SectionDivider,
  chart_line: ChartLine,
  chart_bar: ChartBar,
  data_table: DataTable,
  pros_cons: ProsCons,
  key_indicators: KeyIndicators,
  leader_quote: LeaderQuote,
  image_feature: ImageFeature,
  ending_socials: EndingSocials,
};

export {
  CoverReveal,
  LeaderArticle,
  SectionDivider,
  ChartLine,
  ChartBar,
  DataTable,
  ProsCons,
  KeyIndicators,
  LeaderQuote,
  ImageFeature,
  EndingSocials,
};
