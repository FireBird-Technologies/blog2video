import { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import {
  Scene,
  Project,
  Asset,
  updateScene,
  updateSceneImage,
  generateSceneImage,
  regenerateScene,
  getValidLayouts,
  LayoutInfo,
} from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useErrorModal, getErrorMessage } from "../contexts/ErrorModalContext";
import { useNavigate } from "react-router-dom";
import UpgradePlanModal from "./UpgradePlanModal";
import { getSceneLayoutLabel } from "../utils/layoutLabels";
import { chartTableToLegacyRowProps } from "../utils/chartTableDataVizLegacy";

/** Layout default font sizes: [portrait, landscape] or single number for both. */
const LAYOUT_FONT_DEFAULTS: Record<string, Record<string, { title: number | [number, number]; desc?: number | [number, number] }>> = {
  default: {
    text_narration: { title: [34, 44], desc: [20, 23] },
    hero_image: { title: [40, 54] },
    image_caption: { title: [26, 32], desc: [17, 20] },
    bullet_list: { title: [30, 40], desc: [18, 22] },
    flow_diagram: { title: [30, 38], desc: [16, 20] },
    comparison: { title: [30, 38], desc: [16, 20] },
    metric: { title: [18, 22], desc: [16, 20] },
    code_block: { title: [26, 36] },
    timeline: { title: [30, 38], desc: [14, 16] },
    quote_callout: { title: [30, 38], desc: [16, 20] },
    data_visualization: { title: [52, 44], desc: [28, 26] },
  },
  nightfall: {
    cinematic_title: { title: [88, 140], desc: [26, 36] },
    glass_narrative: { title: [40, 52], desc: 25 },
    glass_image: { title: [48, 64], desc: 28 },
    glass_code: { title: [18, 22], desc: 22 },
    split_glass: { title: [34, 46], desc: [20, 24] },
    chapter_break: { title: [36, 46], desc: [18, 24] },
    data_visualization: { title: [34, 46], desc: 25 },
    glow_metric: { title: [28, 36], desc: [18, 20] },
    glass_stack: { title: [34, 42], desc: [16, 18] },
    kinetic_insight: { title: [80, 120], desc: [60, 72] },
  },
  newscast: {
    opening: { title: [88, 140], desc: [26, 36] },
    anchor_narrative: { title: [40, 52], desc: 25 },
    field_image_focus: { title: [48, 64], desc: 28 },
    briefing_code_panel: { title: [18, 22], desc: 22 },
    side_by_side_brief: { title: [34, 46], desc: [20, 24] },
    segment_break: { title: [36, 46], desc: [18, 24] },
    live_metrics_board: { title: [28, 36], desc: [18, 20] },
    data_visualization: { title: [34, 46], desc: 25 },
    story_stack: { title: [34, 42], desc: [16, 18] },
    headline_insight: { title: [80, 120], desc: [60, 72] },
  },
  spotlight: {
    impact_title: { title: [64, 100], desc: [18, 22] },
    word_punch: { title: [96, 140] },
    stat_stage: { title: [80, 120], desc: [11, 14] },
    cascade_list: { title: [18, 28], desc: [20, 30] },
    rapid_points: { title: [32, 52] },
    spotlight_image: { title: [52, 72], desc: [18, 24] },
    versus: { title: [28, 40], desc: [12, 16] },
    closer: { title: [28, 42], desc: [12, 16] },
  },
  gridcraft: {
    editorial: { title: 36, desc: 18 },
    bento_hero: { title: 72, desc: 18 },
    bento_features: { title: 24, desc: 14 },
    bento_compare: { title: 24, desc: 16 },
    bento_highlight: { title: 32, desc: 18 },
    bento_code: { title: 24, desc: 16 },
    bento_steps: { title: 18, desc: 13 },
    pull_quote: { title: 42, desc: 16 },
  },
  whiteboard: {
    drawn_title: { title: [82, 118], desc: [30, 36] },
    marker_story: { title: [68, 92], desc: [30, 40] },
    stick_figure_scene: { title: [66, 84], desc: [30, 38] },
    stats_figures: { title: [58, 72], desc: [26, 30] },
    stats_chart: { title: [52, 64], desc: [24, 28] },
    comparison: { title: [52, 64], desc: [24, 28] },
  },
  newspaper: {
    news_headline: { title: [48, 64], desc: [19, 23] },
    article_lead: { title: [14, 16], desc: [20, 24] },
    pull_quote: { title: [30, 38], desc: [16, 19] },
    data_snapshot: { title: [38, 50], desc: [14, 16] },
    fact_check: { title: [36, 48], desc: [22, 24] },
    news_timeline: { title: [36, 48], desc: [15, 18] },
  },
  mosaic: {
    mosaic_title: { title: [150, 100], desc: [64, 44] },
    mosaic_text: { title: [86, 56], desc: [50, 32] },
    mosaic_punch: { title: [200, 130], desc: [34, 22] },
    mosaic_stream: { title: [76, 50], desc: [42, 28] },
    mosaic_metric: { title: [162, 106], desc: [34, 24] },
    mosaic_phrases: { title: [90, 62], desc: [40, 26] },
    mosaic_close: { title: [104, 72], desc: [52, 34] },
  },
  custom: {
    // Custom template arrangements (font sizes are approximate)
    "full-center": { title: [36, 48], desc: [18, 22] },
    "split-left": { title: [32, 42], desc: [16, 20] },
    "split-right": { title: [32, 42], desc: [16, 20] },
    "top-bottom": { title: [34, 44], desc: [18, 22] },
    "grid-2x2": { title: [24, 32], desc: [14, 16] },
    "grid-3": { title: [22, 28], desc: [13, 15] },
    "asymmetric-left": { title: [32, 42], desc: [16, 20] },
    "asymmetric-right": { title: [32, 42], desc: [16, 20] },
    "stacked": { title: [34, 44], desc: [18, 22] },
  },
};

const LEGACY_NEWSCAST_LAYOUT_ID_ALIASES: Record<string, string> = {
  newscast_cinematic_title: "opening",
  newscast_glass_narrative: "anchor_narrative",
  newscast_glass_image: "field_image_focus",
  newscast_glass_code: "briefing_code_panel",
  newscast_split_glass: "side_by_side_brief",
  newscast_chapter_break: "segment_break",
  newscast_glow_metric: "live_metrics_board",
  newscast_glass_stack: "story_stack",
  newscast_kinetic_insight: "headline_insight",
};

function normalizeLegacyNewscastLayoutId(template: string, layoutId: string): string {
  const normalizedTemplate = (template || "").toLowerCase();
  if (normalizedTemplate !== "newscast" && normalizedTemplate !== "newsreport") return layoutId;
  return LEGACY_NEWSCAST_LAYOUT_ID_ALIASES[layoutId] ?? layoutId;
}

export function getDefaultFontSizes(
  template: string,
  layoutId: string | null,
  aspectRatio: string
): { title: number; desc: number } {
  const p = aspectRatio === "portrait";
  const raw = (template || "default").toLowerCase();
  const t = raw.startsWith("custom_") ? "custom" : raw;
  const layout = layoutId ? normalizeLegacyNewscastLayoutId(t, layoutId) : "text_narration";
  const defs = LAYOUT_FONT_DEFAULTS[t]?.[layout] ?? LAYOUT_FONT_DEFAULTS.default?.text_narration ?? { title: [34, 44], desc: [20, 23] };
  const titleVal = defs.title;
  const descVal = defs.desc;
  const title = Array.isArray(titleVal) ? (p ? titleVal[0] : titleVal[1]) : (titleVal as number);
  const desc = descVal !== undefined
    ? (Array.isArray(descVal) ? (p ? descVal[0] : descVal[1]) : descVal)
    : 20;
  return { title, desc };
}

/** Get default font sizes from layout_prop_schema (meta.json) when available. */
export function getDefaultFontSizesFromSchema(
  layoutPropSchema: Record<string, { defaults?: Record<string, unknown> }> | undefined,
  layoutId: string | null,
  aspectRatio: string
): { title: number; desc: number } | null {
  if (!layoutId || !layoutPropSchema) return null;
  const canonicalLayoutId = LEGACY_NEWSCAST_LAYOUT_ID_ALIASES[layoutId] ?? layoutId;
  const schema = layoutPropSchema[canonicalLayoutId];
  const defaults = schema?.defaults;
  if (!defaults) return null;
  const isPortrait = aspectRatio === "portrait";
  const resolve = (val: unknown): number | null => {
    if (typeof val === "number" && !isNaN(val)) return val;
    if (val && typeof val === "object" && !Array.isArray(val) && "portrait" in val && "landscape" in val) {
      const v = val as { portrait: unknown; landscape: unknown };
      const n = isPortrait ? v.portrait : v.landscape;
      return typeof n === "number" && !isNaN(n) ? n : null;
    }
    return null;
  };
  const title = resolve(defaults.titleFontSize);
  const desc = resolve(defaults.descriptionFontSize);
  if (title == null && desc == null) return null;
  const hardcoded = getDefaultFontSizes("", canonicalLayoutId, aspectRatio);
  return {
    title: title ?? hardcoded.title,
    desc: desc ?? hardcoded.desc,
  };
}

// ─── Layout text field definitions ──────────────────────────
type FieldType =
  | "string"
  | "color"
  | "text"
  | "string_array"
  | "object_array"
  | "chart_table"
  | "select"
  | "number"
  | "range";

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  subFields?: { key: string; label: string; placeholder?: string }[];
  placeholder?: string;
  maxItems?: number;
  /** Options when type === "select" */
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  /** Display/render default when the value hasn't been saved yet. */
  default?: string | number;
}

function normalizeColorValue(input: unknown, fallback: string): string {
  const raw = String(input ?? "")
    .trim()
    .replace(/^["'`*\s]+|["'`*\s]+$/g, "");
  if (/^#([A-Fa-f0-9]{6})$/.test(raw)) return raw;
  if (/^#([A-Fa-f0-9]{8})$/.test(raw)) return raw.slice(0, 7);
  if (/^#([A-Fa-f0-9]{3})$/.test(raw)) {
    const short = raw.slice(1);
    return `#${short[0]}${short[0]}${short[1]}${short[1]}${short[2]}${short[2]}`;
  }
  const named: Record<string, string> = {
    white: "#FFFFFF",
    black: "#000000",
    red: "#FF0000",
    green: "#008000",
    blue: "#0000FF",
    yellow: "#FFFF00",
    purple: "#800080",
    orange: "#FFA500",
    gray: "#808080",
    grey: "#808080",
  };
  const lower = raw.toLowerCase();
  if (named[lower]) return named[lower];

  const rgbMatch = raw.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1]
      .split(",")
      .map((p) => Number(p.trim()))
      .filter((n) => Number.isFinite(n));
    if (parts.length >= 3) {
      const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
      return `#${toHex(parts[0])}${toHex(parts[1])}${toHex(parts[2])}`.toUpperCase();
    }
  }
  return fallback;
}

function normalizeChartTableValue(input: unknown): { headers: string[]; rows: string[][] } {
  const raw = (input && typeof input === "object") ? (input as { headers?: unknown; rows?: unknown }) : {};
  let headers = Array.isArray(raw.headers) ? raw.headers.map((h) => String(h ?? "").trim()) : [];
  let rows = Array.isArray(raw.rows)
    ? raw.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "")) : []))
    : [];

  const hasOnlySyntheticHeaders = headers.length > 0
    && headers.every((h) => /^col_\d+$/i.test(h));
  if (hasOnlySyntheticHeaders && rows.length > 0) {
    const candidate = rows[0].map((c) => String(c ?? "").trim());
    const nonEmpty = candidate.filter(Boolean);
    const numericCells = nonEmpty.filter((cell) => parseNumericCellForChart(cell) !== null).length;
    const looksLikeHeader = nonEmpty.length >= Math.max(2, Math.floor(candidate.length / 2))
      && numericCells <= Math.max(1, Math.floor(nonEmpty.length / 3));
    if (looksLikeHeader) {
      headers = candidate;
      rows = rows.slice(1);
    }
  }

  const nonEmptyHeaders = headers.some((h) => h.length > 0) ? headers : ["Label", "Value"];
  const colCount = Math.max(nonEmptyHeaders.length, 2);
  const normalizedHeaders = [...nonEmptyHeaders, ...Array.from({ length: Math.max(0, colCount - nonEmptyHeaders.length) }, (_, i) => `Series ${nonEmptyHeaders.length + i}`)];
  const normalizedRows = rows.map((r) =>
    [...r, ...Array.from({ length: Math.max(0, colCount - r.length) }, () => "")].slice(0, colCount),
  );
  return { headers: normalizedHeaders.slice(0, colCount), rows: normalizedRows };
}

function parseNumericCellForChart(raw: string): number | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const strictNumericRe =
    /^\s*\(?\s*[+\-]?\$?\s*\d[\d,]*(?:\.\d+)?\s*(?:%|[a-z]{1,12})?\s*\)?\s*$/i;
  if (strictNumericRe.test(value)) {
    const negativeByParens = value.startsWith("(") && value.endsWith(")");
    const parsed = Number(value.replace(/[^0-9.\-]/g, ""));
    if (!Number.isFinite(parsed)) return null;
    return negativeByParens ? -Math.abs(parsed) : parsed;
  }
  const compact = value
    .replace(/[~≈]/g, "")
    .replace(/\+/g, "")
    .replace(/,/g, "")
    .trim();
  const token = compact.match(/-?\d*\.?\d+/)?.[0];
  if (!token) return null;
  const parsed = Number(token);
  if (!Number.isFinite(parsed)) return null;
  const negativeByParens = value.startsWith("(") && value.endsWith(")");
  return negativeByParens ? -Math.abs(parsed) : parsed;
}

function countLineSeriesInChartTable(table: { headers: string[]; rows: string[][] }): number {
  if (!table.headers.length || !table.rows.length) return 0;
  let count = 0;
  for (let col = 1; col < table.headers.length; col += 1) {
    let numericCount = 0;
    for (let row = 0; row < table.rows.length; row += 1) {
      const cell = table.rows[row]?.[col] ?? "";
      if (parseNumericCellForChart(cell) !== null) numericCount += 1;
    }
    if (numericCount >= 2) count += 1;
  }
  return Math.min(3, count);
}

type DataVizTableMode = "line" | "bar" | "histogram" | "pie" | "auto";

function hasLegacyPieData(lp: Record<string, unknown>): boolean {
  return !!(
    (lp.pieChart && typeof lp.pieChart === "object") ||
    (Array.isArray(lp.pieChartRows) && (lp.pieChartRows as unknown[]).length > 0)
  );
}

