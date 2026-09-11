import { ArcFeatures } from "./ArcFeatures";
import { BlackswanDataViz } from "./BlackswanDataViz";
import { BlackswanTickerTable } from "./BlackswanTickerTable";
import { DiveInsight } from "./DiveInsight";
import { DropletIntro } from "./DropletIntro";
import { EndingSocials } from "./EndingSocials";
import { FlightPath } from "./FlightPath";
import { NeonNarrative } from "./NeonNarrative";
import { PulseMetric } from "./PulseMetric";
import { ReactorCode } from "./ReactorCode";
import { SignalSplit } from "./SignalSplit";
import { DropletIntroV2 } from "./DropletIntroV2";
import { NeonNarrativeV2 } from "./NeonNarrativeV2";
import { ArcFeaturesV2 } from "./ArcFeaturesV2";
import type { BlackswanLayoutProps, BlackswanLayoutType } from "../types";

export type { BlackswanLayoutType, BlackswanLayoutProps };

export const BLACKSWAN_LAYOUT_REGISTRY: Record<
  BlackswanLayoutType,
  React.FC<BlackswanLayoutProps>
> = {
  droplet_intro: DropletIntro,
  neon_narrative: NeonNarrative,
  arc_features: ArcFeatures,
  pulse_metric: PulseMetric,
  signal_split: SignalSplit,
  dive_insight: DiveInsight,
  reactor_code: ReactorCode,
  flight_path: FlightPath,
  data_visualisation: BlackswanDataViz,
  ending_socials: EndingSocials,
  ticker_table: BlackswanTickerTable,

  // ── Visual variants — same props as their base, different composition ──
  droplet_intro__v2: DropletIntroV2,
  neon_narrative__v2: NeonNarrativeV2,
  arc_features__v2: ArcFeaturesV2,
};
