import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ReferenceLine,
  ReferenceDot,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { NewscastChartRow, NewscastChartType, NewscastLayoutProps } from "./types";
import { NewsCastLayoutImageBackground } from "../NewsCastLayoutImageBackground";
import {
  DEFAULT_NEWSCAST_ACCENT,
  DEFAULT_NEWSCAST_TEXT,
  getNewscastPortraitTypeScale,
  newscastFont,
  scaleNewscastPx,
} from "../themeUtils";

const COLORS = {
  blue: "#1E5FD4",
  gold: "#D4AA50",
  green: "#3CE46A",
  red: "#FF3B30",
  steel: "#B8C8E0",
  grid: "rgba(255,255,255,0.08)",
};
const DEFAULT_BAR_SERIES_COLORS = [COLORS.red, COLORS.blue, COLORS.red] as const;
const AXIS_TEXT_STROKE = "rgba(8,20,46,0.92)";
const VALUE_TEXT_STROKE = "rgba(8,20,46,0.9)";
const VALUE_LABEL_FONT_WEIGHT = 900;
const VALUE_LABEL_FONT_SIZE = 12;
const COMPARISON_VALUE_LABEL_FONT_SIZE = 11;

type ResolvedChartType = Exclude<NewscastChartType, "auto">;

interface ParsedDataset {
  label: string;
  values: number[];
}

interface ResolvedChartInputs {
  labels: string[];
  lineSeries: ParsedDataset[];
  barRows: NewscastChartRow[];
  histogramRows: NewscastChartRow[];
  explicitLineProvided?: boolean;
}

const STRICT_NUMERIC_CELL_RE =
  /^\s*\(?\s*[+\-]?\$?\s*\d[\d,]*(?:\.\d+)?\s*(?:%|[a-z]{1,12})?\s*\)?\s*$/i;

function toNumber(value: string | number | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = (value ?? "").toString().trim();
  if (!raw) return null;
  if (STRICT_NUMERIC_CELL_RE.test(raw)) {
    const negativeByParens = raw.startsWith("(") && raw.endsWith(")");
    const parsed = Number(raw.replace(/[^0-9.\-]/g, ""));
    if (!Number.isFinite(parsed)) return null;
    return negativeByParens ? -Math.abs(parsed) : parsed;
  }

  // Fallback for values like "~$2,900", "$3,100+", "INR1,69,349", "~INR1,30,000".
  const compact = raw
    .replace(/[~≈]/g, "")
    .replace(/\+/g, "")
    .replace(/,/g, "")
    .trim();
  const token = compact.match(/-?\d*\.?\d+/)?.[0];
  if (!token) return null;
  const parsed = Number(token);
  if (!Number.isFinite(parsed)) return null;
  const negativeByParens = raw.startsWith("(") && raw.endsWith(")");
  return negativeByParens ? -Math.abs(parsed) : parsed;
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString("en-US") : "0";
}

function formatAxisTick(value: number): string {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function formatCompactNumber1dp(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(1);
}

function formatBarValueLabel(value: unknown, compact = false): string {
  const n = toNumber(value as string | number | undefined);
  if (n === null) return "";
  return compact ? formatCompactNumber1dp(n) : n.toFixed(1);
}

function formatLineValueLabel(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return formatCompactNumber1dp(Number(value));
}

function getAxisUpperBound(maxValue: number): number {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return 1;
  const padded = maxValue * 1.12;
  const magnitude = Math.pow(10, Math.floor(Math.log10(padded)));
  const step = magnitude / 2;
  return Math.ceil(padded / step) * step;
}

function normalizeOptionalHex(input: string | undefined, fallback: string): string {
  if (!input) return fallback;
  const value = input.trim();
  return /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(value) ? value : fallback;
}

function getSeriesTrendColor(
  values: number[] | undefined,
  upColor: string,
  downColor: string,
  flatColor: string,
): string {
  if (!values || values.length < 2) return flatColor;
  const first = values.find((v) => Number.isFinite(v));
  const last = [...values].reverse().find((v) => Number.isFinite(v));
  if (first == null || last == null) return flatColor;
  if (last < first) return downColor;
  if (last > first) return upColor;
  return flatColor;
}

function ensureDistinctPrimaryLineColor(
  preferredColor: string,
  firstLineColor: string,
  upColor: string,
  downColor: string,
): string {
  if (preferredColor !== firstLineColor) return preferredColor;
  if (firstLineColor === upColor) return downColor;
  if (firstLineColor === downColor) return upColor;
  return downColor;
}

function buildXAxisProps(labels: string[], isPortrait: boolean, textScale: number) {
  const maxLabelLen = Math.max(0, ...labels.map((l) => (l || "").length));
  const crowded = labels.length >= 10 || maxLabelLen >= 10;
  const safeScale = Math.max(0.9, Math.min(1.25, textScale));
  // Keep chart geometry stable; only nudge spacing when text size changes.
  const spacingScale = Math.max(0.94, Math.min(1.14, 1 + (textScale - 1) * 0.3));
  return {
    interval: 0 as const,
    minTickGap: isPortrait ? 6 : 4,
    tick: {
      fill: "#FFFFFF",
      fontSize: Math.round((isPortrait ? (crowded ? 12 : 14) : (crowded ? 10 : 12)) * safeScale),
      fontWeight: 900,
      stroke: AXIS_TEXT_STROKE,
      strokeWidth: isPortrait ? 1.25 : 0.95,
      paintOrder: "stroke",
    },
    angle: crowded ? -35 : 0,
    textAnchor: crowded ? ("end" as const) : ("middle" as const),
    height: Math.round((crowded ? (isPortrait ? 98 : 84) : (isPortrait ? 44 : 34)) * spacingScale),
    tickMargin: Math.round((crowded ? (isPortrait ? 16 : 13) : (isPortrait ? 11 : 8)) * spacingScale),
    padding: crowded
      ? {
          left: Math.round((isPortrait ? 28 : 22) * spacingScale),
          right: Math.round((isPortrait ? 28 : 22) * spacingScale),
        }
      : {
          left: Math.round((isPortrait ? 16 : 12) * spacingScale),
          right: Math.round((isPortrait ? 16 : 12) * spacingScale),
        },
  };
}

function parseRows(rows: NewscastChartRow[] | undefined): NewscastChartRow[] {
  return (rows ?? []).filter((row) => row && String(row.label ?? "").trim().length > 0);
}

function parseLineSeries(
  labels: string[] | undefined,
  datasets: NewscastLayoutProps["lineChartDatasets"],
): ParsedDataset[] {
  const parsed = (datasets ?? [])
    .slice(0, 3)
    .map((dataset, index) => ({
      label: (dataset?.label || `Series ${index + 1}`).trim(),
      values: String(dataset?.valuesStr ?? "")
        .split(",")
        .map((v) => toNumber(v.trim()))
        .filter((v): v is number => v !== null),
    }))
    .filter((series) => series.values.length >= 2);

  if (parsed.length === 0) return [];
  if (!labels || labels.length === 0) return parsed;
  return parsed.map((series) => ({ ...series, values: series.values.slice(0, labels.length) }));
}

function hasTimeLikeLabels(labels: string[]): boolean {
  if (labels.length < 2) return false;
  const timeLikeRe =
    /(^q[1-4](\s*\d{2,4})?$)|(^\d{4}$)|(^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$)|(^\d{1,2}[/-](jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t|tember)?|oct(ober)?|nov(ember)?|dec(ember)?)([/-]\d{2,4})?$)|(^((jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t|tember)?|oct(ober)?|nov(ember)?|dec(ember)?)[/-]\d{1,2}([/-]\d{2,4})?)$)|(^((jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t|tember)?|oct(ober)?|nov(ember)?|dec(ember)?)(\b|[./-]\d{2,4}|\s+\d{2,4}))$)/i;
  return labels.some((label) =>
    timeLikeRe.test(label.trim()),
  );
}