function hasTimeLikeLabelsForChartTable(labels: string[]): boolean {
  if (labels.length < 2) return false;
  const re =
    /(^q[1-4](\s*\d{2,4})?$)|(^\d{4}$)|(^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$)|(^\d{1,2}[/-](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*([/-]\d{2,4})?$)|(^((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)(\b|[./-]\d{2,4}|\s+\d{2,4}))$/i;
  return labels.some((l) => re.test(String(l ?? "").trim()));
}

function hasBucketLikeLabelsForChartTable(labels: string[]): boolean {
  if (labels.length < 3) return false;
  return labels.some((label) =>
    /(^\d+\s*[-–]\s*\d+$)|(^<\s*\d+$)|(^>\s*\d+$)|(^\d+\+$)/.test(String(label ?? "").trim()),
  );
}

function getNumericColumnIndexes(table: { headers: string[]; rows: string[][] }): number[] {
  const indexes: number[] = [];
  for (let col = 1; col < table.headers.length; col += 1) {
    let numericCount = 0;
    for (let row = 0; row < table.rows.length; row += 1) {
      const cell = table.rows[row]?.[col] ?? "";
      if (parseNumericCellForChart(cell) !== null) numericCount += 1;
    }
    if (numericCount >= 2) indexes.push(col);
  }
  return indexes;
}

function inferDataVizTableMode(lp: Record<string, unknown>): DataVizTableMode {
  const explicit = String(lp.chartType ?? "").trim().toLowerCase();
  if (explicit === "line" || explicit === "bar" || explicit === "histogram" || explicit === "pie") {
    return explicit;
  }
  const hasLine =
    (lp.lineChart && typeof lp.lineChart === "object") ||
    (Array.isArray(lp.lineChartLabels) && Array.isArray(lp.lineChartDatasets));
  const hasBar = (lp.barChart && typeof lp.barChart === "object") || Array.isArray(lp.barChartRows);
  const hasHistogram = (lp.histogram && typeof lp.histogram === "object") || Array.isArray(lp.histogramRows);
  const hasPie = (lp.pieChart && typeof lp.pieChart === "object") || Array.isArray(lp.pieChartRows);
  if (hasLine) return "line";
  if (hasPie) return "pie";
  if (hasBar) return "bar";
  if (hasHistogram) return "histogram";
  const table = normalizeChartTableValue(lp.chartTable);
  if (table.rows.length > 0) {
    const numericCols = getNumericColumnIndexes(table);
    if (numericCols.length > 0) {
      const labels = table.rows.map((r) => String(r?.[0] ?? ""));
      if (hasTimeLikeLabelsForChartTable(labels)) return "line";
      if (hasBucketLikeLabelsForChartTable(labels)) return "histogram";
      return "bar";
    }
  }
  return "auto";
}

function lineSeriesCountFromLayoutProps(lp: Record<string, unknown>): number {
  const lineChart = lp.lineChart as { datasets?: unknown[] } | undefined;
  if (lineChart && Array.isArray(lineChart.datasets) && lineChart.datasets.length > 0) {
    return Math.min(3, lineChart.datasets.length);
  }
  const datasets = Array.isArray(lp.lineChartDatasets) ? lp.lineChartDatasets : [];
  return Math.min(3, datasets.length || 1);
}

function hasLegacyLineData(lp: Record<string, unknown>): boolean {
  return !!(
    (lp.lineChart && typeof lp.lineChart === "object") ||
    (Array.isArray(lp.lineChartLabels) && Array.isArray(lp.lineChartDatasets) && (lp.lineChartDatasets as unknown[]).length > 0)
  );
}

function hasLegacyBarData(lp: Record<string, unknown>): boolean {
  return !!(
    (lp.barChart && typeof lp.barChart === "object") ||
    (Array.isArray(lp.barChartRows) && (lp.barChartRows as unknown[]).length > 0)
  );
}

function hasLegacyHistogramData(lp: Record<string, unknown>): boolean {
  return !!(
    (lp.histogram && typeof lp.histogram === "object") ||
    (Array.isArray(lp.histogramRows) && (lp.histogramRows as unknown[]).length > 0)
  );
}

function getEmptyChartTableForMode(mode: Exclude<DataVizTableMode, "auto">): { headers: string[]; rows: string[][] } {
  if (mode === "line") {
    return { headers: ["Label", "Series 1"], rows: [] };
  }
  if (mode === "histogram") {
    return { headers: ["Bucket", "Frequency"], rows: [] };
  }
  return { headers: ["Label", "Value"], rows: [] };
}

function chartTableHasData(table: { headers: string[]; rows: string[][] }): boolean {
  return table.rows.some((row) => row.some((cell) => String(cell ?? "").trim() !== ""));
}

function projectChartTableForMode(
  table: { headers: string[]; rows: string[][] },
  mode: DataVizTableMode,
  inferredLineSeriesCount: number,
): { headers: string[]; rows: string[][] } {
  if (table.headers.length === 0) return table;
  const numericColIndexes = getNumericColumnIndexes(table);
  if (mode === "bar") {
    const seriesCols = (numericColIndexes.length > 0 ? numericColIndexes : [1]).slice(
      0,
      Math.max(1, Math.min(3, inferredLineSeriesCount)),
    );
    return {
      headers: [table.headers[0] ?? "Label", ...seriesCols.map((i) => table.headers[i] ?? `Series ${i}`)],
      rows: table.rows.map((r) => [r[0] ?? "", ...seriesCols.map((i) => r[i] ?? "")]),
    };
  }
  if (mode === "histogram" || mode === "pie") {
    const chosenCol = numericColIndexes[0] ?? 1;
    return {
      headers: [table.headers[0] ?? "Label", table.headers[chosenCol] ?? "Value"],
      rows: table.rows.map((r) => [r[0] ?? "", r[chosenCol] ?? ""]),
    };
  }
  if (mode === "line") {
    const seriesCols = (numericColIndexes.length > 0 ? numericColIndexes : [1]).slice(
      0,
      Math.max(1, Math.min(3, inferredLineSeriesCount)),
    );
    return {
      headers: [table.headers[0] ?? "Label", ...seriesCols.map((i) => table.headers[i] ?? `Series ${i}`)],
      rows: table.rows.map((r) => [r[0] ?? "", ...seriesCols.map((i) => r[i] ?? "")]),
    };
  }
  return table;
}

function buildChartTableFromDataVizLayoutProps(lp: Record<string, unknown>): { headers: string[]; rows: string[][] } {
  const mode = inferDataVizTableMode(lp);
  const inferredLineSeriesCount = lineSeriesCountFromLayoutProps(lp);
  const shouldPreferLine = mode === "line" && hasLegacyLineData(lp);
  const shouldPreferBar = mode === "bar" && hasLegacyBarData(lp);
  const shouldPreferHistogram = mode === "histogram" && hasLegacyHistogramData(lp);
  const shouldPreferPie = mode === "pie" && hasLegacyPieData(lp);

  if (!shouldPreferBar && !shouldPreferHistogram && !shouldPreferPie) {
    const lineChart = lp.lineChart as { labels?: unknown[]; datasets?: Array<{ label?: unknown; values?: unknown[] }> } | undefined;
    if (
      shouldPreferLine &&
      lineChart &&
      Array.isArray(lineChart.labels) &&
      Array.isArray(lineChart.datasets) &&
      lineChart.labels.length > 0
    ) {
      const labels = lineChart.labels.map((l) => String(l ?? ""));
      const datasets = lineChart.datasets.slice(0, 3);
      const headers = ["Label", ...datasets.map((d, i) => String(d?.label ?? `Series ${i + 1}`))];
      const rows = labels.map((label, rowIndex) => ([
        label,
        ...datasets.map((d) => {
          const values = Array.isArray(d?.values) ? d.values : [];
          const value = values[rowIndex];
          return value == null ? "" : String(value);
        }),
      ]));
      return projectChartTableForMode(normalizeChartTableValue({ headers, rows }), mode, inferredLineSeriesCount);
    }
  }

  if (!shouldPreferLine && !shouldPreferHistogram && !shouldPreferPie) {
    const barChart = lp.barChart as { labels?: unknown[]; values?: unknown[] } | undefined;
    if (
      shouldPreferBar &&
      barChart &&
      Array.isArray(barChart.labels) &&
      Array.isArray(barChart.values) &&
      barChart.labels.length > 0
    ) {
      const rows = barChart.labels.map((label, i) => [String(label ?? ""), String(barChart.values?.[i] ?? "")]);
      return projectChartTableForMode(normalizeChartTableValue({ headers: ["Label", "Value"], rows }), mode, inferredLineSeriesCount);
    }
  }

  if (!shouldPreferLine && !shouldPreferBar && !shouldPreferPie) {
    const histogram = lp.histogram as { labels?: unknown[]; values?: unknown[] } | undefined;
    if (
      shouldPreferHistogram &&
      histogram &&
      Array.isArray(histogram.labels) &&
      Array.isArray(histogram.values) &&
      histogram.labels.length > 0
    ) {
      const rows = histogram.labels.map((label, i) => [String(label ?? ""), String(histogram.values?.[i] ?? "")]);
      return projectChartTableForMode(normalizeChartTableValue({ headers: ["Bucket", "Frequency"], rows }), mode, inferredLineSeriesCount);
    }
  }

  if (!shouldPreferLine && !shouldPreferBar && !shouldPreferHistogram) {
    const pieChart = lp.pieChart as { labels?: unknown[]; values?: unknown[] } | undefined;
    if (
      shouldPreferPie &&
      pieChart &&
      Array.isArray(pieChart.labels) &&
      Array.isArray(pieChart.values) &&
      pieChart.labels.length > 0
    ) {
      const rows = pieChart.labels.map((label, i) => [String(label ?? ""), String(pieChart.values?.[i] ?? "")]);
      return projectChartTableForMode(normalizeChartTableValue({ headers: ["Label", "Value"], rows }), mode, inferredLineSeriesCount);
    }
  }

  const directTable = normalizeChartTableValue(lp.chartTable);
  if (directTable.rows.length > 0) {
    const directTableLineCount = countLineSeriesInChartTable(directTable);
    const lineCount = directTableLineCount > 0 ? directTableLineCount : inferredLineSeriesCount;
    return projectChartTableForMode(directTable, mode, lineCount);
  }

  const lineChartLabels = Array.isArray(lp.lineChartLabels) ? (lp.lineChartLabels as unknown[]) : [];
  const lineChartDatasets = Array.isArray(lp.lineChartDatasets)
    ? (lp.lineChartDatasets as Array<{ label?: unknown; valuesStr?: unknown }>)
    : [];
  if (lineChartLabels.length > 0 && lineChartDatasets.length > 0) {
    const labels = lineChartLabels.map((l) => String(l ?? ""));
    const datasets = lineChartDatasets.slice(0, 3);
    const headers = ["Label", ...datasets.map((d, i) => String(d?.label ?? `Series ${i + 1}`))];
    const rows = labels.map((label, rowIndex) => ([
      label,
      ...datasets.map((d) => String(d?.valuesStr ?? "").split(",")[rowIndex]?.trim() ?? ""),
    ]));
    return projectChartTableForMode(normalizeChartTableValue({ headers, rows }), mode, inferredLineSeriesCount);
  }

  const pieRows = Array.isArray(lp.pieChartRows) ? (lp.pieChartRows as Array<{ label?: unknown; value?: unknown }>) : [];
  if (pieRows.length > 0 && mode === "pie") {
    const rows = pieRows.map((r) => [String(r?.label ?? ""), String(r?.value ?? "")]);
    return projectChartTableForMode(normalizeChartTableValue({ headers: ["Label", "Value"], rows }), mode, inferredLineSeriesCount);
  }

  const barRows = Array.isArray(lp.barChartRows) ? (lp.barChartRows as Array<{ label?: unknown; value?: unknown }>) : [];
  if (barRows.length > 0) {
    const rows = barRows.map((r) => [String(r?.label ?? ""), String(r?.value ?? "")]);
    return projectChartTableForMode(normalizeChartTableValue({ headers: ["Label", "Value"], rows }), mode, inferredLineSeriesCount);
  }

  return projectChartTableForMode(normalizeChartTableValue({
    headers: ["Label", "Value"],
    rows: [],
  }), mode, inferredLineSeriesCount);
}

const LAYOUT_TEXT_FIELDS: Record<string, FieldDef[]> = {
  // Default template
  bullet_list: [
    {
      key: "points",
      label: "Bullet points",
      type: "object_array",
      subFields: [
        { key: "key", label: "Label" },
        { key: "value", label: "Description" },
      ],
      maxItems: 6,
    },
  ],
  flow_diagram: [{ key: "steps", label: "Steps", type: "string_array", maxItems: 5 }],
  comparison: [
    { key: "leftLabel", label: "Left label", type: "string" },
    { key: "rightLabel", label: "Right label", type: "string" },
    { key: "leftDescription", label: "Left description", type: "text" },
    { key: "rightDescription", label: "Right description", type: "text" },
  ],
  timeline: [{ key: "timelineItems", label: "Timeline items", type: "object_array",
    subFields: [{ key: "label", label: "Label" }, { key: "description", label: "Description" }], maxItems: 4 }],
  metric: [{ key: "metrics", label: "Metrics", type: "object_array",
    subFields: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }, { key: "suffix", label: "Suffix", placeholder: "%" }], maxItems: 3 }],
  quote_callout: [
    { key: "quote", label: "Quote", type: "text" },
    { key: "quoteAuthor", label: "Author", type: "string" },
  ],
  code_block: [
    { key: "codeLanguage", label: "Language", type: "string", placeholder: "e.g. python" },
    { key: "codeLines", label: "Code lines", type: "string_array" },
  ],
  // Spotlight template
  impact_title: [{ key: "highlightWord", label: "Accent word (title)", type: "string" }],
  statement: [{ key: "highlightWord", label: "Highlight word", type: "string" }],
  word_punch: [{ key: "word", label: "Word / phrase", type: "string" }],
  cascade_list: [{ key: "items", label: "Items", type: "string_array" }],
  rapid_points: [{ key: "phrases", label: "Phrases", type: "string_array" }],
  versus: [
    { key: "leftLabel", label: "Left label", type: "string" },
    { key: "rightLabel", label: "Right label", type: "string" },
    { key: "leftDescription", label: "Left description", type: "text" },
    { key: "rightDescription", label: "Right description", type: "text" },
  ],
  closer: [
    { key: "highlightPhrase", label: "Highlight phrase", type: "string" },
    { key: "cta", label: "Call to action", type: "string" },
  ],
  stat_stage: [{ key: "metrics", label: "Metrics", type: "object_array",
    subFields: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }, { key: "suffix", label: "Suffix" }], maxItems: 3 }],
  // Nightfall template
  glass_stack: [{ key: "items", label: "Items", type: "string_array" }],
  glass_code: [
    { key: "codeLanguage", label: "Language", type: "string", placeholder: "e.g. python" },
    { key: "codeLines", label: "Code lines", type: "string_array" },
  ],
  split_glass: [
    { key: "leftLabel", label: "Left label", type: "string" },
    { key: "rightLabel", label: "Right label", type: "string" },
    { key: "leftDescription", label: "Left description", type: "text" },
    { key: "rightDescription", label: "Right description", type: "text" },
  ],
  chapter_break: [
    { key: "subtitle", label: "Subtitle", type: "string" },
    { key: "chapterNumber", label: "Chapter number", type: "string" },
  ],
  kinetic_insight: [
    { key: "quote", label: "Quote", type: "text" },
    { key: "highlightWord", label: "Highlight word", type: "string" },
  ],
  glow_metric: [{ key: "metrics", label: "Metrics", type: "object_array",
    subFields: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }, { key: "suffix", label: "Suffix" }], maxItems: 3 }],
  // Newscast template
  story_stack: [
    { key: "sectionLabel", label: "Section label", type: "string" },
    { key: "items", label: "Items", type: "string_array" },
  ],
  briefing_code_panel: [
    { key: "codeLanguage", label: "Language", type: "string", placeholder: "e.g. python" },
    { key: "codeLines", label: "Code lines", type: "string_array" },
  ],
  side_by_side_brief: [
    { key: "leftLabel", label: "Left label", type: "string" },
    { key: "rightLabel", label: "Right label", type: "string" },
    { key: "leftTitle", label: "Left title", type: "string" },
    { key: "rightTitle", label: "Right title", type: "string" },
    { key: "leftBody", label: "Left body", type: "text" },
    { key: "rightBody", label: "Right body", type: "text" },
  ],
  segment_break: [
    { key: "subtitle", label: "Subtitle", type: "string" },
    { key: "chapterNumber", label: "Chapter number", type: "string" },
    { key: "chapterLabel", label: "Chapter label", type: "string" },
  ],
  headline_insight: [
    { key: "quote", label: "Quote", type: "text" },
    { key: "highlightWord", label: "Highlight word", type: "string" },
    { key: "attribution", label: "Attribution", type: "string" },
  ],
  live_metrics_board: [{ key: "metrics", label: "Metrics", type: "object_array",
    subFields: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }, { key: "suffix", label: "Suffix" }], maxItems: 3 }],
  anchor_narrative: [{ key: "category", label: "Category", type: "string" }],
  field_image_focus: [{ key: "category", label: "Category", type: "string" }],
  // Matrix template
  terminal_text: [{ key: "highlightWord", label: "Highlight word", type: "string" }],
  glitch_punch: [{ key: "word", label: "Word / phrase", type: "string" }],
  fork_choice: [
    { key: "leftLabel", label: "Left label", type: "string" },
    { key: "rightLabel", label: "Right label", type: "string" },
    { key: "leftDescription", label: "Left description", type: "text" },
    { key: "rightDescription", label: "Right description", type: "text" },
  ],
  transmission: [{ key: "phrases", label: "Phrases", type: "string_array", maxItems: 8 }],
  awakening: [
    { key: "highlightPhrase", label: "Highlight phrase", type: "string" },
    { key: "cta", label: "Call to action", type: "string" },
  ],
  data_stream: [{ key: "items", label: "Items", type: "string_array", maxItems: 8 }],
  cipher_metric: [{ key: "metrics", label: "Metrics", type: "object_array",
    subFields: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }, { key: "suffix", label: "Suffix", placeholder: "%" }], maxItems: 3 }],
  // Mosaic template
  mosaic_text: [
    { key: "highlightPhrase", label: "Highlight phrase", type: "string" },
    { key: "mosaicPattern", label: "Tile reveal pattern", type: "select", default: "diagonal", options: [
      { value: "center", label: "Center" },
      { value: "diagonal", label: "Diagonal" },
      { value: "linear", label: "Linear" },
      { value: "scatter", label: "Scatter" },
    ]},
    { key: "mosaicTileSize", label: "Tile size (px)", type: "range", min: 4, max: 40, step: 1, default: 20 },
    { key: "mosaicTileGap", label: "Tile grout gap (px)", type: "range", min: 0, max: 4, step: 0.5, default: 0 },
  ],
  mosaic_punch: [
    { key: "word", label: "Word / phrase", type: "string" },
    { key: "mosaicPattern", label: "Tile reveal pattern", type: "select", default: "scatter", options: [
      { value: "center", label: "Center" },
      { value: "diagonal", label: "Diagonal" },
      { value: "linear", label: "Linear" },
      { value: "scatter", label: "Scatter" },
    ]},
    { key: "mosaicTileSize", label: "Tile size (px)", type: "range", min: 4, max: 40, step: 1, default: 20 },
    { key: "mosaicTileGap", label: "Tile grout gap (px)", type: "range", min: 0, max: 4, step: 0.5, default: 0 },
  ],
  mosaic_stream: [
    { key: "items", label: "Items", type: "string_array", maxItems: 8 },
    { key: "mosaicPattern", label: "Tile reveal pattern", type: "select", default: "linear", options: [
      { value: "center", label: "Center" },
      { value: "diagonal", label: "Diagonal" },
      { value: "linear", label: "Linear" },
      { value: "scatter", label: "Scatter" },
    ]},
    { key: "mosaicTileSize", label: "Tile size (px)", type: "range", min: 4, max: 40, step: 1, default: 20 },
    { key: "mosaicTileGap", label: "Tile grout gap (px)", type: "range", min: 0, max: 4, step: 0.5, default: 0 },
  ],
  mosaic_metric: [{ key: "metrics", label: "Metrics", type: "object_array",
    subFields: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }, { key: "suffix", label: "Suffix", placeholder: "%" }], maxItems: 5 },
    { key: "mosaicPattern", label: "Tile reveal pattern", type: "select", default: "center", options: [
      { value: "center", label: "Center" },
      { value: "diagonal", label: "Diagonal" },
      { value: "linear", label: "Linear" },
      { value: "scatter", label: "Scatter" },
    ]},
    { key: "mosaicTileSize", label: "Tile size (px)", type: "range", min: 4, max: 40, step: 1, default: 20 },
    { key: "mosaicTileGap", label: "Tile grout gap (px)", type: "range", min: 0, max: 4, step: 0.5, default: 0 },
  ],
  mosaic_phrases: [
    { key: "phrases", label: "Phrases", type: "string_array", maxItems: 8 },
    { key: "mosaicPattern", label: "Tile reveal pattern", type: "select", default: "center", options: [
      { value: "center", label: "Center" },
      { value: "diagonal", label: "Diagonal" },
      { value: "linear", label: "Linear" },
      { value: "scatter", label: "Scatter" },
    ]},
    { key: "mosaicTileSize", label: "Tile size (px)", type: "range", min: 4, max: 40, step: 1, default: 20 },
    { key: "mosaicTileGap", label: "Tile grout gap (px)", type: "range", min: 0, max: 4, step: 0.5, default: 0 },
  ],
  mosaic_close: [
    { key: "highlightPhrase", label: "Highlight phrase", type: "string" },
    { key: "cta", label: "Call to action", type: "string" },
    { key: "mosaicPattern", label: "Tile reveal pattern", type: "select", default: "diagonal", options: [
      { value: "center", label: "Center" },
      { value: "diagonal", label: "Diagonal" },
      { value: "linear", label: "Linear" },
      { value: "scatter", label: "Scatter" },
    ]},
    { key: "mosaicTileSize", label: "Tile size (px)", type: "range", min: 4, max: 40, step: 1, default: 20 },
    { key: "mosaicTileGap", label: "Tile grout gap (px)", type: "range", min: 0, max: 4, step: 0.5, default: 0 },
  ],
  mosaic_title: [
    { key: "mosaicPattern", label: "Tile reveal pattern", type: "select", default: "scatter", options: [
      { value: "center", label: "Center" },
      { value: "diagonal", label: "Diagonal" },
      { value: "linear", label: "Linear" },
      { value: "scatter", label: "Scatter" },
    ]},
    { key: "mosaicTileSize", label: "Tile size (px)", type: "range", min: 4, max: 40, step: 1, default: 20 },
    { key: "mosaicTileGap", label: "Tile grout gap (px)", type: "range", min: 0, max: 4, step: 0.5, default: 0 },
  ],
  ending_socials: [
    { key: "mosaicPattern", label: "Tile reveal pattern", type: "select", default: "center", options: [
      { value: "center", label: "Center" },
      { value: "diagonal", label: "Diagonal" },
      { value: "linear", label: "Linear" },
      { value: "scatter", label: "Scatter" },
    ]},
    { key: "mosaicTileSize", label: "Tile size (px)", type: "range", min: 4, max: 40, step: 1, default: 20 },
    { key: "mosaicTileGap", label: "Tile grout gap (px)", type: "range", min: 0, max: 4, step: 0.5, default: 0 },
  ],
  data_visualization: [
    { key: "barChartRows", label: "Bar chart data", type: "object_array",
      subFields: [{ key: "label", label: "Label" }, { key: "value", label: "Value", placeholder: "Number" }], maxItems: 12 },
    { key: "lineChartLabels", label: "Line chart – X-axis labels", type: "string_array", maxItems: 12 },
    { key: "lineChartDatasets", label: "Line chart – series", type: "object_array",
      subFields: [{ key: "label", label: "Series name" }, { key: "valuesStr", label: "Values", placeholder: "e.g. 10, 20, 30" }], maxItems: 5 },
    { key: "yAxisLabel", label: "Y-axis label", type: "string", placeholder: "e.g. Revenue ($)" },
    { key: "barPrimaryColor", label: "Bar color 1", type: "color", placeholder: "#1E5FD4" },
    { key: "barSecondaryColor", label: "Bar color 2", type: "color", placeholder: "#FF3B30" },
    { key: "barTertiaryColor", label: "Bar color 3", type: "color", placeholder: "#1E5FD4" },
    { key: "lineUpColor", label: "Line color 1", type: "color", placeholder: "#3CE46A" },
    { key: "lineDownColor", label: "Line color 2", type: "color", placeholder: "#FF3B30" },
    { key: "pieChartRows", label: "Pie chart data", type: "object_array",
      subFields: [{ key: "label", label: "Label" }, { key: "value", label: "Value", placeholder: "Number" }], maxItems: 12 },
  ],
  // Gridcraft template
  bento_compare: [
    { key: "leftLabel", label: "Left label", type: "string" },
    { key: "rightLabel", label: "Right label", type: "string" },
    { key: "leftDescription", label: "Left description", type: "text" },
    { key: "rightDescription", label: "Right description", type: "text" },
    { key: "verdict", label: "Verdict", type: "string" },
  ],
  bento_features: [
    { key: "features", label: "Features", type: "object_array",
      subFields: [{ key: "icon", label: "Icon", placeholder: "emoji" }, { key: "label", label: "Label" }, { key: "description", label: "Description" }], maxItems: 6 },
    { key: "highlightIndex", label: "Accent cell index (0-based)", type: "string", placeholder: "0" },
  ],
  bento_steps: [{ key: "steps", label: "Steps", type: "object_array",
    subFields: [{ key: "label", label: "Label" }, { key: "description", label: "Description" }], maxItems: 5 }],
  bento_highlight: [
    { key: "subtitle", label: "Subtitle", type: "string" },
    { key: "mainPoint", label: "Main point", type: "text" },
    { key: "supportingFacts", label: "Supporting facts", type: "string_array", maxItems: 2 },
  ],
  bento_hero: [
    { key: "subtitle", label: "Subtitle / tagline", type: "string" },
    { key: "category", label: "Category", type: "string", placeholder: "e.g. Featured, Census" },
    { key: "icon", label: "Icon (emoji)", type: "string", placeholder: "e.g. ⚡ 🔒" },
  ],
  pull_quote: [
    { key: "quote", label: "Quote", type: "text" },
    { key: "attribution", label: "Attribution", type: "string" },
    { key: "highlightPhrase", label: "Highlight phrase", type: "string" },
  ],
  bento_code: [
    { key: "codeLanguage", label: "Language", type: "string", placeholder: "e.g. python" },
    { key: "codeLines", label: "Code lines", type: "string_array" },
    { key: "description", label: "Code description", type: "text", placeholder: "Short explanation of what the code does" },
  ],
  kpi_grid: [
    { key: "dataPoints", label: "Data points", type: "object_array",
      subFields: [
        { key: "label", label: "Label" },
        { key: "value", label: "Value", placeholder: "e.g. 97%, 50ms" },
        { key: "trend", label: "Trend", placeholder: "up, down, or neutral" },
      ], maxItems: 3 },
    { key: "highlightIndex", label: "Accent cell index (0-based)", type: "string", placeholder: "0" },
  ],
  // Whiteboard template
  stats_figures: [{ key: "stats", label: "Key figures", type: "object_array",
    subFields: [{ key: "label", label: "Label" }, { key: "value", label: "Value", placeholder: "e.g. 50% or 10K+" }], maxItems: 4 }],
  stats_chart: [{ key: "stats", label: "Bar chart rows", type: "object_array",
    subFields: [{ key: "label", label: "Label" }, { key: "value", label: "Value", placeholder: "Number 0–100" }], maxItems: 5 }],
  countdown_timer: [
    {
      key: "stats",
      label: "Countdown settings",
      type: "object_array",
      subFields: [
        { key: "value", label: "Start at (2–9)", placeholder: "e.g. 5" },
        { key: "label", label: "Label under timer", placeholder: "e.g. seconds" },
      ],
      maxItems: 1,
    },
  ],
  handwritten_equation: [
    {
      key: "stats",
      label: "Equation steps",
      type: "object_array",
      subFields: [
        { key: "label", label: "Step label", placeholder: "e.g. Example" },
        { key: "value", label: "Equation / value", placeholder: "e.g. A = P(1 + r/n)^(n·t)" },
      ],
      maxItems: 5,
    },
  ],
  speech_bubble_dialogue: [
    { key: "leftThought", label: "Left bubble text", type: "text", placeholder: "What the left character says" },
    { key: "rightThought", label: "Right bubble text", type: "text", placeholder: "What the right character says" },
    {
      key: "stats",
      label: "Speaker names",
      type: "object_array",
      subFields: [{ key: "label", label: "Name" }],
      maxItems: 2,
    },
  ],
  drawn_title: [
    { key: "stats", label: "Key figures", type: "object_array",
      subFields: [{ key: "label", label: "Label" }, { key: "value", label: "Value", placeholder: "e.g. 50% or 10K+" }], maxItems: 6 },
  ],
  // Newspaper template
  news_headline: [
    { key: "category", label: "Section / category", type: "string", placeholder: "e.g. Politics, Technology" },
    { key: "leftThought", label: "Words to highlight (comma-separated)", type: "string", placeholder: "e.g. government,funding" },
    { key: "stats", label: "Byline", type: "object_array", subFields: [{ key: "value", label: "Author (row 1) / Date (row 2)" }], maxItems: 2 },
  ],
  article_lead: [
    { key: "stats", label: "Pull stat", type: "object_array", subFields: [{ key: "value", label: "Number" }, { key: "label", label: "Caption" }], maxItems: 1 },
  ],
  data_snapshot: [
    { key: "stats", label: "Key figures", type: "object_array", subFields: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }], maxItems: 4 },
  ],
  fact_check: [
    { key: "leftThought", label: "Claimed", type: "text", placeholder: "The claim to check" },
    { key: "rightThought", label: "The facts", type: "text", placeholder: "The factual correction" },
    { key: "stats", label: "Column labels", type: "object_array", subFields: [{ key: "label", label: "Left (row 1) / Right (row 2) label" }], maxItems: 2 },
  ],
  news_timeline: [
    { key: "stats", label: "Timeline events", type: "object_array", subFields: [{ key: "value", label: "Date" }, { key: "label", label: "Description" }], maxItems: 5 },
  ],
};

