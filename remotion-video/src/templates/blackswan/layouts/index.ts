import { ArcFeatures } from "./ArcFeatures";
import { DiveInsight } from "./DiveInsight";
import { DropletIntro } from "./DropletIntro";
import { FlightPath } from "./FlightPath";
import { FrequencyChart } from "./FrequencyChart";
import { NeonNarrative } from "./NeonNarrative";
import { PulseMetric } from "./PulseMetric";
import { ReactorCode } from "./ReactorCode";
import { SignalSplit } from "./SignalSplit";
import { SwanTitle } from "./SwanTitle";
import { WingStack } from "./WingStack";
import type { BlackswanLayoutProps, BlackswanLayoutType } from "../types";

export type { BlackswanLayoutType, BlackswanLayoutProps };

export const BLACKSWAN_LAYOUT_REGISTRY: Record<
  BlackswanLayoutType,
  React.FC<BlackswanLayoutProps>
> = {
  droplet_intro: DropletIntro,
  swan_title: SwanTitle,
  neon_narrative: NeonNarrative,
  arc_features: ArcFeatures,
  pulse_metric: PulseMetric,
  signal_split: SignalSplit,
  dive_insight: DiveInsight,
  wing_stack: WingStack,
  reactor_code: ReactorCode,
  flight_path: FlightPath,
  frequency_chart: FrequencyChart,
};
