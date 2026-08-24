/**
 * Scene variants — sibling layout IDs that render the same scene in a different
 * visual style.
 *
 * A variant ID is `<base>__v2`, `<base>__v3`, … Variants share their base
 * layout's prop schema by construction (declared in the template's meta.json
 * `layout_variants`), which is why switching between them can preserve every
 * layoutProp untouched, and why all per-layout metadata — `layout_prop_schema`,
 * `layouts_without_image`, image box dims, font defaults — is keyed by BASE
 * layout and must be looked up through `baseLayoutId()`.
 */
import type { LayoutInfo } from "../api/client";

/**
 * Collapse a variant layout ID to its base. Pure string op, so it works in code
 * paths that have no fetched LayoutInfo. Non-variant IDs pass through unchanged.
 */
export function baseLayoutId(layoutId: string | null | undefined): string {
  if (!layoutId) return "";
  const sep = layoutId.indexOf("__");
  return sep === -1 ? layoutId : layoutId.slice(0, sep);
}

/** True when `layoutId` is a visual variant rather than a base layout. */
export function isVariantLayoutId(layoutId: string | null | undefined): boolean {
  return Boolean(layoutId) && layoutId!.includes("__");
}

/**
 * All style options for the layout family `layoutId` belongs to, base first.
 * Returns [] when the template declares no variants for it — callers use that
 * to hide the style strip entirely.
 */
export function variantsFor(
  layouts: LayoutInfo | null | undefined,
  layoutId: string | null | undefined,
): string[] {
  const base = baseLayoutId(layoutId);
  if (!base) return [];
  return layouts?.layout_variants?.[base] ?? [];
}

/** Short chip label for a variant, e.g. "Broadsheet". Falls back to "Style N". */
export function variantLabel(
  layouts: LayoutInfo | null | undefined,
  layoutId: string,
  index: number,
): string {
  return layouts?.layout_variant_labels?.[layoutId] ?? `Style ${index + 1}`;
}

/** True when both IDs belong to the same layout family (differ only by style). */
export function isSameLayoutFamily(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const baseA = baseLayoutId(a);
  return Boolean(baseA) && baseA === baseLayoutId(b);
}

/**
 * The layout id of a CUSTOM-template scene, from its stored descriptor.
 *
 * Mirrors the canonical backend resolver, `_descriptor_layout_name` in
 * `backend/app/routers/pipeline.py`, so the editor and the renderer agree on
 * what a scene is. Two surfaces previously rolled their own weaker versions:
 *
 *   * SceneEditModal required `sceneTypeOverride` to be present, and
 *   * ProjectView read only `descriptor.layout`,
 *
 * neither of which a custom intro/outro descriptor carried — so both resolved
 * to null. That made the modal show "Current layout" instead of Intro/Outro,
 * and made ProjectView treat the outro as image-capable (a null layout can't be
 * found in `layouts_without_image`), rendering an image picker on the one scene
 * that must never have one.
 *
 * `sceneIndex`/`totalScenes` enable the POSITIONAL fallback the renderer already
 * applies (first scene is the intro, last is the outro). It is what makes
 * projects generated before the scene type was persisted resolve correctly, so
 * pass them whenever they are known.
 */
export function customSceneLayoutId(
  remotionCode: string | null | undefined,
  sceneIndex?: number,
  totalScenes?: number,
): string | null {
  let desc: Record<string, unknown> | null = null;
  if (remotionCode) {
    try {
      const parsed: unknown = JSON.parse(remotionCode);
      if (parsed && typeof parsed === "object") desc = parsed as Record<string, unknown>;
    } catch {
      /* a malformed descriptor falls through to the positional rule below */
    }
  }

  if (desc) {
    const sceneType = (desc.sceneTypeOverride ?? desc.sceneType) as string | undefined;
    if (sceneType === "intro" || sceneType === "outro") return sceneType;
    if (sceneType === "content") {
      const idx = desc.contentVariantIndex;
      if (typeof idx === "number" && idx >= 0) return `content_${idx}`;
    }
    const cfg = desc.layoutConfig as { arrangement?: unknown } | undefined;
    if (cfg && typeof cfg.arrangement === "string") return cfg.arrangement;
    if (typeof desc.layout === "string") return desc.layout;
  }

  // Positional fallback — matches remotion.py and VideoPreview.
  if (typeof sceneIndex === "number" && typeof totalScenes === "number" && totalScenes > 1) {
    if (sceneIndex === 0) return "intro";
    if (sceneIndex === totalScenes - 1) return "outro";
  }
  return null;
}
