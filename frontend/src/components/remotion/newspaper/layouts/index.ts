import { NewsHeadline } from "./NewsHeadline";
import { ArticleLead } from "./ArticleLead";
import { PullQuote } from "./PullQuote";
import { DataSnapshot } from "./DataSnapshot";
import { FactCheck } from "./FactCheck";
import { NewsTimeline } from "./NewsTimeline";
import { NewspaperDataViz } from "./NewspaperDataViz";
import { EndingSocials } from "./EndingSocials";
import { ExpertProfile } from "./ExpertProfile";
import { PerspectiveSplit } from "./PerspectiveSplit";
import { NewspaperTickerTable } from "./NewspaperTickerTable";
import type { NewspaperLayoutType, BlogLayoutProps } from "../types";

export type { NewspaperLayoutType, BlogLayoutProps };

export const NEWSPAPER_LAYOUT_REGISTRY: Record<
  NewspaperLayoutType,
  React.FC<BlogLayoutProps>
> = {
  news_headline: NewsHeadline,
  article_lead: ArticleLead,
  pull_quote: PullQuote,
  data_snapshot: DataSnapshot,
  fact_check: FactCheck,
  news_timeline: NewsTimeline,
  data_visualisation: NewspaperDataViz,
  ending_socials: EndingSocials,
  expert_profile: ExpertProfile,
  perspective_split: PerspectiveSplit,
  ticker_table: NewspaperTickerTable,
};
