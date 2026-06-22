/**
 * Shared chart-data helpers — pure parsing / type-inference / animation math.
 *
 * Lets any template bind the SAME scraped-table → chart pipeline without
 * duplicating the renderer. THIS MODULE IS STYLE-FREE: no colors, fonts, or JSX.
 * Renderers supply their own theme to the few helpers that need axis styling
 * (e.g. buildXAxisProps takes the tick fill + font family as arguments), so the
 * look is fully owned per template while the data logic stays here.
 *
 * To add charts to a new template: build a `<Template>Chart.tsx` renderer that
 * imports these helpers (resolveChartInputs → selectChartType →
 * orientChartInputsForType → render with your own palette/fonts). See the Matrix
 * data layouts for a reference consumer.
 *
 * Keep behavior identical across templates — this is the single source of truth
 * for how a chartTable becomes plotted series.
 */

/** Keep in sync with backend table-extraction row cap. */
export const CHART_MAX_ROWS = 20;

export interface ChartTableShape {
  headers?: string[];
  rows?: Array<Array<string | number>>;
}

export interface ParsedSeries {
  label: string;
  values: number[];
}

export interface ChartInputs {
  labels: string[];
  lineSeries: ParsedSeries[];
  barRows: { label: string; value: number }[];
  histogramRows: { label: string; value: number }[];
}

export type ChartKind = "line" | "bar" | "histogram";

// ─── Numeric parsing / formatting ────────────────────────────────────────────
const STRICT_NUMERIC_RE =
  /^\s*\(?\s*[+\-]?\$?\s*\d[\d,]*(?:\.\d+)?\s*(?:%|[a-z]{1,12})?\s*\)?\s*$/i;

export function toNumber(value: string | number | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = (value ?? "").toString().trim();
  if (!raw) return null;
  if (STRICT_NUMERIC_RE.test(raw)) {
    const neg = raw.startsWith("(") && raw.endsWith(")");
    const parsed = Number(raw.replace(/[^0-9.\-]/g, ""));
    if (!Number.isFinite(parsed)) return null;
    return neg ? -Math.abs(parsed) : parsed;
  }
  const compact = raw.replace(/[~≈]/g, "").replace(/\+/g, "").replace(/,/g, "").trim();
  const token = compact.match(/-?\d*\.?\d+/)?.[0];
  if (!token) return null;
  const parsed = Number(token);
  if (!Number.isFinite(parsed)) return null;
  return (raw.startsWith("(") && raw.endsWith(")")) ? -Math.abs(parsed) : parsed;
}

