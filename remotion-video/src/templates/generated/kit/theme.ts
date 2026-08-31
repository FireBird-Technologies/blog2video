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
  /** The brand accent, unmodified — for FILLS, rules, borders and shapes. */
  accent: string;
  /** The accent as TEXT: contrast-clamped against bg (and bg2 when present).
   *  Equals `accent` whenever the brand's own accent already reads. */
  accentText: string;
  bg: string;
  bg2: string | undefined;
  /** Body text, contrast-clamped against the background. */
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

/** Perceived luminance 0..1 (Rec. 601).
 *
 * Kept for backwards compatibility and for cheap "is this roughly dark?"
 * questions. It is NOT the right basis for a contrast decision — use
 * `contrastRatio` for that. Rec-601 skips sRGB gamma and weights green at
 * 0.587 where WCAG uses 0.7152, and the two disagree most in the mid-range,
 * which is exactly where a wrong answer is visible. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** WCAG 2.x relative luminance — sRGB linearized, 0..1. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two colors, 1..21. AA body text needs >= 4.5. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Minimum contrast for body text (WCAG AA). */
export const AA_CONTRAST = 4.5;

export function isDarkColor(hex: string): boolean {
  return luminance(hex) < 0.45;
}

/**
 * Pick the more legible of near-black / white for a given background.
 *
 * Decided by MEASURED contrast rather than a luminance threshold. The old
 * implementation thresholded Rec-601 luminance at 0.45, which picks the wrong
 * pole on mid-tone saturated hues — measured: #00A0A0 got white at 3.21:1 when
 * black scores 6.16:1, and #3D8B37 got white at 4.25:1 over black's 4.66:1.
 */
export function readableOn(bg: string): string {
  return contrastRatio(bg, "#FFFFFF") >= contrastRatio(bg, "#0A0A0A")
    ? "#FFFFFF"
    : "#0A0A0A";
}

/**
 * Nudge `fg` toward whichever pole raises contrast against `bg` until it clears
 * `min`, and return the adjusted color.
 *
 * Used to keep DERIVED colors legible without discarding the brand's hue: the
 * result is the closest color to the original that still reads. When even the
 * pole itself cannot reach `min` (a mid-tone background where nothing does),
 * the best available is returned rather than failing — some contrast beats
 * none, and the caller has no better option to fall back to.
 *
 * `against` takes extra backgrounds the color must ALSO clear — a gradient's
 * second stop, most importantly, since a color derived only against stop 0 can
 * be invisible over the other end of the ramp.
 */
