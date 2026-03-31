/**
 * Flattens Nightfall-style nested chart objects into the keys NEWSCAST
 * `DataVisualization` expects. Mirrors the editor load path in SceneEditModal.
 */
export function normalizeNewscastDataVizLayoutProps(
  layoutProps: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...layoutProps };

  const hasBarRows =
    Array.isArray(out.barChartRows) && (out.barChartRows as unknown[]).length > 0;
  if (!hasBarRows && out.barChart && typeof out.barChart === "object") {
    const b = out.barChart as { labels?: unknown[]; values?: unknown[] };
    if (Array.isArray(b.labels) && b.labels.length > 0 && Array.isArray(b.values)) {
      out.barChartRows = b.labels.map((label, i) => ({
        label: String(label ?? ""),
        value: String(b.values?.[i] ?? ""),
      }));
    }
  }

  const hasPieRows =
    Array.isArray(out.pieChartRows) && (out.pieChartRows as unknown[]).length > 0;
  if (!hasPieRows && out.pieChart && typeof out.pieChart === "object") {
    const p = out.pieChart as { labels?: unknown[]; values?: unknown[] };
    if (Array.isArray(p.labels) && p.labels.length > 0 && Array.isArray(p.values)) {
      out.pieChartRows = p.labels.map((label, i) => ({
        label: String(label ?? ""),
        value: String(p.values?.[i] ?? ""),
      }));
    }
  }

  const hasLineFlat =
    Array.isArray(out.lineChartLabels) &&
    (out.lineChartLabels as unknown[]).length > 0 &&
    Array.isArray(out.lineChartDatasets) &&
    (out.lineChartDatasets as unknown[]).length > 0;
  if (!hasLineFlat && out.lineChart && typeof out.lineChart === "object") {
    const lc = out.lineChart as {
      labels?: unknown[];
      datasets?: Array<{ label?: string; values?: unknown[] }>;
    };
    if (Array.isArray(lc.labels) && lc.labels.length > 0 && Array.isArray(lc.datasets)) {
      out.lineChartLabels = lc.labels.map((l) => String(l ?? ""));
      out.lineChartDatasets = lc.datasets.map((d) => ({
        label: d?.label ?? "",
        valuesStr: Array.isArray(d.values) ? d.values.map((v) => String(v)).join(", ") : "",
      }));
    }
  }

  return out;
}
