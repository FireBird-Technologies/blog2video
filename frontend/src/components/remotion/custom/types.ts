/** Custom template types — universal layout engine driven by scraped brand data. */

export type CustomStyle = "minimal" | "glass" | "bold" | "neon" | "soft";
export type CustomAnimationPreset = "fade" | "slide" | "spring" | "typewriter";

/* ── Visual patterns extracted from scraped websites ── */

export interface CardPatterns {
  corners: "rounded" | "sharp" | "pill";
  shadowDepth: "none" | "subtle" | "medium" | "heavy";
  borderStyle: "none" | "thin" | "accent" | "gradient";
}

export interface SpacingPatterns {
  density: "compact" | "balanced" | "spacious";
  gridGap: number;
}

export interface ImagePatterns {
  treatment: "rounded" | "full-bleed" | "framed" | "circle";
  overlay: "none" | "gradient" | "dark-scrim" | "color-wash";
  captionStyle: "below" | "overlay" | "hidden";
}

export interface LayoutPatterns {
  direction: "centered" | "left-aligned" | "asymmetric";
  decorativeElements: (
    | "gradients"
    | "accent-lines"
    | "background-shapes"
    | "dots"
    | "none"
  )[];
}

export interface VisualPatterns {
  cards: CardPatterns;
  spacing: SpacingPatterns;
  images: ImagePatterns;
  layout: LayoutPatterns;
}

/* ── Theme ── */

export interface CustomTheme {
  colors: {
    accent: string;
    bg: string;
    text: string;
    surface: string;
    muted: string;
  };
  fonts: {
    heading: string;
    body: string;
    mono: string;
  };
  borderRadius: number;
  style: CustomStyle;
  animationPreset: CustomAnimationPreset;
  category: string;
  patterns: VisualPatterns;
}

/* ── Universal Layout Config ── */

export type SceneArrangement =
  | "full-center"
  | "split-left"
  | "split-right"
  | "top-bottom"
  | "grid-2x2"
  | "grid-3"
  | "asymmetric-left"
  | "asymmetric-right"
  | "stacked";

export type SceneElementType =
  | "heading"
  | "body-text"
  | "card-grid"
  | "code-block"
  | "metric-row"
  | "image"
  | "quote"
  | "timeline"
  | "steps"
  | "icon-text";

export type SceneDecoration =
  | "accent-bar-top"
  | "accent-bar-left"
  | "accent-bar-bottom"
  | "corner-accent"
  | "gradient-orb"
  | "dot-grid"
  | "diagonal-lines"
  | "none";

export interface ElementContent {
  text?: string;
  items?: {
    text: string;
    icon?: string;
    value?: string;
    label?: string;
    description?: string;
    imageUrl?: string;
  }[];
  codeLines?: string[];
  codeLanguage?: string;
  quote?: string;
  author?: string;
  highlightPhrase?: string;
  imageUrl?: string;
  caption?: string;
}

export interface SceneElement {
  type: SceneElementType;
  content: ElementContent;
  size?: "small" | "medium" | "large" | "full";
  emphasis?: "primary" | "secondary" | "subtle";
}

export interface SceneBackground {
  type: "solid" | "gradient" | "image";
  imageUrl?: string;
  gradientAngle?: number;
}

export interface SceneLayoutConfig {
  arrangement: SceneArrangement;
  elements: SceneElement[];
  background?: SceneBackground;
  decorations?: SceneDecoration[];
  titleFontSize?: number;
  descriptionFontSize?: number;
}

/* ── Props for the universal renderer ── */

export interface UniversalSceneProps {
  config: SceneLayoutConfig;
  theme: CustomTheme;
  title: string;
  narration: string;
  imageUrl?: string;
  aspectRatio?: string;
}
