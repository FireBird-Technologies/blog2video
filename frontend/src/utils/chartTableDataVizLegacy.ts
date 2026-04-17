/**
 * Convert editable chart table + chart type into legacy row props used by SceneEditModal save path
 * (barChartRows, pieChartRows, lineChartLabels + lineChartDatasets, histogramRows).
 */
export type DataVizTemplateId = "nightfall" | "default";

function normalizeChartTableInput(input: { headers: string[]; rows: string[][] }): {
  headers: string[];
  rows: string[][];
} {
  const headers = (input.headers || []).map((h) => String(h ?? "").trim());
  const rows = (input.rows || []).map((r) =>
    (Array.isArray(r) ? r : []).map((c) => String(c ?? "")),
  );
  const colCount = Math.max(2, headers.length, ...rows.map((r) => r.length));
  const h =
    headers.length >= colCount
      ? headers.slice(0, colCount)
      : [
          ...headers,
          ...Array.from({ length: colCount - headers.length }, (_, i) => `Series ${i + 1}`),
        ];
  const normalizedRows = rows.map((r) => {
    const extended = [...r, ...Array.from({ length: Math.max(0, colCount - r.length) }, () => "")];
    return extended.slice(0, colCount);
  });
  return { headers: h.slice(0, colCount), rows: normalizedRows };
}

/**
 * Maps chart table + explicit chart type to legacy layoutProps fragment (row-based keys only).
 */
export function chartTableToLegacyRowProps(
  table: { headers: string[]; rows: string[][] },
  chartType: string,
  template: DataVizTemplateId,
): Record<string, unknown> {
  const mode = chartType.trim().toLowerCase();
  const t = normalizeChartTableInput(table);
  const nonEmptyRows = t.rows.filter((row) => row.some((cell) => String(cell).trim() !== ""));

  if (mode === "line") {
    if (nonEmptyRows.length === 0 || t.headers.length < 2) {
      return {};
    }
    const labels = nonEmptyRows.map((r) => String(r[0] ?? ""));
    const datasets = [];
    for (let c = 1; c < t.headers.length; c++) {
      const label = String(t.headers[c] ?? `Series ${c}`);
      const valuesStr = nonEmptyRows.map((r) => String(r[c] ?? "").trim()).join(", ");
      datasets.push({ label, valuesStr });
    }
    return {
      lineChartLabels: labels,
      lineChartDatasets: datasets,
    };
  }

  const pairRows = nonEmptyRows.map((r) => ({
    label: String(r[0] ?? ""),
    value: String(r[1] ?? ""),
  }));

  if (mode === "bar") {
    return pairRows.length ? { barChartRows: pairRows } : {};
  }
  if (mode === "pie") {
    if (template !== "nightfall") return {};
    return pairRows.length ? { pieChartRows: pairRows } : {};
  }
  if (mode === "histogram") {
    if (template !== "default") return {};
    return pairRows.length ? { histogramRows: pairRows } : {};
  }

  return {};
}
