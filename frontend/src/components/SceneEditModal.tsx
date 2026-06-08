import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";
import ReactDOM from "react-dom";
import {
  Scene,
  Project,
  Asset,
  updateScene,
  updateSceneImage,
  assignExistingImageToScene,
  updateSceneImageFocus,
  regenerateScene,
  getValidLayouts,
  LayoutInfo,
  type LayoutPropSchema,
  type LayoutPropFieldType,
} from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useCraftedTemplates } from "../contexts/CraftedTemplatesContext";
import { useErrorModal, getErrorMessage } from "../contexts/ErrorModalContext";
import { useNavigate } from "react-router-dom";
import UpgradePlanModal from "./UpgradePlanModal";
import GenerateSceneImageModal from "./GenerateSceneImageModal";
import { getSceneLayoutLabel } from "../utils/layoutLabels";
import { chartTableToLegacyRowProps } from "../utils/chartTableDataVizLegacy";
import { compileDataModule } from "../utils/compileComponent";
import { normalizeLayoutId } from "./remotion/imageBoxConfig";

/** Image framing sub-modal: uniform zoom only (no rectangular crop resize). */
const IMAGE_ADJUST_ZOOM_MIN = 0.1;
const IMAGE_ADJUST_ZOOM_MAX = 8;
import { OHLCVTableEditor } from "./OHLCVTableEditor";
import { SpreadsheetTable } from "./SpreadsheetTable";
import { ImportPreviewSheet } from "./ImportPreviewSheet";
import * as XLSX from "xlsx";

type CraftedImageBoxEntry = string | { landscape?: string; portrait?: string } | undefined;

type CraftedImageBoxConfig = {
  default?: CraftedImageBoxEntry;
  layouts?: Record<string, CraftedImageBoxEntry>;
} & Record<string, unknown>;

type FontSizePair = { title: number; desc: number };
type CraftedFontSizeLeaf = {
  title?: number;
  desc?: number;
  titleFontSize?: number;
  descriptionFontSize?: number;
};
type CraftedFontSizeEntry = CraftedFontSizeLeaf | {
  landscape?: CraftedFontSizeLeaf;
  portrait?: CraftedFontSizeLeaf;
};
type CraftedFontSizeConfig = {
  default?: CraftedFontSizeEntry;
  layouts?: Record<string, CraftedFontSizeEntry>;
} & Record<string, unknown>;

const CRAFTED_IMAGE_BOX_CONFIG_CANDIDATES = [
  "frontend/imageBoxConfig.json",
  "imageBoxConfig.json",
  "frontend/config/imageBoxConfig.json",
];
const CRAFTED_FONT_SIZE_CONFIG_CANDIDATES = [
  "frontend/fontSizeDefaults.json",
  "frontend/fontDefaults.json",
  "fontSizeDefaults.json",
  "fontDefaults.json",
  "frontend/config/fontSizeDefaults.json",
];

const _normalizeLayoutKey = (layoutId: string | null): string => {
  return String(layoutId || "").trim().toLowerCase().replace(/[-\s]+/g, "_");
};

const _pickCraftedAr = (
  entry: CraftedImageBoxEntry,
  orientation: "landscape" | "portrait",
): string | null => {
  if (!entry) return null;
  if (typeof entry === "string") {
    const v = entry.trim();
    return v || null;
  }
  const v = (entry[orientation] || entry.landscape || entry.portrait || "").trim();
  return v || null;
};

