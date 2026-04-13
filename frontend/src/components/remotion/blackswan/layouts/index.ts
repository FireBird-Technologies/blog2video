import { ArcFeatures } from "./ArcFeatures";
import { DiveInsight } from "./DiveInsight";
import { DropletIntro } from "./DropletIntro";
import { EndingSocials } from "./EndingSocials";
import { FlightPath } from "./FlightPath";
import { NeonNarrative } from "./NeonNarrative";
import { PulseMetric } from "./PulseMetric";
import { ReactorCode } from "./ReactorCode";
import { SignalSplit } from "./SignalSplit";
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
  ending_socials: EndingSocials,
};
