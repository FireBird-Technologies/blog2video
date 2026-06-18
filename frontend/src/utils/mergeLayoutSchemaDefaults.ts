/**
 * Merge meta.json `layout_prop_schema[layout].defaults` under stored layoutProps,
 * matching `backend/app/services/remotion.py` (`write_remotion_data`, ~983–1002).
 *
 * Keeps frontend preview / SceneEditModal in sync with the rendered MP4 for
 * chart colors, axis captions, example tables, font sizes, etc.
 */

export type LayoutPropSchema = Record<string, { defaults?: Record<string, unknown> }>;

// Economist wordmark/dateline/teasers are LLM-authored content, never defaults —
// mirror `_ECONOMIST_CONTENT_SKIP_KEYS` in backend/app/services/remotion.py so the
// preview never injects the sample "The Brief" wordmark onto the cover / sign-off.
const ECONOMIST_CONTENT_SKIP_KEYS = new Set(["wordmark", "dateline", "teasers"]);

function resolveDefaultsForAspect(
  defaults: Record<string, unknown>,
  aspectRatio: string,
): Record<string, unknown> {
  const ar = aspectRatio === "portrait" ? "portrait" : "landscape";
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(defaults)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "portrait" in value &&
      "landscape" in value
    ) {
      const responsive = value as { portrait?: unknown; landscape?: unknown };
      resolved[key] = responsive[ar] ?? responsive.landscape;
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

/**
 * Apply layout schema defaults under `layoutProps` (stored props win on conflict).
 */
export function mergeLayoutSchemaDefaults(
  layoutProps: Record<string, unknown>,
  layoutId: string | null | undefined,
  schema: LayoutPropSchema | null | undefined,
  aspectRatio = "landscape",
  templateId?: string | null,
): Record<string, unknown> {
  if (!layoutId || !schema || Object.keys(schema).length === 0) return layoutProps;
  const defaults = schema[layoutId]?.defaults;
  if (!defaults || Object.keys(defaults).length === 0) return layoutProps;
  const resolved = resolveDefaultsForAspect(defaults, aspectRatio);
  // Drop content-only defaults the renderer also refuses to inject, so the
  // preview matches the MP4 (e.g. economist never auto-stamps a brand wordmark).
  if (String(templateId ?? "").toLowerCase() === "economist") {
    for (const key of ECONOMIST_CONTENT_SKIP_KEYS) delete resolved[key];
  }
  const merged = { ...resolved, ...layoutProps };

  // Keep example chart data when stored chartTable has no rows (legacy partial merge).
  const existingTable = layoutProps.chartTable;
  const existingTableHasRows =
    existingTable &&
    typeof existingTable === "object" &&
    Array.isArray((existingTable as { rows?: unknown }).rows) &&
    ((existingTable as { rows: unknown[] }).rows.length > 0);
  if (!existingTableHasRows && resolved.chartTable && typeof resolved.chartTable === "object") {
    merged.chartTable = resolved.chartTable;
  }

  if (!("chartType" in layoutProps) && typeof resolved.chartType === "string") {
    merged.chartType = resolved.chartType;
  }

  return merged;
}
