/** Matrix template layout types. */
export type MatrixLayoutType =
  | "matrix_title"
  | "terminal_text"
  | "glitch_punch"
  | "data_stream"
  | "cipher_metric"
  | "fork_choice"
  | "matrix_image"
  | "transmission"
  | "awakening";

export interface MatrixLayoutProps {
  title: string;
  narration: string;
  imageUrl?: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  // terminal_text
  highlightWord?: string;
  // glitch_punch
  word?: string;
  // data_stream
  items?: string[];
  // cipher_metric
  metrics?: { value: string; label: string; suffix?: string }[];
  // fork_choice
  leftLabel?: string;
  rightLabel?: string;
  leftDescription?: string;
  rightDescription?: string;
  // transmission
  phrases?: string[];
  // awakening
  highlightPhrase?: string;
  cta?: string;
  // typography overrides
  titleFontSize?: number;
  descriptionFontSize?: number;
}
