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
