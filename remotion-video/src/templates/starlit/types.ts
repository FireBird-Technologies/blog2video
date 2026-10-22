import type { SocialsMap, SocialsRow } from "../SocialIcons";

export type StarlitLayoutType =
  | "cosmic_hero" | "text_narration" | "split_image" | "stat_callout" | "ringed_planet" | "rocket_launch" | "quote_card" | "galaxy_deep_dive" | "data_visualisation" | "ticker_table" | "ending_socials";

export interface SceneLayoutProps {
  title: string;
  narration: string;
  imageUrl?: string;
  imageObjectPosition?: string;
  imageFocusX?: number;
  imageFocusY?: number;
  imageZoom?: number;
  // Stock footage replaces the still in the same Starlit media slot.
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
  // sceneDurationInFrames is THIS scene's exact length — drive entrance/exit from it
  sceneDurationInFrames?: number;
  fontFamily?: string;
  titleFontSize?: number;
  descriptionFontSize?: number;
  titleFontSizeIsUserSet?: boolean;
  descriptionFontSizeIsUserSet?: boolean;
  // socials / website are used by the ending_socials layout, which
  // renders the shared <SocialIcons> component (../../SocialIcons)
  socials?: SocialsMap | SocialsRow[];
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
  ctas?: Array<{ ctaButtonText?: string; websiteLink?: string; showWebsiteButton?: boolean | string }>;
  // Object-array props use the standard label/value pair shape so the editor can render both fields.
  /** @deprecated Eyebrow labels are no longer displayed. */
  eyebrow?: string;
  subtitle?: string;
  seed?: number;
  /** Optional short caption under a small attached image (e.g. the Ringed Planet plaque). */
  imageCaption?: string;
  /** Galaxy deep dive map shape (orbit, figure, cluster). Otherwise chosen from the seed. */
  mapStyle?: "orbit" | "spiral" | "figure" | "cluster";
  /** Optional: force one constellation map (web, figures, radial, river, mesh). Otherwise chosen from the seed. */
  constellationStyle?: "web" | "figures" | "radial" | "river" | "mesh";
  heading?: string;
  body?: string;
  textAlignment?: "split" | "left" | "center" | "right";
  ctaLabel?: string;
  statValue?: string;
  statSuffix?: string;
  descriptor?: string;
  items?: string[];
  quote?: string;
  attribution?: string;
  subPoints?: string[];
  nodes?: Array<{ label?: string; value?: string; sublabel?: string; children?: Array<string | { label?: string; text?: string }> }>;
  shape?: "orbit" | "spiral" | "constellation" | "cluster";
  caption?: string;
  brandName?: string;
  tagline?: string;
  socialHandles?: string[];
  // Shared real-table data contract used by the article extraction pipeline.
  chartTable?: { headers?: string[]; rows?: Array<Array<string | number>> };
  chartType?: "auto" | "line" | "bar" | "histogram";
  chartSummary?: string;
  chartYAxisTicks?: string[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  tickerTable?: { headers?: string[]; rows?: string[][] };
  tickerHighlightCol?: number;
}
