import { MosaicTitle } from "./MosaicTitle";
import { MosaicText } from "./MosaicText";
import { MosaicPunch } from "./MosaicPunch";
import { MosaicStream } from "./MosaicStream";
import { MosaicMetric } from "./MosaicMetric";
import { MosaicPhrases } from "./MosaicPhrases";
import { MosaicClose } from "./MosaicClose";
import { EndingSocials } from "./EndingSocials";
import type { MosaicLayoutType, MosaicLayoutProps } from "../types";

export type { MosaicLayoutType, MosaicLayoutProps };

export const MOSAIC_LAYOUT_REGISTRY: Record<
  MosaicLayoutType,
  React.FC<MosaicLayoutProps>
> = {
  mosaic_title: MosaicTitle,
  mosaic_text: MosaicText,
  mosaic_punch: MosaicPunch,
  mosaic_stream: MosaicStream,
  mosaic_metric: MosaicMetric,
  mosaic_phrases: MosaicPhrases,
  mosaic_close: MosaicClose,
  ending_socials: EndingSocials,
};