const _resolveCraftedImageBoxArFromFiles = (
  filesMap: Record<string, string> | null,
  layoutId: string | null,
  aspectRatio: string | null | undefined,
): string | null => {
  if (!filesMap) return null;
  const orientation: "landscape" | "portrait" = aspectRatio === "portrait" ? "portrait" : "landscape";

  let configRaw: string | null = null;
  for (const p of CRAFTED_IMAGE_BOX_CONFIG_CANDIDATES) {
    if (typeof filesMap[p] === "string" && filesMap[p].trim()) {
      configRaw = filesMap[p];
      break;
    }
  }
  if (!configRaw) return null;

  let parsed: CraftedImageBoxConfig | null = null;
  try {
    parsed = JSON.parse(configRaw) as CraftedImageBoxConfig;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const rawLayout = _normalizeLayoutKey(layoutId);
  const normalizedAlias = _normalizeLayoutKey(layoutId ? normalizeLayoutId(layoutId) : null);

  const byLayouts = parsed.layouts && typeof parsed.layouts === "object"
    ? parsed.layouts
    : null;

  const directRecord = parsed as Record<string, CraftedImageBoxEntry>;
  const hit =
    (byLayouts && (byLayouts[rawLayout] ?? byLayouts[normalizedAlias])) ??
    directRecord[rawLayout] ??
    directRecord[normalizedAlias] ??
    parsed.default;

  return _pickCraftedAr(hit, orientation);
};

const _toFiniteFontNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

const _pickCraftedFontPair = (
  entry: CraftedFontSizeEntry | undefined,
  orientation: "landscape" | "portrait",
): FontSizePair | null => {
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  const oriented =
    ((e[orientation] as Record<string, unknown> | undefined) || (e.landscape as Record<string, unknown> | undefined) || (e.portrait as Record<string, unknown> | undefined) || e);
  const title =
    _toFiniteFontNumber(oriented.title) ??
    _toFiniteFontNumber(oriented.titleFontSize);
  const desc =
    _toFiniteFontNumber(oriented.desc) ??
    _toFiniteFontNumber(oriented.descriptionFontSize);
  if (title == null && desc == null) return null;
  return {
    title: Math.round(title ?? 44),
    desc: Math.round(desc ?? 24),
  };
};

const _resolveCraftedFontDefaultsFromFiles = (
  filesMap: Record<string, string> | null,
  layoutId: string | null,
  aspectRatio: string | null | undefined,
): FontSizePair | null => {
  if (!filesMap) return null;
  const orientation: "landscape" | "portrait" = aspectRatio === "portrait" ? "portrait" : "landscape";
  let configRaw: string | null = null;
  for (const p of CRAFTED_FONT_SIZE_CONFIG_CANDIDATES) {
    if (typeof filesMap[p] === "string" && filesMap[p].trim()) {
      configRaw = filesMap[p];
      break;
    }
  }
  if (!configRaw) return null;

  let parsed: CraftedFontSizeConfig | null = null;
  try {
    parsed = JSON.parse(configRaw) as CraftedFontSizeConfig;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const rawLayout = _normalizeLayoutKey(layoutId);
  const normalizedAlias = _normalizeLayoutKey(layoutId ? normalizeLayoutId(layoutId) : null);
  const byLayouts = parsed.layouts && typeof parsed.layouts === "object"
    ? parsed.layouts
    : null;
  const directRecord = parsed as Record<string, CraftedFontSizeEntry>;

  const hit =
    (byLayouts && (byLayouts[rawLayout] ?? byLayouts[normalizedAlias])) ??
    directRecord[rawLayout] ??
    directRecord[normalizedAlias] ??
    parsed.default;

  return _pickCraftedFontPair(hit, orientation);
};

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

export function resolveDefaultFontSizesForScene(args: {
  template: string;
  layoutId: string | null;
  aspectRatio: string;
  layoutPropSchema?: Record<string, { defaults?: Record<string, unknown> }>;
  craftedFrontendFiles?: Record<string, string> | null;
}): { title: number; desc: number } {
  const {
    template,
    layoutId,
    aspectRatio,
    layoutPropSchema,
    craftedFrontendFiles,
  } = args;
  const craftedDefaults = _resolveCraftedFontDefaultsFromFiles(
    craftedFrontendFiles || null,
    layoutId,
    aspectRatio
  );
  const schemaDefaults = getDefaultFontSizesFromSchema(
    layoutPropSchema,
    layoutId,
    aspectRatio
  );
  return craftedDefaults ?? schemaDefaults ?? getDefaultFontSizes(
    template,
    layoutId,
    aspectRatio
  );
}

// ─── Layout text field definitions ──────────────────────────
type FieldType =
  | "string"
  | "color"
  | "text"
  | "string_array"
  | "object_array"
  | "chart_table"
  | "ohlcv_table"
  | "pipe_table"
  | "ticker_table"
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

/** Maps LaDuc `market_annotation*` layout ids to a concrete chart kind for example-table seeding. */
function getLaDucMarketAnnotationChartTypeForLayout(
  layoutId: string,
): "line" | "bar" | "histogram" | undefined {
  switch (layoutId) {
    case "market_annotation":
      return "line";
    case "market_annotation_bar":
      return "bar";
    case "market_annotation_histogram":
      return "histogram";
    default:
      return undefined;
  }
}

/**
 * LaDuc `market_annotation` example datasets per chart type — mirrors the
 * defaults shipped in `backend/templates/laduc/meta.json` for the
 * `market_annotation` / `market_annotation_bar` / `market_annotation_histogram`
 * studio variants. Used to swap chartTable when the user changes chartType so
 * the preview renders cleanly with shape-appropriate labels (dates for line,
 * categories for bar, bucket ranges for histogram).
 */
function getLaDucMarketAnnotationExampleTable(
  chartType: "line" | "bar" | "histogram",
): { headers: string[]; rows: string[][] } {
  if (chartType === "line") {
    return {
      headers: ["Date", "Close", "Flow index", "Positioning"],
      rows: [
        ["2024-01-02", "298", "72", "41"],
        ["2024-02-01", "308", "68", "44"],
        ["2024-03-01", "315", "61", "39"],
        ["2024-04-01", "324", "55", "36"],
        ["2024-05-01", "318", "59", "33"],
      ],
    };
  }
  if (chartType === "bar") {
    return {
      headers: ["Sector", "Close", "Flow index", "Positioning"],
      rows: [
        ["Tech", "324", "72", "41"],
        ["Energy", "308", "55", "36"],
        ["Healthcare", "315", "61", "39"],
        ["Financials", "298", "68", "44"],
        ["Semis", "318", "59", "33"],
      ],
    };
  }
  return {
    headers: ["Score bucket", "Flow index", "Positioning"],
    rows: [
      ["30 - 40", "0", "1"],
      ["40 - 50", "0", "2"],
      ["50 - 60", "2", "2"],
      ["60 - 70", "2", "0"],
      ["70 - 80", "1", "0"],
    ],
  };
}

function getFJResearchMarketAnnotationExampleTable(
  chartType: "line" | "bar" | "histogram",
): { headers: string[]; rows: string[][] } {
  if (chartType === "line") {
    return {
      headers: ["Date", "Close", "Flow index", "Positioning"],
      rows: [
        ["2024-01-02", "298", "72", "41"],
        ["2024-02-01", "308", "68", "44"],
        ["2024-03-01", "315", "61", "39"],
        ["2024-04-01", "324", "55", "36"],
        ["2024-05-01", "318", "59", "33"],
      ],
    };
  }
  if (chartType === "bar") {
    return {
      headers: ["Sector", "Series A", "Series B"],
      rows: [
        ["Semis", "42", "28"],
        ["Energy", "38", "35"],
        ["Financials", "45", "32"],
        ["Healthcare", "40", "38"],
        ["Industrials", "36", "34"],
        ["Tech", "50", "41"],
      ],
    };
  }
  return {
    headers: ["Score bucket", "Count"],
    rows: [
      ["0–10", "2"],
      ["10–20", "6"],
      ["20–30", "14"],
      ["30–40", "18"],
      ["40–50", "10"],
      ["50–60", "4"],
    ],
  };
}

/**
 * Mirrors `mergeMarketAnnotationChartDefaults()` in
 * [VideoPreview.tsx](./VideoPreview.tsx) — fills `chartTable` (and
 * `chartType`) from `meta.json` `layout_prop_schema[layout].defaults`
 * when the stored layoutProps don't carry one. Keeps SceneEditModal's
 * "Edit chart data" preview in sync with the project preview and the
 * rendered MP4.
 *
 * Narrowly scoped to `market_annotation*` layouts only.
 * Keep this in sync with the VideoPreview copy.
 */
function mergeMarketAnnotationChartDefaultsForLayout(
  layoutProps: Record<string, unknown>,
  layoutId: string | null | undefined,
  schema: Record<string, { defaults?: Record<string, unknown> }> | null | undefined,
): Record<string, unknown> {
  if (!layoutId || !layoutId.startsWith("market_annotation")) return layoutProps;
  if (!schema || Object.keys(schema).length === 0) return layoutProps;
  const defaults = schema[layoutId]?.defaults;
  if (!defaults || Object.keys(defaults).length === 0) return layoutProps;

  const existingTable = layoutProps.chartTable;
  const existingTableHasRows =
    existingTable &&
    typeof existingTable === "object" &&
    Array.isArray((existingTable as { rows?: unknown }).rows) &&
    ((existingTable as { rows: unknown[] }).rows.length > 0);
  if (existingTableHasRows && layoutProps.chartType) return layoutProps;

  const next = { ...layoutProps };
  if (!existingTableHasRows && defaults.chartTable && typeof defaults.chartTable === "object") {
    next.chartTable = defaults.chartTable;
  }
  if (!layoutProps.chartType && typeof defaults.chartType === "string") {
    next.chartType = defaults.chartType;
  }
  return next;
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
  // LaDuc layouts
  data_impact: [
    { key: "category", label: "Eyebrow label", type: "string", placeholder: "e.g. April 2026 · The Stealth Bid" },
    { key: "stats", label: "Data columns", type: "object_array", subFields: [{ key: "value", label: "Number / Amount" }, { key: "label", label: "Category Name" }], maxItems: 5 },
  ],
  deep_dive: [
    { key: "category", label: "Eyebrow label", type: "string", placeholder: "e.g. Macro · Deep Dive" },
    { key: "stats", label: "Fact rows", type: "object_array", subFields: [{ key: "label", label: "Tag (1–2 words)" }, { key: "value", label: "Supporting fact sentence" }], maxItems: 4 },
    { key: "footerNote", label: "Footer tag", type: "string", placeholder: "e.g. Source: Bloomberg · Apr 2026" },
    { key: "editorialWordmark", label: "Top-left brand strip", type: "string", placeholder: "LaDuc · Macro→Micro" },
    { key: "websiteDomain", label: "Domain (chrome footer)", type: "string", placeholder: "laductrading.com" },
  ],
  // LaDuc layouts that don't share IDs with other templates
  two_column: [
    { key: "category", label: "Eyebrow label", type: "string" },
    { key: "leftTitle", label: "Left column title", type: "string" },
    { key: "rightTitle", label: "Right column title", type: "string" },
    { key: "leftBody", label: "Left body text", type: "text" },
    { key: "rightBody", label: "Right body text", type: "text" },
    { key: "editorialWordmark", label: "Top-left brand strip", type: "string", placeholder: "LaDuc · Macro→Micro" },
    { key: "websiteDomain", label: "Domain (chrome footer)", type: "string", placeholder: "laductrading.com" },
  ],
  framework_flow: [
    { key: "category", label: "Eyebrow label", type: "string", placeholder: "e.g. The Process · 5 Steps" },
    { key: "steps", label: "Steps", type: "object_array", subFields: [{ key: "number", label: "Number (01–06)" }, { key: "label", label: "Step name (short)" }, { key: "sub", label: "Subtitle (3–6 words)" }], maxItems: 6 },
    { key: "footerNote", label: "Footer note", type: "string" },
    { key: "editorialWordmark", label: "Top-left brand strip", type: "string", placeholder: "LaDuc · Macro→Micro" },
    { key: "websiteDomain", label: "Domain (chrome footer)", type: "string", placeholder: "laductrading.com" },
  ],
  sign_off: [
    { key: "category", label: "Issue / session label", type: "string", placeholder: "e.g. Issue #12 · May 2026" },
    { key: "signOff", label: "Closing line", type: "string", placeholder: "e.g. We make our own luck." },
    { key: "footerNote", label: "Footer note", type: "string" },
    { key: "editorialWordmark", label: "Top-left brand strip", type: "string", placeholder: "LaDuc · Macro→Micro" },
    { key: "websiteDomain", label: "Domain (chrome footer)", type: "string", placeholder: "laductrading.com" },
  ],
  market_annotation: [
    { key: "category", label: "Eyebrow label", type: "string", placeholder: "e.g. $GOLD · Price trend" },
    { key: "chartTable", label: "Chart data table", type: "chart_table" },
    { key: "subtitle", label: "X-axis label", type: "string", placeholder: "e.g. Trading date" },
    { key: "yAxisLabel", label: "Y-axis label", type: "string", placeholder: "e.g. Price (Rs.)" },
    { key: "barPrimaryColor", label: "Bar/line color 1", type: "color", placeholder: "#60939C" },
    { key: "barSecondaryColor", label: "Bar/line color 2", type: "color", placeholder: "#CBBCA2" },
    { key: "stats", label: "Trade levels (optional)", type: "object_array", subFields: [{ key: "label", label: "Label (ENTRY/TARGET/STOP)" }, { key: "value", label: "Level" }], maxItems: 3 },
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
      {
        key: "chartType",
        label: "Chart Type",
        type: "select",
        default: "bar",
        options: [
          { label: "Bar", value: "bar" },
          { label: "Line", value: "line" },
          { label: "Histogram", value: "histogram" },
        ],
      },
      { key: "barPrimaryColor", label: "Bar color 1", type: "color", placeholder: "#FF3B30" },
      { key: "barSecondaryColor", label: "Bar color 2", type: "color", placeholder: "#1E5FD4" },
      { key: "barTertiaryColor", label: "Bar color 3", type: "color", placeholder: "#FF3B30" },
      { key: "lineUpColor", label: "Line color 1", type: "color", placeholder: "#3CE46A" },
      { key: "lineDownColor", label: "Line color 2", type: "color", placeholder: "#FF3B30" },
      { key: "lineThirdColor", label: "Line color 3", type: "color", placeholder: "#1E5FD4" },
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
      { key: "ticker", label: "Ticker / symbol tag", type: "string" },
      { key: "ohlcvTable", label: "OHLCV Chart Data", type: "ohlcv_table" },
      { key: "xAxisLabel", label: "X-axis label", type: "string", placeholder: "e.g. TRADING DAYS" },
      { key: "yAxisLabel", label: "Y-axis label", type: "string", placeholder: "e.g. PRICE ($)" },
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
      { key: "items", label: "Table rows (first row = header)", type: "pipe_table", maxItems: 12 },
    ],
    terminal_split: [
      { key: "leftLabel", label: "Left label", type: "string" },
      { key: "rightLabel", label: "Right label", type: "string" },
      { key: "leftDescription", label: "Left description", type: "text" },
      { key: "rightDescription", label: "Right description", type: "text" },
    ],
    terminal_dataviz: [
      { key: "chartTable", label: "Chart data table", type: "chart_table" },
      {
        key: "chartType",
        label: "Chart Type",
        type: "select",
        options: [
          { label: "Auto-detect", value: "auto" },
          { label: "Bar", value: "bar" },
          { label: "Line", value: "line" },
          { label: "Histogram", value: "histogram" },
        ],
      },
      { key: "xAxisLabel", label: "X-axis label", type: "string", placeholder: "e.g. Year" },
      { key: "yAxisLabel", label: "Y-axis label", type: "string", placeholder: "e.g. Revenue ($)" },
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
      { key: "items", label: "Options chain rows (first row = header)", type: "pipe_table", maxItems: 10 },
    ],
    ending_socials: [],
  },
  /** Chronicle — medieval tome layout content keys. ending_socials uses the dedicated CTA / socials block above. */
  chronicle: {
    book_open: [],
    parchment_scroll: [
      { key: "category", label: "Section tag", type: "string", placeholder: "e.g. Chapter I, Folio II" },
      { key: "illuminatedLetter", label: "Drop cap letter (optional)", type: "string", placeholder: "Auto from first letter" },
      {
        key: "stats",
        label: "Byline / dating (optional)",
        type: "object_array",
        subFields: [
          { key: "value", label: "Value" },
          { key: "label", label: "Label" },
        ],
        maxItems: 2,
      },
    ],
    chapter_plate: [
      {
        key: "subtitle",
        label: "Kicker above title (optional)",
        type: "string",
        placeholder: "e.g. Act One, The Founding Years — leave blank to skip",
      },
    ],
    illuminated_quote: [
      { key: "quote", label: "Quote (overrides narration)", type: "text" },
      { key: "highlightPhrase", label: "Phrase to highlight in red", type: "string" },
      { key: "attribution", label: "Attribution", type: "string" },
    ],
    ledger_stats: [
      {
        key: "stats",
        label: "Ledger entries (1-3)",
        type: "object_array",
        subFields: [
          { key: "value", label: "Number" },
          { key: "label", label: "Descriptor" },
        ],
        maxItems: 3,
      },
    ],
    versus_folio: [
      { key: "leftLabel", label: "Left page heading", type: "string" },
      { key: "rightLabel", label: "Right page heading", type: "string" },
      { key: "leftDescription", label: "Left page body", type: "text" },
      { key: "rightDescription", label: "Right page body", type: "text" },
    ],
    chronicle_timeline: [
      {
        key: "stats",
        label: "Waypoints (up to 4)",
        type: "object_array",
        subFields: [
          { key: "value", label: "Year / marker" },
          { key: "label", label: "Event" },
        ],
        maxItems: 4,
      },
    ],
    map_reveal: [],
    decree_seal: [
      { key: "word", label: "The blackletter word", type: "string", placeholder: "e.g. DECREED, FINIS, HONOR" },
      { key: "highlightWord", label: "Alt word (ignored if 'word' set)", type: "string" },
      { key: "cta", label: "Sign-off", type: "string" },
    ],
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
  /** LaDuc — overrides for layout IDs shared with other templates */
  laduc: {
    masthead: [
      { key: "category", label: "Issue line", type: "string", placeholder: "e.g. May 2026 · Issue 12" },
      { key: "subheading", label: "Subheading / deck", type: "string", placeholder: "e.g. Macro-to-Micro · April 2026" },
      { key: "issueTag", label: "Issue badge (top-right)", type: "string", placeholder: "e.g. May 2026" },
      { key: "editorialWordmark", label: "Top-left brand strip", type: "string", placeholder: "LaDuc · Macro→Micro" },
      { key: "websiteDomain", label: "Domain (chrome footer)", type: "string", placeholder: "laductrading.com" },
    ],
    thesis_statement: [
      { key: "category", label: "Eyebrow label", type: "string", placeholder: "e.g. The Thesis" },
      { key: "quote", label: "Core thesis (displayed large)", type: "text", placeholder: "e.g. A synthetic bull rally cannot afford to stall." },
      { key: "attribution", label: "Attribution / source", type: "string", placeholder: "e.g. LaDuc · May 2026" },
      { key: "subheading", label: "Kicker above quote", type: "string" },
      { key: "footerNote", label: "Footer note", type: "string" },
      { key: "editorialWordmark", label: "Top-left brand strip", type: "string", placeholder: "LaDuc · Macro→Micro" },
      { key: "websiteDomain", label: "Domain (chrome footer)", type: "string", placeholder: "laductrading.com" },
    ],
    kinetic_quote: [
      { key: "quote", label: "Full quote text", type: "text", placeholder: "e.g. Don't risk more than you are willing to lose." },
      { key: "highlightWord", label: "Word to italicize", type: "string", placeholder: "e.g. willing" },
      { key: "attribution", label: "Attribution", type: "string", placeholder: "e.g. — Samantha LaDuc" },
      { key: "category", label: "Eyebrow label", type: "string", placeholder: "e.g. Mom's Smell Test" },
      { key: "editorialWordmark", label: "Top-left brand strip", type: "string", placeholder: "LaDuc · Macro→Micro" },
      { key: "websiteDomain", label: "Domain (chrome footer)", type: "string", placeholder: "laductrading.com" },
    ],
    ticker: [
      { key: "tickerTitle", label: "Table title", type: "string", placeholder: "e.g. Portfolio Holdings · Q1 2026" },
      { key: "tickerFootnote", label: "Footnote / source", type: "string", placeholder: "e.g. Source: Bloomberg" },
      { key: "tickerTable", label: "Ticker rows", type: "ticker_table" },
      { key: "editorialWordmark", label: "Top-left brand strip", type: "string", placeholder: "LaDuc · Macro→Micro" },
      { key: "websiteDomain", label: "Domain (chrome footer)", type: "string", placeholder: "laductrading.com" },
    ],
    market_annotation: [
      { key: "category", label: "Chart label", type: "string", placeholder: "e.g. $GOLD · Price trend" },
      { key: "editorialWordmark", label: "Top-left brand strip", type: "string", placeholder: "LaDuc · Macro→Micro" },
      {
        key: "chartType",
        label: "Chart type",
        type: "select",
        default: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "line", label: "Line" },
          { value: "bar", label: "Bar" },
          { value: "histogram", label: "Histogram" },
        ],
      },
      { key: "subtitle", label: "X-axis / category caption", type: "string", placeholder: "e.g. Trading date" },
      { key: "yAxisLabel", label: "Y-axis label", type: "string", placeholder: "e.g. Index / score" },
      { key: "chartSummary", label: "Chart summary (short read beside the graphic)", type: "string", placeholder: "Price trends higher through April..." },
      { key: "chartTimeframeLabel", label: "Chart timeframe label (top-right)", type: "string", placeholder: "1D / 5m" },
      { key: "footerNote", label: "Y-axis caption / footer note", type: "string", placeholder: "Source: Bloomberg" },
      { key: "narration", label: "Thesis quote (bottom italic)", type: "string" },
      { key: "barPrimaryColor", label: "Bar / line color 1", type: "color", placeholder: "#60939C" },
      { key: "barSecondaryColor", label: "Bar / line color 2", type: "color", placeholder: "#CBBCA2" },
      { key: "websiteDomain", label: "Domain (chrome footer)", type: "string", placeholder: "laductrading.com" },
      { key: "chartYAxisTicks", label: "Y-axis tick labels (top → bottom, 2–4 values)", type: "string_array", maxItems: 4 },
      { key: "chartTable", label: "Chart data (col 1: X labels; cols 2–4: numeric series; max 20 rows)", type: "chart_table" },
    ],
    ending_socials: [
      { key: "brandName", label: "Brand name", type: "string", placeholder: "e.g. LaDucTrading" },
      { key: "ctaButtonText", label: "CTA button text", type: "string", placeholder: "e.g. Join LaDucTrading" },
      { key: "websiteLink", label: "Website URL", type: "string", placeholder: "e.g. https://laductrading.com" },
    ],
  },
  fj_research: {
    market_annotation: [
      { key: "category", label: "Chart label", type: "string", placeholder: "e.g. S&P 500 · Daily · May 2026" },
      { key: "editorialWordmark", label: "Top-left brand strip", type: "string", placeholder: "FJResearch · Chart Desk" },
      {
        key: "chartType",
        label: "Chart type",
        type: "select",
        default: "auto",
        options: [
          { value: "auto", label: "Auto (infer from data)" },
          { value: "line", label: "Line" },
          { value: "bar", label: "Bar" },
          { value: "histogram", label: "Histogram" },
        ],
      },
      { key: "subtitle", label: "X-axis / category caption", type: "string", placeholder: "e.g. Trading date" },
      { key: "yAxisLabel", label: "Y-axis label", type: "string", placeholder: "e.g. Index level" },
      { key: "chartSummary", label: "Chart summary (short read beside the graphic)", type: "string", placeholder: "Market context and key takeaway..." },
      { key: "chartTimeframeLabel", label: "Chart timeframe label (top-right)", type: "string", placeholder: "1D / 5m" },
      { key: "footerNote", label: "Y-axis caption / footer note", type: "string", placeholder: "Source: Bloomberg Terminal" },
      { key: "narration", label: "Thesis quote (bottom italic)", type: "string" },
      { key: "barPrimaryColor", label: "Bar / line color 1", type: "color", placeholder: "#0A0A0A" },
      { key: "barSecondaryColor", label: "Bar / line color 2", type: "color", placeholder: "#B5B5B5" },
      { key: "websiteDomain", label: "Domain (chrome footer)", type: "string", placeholder: "fj_researchtrading.com" },
      { key: "chartYAxisTicks", label: "Y-axis tick labels (top → bottom, 2–4 values)", type: "string_array", maxItems: 4 },
      { key: "chartTable", label: "Chart data (col 1: X labels; cols 2–4: numeric series; max 20 rows)", type: "chart_table" },
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

/**
 * Module-scoped cache of compiled crafted-template layout field defs.
 * Keyed by `template_id`. Survives modal close/reopen within the session;
 * cleared on full reload (matches localStorage cache TTL behavior).
 */
const __craftedLayoutFieldsCache = new Map<string, Record<string, FieldDef[]>>();

/** Keys to hide from Layout content — shown elsewhere (Typography, Scene image) or internal. */
const HIDDEN_LAYOUT_PROP_KEYS = new Set([
  "hideImage",
  "assignedImage",
  "imageUrl",
  "imageBoxAspectRatio",
  "ImageBoxAspectRatio",
  "image_box_aspect_ratio",
  "titleFontSize",
  "descriptionFontSize",
]);

const HIDDEN_LAYOUT_PROP_KEYS_LOWER = new Set(
  Array.from(HIDDEN_LAYOUT_PROP_KEYS).map((k) => k.toLowerCase()),
);

function isHiddenLayoutPropKey(key: string): boolean {
  return HIDDEN_LAYOUT_PROP_KEYS_LOWER.has(String(key || "").toLowerCase());
}

/**
 * Keys that were once valid for a template/layout but have been deprecated.
 * They are silently hidden from the editor so stale scene data doesn't surface
 * dead fields. (The value may still exist in saved `layoutProps` but the
 * layout component no longer reads it.)
 */
const DEPRECATED_LAYOUT_PROP_KEYS: Record<string, Record<string, Set<string>>> = {
  chronicle: {
    chapter_plate: new Set(["chapterNumber"]),
  },
};

function isDeprecatedLayoutPropKey(
  template: string | undefined,
  layoutId: string | null,
  key: string,
): boolean {
  if (!template || !layoutId) return false;
  const t = template.toLowerCase();
  return DEPRECATED_LAYOUT_PROP_KEYS[t]?.[layoutId]?.has(key) ?? false;
}

function schemaLayoutPropTypeToFieldType(t: LayoutPropFieldType): FieldType | null {
  switch (t) {
    case "string":
    case "text":
    case "color":
    case "number":
    case "select":
    case "string_array":
    case "object_array":
      return t;
    case "chart_table":
      return "chart_table";
    default:
      return null;
  }
}

/** Prefer bundled layoutFields.ts; fall back to API meta.layout_prop_schema for crafted templates. */
function layoutPropSchemaToFieldDefs(schema: LayoutPropSchema | undefined): FieldDef[] | undefined {
  if (!schema?.fields?.length) return undefined;
  const out: FieldDef[] = [];
  for (const f of schema.fields) {
    if (isHiddenLayoutPropKey(f.key)) continue;
    const ft = schemaLayoutPropTypeToFieldType(f.type);
    if (!ft) continue;
    out.push({
      key: f.key,
      label: f.label,
      type: ft,
      placeholder: f.placeholder,
      maxItems: f.maxItems,
      min: f.min,
      max: f.max,
      step: f.step,
      options: f.options?.map((o) => ({ value: o.value, label: o.label })),
      subFields: f.subFields,
    });
  }
  return out.length ? out : undefined;
}

function pickCraftedCompiledLayoutFields(
  byLayout: Record<string, FieldDef[]> | null | undefined,
  layoutId: string | null,
): FieldDef[] | undefined {
  if (!byLayout || !layoutId) return undefined;
  const direct = byLayout[layoutId];
  if (Array.isArray(direct) && direct.length > 0) return direct;
  const lower = layoutId.toLowerCase();
  const altKey = Object.keys(byLayout).find((k) => k.toLowerCase() === lower);
  const alt = altKey ? byLayout[altKey] : undefined;
  if (Array.isArray(alt) && alt.length > 0) return alt;
  return undefined;
}

function pickLayoutPropSchemaFieldDefs(
  schemaMap: Record<string, LayoutPropSchema> | undefined,
  layoutId: string | null,
): FieldDef[] | undefined {
  if (!schemaMap || !layoutId) return undefined;
  let defs = layoutPropSchemaToFieldDefs(schemaMap[layoutId]);
  if (defs?.length) return defs;
  const lower = layoutId.toLowerCase();
  const altKey = Object.keys(schemaMap).find((k) => k.toLowerCase() === lower);
  return altKey ? layoutPropSchemaToFieldDefs(schemaMap[altKey]) : undefined;
}

function normalizeObjectArrayItems(raw: unknown): Record<string, string>[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((it) => {
    if (it != null && typeof it === "object" && !Array.isArray(it)) {
      const o = it as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const k of Object.keys(o)) {
        const v = o[k];
        out[k] =
          v == null
            ? ""
            : typeof v === "string" || typeof v === "number" || typeof v === "boolean"
              ? String(v)
              : JSON.stringify(v);
      }
      return out;
    }
    return { value: String(it ?? "") };
  });
}

function inferObjectArraySubFields(
  items: Record<string, string>[],
): { key: string; label: string; placeholder?: string }[] {
  const first = items.find((row) => row && typeof row === "object");
  if (!first) return [];
  return Object.keys(first).map((k) => ({
    key: k,
    label: k.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
  }));
}

function formatUnknownLayoutPropValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseUnknownLayoutPropValue(raw: string, prevValue: unknown): unknown {
  // For array/object props, preserve shape by accepting JSON edits.
  if (Array.isArray(prevValue) || (prevValue != null && typeof prevValue === "object")) {
    const trimmed = raw.trim();
    if (!trimmed) return Array.isArray(prevValue) ? [] : {};
    try {
      return JSON.parse(trimmed);
    } catch {
      return prevValue;
    }
  }
  return raw;
}

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
  availableImageItems: SceneImageItem[];
  onSaved: () => void;
  openImageAdjustOnOpen?: boolean;
  /** When set, the modal renders read-only inside a help video (no API calls, inline render). */
  demoMode?: SceneEditModalDemoMode;
}

type EditMode = "manual" | "ai";

/** Read-only demo mode used by help videos: skips API calls, seeds editing state, renders inline. */
export interface SceneEditModalDemoMode {
  editMode?: EditMode;
  regenerateVoiceover?: boolean;
}

export function SceneEditModalDemo({
  scene,
  editMode = "manual",
  regenerateVoiceover = false,
}: {
  scene: Scene;
  editMode?: EditMode;
  regenerateVoiceover?: boolean;
}) {
  const inputClass =
    "w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500";
  const textareaClass = `${inputClass} resize-none overflow-hidden`;

  return (
    <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Edit Scene {scene.order}</h2>
        <button className="p-1 rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-6 overflow-y-auto flex-1">
        <div>
          <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">
            Editing mode
          </h4>
          <div className="flex gap-2">
            <button
              type="button"
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
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                editMode === "ai"
                  ? "border-purple-500 bg-purple-50 text-purple-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              AI-Assisted editing
            </button>
          </div>
          {editMode === "ai" && (
            <p className="mt-1 text-xs text-gray-600 font-medium">
              AI-Assisted-Editing limit: Unlimited
            </p>
          )}
        </div>

        {editMode === "manual" ? (
          <div className="mt-5 space-y-4">
            <div>
              <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Title</h4>
              <input type="text" readOnly value={scene.title} className={inputClass} />
            </div>
            <div>
              <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                Display text
              </h4>
              <textarea
                readOnly
                value={scene.display_text ?? scene.narration_text}
                className={textareaClass}
                rows={2}
              />
            </div>
            <div>
              <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                Narration text (voiceover script)
              </h4>
              <textarea readOnly value={scene.narration_text} className={textareaClass} rows={3} />
            </div>
            <div>
              <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                Layout
              </h4>
              <select disabled value="statement" className={`${inputClass} bg-white`}>
                <option value="statement">Statement</option>
              </select>
            </div>
            <div>
              <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                Scene image
              </h4>
              <div className="flex flex-wrap gap-2">
                <button className="flex items-center justify-center w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50/50 hover:bg-gray-100/50 transition-colors">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <button className="group relative flex items-center justify-center w-20 h-20 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/50 hover:bg-purple-100/50 transition-colors text-purple-700">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                Visual description <span className="normal-case tracking-normal text-gray-300">(optional)</span>
              </h4>
              <textarea
                readOnly
                value="Make the scene more concise and emphasize the main takeaway."
                className={textareaClass}
                rows={2}
              />
            </div>
            <div>
              <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                Narration text (voiceover script)
              </h4>
              <textarea readOnly value={scene.narration_text} className={textareaClass} rows={3} />
              <p className="mt-1.5 text-xs text-gray-400">
                This controls the spoken narration and scene timing. Display text is edited in Manual mode.
              </p>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none p-3 rounded-xl bg-gray-50/60 border border-gray-200/60 hover:border-gray-300/60 transition-all">
              <input
                type="checkbox"
                readOnly
                checked={regenerateVoiceover}
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500/30 cursor-pointer accent-purple-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Regenerate voiceover</span>
                <p className="text-[11px] text-gray-400 mt-0.5">Create new audio for this scene after saving.</p>
              </div>
            </label>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-2">
        <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
          Cancel
        </button>
        <button className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors">
          {editMode === "manual" ? "Save changes" : "Apply AI edit"}
        </button>
      </div>
    </div>
  );
}

export default function SceneEditModal({
  open,
  onClose,
  scene,
  project,
  imageItems,
  availableImageItems,
  onSaved,
  openImageAdjustOnOpen = false,
  demoMode,
}: Props) {
  const isDemo = !!demoMode;
  const [editMode, setEditMode] = useState<EditMode>(demoMode?.editMode ?? "manual");
  const [title, setTitle] = useState(scene.title);
  const [description, setDescription] = useState("");
  const [displayText, setDisplayText] = useState("");
  const [aiNarration, setAiNarration] = useState(scene.narration_text || "");
  const [titleFontSize, setTitleFontSize] = useState<string>("");
  const [descriptionFontSize, setDescriptionFontSize] = useState<string>("");
  const [editableLayoutProps, setEditableLayoutProps] = useState<Record<string, unknown>>({});
  const [editableStructuredContent, setEditableStructuredContent] = useState<Record<string, unknown>>({});
  const [regenerateVoiceover, setRegenerateVoiceover] = useState(demoMode?.regenerateVoiceover ?? false);
  // When true, the narration is spoken word-for-word (no AI rephrasing on regeneration).
  const [matchNarrationExactly, setMatchNarrationExactly] = useState(true);
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
  type EndingSocialKey = typeof ENDING_SOCIALS_KEYS[number];
  type CtaDraft = {
    ctaButtonText: string;
    websiteLink: string;
    showWebsiteButton: boolean;
  };
  const MAX_CTAS = 3;
  const makeDefaultCta = (): CtaDraft => ({
    ctaButtonText: "",
    websiteLink: "",
    showWebsiteButton: true,
  });
  // Multi-CTA: array of 1..3 CTAs. The socials list below is global to the scene
  // (matches the original single-CTA UX). Each CTA is just a pill + URL.
  const [ctas, setCtas] = useState<CtaDraft[]>([makeDefaultCta()]);
  const [endingSocials, setEndingSocials] = useState<
    Record<EndingSocialKey, { enabled: boolean; label: string }>
  >(ENDING_SOCIALS_DEFAULT);
  // Derived single-CTA mirror, fed from ctas[0]. Renderers that still read the
  // flat layoutProps fields (most crafted templates) see this; the new ctas array
  // is also persisted so updated renderers can fan out into columns.
  const endingShowWebsiteButton = ctas[0]?.showWebsiteButton ?? true;
  const endingWebsiteLink = ctas[0]?.websiteLink ?? "";
  const endingCtaButtonText = ctas[0]?.ctaButtonText ?? "";
  const [selectedLayout, setSelectedLayout] = useState("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imageSourceChooserOpen, setImageSourceChooserOpen] = useState(false);
  const [scrapedImagesModalOpen, setScrapedImagesModalOpen] = useState(false);
  const [selectedExistingAssetId, setSelectedExistingAssetId] = useState<number | null>(null);
  const [assigningExistingImage, setAssigningExistingImage] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageFocusX, setImageFocusX] = useState(50);
  const [imageFocusY, setImageFocusY] = useState(50);
  const [imageAdjustOpen, setImageAdjustOpen] = useState(false);
  const [imageAdjustSrc, setImageAdjustSrc] = useState<string | null>(null);
  const [isAdjustDragging, setIsAdjustDragging] = useState(false);
  const [imageAdjustFocusX, setImageAdjustFocusX] = useState(50);
  const [imageAdjustFocusY, setImageAdjustFocusY] = useState(50);
  const [imageAdjustZoom, setImageAdjustZoom] = useState(1);
  const [layouts, setLayouts] = useState<LayoutInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [removingAssetId, setRemovingAssetId] = useState<number | null>(null);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [showImageGenModal, setShowImageGenModal] = useState(false);
  const [generatedImageBase64, setGeneratedImageBase64] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [showAiImageUpgradeModal, setShowAiImageUpgradeModal] = useState(false);
  const [tickerTableModalOpen, setTickerTableModalOpen] = useState(false);
  const [tickerTableModalKey, setTickerTableModalKey] = useState<string | null>(null);
  const [tickerTableDraft, setTickerTableDraft] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [chartTableModalOpen, setChartTableModalOpen] = useState(false);
  const [chartTableModalKey, setChartTableModalKey] = useState<string | null>(null);
  const [chartTableDraft, setChartTableDraft] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [chartTableError, setChartTableError] = useState<string | null>(null);
  // pipe_table modal (bloomberg terminal table etc) — same UI as chartModal
  const [pipeTableModalOpen, setPipeTableModalOpen] = useState(false);
  const [pipeTableModalKey, setPipeTableModalKey] = useState<string | null>(null);
  const [pipeTableModalMaxRows, setPipeTableModalMaxRows] = useState(20);
  const [pipeTableModalMaxCols, setPipeTableModalMaxCols] = useState(10);
  const [pipeTableDraft, setPipeTableDraft] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [tickerDropOver, setTickerDropOver] = useState(false);
  const [chartDropOver, setChartDropOver] = useState(false);
  // Import preview (replaces old sheet-picker + col-picker modals)
  const [importPreview, setImportPreview] = useState<{
    matrix: string[][];
    sheetNames?: string[];
    activeSheet?: string;
    wb?: import("xlsx").WorkBook;
    maxCols: number;
    maxRows: number;
    isChartTable?: boolean;
  } | null>(null);
  const chartTableErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chartImportCallbackRef = useRef<((t: { headers: string[]; rows: string[][] }) => void) | null>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const localImageInputRef = useRef<HTMLInputElement>(null);
  const chartFileInputRef = useRef<HTMLInputElement>(null);
  const imageAdjustPreviewRef = useRef<HTMLDivElement>(null);
  const imageAdjustFocusRef = useRef({ x: 50, y: 50 });
  const imageAdjustPanRef = useRef<{
    startX: number;
    startY: number;
    startFx: number;
    startFy: number;
  } | null>(null);
  const shouldAutoOpenAdjustRef = useRef(false);
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
  const isCraftedTemplate = (project.template || "").startsWith("crafted_");
  const normalizedTemplateId = (project.template || "default").toLowerCase();
  const isNewscastTemplate = normalizedTemplateId === "newscast" || normalizedTemplateId === "newsreport";
  const isNightfallTemplate = normalizedTemplateId === "nightfall";
  const isDefaultTemplate = normalizedTemplateId === "default";
  const isBloombergTemplate = normalizedTemplateId === "bloomberg";
  const isLaDucTemplate = normalizedTemplateId === "laduc";
  // FJ Market Brief is a crafted template — project.template carries the public id.
  const isFjBriefTemplate = normalizedTemplateId === "crafted_fj_market_brief_bundle";

  const currentLayoutId = (() => {
    try {
      if (scene.remotion_code) {
        const desc = JSON.parse(scene.remotion_code);
        // Only custom templates use sceneType/content variant routing.
        // Crafted + built-in templates should map by explicit layout id.
        if (isCustomTemplate && desc.sceneTypeOverride) {
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
  const [craftedFrontendFiles, setCraftedFrontendFiles] = useState<Record<string, string> | null>(null);
  // Per-layout SceneEditModal field overrides loaded from the crafted
  // template's bundled `frontend/layoutFields.ts`. Compiled at runtime;
  // falls back to LAYOUT_TEXT_FIELDS / meta.json when null.
  const [craftedLayoutFieldsByLayout, setCraftedLayoutFieldsByLayout] =
    useState<Record<string, FieldDef[]> | null>(null);
  /** False while `layout_fields` TS is compiling — avoids showing `[object Object]` in generic extra-key inputs. */
  const [craftedLayoutFieldsReady, setCraftedLayoutFieldsReady] = useState(true);
  const { craftedTemplates, ensureCraftedTemplateDetail } = useCraftedTemplates();

  const defaultFontSizes = resolveDefaultFontSizesForScene({
    template: project.template || "default",
    layoutId: currentLayoutId,
    aspectRatio: project.aspect_ratio || "landscape",
    layoutPropSchema: layouts?.layout_prop_schema,
    craftedFrontendFiles,
  });

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
    setImageFocusX(50);
    setImageFocusY(50);
    setGeneratedImageBase64(null);
    setGeneratedPrompt(null);
    setShowAiImageUpgradeModal(false);
    shouldAutoOpenAdjustRef.current = openImageAdjustOnOpen;
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
        if (typeof lp.imageFocusX === "number") setImageFocusX(Math.max(0, Math.min(100, lp.imageFocusX)));
        if (typeof lp.imageFocusY === "number") setImageFocusY(Math.max(0, Math.min(100, lp.imageFocusY)));
        // data_visualization charts: convert stored shapes to editable form
        if (layoutId === "data_visualization") {
          const lpAny = lp as Record<string, unknown>;
          if (isNewscastTemplate) {
            const directChartTable = normalizeChartTableValue(lpAny.chartTable);
            const builtTable = chartTableHasData(directChartTable)
              ? directChartTable
              : buildChartTableFromDataVizLayoutProps(lpAny);
            if (chartTableHasData(builtTable)) {
              lpCopy.chartTable = builtTable;
            } else {
              // No data at all — seed bar example so the chart renders immediately
              lpCopy.chartTable = getLaDucMarketAnnotationExampleTable("bar");
              lpCopy.chartType = "bar";
            }
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
        // Bloomberg terminal_dataviz: normalize chartTable on modal open
        if (isBloombergTemplate && layoutId === "terminal_dataviz") {
          const lpAny = lpCopy as Record<string, unknown>;
          const directChartTable = normalizeChartTableValue(lpAny.chartTable);
          lpCopy.chartTable = chartTableHasData(directChartTable)
            ? directChartTable
            : { headers: ["Label", "Value"], rows: [["", ""]] };
        }
        // Bloomberg terminal_dataviz: pre-populate xAxisLabel/yAxisLabel from chartTable headers
        // so the form shows the currently-displayed values even before the user has edited them.
        if (isBloombergTemplate && layoutId === "terminal_dataviz") {
          const lpAny = lpCopy as Record<string, unknown>;
          if (!lpAny.xAxisLabel && !lpAny.yAxisLabel) {
            const tbl = normalizeChartTableValue(lpAny.chartTable);
            if (tbl.headers[0]) lpCopy.xAxisLabel = tbl.headers[0];
            if (tbl.headers[1]) lpCopy.yAxisLabel = tbl.headers[1];
          }
        }
        // Bloomberg terminal_chart: populate ohlcvTable for the editor from stored data or pipe items.
        // Only use pipe-delimited items (real OHLCV format). Never derive synthetic OHLC from
        // arbitrary numbers — older scenes may have hallucinated text-label items that look numeric
        // but are meaningless as OHLCV data (e.g. "PRICE: $24.85", "RSI(14): 68.2").
        if (isBloombergTemplate && layoutId === "terminal_chart") {
          const lpAny = lpCopy as Record<string, unknown>;
          if (!lpAny.xAxisLabel) lpCopy.xAxisLabel = "TRADING DAYS";
          if (!lpAny.yAxisLabel) lpCopy.yAxisLabel = "PRICE ($)";
          const storedOhlcv = lpAny.ohlcvTable as { headers: string[]; rows: string[][] } | undefined;
          const storedHasRows = storedOhlcv && Array.isArray(storedOhlcv.rows) && storedOhlcv.rows.length >= 4;
          if (!storedHasRows) {
            const rawItems = Array.isArray(lpAny.items) ? (lpAny.items as string[]) : [];
            // Only reconstruct from genuine pipe-delimited OHLCV items: "date|open|high|low|close|vol"
            const pipeItems = rawItems.filter((s) => String(s).split("|").length >= 5);
            if (pipeItems.length >= 4) {
              lpCopy.ohlcvTable = {
                headers: ["Date", "Open", "High", "Low", "Close", "Volume"],
                rows: pipeItems.map((s) => {
                  const p = s.split("|");
                  return [p[0] ?? "", p[1] ?? "", p[2] ?? "", p[3] ?? "", p[4] ?? "", p[5] ?? ""];
                }),
              };
            }
            // If no valid OHLCV items found, leave ohlcvTable unset — editor stays empty
            // and the chart renders procedural candles (correct behaviour for pre-OHLCV scenes)
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
    // Mirror VideoPreview's chartTable defaults merge so the "Edit chart
    // data" modal preview shows the same fallback data the project preview
    // and rendered MP4 produce. No-op for non-market_annotation layouts.
    lpCopy = mergeMarketAnnotationChartDefaultsForLayout(
      lpCopy,
      layoutId,
      layouts?.layout_prop_schema as
        | Record<string, { defaults?: Record<string, unknown> }>
        | undefined,
    );
    setEditableLayoutProps(lpCopy);
    if (isEndingScene) {
      const projectUrl = (project.blog_url || "").trim();
      const fallbackUrl =
        projectUrl && !projectUrl.startsWith("upload://") ? projectUrl : "";

      const lpRecord = lpCopy as Record<string, unknown>;

      // --- Socials (global to the scene, kept as in the original UX) ---
      const lpSocials = lpRecord.socials;
      if (lpSocials && typeof lpSocials === "object" && !Array.isArray(lpSocials)) {
        setEndingSocials(lpSocials as Record<
          EndingSocialKey,
          { enabled: boolean; label: string }
        >);
      } else {
        setEndingSocials(ENDING_SOCIALS_DEFAULT);
      }

      // --- CTA cards: prefer the new `ctas` array, else fall back to the flat fields ---
      const lpCtasRaw = lpRecord.ctas;
      const hydratedFromArray =
        Array.isArray(lpCtasRaw) && lpCtasRaw.length > 0
          ? lpCtasRaw
              .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
              .slice(0, MAX_CTAS)
              .map((raw): CtaDraft => ({
                ctaButtonText: typeof raw.ctaButtonText === "string" ? raw.ctaButtonText : "",
                websiteLink: typeof raw.websiteLink === "string" ? raw.websiteLink : "",
                showWebsiteButton: raw.showWebsiteButton !== false,
              }))
          : null;

      if (hydratedFromArray && hydratedFromArray.length > 0) {
        setCtas(hydratedFromArray);
      } else {
        // Legacy fallback: build a single CTA card from the flat fields.
        const lpShowWebsiteButton = lpRecord.showWebsiteButton;
        const lpWebsiteLink = lpRecord.websiteLink;
        const lpCta = lpRecord.ctaButtonText;
        const normalizedWebsiteLink =
          typeof lpWebsiteLink === "string" && lpWebsiteLink.trim()
            ? lpWebsiteLink.trim()
            : fallbackUrl;
        setCtas([
          {
            ctaButtonText: typeof lpCta === "string" ? lpCta : "",
            websiteLink: normalizedWebsiteLink,
            showWebsiteButton: lpShowWebsiteButton !== false,
          },
        ]);
      }
    } else {
      setCtas([makeDefaultCta()]);
      setEndingSocials(ENDING_SOCIALS_DEFAULT);
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
    const defaults = resolveDefaultFontSizesForScene({
      template: project.template || "default",
      layoutId,
      aspectRatio: project.aspect_ratio || "landscape",
      layoutPropSchema: layouts?.layout_prop_schema,
      craftedFrontendFiles,
    });
    if (!ts) ts = String(defaults.title);
    if (!ds) ds = String(defaults.desc);
    setTitleFontSize(ts);
    setDescriptionFontSize(ds);
  }, [open, scene.id, scene.title, scene.remotion_code, scene.extra_hold_seconds, project.template, project.aspect_ratio, project.blog_url, layouts?.layout_prop_schema, craftedFrontendFiles, isCraftedTemplate, openImageAdjustOnOpen]);

  useEffect(() => {
    if (!open || !isCraftedTemplate || !project.template) {
      setCraftedFrontendFiles(null);
      return;
    }
    const found = craftedTemplates.find((ct) => ct.id === project.template);
    setCraftedFrontendFiles((found?.frontend_files as Record<string, string> | null) || null);
    if (!found?.frontend_files) {
      void ensureCraftedTemplateDetail(project.template);
    }
  }, [open, isCraftedTemplate, project.template, craftedTemplates, ensureCraftedTemplateDetail]);

  // Compile the bundled `frontend/layoutFields.ts` into a Record<layoutId, FieldDef[]>.
  // The source ships on the list-summary (no full-package fetch needed).
  // Module-level cache (`__craftedLayoutFieldsCache`) survives modal close/reopen.
  useEffect(() => {
    if (!open || !isCraftedTemplate || !project.template) {
      setCraftedLayoutFieldsByLayout(null);
      setCraftedLayoutFieldsReady(true);
      return;
    }
    const templateId = project.template;
    const found = craftedTemplates.find((ct) => ct.id === templateId);
    const source = (found as { layout_fields?: string | null } | undefined)?.layout_fields;
    if (!source || !String(source).trim()) {
      setCraftedLayoutFieldsByLayout(null);
      setCraftedLayoutFieldsReady(true);
      return;
    }
    const cached = __craftedLayoutFieldsCache.get(templateId);
    if (cached) {
      setCraftedLayoutFieldsByLayout(cached);
      setCraftedLayoutFieldsReady(true);
      return;
    }
    let cancelled = false;
    setCraftedLayoutFieldsReady(false);
    void compileDataModule(source)
      .then((mod) => {
        if (cancelled) return;
        const raw = (mod?.LAYOUT_FIELDS ?? mod?.default ?? null) as
          | Record<string, FieldDef[]>
          | null;
        if (!raw || typeof raw !== "object") {
          setCraftedLayoutFieldsByLayout(null);
          return;
        }
        // Defensive shape check — drop entries that aren't arrays of objects with a `key`.
        const safe: Record<string, FieldDef[]> = {};
        for (const [layoutId, fields] of Object.entries(raw)) {
          if (!Array.isArray(fields)) continue;
          const valid = fields.filter(
            (f): f is FieldDef => !!f && typeof f === "object" && typeof (f as { key?: unknown }).key === "string",
          );
          if (valid.length > 0) safe[layoutId] = valid;
        }
        __craftedLayoutFieldsCache.set(templateId, safe);
        setCraftedLayoutFieldsByLayout(safe);
      })
      .catch(() => {
        if (cancelled) return;
        setCraftedLayoutFieldsByLayout(null);
      })
      .finally(() => {
        if (!cancelled) setCraftedLayoutFieldsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isCraftedTemplate, project.template, craftedTemplates]);

  // Fetch layouts when modal opens (needed for manual mode: image support check and layout names)
  useEffect(() => {
    if (isDemo) return;
    if (open && !layouts) {
      getValidLayouts(project.id)
        .then((res) => setLayouts(res.data))
        .catch(() => showError("Failed to load layouts"));
    }
  }, [open, project.id, layouts, isDemo]);

  useEffect(() => {
    if (!open || !shouldAutoOpenAdjustRef.current || imageAdjustOpen) return;
    const src = imagePreviewUrl || imageItems[0]?.url || null;
    if (!src) return;
    shouldAutoOpenAdjustRef.current = false;
    openImageAdjustModal(src);
  }, [open, imageAdjustOpen, imagePreviewUrl, imageItems]);

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

  const handleSave = async (override?: { imageFocusX?: number; imageFocusY?: number; imageZoom?: number }) => {
    if (isDemo) return;
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
        const layoutIsChanging = selectedLayout && selectedLayout !== "__keep__" && selectedLayout !== "__auto__";
        if (tsNum !== null || dsNum !== null || scene.remotion_code || layoutIsChanging) {
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
                // Socials are global to the scene (matches original UX).
                socials: endingSocials,
                // Legacy single-CTA mirror (from ctas[0]) so renderers that haven't
                // opted in to `ctas` still work.
                showWebsiteButton: endingShowWebsiteButton,
                websiteLink: (endingWebsiteLink || "").trim(),
                ctaButtonText: (endingCtaButtonText || "").trim(),
                // New multi-CTA array (up to 3). Each CTA is just pill + URL.
                ctas: ctas.map((c) => ({
                  ctaButtonText: (c.ctaButtonText || "").trim(),
                  websiteLink: (c.websiteLink || "").trim(),
                  showWebsiteButton: c.showWebsiteButton,
                })),
              };
            }
            remotionCode = JSON.stringify(desc);
          } else {
            const lp = { ...(desc.layoutProps as Record<string, unknown> || {}), ...editableLayoutProps };
            const zoomToSave = typeof override?.imageZoom === "number" ? Math.max(IMAGE_ADJUST_ZOOM_MIN, override.imageZoom) : undefined;
            // Apply layout switch: update desc.layout when user picked a concrete layout
            if (selectedLayout && selectedLayout !== "__keep__" && selectedLayout !== "__auto__") {
              desc.layout = selectedLayout;
            }
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
            // Bloomberg terminal_dataviz: normalize chartTable on save
            if (isBloombergTemplate && layoutId === "terminal_dataviz") {
              const chartTable = normalizeChartTableValue((lp as Record<string, unknown>).chartTable);
              lp.chartTable = chartTable;
            }
            // Bloomberg terminal_chart: regenerate items from edited ohlcvTable so the chart stays in sync
            if (isBloombergTemplate && layoutId === "terminal_chart") {
              const ohlcv = (lp as Record<string, unknown>).ohlcvTable as { headers: string[]; rows: string[][] } | undefined;
              if (ohlcv && Array.isArray(ohlcv.headers) && Array.isArray(ohlcv.rows)) {
                const hdrs = ohlcv.headers.map((h) => String(h).toLowerCase().trim());
                const findCol = (...kws: string[]) => {
                  for (const kw of kws) {
                    const i = hdrs.findIndex((h) => h.includes(kw));
                    if (i !== -1) return i;
                  }
                  return -1;
                };
                const parseNum = (v: string) => {
                  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
                  return Number.isFinite(n) ? n : null;
                };
                const dateCol = findCol("date");
                const openCol = findCol("open");
                const highCol = findCol("high");
                const lowCol = findCol("low");
                const closeCol = findCol("close");
                const volCol = findCol("volume", "vol");
                if (openCol !== -1 && highCol !== -1 && lowCol !== -1 && closeCol !== -1) {
                  const newItems: string[] = [];
                  for (const row of ohlcv.rows) {
                    const o = parseNum(row[openCol] ?? "");
                    const h = parseNum(row[highCol] ?? "");
                    const l = parseNum(row[lowCol] ?? "");
                    const c = parseNum(row[closeCol] ?? "");
                    if (o === null || h === null || l === null || c === null) continue;
                    let label = dateCol !== -1 ? String(row[dateCol] ?? "").split(",")[0].trim() : "";
                    let vol = 0;
                    if (volCol !== -1) {
                      const rv = parseFloat(String(row[volCol] ?? "").replace(/[^0-9.\-]/g, ""));
                      if (Number.isFinite(rv)) vol = rv > 1e9 ? rv / 1e9 : rv > 1e6 ? rv / 1e6 : rv;
                    }
                    newItems.push(`${label}|${o.toFixed(2)}|${h.toFixed(2)}|${l.toFixed(2)}|${c.toFixed(2)}|${vol.toFixed(2)}`);
                  }
                  if (newItems.length >= 4) lp.items = newItems;
                }
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
              delete lp.assignedImage;
              delete lp.imageFocusX;
              delete lp.imageFocusY;
              delete lp.imageZoom;
              // Socials are global to the scene.
              lp.socials = endingSocials;
              // Legacy single-CTA mirror (from ctas[0]) — crafted layouts still read these flat fields.
              lp.showWebsiteButton = endingShowWebsiteButton;
              lp.websiteLink = (endingWebsiteLink || "").trim();
              lp.ctaButtonText = (endingCtaButtonText || "").trim();
              // New multi-CTA array — crafted layouts can opt-in to render this later.
              lp.ctas = ctas.map((c) => ({
                ctaButtonText: (c.ctaButtonText || "").trim(),
                websiteLink: (c.websiteLink || "").trim(),
                showWebsiteButton: c.showWebsiteButton,
              }));
            } else if (zoomToSave !== undefined) {
              lp.imageZoom = zoomToSave;
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
        const hasExistingSceneImage = imageItems.length > 0;
        const focusXToSave = override?.imageFocusX ?? imageFocusX;
        const focusYToSave = override?.imageFocusY ?? imageFocusY;
        const zoomToPatch =
          typeof override?.imageZoom === "number"
            ? Math.max(IMAGE_ADJUST_ZOOM_MIN, override.imageZoom)
            : typeof editableLayoutProps.imageZoom === "number"
              ? Math.max(IMAGE_ADJUST_ZOOM_MIN, Number(editableLayoutProps.imageZoom))
              : undefined;
        if (supportsImage && (selectedImageFile || hasExistingSceneImage)) {
          await updateSceneImageFocus(project.id, scene.id, focusXToSave, focusYToSave, zoomToPatch);
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
          selectedImageFile || undefined,
          matchNarrationExactly
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

  /**
   * Layout-dropdown selection wrapper. Sets `selectedLayout` and — for LaDuc
   * market_annotation variants — seeds `editableLayoutProps.chartTable` with
   * the canonical example data when the existing chartTable is empty. Keeps
   * the modal's "Edit chart data" editor in sync with the renderer's fallback.
   */
  const applySelectedLayout = (next: string) => {
    setSelectedLayout(next);
    if (next === "__keep__" || next === "__auto__") return;
    // Seed example chart data when switching into a chart layout with no existing data
    const isChartLayout =
      ((isLaDucTemplate || isFjBriefTemplate) && getLaDucMarketAnnotationChartTypeForLayout(next) != null) ||
      ((isNewscastTemplate) && next === "data_visualization") ||
      (isBloombergTemplate && next === "terminal_dataviz");
    if (!isChartLayout) return;
    setEditableLayoutProps((prev) => {
      const existing = normalizeChartTableValue(prev.chartTable);
      if (chartTableHasData(existing)) return prev;
      const exampleType = ((isLaDucTemplate || isFjBriefTemplate) ? getLaDucMarketAnnotationChartTypeForLayout(next) : null) ?? "bar";
      return { ...prev, chartTable: getLaDucMarketAnnotationExampleTable(exampleType) };
    });
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
      delete layoutProps.imageFocusX;
      delete layoutProps.imageFocusY;
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

  const handleOpenImageSourceChooser = () => {
    setImageSourceChooserOpen(true);
    setSelectedExistingAssetId(null);
  };

  const handleChooseLocalUpload = () => {
    setImageSourceChooserOpen(false);
    localImageInputRef.current?.click();
  };

  const handleChooseScrapedImages = () => {
    setImageSourceChooserOpen(false);
    setSelectedExistingAssetId(null);
    setScrapedImagesModalOpen(true);
  };

  const handleAssignExistingImage = async () => {
    if (!selectedExistingAssetId) return;
    setAssigningExistingImage(true);
    try {
      await assignExistingImageToScene(project.id, scene.id, selectedExistingAssetId);
      setSelectedImageFile(null);
      setImagePreviewUrl(null);
      setScrapedImagesModalOpen(false);
      onSaved();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : "Failed to assign image";
      showError(String(msg));
    } finally {
      setAssigningExistingImage(false);
    }
  };

  const scrapedImageItems = availableImageItems;

  const handleGenerateImageClick = () => {
    if (!isPro) {
      setShowAiImageUpgradeModal(true);
      return;
    }
    setShowImageGenModal(true);
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

  const clampFocus = (value: number) => Math.max(0, Math.min(100, value));

  useEffect(() => {
    imageAdjustFocusRef.current = { x: imageAdjustFocusX, y: imageAdjustFocusY };
  }, [imageAdjustFocusX, imageAdjustFocusY]);

  useEffect(() => {
    if (!isAdjustDragging || !imageAdjustOpen || !imageAdjustSrc) return;
    const pan = imageAdjustPanRef.current;
    if (!pan) return;

    const clamp = (v: number) => Math.max(0, Math.min(100, v));

    const applyPan = (clientX: number, clientY: number) => {
      const el = imageAdjustPreviewRef.current;
      if (!el || !imageAdjustPanRef.current) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const { startX, startY, startFx, startFy } = imageAdjustPanRef.current;
      const dxPct = ((clientX - startX) / rect.width) * 100;
      const dyPct = ((clientY - startY) / rect.height) * 100;
      setImageAdjustFocusX(clamp(startFx - dxPct));
      setImageAdjustFocusY(clamp(startFy - dyPct));
    };

    const onMouseMove = (e: MouseEvent) => applyPan(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      e.preventDefault();
      applyPan(touch.clientX, touch.clientY);
    };
    const endPan = () => {
      setIsAdjustDragging(false);
      imageAdjustPanRef.current = null;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("mouseup", endPan);
    window.addEventListener("touchend", endPan);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mouseup", endPan);
      window.removeEventListener("touchend", endPan);
    };
  }, [isAdjustDragging, imageAdjustOpen, imageAdjustSrc]);

  useLayoutEffect(() => {
    if (!imageAdjustOpen || !imageAdjustSrc) return;
    const el = imageAdjustPreviewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY;
      setImageAdjustZoom((z) => {
        const factor = delta > 0 ? 0.97 : 1.03;
        const next = Math.min(
          IMAGE_ADJUST_ZOOM_MAX,
          Math.max(IMAGE_ADJUST_ZOOM_MIN, z * factor)
        );
        return Math.round(next * 100) / 100;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [imageAdjustOpen, imageAdjustSrc]);

  const openImageAdjustModal = (src: string) => {
    setImageAdjustSrc(src);
    setIsAdjustDragging(false);
    const currentZoom = Math.max(IMAGE_ADJUST_ZOOM_MIN, Number((editableLayoutProps.imageZoom as number) || 1));
    setImageAdjustFocusX(imageFocusX);
    setImageAdjustFocusY(imageFocusY);
    setImageAdjustZoom(Math.min(IMAGE_ADJUST_ZOOM_MAX, Math.max(IMAGE_ADJUST_ZOOM_MIN, currentZoom)));
    imageAdjustPanRef.current = null;
    setImageAdjustOpen(true);
  };

  const closeImageAdjustModal = () => {
    setImageAdjustOpen(false);
    setImageAdjustSrc(null);
    setIsAdjustDragging(false);
    imageAdjustPanRef.current = null;
  };

  const saveImageAdjustModal = async () => {
    const nextFocusX = clampFocus(imageAdjustFocusX);
    const nextFocusY = clampFocus(imageAdjustFocusY);
    const nextZoom = Math.max(IMAGE_ADJUST_ZOOM_MIN, Math.min(IMAGE_ADJUST_ZOOM_MAX, imageAdjustZoom));
    setImageFocusX(nextFocusX);
    setImageFocusY(nextFocusY);
    setEditableLayoutProps((prev) => ({ ...prev, imageZoom: nextZoom }));
    closeImageAdjustModal();
    await handleSave({ imageFocusX: nextFocusX, imageFocusY: nextFocusY, imageZoom: nextZoom });
  };

  const handleAdjustMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    imageAdjustPanRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startFx: imageAdjustFocusRef.current.x,
      startFy: imageAdjustFocusRef.current.y,
    };
    setIsAdjustDragging(true);
  };

  const handleAdjustTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    e.preventDefault();
    imageAdjustPanRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startFx: imageAdjustFocusRef.current.x,
      startFy: imageAdjustFocusRef.current.y,
    };
    setIsAdjustDragging(true);
  };

  if (!open) return null;

  const manualOnly = editMode === "manual";

  const modalTree = (
    <>
    <div className={isDemo ? "absolute inset-0 z-10 flex items-center justify-center" : "fixed inset-0 z-[100] flex items-center justify-center"}>
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
                  const updateCta = (idx: number, patch: Partial<CtaDraft>) => {
                    setCtas((prev) =>
                      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
                    );
                  };
                  const removeCta = (idx: number) => {
                    setCtas((prev) =>
                      prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx),
                    );
                  };
                  const addCta = () => {
                    setCtas((prev) =>
                      prev.length >= MAX_CTAS ? prev : [...prev, makeDefaultCta()],
                    );
                  };
                  return (
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                        Social media Links
                      </h4>
                      <div className="space-y-3">
                        {ctas.map((cta, idx) => (
                          <div
                            key={idx}
                            className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50/40"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-medium text-gray-800">
                                {idx === 0 ? "Call to Action Button" : `Call to Action Button ${idx + 1}`}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCta(idx, { showWebsiteButton: !cta.showWebsiteButton })
                                  }
                                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                                    cta.showWebsiteButton ? "bg-purple-600" : "bg-gray-200"
                                  }`}
                                  role="switch"
                                  aria-checked={cta.showWebsiteButton}
                                  aria-label="Toggle website call to action"
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                                      cta.showWebsiteButton ? "translate-x-4" : "translate-x-0"
                                    }`}
                                  />
                                </button>
                                {idx > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => removeCta(idx)}
                                    className="text-gray-400 hover:text-red-500 text-base leading-none w-5 h-5 flex items-center justify-center"
                                    aria-label={`Remove CTA ${idx + 1}`}
                                  >
                                    ×
                                  </button>
                                ) : null}
                              </div>
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-gray-500 mb-1">
                                CTA button label
                              </label>
                              <input
                                type="text"
                                value={cta.ctaButtonText}
                                onChange={(e) =>
                                  updateCta(idx, { ctaButtonText: e.target.value })
                                }
                                className="w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="e.g. Read the full article"
                              />
                              <p className="mt-1 text-[11px] text-gray-500">
                                Short text on the pill above the link (matches the project font in the video).
                              </p>
                            </div>
                            {cta.showWebsiteButton ? (
                              <div>
                                <label className="block text-[11px] font-medium text-gray-500 mb-1">
                                  Website URL
                                </label>
                                <input
                                  type="text"
                                  value={cta.websiteLink}
                                  onChange={(e) =>
                                    updateCta(idx, { websiteLink: e.target.value })
                                  }
                                  className="w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  placeholder="https://example.com/article"
                                />
                                <p className="mt-1 text-[11px] text-gray-500">
                                  Shown under the CTA pill when the toggle is on.
                                </p>
                              </div>
                            ) : null}
                          </div>
                        ))}
                        {ctas.length < MAX_CTAS ? (
                          <button
                            type="button"
                            onClick={addCta}
                            className="w-full px-3 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 border border-dashed border-gray-300 hover:border-purple-400 rounded-lg bg-white/50 transition-colors"
                          >
                            + Add another CTA
                          </button>
                        ) : null}
                        {ENDING_SOCIALS_KEYS.map((k) => {
                          const item = endingSocials[k];
                          const enabled = Boolean(item?.enabled ?? false);
                          const label = (item?.label ?? ENDING_SOCIALS_DEFAULT[k].label) as string;
                          const platformLabel = ENDING_SOCIALS_DEFAULT[k].label;
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

                // Crafted templates: prefer fields shipped in the bundle's
                // `frontend/layoutFields.ts`. Fall back to LAYOUT_TEXT_FIELDS
                // (keyed by layout id) for any layout the bundle hasn't
                // declared, so unknown crafted layouts still render *some*
                // controls instead of being blank.
                const craftedTemplateEntry = isCraftedTemplate
                  ? craftedTemplates.find((ct) => ct.id === project.template)
                  : undefined;
                const craftedFields =
                  isCraftedTemplate && currentLayoutId
                    ? pickCraftedCompiledLayoutFields(craftedLayoutFieldsByLayout, currentLayoutId)
                    : undefined;
                const schemaBackedFields =
                  isCraftedTemplate && currentLayoutId
                    ? pickLayoutPropSchemaFieldDefs(craftedTemplateEntry?.layout_prop_schema, currentLayoutId)
                    : undefined;
                const rawLayoutFields =
                  craftedFields ??
                  schemaBackedFields ??
                  getLayoutFields(project.template || "default", currentLayoutId);
                let layoutFields = (rawLayoutFields ?? []).filter((f) => !isHiddenLayoutPropKey(f.key));

                if (isNewscastTemplate && currentLayoutId === "data_visualization") {
                  const chartTable = normalizeChartTableValue((editableLayoutProps as Record<string, unknown>).chartTable);
                  const mode = inferDataVizTableMode(editableLayoutProps as Record<string, unknown>);
                  const numericSeriesCount = Math.max(1, getNumericColumnIndexes(chartTable).length || 1);
                  const barSeriesCount = mode === "bar" ? Math.min(3, numericSeriesCount) : 0;
                  const lineSeriesCount = mode === "line" ? Math.min(3, numericSeriesCount) : 0;

                  layoutFields = layoutFields.filter((field) => {
                    if (field.key === "barPrimaryColor") return mode === "bar";
                    if (field.key === "barSecondaryColor") return mode === "bar";
                    if (field.key === "barTertiaryColor") return mode === "bar";
                    if (field.key === "lineUpColor") return mode === "line";
                    if (field.key === "lineDownColor") return mode === "line";
                    if (field.key === "lineThirdColor") return mode === "line";
                    return true;
                  });
                }

                const knownKeys = new Set(layoutFields.map((f) => f.key));
                const suppressExtraKeysForDataViz =
                  (isNewscastTemplate || isNightfallTemplate || isDefaultTemplate) &&
                  currentLayoutId === "data_visualization";
                const suppressExtraKeysForBloombergChart =
                  isBloombergTemplate && currentLayoutId === "terminal_chart";
                const suppressExtraKeysForBloombergDataViz =
                  isBloombergTemplate && currentLayoutId === "terminal_dataviz";
                const craftedHasLayoutFieldsSource =
                  isCraftedTemplate &&
                  Boolean(
                    String(
                      (craftedTemplateEntry as { layout_fields?: string | null } | undefined)?.layout_fields ?? "",
                    ).trim(),
                  );
                const deferCraftedExtraKeys = craftedHasLayoutFieldsSource && !craftedLayoutFieldsReady;
                const extraKeys =
                  (suppressExtraKeysForDataViz || suppressExtraKeysForBloombergChart || suppressExtraKeysForBloombergDataViz)
                    ? []
                    : deferCraftedExtraKeys
                      ? []
                    : currentLayoutId && editableLayoutProps
                      ? Object.keys(editableLayoutProps).filter(
                          (key) =>
                            !knownKeys.has(key) &&
                            !isHiddenLayoutPropKey(key) &&
                            !isDeprecatedLayoutPropKey(
                              project.template,
                              currentLayoutId,
                              key,
                            ),
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
                        // Unsaved swatch falls back to the field's declared `default`
                        // first (the documented "display value when unset"), then its
                        // placeholder, then a generic blue. Without the `default` branch
                        // a field that defines only a default (e.g. fj_research bar
                        // colors) would wrongly show the #1E5FD4 blue fallback.
                        const fieldDefaultColor =
                          typeof field.default === "string" ? field.default : undefined;
                        const fallbackColor = normalizeColorValue(
                          fieldDefaultColor ?? field.placeholder ?? "#1E5FD4",
                          "#1E5FD4",
                        );
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
                      if (field.type === "ohlcv_table") {
                        const raw = editableLayoutProps[field.key] as { headers: string[]; rows: string[][] } | null | undefined;
                        return (
                          <div key={field.key}>
                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                              {field.label}
                            </label>
                            <OHLCVTableEditor
                              value={raw}
                              onChange={(next) =>
                                setEditableLayoutProps((prev) => ({ ...prev, [field.key]: next }))
                              }
                            />
                          </div>
                        );
                      }
                      if (field.type === "pipe_table") {
                        const rawItems = (Array.isArray(editableLayoutProps[field.key]) ? editableLayoutProps[field.key] : []) as string[];
                        const ptMaxRows = field.maxItems ?? 20;
                        const ptMaxCols = 10;
                        // Parse to get row/col counts for the summary label
                        const ptGrid = rawItems.map((r) => String(r).split("|").map((c) => c.trim()));
                        const ptColCount = Math.max(0, ...ptGrid.map((r) => r.length));
                        const ptRowCount = Math.max(0, ptGrid.length - 1); // exclude header row
                        const ptHeaders = ptGrid[0] ?? [];
                        const ptBodyRows = ptGrid.slice(1).length > 0 ? ptGrid.slice(1) : [Array(Math.max(ptColCount, 1)).fill("")];
                        const fieldKey = field.key;
                        return (
                          <div key={field.key}>
                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                              {field.label}
                            </label>
                            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/30 px-3 py-2 flex-wrap">
                              <span className="text-xs text-gray-400 flex-1 min-w-0">
                                {ptRowCount > 0 ? `${ptRowCount} row${ptRowCount !== 1 ? "s" : ""} × ${ptColCount} col${ptColCount !== 1 ? "s" : ""}` : "No data yet"}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const padded = ptGrid.map((r) => { const p = [...r]; while (p.length < ptColCount) p.push(""); return p; });
                                  const headers = padded[0]?.length ? padded[0] : Array(Math.max(ptColCount, 2)).fill("").map((_, i) => `Col ${i+1}`);
                                  const rows = padded.slice(1).length ? padded.slice(1) : [Array(headers.length).fill("")];
                                  setPipeTableDraft({ headers, rows });
                                  setPipeTableModalKey(fieldKey);
                                  setPipeTableModalMaxRows(ptMaxRows);
                                  setPipeTableModalMaxCols(ptMaxCols);
                                  setPipeTableModalOpen(true);
                                }}
                                className="px-3 py-1 text-[11px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:text-purple-600 hover:border-purple-400 bg-white transition-colors"
                              >
                                Edit table
                              </button>
                            </div>
                          </div>
                        );
                      }
                      if (field.type === "ticker_table") {
                        const raw = editableLayoutProps[field.key] as { headers: string[]; rows: string[][] } | null | undefined;
                        const rowCount = raw?.rows?.length ?? 0;
                        const colCount = raw?.headers?.length ?? 0;
                        return (
                          <div key={field.key}>
                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                              {field.label}
                            </label>
                            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/30 px-3 py-2 flex-wrap">
                              <span className="text-xs text-gray-400 flex-1 min-w-0">
                                {rowCount > 0 ? (
                                  `${rowCount} row${rowCount !== 1 ? "s" : ""} × ${colCount} col${colCount !== 1 ? "s" : ""}`
                                ) : (
                                  "No data yet"
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const parsed = raw && typeof raw === "object" && Array.isArray(raw.rows)
                                    ? { headers: Array.isArray(raw.headers) ? raw.headers.map(String) : ["Label", "Value"], rows: (raw.rows as unknown[][]).map((r) => Array.isArray(r) ? r.map(String) : [""]) }
                                    : { headers: ["Label", "Value"], rows: [[""]] };
                                  setTickerTableDraft(parsed);
                                  setTickerTableModalKey(field.key);
                                  setTickerTableModalOpen(true);
                                }}
                                className="px-3 py-1 text-[11px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:text-purple-600 hover:border-purple-400 bg-white transition-colors"
                              >
                                Edit table
                              </button>
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

                        const rowCount = table.rows.length;
                        const colCount = table.headers.length;
                        return (
                          <div key={field.key}>
                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                              {field.label}
                            </label>
                            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/30 px-3 py-2 flex-wrap">
                              <span className="text-xs text-gray-400 flex-1 min-w-0">
                                {rowCount > 0 ? (
                                  `${rowCount} row${rowCount !== 1 ? "s" : ""} × ${colCount} col${colCount !== 1 ? "s" : ""}`
                                ) : (
                                  "No data yet"
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setChartTableDraft({
                                    headers: [...table.headers],
                                    rows: table.rows.map((r) => [...r]),
                                  });
                                  setChartTableModalKey(field.key);
                                  setChartTableModalOpen(true);
                                }}
                                className="px-3 py-1 text-[11px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:text-purple-600 hover:border-purple-400 bg-white transition-colors"
                              >
                                Edit table
                              </button>
                            </div>
                          </div>
                        );
                      }
                      if (field.type === "select") {
                        const opts = field.options ?? [];
                        const defaultVal = field.default ?? opts[0]?.value ?? "";
                        const sel = String(editableLayoutProps[field.key] ?? defaultVal);
                        const isLaDucChartTypeField =
                          isLaDucTemplate &&
                          currentLayoutId === "market_annotation" &&
                          field.key === "chartType";
                        const isFjBriefChartTypeField =
                          isFjBriefTemplate &&
                          currentLayoutId === "market_annotation" &&
                          field.key === "chartType";
                        const isFJResearchChartTypeField =
                          normalizedTemplateId === "fj_research" &&
                          currentLayoutId === "market_annotation" &&
                          field.key === "chartType";
                        const isBloombergChartTypeField =
                          isBloombergTemplate &&
                          currentLayoutId === "terminal_dataviz" &&
                          field.key === "chartType";
                        const isNewscastChartTypeField =
                          isNewscastTemplate &&
                          currentLayoutId === "data_visualization" &&
                          field.key === "chartType";
                        return (
                          <div key={field.key}>
                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                            <select
                              value={sel}
                              onChange={(e) => {
                                const nextChartType = e.target.value;
                                if (isLaDucChartTypeField || isFjBriefChartTypeField || isFJResearchChartTypeField || isBloombergChartTypeField || isNewscastChartTypeField) {
                                  const concrete =
                                    nextChartType === "line" || nextChartType === "bar" || nextChartType === "histogram"
                                      ? (nextChartType as "line" | "bar" | "histogram")
                                      : null;
                                  if (concrete) {
                                    const example = (isLaDucChartTypeField || isFjBriefChartTypeField)
                                      ? getLaDucMarketAnnotationExampleTable(concrete)
                                      : getFJResearchMarketAnnotationExampleTable(concrete);
                                    setEditableLayoutProps((prev) => ({
                                      ...prev,
                                      [field.key]: nextChartType,
                                      chartTable: example,
                                    }));
                                    return;
                                  }
                                }
                                setEditableLayoutProps((prev) => ({ ...prev, [field.key]: nextChartType }));
                              }}
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
                      if (field.type === "object_array") {
                        const items = normalizeObjectArrayItems(editableLayoutProps[field.key]);
                        const subFields =
                          field.subFields?.length
                            ? field.subFields
                            : inferObjectArraySubFields(items);
                        if (!subFields.length) return null;
                        return (
                          <div key={field.key}>
                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                            <div className="space-y-3">
                              {items.map((item, i) => (
                                <div key={i} className="flex items-start gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                                  <span className="text-[11px] text-gray-400 w-5 text-right flex-shrink-0 pt-2 tabular-nums">{i + 1}.</span>
                                  <div className="flex-1 space-y-2">
                                    {subFields.map((sf) => (
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
                                    subFields.forEach((sf) => { empty[sf.key] = ""; });
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
                        {extraKeys.map((key) => {
                          const rawValue = editableLayoutProps[key];
                          const looksLikeObjectArray = Array.isArray(rawValue)
                            && rawValue.every((it) => it != null && typeof it === "object" && !Array.isArray(it));
                          if (looksLikeObjectArray) {
                            const items = normalizeObjectArrayItems(rawValue);
                            const subFields = inferObjectArraySubFields(items);
                            if (!subFields.length) return null;
                            return (
                              <div key={key}>
                                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">
                                  {humanLabel(key)}
                                </label>
                                <div className="space-y-3">
                                  {items.map((item, i) => (
                                    <div key={i} className="flex items-start gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                                      <span className="text-[11px] text-gray-400 w-5 text-right flex-shrink-0 pt-2 tabular-nums">{i + 1}.</span>
                                      <div className="flex-1 space-y-2">
                                        {subFields.map((sf) => (
                                          <div key={sf.key}>
                                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1 block">{sf.label}</label>
                                            <input
                                              type="text"
                                              value={item[sf.key] ?? ""}
                                              placeholder={sf.placeholder || sf.label}
                                              onChange={(e) => {
                                                const updated = [...items];
                                                updated[i] = { ...updated[i], [sf.key]: e.target.value };
                                                setEditableLayoutProps((prev) => ({ ...prev, [key]: updated }));
                                              }}
                                              className="w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = items.filter((_, j) => j !== i);
                                          setEditableLayoutProps((prev) => ({ ...prev, [key]: updated }));
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 rounded-lg hover:bg-gray-100 mt-1"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={key}>
                              <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">
                                {humanLabel(key)}
                              </label>
                              {(rawValue != null && typeof rawValue === "object") ? (
                                <AutoGrowTextarea
                                  value={formatUnknownLayoutPropValue(rawValue)}
                                  onChange={(e) =>
                                    setEditableLayoutProps((prev) => ({
                                      ...prev,
                                      [key]: parseUnknownLayoutPropValue(e.target.value, prev[key]),
                                    }))
                                  }
                                  className="w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-hidden font-mono"
                                  minRows={3}
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={formatUnknownLayoutPropValue(rawValue)}
                                  onChange={(e) =>
                                    setEditableLayoutProps((prev) => ({
                                      ...prev,
                                      [key]: e.target.value,
                                    }))
                                  }
                                  className="w-full px-3 py-2 text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                              )}
                            </div>
                          );
                        })}
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
                        if (field.type === "object_array") {
                          const items = normalizeObjectArrayItems(editableStructuredContent[field.key]);
                          const subFields =
                            field.subFields?.length
                              ? field.subFields
                              : inferObjectArraySubFields(items);
                          if (!subFields.length) return null;
                          return (
                            <div key={field.key}>
                              <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">{field.label}</label>
                              <div className="space-y-3">
                                {items.map((item, i) => (
                                  <div key={i} className="flex items-start gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                                    <span className="text-[11px] text-gray-400 w-5 text-right flex-shrink-0 pt-2 tabular-nums">{i + 1}.</span>
                                    <div className="flex-1 space-y-2">
                                      {subFields.map((sf) => (
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
                                      subFields.forEach((sf) => { empty[sf.key] = ""; });
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
                      {(() => {
                        const parsed = parseInt(titleFontSize, 10);
                        const isOverride = Number.isFinite(parsed);
                        const display = isOverride ? parsed : defaultFontSizes.title;
                        return (
                          <span className="text-xs font-medium text-purple-600 tabular-nums">
                            {display}
                            {!isOverride && (
                              <span className="ml-1 text-[10px] font-normal text-gray-300">(default)</span>
                            )}
                          </span>
                        );
                      })()}
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
                      {(() => {
                        const parsed = parseInt(descriptionFontSize, 10);
                        const isOverride = Number.isFinite(parsed);
                        const display = isOverride ? parsed : defaultFontSizes.desc;
                        return (
                          <span className="text-xs font-medium text-purple-600 tabular-nums">
                            {display}
                            {!isOverride && (
                              <span className="ml-1 text-[10px] font-normal text-gray-300">(default)</span>
                            )}
                          </span>
                        );
                      })()}
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
                        className="relative group rounded-lg overflow-hidden border border-gray-200/40 w-20 h-20 flex-shrink-0"
                      >
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => openImageAdjustModal(url)}
                          className="absolute top-1 right-8 z-10 w-6 h-6 flex items-center justify-center rounded-full border border-white/90 bg-white/95 text-purple-700 shadow-sm hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
                          title="Adjust image"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M16.5 3.964a2.5 2.5 0 113.536 3.536L7 20.5H3v-4L16.5 3.964z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(asset.id)}
                          disabled={removingAssetId === asset.id}
                          className="absolute top-1 right-1 z-10 w-6 h-6 flex items-center justify-center rounded-full border border-white/90 bg-white/95 text-purple-700 shadow-sm hover:bg-purple-600 hover:text-white hover:border-purple-600 disabled:opacity-50 transition-colors"
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
                      <div className="relative group rounded-lg overflow-hidden border-2 border-purple-400 w-20 h-20 flex-shrink-0">
                        <img
                          src={imagePreviewUrl}
                          alt="New image"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => openImageAdjustModal(imagePreviewUrl)}
                          className="absolute top-1 right-8 z-10 w-6 h-6 flex items-center justify-center rounded-full border border-white/90 bg-white/95 text-purple-700 shadow-sm hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
                          title="Adjust image"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M16.5 3.964a2.5 2.5 0 113.536 3.536L7 20.5H3v-4L16.5 3.964z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImageFile(null);
                            setImagePreviewUrl(null);
                          }}
                          className="absolute top-1 right-1 z-10 w-6 h-6 flex items-center justify-center rounded-full border border-white/90 bg-white/95 text-purple-700 shadow-sm hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleOpenImageSourceChooser}
                      className="flex items-center justify-center w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50/50 hover:bg-gray-100/50 transition-colors"
                      title="Add image"
                    >
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    <input
                      ref={localImageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      onChange={(e) => setSelectedImageFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateImageClick}
                      className="group relative flex items-center justify-center w-20 h-20 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/50 hover:bg-purple-100/50 transition-colors text-purple-700"
                      title="Generate image with AI"
                    >
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] font-medium text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap max-w-[180px] text-center">
                        Generate image with AI
                      </span>
                    </button>
                  </div>
                  {(imageItems.length > 0 || selectedImageFile) && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500">
                        Click the edit icon on the image thumbnail to adjust framing with a draggable crop box.
                      </p>
                    </div>
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
                  onChange={(e) => {
                    const next = e.target.value;
                    setAiNarration(next);
                    // Editing the narration implies the voiceover is now stale.
                    if (next.trim() !== (scene.narration_text || "").trim()) {
                      setRegenerateVoiceover(true);
                    }
                  }}
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

              {regenerateVoiceover && (
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                      Match narration exactly
                    </h4>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      Speak the narration word-for-word, without AI rephrasing.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMatchNarrationExactly(!matchNarrationExactly)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                      matchNarrationExactly ? "bg-purple-600" : "bg-gray-200"
                    }`}
                    role="switch"
                    aria-checked={matchNarrationExactly}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        matchNarrationExactly ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              )}

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
                      onClick={() => { applySelectedLayout("__keep__"); setLayoutOpen(false); }}
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
                        onClick={() => { applySelectedLayout("__auto__"); setLayoutOpen(false); }}
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
                            onClick={() => { applySelectedLayout(layoutId); setLayoutOpen(false); }}
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
            onClick={() => {
              void handleSave();
            }}
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

    {imageSourceChooserOpen && (
      <div className="fixed inset-0 z-[125] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setImageSourceChooserOpen(false)}
        />
        <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-5">
          <h3 className="text-lg font-semibold text-gray-900">Add scene image</h3>
          <p className="text-xs text-gray-500 mt-1">Choose where to pick the image from.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleChooseScrapedImages}
              className="w-full h-24 p-2 rounded-xl border p-3 rounded-xl border border-gray-300 text-gray-700 hover:border-purple-300 hover:text-purple-700 hover:bg-purple-50/40 transition-colors text-sm flex flex-col items-center justify-center text-center gap-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
              From existing scraped images
            </button>
            <button
              type="button"
              onClick={handleChooseLocalUpload}
              className="w-full h-24 p-2 rounded-xl border p-3 rounded-xl border border-gray-300 text-gray-700 hover:border-purple-300 hover:text-purple-700 hover:bg-purple-50/40 transition-colors text-sm flex flex-col items-center justify-center text-center gap-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 4v12m0 0l-4-4m4 4l4-4" />
              </svg>
              File upload
            </button>
          </div>
        </div>
      </div>
    )}

    {scrapedImagesModalOpen && (
      <div className="fixed inset-0 z-[126] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => !assigningExistingImage && setScrapedImagesModalOpen(false)}
        />
        <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Select scraped image</h3>
              <p className="text-xs text-gray-500 mt-0.5">Pick one image to assign to this scene.</p>
            </div>
            <button
              type="button"
              onClick={() => setScrapedImagesModalOpen(false)}
              disabled={assigningExistingImage}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors disabled:opacity-50"
              title="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-5 bg-gray-50 max-h-[60vh] overflow-auto">
            {scrapedImageItems.length === 0 ? (
              <p className="text-sm text-gray-500">No images available.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {scrapedImageItems.map(({ asset, url }) => {
                  const selected = selectedExistingAssetId === asset.id;
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setSelectedExistingAssetId(asset.id)}
                      className={`relative rounded-xl overflow-hidden border-2 transition-colors ${
                        selected ? "border-purple-500" : "border-gray-200 hover:border-purple-300"
                      }`}
                    >
                      <img src={url} alt="" className="w-full h-24 object-cover" loading="lazy" />
                      {selected && (
                        <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2 bg-white">
            <button
              type="button"
              onClick={() => setScrapedImagesModalOpen(false)}
              disabled={assigningExistingImage}
              className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAssignExistingImage}
              disabled={!selectedExistingAssetId || assigningExistingImage}
              className="px-3 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors text-sm disabled:opacity-60"
            >
              {assigningExistingImage ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    )}

    <GenerateSceneImageModal
      open={showImageGenModal}
      scene={scene}
      project={project}
      isPro={isPro}
      onClose={() => setShowImageGenModal(false)}
      onUpgrade={() => {
        setShowImageGenModal(false);
        setShowAiImageUpgradeModal(true);
      }}
      onImageReady={(imageBase64, refinedPrompt) => {
        setGeneratedImageBase64(imageBase64);
        setGeneratedPrompt(refinedPrompt);
        setShowImageGenModal(false);
      }}
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

    {imageAdjustOpen && imageAdjustSrc && (
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-2 sm:p-4 min-h-0">
        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={closeImageAdjustModal} />
        <div
          className="relative w-full max-w-3xl max-h-[calc(100dvh-0.75rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden min-h-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-200 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Adjust image framing</h3>
              <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                Drag to pan when zoomed in. Use the slider or scroll wheel to zoom, then save.
              </p>
            </div>
            <button
              type="button"
              onClick={closeImageAdjustModal}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
              title="Close"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-gray-50">
            <div className="p-4 sm:p-5">
            <div
              ref={imageAdjustPreviewRef}
              onMouseDown={handleAdjustMouseDown}
              onTouchStart={handleAdjustTouchStart}
              style={{
                height: "min(70vh, 26rem)",
                maxHeight: "70vh",
                maxWidth: "min(100%, 42rem)",
              }}
              className={`relative mx-auto rounded-xl overflow-hidden border-2 border-gray-200 select-none touch-none ${
                isAdjustDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
            >

              <img
                src={imageAdjustSrc}
                alt="Adjust preview"
                className="absolute inset-0 w-full h-full"
                style={{
                  objectFit: imageAdjustZoom < 1 ? "contain" : "cover",
                  objectPosition: imageAdjustZoom < 1 ? "center" : `${imageAdjustFocusX}% ${imageAdjustFocusY}%`,
                  transform: `scale(${imageAdjustZoom})`,
                  transformOrigin: imageAdjustZoom < 1 ? "center center" : `${imageAdjustFocusX}% ${imageAdjustFocusY}%`,
                }}
                draggable={false}
              />
            </div>
            <div className="mt-4 flex flex-col gap-2 max-w-2xl mx-auto w-full">
              <label className="flex items-center gap-3 text-sm text-gray-700">
                <span className="w-14 shrink-0 tabular-nums">Zoom</span>
                <input
                  type="range"
                  min={IMAGE_ADJUST_ZOOM_MIN}
                  max={IMAGE_ADJUST_ZOOM_MAX}
                  step={0.05}
                  value={imageAdjustZoom}
                  onChange={(e) =>
                    setImageAdjustZoom(
                      Math.min(
                        IMAGE_ADJUST_ZOOM_MAX,
                        Math.max(IMAGE_ADJUST_ZOOM_MIN, Number(e.target.value))
                      )
                    )
                  }
                  className="flex-1 min-w-0 h-1 w-full cursor-pointer appearance-none accent-purple-600 [&::-webkit-slider-runnable-track]:h-0.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-gray-200 [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-600 [&::-moz-range-track]:h-0.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-gray-200 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-purple-600"
                />
                <span className="w-12 text-right text-xs text-gray-500 tabular-nums">
                  {imageAdjustZoom.toFixed(2)}×
                </span>
              </label>
            </div>
            <div className="mt-3 text-xs text-gray-500 text-center tabular-nums">
              Position: X {Math.round(imageAdjustFocusX)}% · Y {Math.round(imageAdjustFocusY)}% · Zoom{" "}
              {imageAdjustZoom.toFixed(2)}×
            </div>
            </div>
          </div>
          <div className="shrink-0 px-4 py-3 sm:px-5 sm:py-4 border-t border-gray-200 flex justify-end gap-2 bg-white">
            <button
              type="button"
              onClick={closeImageAdjustModal}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveImageAdjustModal}
              className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Save framing
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );

  const TICKER_MODAL_MAX_COLS = 6;
  const TICKER_MODAL_MAX_ROWS = 20;
  const CHART_MODAL_MAX_COLS = 4;
  const CHART_MODAL_MAX_ROWS = 50;
  const tickerDraft = tickerTableDraft ?? { headers: ["Label", "Value"], rows: [[""]] };

  const tickerModal = tickerTableModalOpen && tickerTableModalKey ? (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setTickerTableModalOpen(false)} />
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl flex flex-col" style={{ maxHeight: "88vh" }}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Edit ticker table</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Editable headers · max {TICKER_MODAL_MAX_ROWS} rows · max {TICKER_MODAL_MAX_COLS} cols · drag &amp; drop CSV/Excel to import</p>
          </div>
          <button type="button" onClick={() => setTickerTableModalOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drag-and-drop import zone */}
        <div
          className={`mx-4 mt-3 flex-shrink-0 rounded-lg border-2 border-dashed px-4 py-3 flex items-center gap-3 transition-colors ${tickerDropOver ? "border-purple-400 bg-purple-50" : "border-gray-200 bg-gray-50"}`}
          onDragOver={(e) => { e.preventDefault(); setTickerDropOver(true); }}
          onDragLeave={() => setTickerDropOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setTickerDropOver(false);
            const file = e.dataTransfer.files[0];
            if (!file) return;
            handleTickerFileImport(file, (t) => setTickerTableDraft(t));
          }}
        >
          <svg className={`w-5 h-5 flex-shrink-0 transition-colors ${tickerDropOver ? "text-purple-400" : "text-gray-300"}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span className={`text-[11px] transition-colors ${tickerDropOver ? "text-purple-600" : "text-gray-400"}`}>
            {tickerDropOver ? "Release to import" : <>Drop a <strong className="font-medium text-gray-500">.csv</strong> or <strong className="font-medium text-gray-500">.xlsx</strong> file here to import</>}
          </span>
        </div>

        {/* Table area */}
        <div className="overflow-auto flex-1 p-4">
          <SpreadsheetTable
            data={tickerDraft}
            onChange={setTickerTableDraft}
            maxRows={TICKER_MODAL_MAX_ROWS}
            maxCols={TICKER_MODAL_MAX_COLS}
          />
        </div>

        {/* Row / Col controls + footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2 flex-shrink-0">
          {/* Row controls */}
          <button
            type="button"
            onClick={() => setTickerTableDraft({ ...tickerDraft, rows: [...tickerDraft.rows, Array(tickerDraft.headers.length).fill("")] })}
            disabled={tickerDraft.rows.length >= TICKER_MODAL_MAX_ROWS}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 hover:border-green-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Row
          </button>
          <button
            type="button"
            onClick={() => tickerDraft.rows.length > 1 && setTickerTableDraft({ ...tickerDraft, rows: tickerDraft.rows.slice(0, -1) })}
            disabled={tickerDraft.rows.length <= 1}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 hover:border-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
            Row
          </button>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          {/* Col controls */}
          <button
            type="button"
            onClick={() => setTickerTableDraft({ headers: [...tickerDraft.headers, `Col ${tickerDraft.headers.length + 1}`], rows: tickerDraft.rows.map((r) => [...r, ""]) })}
            disabled={tickerDraft.headers.length >= TICKER_MODAL_MAX_COLS}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 hover:border-green-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Col
          </button>
          <button
            type="button"
            onClick={() => tickerDraft.headers.length > 1 && setTickerTableDraft({ headers: tickerDraft.headers.slice(0, -1), rows: tickerDraft.rows.map((r) => r.slice(0, -1)) })}
            disabled={tickerDraft.headers.length <= 1}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 hover:border-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
            Col
          </button>

          <div className="flex-1" />

          <button type="button" onClick={() => setTickerTableModalOpen(false)} className="px-4 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setEditableLayoutProps((prev) => ({ ...prev, [tickerTableModalKey]: tickerDraft }));
              setTickerTableModalOpen(false);
            }}
            className="px-4 py-1.5 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const chartDraft = chartTableDraft ?? { headers: ["Label", "Value"], rows: [["", ""]] };

  /** Show a transient error inline at the top of the chart-data modal. */
  const showChartTableError = (msg: string) => {
    if (chartTableErrorTimeoutRef.current) clearTimeout(chartTableErrorTimeoutRef.current);
    setChartTableError(msg);
    chartTableErrorTimeoutRef.current = setTimeout(() => setChartTableError(null), 4000);
  };

  /** Open the ImportPreviewSheet for a raw matrix. */
  const openImportPreview = (
    matrix: string[][],
    maxCols: number,
    maxRows: number,
    onApply: (t: { headers: string[]; rows: string[][] }) => void,
    sheetNames?: string[],
    activeSheet?: string,
    wb?: import("xlsx").WorkBook,
    isChartTable?: boolean,
  ) => {
    if (matrix.length === 0) return;
    chartImportCallbackRef.current = onApply;
    setImportPreview({ matrix, maxCols, maxRows, sheetNames, activeSheet, wb, isChartTable });
  };

  const matrixFromSheet = (wb: import("xlsx").WorkBook, sheetName: string): string[][] => {
    const ws = wb.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }).map((r: string[]) =>
      (r as unknown[]).map(String)
    );
  };

  /** Entry point for file import. maxCols/maxRows = hard limits for destination table.
   *  onApply = where to write the result (defaults to setChartTableDraft). */
  const handleFileImport = (
    file: File,
    maxCols: number,
    maxRows: number,
    onApply?: (t: { headers: string[]; rows: string[][] }) => void,
    isChartTable?: boolean,
  ) => {
    const cb = onApply ?? ((t: { headers: string[]; rows: string[][] }) => setChartTableDraft(t));
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const firstSheet = wb.SheetNames[0];
        const matrix = matrixFromSheet(wb, firstSheet);
        openImportPreview(
          matrix, maxCols, maxRows, cb,
          wb.SheetNames.length > 1 ? wb.SheetNames : undefined,
          firstSheet,
          wb.SheetNames.length > 1 ? wb : undefined,
          isChartTable,
        );
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (!text) return;
        const lines = text.trim().split(/\r?\n/);
        const matrix = lines.map((l) =>
          l.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
        );
        openImportPreview(matrix, maxCols, maxRows, cb, undefined, undefined, undefined, isChartTable);
      };
      reader.readAsText(file);
    }
  };

  // Convenience wrappers
  const handleChartFileImport = (
    file: File,
    onApply?: (t: { headers: string[]; rows: string[][] }) => void,
  ) => handleFileImport(file, CHART_MODAL_MAX_COLS, CHART_MODAL_MAX_ROWS, onApply, true);

  const handleTickerFileImport = (
    file: File,
    onApply?: (t: { headers: string[]; rows: string[][] }) => void,
  ) => handleFileImport(file, TICKER_MODAL_MAX_COLS, TICKER_MODAL_MAX_ROWS, onApply);

  /**
   * Parse clipboard text into a 2-D matrix of cells.
   * Recognizes three formats, in order:
   *   1. Markdown / GFM pipe tables (`| col | col |` with optional `|---|---|` separator)
   *   2. TSV (Excel / Google Sheets default copy format)
   *   3. CSV with quoted-comma support
   */
  const parseClipboardTable = (text: string): string[][] => {
    const stripped = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
    if (!stripped) return [];
    const lines = stripped.split("\n");

    // ── 1) Markdown pipe table ─────────────────────────────────────────────
    // Heuristic: at least 2 non-empty lines, each containing a `|`, and the
    // overall block has more pipes than tabs/commas (so it's clearly piped).
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    const pipedLines = nonEmpty.filter((l) => l.includes("|"));
    const pipeCount = (stripped.match(/\|/g) ?? []).length;
    const tabCount = (stripped.match(/\t/g) ?? []).length;
    const isMarkdownTable =
      pipedLines.length >= 2 &&
      pipedLines.length === nonEmpty.length &&
      pipeCount > tabCount;

    if (isMarkdownTable) {
      const splitMdRow = (line: string): string[] => {
        let s = line.trim();
        // Strip leading and trailing pipes if present so we don't get empty edge cells.
        if (s.startsWith("|")) s = s.slice(1);
        if (s.endsWith("|")) s = s.slice(0, -1);
        return s.split("|").map((c) => c.trim());
      };
      // Drop GFM alignment rows like "|---|:--:|---|".
      const isSeparatorRow = (cells: string[]) =>
        cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c.trim()));
      return nonEmpty.map(splitMdRow).filter((cells) => !isSeparatorRow(cells));
    }

    // ── 2) TSV / 3) CSV ───────────────────────────────────────────────────
    const hasTabs = stripped.includes("\t");
    return lines.map((line) =>
      hasTabs
        ? line.split("\t")
        // Minimal CSV split — handles quoted values with embedded commas.
        : (line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? [])
            .filter((_, i, a) => i < a.length - 1 || a[i] !== "")
            .map((tok) => tok.replace(/,$/, "").trim().replace(/^"(.*)"$/, "$1").replace(/""/g, '"')),
    );
  };

  /** Bulk-paste TSV/CSV starting at (startRow, startCol); grows headers/rows up to caps. */
  const handleChartPaste = (startRow: number, startCol: number, pasted: string) => {
    const matrix = parseClipboardTable(pasted);
    if (matrix.length === 0) return;
    // Single-cell paste with no tabs/newlines → let default input behavior handle it.
    if (matrix.length === 1 && matrix[0].length === 1 && !pasted.includes("\t") && !pasted.includes("\n")) return;

    const pastedMaxCols = Math.max(...matrix.map((r) => r.length));
    const pastedRows = matrix.length;
    if (startCol + pastedMaxCols > CHART_MODAL_MAX_COLS) {
      showChartTableError(`Only ${CHART_MODAL_MAX_COLS} columns allowed — extra columns were ignored.`);
    } else if (startRow + pastedRows > CHART_MODAL_MAX_ROWS) {
      showChartTableError(`Only ${CHART_MODAL_MAX_ROWS} rows allowed — extra rows were ignored.`);
    }

    const neededCols = Math.min(CHART_MODAL_MAX_COLS, startCol + pastedMaxCols);
    const neededRows = Math.min(CHART_MODAL_MAX_ROWS, startRow + pastedRows);

    const nextHeaders = [...chartDraft.headers];
    while (nextHeaders.length < neededCols) nextHeaders.push(`Series ${nextHeaders.length}`);

    const nextRows = chartDraft.rows.map((r) => {
      const padded = [...r];
      while (padded.length < nextHeaders.length) padded.push("");
      return padded;
    });
    while (nextRows.length < neededRows) nextRows.push(Array(nextHeaders.length).fill(""));

    for (let ri = 0; ri < matrix.length; ri++) {
      const targetRow = startRow + ri;
      if (targetRow >= CHART_MODAL_MAX_ROWS) break;
      for (let ci = 0; ci < matrix[ri].length; ci++) {
        const targetCol = startCol + ci;
        if (targetCol >= CHART_MODAL_MAX_COLS) break;
        nextRows[targetRow][targetCol] = matrix[ri][ci];
      }
    }

    setChartTableDraft({ headers: nextHeaders, rows: nextRows });
  };

  /**
   * Whole-table paste — replaces the entire draft (headers + rows) from a TSV/CSV
   * clipboard payload. First parsed line becomes the headers; remaining lines
   * become the body rows. Used by the "Paste" toolbar button so a round-trip
   * (Copy → Paste) restores the exact same table.
   */
  const handleChartPasteWholeTable = (pasted: string) => {
    const matrix = parseClipboardTable(pasted);
    if (matrix.length === 0) return;

    const pastedMaxCols = Math.max(...matrix.map((r) => r.length), 2);
    const pastedBodyRows = Math.max(0, matrix.length - 1);
    if (pastedMaxCols > CHART_MODAL_MAX_COLS) {
      showChartTableError(`Only ${CHART_MODAL_MAX_COLS} columns allowed — extra columns were ignored.`);
    } else if (pastedBodyRows > CHART_MODAL_MAX_ROWS) {
      showChartTableError(`Only ${CHART_MODAL_MAX_ROWS} rows allowed — extra rows were ignored.`);
    }

    const colCount = Math.min(CHART_MODAL_MAX_COLS, pastedMaxCols);
    // Header line — pad/truncate to colCount.
    const headerLine = matrix[0];
    const nextHeaders: string[] = [];
    for (let ci = 0; ci < colCount; ci++) {
      const v = headerLine[ci]?.trim();
      nextHeaders.push(v || (ci === 0 ? "Label" : `Series ${ci}`));
    }

    // Body rows — pad/truncate to colCount, cap at MAX_ROWS.
    const bodyMatrix = matrix.slice(1);
    const nextRows: string[][] = [];
    for (let ri = 0; ri < bodyMatrix.length && ri < CHART_MODAL_MAX_ROWS; ri++) {
      const row = bodyMatrix[ri];
      const padded: string[] = [];
      for (let ci = 0; ci < colCount; ci++) padded.push(row[ci] ?? "");
      nextRows.push(padded);
    }
    // Ensure at least one body row so the table is editable.
    if (nextRows.length === 0) nextRows.push(Array(colCount).fill(""));

    setChartTableDraft({ headers: nextHeaders, rows: nextRows });
  };

  /** Serialize the current draft as TSV (Excel-friendly) and copy to clipboard. */
  const handleChartCopyAll = async () => {
    const lines: string[] = [];
    lines.push(chartDraft.headers.join("\t"));
    for (const row of chartDraft.rows) {
      const padded = [...row];
      while (padded.length < chartDraft.headers.length) padded.push("");
      lines.push(padded.slice(0, chartDraft.headers.length).join("\t"));
    }
    const tsv = lines.join("\n");
    try {
      await navigator.clipboard.writeText(tsv);
    } catch {
      // Fallback for older browsers / insecure contexts.
      const ta = document.createElement("textarea");
      ta.value = tsv;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } finally { document.body.removeChild(ta); }
    }
  };

  const chartModal = chartTableModalOpen && chartTableModalKey ? (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setChartTableModalOpen(false)} />
      <div
        className="relative w-full max-w-3xl rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl flex flex-col"
        style={{ maxHeight: "92dvh" }}
      >

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Edit chart data</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Editable headers · max {CHART_MODAL_MAX_ROWS} rows · max {CHART_MODAL_MAX_COLS} cols · paste TSV/CSV into any cell to bulk-fill</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Help button */}
            <div className="relative group">
              <button
                type="button"
                className="w-6 h-6 flex items-center justify-center rounded-full border border-purple-200 text-purple-500 bg-purple-50 hover:bg-purple-100 text-[11px] font-bold leading-none"
                title="How to use this table"
              >
                ?
              </button>
              <div className="absolute right-0 top-8 z-50 w-72 rounded-xl border border-gray-200 bg-white shadow-xl p-4 text-[11px] text-gray-600 leading-relaxed hidden group-hover:block">
                <p className="font-semibold text-gray-800 mb-2">How to use the chart table</p>
                <ul className="space-y-1.5 list-none">
                  <li><span className="font-medium text-purple-600">Upload CSV / Excel</span> — drag a file onto the drop zone or click the upload button. For Excel files with multiple sheets, you'll be asked to pick one.</li>
                  <li><span className="font-medium text-purple-600">Column picker</span> — if your file has more than {CHART_MODAL_MAX_COLS} columns, choose which {CHART_MODAL_MAX_COLS} to keep.</li>
                  <li><span className="font-medium text-purple-600">Max size</span> — data is clipped to {CHART_MODAL_MAX_ROWS} rows × {CHART_MODAL_MAX_COLS} columns automatically.</li>
                  <li><span className="font-medium text-purple-600">Select cells</span> — click a cell, then Shift-click or drag to select a range.</li>
                  <li><span className="font-medium text-purple-600">Copy / Paste</span> — Ctrl+C to copy, Ctrl+V to paste (works with Excel / Google Sheets).</li>
                  <li><span className="font-medium text-purple-600">Delete</span> — select rows or cells, then press Delete or Backspace.</li>
                  <li><span className="font-medium text-purple-600">Row numbers</span> — click or drag the row-number gutter to select whole rows.</li>
                </ul>
              </div>
            </div>
            <button type="button" onClick={() => setChartTableModalOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Transient paste-limit error banner */}
        {chartTableError && (
          <div className="mx-3 sm:mx-4 mt-2 px-3 py-2 rounded-md border border-red-200 bg-red-50 text-[11px] text-red-700 flex items-start gap-2">
            <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span className="flex-1">{chartTableError}</span>
          </div>
        )}

        {/* Drag-and-drop / click-to-upload import zone */}
        <div
          className={`mx-3 sm:mx-4 mt-3 flex-shrink-0 rounded-lg border-2 border-dashed px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer ${chartDropOver ? "border-purple-400 bg-purple-50" : "border-gray-200 bg-gray-50 hover:border-purple-300 hover:bg-purple-50/40"}`}
          onClick={() => chartFileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setChartDropOver(true); }}
          onDragLeave={() => setChartDropOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setChartDropOver(false);
            const file = e.dataTransfer.files[0];
            if (!file) return;
            handleChartFileImport(file);
          }}
        >
          <svg className={`w-5 h-5 flex-shrink-0 transition-colors ${chartDropOver ? "text-purple-400" : "text-gray-300"}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span className={`text-[11px] transition-colors ${chartDropOver ? "text-purple-600" : "text-gray-400"}`}>
            {chartDropOver ? "Release to import" : <>Drop a <strong className="font-medium text-gray-500">.csv</strong> or <strong className="font-medium text-gray-500">.xlsx</strong> file here to import, or <strong className="font-medium text-purple-500">click to browse</strong></>}
          </span>
          <input
            ref={chartFileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleChartFileImport(file);
              e.target.value = "";
            }}
          />
        </div>

        {/* Table area */}
        <div className="overflow-auto flex-1 p-3 sm:p-4">
          <SpreadsheetTable
            data={chartDraft}
            onChange={setChartTableDraft}
            maxRows={CHART_MODAL_MAX_ROWS}
            maxCols={CHART_MODAL_MAX_COLS}
            onBulkPaste={(ri, ci, text) => handleChartPaste(ri, ci, text)}
            onHeaderPaste={(ci, text) => {
              const matrix = parseClipboardTable(text);
              if (matrix.length === 0) return;
              const headerLine = matrix[0];
              const bodyMatrix = matrix.slice(1);
              if (ci + headerLine.length > CHART_MODAL_MAX_COLS) showChartTableError(`Only ${CHART_MODAL_MAX_COLS} columns allowed — extra columns were ignored.`);
              else if (bodyMatrix.length > CHART_MODAL_MAX_ROWS) showChartTableError(`Only ${CHART_MODAL_MAX_ROWS} rows allowed — extra rows were ignored.`);
              const neededCols = Math.min(CHART_MODAL_MAX_COLS, ci + headerLine.length);
              const nextHeaders = [...chartDraft.headers];
              while (nextHeaders.length < neededCols) nextHeaders.push(`Series ${nextHeaders.length}`);
              for (let i = 0; i < headerLine.length; i++) { const tc = ci + i; if (tc >= CHART_MODAL_MAX_COLS) break; nextHeaders[tc] = headerLine[i]; }
              setChartTableDraft({ headers: nextHeaders, rows: chartDraft.rows });
              if (bodyMatrix.length > 0) setTimeout(() => handleChartPaste(0, ci, bodyMatrix.map((r) => r.join("\t")).join("\n")), 0);
            }}
          />
        </div>

        {/* Toolbar — wraps on narrow viewports so all controls remain reachable */}
        <div className="px-3 sm:px-4 py-2 border-t border-gray-100 flex flex-wrap items-center gap-1.5 flex-shrink-0">
          {/* Row controls */}
          <button
            type="button"
            onClick={() => setChartTableDraft({ ...chartDraft, rows: [...chartDraft.rows, Array(chartDraft.headers.length).fill("")] })}
            disabled={chartDraft.rows.length >= CHART_MODAL_MAX_ROWS}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 hover:border-green-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Row
          </button>
          <button
            type="button"
            onClick={() => chartDraft.rows.length > 1 && setChartTableDraft({ ...chartDraft, rows: chartDraft.rows.slice(0, -1) })}
            disabled={chartDraft.rows.length <= 1}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 hover:border-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
            Row
          </button>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          {/* Col controls */}
          <button
            type="button"
            onClick={() => setChartTableDraft({ headers: [...chartDraft.headers, `Series ${chartDraft.headers.length}`], rows: chartDraft.rows.map((r) => [...r, ""]) })}
            disabled={chartDraft.headers.length >= CHART_MODAL_MAX_COLS}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 hover:border-green-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Col
          </button>
          <button
            type="button"
            onClick={() => chartDraft.headers.length > 2 && setChartTableDraft({ headers: chartDraft.headers.slice(0, -1), rows: chartDraft.rows.map((r) => r.slice(0, -1)) })}
            disabled={chartDraft.headers.length <= 2}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 hover:border-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
            Col
          </button>

        </div>

        {/* Numeric columns warning */}
        {(() => {
          // cols 2+ (index 1+) should be numeric for charts to render
          const badCols = chartDraft.headers.slice(1).filter((_, ci) => {
            const colIdx = ci + 1;
            return chartDraft.rows.some((row) => {
              const v = row[colIdx];
              return v !== undefined && v !== "" && isNaN(Number(v));
            });
          });
          if (badCols.length === 0) return null;
          return (
            <div className="mx-3 sm:mx-4 mb-2 px-3 py-2 rounded-md border border-amber-200 bg-amber-50 text-[11px] text-amber-800 flex items-start gap-2">
              <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span>
                <span className="font-semibold">Non-numeric data in series columns: </span>
                {badCols.map((h) => <span key={h} className="font-mono bg-amber-100 rounded px-1 mr-1">{h}</span>)}
                — charts need numeric values in columns 2+. Column 1 is the X-axis label.
              </span>
            </div>
          );
        })()}

        {/* Action row — always pinned to bottom of the modal so Cancel/Save remain reachable on every viewport */}
        <div className="px-3 sm:px-4 py-3 border-t border-gray-100 flex items-center gap-2 flex-shrink-0 bg-white rounded-b-2xl">
          <button
            type="button"
            onClick={() => setChartTableModalOpen(false)}
            className="flex-1 sm:flex-none px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const normalized = normalizeChartTableValue(chartDraft);
              setEditableLayoutProps((prev) => ({ ...prev, [chartTableModalKey]: normalized }));
              setChartTableModalOpen(false);
            }}
            className="flex-1 sm:flex-none sm:ml-auto px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ─── Import Preview modal (replaces old sheet/col pickers) ────
  const importPreviewModal = importPreview ? (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setImportPreview(null)} />
      <div className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "90dvh" }}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Preview & select data to import</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Showing up to 100 columns × 20 rows · click headers/row numbers to select · max {importPreview.maxCols} cols × {importPreview.maxRows} rows will be imported
            </p>
          </div>
          <button type="button" onClick={() => setImportPreview(null)} className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-gray-700">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="overflow-auto flex-1 p-4">
          <ImportPreviewSheet
            matrix={importPreview.matrix}
            sheetNames={importPreview.sheetNames}
            activeSheet={importPreview.activeSheet}
            onSheetChange={(name) => {
              if (!importPreview.wb) return;
              const matrix = matrixFromSheet(importPreview.wb, name);
              setImportPreview((prev) => prev ? { ...prev, matrix, activeSheet: name } : null);
            }}
            maxCols={importPreview.maxCols}
            maxRows={importPreview.maxRows}
            isChartTable={importPreview.isChartTable}
            onApply={(result) => {
              chartImportCallbackRef.current?.(result);
              setImportPreview(null);
            }}
            onCancel={() => setImportPreview(null)}
          />
        </div>
      </div>
    </div>
  ) : null;

  // ─── Pipe-table modal (bloomberg terminal_table etc.) ─────────
  const pipeDraft = pipeTableDraft ?? { headers: ["Col 1", "Col 2"], rows: [["", ""]] };

  const pipeModal = pipeTableModalOpen && pipeTableModalKey ? (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setPipeTableModalOpen(false)} />
      <div className="relative w-full max-w-3xl rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl flex flex-col" style={{ maxHeight: "92dvh" }}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Edit table data</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Editable headers · max {pipeTableModalMaxRows} rows · max {pipeTableModalMaxCols} cols · paste TSV/CSV into any cell to bulk-fill</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Help button */}
            <div className="relative group">
              <button type="button" className="w-6 h-6 flex items-center justify-center rounded-full border border-purple-200 text-purple-500 bg-purple-50 hover:bg-purple-100 text-[11px] font-bold leading-none" title="How to use this table">?</button>
              <div className="absolute right-0 top-8 z-50 w-72 rounded-xl border border-gray-200 bg-white shadow-xl p-4 text-[11px] text-gray-600 leading-relaxed hidden group-hover:block">
                <p className="font-semibold text-gray-800 mb-2">How to use the table</p>
                <ul className="space-y-1.5 list-none">
                  <li><span className="font-medium text-purple-600">Upload CSV / Excel</span> — drag a file onto the drop zone or click Upload. Multi-sheet Excel shows a sheet picker.</li>
                  <li><span className="font-medium text-purple-600">Column picker</span> — if your file has more than {pipeTableModalMaxCols} columns, choose which to keep.</li>
                  <li><span className="font-medium text-purple-600">Max size</span> — clipped to {pipeTableModalMaxRows} rows × {pipeTableModalMaxCols} cols automatically.</li>
                  <li><span className="font-medium text-purple-600">Select cells</span> — click then Shift-click or drag.</li>
                  <li><span className="font-medium text-purple-600">Copy / Paste</span> — Ctrl+C / Ctrl+V (Excel/Sheets compatible).</li>
                  <li><span className="font-medium text-purple-600">Delete</span> — select rows or cells, press Delete or Backspace.</li>
                  <li><span className="font-medium text-purple-600">Row numbers</span> — click or drag gutter to select whole rows.</li>
                </ul>
              </div>
            </div>
            <button type="button" onClick={() => setPipeTableModalOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Drag-and-drop import zone */}
        <div
          className={`mx-3 sm:mx-4 mt-3 flex-shrink-0 rounded-lg border-2 border-dashed px-4 py-3 flex items-center gap-3 transition-colors ${chartDropOver ? "border-purple-400 bg-purple-50" : "border-gray-200 bg-gray-50"}`}
          onDragOver={(e) => { e.preventDefault(); setChartDropOver(true); }}
          onDragLeave={() => setChartDropOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setChartDropOver(false);
            const file = e.dataTransfer.files[0];
            if (!file) return;
            handleFileImport(file, pipeTableModalMaxCols, pipeTableModalMaxRows, (t) => setPipeTableDraft(t));
          }}
        >
          <svg className={`w-5 h-5 flex-shrink-0 transition-colors ${chartDropOver ? "text-purple-400" : "text-gray-300"}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span className={`text-[11px] transition-colors ${chartDropOver ? "text-purple-600" : "text-gray-400"}`}>
            {chartDropOver ? "Release to import" : <><strong className="font-medium text-gray-500">.csv</strong> or <strong className="font-medium text-gray-500">.xlsx</strong> — drop here, or use the Upload button above</>}
          </span>
          <label className="ml-auto flex-shrink-0 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-gray-200 text-gray-600 bg-white hover:text-purple-600 hover:border-purple-400 cursor-pointer transition-colors">
            Upload
            <input type="file" accept=".csv,.xlsx,.xls,text/csv" className="sr-only" onChange={(e) => {
              const file = e.target.files?.[0]; if (!file) return;
              handleFileImport(file, pipeTableModalMaxCols, pipeTableModalMaxRows, (t) => setPipeTableDraft(t));
              e.target.value = "";
            }} />
          </label>
        </div>

        {/* Table area */}
        <div className="overflow-auto flex-1 p-3 sm:p-4">
          <SpreadsheetTable
            data={pipeDraft}
            onChange={setPipeTableDraft}
            maxRows={pipeTableModalMaxRows}
            maxCols={pipeTableModalMaxCols}
          />
        </div>

        {/* Toolbar */}
        <div className="px-3 sm:px-4 py-2 border-t border-gray-100 flex flex-wrap items-center gap-1.5 flex-shrink-0">
          <button type="button"
            onClick={() => setPipeTableDraft({ ...pipeDraft, rows: [...pipeDraft.rows, Array(pipeDraft.headers.length).fill("")] })}
            disabled={pipeDraft.rows.length >= pipeTableModalMaxRows}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>Row
          </button>
          <button type="button"
            onClick={() => pipeDraft.rows.length > 1 && setPipeTableDraft({ ...pipeDraft, rows: pipeDraft.rows.slice(0, -1) })}
            disabled={pipeDraft.rows.length <= 1}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>Row
          </button>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <button type="button"
            onClick={() => setPipeTableDraft({ headers: [...pipeDraft.headers, `Col ${pipeDraft.headers.length + 1}`], rows: pipeDraft.rows.map((r) => [...r, ""]) })}
            disabled={pipeDraft.headers.length >= pipeTableModalMaxCols}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>Col
          </button>
          <button type="button"
            onClick={() => pipeDraft.headers.length > 1 && setPipeTableDraft({ headers: pipeDraft.headers.slice(0, -1), rows: pipeDraft.rows.map((r) => r.slice(0, -1)) })}
            disabled={pipeDraft.headers.length <= 1}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>Col
          </button>
        </div>

        {/* Footer */}
        <div className="px-3 sm:px-4 py-3 border-t border-gray-100 flex items-center gap-2 flex-shrink-0 bg-white rounded-b-2xl">
          <button type="button" onClick={() => setPipeTableModalOpen(false)} className="flex-1 sm:flex-none px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            onClick={() => {
              if (!pipeTableModalKey) return;
              const allRows = [pipeDraft.headers, ...pipeDraft.rows];
              setEditableLayoutProps((prev) => ({ ...prev, [pipeTableModalKey]: allRows.map((r) => r.join(" | ")) }));
              setPipeTableModalOpen(false);
            }}
            className="flex-1 sm:flex-none sm:ml-auto px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700"
          >Save</button>
        </div>
      </div>
    </div>
  ) : null;

  return isDemo
    ? <>{modalTree}{tickerModal}{chartModal}{pipeModal}{importPreviewModal}</>
    : ReactDOM.createPortal(<>{modalTree}{tickerModal}{chartModal}{pipeModal}{importPreviewModal}</>, document.body);
}
