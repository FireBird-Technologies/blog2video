/** Types for AI-generated template compositions. */

export interface GeneratedSceneProps {
  /** The scene's short title (Scene.title) — a label, not a sentence.
   *  Distinct from displayText: use it for an eyebrow, a section heading or a
   *  chapter marker. Optional, so scenes written before it existed still type. */
  sceneTitle?: string;
  /** The on-screen copy (Scene.display_text). NOT the voiceover. */
  displayText: string;
  /** The voiceover script (Scene.narration_text) — usually a paragraph, and
   *  usually NOT what you put on screen as a headline. */
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
    /** @deprecated Never read by any component. It carried
     *  theme.colors.surface, which no longer exists — panels are derived
     *  from bg+text by derivePalette. Optional so callers may omit it. */
    secondary?: string;
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
  /**
   * Size for the HEADLINE (props.displayText).
   *
   * Named "title" for historical reasons and kept that way because every stored
   * generated scene already binds it — `props.titleFontSize ?? 72` — and the
   * validator gates on that exact read. It is fed by the editor's *Display text*
   * slider, not its *Title* slider; the two are crossed at prop-assembly time so
   * existing templates pick up the correct behaviour without regeneration. See
   * GeneratedVideo.tsx where the props object is built.
   */
  titleFontSize?: number;
  /** Size for body copy. Fed by the same *Display text* slider as the headline. */
  descriptionFontSize?: number;
  /**
   * Size for the scene's short title / eyebrow (props.sceneTitle) — fed by the
   * editor's *Title* slider. Applied by the kit's eyebrow primitives, since
   * scenes generated before this prop existed do not read it themselves.
   */
  sceneTitleFontSize?: number;
  headingFont?: string;
  bodyFont?: string;
  /**
   * Free-form per-layout props this layout declared in its prop schema and the
   * user edited in the scene editor. Read defensively with a literal fallback:
   *   const chapterNumber = props.layoutProps?.chapterNumber ?? "01";
   * Standard props above are NOT duplicated here.
   */
  layoutProps?: Record<string, unknown>;
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
  scenes: GeneratedSceneData[];
  /**
   * Stable per-template seed for the kit's structural variants (which
   * arrangement StatGrid / lists / quotes render). Derived from the brand
   * on the backend so it never changes for a given template.
   *
   * Absent -> DEFAULT_VARIANT, i.e. the historical arrangement, so a project
   * rendered from older data is unchanged rather than arbitrary.
   */
  kitVariantSeed?: string | null;
  /** Explicit variant overrides, if the template pins any (e.g. the blueprint's
   *  chosen surface). Merged over the seeded pick. */
  kitVariant?: Record<string, string> | null;
  /** Brand colors derived from template theme */
  brandColors?: {
    primary: string;
    /** @deprecated Never read by any component. It carried
     *  theme.colors.surface, which no longer exists — panels are derived
     *  from bg+text by derivePalette. Optional so callers may omit it. */
    secondary?: string;
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