function hasBucketLikeLabels(labels: string[]): boolean {
  if (labels.length < 3) return false;
  return labels.some((label) =>
    /(^\d+\s*[-–]\s*\d+$)|(^<\s*\d+$)|(^>\s*\d+$)|(^\d+\+$)/.test(label.trim()),
  );
}

function deriveFromTable(chartTable: NewscastLayoutProps["chartTable"]): Partial<ResolvedChartInputs> {
  let rows = chartTable?.rows ?? [];
  if (!Array.isArray(rows) || rows.length < 1) return {};
  let headers = (chartTable?.headers ?? []).map((h) => String(h ?? "").trim());

  const hasOnlySyntheticHeaders = headers.length > 0
    && headers.every((h) => /^col_\d+$/i.test(h));
  if (hasOnlySyntheticHeaders && rows.length > 0) {
    const candidate = (rows[0] ?? []).map((c) => String(c ?? "").trim());
    const nonEmpty = candidate.filter(Boolean);
    const numericCells = nonEmpty.filter((cell) => toNumber(cell) !== null).length;
    const looksLikeHeader = nonEmpty.length >= Math.max(2, Math.floor(candidate.length / 2))
      && numericCells <= Math.max(1, Math.floor(nonEmpty.length / 3));
    if (looksLikeHeader) {
      headers = candidate;
      rows = rows.slice(1);
      if (rows.length < 1) return {};
    }
  }

  const colCount = Math.max(...rows.map((r) => (Array.isArray(r) ? r.length : 0)));
  if (colCount < 2) return {};

  const labels: string[] = [];
  const numericColumns: number[][] = Array.from({ length: colCount - 1 }, () => []);

  rows.forEach((row) => {
    if (!Array.isArray(row) || row.length < 2) return;
    labels.push(String(row[0] ?? "").trim() || `${labels.length + 1}`);
    for (let c = 1; c < colCount; c += 1) {
      const numeric = toNumber((row[c] as string | number | undefined) ?? "");
      numericColumns[c - 1].push(numeric ?? Number.NaN);
    }
  });

  const validSeries = numericColumns
    .map((values, index) => ({
      label: headers[index + 1] || `Series ${index + 1}`,
      values: values.filter((value) => Number.isFinite(value)),
    }))
    .filter((series) => series.values.length >= 2)
    .slice(0, 3);

  const primaryColumn = numericColumns[0] ?? [];
  const barRows: NewscastChartRow[] = labels.map((label, index) => ({
    label,
    value: Number.isFinite(primaryColumn[index]) ? primaryColumn[index] : 0,
  }));

  return {
    labels,
    lineSeries: validSeries,
    barRows,
    histogramRows: barRows,
  };
}

function resolveChartInputs(chartTable: NewscastLayoutProps["chartTable"]): ResolvedChartInputs {
  const tableInputs = deriveFromTable(chartTable);
  const labels = (tableInputs.labels ?? []).map((label) => String(label ?? "").trim());

  return {
    labels,
    lineSeries: tableInputs.lineSeries ?? [],
    barRows: tableInputs.barRows ?? [],
    histogramRows: tableInputs.histogramRows ?? [],
    explicitLineProvided: false,
  };
}