/** Template-specific overrides for layout fields (when same layout id exists in multiple templates with different props). */
const LAYOUT_TEXT_FIELDS_OVERRIDE: Record<string, Record<string, FieldDef[]>> = {
  default: {
    data_visualization: [
      { key: "lineChartTable", label: "Line chart data", type: "chart_table" },
      { key: "barChartTable", label: "Bar chart data", type: "chart_table" },
      { key: "histogramChartTable", label: "Histogram data", type: "chart_table" },
      { key: "barPrimaryColor", label: "Bar color 1", type: "color", placeholder: "#1E5FD4" },
      { key: "barSecondaryColor", label: "Bar color 2", type: "color", placeholder: "#FF3B30" },
      { key: "barTertiaryColor", label: "Bar color 3", type: "color", placeholder: "#1E5FD4" },
      { key: "lineUpColor", label: "Line color 1", type: "color", placeholder: "#3CE46A" },
      { key: "lineDownColor", label: "Line color 2", type: "color", placeholder: "#FF3B30" },
    ],
  },
  nightfall: {
    data_visualization: [
      { key: "lineChartTable", label: "Line chart data", type: "chart_table" },
      { key: "barChartTable", label: "Bar chart data", type: "chart_table" },
      { key: "pieChartTable", label: "Pie chart data", type: "chart_table" },
    ],
  },
  newscast: {
    data_visualization: [
      { key: "chartTable", label: "Chart data table", type: "chart_table" },
      { key: "barPrimaryColor", label: "Bar color 1", type: "color", placeholder: "#FF3B30" },
      { key: "barSecondaryColor", label: "Bar color 2", type: "color", placeholder: "#1E5FD4" },
      { key: "barTertiaryColor", label: "Bar color 3", type: "color", placeholder: "#FF3B30" },
      { key: "lineUpColor", label: "Line color 1", type: "color", placeholder: "#3CE46A" },
      { key: "lineDownColor", label: "Line color 2", type: "color", placeholder: "#FF3B30" },
    ],
  },
  whiteboard: {
    comparison: [
      { key: "leftThought", label: "Left thought", type: "text", placeholder: "e.g. Option A or first idea" },
      { key: "rightThought", label: "Right thought", type: "text", placeholder: "e.g. Option B or second idea" },
    ],
  },
  newspaper: {
    pull_quote: [
      { key: "stats", label: "Source / publication", type: "object_array", subFields: [{ key: "label", label: "Source" }], maxItems: 1 },
    ],
  },
  /** Bloomberg Terminal — layout content keys. ending_socials uses the dedicated CTA / socials block. */
  bloomberg: {
    terminal_boot: [
      { key: "items", label: "Boot log lines", type: "string_array", maxItems: 8 },
    ],
    terminal_narrative: [],
    terminal_chart: [
      { key: "items", label: "Indicator stats", type: "string_array", maxItems: 6 },
    ],
    terminal_dashboard: [
      {
        key: "metrics",
        label: "KPI tiles",
        type: "object_array",
        subFields: [
          { key: "value", label: "Value" },
          { key: "label", label: "Label" },
          { key: "suffix", label: "Change / suffix" },
        ],
        maxItems: 6,
      },
    ],
    terminal_ticker: [
      { key: "items", label: "Ticker rows", type: "string_array", maxItems: 10 },
    ],
    terminal_table: [
      { key: "items", label: "Table rows (first row = header)", type: "string_array", maxItems: 12 },
    ],
    terminal_split: [
      { key: "leftLabel", label: "Left label", type: "string" },
      { key: "rightLabel", label: "Right label", type: "string" },
      { key: "leftDescription", label: "Left description", type: "text" },
      { key: "rightDescription", label: "Right description", type: "text" },
    ],
    terminal_quote: [
      { key: "quote", label: "Quote", type: "text" },
      { key: "highlightWord", label: "Highlight word", type: "string" },
    ],
    terminal_list: [
      { key: "items", label: "Watch list items", type: "string_array", maxItems: 8 },
    ],
    terminal_metric: [
      {
        key: "metrics",
        label: "Metric tiles",
        type: "object_array",
        subFields: [
          { key: "value", label: "Value" },
          { key: "label", label: "Label" },
          { key: "suffix", label: "Suffix", placeholder: "%" },
        ],
        maxItems: 6,
      },
    ],
    terminal_profile: [
      { key: "items", label: "Profile rows", type: "string_array", maxItems: 8 },
    ],
    terminal_options: [
      { key: "items", label: "Options chain rows (first row = header)", type: "string_array", maxItems: 10 },
    ],
    ending_socials: [],
  },
  /** Black Swan — layout content keys (typography still uses sliders + meta defaults). ending_socials uses the dedicated CTA / socials block above. */
  blackswan: {
    droplet_intro: [],
    neon_narrative: [],
    arc_features: [
      { key: "items", label: "Feature items", type: "string_array", maxItems: 6 },
    ],
    pulse_metric: [
      {
        key: "metrics",
        label: "Metrics",
        type: "object_array",
        subFields: [
          { key: "value", label: "Value" },
          { key: "label", label: "Label" },
          { key: "suffix", label: "Suffix" },
        ],
        maxItems: 8,
      },
    ],
    signal_split: [
      { key: "leftLabel", label: "Left label", type: "string" },
      { key: "rightLabel", label: "Right label", type: "string" },
      { key: "leftDescription", label: "Left description", type: "text" },
      { key: "rightDescription", label: "Right description", type: "text" },
    ],
    dive_insight: [
      { key: "quote", label: "Quote", type: "text" },
      { key: "highlightWord", label: "Highlight word", type: "string" },
    ],
    reactor_code: [
      { key: "codeLanguage", label: "Language", type: "string", placeholder: "e.g. typescript" },
      { key: "codeLines", label: "Code lines", type: "string_array", maxItems: 20 },
    ],
    flight_path: [
      { key: "phrases", label: "Path steps", type: "string_array", maxItems: 8 },
    ],
  },
};

