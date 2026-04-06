import type { SocialsMap } from "../SocialIcons";

export type MosaicLayoutType =
  | "mosaic_title"
  | "mosaic_text"
  | "mosaic_punch"
  | "mosaic_stream"
  | "mosaic_metric"
  | "mosaic_phrases"
  | "mosaic_close"
  | "ending_socials";

export interface MosaicLayoutProps {
  title: string;
  narration: string;
  imageUrl?: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  fontFamily?: string;
  highlightPhrase?: string;
  word?: string;
  items?: string[];
  metrics?: { value: string; label: string; suffix?: string }[];
  phrases?: string[];
  cta?: string;
  titleFontSize?: number;
  descriptionFontSize?: number;
  socials?: SocialsMap;
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
}
