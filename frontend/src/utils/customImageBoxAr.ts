import type { Project, Scene } from "../api/client";

type ArEntry = string | { landscape?: string; portrait?: string } | undefined;

/**
 * Resolve the image-box CSS aspect-ratio string for a custom-template scene.
 *
 * Lookup priority:
 *   1. Template-level ratioMap (project.custom_image_box_aspect_ratios) — keyed
 *      by sceneType + contentVariantIndex (or position-based fallback if those
 *      aren't yet on the descriptor — e.g. the project hasn't been rendered
 *      since the template was generated).
 *   2. Per-scene injected layoutProps.imageBoxAspectRatio — set during render
 *      by remotion.py for the project's actual orientation.
 *   3. Hard fallback based on project orientation ("16 / 9" or "9 / 16").
 */
export function resolveCustomImageBoxAr(
  scene: Scene,
  project: Project,
): string {
  const orientation = project.aspect_ratio === "portrait" ? "portrait" : "landscape";
  const orientationFallback = orientation === "portrait" ? "9 / 16" : "16 / 9";

  const pickAr = (entry: ArEntry): string | null => {
    if (!entry) return null;
    if (typeof entry === "string") return entry.trim() || null;
    return entry[orientation] || entry.landscape || entry.portrait || null;
  };

  let sceneType: string | null = null;
  let variantIdx: number | null = null;
  let perSceneAr: string | null = null;
  try {
    const desc = JSON.parse(scene.remotion_code || "{}") as {
      sceneTypeOverride?: string;
      contentVariantIndex?: number;
      layoutProps?: { imageBoxAspectRatio?: string };
    };
    sceneType = desc.sceneTypeOverride ?? null;
    variantIdx = typeof desc.contentVariantIndex === "number" ? desc.contentVariantIndex : null;
    perSceneAr = desc.layoutProps?.imageBoxAspectRatio ?? null;
  } catch { /* ignore */ }

  const ratioMap = project.custom_image_box_aspect_ratios || null;
  const contentRatios = (ratioMap && Array.isArray(ratioMap.content)) ? ratioMap.content : [];

  // Position-based fallback when descriptor lacks sceneType / variantIdx.
  // This matters for fresh projects that haven't been rendered yet.
  if (!sceneType || (sceneType === "content" && variantIdx === null)) {
    const sortedScenes = [...(project.scenes || [])].sort((a, b) => a.order - b.order);
    const idx = sortedScenes.findIndex((s) => s.id === scene.id);
    if (idx >= 0 && sortedScenes.length > 0) {
      if (!sceneType) {
        if (sortedScenes.length === 1) sceneType = "intro";
        else if (idx === 0) sceneType = "intro";
        else if (idx === sortedScenes.length - 1) sceneType = "outro";
        else sceneType = "content";
      }
      if (sceneType === "content" && variantIdx === null && contentRatios.length > 0) {
        // Content scenes occupy positions 1..N-2; cycle through variants.
        const contentPos = Math.max(0, idx - 1);
        variantIdx = contentPos % contentRatios.length;
      }
    }
  }

  let lookedUp: string | null = null;
  if (ratioMap) {
    if (sceneType === "intro") lookedUp = pickAr(ratioMap.intro);
    else if (sceneType === "outro") lookedUp = pickAr(ratioMap.outro);
    else if (sceneType === "content" && variantIdx !== null) {
      lookedUp = pickAr(contentRatios[variantIdx]);
    }
  }

  return lookedUp || perSceneAr || orientationFallback;
}
