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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function estimateGlyphUnits(text: string): number {
  const raw = String(text ?? "").trim();
  if (!raw) return 1;
  let units = 0;
  for (const ch of raw) {
    if (/[0-9]/.test(ch)) units += 1;
    else if (/[.,:%+\-/$]/.test(ch)) units += 0.62;
    else if (/[A-Za-z]/.test(ch)) units += 0.88;
    else if (/\s/.test(ch)) units += 0.48;
    else units += 0.9;
  }
  return Math.max(1, units);
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

export function resolveNewscastNumberScale(
  descriptionFontSize: number | undefined,
  portraitScale = 1,
  damp = 0.72,
  minScale = 0.84,
  maxScale = 1.24,
): number {
  const baseDefault = 34;
  const resolvedDescription = resolveNewscastDescriptionSize(descriptionFontSize, baseDefault, portraitScale);
  const defaultDescription = baseDefault * portraitScale;
  const ratio = defaultDescription > 0 ? resolvedDescription / defaultDescription : 1;
  const damped = Math.pow(Math.max(0.01, ratio), damp);
  return clamp(damped, minScale, maxScale);
}

export function resolveNewscastNumberFitScale({
  text,
  fontPx,
  maxWidth,
  maxHeight,
  lineHeight = 1,
  paddingX = 0,
  paddingY = 0,
  minScale = 0.58,
  maxScale = 1,
}: {
  text: string;
  fontPx: number;
  maxWidth: number;
  maxHeight?: number;
  lineHeight?: number;
  paddingX?: number;
  paddingY?: number;
  minScale?: number;
  maxScale?: number;
}): number {
  const safeWidth = Math.max(1, maxWidth - paddingX * 2);
  const safeHeight = Math.max(1, (maxHeight ?? Number.POSITIVE_INFINITY) - paddingY * 2);
  const glyphUnits = estimateGlyphUnits(text);
  const estimatedWidth = Math.max(1, fontPx * glyphUnits * 0.62);
  const estimatedHeight = Math.max(1, fontPx * lineHeight);
  const widthScale = safeWidth / estimatedWidth;
  const heightScale = Number.isFinite(safeHeight) ? safeHeight / estimatedHeight : 1;
  return clamp(Math.min(widthScale, heightScale), minScale, maxScale);
}

export function resolveNewscastNumberFontPx({
  basePx,
  descriptionFontSize,
  portraitScale = 1,
  text,
  maxWidth,
  maxHeight,
  lineHeight = 1,
  proportionalDamp = 0.72,
  proportionalMin = 0.84,
  proportionalMax = 1.24,
  fitMin = 0.58,
  fitMax = 1,
  paddingX = 0,
  paddingY = 0,
}: {
  basePx: number;
  descriptionFontSize: number | undefined;
  portraitScale?: number;
  text: string;
  maxWidth: number;
  maxHeight?: number;
  lineHeight?: number;
  proportionalDamp?: number;
  proportionalMin?: number;
  proportionalMax?: number;
  fitMin?: number;
  fitMax?: number;
  paddingX?: number;
  paddingY?: number;
}): number {
  const baseScaled = scaleNewscastPx(basePx, portraitScale);
  const proportionalScale = resolveNewscastNumberScale(
    descriptionFontSize,
    portraitScale,
    proportionalDamp,
    proportionalMin,
    proportionalMax,
  );
  const fittedScale = resolveNewscastNumberFitScale({
    text,
    fontPx: baseScaled * proportionalScale,
    maxWidth,
    maxHeight,
    lineHeight,
    minScale: fitMin,
    maxScale: fitMax,
    paddingX,
    paddingY,
  });
  return Math.round(baseScaled * proportionalScale * fittedScale * 10) / 10;
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
