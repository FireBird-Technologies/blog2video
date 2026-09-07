/** Types for AI-generated template compositions. */

export interface GeneratedSceneProps {
  /**
   * The scene's TITLE (Scene.title) — 5-7 words naming what the scene is about.
   *
   * In design v3 this is the scene's main label and the LARGEST TYPE on the
   * frame, sized by props.titleFontSize. In v1/v2 it was a small eyebrow above
   * the displayText headline with its own props.sceneTitleFontSize; those
   * templates still render that way, which is why the field is documented
   * twice. Optional, so scenes written before it existed still type.
   */
  sceneTitle?: string;
  /**
   * The on-screen copy (Scene.display_text). NOT the voiceover.
   *
   * v3: one or two supporting sentences BENEATH the title, at
   * props.descriptionFontSize. v1/v2: the headline, at props.titleFontSize.
   */
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
   * WHAT THIS SIZES DEPENDS ON THE TEMPLATE'S DESIGN VERSION — the single
   * easiest thing to get backwards in this file.
   *
   *   v3      props.sceneTitle (the scene TITLE). Fed by the editor's *Title*
   *           slider. This is the mapping the name always implied.
   *   v1/v2   props.displayText (the HEADLINE). Named "title" for historical
   *           reasons; every stored v1/v2 scene binds it that way
   *           (`props.titleFontSize ?? 72`) and keeps rendering unchanged.
   *
   * Clamped on read to the USER band — what a person may set — not to the
   * narrower band the generator is held to. See kit/typeBands.ts.
   */
  titleFontSize?: number;
  /**
   * v3: EVERYTHING that is not the title — props.displayText, every content
   * prop (bullets, metrics, steps, timeline, quote, comparison, code), and
   * every label, caption and marker. There is no third size.
   * v1/v2: body copy and content props only.
   */
  descriptionFontSize?: number;
  /**
   * v1/v2 ONLY — the eyebrow tier, sizing props.sceneTitle when it was a small
   * kicker above the headline. Read as `props.sceneTitleFontSize ?? Math.max(22,
   * bodySize * 0.62)`.
   *
   * NOT emitted or read by v3, which has exactly two type tiers: a v3 scene
   * reading it would size something off a value no slider writes, and the
   * validator rejects it. Kept declared so v1/v2 scenes still compile.
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
  /**
   * The closing CTA + social handles, present only on the FINAL scene.
   *
   * Previously these never reached scene code at all: GeneratedVideo branched
   * `scene.ctaProps ? <GeneratedCtaOverlay/> : <SceneVisual/>`, so a template's
   * own generated outro was DISCARDED and replaced by one generic centred card.
   * Every custom template therefore ended identically, however distinct the rest
   * of it was — and the outro was forced into `layouts_without_image` because
   * its design was never rendered.
   *
   * Now the outro composes these itself: it renders <SocialIcons> (the same
   * shared component every built-in ending uses, so the icon set and handle
   * resolution stay consistent) and maps `ctas` into its OWN layout.
   *
   * Always guard — it is absent in template previews and in projects with no
   * CTA configured, and the scene must still look finished.
   */
  ctaProps?: GeneratedCtaProps;
}

/** The closing CTA + socials payload handed to the final scene. */
export interface GeneratedCtaProps {
  socials?: Record<string, { enabled?: boolean; label?: string }>;
  /** Legacy single-CTA fields — a mirror of ctas[0]. Prefer `ctas`. */
  showWebsiteButton?: boolean;
  websiteLink?: string;
  ctaButtonText?: string;
  /** Up to 3 CTA cards. When present, takes precedence over the legacy fields. */
  ctas?: Array<{
    ctaButtonText?: string;
    websiteLink?: string;
    showWebsiteButton?: boolean;
  }>;
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
  /**
   * Which generation the template's design came from. Absent or 1 = the
   * blueprint era; 2 = design docs.
   *
   * This decides who draws the ending. A v1 outro was generated on the promise
   * that GeneratedCtaOverlay would be composited OVER it — its own visual was
   * discarded, so it never learned to render the CTA or socials and would show
   * an ending with neither. A v2 outro composes them itself from props.ctaProps.
   * Rendering either one the other's way produces a broken ending, so the
   * version must travel with the data.
   */
  templateDesignVersion?: number;
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
  /** How this scene's DESIGN uses its image, from the template's design docs.
   *
   *  "background" fills the frame behind the type and therefore needs a scrim
   *  laid over it or the copy is unreadable on a real photograph; "half" puts
   *  the image beside the type, where a scrim would only mute the picture.
   *  Absent on templates generated before this was threaded through. */
  imageMode?: "background" | "half" | null;
  /** Index into content variant array (0-based, cycles) */
  contentVariantIndex?: number;
  /** Structured content extracted from blog content (bullets, metrics, quotes, etc.) */
  structuredContent?: { contentType: string; [key: string]: unknown };
  /** Layout config with font sizes and other per-scene settings */
  layoutConfig?: { titleFontSize?: number; descriptionFontSize?: number; [key: string]: unknown };
  layoutProps?: { imageFocusX?: number; imageFocusY?: number; imageBoxAspectRatio?: string; [key: string]: unknown };
  /** CTA props for outro scenes. Socials are scene-level (one global list).
   *  CTAs are an array of up to 3 pill+URL cards.
   *  Shares GeneratedCtaProps with the scene-level prop so the two cannot drift. */
  ctaProps?: GeneratedCtaProps;
}
