/** Types for AI-generated template compositions. */

export interface GeneratedSceneProps {
  displayText: string;
  narrationText: string;
  imageUrl?: string;
  sceneIndex: number;
  totalScenes: number;
  logoUrl?: string;
  brandImages?: string[];
  brandColors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  aspectRatio: "landscape" | "portrait";
  /** Structured content fields — populated when blog content contains lists, stats, quotes, etc. */
  contentType?: "plain" | "bullets" | "metrics" | "code" | "quote" | "comparison" | "timeline" | "steps";
  bullets?: string[];
  metrics?: { value: string; label: string; suffix?: string }[];
  codeLines?: string[];
  codeLanguage?: string;
  quote?: string;
  quoteAuthor?: string;
  comparisonLeft?: { label: string; description: string };
  comparisonRight?: { label: string; description: string };
  timelineItems?: { label: string; description: string }[];
  steps?: string[];
  titleFontSize?: number;
  descriptionFontSize?: number;
}

export interface GeneratedVideoData {
  projectName: string;
  heroImage?: string | null;
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  /** Brand logo from BrandKit (fallback when no project logo) */
  brandLogo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string | null;
  scenes: GeneratedSceneData[];
  /** Brand colors derived from template theme */
  brandColors?: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  /** Number of unique content scene variants */
  contentVariantCount?: number;
  /** Brand images from BrandKit (resolved to public/ filenames) */
  brandImages?: string[];
}

export interface GeneratedSceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  /** Short on-screen display text (may differ from full narration) */
  displayText?: string;
  /** Full voiceover narration script */
  narrationText?: string;
  durationSeconds: number;
  voiceoverFile: string | null;
  images: string[];
  sceneType?: "intro" | "content" | "outro";
  /** Index into content variant array (0-based, cycles) */
  contentVariantIndex?: number;
  /** Structured content extracted from blog content (bullets, metrics, quotes, etc.) */
  structuredContent?: { contentType: string; [key: string]: unknown };
  /** Layout config with font sizes and other per-scene settings */
  layoutConfig?: { titleFontSize?: number; descriptionFontSize?: number; [key: string]: unknown };
}
