import { MatrixTitle } from "./MatrixTitle";
import { TerminalText } from "./TerminalText";
import { GlitchPunch } from "./GlitchPunch";
import { DataStream } from "./DataStream";
import { CipherMetric } from "./CipherMetric";
import { ForkChoice } from "./ForkChoice";
import { MatrixImage } from "./MatrixImage";
import { Transmission } from "./Transmission";
import { Awakening } from "./Awakening";
<<<<<<< HEAD
=======
import { MatrixDataChart } from "./MatrixDataChart";
import { MatrixTicker } from "./MatrixTicker";
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
import { EndingSocials } from "./EndingSocials";
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
<<<<<<< HEAD
=======
  matrix_data: MatrixDataChart,
  matrix_ticker: MatrixTicker,
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
  ending_socials: EndingSocials,
};
