import { FONT_REGISTRY } from "./registry";

/** Captions always use Inter — independent of the project font setting. */
export const CAPTION_FONT_FAMILY = FONT_REGISTRY.inter.cssFamily;

const loadCache = new Map<string, Promise<void>>();

/** Wait for caption weights (400/600/700) before Remotion captures frames. */
export async function ensureCaptionFontLoaded(cssFamily: string): Promise<void> {
  const primary =
    cssFamily.split(",")[0]?.replace(/['"]/g, "").trim() ?? "";
  if (!primary) return;

  const safeLoad = (spec: string) => {
    try {
      return document.fonts.load(spec).catch(() => undefined);
    } catch {
      return Promise.resolve(undefined);
    }
  };

  await Promise.all([
    safeLoad(`400 16px "${primary}"`),
    safeLoad(`600 16px "${primary}"`),
    safeLoad(`700 16px "${primary}"`),
  ]);
  await document.fonts.ready;
}

export function getCaptionFontLoadPromise(cssFamily: string): Promise<void> {
  let promise = loadCache.get(cssFamily);
  if (!promise) {
    promise = ensureCaptionFontLoaded(cssFamily);
    loadCache.set(cssFamily, promise);
  }
  return promise;
}
