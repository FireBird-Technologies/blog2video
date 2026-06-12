/**
 * Shared data-visualization registry for BUILT-IN (bundled, non-`crafted_`)
 * templates — currently matrix / spotlight / chronicle.
 *
 * These templates reuse laduc's chart contract (a single `chartTable` +
 * `chartType`, rendered line/bar/histogram by the shared `_shared/chartData`
 * pipeline) and a ticker/table layout. This module centralizes the per-template
 * editor behavior so SceneEditModal stays template-agnostic and adding a new
 * built-in template means adding ONE entry here (plus its meta.json + layout
 * registration) — not editing the modal.
 *
 * NOTE: laduc and FJ intentionally keep their own dedicated helpers/branches in
 * SceneEditModal and are NOT registered here. Mirror of the backend rule in
 * `pipeline.py` (`CHART_TICKER_TEMPLATE_LAYOUTS`).
 */

export type ChartKind = "line" | "bar" | "histogram";
export type ChartTable = { headers: string[]; rows: string[][] };

interface BuiltinDataVizConfig {
  /**
   * The data-visualization chart layout id(s). One layout per template covers
   * line / bar / histogram — the kind is chosen via the chartType select, not
   * via separate layouts. (Kept as an array for the generic membership checks.)
   */
  chartLayoutIds: string[];
  /** The ticker / data-table layout id. */
  tickerLayoutId: string;
  /**
   * Fixed chart kind for a layout id. With a single chart layout this returns
   * undefined (kind is user-driven via the chartType select, defaulting to
   * "line"); kept for callers that want a per-layout hint.
   */
  layoutKind: (layoutId: string) => ChartKind | undefined;
  /** Template-themed example data per chart kind (seed + chartType reseed). */
  exampleTable: (kind: ChartKind) => ChartTable;
}

function normalize(templateId: string | undefined | null): string {
  return (templateId || "default").toLowerCase();
}

function layoutKindFromSuffix(layoutId: string): ChartKind | undefined {
  if (layoutId.endsWith("_bar")) return "bar";
  if (layoutId.endsWith("_histogram")) return "histogram";
  return undefined;
}

// ── Themed example tables ─────────────────────────────────────────────────────

const matrixExample = (kind: ChartKind): ChartTable => {
  if (kind === "bar") {
    return {
      headers: ["Node", "Signal", "Noise"],
      rows: [
        ["Alpha", "324", "72"],
        ["Bravo", "308", "55"],
        ["Charlie", "315", "61"],
        ["Delta", "298", "68"],
        ["Echo", "318", "59"],
      ],
    };
  }
  if (kind === "histogram") {
    return {
      headers: ["Signal bucket", "Count"],
      rows: [
        ["0 - 20", "1"],
        ["20 - 40", "3"],
        ["40 - 60", "6"],
        ["60 - 80", "4"],
        ["80 - 100", "2"],
      ],
    };
  }
  return {
    headers: ["Cycle", "Signal", "Noise"],
    rows: [
      ["T-04", "298", "72"],
      ["T-03", "308", "68"],
      ["T-02", "315", "61"],
      ["T-01", "324", "55"],
      ["T-00", "318", "59"],
    ],
  };
};

const spotlightExample = (kind: ChartKind): ChartTable => {
  if (kind === "bar") {
    return {
      headers: ["Segment", "Revenue", "Margin"],
      rows: [
        ["Retail", "324", "41"],
        ["Wholesale", "308", "36"],
        ["Online", "315", "39"],
        ["Partners", "298", "44"],
        ["Other", "318", "33"],
      ],
    };
  }
  if (kind === "histogram") {
    return {
      headers: ["Revenue band", "Accounts"],
      rows: [
        ["< 100", "2"],
        ["100 - 200", "5"],
        ["200 - 300", "9"],
        ["300 - 400", "6"],
        ["400 +", "3"],
      ],
    };
  }
  return {
    headers: ["Quarter", "Revenue", "Margin"],
    rows: [
      ["Q1", "298", "72"],
      ["Q2", "308", "68"],
      ["Q3", "315", "61"],
      ["Q4", "324", "55"],
      ["Q5", "318", "59"],
    ],
  };
};

const chronicleExample = (kind: ChartKind): ChartTable => {
  if (kind === "bar") {
    return {
      headers: ["House", "Holdings", "Levy"],
      rows: [
        ["Aldermoor", "324", "72"],
        ["Brightwater", "308", "55"],
        ["Caldwell", "315", "61"],
        ["Dunhollow", "298", "68"],
        ["Eastmarch", "318", "59"],
      ],
    };
  }
  if (kind === "histogram") {
    return {
      headers: ["Tithe band", "Parishes"],
      rows: [
        ["0 - 10", "2"],
        ["10 - 20", "6"],
        ["20 - 30", "9"],
        ["30 - 40", "5"],
        ["40 +", "2"],
      ],
    };
  }
  return {
    headers: ["Year", "Population", "Levy"],
    rows: [
      ["1340", "298", "72"],
      ["1345", "308", "68"],
      ["1350", "315", "61"],
      ["1355", "324", "55"],
      ["1360", "318", "59"],
    ],
  };
};

// ── Registry ──────────────────────────────────────────────────────────────────

const BUILTIN_DATAVIZ: Record<string, BuiltinDataVizConfig> = {
  matrix: {
    chartLayoutIds: ["matrix_data"],
    tickerLayoutId: "matrix_ticker",
    layoutKind: layoutKindFromSuffix,
    exampleTable: matrixExample,
  },
  spotlight: {
    chartLayoutIds: ["spotlight_data"],
    tickerLayoutId: "spotlight_table",
    layoutKind: layoutKindFromSuffix,
    exampleTable: spotlightExample,
  },
  chronicle: {
    chartLayoutIds: ["chronicle_data"],
    tickerLayoutId: "chronicle_table",
    layoutKind: layoutKindFromSuffix,
    exampleTable: chronicleExample,
  },
};

// ── Public helpers (consumed by SceneEditModal) ───────────────────────────────

/** True when `templateId` is a registered built-in data-viz template. */
export function isBuiltinDataVizTemplate(templateId: string | undefined | null): boolean {
  return !!BUILTIN_DATAVIZ[normalize(templateId)];
}

/** True when `layoutId` is one of `templateId`'s chart layouts (base or variant). */
export function isBuiltinDataVizChartLayout(
  templateId: string | undefined | null,
  layoutId: string | null | undefined,
): boolean {
  if (!layoutId) return false;
  return !!BUILTIN_DATAVIZ[normalize(templateId)]?.chartLayoutIds.includes(layoutId);
}

/** True when `layoutId` is `templateId`'s ticker / data-table layout. */
export function isBuiltinTickerLayout(
  templateId: string | undefined | null,
  layoutId: string | null | undefined,
): boolean {
  if (!layoutId) return false;
  return BUILTIN_DATAVIZ[normalize(templateId)]?.tickerLayoutId === layoutId;
}

/**
 * Fixed chart kind for a layout id (bar/histogram variants), or undefined for the
 * base `*_data` layout (caller defaults to "line").
 */
export function builtinChartKindForLayout(
  templateId: string | undefined | null,
  layoutId: string,
): ChartKind | undefined {
  return BUILTIN_DATAVIZ[normalize(templateId)]?.layoutKind(layoutId);
}

/** Template-themed example table for a chart kind, or undefined if not registered. */
export function builtinDataVizExampleTable(
  templateId: string | undefined | null,
  kind: ChartKind,
): ChartTable | undefined {
  return BUILTIN_DATAVIZ[normalize(templateId)]?.exampleTable(kind);
}
