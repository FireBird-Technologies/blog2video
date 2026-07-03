import type { SocialsMap, SocialsRow } from "../SocialIcons";

export type SakuraLayoutType =
  | "sakura_intro" | "sakura_section" | "sakura_quote" | "sakura_two_column_detail" | "sakura_stat_highlight" | "sakura_list_scene" | "sakura_text_narration" | "sakura_image_focus" | "sakura_chapter_transition" | "sakura_ending_socials";

export interface SceneLayoutProps {
  title: string;
  narration: string;
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  // sceneDurationInFrames is THIS scene's exact length — drive entrance/exit from it
  sceneDurationInFrames?: number;
  fontFamily?: string;
  titleFontSize?: number;
  descriptionFontSize?: number;
  // socials / website are used by the ending_socials layout, which
  // renders the shared <SocialIcons> component (../../SocialIcons)
  socials?: SocialsMap | SocialsRow[];
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
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
}
