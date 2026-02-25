import { MatrixTitle } from "./MatrixTitle";
import { TerminalText } from "./TerminalText";
import { GlitchPunch } from "./GlitchPunch";
import { DataStream } from "./DataStream";
import { CipherMetric } from "./CipherMetric";
import { ForkChoice } from "./ForkChoice";
import { MatrixImage } from "./MatrixImage";
import { Transmission } from "./Transmission";
import { Awakening } from "./Awakening";
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
};