/** Structured content fields for AI-generated custom template scenes. */
const CUSTOM_CONTENT_FIELDS: Record<string, FieldDef[]> = {
  bullets: [{ key: "bullets", label: "Bullet points", type: "string_array", maxItems: 8 }],
  metrics: [{ key: "metrics", label: "Metrics", type: "object_array",
    subFields: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }, { key: "suffix", label: "Suffix", placeholder: "%" }], maxItems: 4 }],
  code: [
    { key: "codeLanguage", label: "Language", type: "string", placeholder: "e.g. python" },
    { key: "codeLines", label: "Code lines", type: "string_array" },
  ],
  quote: [
    { key: "quote", label: "Quote", type: "text" },
    { key: "quoteAuthor", label: "Author", type: "string" },
  ],
  comparison: [
    { key: "comparisonLeft.label", label: "Left label", type: "string" },
    { key: "comparisonLeft.description", label: "Left description", type: "text" },
    { key: "comparisonRight.label", label: "Right label", type: "string" },
    { key: "comparisonRight.description", label: "Right description", type: "text" },
  ],
  timeline: [{ key: "timelineItems", label: "Timeline items", type: "object_array",
    subFields: [{ key: "label", label: "Label" }, { key: "description", label: "Description" }], maxItems: 6 }],
  steps: [{ key: "steps", label: "Steps", type: "string_array", maxItems: 8 }],
};

function getLayoutFields(template: string, layoutId: string | null): FieldDef[] | undefined {
  if (!layoutId) return undefined;
  const t = (template || "default").toLowerCase();
  const normalizedTemplate = t === "newsreport" ? "newscast" : t;
  const canonicalLayoutId = normalizeLegacyNewscastLayoutId(t, layoutId);
  return LAYOUT_TEXT_FIELDS_OVERRIDE[normalizedTemplate]?.[canonicalLayoutId] ?? LAYOUT_TEXT_FIELDS[canonicalLayoutId];
}

/** Keys to hide from Layout content — shown elsewhere (Typography, Scene image) or internal. */
const HIDDEN_LAYOUT_PROP_KEYS = new Set([
  "hideImage",
  "assignedImage",
  "imageUrl",
  "titleFontSize",
  "descriptionFontSize",
]);

