import type { SocialsMap, SocialsRow } from "../SocialIcons";

export type Stickman2LayoutType =
  | "chalk_title" | "night_walk" | "shooting_star" | "constellation_stats" | "moonphase_chart" | "shadow_comparison" | "signal_fire_scene" | "neon_countdown" | "lantern_dialogue" | "ending_socials";

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
  // object_array props use the standard label/value pair shape so the editor can render both fields
  stats?: Array<{ label?: string; value?: string }>;
  bars?: Array<{ label?: string; value?: string }>;
  leftThought?: string;
  rightThought?: string;
  startFrom?: number;
  label?: string;
  leftBubble?: string;
  rightBubble?: string;
  speakers?: Array<{ label?: string; value?: string }>;
  handles?: string[];
}
