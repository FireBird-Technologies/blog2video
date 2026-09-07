/**
 * Resolve a custom-template scene's DEFAULT type sizes.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `scene_font_defaults` is stored per template as
 * `{intro, content: [...], outro}`, indexed like `content_codes`. Four surfaces
 * need to turn that into one pair of numbers for one scene, and before this
 * file each did it differently — or not at all:
 *
 *   the exported MP4      services/remotion.py, by role + contentVariantIndex
 *   the gallery preview   CustomPreview.tsx, by role + content index
 *   the project preview   NOTHING — it fell through to the literal baked into
 *                         the generated code, so the preview and the MP4
 *                         disagreed about type size on every template that has
 *                         stored defaults
 *   the editor's sliders  NOTHING — `resolveDefaultFontSizesForScene` fell all
 *                         the way through to LAYOUT_FONT_DEFAULTS.default, a
 *                         hardcoded 72/30 unrelated to the template. Because
 *                         the editor DELETES a value equal to "the default",
 *                         a user deliberately choosing 72 had it silently
 *                         dropped.
 *
 * One resolver, so those four cannot drift again.
 *
 * KEYED BY THE VARIANT THAT RENDERS THE SCENE, NOT BY POSITION. Which component
 * draws a scene is decided by archetype matching, so the scene at position 3 may
 * render `content_0` and must receive content_0's defaults. This mirrors
 * remotion.py exactly; the two must agree about what a scene IS.
 */
import type { SceneFontDefaultEntry } from "../api/client";
import type { Orientation } from "../components/remotion/generated/kit";

export interface SceneFontDefaults {
  intro?: SceneFontDefaultEntry | null;
  content?: (SceneFontDefaultEntry | null)[] | null;
  outro?: SceneFontDefaultEntry | null;
}

/** What a scene needs to say which stored entry belongs to it. */
export interface SceneFontLookup {
  /** "intro" | "outro" | "content" | a dataviz type. Absent = infer from index. */
  sceneType?: string | null;
  /** Which content variant renders this scene. Absent = `index - 1`. */
  contentVariantIndex?: number | null;
  /** The scene's position in the video, used only when the two above are absent. */
  index?: number;
  /** Total scenes, used only to recognise the last one as the outro. */
  total?: number;
}

/**
 * The stored entry for one scene, or null when the template predates these.
 *
 * Dataviz scenes are drawn by the deterministic kit rather than by generated
 * code, so they have no entry and must not borrow a neighbour's.
 */
export function sceneFontEntry(
  defaults: SceneFontDefaults | null | undefined,
  scene: SceneFontLookup,
): SceneFontDefaultEntry | null {
  if (!defaults) return null;

  const { sceneType, index = 0, total } = scene;
  if (sceneType === "dataviz_chart" || sceneType === "dataviz_table") return null;

  if (sceneType === "intro" || (!sceneType && index === 0)) {
    return defaults.intro ?? null;
  }
  if (
    sceneType === "outro" ||
    (!sceneType && typeof total === "number" && index === total - 1)
  ) {
    return defaults.outro ?? null;
  }

  const list = defaults.content;
  if (!Array.isArray(list)) return null;
  const raw = scene.contentVariantIndex;
  const ci = typeof raw === "number" && raw >= 0 ? raw : index - 1;
  return ci >= 0 && ci < list.length ? list[ci] ?? null : null;
}

/**
 * One scene's default sizes for one orientation, as a partial layoutConfig.
 *
 * Shaped to be spread UNDER a scene's stored `layoutConfig` — an explicit
 * per-scene override always wins over the template default:
 *
 *     resolveTypeSizes({ ...sceneFontConfig(...), ...scene.layoutConfig }, o, v)
 *
 * Returns `{}` rather than fabricated numbers when nothing is stored, so a
 * template that predates these still falls through to the literal in its
 * generated code, exactly as it does today.
 */
export function sceneFontConfig(
  defaults: SceneFontDefaults | null | undefined,
  scene: SceneFontLookup,
  orientation: Orientation,
): { titleFontSize?: number; descriptionFontSize?: number } {
  const entry = sceneFontEntry(defaults, scene);
  if (!entry) return {};

  const pick = (band: { landscape?: number; portrait?: number } | null | undefined) => {
    // Fall back to the landscape value rather than to nothing: a partially
    // written entry (one orientation set through the editor) should still size
    // the other, which is what the gallery preview already does.
    const v = band?.[orientation] ?? band?.landscape;
    return typeof v === "number" && v > 0 ? v : undefined;
  };

  const out: { titleFontSize?: number; descriptionFontSize?: number } = {};
  const title = pick(entry.title);
  const description = pick(entry.description);
  if (title !== undefined) out.titleFontSize = title;
  if (description !== undefined) out.descriptionFontSize = description;
  return out;
}
