/**
 * Custom-template craft kit — design-system core.
 *
 * Deterministic color + typography derivation so every AI-generated custom
 * template gets a coherent look regardless of what the LLM emits. Generalized
 * from bloomberg/constants.ts `derivePalette` and the per-template type scales
 * found across laduc/nightfall/chronicle/bloomberg.
 *
 * Pure functions only — no React, no Remotion. Safe to import anywhere.
 */

export interface KitColors {
  /** Brand accent — buttons, highlights, primary stat, chart series 0. */
  accent: string;
  /** Main canvas background. */
  bg: string;
  /** Optional gradient endpoint (solid background when undefined). */
  bg2?: string;
  /** Primary text. */
  text: string;
}

/** Full palette derived from the brand's 2–4 colors. */
export interface KitPalette {
  accent: string;
  bg: string;
  bg2: string | undefined;
  text: string;
  /** Slightly raised surface for cards/panels — stands out from bg. */
  panel: string;
  /** Chrome bars / header strips — a hint off bg. */
  header: string;
  /** Hairline borders. */
  border: string;
  /** Secondary / de-emphasised text. */
  muted: string;
  /** Faint grid / divider lines. */
  grid: string;
  /** Whether the background is dark (drives contrast choices). */
  isDark: boolean;
  /** Secondary + tertiary chart series, brand-tinted. */
  series: [string, string, string];
}

// ─── Hex helpers ──────────────────────────────────────────────

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = (hex || "").replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.slice(0, 6).padEnd(6, "0");
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${clampByte(r).toString(16).padStart(2, "0")}${clampByte(g)
    .toString(16)
    .padStart(2, "0")}${clampByte(b).toString(16).padStart(2, "0")}`;
}

/** Mix `hex` toward an (r,g,b) target by `amount` (0..1). */
export function mixHex(
  hex: string,
  r: number,
  g: number,
  b: number,
  amount: number,
): string {
  const [hr, hg, hb] = hexToRgb(hex);
  return rgbToHex(
    hr + (r - hr) * amount,
    hg + (g - hg) * amount,
    hb + (b - hb) * amount,
  );
}

/** Mix two hex colors. amount=0 → a, amount=1 → b. */
export function blend(a: string, b: string, amount: number): string {
  const [br, bg, bb] = hexToRgb(b);
  return mixHex(a, br, bg, bb, amount);
}

/** rgba() string from a hex + alpha (0..1). */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/** Perceived luminance 0..1 (Rec. 601). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function isDarkColor(hex: string): boolean {
  return luminance(hex) < 0.45;
}

/** Pick black or white text for legibility on a given background. */
export function readableOn(bg: string): string {
  return isDarkColor(bg) ? "#FFFFFF" : "#0A0A0A";
}

// ─── Palette derivation ───────────────────────────────────────

/**
 * Derive a coherent UI palette (panel/header/border/muted/grid + chart series)
 * from the brand's bg + text colors. Dark/light aware: on dark backgrounds we
 * tint *toward text* to lift panels; on light backgrounds we darken slightly.
 *
 * Generalized from bloomberg/constants.ts `derivePalette`.
 */
export function derivePalette(colors: KitColors): KitPalette {
  const bg = colors.bg || "#0B0B0F";
  const text = colors.text || readableOn(bg);
  const accent = colors.accent || "#6366F1";
  const [tr, tg, tb] = hexToRgb(text);
  const dark = isDarkColor(bg);

  // On dark bg, tint panels toward text; on light bg, darken toward black.
  const panel = dark
    ? mixHex(bg, tr, tg, tb, 0.07)
    : mixHex(bg, 0, 0, 0, 0.05);
  const header = dark
    ? mixHex(bg, tr, tg, tb, 0.1)
    : mixHex(bg, 0, 0, 0, 0.08);
  const border = mixHex(bg, tr, tg, tb, dark ? 0.16 : 0.14);
  const muted = mixHex(bg, tr, tg, tb, 0.5);
  const grid = withAlpha(text, dark ? 0.12 : 0.1);

  // Brand-tinted secondary/tertiary chart series: rotate the accent toward
  // text and bg so multi-series charts stay on-brand without clashing.
  const series2 = blend(accent, text, 0.35);
  const series3 = blend(accent, dark ? "#FFFFFF" : "#000000", 0.25);

  return {
    accent,
    bg,
    bg2: colors.bg2,
    text,
    panel,
    header,
    border,
    muted,
    grid,
    isDark: dark,
    series: [accent, series2, series3],
  };
}

/** CSS background value for the canvas — solid or on-brand gradient. */
export function backgroundCss(palette: KitPalette, angle = 160): string {
  return palette.bg2
    ? `linear-gradient(${angle}deg, ${palette.bg} 0%, ${palette.bg2} 100%)`
    : palette.bg;
}

// ─── Typographic scale ────────────────────────────────────────

export interface TypeScale {
  /** Hero / display headline. */
  hero: number;
  /** Scene title. */
  title: number;
  /** Subtitle / lead. */
  subtitle: number;
  /** Body / narration. */
  body: number;
  /** Captions, secondary lines. */
  caption: number;
  /** Eyebrow / kicker / small-caps labels. */
  label: number;
  /** Big numeral for stat displays. */
  numeral: number;
}

/**
 * Portrait-aware type scale derived off a single base body size. Ratios match
 * the hierarchy observed across the polished templates (title ≈ 2×, numeral ≈
 * 3×, label ≈ 0.55× body). Pass user overrides (titleFontSize /
 * descriptionFontSize) to honor Settings without losing the scale.
 */
export function typeScale(
  isPortrait: boolean,
  overrides?: { title?: number; body?: number },
): TypeScale {
  const body = overrides?.body ?? (isPortrait ? 42 : 34);
  const title = overrides?.title ?? Math.round(body * (isPortrait ? 2.1 : 2.2));
  return {
    body,
    title,
    hero: Math.round(title * 1.25),
    subtitle: Math.round(body * 1.18),
    caption: Math.round(body * 0.82),
    label: Math.round(body * 0.56),
    numeral: Math.round(body * (isPortrait ? 2.6 : 3.0)),
  };
}
