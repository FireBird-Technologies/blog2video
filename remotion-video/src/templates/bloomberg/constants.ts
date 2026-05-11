export const BLOOMBERG_DEFAULT_FONT_FAMILY = "'Share Tech Mono', monospace";

export const BLOOMBERG_COLORS = {
  bg: "#000000",
  amber: "#FFB340",
  accent: "#5EA2FF",
  neg: "#FF5A54",
  muted: "#7A5A20",
  border: "#3A2E10",
  panelBg: "#0A0800",
  headerBg: "#0F0A00",
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function mixHex(hex: string, r: number, g: number, b: number, amount: number): string {
  const [hr, hg, hb] = hexToRgb(hex);
  const nr = Math.round(hr + (r - hr) * amount);
  const ng = Math.round(hg + (g - hg) * amount);
  const nb = Math.round(hb + (b - hb) * amount);
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

// Returns palette colors derived from bgColor and textColor so all chrome scales
// with the user's chosen colors instead of being hardcoded amber/black.
export function derivePalette(bgColor: string, textColor?: string) {
  const bg = bgColor || BLOOMBERG_COLORS.bg;
  const text = textColor || BLOOMBERG_COLORS.amber;
  const [br, bg2, bb] = hexToRgb(bg);
  const [tr, tg, tb] = hexToRgb(text);
  const brightness = br + bg2 + bb;
  const isDark = brightness < 30;

  // headerBg: very close to bg — just a hint darker so the bar reads as a distinct
  // chrome element without looking like a different color.
  // panelBg: noticeably darker than bg so terminal panels stand out.
  // For near-black bgs use a tiny text-color tint so panels aren't identical to bg.
  const headerDark = isDark ? 0 : 0.12;
  const panelDark  = isDark ? 0 : 0.22;
  const headerTint = isDark ? 0.06 : 0;
  const panelTint  = isDark ? 0.04 : 0;

  const headerBase = mixHex(bg, 0, 0, 0, headerDark);
  const panelBase  = mixHex(bg, 0, 0, 0, panelDark);

  return {
    headerBg: headerTint > 0 ? mixHex(headerBase, tr, tg, tb, headerTint) : headerBase,
    panelBg:  panelTint  > 0 ? mixHex(panelBase,  tr, tg, tb, panelTint)  : panelBase,
    border:   mixHex(bg, tr, tg, tb, 0.14),
    muted:    mixHex(bg, tr, tg, tb, 0.47),
  };
}
