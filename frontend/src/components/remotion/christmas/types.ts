import type { SocialsMap, SocialsRow } from "../SocialIcons";

export type ChristmasLayoutType =
  | "santa_hero"
  | "snowy_narration"
  | "frosted_window"
  | "gift_stat"
  | "tree_list"
  | "letter_quote"
  | "snow_compare"
  | "snowball_steps"
  | "data_visualisation"
  | "ending_socials";

export interface SceneLayoutProps {
  /** The scene's Title — every layout's heading. */
  title: string;
  /**
   * Legacy mixed on-screen field (display_text, falling back to the VOICEOVER script).
   * Layouts must not render it — use `displayText`.
   */
  narration: string;
  /** The scene's Display text — the on-screen copy under the title. Empty = none. */
  displayText: string;
  imageUrl?: string;
  imageObjectPosition?: string;
  imageFocusX?: number;
  imageFocusY?: number;
  imageZoom?: number;
  // Stock footage replaces the still in the same media slot.
  videoUrl?: string;
  videoMuted?: boolean;
  videoVolume?: number;
  /** Clip length in frames, used to loop short clips. */
  videoDurationInFrames?: number;
  /** Trim offset into the clip, in frames. */
  videoStartInFrames?: number;
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  /** This scene's exact length in frames (its built-in exit plays in the last frames). */
  sceneDurationInFrames?: number;
  fontFamily?: string;
  titleFontSize?: number;
  descriptionFontSize?: number;
  titleFontSizeIsUserSet?: boolean;
  descriptionFontSizeIsUserSet?: boolean;
  seed?: number;
  /** Per-scene variant (the scene id) so no two scenes share the same snowfall. */
  sceneVariant?: number;
  /** santa_hero only, hidden (not in meta / editor): sleigh-team size multiplier used by the template poster. */
  sleighScale?: number;

  // Title and on-screen copy are NOT layout props: every layout reads the scene's
  // own `title` and `displayText` above.
  // frosted_window
  imageCaption?: string;
  // gift_stat — 2 to 4 numbers
  stats?: Array<{ value?: string; label?: string }>;
  // tree_list
  items?: string[];
  // letter_quote
  quote?: string;
  attribution?: string;
  // snow_compare — 3–4 opposing points per side (legacy leftText/rightText are split into sentences)
  leftLabel?: string;
  leftPoints?: string[];
  rightLabel?: string;
  rightPoints?: string[];
  leftText?: string;
  rightText?: string;
  // snowball_steps
  steps?: Array<{ label?: string; text?: string }>;

  // data_visualisation — shared real-table data contract
  chartTable?: { headers?: string[]; rows?: Array<Array<string | number>> };
  chartType?: "auto" | "line" | "bar" | "histogram";
  chartYAxisTicks?: string[];
  xAxisLabel?: string;
  yAxisLabel?: string;

  // ending_socials — uses the shared <SocialIcons> helpers
  socials?: SocialsMap | SocialsRow[];
  websiteLink?: string;
  showWebsiteButton?: boolean | string;
  ctaButtonText?: string;
  ctas?: Array<{ ctaButtonText?: string; websiteLink?: string; showWebsiteButton?: boolean | string }>;
}