// Auto-growing textarea component
function AutoGrowTextarea({ value, onChange, className, placeholder, minRows = 2 }: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
  placeholder?: string;
  minRows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const lineHeight = 20; // Approximate line height in pixels
      const minHeight = minRows * lineHeight + 16; // padding
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.max(minHeight, scrollHeight)}px`;
    }
  }, [value, minRows]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      rows={minRows}
    />
  );
}

export interface SceneImageItem {
  url: string;
  asset: Asset;
}

interface Props {
  open: boolean;
  onClose: () => void;
  scene: Scene;
  project: Project;
  imageItems: SceneImageItem[];
  onSaved: () => void;
}

type EditMode = "manual" | "ai";

export default function SceneEditModal({
  open,
  onClose,
  scene,
  project,
  imageItems,
  onSaved,
}: Props) {
  const [editMode, setEditMode] = useState<EditMode>("manual");
  const [title, setTitle] = useState(scene.title);
  const [description, setDescription] = useState("");
  const [displayText, setDisplayText] = useState("");
  const [aiNarration, setAiNarration] = useState(scene.narration_text || "");
  const [titleFontSize, setTitleFontSize] = useState<string>("");
  const [descriptionFontSize, setDescriptionFontSize] = useState<string>("");
  const [editableLayoutProps, setEditableLayoutProps] = useState<Record<string, unknown>>({});
  const [editableStructuredContent, setEditableStructuredContent] = useState<Record<string, unknown>>({});
  const [regenerateVoiceover, setRegenerateVoiceover] = useState(false);
  const [extraHoldSeconds, setExtraHoldSeconds] = useState<string>("");
  const ENDING_SOCIALS_KEYS = [
    "instagram",
    "youtube",
    "medium",
    "substack",
    "facebook",
    "linkedin",
    "tiktok",
  ] as const;
  const ENDING_SOCIALS_DEFAULT: Record<
    typeof ENDING_SOCIALS_KEYS[number],
    { enabled: boolean; label: string }
  > = {
    facebook: { enabled: false, label: "Facebook" },
    instagram: { enabled: false, label: "Instagram" },
    youtube: { enabled: false, label: "YouTube" },
    medium: { enabled: false, label: "Medium" },
    substack: { enabled: false, label: "Substack" },
    linkedin: { enabled: false, label: "LinkedIn" },
    tiktok: { enabled: false, label: "TikTok" },
  };
  const [endingSocials, setEndingSocials] = useState<
    Record<typeof ENDING_SOCIALS_KEYS[number], { enabled: boolean; label: string }>
  >(ENDING_SOCIALS_DEFAULT);
  const [endingShowWebsiteButton, setEndingShowWebsiteButton] = useState(true);
  const [endingWebsiteLink, setEndingWebsiteLink] = useState("");
  const [endingCtaButtonText, setEndingCtaButtonText] = useState("");
  const [selectedLayout, setSelectedLayout] = useState("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [layouts, setLayouts] = useState<LayoutInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [removingAssetId, setRemovingAssetId] = useState<number | null>(null);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedImageBase64, setGeneratedImageBase64] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [showAiImageUpgradeModal, setShowAiImageUpgradeModal] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { showError } = useErrorModal();
  const navigate = useNavigate();

  // Cleanup image preview URL
  useEffect(() => {
    if (selectedImageFile) {
      const url = URL.createObjectURL(selectedImageFile);
      setImagePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setImagePreviewUrl(null);
    }
  }, [selectedImageFile]);

  const isPro = user?.plan === "pro" || user?.plan === "standard";
  const aiUsageCount = project.ai_assisted_editing_count || 0;
  const canUseAI = isPro || aiUsageCount < 3;

  const isCustomTemplate = (project.template || "").startsWith("custom_");
  const normalizedTemplateId = (project.template || "default").toLowerCase();
  const isNewscastTemplate = normalizedTemplateId === "newscast" || normalizedTemplateId === "newsreport";
  const isNightfallTemplate = normalizedTemplateId === "nightfall";
  const isDefaultTemplate = normalizedTemplateId === "default";

  const currentLayoutId = (() => {
    try {
      if (scene.remotion_code) {
        const desc = JSON.parse(scene.remotion_code);
        // Custom templates: check for variant override first
        if (desc.sceneTypeOverride) {
          if (desc.sceneTypeOverride === "content" && typeof desc.contentVariantIndex === "number") {
            return `content_${desc.contentVariantIndex}`;
          }
          return desc.sceneTypeOverride; // "intro" or "outro"
        }
        // Custom templates store arrangement in layoutConfig
        if (desc.layoutConfig?.arrangement) return desc.layoutConfig.arrangement;
        return desc.layout || null;
      }
    } catch { /* ignore */ }
    return null;
  })();
  const currentLayoutLabel = currentLayoutId
    ? getSceneLayoutLabel(
        project.template,
        currentLayoutId,
        layouts?.layout_names[currentLayoutId] || currentLayoutId.replace(/[-_]/g, " ")
      )
    : "Current layout";

  const layoutsWithoutImage = new Set<string>(layouts?.layouts_without_image ?? []);
  const supportsImage = !currentLayoutId || !layoutsWithoutImage.has(currentLayoutId);
  // Custom templates: detect outro by sceneTypeOverride, ctaProps presence, or position (last scene)
  const isCustomOutro = isCustomTemplate && (() => {
    if (currentLayoutId === "outro") return true;
    // Check if ctaProps exists in remotion_code
    try {
      if (scene.remotion_code) {
        const desc = JSON.parse(scene.remotion_code);
        if (desc.ctaProps) return true;
      }
    } catch { /* ignore */ }
    // Position-based: last scene in project
    const sorted = [...project.scenes].sort((a, b) => a.order - b.order);
    return sorted.length > 1 && sorted[sorted.length - 1].id === scene.id;
  })();
  const isEndingScene = currentLayoutId === "ending_socials" || isCustomOutro;

  const defaultFontSizes =
    getDefaultFontSizesFromSchema(
      layouts?.layout_prop_schema,
      currentLayoutId,
      project.aspect_ratio || "landscape"
    ) ??
    getDefaultFontSizes(
      project.template || "default",
      currentLayoutId,
      project.aspect_ratio || "landscape"
    );

  const aiHasChanges =
    description.trim().length > 0 ||
    regenerateVoiceover ||
    selectedLayout !== "__keep__";

  useEffect(() => {
    if (!open) return;
    setTitle(scene.title);
    setDescription("");
    // Prefer dedicated display_text when available; otherwise fall back to narration_text.
    const initialDisplay = scene.display_text ?? scene.narration_text ?? "";
    setDisplayText(initialDisplay);
    setAiNarration(scene.narration_text || "");
    setExtraHoldSeconds(scene.extra_hold_seconds != null ? String(scene.extra_hold_seconds) : "");
    setSelectedLayout("__keep__");
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    setGeneratingImage(false);
    setGeneratedImageBase64(null);
    setGeneratedPrompt(null);
    setShowAiImageUpgradeModal(false);
    let layoutId: string | null = null;
    let ts = "";
    let ds = "";
    let lpCopy: Record<string, unknown> = {};
    if (scene.remotion_code) {
      try {
        const desc = JSON.parse(scene.remotion_code);
        // Custom templates: extract arrangement from layoutConfig
        if (desc.layoutConfig?.arrangement) {
          layoutId = desc.layoutConfig.arrangement;
        } else {
          layoutId = desc.layout || null;
        }
        // Custom templates: font sizes live in layoutConfig, not layoutProps
        if (desc.layoutConfig) {
          if (typeof desc.layoutConfig.titleFontSize === "number") ts = String(desc.layoutConfig.titleFontSize);
          if (typeof desc.layoutConfig.descriptionFontSize === "number") ds = String(desc.layoutConfig.descriptionFontSize);
        }
        const lp = desc.layoutProps || {};
        // Built-in templates: font sizes live in layoutProps
        if (!ts && typeof lp.titleFontSize === "number") ts = String(lp.titleFontSize);
        if (!ds && typeof lp.descriptionFontSize === "number") ds = String(lp.descriptionFontSize);
        lpCopy = { ...lp };
        // data_visualization charts: convert stored shapes to editable form
        if (layoutId === "data_visualization") {
          const lpAny = lp as Record<string, unknown>;
          if (isNewscastTemplate) {
            const directChartTable = normalizeChartTableValue(lpAny.chartTable);
            lpCopy.chartTable = chartTableHasData(directChartTable)
              ? directChartTable
              : buildChartTableFromDataVizLayoutProps(lpAny);
          }
          // Bar: { labels, values } -> barChartRows
          if (lpAny.barChart && typeof lpAny.barChart === "object") {
            const bc = lpAny.barChart as { labels?: string[]; values?: number[] };
            const labels = Array.isArray(bc.labels) ? bc.labels : [];
            const values = Array.isArray(bc.values) ? bc.values : [];
            lpCopy.barChartRows = labels.map((label, i) => ({ label, value: String(values[i] ?? "") }));
            delete (lpCopy as Record<string, unknown>).barChart;
          }
          // Pie: { labels, values } -> pieChartRows
          if (lpAny.pieChart && typeof lpAny.pieChart === "object") {
            const pc = lpAny.pieChart as { labels?: string[]; values?: number[] };
            const plabels = Array.isArray(pc.labels) ? pc.labels : [];
            const pvalues = Array.isArray(pc.values) ? pc.values : [];
            lpCopy.pieChartRows = plabels.map((label, i) => ({ label, value: String(pvalues[i] ?? "") }));
            delete (lpCopy as Record<string, unknown>).pieChart;
          }
          // Line: { labels, datasets: [{ label, values }] } -> lineChartLabels + lineChartDatasets
          if (lpAny.lineChart && typeof lpAny.lineChart === "object") {
            const lc = lpAny.lineChart as { labels?: string[]; datasets?: Array<{ label?: string; values?: number[] }> };
            lpCopy.lineChartLabels = Array.isArray(lc.labels) ? [...lc.labels] : [];
            const datasets = Array.isArray(lc.datasets) ? lc.datasets : [];
            lpCopy.lineChartDatasets = datasets.map((d) => ({
              label: d.label ?? "",
              valuesStr: (Array.isArray(d.values) ? d.values : []).join(", "),
            }));
            delete (lpCopy as Record<string, unknown>).lineChart;
          }
          // Histogram: { labels, values } -> histogramRows
          if (lpAny.histogram && typeof lpAny.histogram === "object") {
            const hg = lpAny.histogram as { labels?: string[]; values?: number[] };
            const hlabels = Array.isArray(hg.labels) ? hg.labels : [];
            const hvalues = Array.isArray(hg.values) ? hg.values : [];
            lpCopy.histogramRows = hlabels.map((label, i) => ({ label, value: String(hvalues[i] ?? "") }));
            delete (lpCopy as Record<string, unknown>).histogram;
          }
          if (isNewscastTemplate) {
            delete (lpCopy as Record<string, unknown>).lineChartLabels;
            delete (lpCopy as Record<string, unknown>).lineChartDatasets;
            delete (lpCopy as Record<string, unknown>).barChartRows;
            delete (lpCopy as Record<string, unknown>).pieChartRows;
            delete (lpCopy as Record<string, unknown>).histogramRows;
          }
          if (isNightfallTemplate || isDefaultTemplate) {
            const editorTableSource = lpCopy as Record<string, unknown>;
            let primaryChartType = inferDataVizTableMode(editorTableSource);
            if (isNightfallTemplate && !["line", "bar", "pie"].includes(primaryChartType)) {
              primaryChartType = "bar";
            }
            if (isDefaultTemplate && !["line", "bar", "histogram"].includes(primaryChartType)) {
              primaryChartType = "bar";
            }

            lpCopy.__dataVizPrimaryChartType = primaryChartType;

            const storedLineTable = normalizeChartTableValue((editorTableSource as Record<string, unknown>).lineChartTable);
            const storedBarTable = normalizeChartTableValue((editorTableSource as Record<string, unknown>).barChartTable);
            const hasStoredLineTable = chartTableHasData(storedLineTable);
            const hasStoredBarTable = chartTableHasData(storedBarTable);

            lpCopy.lineChartTable = hasStoredLineTable
              ? storedLineTable
              : hasLegacyLineData(editorTableSource)
                ? buildChartTableFromDataVizLayoutProps({
                    ...editorTableSource,
                    chartType: "line",
                  })
                : getEmptyChartTableForMode("line");

            lpCopy.barChartTable = hasStoredBarTable
              ? storedBarTable
              : hasLegacyBarData(editorTableSource)
                ? buildChartTableFromDataVizLayoutProps({
                    ...editorTableSource,
                    chartType: "bar",
                  })
                : getEmptyChartTableForMode("bar");

            if (isNightfallTemplate) {
              const storedPieTable = normalizeChartTableValue((editorTableSource as Record<string, unknown>).pieChartTable);
              const hasStoredPieTable = chartTableHasData(storedPieTable);
              lpCopy.pieChartTable = hasStoredPieTable
                ? storedPieTable
                : hasLegacyPieData(editorTableSource)
                  ? buildChartTableFromDataVizLayoutProps({
                      ...editorTableSource,
                      chartType: "pie",
                    })
                  : getEmptyChartTableForMode("pie");
              delete (lpCopy as Record<string, unknown>).histogramChartTable;
            }
            if (isDefaultTemplate) {
              const storedHistogramTable = normalizeChartTableValue((editorTableSource as Record<string, unknown>).histogramChartTable);
              const hasStoredHistogramTable = chartTableHasData(storedHistogramTable);
              lpCopy.histogramChartTable = hasStoredHistogramTable
                ? storedHistogramTable
                : hasLegacyHistogramData(editorTableSource)
                  ? buildChartTableFromDataVizLayoutProps({
                      ...editorTableSource,
                      chartType: "histogram",
                    })
                  : getEmptyChartTableForMode("histogram");
              delete (lpCopy as Record<string, unknown>).pieChartTable;
            }

            delete (lpCopy as Record<string, unknown>).chartTable;
            delete (lpCopy as Record<string, unknown>).chartType;
          }
        }
      } catch { /* ignore */ }
    }
    // For custom templates, CTA data lives in ctaProps, not layoutProps
    if (isCustomTemplate && scene.remotion_code) {
      try {
        const desc = JSON.parse(scene.remotion_code);
        if (desc.ctaProps && typeof desc.ctaProps === "object") {
          lpCopy = { ...lpCopy, ...desc.ctaProps };
        }
      } catch { /* ignore */ }
    }
    setEditableLayoutProps(lpCopy);
    if (isEndingScene) {
      const lpSocials = (lpCopy as Record<string, unknown>).socials;
      if (
        lpSocials &&
        typeof lpSocials === "object" &&
        !Array.isArray(lpSocials)
      ) {
        setEndingSocials(lpSocials as Record<
          typeof ENDING_SOCIALS_KEYS[number],
          { enabled: boolean; label: string }
        >);
      } else {
        setEndingSocials(ENDING_SOCIALS_DEFAULT);
      }
      const lpShowWebsiteButton = (lpCopy as Record<string, unknown>).showWebsiteButton;
      setEndingShowWebsiteButton(lpShowWebsiteButton !== false);
      const lpWebsiteLink = (lpCopy as Record<string, unknown>).websiteLink;
      const projectUrl = (project.blog_url || "").trim();
      const fallbackUrl =
        projectUrl && !projectUrl.startsWith("upload://") ? projectUrl : "";
      const normalizedWebsiteLink =
        typeof lpWebsiteLink === "string" && lpWebsiteLink.trim()
          ? lpWebsiteLink.trim()
          : fallbackUrl;
      setEndingWebsiteLink(normalizedWebsiteLink);
      const lpCta = (lpCopy as Record<string, unknown>).ctaButtonText;
      setEndingCtaButtonText(typeof lpCta === "string" ? lpCta : "");
    } else {
      setEndingSocials(ENDING_SOCIALS_DEFAULT);
      setEndingShowWebsiteButton(true);
      setEndingWebsiteLink("");
      setEndingCtaButtonText("");
    }
    // Initialize structured content for custom templates
    let scInit: Record<string, unknown> = {};
    if (scene.remotion_code) {
      try {
        const desc = JSON.parse(scene.remotion_code);
        if (desc.structuredContent && typeof desc.structuredContent === "object") {
          scInit = { ...desc.structuredContent };
          // Flatten comparison objects for dot-key editing
          if (scInit.comparisonLeft && typeof scInit.comparisonLeft === "object") {
            const cl = scInit.comparisonLeft as Record<string, string>;
            scInit["comparisonLeft.label"] = cl.label || "";
            scInit["comparisonLeft.description"] = cl.description || "";
          }
          if (scInit.comparisonRight && typeof scInit.comparisonRight === "object") {
            const cr = scInit.comparisonRight as Record<string, string>;
            scInit["comparisonRight.label"] = cr.label || "";
            scInit["comparisonRight.description"] = cr.description || "";
          }
        }
      } catch { /* ignore */ }
    }
    setEditableStructuredContent(scInit);
    const schemaDefaults = getDefaultFontSizesFromSchema(
      layouts?.layout_prop_schema,
      layoutId,
      project.aspect_ratio || "landscape"
    );
    const defaults = schemaDefaults ?? getDefaultFontSizes(
      project.template || "default",
      layoutId,
      project.aspect_ratio || "landscape"
    );
    if (!ts) ts = String(defaults.title);
    if (!ds) ds = String(defaults.desc);
    setTitleFontSize(ts);
    setDescriptionFontSize(ds);
  }, [open, scene.id, scene.title, scene.remotion_code, scene.extra_hold_seconds, project.template, project.aspect_ratio, project.blog_url, layouts?.layout_prop_schema]);

  // Fetch layouts when modal opens (needed for manual mode: image support check and layout names)
  useEffect(() => {
    if (open && !layouts) {
      getValidLayouts(project.id)
        .then((res) => setLayouts(res.data))
        .catch(() => showError("Failed to load layouts"));
    }
  }, [open, project.id, layouts]);

  // Merge schema defaults for missing layout props (e.g. new props added via rebuild)
  // useEffect(() => {
  //   if (!open || !layouts?.layout_prop_schema) return;
  //   let layoutId: string | null = null;
  //   try {
  //     if (scene.remotion_code) {
  //       const desc = JSON.parse(scene.remotion_code);
  //       layoutId = desc.layoutConfig?.arrangement ?? desc.layout ?? null;
  //     }
  //   } catch { /* ignore */ }
  //   if (!layoutId) return;
  //   const schema = layouts.layout_prop_schema[layoutId];
  //   if (!schema?.defaults && !schema?.fields?.length) return;
  //   const aspectRatio = project.aspect_ratio || "landscape";
  //   const isPortrait = aspectRatio === "portrait";
  //   setEditableLayoutProps((prev) => {
  //     const next = { ...prev };
  //     let changed = false;
  //     const fieldKeys = new Set((schema.fields ?? []).map((f) => f.key));
  //     const defaults = schema.defaults ?? {};
  //     for (const key of fieldKeys) {
  //       if (key in next) continue;
  //       const def = defaults[key];
  //       if (def !== undefined && def !== null) {
  //         if (typeof def === "object" && !Array.isArray(def) && "portrait" in def && "landscape" in def) {
  //           next[key] = isPortrait ? (def as { portrait: unknown }).portrait : (def as { landscape: unknown }).landscape;
  //         } else {
  //           next[key] = def;
  //         }
  //         changed = true;
  //       }
  //     }
  //     return changed ? next : prev;
  //   });
  // }, [open, layouts?.layout_prop_schema, scene.remotion_code, project.aspect_ratio]);

  useEffect(() => {
    if (!layoutOpen) return;
    const handler = (e: MouseEvent) => {
      if (layoutRef.current && !layoutRef.current.contains(e.target as Node)) {
        setLayoutOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [layoutOpen]);

  const handleSave = async () => {
    if (editMode === "manual") {
      setLoading(true);
      try {
        // Build remotion_code with font size overrides in layoutProps
        let remotionCode: string | undefined;
        const parseNum = (s: string, min: number, max: number): number | null => {
          const n = parseInt(s.trim(), 10);
          return !isNaN(n) ? Math.min(max, Math.max(min, n)) : null;
        };
        const tsNum = parseNum(titleFontSize, 20, 200);
        const dsNum = parseNum(descriptionFontSize, 12, 80);
        const defTitle = defaultFontSizes.title;
        const defDesc = defaultFontSizes.desc;
        if (tsNum !== null || dsNum !== null || scene.remotion_code) {
          let desc: Record<string, unknown> = {};
          if (scene.remotion_code) {
            try {
              desc = JSON.parse(scene.remotion_code);
            } catch { /* ignore */ }
          }
          // Custom templates use layoutConfig — skip layoutProps editing
          if (isCustomTemplate) {
            // Ensure layoutConfig exists for custom templates
            if (!desc.layoutConfig) desc.layoutConfig = {};
            const config = desc.layoutConfig as Record<string, unknown>;
            if (tsNum !== null && tsNum !== defTitle) config.titleFontSize = tsNum;
            else delete config.titleFontSize;
            if (dsNum !== null && dsNum !== defDesc) config.descriptionFontSize = dsNum;
            else delete config.descriptionFontSize;
            // Merge edited structured content back
            if (editableStructuredContent.contentType && editableStructuredContent.contentType !== "plain") {
              const sc = { ...editableStructuredContent };
              // Rebuild comparison objects from dot-key fields
              if (sc.contentType === "comparison") {
                sc.comparisonLeft = {
                  label: String(sc["comparisonLeft.label"] || ""),
                  description: String(sc["comparisonLeft.description"] || ""),
                };
                sc.comparisonRight = {
                  label: String(sc["comparisonRight.label"] || ""),
                  description: String(sc["comparisonRight.description"] || ""),
                };
                delete sc["comparisonLeft.label"];
                delete sc["comparisonLeft.description"];
                delete sc["comparisonRight.label"];
                delete sc["comparisonRight.description"];
              }
              desc.structuredContent = sc;
            }
            if (isEndingScene) {
              desc.ctaProps = {
                socials: endingSocials,
                showWebsiteButton: endingShowWebsiteButton,
                websiteLink: (endingWebsiteLink || "").trim(),
                ctaButtonText: (endingCtaButtonText || "").trim(),
              };
            }
            remotionCode = JSON.stringify(desc);
          } else {
            const lp = { ...(desc.layoutProps as Record<string, unknown> || {}), ...editableLayoutProps };
            // data_visualization: convert editable chart form back to stored shapes
            const layoutId = (desc.layout as string) || "";
            if (layoutId === "data_visualization") {
              if (isNewscastTemplate) {
                const chartTable = normalizeChartTableValue((lp as Record<string, unknown>).chartTable);
                lp.chartTable = chartTable;
              } else if (isNightfallTemplate || isDefaultTemplate) {
                const templateForLegacy = isNightfallTemplate ? "nightfall" : "default";
                delete (lp as Record<string, unknown>).lineChartLabels;
                delete (lp as Record<string, unknown>).lineChartDatasets;
                delete (lp as Record<string, unknown>).barChartRows;
                delete (lp as Record<string, unknown>).pieChartRows;
                delete (lp as Record<string, unknown>).histogramRows;
                delete (lp as Record<string, unknown>).lineChart;
                delete (lp as Record<string, unknown>).barChart;
                delete (lp as Record<string, unknown>).pieChart;
                delete (lp as Record<string, unknown>).histogram;

                const lineTable = normalizeChartTableValue((lp as Record<string, unknown>).lineChartTable);
                const barTable = normalizeChartTableValue((lp as Record<string, unknown>).barChartTable);

                Object.assign(lp, chartTableToLegacyRowProps(lineTable, "line", templateForLegacy));
                Object.assign(lp, chartTableToLegacyRowProps(barTable, "bar", templateForLegacy));

                if (isNightfallTemplate) {
                  const pieTable = normalizeChartTableValue((lp as Record<string, unknown>).pieChartTable);
                  Object.assign(lp, chartTableToLegacyRowProps(pieTable, "pie", templateForLegacy));
                }
                if (isDefaultTemplate) {
                  const histogramTable = normalizeChartTableValue((lp as Record<string, unknown>).histogramChartTable);
                  Object.assign(lp, chartTableToLegacyRowProps(histogramTable, "histogram", templateForLegacy));
                }

                delete (lp as Record<string, unknown>).chartTable;
                delete (lp as Record<string, unknown>).chartType;
                delete (lp as Record<string, unknown>).__dataVizPrimaryChartType;
              }
              if (Array.isArray(lp.barChartRows)) {
                const rows = lp.barChartRows as { label?: string; value?: string }[];
                lp.barChart = {
                  labels: rows.map((r) => (r && r.label != null ? String(r.label) : "")),
                  values: rows.map((r) => (r && r.value != null && r.value !== "" ? Number(r.value) || 0 : 0)),
                };
                delete lp.barChartRows;
              }
              if (Array.isArray(lp.pieChartRows)) {
                const rows = lp.pieChartRows as { label?: string; value?: string }[];
                lp.pieChart = {
                  labels: rows.map((r) => (r && r.label != null ? String(r.label) : "")),
                  values: rows.map((r) => (r && r.value != null && r.value !== "" ? Number(r.value) || 0 : 0)),
                };
                delete lp.pieChartRows;
              }
              if (Array.isArray(lp.lineChartLabels) && Array.isArray(lp.lineChartDatasets)) {
                const labels = (lp.lineChartLabels as string[]).map((l) => (l != null ? String(l) : ""));
                const datasets = (lp.lineChartDatasets as { label?: string; valuesStr?: string }[]).map((d) => ({
                  label: (d && d.label != null ? String(d.label) : "") as string,
                  values: (d && d.valuesStr != null ? String(d.valuesStr) : "")
                    .split(",")
                    .map((s) => Number(s.trim()) || 0),
                }));
                lp.lineChart = { labels, datasets };
                delete lp.lineChartLabels;
                delete lp.lineChartDatasets;
              }
              if (Array.isArray(lp.histogramRows)) {
                const rows = lp.histogramRows as { label?: string; value?: string }[];
                lp.histogram = {
                  labels: rows.map((r) => (r && r.label != null ? String(r.label) : "")),
                  values: rows.map((r) => (r && r.value != null && r.value !== "" ? Number(r.value) || 0 : 0)),
                };
                delete lp.histogramRows;
              }
              if (isNewscastTemplate) {
                delete lp.barChartRows;
                delete lp.pieChartRows;
                delete lp.lineChartLabels;
                delete lp.lineChartDatasets;
                delete lp.histogramRows;
                delete lp.barChart;
                delete lp.pieChart;
                delete lp.lineChart;
                delete lp.histogram;
              }
            }
            // Remove chart keys from layoutProps when entries are empty (so they are not persisted)
            const bar = lp.barChart as { labels?: unknown[]; values?: number[] } | undefined;
            if (bar && (!Array.isArray(bar.labels) || !bar.labels.length || !Array.isArray(bar.values) || !bar.values.length)) {
              delete lp.barChart;
            }
            const pie = lp.pieChart as { labels?: unknown[]; values?: number[] } | undefined;
            if (pie && (!Array.isArray(pie.labels) || !pie.labels.length || !Array.isArray(pie.values) || !pie.values.length)) {
              delete lp.pieChart;
            }
            const line = lp.lineChart as { labels?: unknown[]; datasets?: { values?: number[] }[] } | undefined;
            if (line && (!Array.isArray(line.labels) || !line.labels.length || !Array.isArray(line.datasets) || !line.datasets.length)) {
              delete lp.lineChart;
            }
            const hist = lp.histogram as { labels?: unknown[]; values?: number[] } | undefined;
            if (hist && (!Array.isArray(hist.labels) || !hist.labels.length || !Array.isArray(hist.values) || !hist.values.length)) {
              delete lp.histogram;
            }
            if (tsNum !== null && tsNum !== defTitle) lp.titleFontSize = tsNum;
            else delete lp.titleFontSize;
            if (dsNum !== null && dsNum !== defDesc) lp.descriptionFontSize = dsNum;
            else delete lp.descriptionFontSize;
            if (isEndingScene) {
              lp.hideImage = true;
              lp.socials = endingSocials;
              lp.showWebsiteButton = endingShowWebsiteButton;
              lp.websiteLink = (endingWebsiteLink || "").trim();
              lp.ctaButtonText = (endingCtaButtonText || "").trim();
            }
            desc.layoutProps = lp;
            remotionCode = JSON.stringify(desc);
          }
        }

        const derivedEndingNarrationText = (() => {
          if (!isEndingScene) return null;
          const titlePart = title.trim();
          const displayPart = (displayText ?? "").trim();

          const enabledKeys = ENDING_SOCIALS_KEYS.filter((k) => endingSocials[k]?.enabled);
          const enabledNames = enabledKeys.map(
            (k) => (endingSocials[k]?.label || ENDING_SOCIALS_DEFAULT[k].label)
          );
          const enabledNamesStr = enabledNames.join(", ");

          const canonicalNames = ENDING_SOCIALS_KEYS.map(
            (k) => ENDING_SOCIALS_DEFAULT[k].label
          );

          const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const re = new RegExp(`\\b(${canonicalNames.map(escapeRegex).join("|")})\\b`, "gi");

          const prefix = titlePart.endsWith(".") || titlePart.endsWith("!") || titlePart.endsWith("?")
            ? titlePart
            : `${titlePart}.`;
          const supportCta = enabledNamesStr
            ? `Support this creator by following on ${enabledNamesStr}.`
            : "";

          if (!displayPart) {
            return supportCta ? `${prefix} ${supportCta}` : prefix;
          }

          // Replace the first..last social-name span inside the editable display text
          // so the voiceover mentions only the enabled platforms.
          let match: RegExpExecArray | null = null;
          let firstStart = -1;
          let lastEnd = -1;
          while ((match = re.exec(displayPart)) !== null) {
            const start = match.index ?? 0;
            const end = start + match[0].length;
            if (firstStart === -1) firstStart = start;
            lastEnd = end;
            if (re.lastIndex >= displayPart.length) break;
          }

          if (firstStart >= 0 && lastEnd > firstStart && enabledNamesStr) {
            const before = displayPart.slice(0, firstStart).trimEnd();
            const after = displayPart.slice(lastEnd).trimStart();
            const joined = [before, enabledNamesStr, after]
              .filter(Boolean)
              .join(" ");
            return `${prefix} ${joined} Support this creator by following.`;
          }

          const tail = supportCta ? ` ${supportCta}` : "";
          return `${prefix} ${displayPart}${tail}`.trim();
        })();

        const extraHoldVal = parseFloat(extraHoldSeconds.trim());
        const extraHold = !Number.isNaN(extraHoldVal) && extraHoldVal >= 0 ? extraHoldVal : 0;

        await updateScene(project.id, scene.id, {
          title,
          // Update only the on-screen display text here; narration_text continues to drive voiceover.
          display_text: displayText,
          ...(derivedEndingNarrationText
            ? { narration_text: derivedEndingNarrationText }
            : {}),
          ...(remotionCode !== undefined && { remotion_code: remotionCode }),
          extra_hold_seconds: extraHold,
        });
        if (selectedImageFile) {
          await updateSceneImage(project.id, scene.id, selectedImageFile);
        }
        onSaved();
        onClose();
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : "Failed to update scene";
        showError(String(msg));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (editMode === "ai") {
      const keepLayout = selectedLayout === "__keep__";
      setLoading(true);
      try {
        // If narration text was edited, persist it before regenerating layout/voiceover
        const trimmedNarration = aiNarration.trim();
        if (trimmedNarration !== (scene.narration_text || "").trim()) {
          await updateScene(project.id, scene.id, {
            narration_text: trimmedNarration,
          });
        }

        await regenerateScene(
          project.id,
          scene.id,
          description,
          // For this modal, keep display text unchanged by sending an empty display-text payload.
          "",
          regenerateVoiceover,
          keepLayout ? "__keep__" : (selectedLayout === "__auto__" ? undefined : selectedLayout || undefined),
          selectedImageFile || undefined
        );
        onSaved();
        onClose();
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : "Failed to regenerate scene";
        showError(String(msg));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRemoveImage = async (assetId: number) => {
    setRemovingAssetId(assetId);
    try {
      let descriptor: Record<string, unknown> = {};
      if (scene.remotion_code) {
        try {
          descriptor = JSON.parse(scene.remotion_code);
        } catch {
          /* ignore */
        }
      }

      const layoutProps: Record<string, unknown> = {
        ...((descriptor.layoutProps as Record<string, unknown>) || {}),
        hideImage: true,
      };
      delete layoutProps.assignedImage;
      descriptor.layoutProps = layoutProps;

      await updateScene(project.id, scene.id, {
        remotion_code: JSON.stringify(descriptor),
      });
      setSelectedImageFile(null);
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : "Failed to remove image";
      showError(String(msg));
    } finally {
      setRemovingAssetId(null);
    }
  };

  const hasSceneText =
    Boolean((scene.title || "").trim()) || Boolean((scene.narration_text || "").trim());

  const handleGenerateImageClick = () => {
    if (!isPro) {
      setShowAiImageUpgradeModal(true);
      return;
    }
    handleGenerateImage();
  };

  const handleGenerateImage = async () => {
    setGeneratingImage(true);
    try {
      const res = await generateSceneImage(project.id, scene.id);
      setGeneratedImageBase64(res.data.image_base64);
      setGeneratedPrompt(res.data.refined_prompt);
    } catch (err: unknown) {
      const status = err && typeof err === "object" && "response" in err
        ? (err as { response?: { status?: number } }).response?.status
        : 0;
      if (status === 403) {
        setShowAiImageUpgradeModal(true);
      } else {
        const msg =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : "Image generation failed";
        showError(String(msg));
      }
      setGeneratedImageBase64(null);
      setGeneratedPrompt(null);
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleKeepGeneratedImage = () => {
    if (!generatedImageBase64) return;
    const dataUrl = `data:image/png;base64,${generatedImageBase64}`;
    fetch(dataUrl)
      .then((r) => r.blob())
      .then((blob) => new File([blob], "generated.png", { type: "image/png" }))
      .then((file) => {
        setSelectedImageFile(file);
        setGeneratedImageBase64(null);
        setGeneratedPrompt(null);
      })
      .catch(() => showError("Failed to use generated image"));
  };

  const handleDiscardGeneratedImage = () => {
    setGeneratedImageBase64(null);
    setGeneratedPrompt(null);
  };

  if (!open) return null;

  const manualOnly = editMode === "manual";

  return ReactDOM.createPortal(
    <>
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Edit Scene {scene.order}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Manual vs AI toggle */}
          <div>
            <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">
              Editing mode
            </h4>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditMode("manual")}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  editMode === "manual"
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Manual editing
              </button>
              <button
                type="button"
                onClick={() => setEditMode("ai")}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  editMode === "ai"
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                AI-Assisted editing
              </button>
            </div>
            {editMode === "ai" && canUseAI && (
              <p className="mt-1 text-xs text-gray-600 font-medium">
                AI-Assisted-Editing limit: {isPro ? "Unlimited" : `${Math.max(0, 3 - aiUsageCount)} of 3 remaining this period`}
              </p>
            )}
            {editMode === "ai" && !canUseAI && (
              <p className="mt-1 text-xs font-medium text-red-600">
                The limit for AI-Assisted Editing has been reached.
              </p>
            )}
          </div>

          {/* ── Manual mode fields ── */}
          {editMode === "manual" && (
            <div className="mt-5 space-y-4">
              <div>
                <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Title
                </h4>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Display text
                </h4>
                <AutoGrowTextarea
                  value={displayText}
                  onChange={(e) => setDisplayText(e.target.value)}
                  placeholder="Enter the text that will be displayed on screen..."
                  className="w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-hidden"
                  minRows={2}
                />
              </div>

              <div>
                <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Extra hold (seconds)
                </h4>
                <input
                  type="number"
                  min={0}
                  max={30}
                  step={0.5}
                  value={extraHoldSeconds}
                  onChange={(e) => setExtraHoldSeconds(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  Add seconds after the voiceover ends so animations can complete before transitioning.
                </p>
              </div>

              {/* ── Layout content fields (dynamic per layout type, with extras) ── */}
              {(() => {
                if (isEndingScene) {
                  return (
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                        Social media Links
                      </h4>
                      <div className="space-y-3">
                        <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50/40">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-medium text-gray-800">
                              Call to Action Button
                            </div>
                            <button
                              type="button"
                              onClick={() => setEndingShowWebsiteButton((prev) => !prev)}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                                endingShowWebsiteButton ? "bg-purple-600" : "bg-gray-200"
                              }`}
                              role="switch"
                              aria-checked={endingShowWebsiteButton}
                              aria-label="Toggle website call to action"
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                                  endingShowWebsiteButton ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <label className="block text-[11px] font-medium text-gray-500 mb-1">
                                CTA button label
                              </label>
                              <input
                                type="text"
                                value={endingCtaButtonText}
                                onChange={(e) => setEndingCtaButtonText(e.target.value)}
                                className="w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="e.g. Read the full article"
                              />
                              <p className="mt-1 text-[11px] text-gray-500">
                                Short text on the pill above the link (matches the project font in the video).
                              </p>
                            </div>
                          </div>
                          {endingShowWebsiteButton ? (
                            <div>
                              <label className="block text-[11px] font-medium text-gray-500 mb-1">
                                Website URL
                              </label>
                              <input
                                type="text"
                                value={endingWebsiteLink}
                                onChange={(e) => setEndingWebsiteLink(e.target.value)}
                                className="w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="https://example.com/article"
                              />
                              <p className="mt-1 text-[11px] text-gray-500">
                                Shown under the CTA pill when the toggle is on.
                              </p>
                            </div>
                          ) : null}
                        </div>
                        {ENDING_SOCIALS_KEYS.map((k) => {
                          const item = endingSocials[k];
                          const enabled = Boolean(item?.enabled ?? false);
                          const label = (item?.label ?? ENDING_SOCIALS_DEFAULT[k].label) as string;
                          const platformLabel = ENDING_SOCIALS_DEFAULT[k].label;
                          const platformInitials = platformLabel.slice(0, 2).toUpperCase();
                          return (
                            <div key={k} className="space-y-2">
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEndingSocials((prev) => ({
                                      ...prev,
                                      [k]: { ...(prev[k] ?? ENDING_SOCIALS_DEFAULT[k]), enabled: !enabled },
                                    }));
                                  }}
                                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                                    enabled ? "bg-purple-600" : "bg-gray-200"
                                  }`}
                                  role="switch"
                                  aria-checked={enabled}
                                  aria-label={`Toggle ${platformLabel}`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                                      enabled ? "translate-x-4" : "translate-x-0"
                                    }`}
                                  />
                                </button>
                                <div className="text-sm font-medium text-gray-800">
                                  {platformLabel}
                                </div>
                              </div>

                              {enabled ? (
                                <div>
                                  <input
                                    type="text"
                                    value={label}
                                    onChange={(e) => {
                                      const next = e.target.value;
                                      setEndingSocials((prev) => ({
                                        ...prev,
                                        [k]: { ...(prev[k] ?? ENDING_SOCIALS_DEFAULT[k]), label: next },
                                      }));
                                    }}
                                    className="w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder={`Enter ${k} link or text`}
                                  />
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                const rawLayoutFields = getLayoutFields(project.template || "default", currentLayoutId);
                let layoutFields = (rawLayoutFields ?? []).filter((f) => !HIDDEN_LAYOUT_PROP_KEYS.has(f.key));

                if (isNewscastTemplate && currentLayoutId === "data_visualization") {
                  const chartTable = normalizeChartTableValue((editableLayoutProps as Record<string, unknown>).chartTable);
                  const mode = inferDataVizTableMode(editableLayoutProps as Record<string, unknown>);
                  const numericSeriesCount = Math.max(1, getNumericColumnIndexes(chartTable).length || 1);
                  const barSeriesCount = mode === "bar" ? Math.min(3, numericSeriesCount) : 0;
                  const lineSeriesCount = mode === "line" ? Math.min(3, numericSeriesCount) : 0;

                  layoutFields = layoutFields.filter((field) => {
                    if (field.key === "barPrimaryColor") return mode === "bar" && barSeriesCount >= 1;
                    if (field.key === "barSecondaryColor") return mode === "bar" && barSeriesCount >= 2;
                    if (field.key === "barTertiaryColor") return mode === "bar" && barSeriesCount >= 3;
                    if (field.key === "lineUpColor") return mode === "line" && lineSeriesCount >= 1;
                    if (field.key === "lineDownColor") return mode === "line" && lineSeriesCount >= 1;
                    return true;
                  });
                }

                const knownKeys = new Set(layoutFields.map((f) => f.key));
                const suppressExtraKeysForDataViz =
                  (isNewscastTemplate || isNightfallTemplate || isDefaultTemplate) &&
                  currentLayoutId === "data_visualization";
                const extraKeys =
                  suppressExtraKeysForDataViz
                    ? []
                    : currentLayoutId && editableLayoutProps
                      ? Object.keys(editableLayoutProps).filter(
                          (key) => !knownKeys.has(key) && !HIDDEN_LAYOUT_PROP_KEYS.has(key)
                        )
                      : [];
                if (!currentLayoutId || (layoutFields.length === 0 && extraKeys.length === 0)) return null;
                const humanLabel = (key: string) =>
                  key
                    .replace(/[_-]+/g, " ")
                    .replace(/\b\w/g, (m) => m.toUpperCase());
                return (
                <div>
                  <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                    Layout content
                  </h4>
                  <div className="space-y-4">
                    {layoutFields?.map((field) => {
                      const inputClass = "w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500";
                      const textareaClass = "w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-hidden";
                      if (field.type === "color") {
                        const fallbackColor = normalizeColorValue(field.placeholder ?? "#1E5FD4", "#1E5FD4");
                        const currentColor = normalizeColorValue(editableLayoutProps[field.key], fallbackColor);
                        return (
                          <div key={field.key}>
                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={currentColor}
                                onChange={(e) => setEditableLayoutProps((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                className="h-10 w-12 p-1 border border-gray-200 rounded-lg bg-white cursor-pointer"
                              />
                              <span className="text-xs text-gray-500 tabular-nums">{currentColor.toUpperCase()}</span>
                            </div>
                          </div>
                        );
                      }
                      if (field.type === "chart_table") {
                        const table = normalizeChartTableValue(editableLayoutProps[field.key]);
                        const fixedModeByFieldKey: Partial<Record<string, DataVizTableMode>> = {
                          lineChartTable: "line",
                          barChartTable: "bar",
                          pieChartTable: "pie",
                          histogramChartTable: "histogram",
                        };
                        const mode = fixedModeByFieldKey[field.key] ?? inferDataVizTableMode(editableLayoutProps);
                        const isSeparateDataVizTableEditor =
                          (isNightfallTemplate || isDefaultTemplate) && currentLayoutId === "data_visualization";
                        const primaryChartType = String(
                          (editableLayoutProps as Record<string, unknown>).__dataVizPrimaryChartType ?? "",
                        ).toLowerCase();
                        const isPrimaryTable = !!fixedModeByFieldKey[field.key] && fixedModeByFieldKey[field.key] === primaryChartType;
                        const hasData = chartTableHasData(table);

                        if (isSeparateDataVizTableEditor && fixedModeByFieldKey[field.key] && !isPrimaryTable && !hasData) {
                          const addMode = fixedModeByFieldKey[field.key] as Exclude<DataVizTableMode, "auto">;
                          const emptyTable = getEmptyChartTableForMode(addMode);
                          return (
                            <div key={field.key}>
                              <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/40 p-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditableLayoutProps((prev) => ({
                                      ...prev,
                                      __dataVizPrimaryChartType: addMode,
                                      [field.key]: {
                                        headers: emptyTable.headers,
                                        rows: [Array.from({ length: emptyTable.headers.length }, () => "")],
                                      },
                                    }));
                                  }}
                                  className="px-2 py-1 text-[11px] font-medium rounded border border-gray-200 text-gray-600 hover:text-purple-600 hover:border-purple-400 bg-white"
                                >
                                  + Add {field.label.toLowerCase()}
                                </button>
                              </div>
                            </div>
                          );
                        }

                        const inferredLineSeriesCount = lineSeriesCountFromLayoutProps(editableLayoutProps);
                        const tableLineSeriesCount = countLineSeriesInChartTable(table);
                        const effectiveLineSeriesCount =
                          tableLineSeriesCount > 0 ? tableLineSeriesCount : inferredLineSeriesCount;
                        const projected = projectChartTableForMode(table, mode, effectiveLineSeriesCount);
                        const fixedColumnCount =
                          mode === "histogram" || mode === "pie"
                            ? 2
                            : mode === "bar" || mode === "line"
                              ? Math.max(2, Math.min(4, 1 + effectiveLineSeriesCount))
                              : null;
                        const visibleTable = fixedColumnCount != null
                          ? {
                              headers: projected.headers.slice(0, fixedColumnCount),
                              rows: projected.rows.map((r) => r.slice(0, fixedColumnCount)),
                            }
                          : projected;
                        const updateTable = (next: { headers: string[]; rows: string[][] }) => {
                          const normalizedNext = normalizeChartTableValue(next);
                          const clampedNext = fixedColumnCount != null
                            ? {
                                headers: normalizedNext.headers.slice(0, fixedColumnCount),
                                rows: normalizedNext.rows.map((r) => r.slice(0, fixedColumnCount)),
                              }
                            : normalizedNext;
                          setEditableLayoutProps((prev) => ({ ...prev, [field.key]: clampedNext }));
                        };
                        return (
                          <div key={field.key}>
                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 overflow-x-auto">
                              <table className="min-w-full border-separate border-spacing-0">
                                <thead>
                                  <tr>
                                    {visibleTable.headers.map((header, colIndex) => (
                                      <th key={`h-${colIndex}`} className="p-1.5 align-top">
                                        <input
                                          type="text"
                                          value={header}
                                          placeholder={colIndex === 0 ? "Label" : `Series ${colIndex}`}
                                          onChange={(e) => {
                                            const headers = [...visibleTable.headers];
                                            headers[colIndex] = e.target.value;
                                            updateTable({ headers, rows: visibleTable.rows });
                                          }}
                                          className="w-full px-2 py-1.5 text-xs text-gray-700 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {visibleTable.rows.map((row, rowIndex) => (
                                    <tr key={`r-${rowIndex}`}>
                                      {visibleTable.headers.map((_, colIndex) => (
                                        <td key={`c-${rowIndex}-${colIndex}`} className="p-1.5">
                                          <input
                                            type="text"
                                            value={row[colIndex] ?? ""}
                                            onChange={(e) => {
                                              const rows = visibleTable.rows.map((r) => [...r]);
                                              rows[rowIndex][colIndex] = e.target.value;
                                              updateTable({ headers: visibleTable.headers, rows });
                                            }}
                                            className="w-full px-2 py-1.5 text-xs text-gray-700 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                          />
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rows = [...visibleTable.rows, Array.from({ length: visibleTable.headers.length }, () => "")];
                                    updateTable({ headers: visibleTable.headers, rows });
                                  }}
                                  className="px-2 py-1 text-[11px] font-medium rounded border border-gray-200 text-gray-600 hover:text-purple-600 hover:border-purple-400 bg-white"
                                >
                                  + Row
                                </button>
                                {fixedColumnCount == null ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const headers = [...visibleTable.headers, `Series ${visibleTable.headers.length}`];
                                      const rows = visibleTable.rows.map((r) => [...r, ""]);
                                      updateTable({ headers, rows });
                                    }}
                                    className="px-2 py-1 text-[11px] font-medium rounded border border-gray-200 text-gray-600 hover:text-purple-600 hover:border-purple-400 bg-white"
                                  >
                                    + Column
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (visibleTable.rows.length === 0) return;
                                    updateTable({ headers: visibleTable.headers, rows: visibleTable.rows.slice(0, -1) });
                                  }}
                                  className="px-2 py-1 text-[11px] font-medium rounded border border-gray-200 text-gray-600 hover:text-red-500 hover:border-red-300 bg-white"
                                >
                                  - Row
                                </button>
                                {fixedColumnCount == null ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (visibleTable.headers.length <= 2) return;
                                      const headers = visibleTable.headers.slice(0, -1);
                                      const rows = visibleTable.rows.map((r) => r.slice(0, -1));
                                      updateTable({ headers, rows });
                                    }}
                                    className="px-2 py-1 text-[11px] font-medium rounded border border-gray-200 text-gray-600 hover:text-red-500 hover:border-red-300 bg-white"
                                  >
                                    - Column
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      if (field.type === "select") {
                        const opts = field.options ?? [];
                        const defaultVal = field.default ?? opts[0]?.value ?? "";
                        const sel = String(editableLayoutProps[field.key] ?? defaultVal);
                        return (
                          <div key={field.key}>
                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                            <select
                              value={sel}
                              onChange={(e) =>
                                setEditableLayoutProps((prev) => ({ ...prev, [field.key]: e.target.value }))
                              }
                              className={inputClass}
                            >
                              {opts.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      }
                      if (field.type === "number") {
                        return (
                          <div key={field.key}>
                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                            <input
                              type="number"
                              value={editableLayoutProps[field.key] !== undefined ? Number(editableLayoutProps[field.key]) : (field.default ?? field.min ?? 0)}
                              onChange={(e) => setEditableLayoutProps((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))}
                              min={field.min}
                              max={field.max}
                              step={field.step ?? 1}
                              className={inputClass}
                            />
                          </div>
                        );
                      }
                      if (field.type === "range") {
                        const rangeVal = editableLayoutProps[field.key] !== undefined ? Number(editableLayoutProps[field.key]) : (field.default ?? field.min ?? 0);
                        return (
                          <div key={field.key}>
                            <div className="flex justify-between items-baseline mb-1">
                              <label className="text-xs text-gray-400">{field.label}</label>
                              <span className="text-xs font-medium text-purple-600 tabular-nums">{rangeVal}</span>
                            </div>
                            <input
                              type="range"
                              value={rangeVal}
                              onChange={(e) => setEditableLayoutProps((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))}
                              min={field.min}
                              max={field.max}
                              step={field.step ?? 1}
                              className="w-full h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-purple-600"
                            />
                          </div>
                        );
                      }
                      if (field.type === "string") {
                        return (
                          <div key={field.key}>
                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                            <input
                              type="text"
                              value={String(editableLayoutProps[field.key] ?? "")}
                              onChange={(e) => setEditableLayoutProps((prev) => ({ ...prev, [field.key]: e.target.value }))}
                              placeholder={field.placeholder}
                              className={inputClass}
                            />
                          </div>
                        );
                      }
                      if (field.type === "text") {
                        return (
                          <div key={field.key}>
                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                            <AutoGrowTextarea
                              value={String(editableLayoutProps[field.key] ?? "")}
                              onChange={(e) => setEditableLayoutProps((prev) => ({ ...prev, [field.key]: e.target.value }))}
                              placeholder={field.placeholder}
                              className={textareaClass}
                              minRows={2}
                            />
                          </div>
                        );
                      }
                      if (field.type === "string_array") {
                        const items = (Array.isArray(editableLayoutProps[field.key]) ? editableLayoutProps[field.key] : []) as string[];
                        return (
                          <div key={field.key}>
                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                            <div className="space-y-2">
                              {items.map((item, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <span className="text-[11px] text-gray-400 w-5 text-right flex-shrink-0 tabular-nums">{i + 1}.</span>
                                  <input
                                    type="text"
                                    value={item}
                                    onChange={(e) => {
                                      const updated = [...items];
                                      updated[i] = e.target.value;
                                      setEditableLayoutProps((prev) => ({ ...prev, [field.key]: updated }));
                                    }}
                                    className={`flex-1 ${inputClass}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = items.filter((_, j) => j !== i);
                                      setEditableLayoutProps((prev) => ({ ...prev, [field.key]: updated }));
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 rounded-lg hover:bg-gray-100"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                              {(!field.maxItems || items.length < field.maxItems) && (
                                <button
                                  type="button"
                                  onClick={() => setEditableLayoutProps((prev) => ({ ...prev, [field.key]: [...items, ""] }))}
                                  className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider hover:text-purple-600 mt-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Add {field.label.toLowerCase().replace(/s$/, "")}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      }
                      if (field.type === "object_array" && field.subFields) {
                        const items = (Array.isArray(editableLayoutProps[field.key]) ? editableLayoutProps[field.key] : []) as Record<string, string>[];
                        return (
                          <div key={field.key}>
                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                            <div className="space-y-3">
                              {items.map((item, i) => (
                                <div key={i} className="flex items-start gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                                  <span className="text-[11px] text-gray-400 w-5 text-right flex-shrink-0 pt-2 tabular-nums">{i + 1}.</span>
                                  <div className="flex-1 space-y-2">
                                    {field.subFields!.map((sf) => (
                                      <div key={sf.key}>
                                        <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1 block">{sf.label}</label>
                                        <input
                                          type="text"
                                          value={item[sf.key] ?? ""}
                                          placeholder={sf.placeholder || sf.label}
                                          onChange={(e) => {
                                            const updated = [...items];
                                            updated[i] = { ...updated[i], [sf.key]: e.target.value };
                                            setEditableLayoutProps((prev) => ({ ...prev, [field.key]: updated }));
                                          }}
                                          className={inputClass}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = items.filter((_, j) => j !== i);
                                      setEditableLayoutProps((prev) => ({ ...prev, [field.key]: updated }));
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 rounded-lg hover:bg-gray-100 mt-1"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                              {(!field.maxItems || items.length < field.maxItems) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const empty: Record<string, string> = {};
                                    field.subFields!.forEach((sf) => { empty[sf.key] = ""; });
                                    setEditableLayoutProps((prev) => ({ ...prev, [field.key]: [...items, empty] }));
                                  }}
                                  className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider hover:text-purple-600 mt-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Add {field.label.toLowerCase().replace(/s$/, "")}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })}
                    {extraKeys.length > 0 && (
                      <div className="space-y-3">
                        {extraKeys.map((key) => (
                          <div key={key}>
                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">
                              {humanLabel(key)}
                            </label>
                            <input
                              type="text"
                              value={String(editableLayoutProps[key] ?? "")}
                              onChange={(e) =>
                                setEditableLayoutProps((prev) => ({
                                  ...prev,
                                  [key]: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
              })()}

              {/* ── Structured content fields for custom templates ── */}
              {(() => {
                if (!isCustomTemplate) return null;
                const ct = (editableStructuredContent.contentType as string) || "plain";
                const scFields = CUSTOM_CONTENT_FIELDS[ct];
                const inputClass = "w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500";
                const textareaClass = "w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-hidden";
                const contentTypeOptions = [
                  { value: "plain", label: "Plain text" },
                  { value: "bullets", label: "Bullet points" },
                  { value: "steps", label: "Steps" },
                  { value: "metrics", label: "Metrics" },
                  { value: "quote", label: "Quote" },
                  { value: "comparison", label: "Comparison" },
                  { value: "timeline", label: "Timeline" },
                  { value: "code", label: "Code" },
                ];
                return (
                  <div>
                    <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                      Structured content
                    </h4>
                    <div className="mb-3">
                      <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">Content type</label>
                      <select
                        value={ct}
                        onChange={(e) => setEditableStructuredContent((prev) => ({ ...prev, contentType: e.target.value }))}
                        className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                      >
                        {contentTypeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {ct === "plain" && (
                        <p className="text-[11px] text-gray-400 mt-1.5">Switch to a structured type above to add bullets, metrics, or other rich content that overrides template defaults.</p>
                      )}
                    </div>
                    <div className="space-y-4">
                      {(scFields || []).map((field) => {
                        if (field.type === "string") {
                          return (
                            <div key={field.key}>
                              <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                              <input
                                type="text"
                                value={String(editableStructuredContent[field.key] ?? "")}
                                onChange={(e) => setEditableStructuredContent((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                placeholder={field.placeholder}
                                className={inputClass}
                              />
                            </div>
                          );
                        }
                        if (field.type === "text") {
                          return (
                            <div key={field.key}>
                              <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                              <AutoGrowTextarea
                                value={String(editableStructuredContent[field.key] ?? "")}
                                onChange={(e) => setEditableStructuredContent((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                placeholder={field.placeholder}
                                className={textareaClass}
                                minRows={2}
                              />
                            </div>
                          );
                        }
                        if (field.type === "string_array") {
                          const items = (Array.isArray(editableStructuredContent[field.key]) ? editableStructuredContent[field.key] : []) as string[];
                          return (
                            <div key={field.key}>
                              <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                              <div className="space-y-2">
                                {items.map((item, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <span className="text-[11px] text-gray-400 w-5 text-right flex-shrink-0 tabular-nums">{i + 1}.</span>
                                    <input
                                      type="text"
                                      value={item}
                                      onChange={(e) => {
                                        const updated = [...items];
                                        updated[i] = e.target.value;
                                        setEditableStructuredContent((prev) => ({ ...prev, [field.key]: updated }));
                                      }}
                                      className={`flex-1 ${inputClass}`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = items.filter((_, j) => j !== i);
                                        setEditableStructuredContent((prev) => ({ ...prev, [field.key]: updated }));
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 rounded-lg hover:bg-gray-100"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                ))}
                                {(!field.maxItems || items.length < field.maxItems) && (
                                  <button
                                    type="button"
                                    onClick={() => setEditableStructuredContent((prev) => ({ ...prev, [field.key]: [...items, ""] }))}
                                    className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider hover:text-purple-600 mt-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add {field.label.toLowerCase().replace(/s$/, "")}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        }
                        if (field.type === "object_array" && field.subFields) {
                          const items = (Array.isArray(editableStructuredContent[field.key]) ? editableStructuredContent[field.key] : []) as Record<string, string>[];
                          return (
                            <div key={field.key}>
                              <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                              <div className="space-y-3">
                                {items.map((item, i) => (
                                  <div key={i} className="flex items-start gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                                    <span className="text-[11px] text-gray-400 w-5 text-right flex-shrink-0 pt-2 tabular-nums">{i + 1}.</span>
                                    <div className="flex-1 space-y-2">
                                      {field.subFields!.map((sf) => (
                                        <div key={sf.key}>
                                          <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1 block">{sf.label}</label>
                                          <input
                                            type="text"
                                            value={item[sf.key] ?? ""}
                                            placeholder={sf.placeholder || sf.label}
                                            onChange={(e) => {
                                              const updated = [...items];
                                              updated[i] = { ...updated[i], [sf.key]: e.target.value };
                                              setEditableStructuredContent((prev) => ({ ...prev, [field.key]: updated }));
                                            }}
                                            className={inputClass}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = items.filter((_, j) => j !== i);
                                        setEditableStructuredContent((prev) => ({ ...prev, [field.key]: updated }));
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 rounded-lg hover:bg-gray-100 mt-1"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                ))}
                                {(!field.maxItems || items.length < field.maxItems) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const empty: Record<string, string> = {};
                                      field.subFields!.forEach((sf) => { empty[sf.key] = ""; });
                                      setEditableStructuredContent((prev) => ({ ...prev, [field.key]: [...items, empty] }));
                                    }}
                                    className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider hover:text-purple-600 mt-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add {field.label.toLowerCase().replace(/s$/, "")}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                );
              })()}

              <div>
                <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2.5">
                  Typography <span className="normal-case tracking-normal text-gray-300">(optional)</span>
                </h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-baseline">
                      <label className="text-xs text-gray-400">Title font size</label>
                      <span className="text-xs font-medium text-purple-600 tabular-nums">{titleFontSize}</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={200}
                      step={1}
                      value={Math.min(200, Math.max(20, parseInt(titleFontSize, 10) || defaultFontSizes.title))}
                      onChange={(e) => setTitleFontSize(e.target.value)}
                      className="w-full h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-purple-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-baseline ">
                      <label className="text-xs text-gray-400">Description font size</label>
                      <span className="text-xs font-medium text-purple-600 tabular-nums">{descriptionFontSize}</span>
                    </div>
                    <input
                      type="range"
                      min={12}
                      max={80}
                      step={1}
                      value={Math.min(80, Math.max(12, parseInt(descriptionFontSize, 10) || defaultFontSizes.desc))}
                      onChange={(e) => setDescriptionFontSize(e.target.value)}
                      className="w-full h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-purple-600"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Scene image
                </h4>
                {supportsImage ? (
                  <>
                  <div className="flex flex-wrap gap-2">
                    {imageItems.map(({ url, asset }) => (
                      <div
                        key={asset.id}
                        className="relative group rounded-lg overflow-hidden border border-gray-200/40 flex-shrink-0"
                      >
                        <img
                          src={url}
                          alt=""
                          className="h-20 w-auto object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(asset.id)}
                          disabled={removingAssetId === asset.id}
                          className="absolute top-0.5 right-0.5 w-6 h-6 flex items-center justify-center rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 disabled:opacity-50 transition-colors"
                        >
                          {removingAssetId === asset.id ? (
                            <span className="text-[10px]">…</span>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </button>
                      </div>
                    ))}
                    {selectedImageFile && imagePreviewUrl && (
                      <div className="relative group rounded-lg overflow-hidden border-2 border-purple-400 flex-shrink-0">
                        <img
                          src={imagePreviewUrl}
                          alt="New image"
                          className="h-20 w-auto object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImageFile(null);
                            setImagePreviewUrl(null);
                          }}
                          className="absolute top-0.5 right-0.5 w-6 h-6 flex items-center justify-center rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                    <label className="flex items-center justify-center w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50/50 hover:bg-gray-100/50 cursor-pointer transition-colors">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/jpg"
                        onChange={(e) => setSelectedImageFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateImageClick}
                      disabled={!hasSceneText || generatingImage}
                      className="group relative flex items-center justify-center w-20 h-20 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/50 hover:bg-purple-100/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-purple-700"
                    >
                      {generatingImage ? (
                        <span className="text-xs">…</span>
                      ) : (
                        <>
                          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] font-medium text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap max-w-[180px] text-center">
                            {hasSceneText ? "Generate Image with AI" : "Add title or narration to generate an image"}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                  {!hasSceneText && (
                    <p className="text-xs text-gray-400 mt-1.5">Add a title or narration to use AI image generation.</p>
                  )}
                  </>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    This layout does not support images. You can change the layout through AI assisted editing to an image supporting layout.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── AI-Assisted mode fields ── */}
          {editMode === "ai" && (
            <div className={`mt-5 space-y-4 ${!canUseAI ? "pointer-events-none opacity-60" : ""}`}>
              <div>
                <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Visual description <span className="normal-case tracking-normal text-gray-300">(optional)</span>
                </h4>
                <AutoGrowTextarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe how you want the visuals to change..."
                  className="w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-hidden"
                  minRows={2}
                />
              </div>

              <div>
                <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Narration text (voiceover script)
                </h4>
                <AutoGrowTextarea
                  value={aiNarration}
                  onChange={(e) => setAiNarration(e.target.value)}
                  placeholder="Edit the narration that will be spoken in the voiceover..."
                  className="w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-hidden"
                  minRows={3}
                />
                <p className="mt-1 text-xs text-gray-500">
                  This controls the spoken narration and scene timing. Display text is edited in Manual mode.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  Regenerate voiceover
                </h4>
                <button
                  type="button"
                  onClick={() => setRegenerateVoiceover(!regenerateVoiceover)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                    regenerateVoiceover ? "bg-purple-600" : "bg-gray-200"
                  }`}
                  role="switch"
                  aria-checked={regenerateVoiceover}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      regenerateVoiceover ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div ref={layoutRef} className="relative">
                <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                  Layout
                </h4>
                <div className="flex items-center gap-2">
                  <span className="inline-block px-2.5 py-1 bg-purple-50 text-purple-600 rounded-lg text-xs font-medium">
                    {selectedLayout === "__keep__"
                      ? (currentLayoutLabel)
                      : selectedLayout === "__auto__"
                        ? "Auto (Let AI choose)"
                        : getSceneLayoutLabel(
                            project.template,
                            selectedLayout,
                            layouts?.layout_names[selectedLayout] || selectedLayout.replace(/[-_]/g, " ")
                          )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLayoutOpen(!layoutOpen)}
                    className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${layoutOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                {layoutOpen && (
                  <div className="absolute z-10 mt-1.5 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => { setSelectedLayout("__keep__"); setLayoutOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-purple-50 transition-colors ${
                        selectedLayout === "__keep__" ? "text-purple-600 font-medium bg-purple-50/50" : "text-gray-600"
                      }`}
                    >
                      {currentLayoutLabel}
                      {currentLayoutId && (
                        <span className={`ml-1 ${supportsImage ? "text-gray-500" : "text-gray-400 italic"}`}>
                          ({supportsImage ? "Supports images" : "Does not support images"})
                        </span>
                      )}
                    </button>
                    {!isCustomTemplate && (
                      <button
                        type="button"
                        onClick={() => { setSelectedLayout("__auto__"); setLayoutOpen(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-purple-50 transition-colors ${
                          selectedLayout === "__auto__" ? "text-purple-600 font-medium bg-purple-50/50" : "text-gray-600"
                        }`}
                      >
                        Auto (Let AI choose)
                      </button>
                    )}
                    {layouts?.layouts
                      .filter((id) => id !== currentLayoutId)
                      .map((layoutId) => {
                        const supportsImageForLayout = !layoutsWithoutImage.has(layoutId);
                        return (
                          <button
                            key={layoutId}
                            type="button"
                            onClick={() => { setSelectedLayout(layoutId); setLayoutOpen(false); }}
                            className={`w-full text-left px-3 py-2.5 text-xs hover:bg-purple-50 transition-colors ${
                              selectedLayout === layoutId ? "text-purple-600 font-medium bg-purple-50/50" : "text-gray-600"
                            }`}
                          >
                            {getSceneLayoutLabel(
                              project.template,
                              layoutId,
                              layouts.layout_names[layoutId] || layoutId.replace(/[-_]/g, " ")
                            )}
                            <span className={`ml-1 ${supportsImageForLayout ? "text-gray-500" : "text-gray-400 italic"}`}>
                              ({supportsImageForLayout ? "Supports images" : "Does not support images"})
                            </span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || (editMode === "ai" && (!aiHasChanges || !canUseAI))}
            className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : editMode === "manual" ? "Save changes" : "Apply AI edit"}
          </button>
        </div>
      </div>
    </div>

    <UpgradePlanModal
      open={showAiImageUpgradeModal}
      onClose={() => setShowAiImageUpgradeModal(false)}
      projectId={project?.id}
    />

    {/* AI generated image preview popup */}
    {generatedImageBase64 && (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleDiscardGeneratedImage}
        />
        <div
          className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-900">AI generated image</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleKeepGeneratedImage}
                className="w-7 h-7 flex items-center justify-center rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
                title="Use this image"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleDiscardGeneratedImage}
                className="w-7 h-7 flex items-center justify-center rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
                title="Discard"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 flex flex-col items-center bg-gray-50 min-h-0">
            <img
              src={`data:image/png;base64,${generatedImageBase64}`}
              alt="AI generated"
              className="max-w-full max-h-[70vh] w-auto h-auto object-contain rounded-lg shadow-inner"
            />
          </div>
        </div>
      </div>
    )}
    </>,
    document.body
  );
}
