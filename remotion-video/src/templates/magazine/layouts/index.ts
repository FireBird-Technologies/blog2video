import { MagazineCover } from "./MagazineCover";
import { FeatureSpread } from "./FeatureSpread";
import { EditorialQuote } from "./EditorialQuote";
import { ByTheNumbers } from "./ByTheNumbers";
import { InterviewQa } from "./InterviewQa";
import { ComparisonSpread } from "./ComparisonSpread";
import { MagazineDataChart } from "./MagazineDataChart";
import { TimelineJourney } from "./TimelineJourney";
import { ExpertSpotlight } from "./ExpertSpotlight";
import { TextNarration } from "./TextNarration";
import { EndingSocials } from "./EndingSocials";
import { MagazineTickerTable } from "./MagazineTickerTable";
import type { MagazineLayoutType, SceneLayoutProps } from "../types";

export type { MagazineLayoutType, SceneLayoutProps };

export const MAGAZINE_LAYOUT_REGISTRY: Record<MagazineLayoutType, React.FC<SceneLayoutProps>> = {
  magazine_cover: MagazineCover,
  feature_spread: FeatureSpread,
  editorial_quote: EditorialQuote,
  by_the_numbers: ByTheNumbers,
  interview_qa: InterviewQa,
  comparison_spread: ComparisonSpread,
  magazine_data_visualization: MagazineDataChart,
  timeline_journey: TimelineJourney,
  expert_spotlight: ExpertSpotlight,
  text_narration: TextNarration,
  ending_socials: EndingSocials,
  magazine_ticker: MagazineTickerTable,
};
