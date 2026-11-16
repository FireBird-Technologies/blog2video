/**
 * Crumpled Paper — shared palette + maths helpers.
 *
 * Every colour in a scene is derived from the three project colours (paper = bg,
 * graphite = text, red pencil = accent), so a re-coloured project still reads as
 * one sheet of paper.
 *
 * Mirror byte-identical in both trees:
 *   remotion-video/src/templates/crumpled/
 *   frontend/src/components/remotion/crumpled/
 */
import "@fontsource/caveat/400.css";
import "@fontsource/caveat/500.css";
import "@fontsource/caveat/600.css";
import "@fontsource/caveat/700.css";

export const CRUMPLED_DEFAULTS = {
  accent: "#8b5a2b", // brown pencil
  bg: "#f9f5ec", // light cream paper, near white
  text: "#000000", // pure black ink
} as const;

/** The empty space behind the paper (seen in exits, the opening ball, the airplane). */
export const CRUMPLED_DESK = "#ffffff";

/**
 * The tone the paper's own creases, grain and vignette are shaded with — a soft
 * graphite, deliberately NOT the text colour, so dark (e.g. pure black) text does
 * not make the paper itself look dark.
 */
export const PAPER_SHADE = "#625b53";

export const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

/** Parses #rgb, #rrggbb, #rrggbbaa and rgb()/rgba() into [r, g, b]; anything else is null. */
export const parseColor = (color: string): [number, number, number] | null => {
  const value = String(color || "").trim();
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return [0, 2, 4].map((o) => Number.parseInt(h.slice(o, o + 2), 16)) as [number, number, number];
  }
  const fn = value.match(/^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/i);
  return fn ? ([1, 2, 3].map((i) => Math.min(255, Number(fn[i]))) as [number, number, number]) : null;
};

/** `color` at the given opacity (0-1). Works for hex/rgb and falls back to color-mix. */
export const withOpacity = (color: string, opacity: number): string => {
  const rgb = parseColor(color);
  const a = Math.max(0, Math.min(1, opacity));
  return rgb
    ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`
    : `color-mix(in srgb, ${color} ${Math.round(a * 100)}%, transparent)`;
};

/** Mix two colours (t = 0 gives `a`, t = 1 gives `b`). Falls back to `a` for unparseable input. */
export const mix = (a: string, b: string, t: number): string => {
  const x = parseColor(a);
  const y = parseColor(b);
  if (!x || !y) return a;
  const ch = (i: number) => Math.round(x[i] + (y[i] - x[i]) * t).toString(16).padStart(2, "0");
  return `#${ch(0)}${ch(1)}${ch(2)}`;
};

/** Deterministic 0..1 noise from a number — never Math.random (renders must be repeatable). */
export const rand = (n: number): number => {
  const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/** Resolved scene palette: paper, graphite, red pencil + derived shades. */
export const paperPalette = (props: { accentColor?: string; bgColor?: string; textColor?: string }) => {
  const paper = props.bgColor || CRUMPLED_DEFAULTS.bg;
  const ink = props.textColor || CRUMPLED_DEFAULTS.text;
  const accent = props.accentColor || CRUMPLED_DEFAULTS.accent;
  return {
    paper,
    ink,
    accent,
    /** Soft pencil for secondary copy. */
    inkSoft: withOpacity(ink, 0.78),
    /** Faint graphite for rules, grids and hatching. */
    inkFaint: withOpacity(ink, 0.18),
    /** Shadow side of a crease. */
    crease: mix(paper, ink, 0.16),
    /** Lit side of a crease. */
    highlight: mix(paper, "#ffffff", 0.7),
    /** Sticky-note / scrap tint. */
    scrap: mix(paper, accent, 0.1),
    tape: withOpacity(mix(paper, "#e8dcb4", 0.6), 0.78),
  };
};

export type PaperPalette = ReturnType<typeof paperPalette>;

export const isPortraitScene = (aspectRatio: string | undefined, width: number, height: number) =>
  aspectRatio === "portrait" || height > width;
