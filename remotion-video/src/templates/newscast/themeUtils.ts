export const DEFAULT_NEWSCAST_ACCENT = "#E82020";
export const DEFAULT_NEWSCAST_TEXT = "#B8C8E0";

export function toRgba(hex: string | undefined, alpha: number, fallback = DEFAULT_NEWSCAST_ACCENT): string {
  const input = (hex || fallback).trim().replace("#", "");
  const normalized =
    input.length === 3
      ? input
          .split("")
          .map((c) => c + c)
          .join("")
      : input;
  const safe = /^[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback.replace("#", "");
  const r = Number.parseInt(safe.slice(0, 2), 16);
  const g = Number.parseInt(safe.slice(2, 4), 16);
  const b = Number.parseInt(safe.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Multiplier for all newscast text when `height > width` (e.g. 720×1280). Tune in one place. */
export const NEWSCAST_PORTRAIT_TYPE_SCALE = 1.16;

/** Extra scale on template default title sizes in portrait when project `titleFontSize` is unset. */
export const NEWSCAST_PORTRAIT_DEFAULT_TITLE_BOOST = 1.12;

/** Extra scale on template default body/display sizes in portrait when project `descriptionFontSize` is unset. */
export const NEWSCAST_PORTRAIT_DEFAULT_DESCRIPTION_BOOST = 1.1;

export function getNewscastPortraitTypeScale(width: number, height: number): number {
  return height > width ? NEWSCAST_PORTRAIT_TYPE_SCALE : 1;
}

export function scaleNewscastPx(px: number, scale: number): number {
  return Math.round(px * scale * 10) / 10;
}

export function resolveNewscastTitleSize(
  titleFontSize: number | undefined,
  defaultSize: number,
  portraitScale = 1,
): number {
  const n = Number(titleFontSize);
  const usesProjectTitle = Number.isFinite(n) && n > 0;
  const defaultBoost = portraitScale > 1 && !usesProjectTitle ? NEWSCAST_PORTRAIT_DEFAULT_TITLE_BOOST : 1;
  const resolved = !usesProjectTitle
    ? defaultSize * defaultBoost
    : Math.max(10, defaultSize * (n / 76));
  return Math.max(10, resolved * portraitScale);
}

export function resolveNewscastDescriptionSize(
  descriptionFontSize: number | undefined,
  defaultSize: number,
  portraitScale = 1,
): number {
  const n = Number(descriptionFontSize);
  const usesProjectDescription = Number.isFinite(n) && n > 0;
  const defaultBoost = portraitScale > 1 && !usesProjectDescription ? NEWSCAST_PORTRAIT_DEFAULT_DESCRIPTION_BOOST : 1;
  const resolved = !usesProjectDescription
    ? defaultSize * defaultBoost
    : Math.max(8, defaultSize * (n / 34));
  return Math.max(8, resolved * portraitScale);
}

export type NewscastFontRole = "title" | "body" | "label" | "mono";

/**
 * When project `fontFamily` is set (global font in settings), use it for all newscast text.
 * Otherwise use the template’s stacked broadcast fonts.
 */
export function newscastFont(projectFontFamily: string | undefined, role: NewscastFontRole): string {
  const u = projectFontFamily?.trim();
  if (u) return u;
  switch (role) {
    case "title":
      return '"Oswald", sans-serif';
    case "body":
      return '"Barlow Condensed", sans-serif';
    case "label":
      return '"Rajdhani", sans-serif';
    case "mono":
      return '"Fira Code", ui-monospace, monospace';
    default:
      return '"Barlow Condensed", sans-serif';
  }
}
