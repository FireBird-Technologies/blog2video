/**
 * Snowy Christmas — shared palette, fonts + maths helpers.
 *
 * A bright winter day: icy sky (bg), deep winter navy ink (text) and Christmas red
 * (accent). The festive constants (pine, gold, snow) stay fixed so the scene always
 * reads as Christmas; every other tone is mixed from the three project colours.
 *
 * Mirror byte-identical in all three trees:
 *   remotion-video/src/templates/christmas/
 *   frontend/src/components/remotion/christmas/
 *   frontend-pdf2video/src/components/remotion/christmas/
 */
import "@fontsource/berkshire-swash/400.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/800.css";

export const CHRISTMAS_DEFAULTS = {
  accent: "#D62839", // Christmas red
  bg: "#EAF4FB", // icy winter sky
  text: "#12324A", // deep winter navy
} as const;

/** Fixed festive tones (not user colours) so every scene still reads as Christmas. */
export const FESTIVE = {
  pine: "#1F7A4D",
  pineDark: "#14553A",
  gold: "#E8B746",
  goldLight: "#F7DC8A",
  snow: "#FFFFFF",
  /** Blue-grey shading that keeps white snow visible on a bright sky. */
  snowShade: "#A9C3D9",
  wood: "#8A5A3B",
  woodDark: "#5E3B25",
  skin: "#F4C7A1",
  cheek: "#EE9A8E",
} as const;

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

/** Relative luminance 0..1 (unparseable colours count as light). */
export const luminance = (color: string): number => {
  const rgb = parseColor(color);
  if (!rgb) return 1;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Deterministic 0..1 noise from (seed, n) — never Math.random (renders must be
 * repeatable frame to frame and machine to machine).
 */
export const christmasRand = (seed: number, n = 0): number => {
  const v = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/** Resolved scene palette: sky, ink, accent + derived winter shades. */
export const winterPalette = (props: { accentColor?: string; bgColor?: string; textColor?: string }) => {
  const sky = props.bgColor || CHRISTMAS_DEFAULTS.bg;
  const ink = props.textColor || CHRISTMAS_DEFAULTS.text;
  const accent = props.accentColor || CHRISTMAS_DEFAULTS.accent;
  const darkSky = luminance(sky) < 0.35;
  return {
    sky,
    ink,
    accent,
    /** Upper sky — deeper so white flakes read against it. */
    skyTop: mix(sky, ink, darkSky ? 0.1 : 0.2),
    /** Near the horizon — almost white haze. */
    skyLow: mix(sky, FESTIVE.snow, darkSky ? 0.05 : 0.55),
    inkSoft: withOpacity(ink, 0.8),
    inkFaint: withOpacity(ink, 0.16),
    accentDark: mix(accent, "#000000", 0.28),
    accentLight: mix(accent, FESTIVE.snow, 0.55),
    /** Snow ground + drifts. */
    snow: FESTIVE.snow,
    snowShade: mix(FESTIVE.snowShade, sky, 0.25),
    /** Distant hills / far treeline — hazy, tinted by the sky. */
    farHill: mix(sky, FESTIVE.snowShade, 0.55),
    farPine: mix(FESTIVE.pine, sky, 0.62),
    nearPine: mix(FESTIVE.pine, sky, 0.18),
    /** Frosted card surface for text. */
    card: withOpacity(FESTIVE.snow, 0.86),
    cardEdge: withOpacity(mix(FESTIVE.snowShade, ink, 0.2), 0.55),
    shadow: withOpacity(mix(ink, "#000000", 0.4), 0.22),
  };
};

export type WinterPalette = ReturnType<typeof winterPalette>;

export const isPortraitScene = (aspectRatio: string | undefined, width: number, height: number) =>
  aspectRatio === "portrait" || height > width;

// ─── Per-scene looks ─────────────────────────────────────────────────────────

export type TreeArrangement = "both-edges" | "left-cluster" | "right-cluster" | "staggered" | "tall-pair" | "sparse";

/**
 * How one scene's winter backdrop looks: snow speed / intensity / drift and the
 * arrangement + height of the pines. Each scene in a video gets its own look (see
 * components/SceneLook.ts) so no two neighbouring scenes share a background.
 */
export type SceneLook = {
  snow: {
    /** Fall-speed multiplier. */
    speed: number;
    /** Flake-count multiplier (LayeredSnow). */
    density: number;
    /** Constant sideways drift (px per frame at 1080p); negative blows left. */
    wind: number;
    /** Flake-size multiplier. */
    flake: number;
  };
  trees: {
    arrangement: TreeArrangement;
    /** Near-pine height multiplier. */
    scale: number;
    /** Far-pine count multiplier. */
    farDensity: number;
  };
  /** Distant ridge height multiplier. */
  hillHeight: number;
};

export const SCENE_LOOKS: SceneLook[] = [
  // 0 — gentle snow, pines on both edges
  { snow: { speed: 0.7, density: 0.8, wind: 0.15, flake: 1 }, trees: { arrangement: "both-edges", scale: 1, farDensity: 1 }, hillHeight: 1 },
  // 1 — flurry blowing right, tall cluster on the left
  { snow: { speed: 1.5, density: 1.3, wind: 1.4, flake: 0.9 }, trees: { arrangement: "left-cluster", scale: 1.25, farDensity: 0.8 }, hillHeight: 0.85 },
  // 2 — slow big flakes, small cluster on the right
  { snow: { speed: 0.55, density: 0.6, wind: 0, flake: 1.35 }, trees: { arrangement: "right-cluster", scale: 0.85, farDensity: 1.2 }, hillHeight: 1.1 },
  // 3 — steady snow, alternating small / tall pines on both edges
  { snow: { speed: 1.1, density: 1, wind: 0.35, flake: 1 }, trees: { arrangement: "staggered", scale: 1.1, farDensity: 1.4 }, hillHeight: 0.95 },
  // 4 — breezy, blowing left; one tall pine at each far edge
  { snow: { speed: 1, density: 1.15, wind: -1.1, flake: 0.95 }, trees: { arrangement: "tall-pair", scale: 1.45, farDensity: 0.9 }, hillHeight: 1.2 },
  // 5 — light snow, sparse small pines, higher hills
  { snow: { speed: 0.8, density: 0.7, wind: -0.3, flake: 1.1 }, trees: { arrangement: "sparse", scale: 0.8, farDensity: 0.5 }, hillHeight: 1.45 },
];

/**
 * Near-pine slots for an arrangement: x as a share of the width (always within the
 * outer ~22% so the middle stays clear for content) and a relative height.
 */
export const TREE_SLOTS: Record<TreeArrangement, Array<[number, number]>> = {
  "both-edges": [[0.06, 1], [0.15, 0.8], [0.86, 0.9], [0.95, 1.1]],
  "left-cluster": [[0.03, 1.15], [0.09, 0.8], [0.15, 1], [0.21, 0.7]],
  "right-cluster": [[0.79, 0.7], [0.85, 1], [0.91, 0.8], [0.97, 1.15]],
  staggered: [[0.04, 1.2], [0.12, 0.65], [0.2, 0.95], [0.81, 0.7], [0.89, 1.25], [0.97, 0.8]],
  "tall-pair": [[0.06, 1], [0.94, 1]],
  sparse: [[0.1, 0.7], [0.9, 0.6]],
};