function selectChartType(
  requested: NewscastChartType | undefined,
  inputs: ResolvedChartInputs,
): ResolvedChartType {
  const explicit = requested && requested !== "auto" ? requested : null;
  if (explicit) return explicit;
  return "bar";
}

export const DataVisualization: React.FC<NewscastLayoutProps> = (props) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const portraitScale = getNewscastPortraitTypeScale(width, height);
  const isNarrow = width < 980;
  const isPortrait = height > width;
  const p = isPortrait;
  const { titleFontSize, descriptionFontSize } = props;

  const chartInputs = useMemo(() => resolveChartInputs(props.chartTable), [props.chartTable]);
  const chartType = useMemo(
    () => selectChartType(props.chartType, chartInputs),
    [props.chartType, chartInputs],
  );

  const primarySeries = chartInputs.lineSeries[0]?.values ?? [];
  const fallbackValues = primarySeries.length > 0
    ? primarySeries
    : chartInputs.barRows.map((row) => toNumber(row.value) ?? 0);
  const first = fallbackValues[0] ?? 0;
  const last = fallbackValues[fallbackValues.length - 1] ?? first;
  const computedDown = last < first;
  const trendDown = computedDown;
  const lineUpColor = normalizeOptionalHex(props.lineUpColor, COLORS.green);
  const lineDownColor = normalizeOptionalHex(props.lineDownColor, COLORS.red);
  const lineFlatColor = COLORS.blue;
  const trendColor = last < first ? lineDownColor : (last > first ? lineUpColor : lineFlatColor);
  const s0LineColor = getSeriesTrendColor(
    chartInputs.lineSeries[0]?.values,
    lineUpColor,
    lineDownColor,
    lineFlatColor,
  );
  const s1PreferredColor = getSeriesTrendColor(
    chartInputs.lineSeries[1]?.values,
    lineUpColor,
    lineDownColor,
    lineFlatColor,
  );
  const s1LineColor = ensureDistinctPrimaryLineColor(
    s1PreferredColor,
    s0LineColor,
    lineUpColor,
    lineDownColor,
  );
  const s2LineColor =
    chartInputs.lineSeries.length >= 3
      ? COLORS.blue
      : getSeriesTrendColor(chartInputs.lineSeries[2]?.values, lineUpColor, lineDownColor, lineFlatColor);
  const barSeriesColors = [
    normalizeOptionalHex(props.barPrimaryColor, DEFAULT_BAR_SERIES_COLORS[0]),
    normalizeOptionalHex(props.barSecondaryColor, DEFAULT_BAR_SERIES_COLORS[1]),
    normalizeOptionalHex(props.barTertiaryColor, DEFAULT_BAR_SERIES_COLORS[2]),
  ] as const;
  const defaultBarColor = barSeriesColors[0];
  const resolvedTitleSize = titleFontSize ?? (p ? 46 : 34);
  const resolvedDescSize = descriptionFontSize ?? (p ? 30 : 25);
  const rawTitleTextScale = resolvedTitleSize / (p ? 46 : 34);
  const rawBodyTextScale = resolvedDescSize / (p ? 30 : 25);
  const titleTextScale = Math.max(0.78, Math.min(1.6, rawTitleTextScale));
  const bodyTextScale = Math.max(0.85, Math.min(1.55, rawBodyTextScale));
  const rawChartTextScale = bodyTextScale;
  const chartTextScale = Math.max(0.9, Math.min(1.25, rawChartTextScale));
  const steel = props.textColor || DEFAULT_NEWSCAST_TEXT;
  const resolvedYAxisLabel = (props.yAxisLabel || props.chartTable?.headers?.[1] || "").trim();
  const hasYAxisLabel = resolvedYAxisLabel.length > 0;
  const yAxisTickStyle = useMemo(
    () => ({
      fill: isPortrait ? "#FFFFFF" : steel,
      fontSize: Math.round((isPortrait ? 13 : 11) * chartTextScale),
      fontWeight: 900,
      stroke: AXIS_TEXT_STROKE,
      strokeWidth: isPortrait ? 1.25 : 0.95,
      paintOrder: "stroke",
    }),
    [isPortrait, steel, chartTextScale],
  );
  const yAxisLabelProp = resolvedYAxisLabel
    ? {
        value: resolvedYAxisLabel,
        angle: -90 as const,
        position: "left" as const,
        offset: isPortrait ? 10 : 8,
        style: {
          fill: "rgba(255,255,255,0.92)",
          fontSize: Math.round(10 * chartTextScale),
          fontWeight: 800,
          textAnchor: "middle" as const,
        },
      }
    : undefined;
  const valueLabelFontSize = Math.round((isPortrait ? 13 : VALUE_LABEL_FONT_SIZE) * chartTextScale);
  const comparisonValueLabelFontSize = Math.round((isPortrait ? 12 : COMPARISON_VALUE_LABEL_FONT_SIZE) * chartTextScale);
  const valueLabelStrokeWidth = (isPortrait ? 1.2 : 0.9) * Math.max(1, chartTextScale * 0.9);

  const labels = chartInputs.labels.length > 0
    ? chartInputs.labels
    : chartInputs.barRows.map((row) => row.label);
  const maxLineLength = Math.max(0, ...chartInputs.lineSeries.map((series) => series.values.length));
  const lineSeriesDelayFrames = Math.max(12, Math.round(fps * 0.8));
  const lineDrawFrames = Math.max(54, Math.round(fps * 3.2));
  const effectiveBarCount = (() => {
    const hasComparison = chartInputs.lineSeries.length >= 2 && labels.length >= 2;
    if (hasComparison) {
      const seriesCount = Math.min(3, chartInputs.lineSeries.length);
      return labels.length * seriesCount;
    }
    if (chartType === "histogram") return chartInputs.histogramRows.length;
    return chartInputs.barRows.length;
  })();
  const barAnimBudget = Math.min(fps * 3.5, durationInFrames * 0.75);
  const barGrowFrames = Math.max(10, Math.min(Math.round(fps * 1.2), Math.round(barAnimBudget * 0.6)));
  const barStepFrames = effectiveBarCount > 1
    ? Math.max(3, Math.floor((barAnimBudget - barGrowFrames) / (effectiveBarCount - 1)))
    : barGrowFrames;
  const clampProgress = (startFrame: number, durationFrames: number) => {
    if (durationFrames <= 0) return frame >= startFrame ? 1 : 0;
    const progress = (frame - startFrame) / durationFrames;
    return Math.max(0, Math.min(1, progress));
  };
  const easeInCubic = (progress: number) => Math.pow(Math.max(0, Math.min(1, progress)), 3);
  function smoothValues(values: number[]): number[] {
    const n = values.length;
    if (n === 0) return [];

    const kernel = [0.0625, 0.25, 0.375, 0.25, 0.0625]; // Gaussian-like weights sum=1

    const pass = (src: number[]) => {
      const dst = new Array(n).fill(0);
      for (let i = 0; i < n; i += 1) {
        let acc = 0;
        let wsum = 0;
        for (let k = -2; k <= 2; k += 1) {
          const v = src[i + k];
          const w = kernel[k + 2];
          if (v != null && Number.isFinite(v)) {
            acc += v * w;
            wsum += w;
          }
        }
        dst[i] = wsum > 0 ? acc / wsum : src[i];
      }
      return dst;
    };

    // Two-pass smoothing reduces sharp corners without large phase shift
    const first = pass(values as number[]);
    const second = pass(first);
    return second;
  }

  const animateSeries = (values: number[], progress: number): Array<number | null> => {
    // Flow immediately and morph along the curve (no straight drop/rise).
    if (values.length === 0) return [];
    if (values.length === 1) return [values[0]];

    const clamped = Math.max(0, Math.min(1, progress));
    const target = smoothValues(values);
    if (clamped <= 0) return target.map(() => null);

    const headPos = clamped * (target.length - 1);
    const headIndex = Math.floor(headPos);
    const fraction = headPos - headIndex;

    return target.map((point, index) => {
      if (!Number.isFinite(point)) return null;
      if (index < headIndex) return point;
      if (index === headIndex) {
        let pi = index - 1;
        while (pi >= 0 && !Number.isFinite(target[pi])) pi -= 1;
        const previous = pi >= 0 ? target[pi] : point;
        return previous + (point - previous) * fraction;
      }
      return null;
    });
  };
  const rawP0 = clampProgress(0, lineDrawFrames);
  const easedP0 = easeInCubic(rawP0);
  const showDots0 = rawP0 >= 1;
  const animatedS0 = animateSeries(chartInputs.lineSeries[0]?.values ?? [], easedP0);
  const lineOpacity0 = rawP0;

  const rawP1 = clampProgress(lineSeriesDelayFrames, lineDrawFrames);
  const easedP1 = easeInCubic(rawP1);
  const showDots1 = rawP1 >= 1;
  const animatedS1 = animateSeries(chartInputs.lineSeries[1]?.values ?? [], easedP1);
  const lineOpacity1 = rawP1;

  const rawP2 = clampProgress(lineSeriesDelayFrames * 2, lineDrawFrames);
  const easedP2 = easeInCubic(rawP2);
  const showDots2 = rawP2 >= 1;
  const animatedS2 = animateSeries(chartInputs.lineSeries[2]?.values ?? [], easedP2);
  const lineOpacity2 = rawP2;
  const animatedLineData = Array.from({ length: maxLineLength }).map((_, index) => ({
    label: labels[index] ?? `${index + 1}`,
    s0: animatedS0[index] ?? null,
    s1: animatedS1[index] ?? null,
    s2: animatedS2[index] ?? null,
  }));
  const seriesKeys: Array<"s0" | "s1" | "s2"> = ["s0", "s1", "s2"];
  const seriesMagnitudes = chartInputs.lineSeries
    .map((series, index) => {
      const absValues = series.values
        .map((v) => Math.abs(v))
        .filter((v) => Number.isFinite(v) && v > 0);
      const avgMagnitude = absValues.length > 0
        ? absValues.reduce((sum, v) => sum + v, 0) / absValues.length
        : 0;
      return { key: seriesKeys[index], avgMagnitude };
    })
    .filter((x) => x.avgMagnitude > 0);
  let rightAxisSeriesKey: "s0" | "s1" | "s2" | null = null;
  if (seriesMagnitudes.length >= 2) {
    const magnitudes = seriesMagnitudes.map((x) => x.avgMagnitude);
    const minMag = Math.min(...magnitudes);
    const maxMag = Math.max(...magnitudes);
    if (minMag > 0 && maxMag / minMag >= 8) {
      rightAxisSeriesKey = seriesMagnitudes.sort((a, b) => b.avgMagnitude - a.avgMagnitude)[0].key;
    }
  }
  const hasDualAxis = rightAxisSeriesKey !== null;
  const axisForKey = (key: "s0" | "s1" | "s2") => (hasDualAxis && rightAxisSeriesKey === key ? "right" : "left");
  const getLastPoint = (dataset: Array<{ label: string; s0: number | null; s1: number | null; s2: number | null }>, key: "s0" | "s1" | "s2") => {
    for (let i = dataset.length - 1; i >= 0; i -= 1) {
      const point = dataset[i];
      const val = point[key];
      if (val != null && Number.isFinite(val)) {
        return { x: point.label, y: val as number };
      }
    }
    return null;
  };
  const lastS0 = getLastPoint(animatedLineData, "s0");
  const lastS1 = getLastPoint(animatedLineData, "s1");
  const lastS2 = getLastPoint(animatedLineData, "s2");
  const barData = chartInputs.barRows.map((row) => ({
    label: row.label,
    value: toNumber(row.value) ?? 0,
  }));
  const barDataMax = Math.max(0, ...barData.map((d) => Math.abs(d.value)));
  const animatedBarData = barData.map((row, index) => {
    const progress = easeInCubic(clampProgress(index * barStepFrames, barGrowFrames));
    return {
      ...row,
      value: row.value * progress,
    };
  });
  const comparisonBarData =
    chartInputs.lineSeries.length >= 2 && labels.length >= 2
      ? labels.map((label, index) => ({
          label,
          s0: chartInputs.lineSeries[0]?.values[index] ?? null,
          s1: chartInputs.lineSeries[1]?.values[index] ?? null,
          s2: chartInputs.lineSeries[2]?.values[index] ?? null,
          value: chartInputs.lineSeries[0]?.values[index] ?? 0,
        }))
      : [];
  const animatedComparisonBarData = comparisonBarData.map((row, index) => {
    const s0Progress = easeInCubic(clampProgress((index * 3 + 0) * barStepFrames, barGrowFrames));
    const s1Progress = easeInCubic(clampProgress((index * 3 + 1) * barStepFrames, barGrowFrames));
    const s2Progress = easeInCubic(clampProgress((index * 3 + 2) * barStepFrames, barGrowFrames));
    return {
      ...row,
      s0: row.s0 == null ? null : row.s0 * s0Progress,
      s1: row.s1 == null ? null : row.s1 * s1Progress,
      s2: row.s2 == null ? null : row.s2 * s2Progress,
      value: row.value * s0Progress,
    };
  });
  const hasComparisonBars = comparisonBarData.length > 0;
  const comparisonDataMax = Math.max(
    0,
    ...comparisonBarData.flatMap((row) => [row.s0 ?? 0, row.s1 ?? 0, row.s2 ?? 0]).map((v) => Math.abs(v)),
  );
  const histogramData = chartInputs.histogramRows.map((row) => ({
    label: row.label,
    value: toNumber(row.value) ?? 0,
  }));
  const histogramDataMax = Math.max(0, ...histogramData.map((d) => Math.abs(d.value)));
  const animatedHistogramData = histogramData.map((row, index) => {
    const progress = easeInCubic(clampProgress(index * barStepFrames, barGrowFrames));
    return {
      ...row,
      value: row.value * progress,
    };
  });
  const lineXAxisProps = buildXAxisProps(labels, isPortrait, chartTextScale);
  const barXAxisProps = buildXAxisProps(
    hasComparisonBars ? comparisonBarData.map((d) => d.label) : barData.map((d) => d.label),
    isPortrait,
    chartTextScale,
  );
  const histogramXAxisProps = buildXAxisProps(histogramData.map((d) => d.label), isPortrait, chartTextScale);
  const maxBottomMargin = isPortrait ? 64 : 52;
  const lineChartBottomMargin = Math.min(maxBottomMargin, Math.max(14, (lineXAxisProps.height ?? 34) - 18));
  const barChartBottomMargin = Math.min(maxBottomMargin, Math.max(14, (barXAxisProps.height ?? 34) - 18));
  const histogramChartBottomMargin = Math.min(maxBottomMargin, Math.max(14, (histogramXAxisProps.height ?? 34) - 18));
  const chartLeftMargin = hasYAxisLabel ? (isPortrait ? 44 : 36) : (isPortrait ? 10 : 4);
  const yAxisWidth = hasYAxisLabel ? 68 : 56;
  const barAxisTop = getAxisUpperBound(hasComparisonBars ? comparisonDataMax : barDataMax);
  const histogramAxisTop = getAxisUpperBound(histogramDataMax);
  const useCompactBarValueLabels =
    hasComparisonBars
    || barData.length >= 5
    || histogramData.length >= 5
    || barDataMax >= 10_000
    || comparisonDataMax >= 10_000
    || histogramDataMax >= 10_000;

  const symbol = props.marketSymbol || "MARKET COMPARISON";
  const valueLabel = props.marketValue || formatNumber(last);
  const deltaLabel =
    props.marketDelta || `${last - first >= 0 ? "+" : ""}${(last - first).toFixed(2)}`;
  const pctLabel =
    props.marketPercent ||
    `${first !== 0 ? (((last - first) / first) * 100 >= 0 ? "+" : "") : "+"}${first !== 0 ? (((last - first) / first) * 100).toFixed(2) : "0.00"}%`;
  const lowerTag = props.lowerThirdTag || "DATA DESK";
  const lowerHeadline = props.lowerThirdHeadline || props.title || "Live Comparison";
  const lowerSub = props.lowerThirdSub || props.narration || "Auto-selected chart from extracted table and numeric data";
  const ticker = (props.tickerItems?.filter(Boolean) ?? []).slice(0, 3);
  const red = props.accentColor || DEFAULT_NEWSCAST_ACCENT;

  return (
    <AbsoluteFill style={{ zIndex: 60, overflow: "hidden" }}>
      <NewsCastLayoutImageBackground imageUrl={props.imageUrl} accentColor={red} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: isNarrow ? "7% 4% 6% 6%" : "7% 6% 6% 6%",
          display: "flex",
          flexDirection: isPortrait ? "column" : "row",
          gap: isPortrait ? 12 : 18,
          zIndex: 1,
        }}
      >
        <div
          style={{
            flex: isPortrait ? "0 0 56%" : 1,
            background: "rgba(10,42,110,0.12)",
            borderRadius: 14,
            border: "1px solid rgba(200,220,255,0.20)",
            backdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            padding: isNarrow ? 16 : 18,
            boxShadow: "0 14px 44px rgba(0,0,0,0.18)",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: isPortrait ? 10 : 16 }}>
            {!isPortrait ? (
              <div>
                <div style={{ color: steel, fontFamily: newscastFont(props.fontFamily, "label"), fontSize: scaleNewscastPx(10 * bodyTextScale, portraitScale), fontWeight: 600, opacity: 0.95, letterSpacing: 4, textTransform: "uppercase" }}>
                  {symbol}
                </div>
                <div style={{ color: "white", fontFamily: newscastFont(props.fontFamily, "title"), fontSize: scaleNewscastPx(38 * titleTextScale, portraitScale), fontWeight: 800, lineHeight: 1 }}>
                  {valueLabel}
                </div>
                <div style={{ color: trendColor, fontFamily: newscastFont(props.fontFamily, "label"), fontSize: scaleNewscastPx(16 * bodyTextScale, portraitScale), fontWeight: 700 }}>
                  {deltaLabel} [{pctLabel}]
                </div>
              </div>
            ) : <div />}
            {chartType === "line" || (chartType === "bar" && hasComparisonBars) ? (
              <div style={{ display: "flex", gap: 12, marginLeft: "auto" }}>
                <LegendDot
                  color={chartType === "bar" ? barSeriesColors[0] : s0LineColor}
                  label={chartInputs.lineSeries[0]?.label || "Series 1"}
                  textScale={chartTextScale}
                />
                {chartInputs.lineSeries[1] ? (
                  <LegendDot
                    color={chartType === "bar" ? barSeriesColors[1] : s1LineColor}
                    label={chartInputs.lineSeries[1].label}
                    textScale={chartTextScale}
                  />
                ) : null}
                {chartInputs.lineSeries[2] ? (
                  <LegendDot
                    color={chartType === "bar" ? barSeriesColors[2] : s2LineColor}
                    label={chartInputs.lineSeries[2].label}
                    textScale={chartTextScale}
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          <div style={{ flex: 1, minHeight: isPortrait ? 220 : 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "line" ? (
                <ComposedChart data={animatedLineData} margin={{ top: 8, right: 12, left: chartLeftMargin, bottom: lineChartBottomMargin }}>
                  <defs>
                    <linearGradient id="newscast-line-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={s0LineColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={s0LineColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={COLORS.grid} vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} {...lineXAxisProps} />
                  <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={yAxisTickStyle}
                    width={yAxisWidth}
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => formatAxisTick(Number(v))}
                    label={yAxisLabelProp}
                  />
                  {hasDualAxis ? (
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      axisLine={false}
                      tickLine={false}
                      tick={yAxisTickStyle}
                      width={56}
                      domain={["auto", "auto"]}
                      tickFormatter={(v) => formatAxisTick(Number(v))}
                    />
                  ) : null}
                  <Area
                    yAxisId={axisForKey("s0")}
                    type="monotone"
                    dataKey="s0"
                    stroke={s0LineColor}
                    strokeWidth={3.2}
                    strokeOpacity={lineOpacity0}
                    fill="url(#newscast-line-fill)"
                    fillOpacity={0.32 * lineOpacity0}
                    isAnimationActive={false}
                    dot={showDots0 ? { r: 2.6, fill: "white", stroke: s0LineColor, strokeWidth: 1.6 } : false}
                    activeDot={false}
                  >
                    {showDots0 ? (
                      <LabelList
                        dataKey="s0"
                        position="top"
                        formatter={(value) => formatLineValueLabel(value as number | null | undefined)}
                        fill="white"
                        fontSize={valueLabelFontSize}
                        fontWeight={VALUE_LABEL_FONT_WEIGHT}
                        stroke={VALUE_TEXT_STROKE}
                        strokeWidth={valueLabelStrokeWidth}
                        paintOrder="stroke"
                      />
                    ) : null}
                  </Area>
                  {lastS0 ? (
                    <ReferenceLine
                      yAxisId={axisForKey("s0")}
                      y={lastS0.y}
                      stroke={s0LineColor}
                      strokeDasharray="3 4"
                      strokeOpacity={0.5}
                    />
                  ) : null}
                  {chartInputs.lineSeries[1] ? (
                    <Line
                      yAxisId={axisForKey("s1")}
                      type="monotone"
                      dataKey="s1"
                      stroke={s1LineColor}
                      strokeWidth={2}
                      strokeOpacity={lineOpacity1}
                      dot={showDots1 ? { r: 2.2, fill: "white", stroke: s1LineColor, strokeWidth: 1.2 } : false}
                      activeDot={false}
                      strokeDasharray="4 4"
                      isAnimationActive={false}
                    >
                      {showDots1 ? (
                        <LabelList
                          dataKey="s1"
                          position="top"
                          formatter={(value) => formatLineValueLabel(value as number | null | undefined)}
                          fill={s1LineColor}
                          fontSize={valueLabelFontSize}
                          fontWeight={VALUE_LABEL_FONT_WEIGHT}
                          stroke={VALUE_TEXT_STROKE}
                          strokeWidth={valueLabelStrokeWidth}
                          paintOrder="stroke"
                        />
                      ) : null}
                    </Line>
                  ) : null}
                  {lastS1 ? (
                    <ReferenceLine
                      yAxisId={axisForKey("s1")}
                      y={lastS1.y}
                      stroke={s1LineColor}
                      strokeDasharray="3 4"
                      strokeOpacity={0.45}
                    />
                  ) : null}
                  {chartInputs.lineSeries[2] ? (
                    <Line
                      yAxisId={axisForKey("s2")}
                      type="monotone"
                      dataKey="s2"
                      stroke={s2LineColor}
                      strokeWidth={2}
                      strokeOpacity={lineOpacity2}
                      dot={showDots2 ? { r: 2.2, fill: "white", stroke: s2LineColor, strokeWidth: 1.2 } : false}
                      activeDot={false}
                      isAnimationActive={false}
                    >
                      {showDots2 ? (
                        <LabelList
                          dataKey="s2"
                          position="top"
                          formatter={(value) => formatLineValueLabel(value as number | null | undefined)}
                          fill={s2LineColor}
                          fontSize={valueLabelFontSize}
                          fontWeight={VALUE_LABEL_FONT_WEIGHT}
                          stroke={VALUE_TEXT_STROKE}
                          strokeWidth={valueLabelStrokeWidth}
                          paintOrder="stroke"
                        />
                      ) : null}
                    </Line>
                  ) : null}
                  {showDots0 && lastS0 ? (
                    <ReferenceDot
                      yAxisId={axisForKey("s0")}
                      x={lastS0.x}
                      y={lastS0.y}
                      r={5}
                      fill="white"
                      stroke={s0LineColor}
                      strokeWidth={2.5}
                    />
                  ) : null}
                  {showDots1 && lastS1 ? (
                    <ReferenceDot
                      yAxisId={axisForKey("s1")}
                      x={lastS1.x}
                      y={lastS1.y}
                      r={4}
                      fill="white"
                      stroke={s1LineColor}
                      strokeWidth={2}
                    />
                  ) : null}
                  {showDots2 && lastS2 ? (
                    <ReferenceDot
                      yAxisId={axisForKey("s2")}
                      x={lastS2.x}
                      y={lastS2.y}
                      r={4}
                      fill="white"
                      stroke={s2LineColor}
                      strokeWidth={2}
                    />
                  ) : null}
                </ComposedChart>
              ) : chartType === "histogram" ? (
                <BarChart data={animatedHistogramData} margin={{ top: 8, right: 12, left: chartLeftMargin, bottom: histogramChartBottomMargin }}>
                  <CartesianGrid stroke={COLORS.grid} vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} {...histogramXAxisProps} />
                  <YAxis axisLine={false} tickLine={false} tick={yAxisTickStyle} width={yAxisWidth} domain={[0, histogramAxisTop]} label={yAxisLabelProp} />
                  <Bar
                    dataKey="value"
                    fill={defaultBarColor}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={42}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="value"
                      position="top"
                      fill="white"
                      fontSize={valueLabelFontSize}
                      fontWeight={VALUE_LABEL_FONT_WEIGHT}
                      stroke={VALUE_TEXT_STROKE}
                      strokeWidth={valueLabelStrokeWidth}
                      paintOrder="stroke"
                      formatter={(value) => formatBarValueLabel(value, useCompactBarValueLabels)}
                    />
                  </Bar>
                </BarChart>
              ) : (
                <BarChart
                  data={hasComparisonBars ? animatedComparisonBarData : animatedBarData}
                  margin={{ top: 8, right: 12, left: chartLeftMargin, bottom: barChartBottomMargin }}
                  barGap={hasComparisonBars ? 2 : 4}
                  barCategoryGap={hasComparisonBars ? "14%" : "20%"}
                >
                  <CartesianGrid stroke={COLORS.grid} vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} {...barXAxisProps} />
                  <YAxis axisLine={false} tickLine={false} tick={yAxisTickStyle} width={yAxisWidth} domain={[0, barAxisTop]} label={yAxisLabelProp} />
                  {hasComparisonBars ? (
                    <>
                      <Bar dataKey="s0" fill={barSeriesColors[0]} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
                        <LabelList dataKey="s0" position="top" fill={barSeriesColors[0]} fontSize={comparisonValueLabelFontSize} fontWeight={VALUE_LABEL_FONT_WEIGHT} stroke={VALUE_TEXT_STROKE} strokeWidth={valueLabelStrokeWidth} paintOrder="stroke" formatter={(value) => formatBarValueLabel(value, useCompactBarValueLabels)} />
                      </Bar>
                      {chartInputs.lineSeries[1] ? (
                        <Bar dataKey="s1" fill={barSeriesColors[1]} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
                          <LabelList dataKey="s1" position="top" fill={barSeriesColors[1]} fontSize={comparisonValueLabelFontSize} fontWeight={VALUE_LABEL_FONT_WEIGHT} stroke={VALUE_TEXT_STROKE} strokeWidth={valueLabelStrokeWidth} paintOrder="stroke" formatter={(value) => formatBarValueLabel(value, useCompactBarValueLabels)} />
                        </Bar>
                      ) : null}
                      {chartInputs.lineSeries[2] ? (
                        <Bar dataKey="s2" fill={barSeriesColors[2]} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
                          <LabelList dataKey="s2" position="top" fill={barSeriesColors[2]} fontSize={comparisonValueLabelFontSize} fontWeight={VALUE_LABEL_FONT_WEIGHT} stroke={VALUE_TEXT_STROKE} strokeWidth={valueLabelStrokeWidth} paintOrder="stroke" formatter={(value) => formatBarValueLabel(value, useCompactBarValueLabels)} />
                        </Bar>
                      ) : null}
                    </>
                  ) : (
                    <Bar
                      dataKey="value"
                      fill={defaultBarColor}
                      radius={[5, 5, 0, 0]}
                      maxBarSize={52}
                      isAnimationActive={false}
                    >
                      <LabelList
                        dataKey="value"
                        position="top"
                        fill="white"
                        fontSize={valueLabelFontSize}
                        fontWeight={VALUE_LABEL_FONT_WEIGHT}
                        stroke={VALUE_TEXT_STROKE}
                        strokeWidth={valueLabelStrokeWidth}
                        paintOrder="stroke"
                        formatter={(value) => formatBarValueLabel(value, useCompactBarValueLabels)}
                      />
                    </Bar>
                  )}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ flex: isPortrait ? "0 0 auto" : "0 0 28%", minWidth: isPortrait ? 0 : (isNarrow ? 190 : 250), display: "flex", flexDirection: "column", gap: 12 }}>
          {isPortrait ? (
            <div style={{ background: "rgba(10,42,110,0.25)", border: "1px solid rgba(200,220,255,0.20)", borderRadius: 12, backdropFilter: "blur(8px)", padding: "12px 14px", overflow: "hidden", position: "relative" }}>
              <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, transparent 100%)", pointerEvents: "none" }} />
              <div style={{ position: "relative" }}>
                <div style={{ color: steel, fontFamily: newscastFont(props.fontFamily, "label"), fontSize: scaleNewscastPx(10 * bodyTextScale, portraitScale), fontWeight: 600, opacity: 0.95, letterSpacing: 4, textTransform: "uppercase" }}>
                  {symbol}
                </div>
                <div style={{ color: "white", fontFamily: newscastFont(props.fontFamily, "title"), fontSize: scaleNewscastPx(34 * titleTextScale, portraitScale), fontWeight: 800, lineHeight: 1 }}>
                  {valueLabel}
                </div>
                <div style={{ color: trendColor, fontFamily: newscastFont(props.fontFamily, "label"), fontSize: scaleNewscastPx(15 * bodyTextScale, portraitScale), fontWeight: 700 }}>
                  {deltaLabel} [{pctLabel}]
                </div>
              </div>
            </div>
          ) : null}
          <div style={{ background: "rgba(10,42,110,0.25)", border: "1px solid rgba(200,220,255,0.20)", borderRadius: 12, backdropFilter: "blur(8px)", padding: "12px 14px 12px", overflow: "hidden", position: "relative" }}>
            <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, transparent 100%)", pointerEvents: "none" }} />
            <div style={{ position: "relative" }}>
              <div style={{ fontFamily: newscastFont(props.fontFamily, "label"), fontSize: scaleNewscastPx(10 * bodyTextScale, portraitScale), letterSpacing: 4, fontWeight: 600, color: "#B8C8E0", textTransform: "uppercase" }}>
                {lowerTag}
              </div>
              <div style={{ marginTop: 6, fontFamily: newscastFont(props.fontFamily, "title"), fontSize: scaleNewscastPx(22 * titleTextScale, portraitScale), fontWeight: 700, color: "white", textTransform: "uppercase", letterSpacing: 0.5, lineHeight: 1.05 }}>
                {lowerHeadline}
              </div>
              <div style={{ marginTop: 6, fontFamily: newscastFont(props.fontFamily, "body"), fontSize: scaleNewscastPx(13 * bodyTextScale, portraitScale), color: steel, lineHeight: 1.5 }}>
                {lowerSub}
              </div>
            </div>
          </div>

          <div style={{ background: "rgba(10,42,110,0.25)", border: "1px solid rgba(200,220,255,0.20)", borderRadius: 12, backdropFilter: "blur(8px)", padding: "12px 14px", overflow: "hidden", position: "relative" }}>
            <div style={{ position: "relative" }}>
              <div style={{ fontFamily: newscastFont(props.fontFamily, "label"), fontSize: scaleNewscastPx(10 * bodyTextScale, portraitScale), letterSpacing: 4, fontWeight: 600, color: "#B8C8E0", textTransform: "uppercase" }}>
                Latest
              </div>
              <div style={{ height: 1, marginTop: 8, background: `linear-gradient(90deg, transparent, ${red}, ${COLORS.gold})`, opacity: 0.8 }} />
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {(ticker.length > 0 ? ticker : ["AUTO CHART DECISION", "TABLE DATA SCRAPED", "COMPARISON SIGNAL"]).map((item, index) => (
                  <div key={`${item}-${index}`} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: newscastFont(props.fontFamily, "body"), color: steel, fontSize: scaleNewscastPx(13 * bodyTextScale, portraitScale), lineHeight: 1.3 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 999, background: index === 0 ? red : COLORS.blue, boxShadow: index === 0 ? "0 0 14px rgba(232,32,32,0.35)" : "0 0 14px rgba(30,95,212,0.35)" }} />
                    <div style={{ flex: 1 }}>{item}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const LegendDot: React.FC<{ color: string; label: string; textScale?: number }> = ({ color, label, textScale = 1 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <div
      style={{
        width: Math.max(8, Math.round(8 * textScale)),
        height: Math.max(8, Math.round(8 * textScale)),
        borderRadius: "50%",
        background: color,
      }}
    />
    <span style={{ color: "white", fontSize: Math.max(10, Math.round(10 * textScale)), fontWeight: 700, opacity: 0.8 }}>{label}</span>
  </div>
);