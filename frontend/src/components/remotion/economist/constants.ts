/**
 * Economist template — palette, chart series, per-layout duration floors, and
 * small colour helpers. Tuned to the reference images (intro.jpg, linechart1.png,
 * linechart2.jpeg, prosandcons.jpeg, common.jpg): warm paper, near-black ink,
 * one decisive Economist red, a deep Economist blue, and grey context lines.
 */
import type { EconomistLayoutType } from "./types";

export const ECONOMIST_COLORS = {
  /** Economist red — masthead flag, rules, the primary chart series, CONS. */
  accent: "#E3120B",
  /** Economist blue — secondary chart series, PROS. */
  blue: "#006BA6",
  /** Warm paper background. */
  paper: "#F6F4EE",
  /** Near-black ink for body + headlines. */
  ink: "#1A1A1A",
  /** Black zero / baseline line on charts. */
  zero: "#1A1A1A",
  /** Grey "context" lines behind highlighted series (as in linechart1). */
  context: "#B7B7B7",
  /** Hairline rule colour on paper. */
  rule: "#D6D2C6",
  /** Light gridline colour on charts. */
  grid: "#E2DED3",
  /** Muted ink for captions, source lines, datelines. */
  muted: "#6E6A60",
  /** Paper panel slightly darker than bg, for inset cards. */
  panel: "#EFECE3",
} as const;

/**
 * Chart series palette — ordered for contrast and matched to the references
 * (a bright red, a navy, a coral, a blue, then olive/gold). Series beyond the
 * highlighted set render in `context` grey.
 */
export const ECONOMIST_CHART_SERIES = [
  "#E3120B", // bright red
  "#1A476F", // deep navy
  "#F0746E", // coral
  "#006BA6", // blue
  "#7A9A01", // olive
  "#DB9E36", // gold
] as const;

/**
 * Per-layout minimum scene durations (frames @ 30fps). Each layout has
 * hardcoded animation timings; if `durationSeconds` is shorter than the
 * layout's natural arc the content gets cut off mid-reveal. These floors
 * guarantee room to play the intro, hold the content, and fade out.
 *
 *   cover_reveal — ~10s cinematic multi-act hero (photo → masthead → teasers →
 *     dateline → headline assembling → page-lift wind-up).
 *   chart_line   — left→right line draw-on (~max(54, fps*3.2)=96f) + end-labels + hold.
 *   chart_bar / data_table — staggered grow-in + value labels + hold.
 */
export const LAYOUT_MIN_FRAMES: Record<EconomistLayoutType, number> = {
  cover_reveal: 300,
  chart_line: 210,
  chart_bar: 200,
  data_table: 200,
  pros_cons: 200,
  key_indicators: 200,
  ending_socials: 200,
  leader_article: 170,
  leader_quote: 170,
  image_feature: 170,
  section_divider: 150,
};

/** Layouts that do not show a cover/inset photo. */
export const LAYOUTS_WITHOUT_IMAGE: EconomistLayoutType[] = [
  "section_divider",
  "chart_line",
  "chart_bar",
  "data_table",
  "pros_cons",
  "key_indicators",
  "leader_quote",
  "ending_socials",
];

// ── Colour helpers ───────────────────────────────────────────────────────────

function clamp8(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const num = parseInt(full, 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

function toHex(r: number, g: number, b: number): string {
  return (
    "#" +
    ((1 << 24) | (clamp8(r) << 16) | (clamp8(g) << 8) | clamp8(b))
      .toString(16)
      .slice(1)
  );
}

/** Lighten a hex colour by `amt` (0..1) toward white. */
export const lighten = (hex: string, amt: number): string => {
  const [r, g, b] = parseHex(hex);
  return toHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
};

/** Darken a hex colour by `amt` (0..1) toward black. */
export const darken = (hex: string, amt: number): string => {
  const [r, g, b] = parseHex(hex);
  return toHex(r * (1 - amt), g * (1 - amt), b * (1 - amt));
};

/** Mix two hex colours, `t` = 0 → a, 1 → b. */
export const mixHex = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
};

/**
 * Derive paper-toned chrome shades from the user's bg/text overrides so the
 * template still reads "Economist" when colours are customised.
 */
export const derivePalette = (bg: string, text: string) => ({
  paperHi: lighten(bg, 0.05),
  paperLo: darken(bg, 0.06),
  rule: mixHex(bg, text, 0.16),
  grid: mixHex(bg, text, 0.1),
  muted: mixHex(bg, text, 0.55),
  panel: darken(bg, 0.03),
});
