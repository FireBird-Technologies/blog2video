/**
 * Chronicle template — old history book / medieval tome aesthetic.
 * Types mirror the shape used by other templates (see newspaper/types.ts).
 */
import type { SocialsMap } from "../SocialIcons";

export type ChronicleLayoutType =
  | "book_open"
  | "parchment_scroll"
  | "chapter_plate"
  | "illuminated_quote"
  | "ledger_stats"
  | "versus_folio"
  | "chronicle_timeline"
  | "map_reveal"
  | "decree_seal"
  | "ending_socials";

export interface ChronicleStat {
  value: string;
  label: string;
}

export interface ChronicleLayoutProps {
  title: string;
  narration?: string;

  // Global theming
  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  aspectRatio?: "landscape" | "portrait";
  fontFamily?: string;

  // Responsive typography (drives scene editor)
  titleFontSize?: number;
  descriptionFontSize?: number;

  // Image adjustment modal props
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;

  // Layout-specific inputs
  stats?: ChronicleStat[];
  category?: string;

  // illuminated_quote
  quote?: string;
  attribution?: string;
  highlightPhrase?: string;

  // chapter_plate
  chapterNumber?: number;
  subtitle?: string;

  // versus_folio / fact_check style
  leftLabel?: string;
  rightLabel?: string;
  leftDescription?: string;
  rightDescription?: string;

  // decree_seal
  word?: string;
  highlightWord?: string;
  cta?: string;

  // parchment_scroll drop cap override
  illuminatedLetter?: string;

  // ending_socials
  socials?: SocialsMap | Array<Record<string, unknown>>;
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
  /** Optional multi-CTA array (up to 3). When present, renderer renders columns. */
  ctas?: Array<{ ctaButtonText?: string; websiteLink?: string; showWebsiteButton?: boolean }>;
}
