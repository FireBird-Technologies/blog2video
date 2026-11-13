import type { SocialsMap, SocialsRow } from "../SocialIcons";

export type CrumpledLayoutType =
  | "paper_hero"
  | "sketch_narration"
  | "taped_image"
  | "pencil_stat"
  | "sticky_list"
  | "torn_quote"
  | "fold_comparison"
  | "data_visualisation"
  | "ending_socials";

export interface SceneLayoutProps {
  title: string;
  narration: string;
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
  /**
   * Frames to hold the layout's entrance back by. Unused by the composition now that
   * each layout owns its exit (scenes play back to back); kept for callers that set it.
   */
  enterDelayFrames?: number;
  fontFamily?: string;
  titleFontSize?: number;
  descriptionFontSize?: number;
  titleFontSizeIsUserSet?: boolean;
  descriptionFontSizeIsUserSet?: boolean;
  seed?: number;
  /** Per-scene variant (the scene id) so every scene's sheet is crumpled differently. */
  paperVariant?: number;

  // paper_hero
  subtitle?: string;
  // sketch_narration / taped_image
  heading?: string;
  body?: string;
  imageCaption?: string;
  // pencil_stat — 1 to 3 stats; the single statValue/statSuffix/descriptor form is the legacy fallback.
  stats?: Array<{ value?: string; label?: string }>;
  statValue?: string;
  statSuffix?: string;
  descriptor?: string;
  // sticky_list
  items?: string[];
  // torn_quote
  quote?: string;
  attribution?: string;
  // fold_comparison
  leftLabel?: string;
  leftText?: string;
  rightLabel?: string;
  rightText?: string;

  // data_visualisation — shared real-table data contract
  chartTable?: { headers?: string[]; rows?: Array<Array<string | number>> };
  chartType?: "auto" | "line" | "bar" | "histogram";
  chartSummary?: string;
  chartYAxisTicks?: string[];
  xAxisLabel?: string;
  yAxisLabel?: string;

  // ending_socials — uses the shared <SocialIcons> helpers
  socials?: SocialsMap | SocialsRow[];
  websiteLink?: string;
  showWebsiteButton?: boolean | string;
  ctaButtonText?: string;
  ctas?: Array<{ ctaButtonText?: string; websiteLink?: string; showWebsiteButton?: boolean | string }>;
  brandName?: string;
  tagline?: string;
}
