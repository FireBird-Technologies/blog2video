import { ImpactTitle } from "./ImpactTitle";
import { Statement } from "./Statement";
import { WordPunch } from "./WordPunch";
import { CascadeList } from "./CascadeList";
import { StatStage } from "./StatStage";
import { Versus } from "./Versus";
import { SpotlightImage } from "./SpotlightImage";
import { RapidPoints } from "./RapidPoints";
import { SpotlightDataChart } from "./SpotlightDataChart";
import { SpotlightTable } from "./SpotlightTable";
import { Closer } from "./Closer";
import { EndingSocials } from "./EndingSocials";
import { ImpactTitleV2 } from "./ImpactTitleV2";
import { StatementV2 } from "./StatementV2";
import { EndingSocialsV2 } from "./EndingSocialsV2";
import type { SpotlightLayoutType, SpotlightLayoutProps } from "../types";

export type { SpotlightLayoutType, SpotlightLayoutProps };

export const SPOTLIGHT_LAYOUT_REGISTRY: Record<
  SpotlightLayoutType,
  React.FC<SpotlightLayoutProps>
> = {
  impact_title: ImpactTitle,
  statement: Statement,
  word_punch: WordPunch,
  cascade_list: CascadeList,
  stat_stage: StatStage,
  versus: Versus,
  spotlight_image: SpotlightImage,
  rapid_points: RapidPoints,
  spotlight_data: SpotlightDataChart,
  spotlight_table: SpotlightTable,
  closer: Closer,
  ending_socials: EndingSocials,

  // ── Visual variants — same props as their base, different composition ──
  impact_title__v2: ImpactTitleV2,
  statement__v2: StatementV2,
  ending_socials__v2: EndingSocialsV2,
};
