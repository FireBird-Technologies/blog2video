/** Shared RGB helpers for Blackswan neon SVG, water, stars, birds, droplets. */

const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

export function parseHex(hex: string): { r: number; g: number; b: number } {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length < 6) h = h.padEnd(6, "0");
  const n = parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n)) return { r: 0, g: 229, b: 255 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function mixRgb(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
): { r: number; g: number; b: number } {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

export function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  return `#${[r, g, b]
    .map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function rgbaFromHex(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${a})`;
}

/** Ladder of hex colors derived from the scene accent (cyan defaults preserved at #00E5FF). */
export function blackswanNeonPalette(accentColor: string) {
  const core = parseHex(accentColor);
  return {
    core: accentColor,
    bright: toHex(mixRgb(core, WHITE, 0.78)),
    vivid: toHex(mixRgb(core, WHITE, 0.52)),
    light: toHex(mixRgb(core, WHITE, 0.32)),
    hint: toHex(mixRgb(core, WHITE, 0.18)),
    soft: toHex(mixRgb(core, BLACK, 0.08)),
    mid: toHex(mixRgb(core, BLACK, 0.18)),
    dim: toHex(mixRgb(core, BLACK, 0.28)),
    deep: toHex(mixRgb(core, BLACK, 0.4)),
    abyss: toHex(mixRgb(core, BLACK, 0.52)),
    waterLo: toHex(mixRgb(core, BLACK, 0.32)),
  };
}
