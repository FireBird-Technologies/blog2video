import { MagazineCover } from "./MagazineCover";
import { EditorialQuote } from "./EditorialQuote";
import { ByTheNumbers } from "./ByTheNumbers";
import { InterviewQa } from "./InterviewQa";
import { MagazineDataChart } from "./MagazineDataChart";
import { TimelineJourney } from "./TimelineJourney";
import { TextNarration } from "./TextNarration";
import { EndingSocials } from "./EndingSocials";
import { MagazineTickerTable } from "./MagazineTickerTable";
import { Colorblock } from "./Colorblock";
import { Feature } from "./Feature";
import { Comparison } from "./Comparison";
import { MagazineCoverV2 } from "./MagazineCoverV2";
import { FeatureV2 } from "./FeatureV2";
import { EndingSocialsV2 } from "./EndingSocialsV2";
import type { MagazineLayoutType, SceneLayoutProps } from "../types";

export type { MagazineLayoutType, SceneLayoutProps };

export const MAGAZINE_LAYOUT_REGISTRY: Record<MagazineLayoutType, React.FC<SceneLayoutProps>> = {
  magazine_cover: MagazineCover,
  editorial_quote: EditorialQuote,
  by_the_numbers: ByTheNumbers,
  interview_qa: InterviewQa,
  magazine_data_visualization: MagazineDataChart,
  timeline_journey: TimelineJourney,
  text_narration: TextNarration,
  ending_socials: EndingSocials,
  magazine_ticker: MagazineTickerTable,
  colorblock: Colorblock,
  feature: Feature,
  comparison: Comparison,

  // ── Visual variants — same props as their base, different composition ──
  magazine_cover__v2: MagazineCoverV2,
  feature__v2: FeatureV2,
  ending_socials__v2: EndingSocialsV2,
};
