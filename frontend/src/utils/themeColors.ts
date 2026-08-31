/**
 * Derived brand colours for the STATIC preview components.
 *
 * A custom template stores exactly three colours — bg, text, accent. Everything
 * else the video renderer needs (panel, header, border, muted, grid) is derived
 * by `derivePalette` in the craft kit, which takes only `{accent, bg, bg2, text}`.
 *
 * The hand-built preview components (CustomPreviewLandscape, the portrait
 * variant, the showcase) predate that and read `theme.colors.surface` /
 * `theme.colors.muted` directly. Rather than give them a fourth and fifth stored
 * colour to keep in sync — which is what let off-brand hues into templates —
 * they derive the same values here, using the SAME blend the kit uses so a
 * preview and the rendered video agree.
 *
 * Mirrors kit/theme.ts:
 *   panel  = dark ? mixHex(bg, text, 0.07) : mixHex(bg, black, 0.05)
 *   muted  = mixHex(bg, text, 0.5)   (the kit then walks it up to AA)
 */

function hexToRgb(hex: string): [number, number, number] {
  const h = (hex || "").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length < 6) return [0, 0, 0];
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function mix(base: string, r: number, g: number, b: number, amount: number): string {
  const [br, bg, bb] = hexToRgb(base);
  const to = (x: number, y: number) => Math.round(x + (y - x) * amount);
  return (
    "#" +
    [to(br, r), to(bg, g), to(bb, b)]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** True when a background is dark enough that panels tint toward the text. */
export function isDarkBg(bg: string): boolean {
  const [r, g, b] = hexToRgb(bg);
  // Rec-601 luma, the same rough test the kit uses to pick a direction.
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

type ThemeLike = { colors: { bg: string; text: string; accent: string; surface?: string; muted?: string } };

/**
 * A raised card/panel colour.
 *
 * Honours a legacy stored `surface` when one is present, so templates created
 * before the three-colour change look exactly as they did.
 */
export function themeSurface(theme: ThemeLike): string {
  if (theme.colors.surface) return theme.colors.surface;
  const { bg, text } = theme.colors;
  const [tr, tg, tb] = hexToRgb(text);
  return isDarkBg(bg) ? mix(bg, tr, tg, tb, 0.07) : mix(bg, 0, 0, 0, 0.05);
}

/** Secondary/label text — the 50/50 bg->text blend the kit starts from. */
export function themeMuted(theme: ThemeLike): string {
  if (theme.colors.muted) return theme.colors.muted;
  const { bg, text } = theme.colors;
  const [tr, tg, tb] = hexToRgb(text);
  return mix(bg, tr, tg, tb, 0.5);
}
