import { ArcFeatures } from "./ArcFeatures";
<<<<<<< HEAD
=======
import { BlackswanDataViz } from "./BlackswanDataViz";
import { BlackswanTickerTable } from "./BlackswanTickerTable";
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
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
<<<<<<< HEAD
  ending_socials: EndingSocials,
=======
  data_visualisation: BlackswanDataViz,
  ending_socials: EndingSocials,
  ticker_table: BlackswanTickerTable,
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
};
