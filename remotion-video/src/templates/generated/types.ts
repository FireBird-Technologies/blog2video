/** Types for AI-generated template compositions. */

export interface GeneratedSceneProps {
  displayText: string;
  narrationText: string;
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  /** True when a stock-footage clip is filling this scene's visual slot.
   *  GeneratedVideo renders the clip itself (not the component) — the
   *  component must leave that slot's area empty/transparent rather than
   *  treating the scene as if it has no visual at all (never collapse to a
   *  full-width text layout when hasVideo is true). imageUrl is undefined
   *  in this case — NEVER a video URL. */
  hasVideo?: boolean;
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
    /** Optional gradient endpoint — when present the brand background is a gradient. */
    bg2?: string;
  };
  aspectRatio: "landscape" | "portrait";
  /** Structured content fields — populated when blog content contains lists, stats, quotes, etc. */
  contentType?: "plain" | "bullets" | "metrics" | "code" | "quote" | "comparison" | "timeline" | "steps" | "dataviz";
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
  /** Data-viz fields — populated when blog content contains a table/chartable data. */
  chartTable?: { headers?: string[]; rows?: Array<Array<string | number>> };
  chartType?: string;
  chartSummary?: string;
  titleFontSize?: number;
  descriptionFontSize?: number;
  headingFont?: string;
  bodyFont?: string;
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
  playbackSpeed?: number;
  fontFamily?: string | null;
  /** Font for headings/titles (from theme or user override) */
  headingFont?: string | null;
  /** Font for body/description text (from theme or user override) */
  bodyFont?: string | null;
  bgmFile?: string | null;
  bgmVolume?: number;
  captionsEnabled?: boolean;
  captionPosition?: string;
  captionFontFamily?: string;
  captionFontSize?: string;
  captionOffset?: number;
  /** Avatar overlay presentation (see components/AvatarOverlay.tsx). */
  avatarShape?: "circle" | "rounded" | "square";
  avatarSize?: number;
  avatarPosition?: "top_left" | "top_right" | "bottom_left" | "bottom_right";
  avatarBg?: string | null;
  avatarOpacity?: number;
  avatarFocusX?: number;
  avatarFocusY?: number;
  avatarZoom?: number;
  scenes: GeneratedSceneData[];
  /** Brand colors derived from template theme */
  brandColors?: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    bg2?: string;
  };
  /** Optional gradient endpoint for the canvas background (solid when absent). */
  bg2Color?: string | null;
  /** Optional subset of transition styles for scene-exit flourishes. */
  transitionFamily?: (
    | "fade"
    | "accent_wash"
    | "rule_sweep"
    | "ink_wash"
    | "whip_blur"
  )[];
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
  /** Spoken-audio length in seconds (scene duration minus trailing pad) — for caption timing. */
  speechDurationSeconds?: number;
  voiceoverFile: string | null;
  avatarVideoFile?: string | null;
  /** Per-scene avatar presentation, already resolved by the backend
   *  (scene override ?? project ?? default). See services/remotion.py. */
  avatarShape?: "circle" | "rounded" | "square";
  avatarSize?: number;
  avatarPosition?: "top_left" | "top_right" | "bottom_left" | "bottom_right";
  avatarBg?: string | null;
  avatarOpacity?: number;
  avatarFocusX?: number;
  avatarFocusY?: number;
  avatarZoom?: number;
  images: string[];
  /** External image URL (og_image from brand kit) — used when no local image is assigned */
  ogImageUrl?: string;
  /** Stock-footage clip filename (public/ relative), mirroring builtin templates. */
  video?: string;
  videoMuted?: boolean;
  videoVolume?: number;
  videoDurationSeconds?: number;
  videoStartSeconds?: number;
  sceneType?: "intro" | "content" | "outro" | "dataviz_chart" | "dataviz_table";
  /** Index into content variant array (0-based, cycles) */
  contentVariantIndex?: number;
  /** Structured content extracted from blog content (bullets, metrics, quotes, etc.) */
  structuredContent?: { contentType: string; [key: string]: unknown };
  /** Layout config with font sizes and other per-scene settings */
  layoutConfig?: { titleFontSize?: number; descriptionFontSize?: number; [key: string]: unknown };
  layoutProps?: { imageFocusX?: number; imageFocusY?: number; imageBoxAspectRatio?: string; [key: string]: unknown };
  /** CTA props for outro scenes. Socials are scene-level (one global list).
   *  CTAs are an array of up to 3 pill+URL cards rendered as columns. */
  ctaProps?: {
    socials?: Record<string, { enabled?: boolean; label?: string }>;
    /** Legacy single-CTA fields. Kept as a mirror of ctas[0] for renderers that
     *  haven't been updated to read the `ctas` array yet. */
    showWebsiteButton?: boolean;
    websiteLink?: string;
    ctaButtonText?: string;
    /** New: up to 3 CTA cards. When present, takes precedence over the legacy fields. */
    ctas?: Array<{
      ctaButtonText?: string;
      websiteLink?: string;
      showWebsiteButton?: boolean;
    }>;
  };
}
