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

const mosaicExample = (kind: ChartKind): ChartTable => {
  if (kind === "bar") {
    return {
      headers: ["Fragment", "Coverage", "Density"],
      rows: [
        ["Terracotta", "324", "72"],
        ["Cobalt", "308", "55"],
        ["Cream", "315", "61"],
        ["Slate", "298", "68"],
        ["Gold", "318", "59"],
      ],
    };
  }
  if (kind === "histogram") {
    return {
      headers: ["Tile size", "Count"],
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
    headers: ["Quarter", "Coverage", "Density"],
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

const defaultExample = (kind: ChartKind): ChartTable => {
  if (kind === "bar") {
    return {
      headers: ["Module", "Performance", "Coverage"],
      rows: [
        ["Auth", "324", "72"],
        ["API", "308", "55"],
        ["UI", "315", "61"],
        ["Cache", "298", "68"],
        ["DB", "318", "59"],
      ],
    };
  }
  if (kind === "histogram") {
    return {
      headers: ["Latency bucket", "Requests"],
      rows: [
        ["0 - 20ms", "2"],
        ["20 - 40ms", "6"],
        ["40 - 60ms", "9"],
        ["60 - 80ms", "5"],
        ["80ms+", "2"],
      ],
    };
  }
  return {
    headers: ["Release", "Adoption", "Retention"],
    rows: [
      ["v1.0", "298", "72"],
      ["v1.1", "308", "68"],
      ["v1.2", "315", "61"],
      ["v2.0", "324", "55"],
      ["v2.1", "318", "59"],
    ],
  };
};

const nightfallExample = (kind: ChartKind): ChartTable => {
  if (kind === "bar") {
    return {
      headers: ["Node", "Throughput", "Latency"],
      rows: [
        ["Alpha", "324", "18"],
        ["Bravo", "308", "22"],
        ["Charlie", "315", "19"],
        ["Delta", "298", "25"],
        ["Echo", "318", "21"],
      ],
    };
  }
  if (kind === "histogram") {
    return {
      headers: ["Response time", "Requests"],
      rows: [
        ["0 - 50ms", "3"],
        ["50 - 100ms", "8"],
        ["100 - 200ms", "12"],
        ["200 - 500ms", "5"],
        ["500ms+", "1"],
      ],
    };
  }
  return {
    headers: ["Week", "Requests", "Errors"],
    rows: [
      ["W-04", "298", "12"],
      ["W-03", "308", "9"],
      ["W-02", "315", "7"],
      ["W-01", "324", "5"],
      ["W-00", "318", "6"],
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
  mosaic: {
    chartLayoutIds: ["mosaic_data_visualization"],
    tickerLayoutId: "mosaic_ticker",
    layoutKind: layoutKindFromSuffix,
    exampleTable: mosaicExample,
  },
  default: {
    chartLayoutIds: ["default_data_visualization"],
    tickerLayoutId: "default_ticker",
    layoutKind: layoutKindFromSuffix,
    exampleTable: defaultExample,
  },
  nightfall: {
    chartLayoutIds: ["nightfall_data_visualization"],
    tickerLayoutId: "nightfall_ticker",
    layoutKind: layoutKindFromSuffix,
    exampleTable: nightfallExample,
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
