/**
 * Style engine — maps CustomTheme.style + animationPreset + patterns to
 * concrete CSS decorations and Remotion spring configs used by every custom layout.
 */

import type {
  CustomTheme,
  CustomStyle,
  CustomAnimationPreset,
  VisualPatterns,
} from "../types";

// ─── Style Decorations ──────────────────────────────────────────

export interface StyleDecorations {
  /** Extra CSS applied to the outermost container */
  container: React.CSSProperties;
  /** Card / surface panel styling */
  card: React.CSSProperties;
  /** Accent element (dividers, highlights) */
  accentBar: React.CSSProperties;
  /** Text shadow for headings */
  headingShadow: string;
  /** Image container styling based on patterns */
  imageFrame: React.CSSProperties;
  /** Content padding based on spacing density */
  contentPadding: React.CSSProperties;
  /** Grid gap from spacing patterns */
  gridGap: number;
}

/** Map shadow depth to box-shadow CSS. */
function shadowForDepth(
  depth: string,
  colors: CustomTheme["colors"],
): string {
  switch (depth) {
    case "none":
      return "none";
    case "subtle":
      return `0 2px 8px ${colors.muted}22`;
    case "medium":
      return `0 4px 16px ${colors.muted}33`;
    case "heavy":
      return `0 8px 32px ${colors.muted}55`;
    default:
      return `0 2px 8px ${colors.muted}22`;
  }
}

/** Map card corners to border-radius. */
function radiusForCorners(corners: string, baseRadius: number): number {
  switch (corners) {
    case "sharp":
      return Math.min(baseRadius, 4);
    case "pill":
      return Math.max(baseRadius, 24);
    case "rounded":
    default:
      return baseRadius;
  }
}

/** Map border style to CSS border. */
function borderForStyle(
  borderStyle: string,
  colors: CustomTheme["colors"],
): string {
  switch (borderStyle) {
    case "none":
      return "none";
    case "thin":
      return `1px solid ${colors.muted}33`;
    case "accent":
      return `2px solid ${colors.accent}`;
    case "gradient":
      return `2px solid ${colors.accent}88`;
    default:
      return `1px solid ${colors.muted}33`;
  }
}

/** Map spacing density to padding values. */
function paddingForDensity(density: string, isPortrait: boolean): React.CSSProperties {
  const base = isPortrait ? 24 : 40;
  switch (density) {
    case "compact":
      return { padding: base * 0.6 };
    case "spacious":
      return { padding: base * 1.5 };
    case "balanced":
    default:
      return { padding: base };
  }
}

/** Build image frame CSS from patterns. */
function buildImageFrame(
  patterns: VisualPatterns,
  baseRadius: number,
  colors: CustomTheme["colors"],
): React.CSSProperties {
  const { treatment } = patterns.images;
  const cardRadius = radiusForCorners(patterns.cards.corners, baseRadius);

  const frame: React.CSSProperties = {
    overflow: "hidden",
    objectFit: "cover" as const,
  };

  switch (treatment) {
    case "full-bleed":
      frame.borderRadius = 0;
      break;
    case "circle":
      frame.borderRadius = "50%";
      break;
    case "framed":
      frame.borderRadius = cardRadius;
      frame.border = `3px solid ${colors.surface}`;
      frame.boxShadow = shadowForDepth("medium", colors);
      break;
    case "rounded":
    default:
      frame.borderRadius = cardRadius;
      break;
  }

  return frame;
}

export function getStyleDecorations(
  theme: CustomTheme,
  isPortrait = false,
): StyleDecorations {
  const { colors, borderRadius, style } = theme;
  const patterns = theme.patterns;
  const cardRadius = radiusForCorners(patterns.cards.corners, borderRadius);
  const shadow = shadowForDepth(patterns.cards.shadowDepth, colors);
  const border = borderForStyle(patterns.cards.borderStyle, colors);

  const base: StyleDecorations = {
    container: {},
    card: {
      backgroundColor: colors.surface,
      borderRadius: cardRadius,
      boxShadow: shadow,
      border,
    },
    accentBar: {
      backgroundColor: colors.accent,
      borderRadius: cardRadius / 2,
    },
    headingShadow: "none",
    imageFrame: buildImageFrame(patterns, borderRadius, colors),
    contentPadding: paddingForDensity(patterns.spacing.density, isPortrait),
    gridGap: patterns.spacing.gridGap,
  };

  const decorators: Record<CustomStyle, () => StyleDecorations> = {
    minimal: () => ({
      ...base,
      card: {
        ...base.card,
        boxShadow: "none",
        border: border === "none" ? `1px solid ${colors.muted}33` : border,
      },
    }),

    glass: () => ({
      ...base,
      container: {
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      },
      card: {
        ...base.card,
        backgroundColor: `${colors.surface}88`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: `1px solid ${colors.accent}22`,
        boxShadow: `0 8px 32px ${colors.accent}11`,
      },
      headingShadow: `0 0 40px ${colors.accent}44`,
    }),

    bold: () => ({
      ...base,
      card: {
        ...base.card,
        border: `3px solid ${colors.accent}`,
        boxShadow: `6px 6px 0 ${colors.accent}44`,
      },
      accentBar: {
        backgroundColor: colors.accent,
        borderRadius: 0,
        height: 6,
      },
    }),

    neon: () => ({
      ...base,
      card: {
        ...base.card,
        backgroundColor: `${colors.surface}CC`,
        border: `1px solid ${colors.accent}88`,
        boxShadow: `0 0 20px ${colors.accent}33, inset 0 0 20px ${colors.accent}11`,
      },
      accentBar: {
        ...base.accentBar,
        boxShadow: `0 0 12px ${colors.accent}88, 0 0 24px ${colors.accent}44`,
      },
      headingShadow: `0 0 20px ${colors.accent}66, 0 0 40px ${colors.accent}33`,
    }),

    soft: () => ({
      ...base,
      card: {
        ...base.card,
        borderRadius: cardRadius * 1.5,
        boxShadow: `0 4px 24px ${colors.muted}22`,
        border: "none",
      },
      accentBar: {
        ...base.accentBar,
        borderRadius: cardRadius,
      },
    }),
  };

  return decorators[style]();
}

