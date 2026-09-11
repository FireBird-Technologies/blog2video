import type { SocialsMap, SocialsRow } from "../SocialIcons";

export type SakuraLayoutType =
  // "ending_socials" is the canonical id the backend emits for the ending scene;
  // it is aliased to the sakura_ending_socials component in SAKURA_LAYOUT_REGISTRY.
  | "sakura_intro" | "sakura_intro__v2" | "sakura_section" | "sakura_quote" | "sakura_two_column_detail" | "sakura_stat_highlight" | "sakura_list_scene" | "sakura_text_narration" | "sakura_text_narration__v2" | "sakura_ending_socials" | "ending_socials" | "ending_socials__v2" | "sakura_data_visualization" | "sakura_ticker";
  // Visual variants — same props as their base, different composition, sharing
  // the base's layout_prop_schema entry in meta.json (see its layout_variants
  // key, the source of truth this union mirrors). IDs containing "__v" are
  // assigned automatically at generation time / switchable in the editor; the
  // layout planner only ever picks base IDs. "sakura_text_narration__v2" is
  // the "Lantern Grove" night-hanami treatment of sakura_text_narration;
  // "sakura_intro__v2" is the "Blooming Tree" treatment of sakura_intro (a
  // large procedural cherry tree grows behind the centered title);
  // "ending_socials__v2" is the "Tsukimi Farewell" moon-viewing treatment of
  // ending_socials. The base ending variant hangs off
  // "ending_socials" (the id the backend emits), NOT the legacy
  // "sakura_ending_socials" alias.

export interface SceneLayoutProps {
  title: string;
  narration: string;
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  // Stock footage: when videoUrl is set it REPLACES imageUrl in the same slot.
  // Framing reuses imageObjectPosition + imageZoom.
  videoUrl?: string;
  videoMuted?: boolean;
  videoVolume?: number;
  /** Clip length in frames, for <Loop>. Absent = play once. */
  videoDurationInFrames?: number;
  /** Start offset into the clip, in frames (the adjust-modal trim). */
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
  /** Derived at render time; true only when the user explicitly changed it. */
  titleFontSizeIsUserSet?: boolean;
  /** Derived at render time; true only when the user explicitly changed it. */
  descriptionFontSizeIsUserSet?: boolean;
  // socials / website are used by the ending_socials layout, which
  // renders the shared <SocialIcons> component (../../SocialIcons)
  socials?: SocialsMap | SocialsRow[];
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
  /** Optional multi-CTA array (up to 3), same shape as gridcraft's. Read via
   *  resolveCtas(), which falls back to the legacy single-CTA fields. */
  ctas?: Array<{ ctaButtonText?: string; websiteLink?: string; showWebsiteButton?: boolean }>;
  kanjiTitle?: string;
  romanTitle?: string;
  tagline?: string;
  chapterKanji?: string;
  chapterLabel?: string;
  headline?: string;
  body?: string;
  quote?: string;
  quoteRoman?: string;
  quoteTranslation?: string;
  attribution?: string;
  author?: string;
  leftHeadline?: string;
  leftBody?: string;
  rightHeadline?: string;
  rightBody?: string;
  stat?: string;
  statLabel?: string;
  context?: string;
  items?: string[];
  eyebrow?: string;
  caption?: string;
  subCaption?: string;
  imageFocusX?: number;
  imageFocusY?: number;
  chapterNumber?: string;
  chapterTitle?: string;
  brandName?: string;
  ctaText?: string;
  websiteUrl?: string;
  socialHandles?: string[];
  // Data-visualization (sakura_data_visualization) props
  chartTable?: { headers: string[]; rows: string[][] };
  chartType?: string;
  chartSummary?: string;
  subtitle?: string;
  yAxisLabel?: string;
  chartYAxisTicks?: string[];
  barPrimaryColor?: string;
  barSecondaryColor?: string;
  // Data-table (sakura_ticker) props
  tickerTable?: { headers: string[]; rows: string[][] };
  tickerTitle?: string;
  tickerFootnote?: string;
  tickerHighlightCol?: number;
}
