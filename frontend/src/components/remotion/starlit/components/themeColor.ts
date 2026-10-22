/** Theme-colour helpers: every light/dark colour in a Starlit scene is derived from the scene's text, background and accent colours. */
/** Parses #rgb, #rrggbb, #rrggbbaa and rgb()/rgba() into [r, g, b]; anything else is null. */
export const parseThemeColor = (color: string): [number, number, number] | null => {
  const value = String(color || "").trim();
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return [0, 2, 4].map((o) => Number.parseInt(h.slice(o, o + 2), 16)) as [number, number, number];
  }
  const fn = value.match(/^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/i);
  return fn ? [1, 2, 3].map((i) => Math.min(255, Number(fn[i]))) as [number, number, number] : null;
};
const parse = parseThemeColor;

/** `color` at the given opacity (0-1). Works for hex and for any other CSS colour. */
export const withOpacity = (color: string, opacity: number): string => {
  const rgb = parse(color);
  const a = Math.max(0, Math.min(1, opacity));
  return rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})` : `color-mix(in srgb, ${color} ${Math.round(a * 100)}%, transparent)`;
};

/** Mix two colours (t = 0 gives `a`, t = 1 gives `b`). Falls back to `a` when either is not a hex colour. */
export const mixTheme = (a: string, b: string, t: number): string => {
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return a;
  const ch = (i: number) => Math.round(x[i] + (y[i] - x[i]) * t).toString(16).padStart(2, "0");
  return `#${ch(0)}${ch(1)}${ch(2)}`;
};