export function formatAxisTick(value: number): string {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${(value / 1_000).toFixed(1)}K`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function formatCompact1dp(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000)     return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)         return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(1);
}

export function formatBarLabel(v: unknown, compact = false): string {
  const n = toNumber(v as string | number | undefined);
  if (n === null) return "";
  return compact ? formatCompact1dp(n) : n.toFixed(1);
}

export function formatLineLabel(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "";
  return formatCompact1dp(Number(v));
}

export function getAxisUpperBound(maxValue: number): number {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return 1;
  const padded = maxValue * 1.12;
  const magnitude = Math.pow(10, Math.floor(Math.log10(padded)));
  const step = magnitude / 2;
  return Math.ceil(padded / step) * step;
}

export function normalizeHex(input: string | undefined, fallback: string): string {
  if (!input) return fallback;
  const v = input.trim();
  return /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(v) ? v : fallback;
}

const PLACEHOLDER_HEADER_RE = /^series\s+\d+$/i;

/** True for empty, synthetic col_N, or legacy "Series N" header cells. */
export function isPlaceholderChartHeader(value: string): boolean {
  const s = (value || "").trim();
  if (!s) return true;
  if (/^col_\d+$/i.test(s)) return true;
  if (PLACEHOLDER_HEADER_RE.test(s)) return true;
  return false;
}

/** Mirror backend chart_planner._ensure_chart_headers — never leave bare "Series N". */
export function ensureChartHeaders(
  headers: string[],
  colCount: number,
  labelColIdx = 0,
): string[] {
  const out = headers.map((h) => String(h ?? "").trim());
  while (out.length < colCount) out.push("");
  const trimmed = out.slice(0, colCount);

  if (isPlaceholderChartHeader(trimmed[labelColIdx])) {
    trimmed[labelColIdx] = "Category";
  }

  const numericCols = Array.from({ length: colCount }, (_, i) => i).filter((i) => i !== labelColIdx);
  let metricN = 0;
  for (const c of numericCols) {
    if (!isPlaceholderChartHeader(trimmed[c])) continue;
    trimmed[c] = numericCols.length === 1 ? "Value" : `Metric ${(metricN += 1)}`;
  }

  return trimmed;
}

// ─── X-axis prop builder ──────────────────────────────────────────────────────
/**
 * Build Recharts XAxis props (tick density, angle, height, padding) from labels.
 * Theme is injected: `axisTextColor` and `fontFamily` keep this style-free.
 */
export function buildXAxisProps(
  labels: string[],
  isPortrait: boolean,
  descSize = 18,
  forceAllLabels = false,
  chartAreaPx = 0,
  opts?: { largerXTicks?: boolean; axisTextColor?: string; fontFamily?: string },
) {
  const n = labels.length;
  const maxLen = Math.max(0, ...labels.map((l) => (l || "").length));
  const largeXTicks = !!opts?.largerXTicks;
  // Neutral fallbacks — every real caller injects its own theme, so these only
  // apply if a renderer forgets to pass axisTextColor / fontFamily.
  const axisTextColor = opts?.axisTextColor ?? "currentColor";
  const fontFamily = opts?.fontFamily ?? "monospace";

  const tight     = n >= 8  || maxLen >= 9;
  const dense     = n >= 12 || maxLen >= 11;
  const veryDense = n >= 16 || maxLen >= 14;
  const ultraDense = forceAllLabels && (n >= 20 || maxLen >= 16);

  const effectiveDense     = dense     || (forceAllLabels && tight);
  const effectiveVeryDense = veryDense || (forceAllLabels && dense);

  const scale = Math.min(descSize, largeXTicks ? 32 : 24) / 24;
  let tickSzBase = Math.round(scale * (
    ultraDense       ? (isPortrait ? 9 : 8)
    : effectiveVeryDense ? (isPortrait ? 10 : 9)
    : effectiveDense     ? (isPortrait ? 11 : 10)
    : tight              ? (isPortrait ? 12 : 11)
    :                      (isPortrait ? 14 : 13)
  ));
  if (largeXTicks) {
    tickSzBase = Math.max(tickSzBase + 3, Math.round(tickSzBase * 1.18));
  }

  const angle = ultraDense ? -65 : effectiveVeryDense ? -58 : effectiveDense ? -48 : tight ? -35 : 0;
  const angled = angle !== 0;

  const CHAR_RATIO = 0.58;
  const effectiveAreaPx = (chartAreaPx > 0 ? chartAreaPx : 600);
  const slotPx = effectiveAreaPx / Math.max(n, 1);
  const cosAngle = Math.abs(Math.cos((angle * Math.PI) / 180));
  const divisor = maxLen * CHAR_RATIO * (cosAngle > 0.05 ? cosAngle : 1);
  const maxFsBySlot = divisor > 0 ? Math.floor(slotPx / divisor) : tickSzBase;
  const tickMin = largeXTicks ? 12 : 7;
  const tickSz = Math.max(tickMin, Math.min(tickSzBase, maxFsBySlot));

  let height = ultraDense
    ? Math.round((isPortrait ? 148 : 130) * 0.85)
    : effectiveVeryDense
      ? Math.round((isPortrait ? 148 : 132) * 0.78)
      : effectiveDense
        ? Math.round((isPortrait ? 136 : 120) * 0.78)
        : tight
          ? Math.round((isPortrait ? 118 : 102) * 0.78)
          : (isPortrait ? 50 : 42);
  if (largeXTicks && angled) {
    height = Math.round(height * 1.1);
  }

  const minTickGap = forceAllLabels ? 0 : effectiveVeryDense ? 1 : effectiveDense ? 2 : tight ? 4 : 5;
  const interval: number | "preserveStartEnd" = forceAllLabels ? 0 : (n <= 10 ? 0 : n <= 14 ? 1 : n <= 18 ? 2 : 3);

  return {
    interval,
    minTickGap,
    tick: {
      fill: axisTextColor,
      fontSize: tickSz,
      fontWeight: 400,
      fontFamily,
    },
    angle,
    textAnchor: angled ? ("end" as const) : ("middle" as const),
    height,
    tickMargin: (ultraDense || effectiveVeryDense) ? 10 : effectiveDense ? 12 : tight ? 14 : 12,
    padding: angled
      ? { left: (ultraDense || effectiveVeryDense) ? 28 : 22, right: (ultraDense || effectiveVeryDense) ? 40 : 36 }
      : { left: isPortrait ? 30 : 28, right: isPortrait ? 36 : 34 },
  };
}

// ─── Table parsing ────────────────────────────────────────────────────────────
export function hasTimeLikeLabels(labels: string[]): boolean {
  if (labels.length < 2) return false;
  const re =
    /(^\d{4}-\d{2}-\d{2}$)|(^q[1-4](\s*\d{2,4})?$)|(^\d{4}$)|(^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$)|(^((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(uary|ruary|ch|il|e|y|ust|tember|ober|ember)?)(\.|\s+|-|\/)\d{2,4}$)|(^((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(uary|ruary|ch|il|e|y|ust|tember|ober|ember)?)(\b|[./-]\d{2,4}|\s+\d{2,4})$)/i;
  return labels.some((l) => re.test(l.trim()));
}

export function hasBucketLikeLabels(labels: string[]): boolean {
  if (labels.length < 3) return false;
  return labels.some((l) => /(^\d+\s*[-–]\s*\d+$)|(^<\s*\d+$)|(^>\s*\d+$)|(^\d+\+$)/.test(l.trim()));
}

export function deriveFromTable(chartTable: ChartTableShape | undefined): Partial<ChartInputs> {
  let rows = chartTable?.rows ?? [];
  if (!Array.isArray(rows) || rows.length < 1) return {};
  let headers = (chartTable?.headers ?? []).map((h) => String(h ?? "").trim());

  const allSynthetic = headers.length > 0 && headers.every((h) => /^col_\d+$/i.test(h));
  if (allSynthetic && rows.length > 0) {
    const cand = (rows[0] ?? []).map((c) => String(c ?? "").trim());
    const numericCells = cand.filter(Boolean).filter((c) => toNumber(c) !== null).length;
    if (cand.filter(Boolean).length >= 2 && numericCells <= Math.max(1, Math.floor(cand.filter(Boolean).length / 3))) {
      headers = cand;
      rows = rows.slice(1);
      if (rows.length < 1) return {};
    }
  }

  const colCount = Math.max(...rows.map((r) => (Array.isArray(r) ? r.length : 0)));
  if (colCount < 2) return {};

  if (rows.length > CHART_MAX_ROWS) {
    rows = rows.slice(0, CHART_MAX_ROWS);
  }

  const col0Vals = rows.map((r) => String((r as string[])?.[0] ?? "").trim());
  const col0AllNumeric = col0Vals.length > 0 && col0Vals.every((v) => v && toNumber(v) !== null);
  const col1Vals = colCount >= 2 ? rows.map((r) => String((r as string[])?.[1] ?? "").trim()) : [];
  const col1Textual = col1Vals.length > 0 && col1Vals.filter((v) => v && toNumber(v) === null).length >= Math.ceil(col1Vals.length * 0.6);
  const rankLikeCol0 = col0AllNumeric && col1Textual;
  const labelColIdx = rankLikeCol0 ? 1 : 0;
  headers = ensureChartHeaders(headers, colCount, labelColIdx);

  const labels: string[] = [];
  const numericCols: number[][] = Array.from({ length: colCount }, () => []);

  rows.forEach((row) => {
    if (!Array.isArray(row) || row.length < 2) return;
    labels.push(String(row[labelColIdx] ?? "").trim() || `${labels.length + 1}`);
    for (let c = 0; c < colCount; c++) {
      if (c === labelColIdx) continue;
      const num = toNumber((row[c] as string | number | undefined) ?? "");
      numericCols[c].push(num ?? Number.NaN);
    }
  });

  // Raw (untrimmed of per-row) cell strings per column, to judge whether a column
  // is genuinely numeric vs. a unit/text column whose cells only yield stray digits.
  const rawColCells: string[][] = Array.from({ length: colCount }, () => []);
  rows.forEach((row) => {
    if (!Array.isArray(row) || row.length < 2) return;
    for (let c = 0; c < colCount; c++) {
      if (c === labelColIdx) continue;
      rawColCells[c].push(String((row as Array<string | number>)[c] ?? "").trim());
    }
  });

  const seriesWithMeta = numericCols
    .map((values, idx) => ({
      colIdx: idx,
      label: String(headers[idx] ?? "").trim(),
      values: values.map((v) => (Number.isFinite(v) ? v : Number.NaN)),
    }))
    .filter((s) => {
      if (s.colIdx === labelColIdx) return false;
      if (rankLikeCol0 && s.colIdx === 0) return false;
      // A real metric column is predominantly *strictly* numeric. Reject unit/text
      // columns (e.g. "BBL/D/1K", "Thousand Barrels Per Day") whose cells only yield
      // stray digits via the lenient fallback — otherwise they become a phantom
      // series and a single NaN collapses the axis.
      const cells = rawColCells[s.colIdx].filter((c) => c.length > 0);
      if (cells.length === 0) return false;
      const strictNumeric = cells.filter((c) => STRICT_NUMERIC_RE.test(c)).length;
      return strictNumeric >= Math.ceil(cells.length * 0.6);
    });

  const validSeries = seriesWithMeta
    .map(({ colIdx, label, values }) => ({
      label: (label || String(headers[colIdx] ?? "")).trim(),
      values,
    }))
    .filter((s) => s.label.length > 0)
    .slice(0, 3);

  const primary = seriesWithMeta[0]?.values ?? [];
  const barRows = labels.map((label, i) => ({
    label,
    value: Number.isFinite(primary[i]) ? primary[i] : 0,
  }));

  return { labels, lineSeries: validSeries, barRows, histogramRows: barRows };
}

export function abbreviateDenseTimeLabels(labels: string[]): string[] {
  if (labels.length < 7) return labels;
  const DATE_WITH_YEAR = /^([A-Za-z]{3,9}\.?\s+\d{1,2}),?\s+\d{2,4}$/;
  return labels.map((l) => {
    const s = l.trim();
    const m = DATE_WITH_YEAR.test(s) ? s.match(/^([A-Za-z]{3,9}\.?\s+\d{1,2})/) : null;
    return m ? m[1] : l;
  });
}

export function resolveChartInputs(chartTable: ChartTableShape | undefined): ChartInputs {
  const t = deriveFromTable(chartTable);
  const rawLabels = (t.labels ?? []).map((l) => String(l ?? "").trim());
  const labels = abbreviateDenseTimeLabels(rawLabels);
  return {
    labels,
    lineSeries: t.lineSeries ?? [],
    barRows: t.barRows ?? [],
    histogramRows: t.histogramRows ?? [],
  };
}

export function selectChartType(
  requested: "auto" | "line" | "bar" | "histogram" | undefined,
  inputs: ChartInputs,
): ChartKind {
  const raw = requested == null ? "" : String(requested).trim().toLowerCase();
  const explicit =
    raw === "line" || raw === "bar" || raw === "histogram" ? raw : null;
  if (explicit) return explicit;
  if (inputs.labels.length >= 2 && hasTimeLikeLabels(inputs.labels)) return "line";
  if (inputs.labels.length >= 3 && hasBucketLikeLabels(inputs.labels)) return "histogram";
  return "bar";
}

export function parseBucketSortKey(label: string): number | null {
  const s = label.trim();
  const range = s.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (range) return parseFloat(range[1]);
  const lt = s.match(/^<\s*(\d+(?:\.\d+)?)/);
  if (lt) return parseFloat(lt[1]) - 1e6;
  const gt = s.match(/^>=\s*(\d+(?:\.\d+)?)|^>\s*(\d+(?:\.\d+)?)|^≥\s*(\d+(?:\.\d+)?)/);
  if (gt) {
    const num = parseFloat(gt[1] || gt[2] || gt[3] || "");
    if (Number.isFinite(num)) return num + 1e6;
  }
  const plus = s.match(/^(\d+(?:\.\d+)?)\s*\+/);
  if (plus) return parseFloat(plus[1]);
  return null;
}

const MONTH_ENTRIES = Object.entries({
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}).sort((a, b) => b[0].length - a[0].length);

export function parseTimeSortKey(label: string): number | null {
  const s = label.trim().toLowerCase();

  const iso = label.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = parseInt(iso[1], 10);
    const m = parseInt(iso[2], 10) - 1;
    const d = parseInt(iso[3], 10);
    return y * 372 + m * 31 + d;
  }

  const dmy = label.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10) - 1;
    const y = parseInt(dmy[3], 10);
    if (month >= 0 && month < 12 && day >= 1 && day <= 31) {
      return y * 372 + month * 31 + day;
    }
  }

  const yOnly = s.match(/^(\d{4})$/);
  if (yOnly) return parseInt(yOnly[1], 10) * 372;
  const q = s.match(/^q([1-4])(?:\s+(\d{2,4}))?$/i);
  if (q) {
    const qi = parseInt(q[1], 10) - 1;
    let year = q[2] ? parseInt(q[2], 10) : 0;
    if (q[2] && q[2].length === 2) year += 2000;
    return year * 372 + qi * 93;
  }
  for (const [name, monthIdx] of MONTH_ENTRIES) {
    if (new RegExp(`\\b${name}\\b`).test(s)) {
      const y4 = s.match(/(\d{4})/);
      const y2 = s.match(/\b(\d{2})\b/);
      let year = 0;
      if (y4) year = parseInt(y4[1], 10);
      else if (y2) year = 2000 + parseInt(y2[1], 10);
      return year * 372 + monthIdx * 31 + 15;
    }
  }
  return null;
}

export function permuteChartInputs(inputs: ChartInputs, indices: number[]): ChartInputs {
  const labels = indices.map((i) => inputs.labels[i]!);
  const barRows = indices.map((i) => inputs.barRows[i]!);
  const histogramRows = indices.map((i) => inputs.histogramRows[i]!);
  const lineSeries = inputs.lineSeries.map((s) => ({
    label: s.label,
    values: indices.map((i) => (i < s.values.length ? s.values[i]! : Number.NaN)),
  }));
  return { labels, lineSeries, barRows, histogramRows };
}

export function orientChartInputsForType(inputs: ChartInputs, kind: ChartKind): ChartInputs {
  const n = inputs.labels.length;
  if (n <= 1 || kind === "bar") return inputs;

  const indices = Array.from({ length: n }, (_, i) => i);

  if (kind === "histogram") {
    indices.sort((a, b) => {
      const ka = parseBucketSortKey(inputs.labels[a]!);
      const kb = parseBucketSortKey(inputs.labels[b]!);
      if (ka != null && kb != null && ka !== kb) return ka - kb;
      if (ka != null && kb == null) return -1;
      if (ka == null && kb != null) return 1;
      return a - b;
    });
  } else {
    indices.sort((a, b) => {
      const ka = parseTimeSortKey(inputs.labels[a]!);
      const kb = parseTimeSortKey(inputs.labels[b]!);
      if (ka != null && kb != null && ka !== kb) return ka - kb;
      if (ka != null && kb == null) return -1;
      if (ka == null && kb != null) return 1;
      return a - b;
    });
  }

  return permuteChartInputs(inputs, indices);
}

export function filterBarChartNonNegativeRows(inputs: ChartInputs): ChartInputs {
  const multi = inputs.lineSeries.length >= 2;
  const n = inputs.labels.length;
  const keep: number[] = [];
  for (let i = 0; i < n; i += 1) {
    if (multi) {
      let hasNeg = false;
      for (const s of inputs.lineSeries) {
        const v = s.values[i];
        if (Number.isFinite(v) && v < 0) {
          hasNeg = true;
          break;
        }
      }
      if (!hasNeg) keep.push(i);
    } else {
      const v = inputs.barRows[i]?.value;
      if (!Number.isFinite(v) || v >= 0) keep.push(i);
    }
  }
  if (keep.length === n) return inputs;
  return permuteChartInputs(inputs, keep);
}

export function buildYAxisTickOverride(
  rawLabels: string[],
  domainLow: number,
  domainHigh: number,
  zeroBased: boolean,
): { ticks: number[]; tickFormatter: (v: number) => string; domain: [number, number] } {
  const parsed = rawLabels.map((r) => ({ raw: r, num: toNumber(r) }));
  const numeric = parsed.filter((p): p is { raw: string; num: number } => p.num !== null);

  if (numeric.length >= 2) {
    const sorted = [...numeric].sort((a, b) => a.num - b.num);
    const tickVals = sorted.map((x) => x.num);
    const lowFromTicks = Math.min(...tickVals);
    const highFromTicks = Math.max(...tickVals);
    let low = Math.min(domainLow, lowFromTicks);
    let high = Math.max(domainHigh, highFromTicks);
    if (zeroBased) low = Math.min(0, low);
    const fmt = (v: number) => {
      const hit = sorted.find((x) => Math.abs(x.num - v) < 1e-6);
      return hit ? hit.raw : formatAxisTick(v);
    };
    return { ticks: tickVals, tickFormatter: fmt, domain: [low, high] };
  }

  const n = rawLabels.length;
  const span = domainHigh - domainLow;
  const step = n <= 1 ? 0 : span / (n - 1);
  const positionsDesc = Array.from({ length: n }, (_, i) => domainHigh - i * step);
  const positionsAsc = [...positionsDesc].sort((a, b) => a - b);
  const labelsAsc = rawLabels.map((_, i) => rawLabels[rawLabels.length - 1 - i]!);
  const fmt = (v: number) => {
    const idx = positionsAsc.findIndex((pos) => Math.abs(pos - v) < 1e-6);
    return idx >= 0 ? labelsAsc[idx]! : formatAxisTick(v);
  };
  let low = domainLow;
  let high = domainHigh;
  if (zeroBased) low = Math.min(0, low);
  return { ticks: positionsAsc, tickFormatter: fmt, domain: [low, high] };
}

export function buildAutoChartSummary(inputs: ChartInputs, chartKind: ChartKind): string {
  const primary = inputs.lineSeries[0];
  if (chartKind === "line" && primary && primary.values.length >= 2) {
    const a = primary.values[0]!;
    const b = primary.values[primary.values.length - 1]!;
    const pct = a !== 0 ? ((b - a) / Math.abs(a)) * 100 : 0;
    const trend = b > a ? "rose" : b < a ? "fell" : "held flat";
    return (
      `${primary.label} ${trend} from ${formatCompact1dp(a)} to ${formatCompact1dp(b)} ` +
      `(${Math.abs(pct).toFixed(1)}% over ${inputs.labels.length} periods).`
    );
  }
  if (chartKind === "line" && primary && primary.values.length === 1) {
    return `${primary.label}: ${formatCompact1dp(primary.values[0]!)}.`;
  }
  const rows = chartKind === "histogram" ? inputs.histogramRows : inputs.barRows;
  if ((chartKind === "bar" || chartKind === "histogram") && rows.length >= 1) {
    const vals = rows.map((r) => r.value);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const peak = rows.find((r) => r.value === hi);
    const kind = chartKind === "histogram" ? "Distribution" : "Series";
    const multiHist =
      chartKind === "histogram" && inputs.lineSeries.length >= 2 ? ` (${inputs.lineSeries.length} series)` : "";
    return `${kind}${multiHist} spans ${formatCompact1dp(lo)}–${formatCompact1dp(hi)}; high at ${peak?.label ?? "—"}.`;
  }
  return "";
}

// ─── Animation easing ─────────────────────────────────────────────────────────
export function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

/** Clamped 0→1 progress for an animation starting at `start`, lasting `dur` frames. */
export function clampProgressAt(frame: number, start: number, dur: number): number {
  if (dur <= 0) return frame >= start ? 1 : 0;
  return Math.max(0, Math.min(1, (frame - start) / dur));
}
