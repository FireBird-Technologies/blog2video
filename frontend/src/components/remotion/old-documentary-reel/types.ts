import type { SocialsMap, SocialsRow } from "../SocialIcons";
import type { DocReelEra } from "./docReelStyle";

export type DocReelLayoutType =
  | "docreel_countdown"
  | "docreel_slate"
  | "docreel_statistic"
  | "docreel_title_card"
  | "docreel_dossier"
  | "docreel_photo_pan"
  | "docreel_contact_sheet"
  | "docreel_interview"
  | "docreel_field_notes"
  | "docreel_essay_captions"
  | "docreel_reel_out"
  | "ending_socials";
  // "ending_socials" is the canonical id the backend emits for the ending scene;
  // it is aliased to the docreel_reel_out component in DOCREEL_LAYOUT_REGISTRY.

export interface SceneLayoutProps {
  title: string;
  narration: string;
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  videoUrl?: string;
  videoMuted?: boolean;
  videoVolume?: number;
  videoDurationInFrames?: number;
  videoStartInFrames?: number;
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  sceneDurationInFrames?: number;
  fontFamily?: string;
  titleFontSize?: number;
  descriptionFontSize?: number;
  titleFontSizeIsUserSet?: boolean;
  descriptionFontSizeIsUserSet?: boolean;
  socials?: SocialsMap | SocialsRow[];
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
  ctas?: Array<{ ctaButtonText?: string; websiteLink?: string; showWebsiteButton?: boolean }>;

  /** Global per-project reference era; drives which archive-effect skins render. */
  era?: DocReelEra;

  // Slate & Countdown
  slateScene?: string;
  slateTake?: string;
  slateDate?: string;
  slateDirector?: string;
  slateProduction?: string;
  slateProductionLabel?: string;
  slateSceneLabel?: string;
  slateTakeLabel?: string;
  slateDirectorLabel?: string;
  slateDateLabel?: string;

  // Statistic Overlay
  statValue?: string;
  statLabel?: string;
  statContext?: string;

  // Establishing Title Card
  chapterTitle?: string;

  // Dossier Insert
  dossierHeading?: string;
  dossierBody?: string;
  dossierStamp?: string;
  dossierClassification?: string;

  // Archive Photograph Pan
  caption?: string;
  subCaption?: string;
  imageFocusX?: number;
  imageFocusY?: number;
  photoPanLabel?: string;

  // Contact Sheet Montage
  contactSheetImages?: string[];
  contactSheetNotes?: string;

  // Interview Insert
  interviewQuote?: string;
  interviewSubject?: string;
  interviewRole?: string;

  // Field Notes Checklist
  fieldNotesHeading?: string;
  fieldNotesItems?: string[];

  // Essay Captions
  essayStatements?: string[];

  // Countdown Leader (system-owned scene 0)
  countdownFrom?: number;
  countdownCueSeconds?: number[];
  playbackSpeed?: number;

  // Reel-Out & Credits / ending_socials
  brandName?: string;
  websiteUrl?: string;
  socialHandles?: string[];
}