export function ensureContrast(
  fg: string,
  bg: string,
  min: number = AA_CONTRAST,
  against: (string | undefined)[] = [],
): string {
  const backgrounds = [bg, ...against].filter(Boolean) as string[];
  const worst = (c: string): number =>
    backgrounds.reduce((acc, b) => Math.min(acc, contrastRatio(c, b)), Infinity);

  if (worst(fg) >= min) return fg;

  // Push toward the pole that the WORST background wants, so the result clears
  // every stop rather than only the one it was tuned against.
  const hardest = backgrounds.reduce((a, b) =>
    contrastRatio(fg, a) <= contrastRatio(fg, b) ? a : b,
  );
  const pole = readableOn(hardest);

  let best = fg;
  let bestScore = worst(fg);
  // 5% steps: fine enough that the hue shift is not visible at the point it
  // starts passing, coarse enough to stay cheap inside a render.
  for (let i = 1; i <= 20; i++) {
    const candidate = blend(fg, pole, i / 20);
    const score = worst(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
    if (score >= min) return candidate;
  }
  return best;
}

/**
 * Keep a gradient's second stop on the same side of the light/dark divide as
 * its first, so a single text colour can read across the whole ramp.
 *
 * Returns undefined (no gradient) only if the input was undefined. A stop that
 * crosses the divide is blended back toward `bg` until it does not — preserving
 * the intended direction and hue while making the ramp survivable.
 */
export function clampGradientStop(
  bg: string,
  stop: string | undefined,
): string | undefined {
  if (!stop) return undefined;
  // Both stops must want the same foreground pole.
  if (readableOn(stop) === readableOn(bg)) return stop;
  for (let i = 1; i <= 10; i++) {
    const pulled = blend(stop, bg, i / 10);
    if (readableOn(pulled) === readableOn(bg)) return pulled;
  }
  return bg;
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
  // A gradient that spans dark to light has NO legible text colour: measured
  // over random brands, 49% of unconstrained two-stop gradients admit no colour
  // clearing AA on both ends — white reads on one stop at 17:1 and on the other
  // at 1.18:1. No amount of foreground tuning fixes that, so the GRADIENT is
  // what gets constrained: a second stop that crosses the light/dark divide is
  // pulled back toward bg until both ends live on the same side.
  //
  // The theme extractor already keeps bg2 within ±10-12% lightness of bg, so
  // this is a guard against bg2 arriving raw from brandColors, not a change to
  // the normal path — an on-brand subtle gradient is untouched.
  const bg2 = clampGradientStop(bg, colors.bg2);
  // Every derived colour must clear BOTH stops.
  const stops = [bg2];

  // The brand's own text color is CLAMPED, not trusted. The old fallback
  // (`colors.text || readableOn(bg)`) fired only when text was absent — a text
  // color that was present but unreadable against its own background passed
  // through untouched, which is the worst version of this bug.
  const rawText = colors.text || readableOn(bg);
  const text = ensureContrast(rawText, bg, AA_CONTRAST, stops);

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

  // `muted` is BODY TEXT, not decoration — the footer, every stat card's label,
  // eyebrows and quote attributions all use it. It used to be a flat 50/50 blend
  // of bg and text, whose contrast is roughly the square root of the brand's own
  // bg/text ratio: it degraded fastest on exactly the brands that could least
  // afford it (measured 1.75:1 on a red brand, 2.07:1 on a muted brown, and AA
  // failures on 342 of 3000 random brands whose own bg/text passed).
  //
  // Now: start at the same 50/50 so a high-contrast brand keeps the identical
  // colour it had before, and walk toward `text` only as far as AA requires.
  const muted = ensureContrast(
    mixHex(bg, tr, tg, tb, 0.5),
    bg,
    AA_CONTRAST,
    stops,
  );

  // The brand accent as TEXT. The fill colour stays untouched (a brand's accent
  // is its accent), but accent-coloured type — SceneFrame's eyebrow,
  // HighlightPhrase's key words — went through no contrast check at all.
  const accentText = ensureContrast(accent, bg, AA_CONTRAST, stops);

  const grid = withAlpha(text, dark ? 0.12 : 0.1);

  // Brand-tinted secondary/tertiary chart series: rotate the accent toward
  // text and bg so multi-series charts stay on-brand without clashing.
  const series2 = blend(accent, text, 0.35);
  const series3 = blend(accent, dark ? "#FFFFFF" : "#000000", 0.25);

  return {
    accent,
    accentText,
    bg,
    bg2,
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
  /**
   * Supporting copy tier: card body, bullet body, list items, table cells.
   *
   * This tier had no name, so every component that needed it reached for a
   * literal instead — which is precisely why the editor's body slider moved
   * one paragraph and nothing else. It sits just under `body` so supporting
   * text reads as secondary without dropping to caption size.
   */
  prop: number;
  /** Eyebrow / kicker / small-caps labels. */
  label: number;
  /**
   * Persistent chrome: masthead, panel numbers, editorial-rule labels.
   *
   * Small by design, but on the scale rather than off it — these were raw px
   * literals (20/22) that no slider could reach.
   */
  micro: number;
  /** Big numeral for stat displays. */
  numeral: number;
}

/**
 * Hard px bounds per role, mirroring `_TYPE_FLOOR` / `_TYPE_CEILING` in
 * backend/app/services/code_generator.py.
 *
 * The frontend scale and the backend prompt bands were two independent
 * opinions about the same numbers: the backend told the model "headline =
 * body x ratio^3, capped at 88px landscape / 60px portrait", while this file
 * computed `title = body * 2.2` with no cap at all. A scene that omitted
 * `fontSize` on <FitText> silently got the uncapped one. These bounds are the
 * single place the two are reconciled — keep them in sync with the Python.
 */
const TYPE_BOUNDS = {
  title: { landscape: [48, 88], portrait: [36, 60] },
  body: { landscape: [28, 44], portrait: [26, 38] },
  prop: { landscape: [22, 44], portrait: [20, 38] },
  micro: { landscape: [16, 28], portrait: [16, 28] },
} as const;

/** Clamp a computed size into [floor, ceiling], rounded to a whole px. */
export function clampToBand(
  size: number,
  role: keyof typeof TYPE_BOUNDS,
  isPortrait: boolean,
): number {
  const [floor, ceiling] = TYPE_BOUNDS[role][isPortrait ? "portrait" : "landscape"];
  return Math.round(Math.max(floor, Math.min(size, ceiling)));
}

/**
 * Portrait-aware type scale derived off a single base body size. Ratios match
 * the hierarchy observed across the polished templates (title ≈ 2×, numeral ≈
 * 3×, label ≈ 0.55× body). Pass user overrides (titleFontSize /
 * descriptionFontSize) to honor Settings without losing the scale.
 *
 * PORTRAIT IS SMALLER, NOT LARGER. This used to read `body = isPortrait ? 42 :
 * 34` with a 2.1x portrait title multiplier, so a default portrait title landed
 * near 88px against a backend ceiling of 60 — on a canvas that is 1080 wide
 * rather than 1920. The narrower frame gets the smaller type.
 */
export function typeScale(
  isPortrait: boolean,
  overrides?: { title?: number; body?: number; label?: number },
): TypeScale {
  const body = overrides?.body ?? (isPortrait ? 32 : 34);
  // Clamped so an extreme titleFontSize override cannot produce a headline that
  // breaks mid-word or spills off the canvas.
  const title = clampToBand(
    overrides?.title ?? body * (isPortrait ? 1.7 : 2.2),
    "title",
    isPortrait,
  );
  return {
    body,
    title,
    hero: Math.round(title * 1.25),
    subtitle: Math.round(body * 1.18),
    caption: Math.round(body * 0.82),
    prop: clampToBand(body * 0.9, "prop", isPortrait),
    // The eyebrow tracks the body size by default, but takes an explicit
    // override when the user sets one — that is the editor's "Title font size"
    // slider, which targets the scene's short title (props.sceneTitle).
    label: overrides?.label ?? Math.round(body * 0.56),
    micro: clampToBand(body * 0.62, "micro", isPortrait),
    numeral: Math.round(body * (isPortrait ? 2.6 : 3.0)),
  };
}
