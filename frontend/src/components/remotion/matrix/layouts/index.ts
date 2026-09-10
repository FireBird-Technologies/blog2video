import { MatrixTitle } from "./MatrixTitle";
import { TerminalText } from "./TerminalText";
import { GlitchPunch } from "./GlitchPunch";
import { DataStream } from "./DataStream";
import { CipherMetric } from "./CipherMetric";
import { ForkChoice } from "./ForkChoice";
import { MatrixImage } from "./MatrixImage";
import { Transmission } from "./Transmission";
import { Awakening } from "./Awakening";
import { MatrixDataChart } from "./MatrixDataChart";
import { MatrixTicker } from "./MatrixTicker";
import { EndingSocials } from "./EndingSocials";
import { MatrixTitleV2 } from "./MatrixTitleV2";
import { CipherMetricV2 } from "./CipherMetricV2";
import { TransmissionV2 } from "./TransmissionV2";
import { AwakeningV2 } from "./AwakeningV2";
import { EndingSocialsV2 } from "./EndingSocialsV2";
import type { MatrixLayoutType, MatrixLayoutProps } from "../types";

export type { MatrixLayoutType, MatrixLayoutProps };

export const MATRIX_LAYOUT_REGISTRY: Record<
  MatrixLayoutType,
  React.FC<MatrixLayoutProps>
> = {
  matrix_title: MatrixTitle,
  terminal_text: TerminalText,
  glitch_punch: GlitchPunch,
  data_stream: DataStream,
  cipher_metric: CipherMetric,
  fork_choice: ForkChoice,
  matrix_image: MatrixImage,
  transmission: Transmission,
  awakening: Awakening,
  matrix_data: MatrixDataChart,
  matrix_ticker: MatrixTicker,
  ending_socials: EndingSocials,

  // ── Visual variants — same props as their base, different composition ──
  matrix_title__v2: MatrixTitleV2,
  cipher_metric__v2: CipherMetricV2,
  transmission__v2: TransmissionV2,
  awakening__v2: AwakeningV2,
  ending_socials__v2: EndingSocialsV2,
};
