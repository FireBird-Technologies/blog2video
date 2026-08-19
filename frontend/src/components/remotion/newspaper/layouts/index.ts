import { NewsHeadline } from "./NewsHeadline";
import { NewsHeadlineV2 } from "./NewsHeadlineV2";
import { NewsHeadlineV3 } from "./NewsHeadlineV3";
import { ArticleLead } from "./ArticleLead";
import { ArticleLeadV2 } from "./ArticleLeadV2";
import { ArticleLeadV3 } from "./ArticleLeadV3";
import { PullQuote } from "./PullQuote";
import { PullQuoteV2 } from "./PullQuoteV2";
import { DataSnapshot } from "./DataSnapshot";
import { FactCheck } from "./FactCheck";
import { NewsTimeline } from "./NewsTimeline";
import { NewspaperDataViz } from "./NewspaperDataViz";
import { EndingSocials } from "./EndingSocials";
import { EndingSocialsV2 } from "./EndingSocialsV2";
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
  news_headline__v2: NewsHeadlineV2,
  news_headline__v3: NewsHeadlineV3,
  article_lead: ArticleLead,
  article_lead__v2: ArticleLeadV2,
  article_lead__v3: ArticleLeadV3,
  pull_quote: PullQuote,
  pull_quote__v2: PullQuoteV2,
  data_snapshot: DataSnapshot,
  fact_check: FactCheck,
  news_timeline: NewsTimeline,
  data_visualisation: NewspaperDataViz,
  ending_socials: EndingSocials,
  ending_socials__v2: EndingSocialsV2,
  expert_profile: ExpertProfile,
  perspective_split: PerspectiveSplit,
  ticker_table: NewspaperTickerTable,
};