// ─── Image overlay helper ───────────────────────────────────────

/** Get CSS for image overlay based on patterns. */
export function getImageOverlayStyle(theme: CustomTheme): React.CSSProperties {
  const patterns = theme.patterns;
  const overlay = patterns.images.overlay;
  const { colors } = theme;

  switch (overlay) {
    case "gradient":
      return {
        background: `linear-gradient(180deg, transparent 30%, ${colors.bg}CC 100%)`,
      };
    case "dark-scrim":
      return {
        background: "rgba(0, 0, 0, 0.45)",
      };
    case "color-wash":
      return {
        background: `${colors.accent}33`,
        mixBlendMode: "multiply" as const,
      };
    case "none":
    default:
      return {};
  }
}

// ─── Decorative elements ────────────────────────────────────────

export interface DecorativeElement {
  style: React.CSSProperties;
}

/** Generate absolutely-positioned decorative elements based on patterns. */
export function getDecorativeElements(theme: CustomTheme): DecorativeElement[] {
  const patterns = theme.patterns;
  const elements: DecorativeElement[] = [];
  const { colors } = theme;

  for (const dec of patterns.layout.decorativeElements) {
    switch (dec) {
      case "gradients":
        elements.push({
          style: {
            position: "absolute",
            top: "-20%",
            right: "-10%",
            width: "40%",
            height: "40%",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${colors.accent}15 0%, transparent 70%)`,
            pointerEvents: "none",
          },
        });
        break;
      case "accent-lines":
        elements.push({
          style: {
            position: "absolute",
            bottom: "10%",
            left: "5%",
            width: "30%",
            height: 2,
            backgroundColor: `${colors.accent}33`,
            pointerEvents: "none",
          },
        });
        elements.push({
          style: {
            position: "absolute",
            top: "15%",
            right: "8%",
            width: "20%",
            height: 2,
            backgroundColor: `${colors.accent}22`,
            pointerEvents: "none",
          },
        });
        break;
      case "background-shapes":
        elements.push({
          style: {
            position: "absolute",
            bottom: "-15%",
            left: "-10%",
            width: "35%",
            height: "35%",
            borderRadius: theme.borderRadius * 2,
            backgroundColor: `${colors.accent}08`,
            transform: "rotate(15deg)",
            pointerEvents: "none",
          },
        });
        break;
      case "dots":
        elements.push({
          style: {
            position: "absolute",
            top: "12%",
            right: "6%",
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: `${colors.accent}44`,
            boxShadow: `18px 0 0 ${colors.accent}33, 36px 0 0 ${colors.accent}22, 0 18px 0 ${colors.accent}33, 18px 18px 0 ${colors.accent}22`,
            pointerEvents: "none",
          },
        });
        break;
      case "none":
      default:
        break;
    }
  }

  return elements;
}

// ─── Animation Config ───────────────────────────────────────────

export interface AnimationConfig {
  /** Spring config for primary entrance */
  entrance: { damping: number; stiffness: number; mass: number };
  /** Frame delay between staggered items */
  staggerDelay: number;
  /** Initial translateY offset (px) for slide-in */
  slideOffset: number;
  /** Whether to use character-by-character typewriter reveal */
  typewriter: boolean;
}

export function getAnimationConfig(theme: CustomTheme): AnimationConfig {
  const presets: Record<CustomAnimationPreset, AnimationConfig> = {
    fade: {
      entrance: { damping: 26, stiffness: 70, mass: 1 },
      staggerDelay: 8,
      slideOffset: 0,
      typewriter: false,
    },
    slide: {
      entrance: { damping: 22, stiffness: 90, mass: 1 },
      staggerDelay: 6,
      slideOffset: 30,
      typewriter: false,
    },
    spring: {
      entrance: { damping: 14, stiffness: 160, mass: 0.8 },
      staggerDelay: 5,
      slideOffset: 40,
      typewriter: false,
    },
    typewriter: {
      entrance: { damping: 26, stiffness: 70, mass: 1 },
      staggerDelay: 10,
      slideOffset: 0,
      typewriter: true,
    },
  };

  return presets[theme.animationPreset];
}

// ─── Helpers ────────────────────────────────────────────────────

/** Build a Google Fonts URL for the theme's font families. */
export function getFontUrl(theme: CustomTheme): string {
  const families = [
    `${theme.fonts.heading}:wght@400;600;700;800`,
    `${theme.fonts.body}:wght@400;500;600`,
    `${theme.fonts.mono}:wght@400;500`,
  ]
    .map((f) => `family=${f.replace(/ /g, "+")}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
