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
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { MatrixBackground } from "../MatrixBackground";
import { buildHudStatus, DecodeSweep, GlitchSlice, TerminalHUD } from "../components/MatrixArtifacts";
import { MATRIX_DEFAULT_FONT_FAMILY } from "../constants";
import type { MatrixLayoutProps } from "../types";
import {
  toNumber,
  formatAxisTick,
  formatBarLabel,
  formatLineLabel,
  getAxisUpperBound,
  normalizeHex,
  buildXAxisProps as buildXAxisPropsShared,
  resolveChartInputs,
  selectChartType,
  orientChartInputsForType,
  filterBarChartNonNegativeRows,
  buildYAxisTickOverride,
  buildAutoChartSummary,
  easeInOutCubic,
  clampProgressAt,
} from "../../_shared/chartData";

/**
 * MatrixDataChart — data-visualization scene (line / bar / histogram) driven by
 * a scraped `chartTable`. Uses the shared data pipeline (_shared/chartData) for
 * all parsing / type inference / animation, so the backend table-binding works
 * unchanged; only the rendering is styled into Matrix's neon-green terminal
 * aesthetic on a digital-rain void.
 */

// ─── Matrix neon chart palette ────────────────────────────────────────────────
const NEON = {
  primary: "#00FF41",
  secondary: "#00B82E",
  tertiary: "#7CFFB0",
  axisTxt: "#00FF41",
  grid: "rgba(0,255,65,0.16)",
  panelBg: "rgba(0,18,4,0.78)",
  panelBorder: "rgba(0,255,65,0.35)",
  white: "#E8FFE8",
} as const;

const DEFAULT_BAR_COLORS = [NEON.primary, NEON.secondary, NEON.tertiary] as const;
const VALUE_LABEL_FW = 600;
const AXIS_LINE_STYLE = { stroke: NEON.axisTxt, strokeWidth: 1.4, strokeOpacity: 0.5 };
const TICK_LINE_STYLE = { stroke: NEON.axisTxt, strokeWidth: 1.0, strokeOpacity: 0.45 };

// Histogram look — tight bins, faint edges
const HIST_BIN_RADIUS: [number, number, number, number] = [0, 0, 0, 0];
const HIST_BIN_STROKE = "rgba(0,255,65,0.55)";
const HIST_BIN_STROKE_W = 1.0;
const HIST_MAX_BAR_SINGLE = 120;
const HIST_MAX_BAR_GROUPED = 52;

type BarDatum =
  | { label: string; value: number }
  | { label: string; s0: number | null; s1: number | null; s2: number | null };

const MONO = MATRIX_DEFAULT_FONT_FAMILY;

/** Matrix-themed X-axis builder (neon ink + Fira Code). */
function buildXAxisProps(
  labels: string[],
  isPortrait: boolean,
  descSize = 18,
  forceAllLabels = false,
  chartAreaPx = 0,
  opts?: { largerXTicks?: boolean },
) {
  return buildXAxisPropsShared(labels, isPortrait, descSize, forceAllLabels, chartAreaPx, {
    largerXTicks: opts?.largerXTicks,
    axisTextColor: NEON.axisTxt,
    fontFamily: MONO,
  });
}

const LegendDot: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <div style={{ width: 9, height: 9, borderRadius: 1, background: color, boxShadow: `0 0 8px ${color}` }} />
    <span style={{ color: NEON.primary, fontSize: 13, fontWeight: 500, fontFamily: MONO }}>
      {label}
    </span>
  </div>
);

export const MatrixDataChart: React.FC<MatrixLayoutProps> = ({
  title = "Signal analysis",
  narration = "Decoded dataset from intercepted transmission.",
  accentColor = NEON.primary,
  bgColor = "#000000",
  textColor = NEON.primary,
  aspectRatio = "landscape",
  fontFamily,
  titleFontSize,
  descriptionFontSize,
  chartSummary = "",
  subtitle = "",
  chartYAxisTicks = [],
  chartType,
  chartTable,
  barPrimaryColor,
  barSecondaryColor,
  yAxisLabel,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const font = fontFamily || MONO;

  const titleSize = titleFontSize ?? (p ? 46 : 40);
  const descSize = descriptionFontSize ?? (p ? 28 : 28);
  const chartTickSize = Math.round(descSize * 0.92);
  const chartAxisLabelSize = Math.round(descSize * 0.74);
  const VALUE_LABEL_FS = Math.round(descSize * 0.58);

  // Panel / text entry reveal
  const ra = Math.min(1, Math.max(0, frame / 18));

  const padH = "5%";
  const padV = p ? "5%" : "4%";

  const hasRealChart = useMemo(() => {
    const rows = chartTable?.rows ?? [];
    return Array.isArray(rows) && rows.length >= 1;
  }, [chartTable]);

  const chartInputsRaw = useMemo(() => resolveChartInputs(chartTable), [chartTable]);

  const tableAxisHeaders = useMemo(() => {
    const h = chartTable?.headers ?? [];
    return { category: String(h[0] ?? "").trim(), value: String(h[1] ?? "").trim() };
  }, [chartTable]);

  const resolvedChartType = useMemo(
    () => selectChartType(chartType, chartInputsRaw),
    [chartType, chartInputsRaw],
  );

  const chartInputs = useMemo(() => {
    const oriented = orientChartInputsForType(chartInputsRaw, resolvedChartType);
    if (resolvedChartType !== "bar") return oriented;
    return filterBarChartNonNegativeRows(oriented);
  }, [chartInputsRaw, resolvedChartType]);

  const summaryText = useMemo(() => {
    const manual = (chartSummary ?? "").trim();
    if (manual.length > 0) return manual;
    if (!hasRealChart) return "";
    return buildAutoChartSummary(chartInputs, resolvedChartType);
  }, [chartSummary, hasRealChart, chartInputs, resolvedChartType]);

  const lineDataBounds = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of chartInputs.lineSeries) {
      for (const v of s.values) {
        if (Number.isFinite(v)) {
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { lo: 0, hi: 1 };
    return { lo, hi };
  }, [chartInputs]);

  const barColors = [
    normalizeHex(barPrimaryColor, DEFAULT_BAR_COLORS[0]),
    normalizeHex(barSecondaryColor, DEFAULT_BAR_COLORS[1]),
    DEFAULT_BAR_COLORS[2],
  ] as const;
  const defaultBarColor = barColors[0];

  const clampProgress = (start: number, dur: number) => clampProgressAt(frame, start, dur);

  // ── Line animation ──────────────────────────────────────────────────────────
  const lineDrawFrames = Math.max(54, Math.round(fps * 3.2));
  const lineDelayFrames = Math.max(12, Math.round(fps * 0.8));
  const rawReveal0 = clampProgress(0, lineDrawFrames);
  const lineClipRight = ((1 - easeInOutCubic(rawReveal0)) * 100).toFixed(2);
  const showDots0 = rawReveal0 >= 1;
  const rawP1 = clampProgress(lineDelayFrames, lineDrawFrames);
  const showDots1 = rawP1 >= 1;
  const lineOp1 = easeInOutCubic(rawP1);
  const rawP2 = clampProgress(lineDelayFrames * 2, lineDrawFrames);
  const showDots2 = rawP2 >= 1;
  const lineOp2 = easeInOutCubic(rawP2);

  const maxLineLength = Math.max(0, ...chartInputs.lineSeries.map((s) => s.values.length));
  const animatedLineData = Array.from({ length: maxLineLength }).map((_, i) => ({
    label: chartInputs.labels[i] ?? `${i + 1}`,
    s0: chartInputs.lineSeries[0]?.values[i] ?? null,
    s1: chartInputs.lineSeries[1]?.values[i] ?? null,
    s2: chartInputs.lineSeries[2]?.values[i] ?? null,
  }));

  const linePlotData =
    resolvedChartType === "line" && animatedLineData.length === 1
      ? (() => {
          const row = animatedLineData[0]!;
          const hasY =
            (row.s0 != null && Number.isFinite(row.s0)) ||
            (row.s1 != null && Number.isFinite(row.s1)) ||
            (row.s2 != null && Number.isFinite(row.s2));
          if (!hasY) return animatedLineData;
          return [row, { ...row, label: row.label === "" ? "·" : `${row.label} ` }];
        })()
      : animatedLineData;

  const linePointCount = linePlotData.length;
  const lineDotR0 = linePointCount >= 16 ? 1.5 : linePointCount >= 12 ? 2 : 2.4;
  const lineDotR12 = linePointCount >= 16 ? 1.2 : linePointCount >= 12 ? 1.6 : 2;

  const seriesKeys = ["s0", "s1", "s2"] as const;
  const seriesMags = chartInputs.lineSeries
    .map((s, i) => {
      const abs = s.values.filter((v) => Number.isFinite(v) && v > 0).map((v) => Math.abs(v));
      return { key: seriesKeys[i], avgMag: abs.length ? abs.reduce((a, b) => a + b, 0) / abs.length : 0 };
    })
    .filter((x) => x.avgMag > 0);
  let rightAxisKey: "s0" | "s1" | "s2" | null = null;
  if (seriesMags.length >= 2) {
    const sorted = [...seriesMags].sort((a, b) => b.avgMag - a.avgMag);
    const ratio = sorted[0].avgMag / Math.min(...seriesMags.map((x) => x.avgMag));
    if (ratio >= 8) rightAxisKey = sorted[0].key;
  }
  const hasDualAxis = rightAxisKey !== null;
  const axisForKey = (k: "s0" | "s1" | "s2") => (hasDualAxis && rightAxisKey === k ? "right" : "left");

  const getLastPoint = (key: "s0" | "s1" | "s2") => {
    for (let i = animatedLineData.length - 1; i >= 0; i--) {
      const v = animatedLineData[i][key];
      if (v != null && Number.isFinite(v)) return { x: animatedLineData[i].label, y: v as number };
    }
    return null;
  };
  const lastS0 = getLastPoint("s0");
  const lastS1 = getLastPoint("s1");
  const lastS2 = getLastPoint("s2");

  // ── Bar / histogram animation ───────────────────────────────────────────────
  const effectiveBarCount =
    chartInputs.lineSeries.length >= 2 && chartInputs.labels.length >= 2
      ? chartInputs.labels.length * Math.min(3, chartInputs.lineSeries.length)
      : resolvedChartType === "histogram"
        ? chartInputs.histogramRows.length
        : chartInputs.barRows.length;
  const barBudget = Math.min(fps * 3.5, durationInFrames * 0.75);
  const barGrowFrames = Math.max(10, Math.min(Math.round(fps * 1.2), Math.round(barBudget * 0.6)));
  const barStepFrames =
    effectiveBarCount > 1
      ? Math.max(3, Math.floor((barBudget - barGrowFrames) / (effectiveBarCount - 1)))
      : barGrowFrames;

  const animatedBarData = chartInputs.barRows.map((row, i) => ({
    label: row.label,
    value: row.value * easeInOutCubic(clampProgress(i * barStepFrames, barGrowFrames)),
  }));
  const barDataMax = Math.max(0, ...chartInputs.barRows.map((r) => Math.abs(r.value)));

  const hasComparisonBars = chartInputs.lineSeries.length >= 2 && chartInputs.labels.length >= 2;
  const comparisonBarData = hasComparisonBars
    ? chartInputs.labels.map((label, i) => ({
        label,
        s0: chartInputs.lineSeries[0]?.values[i] ?? null,
        s1: chartInputs.lineSeries[1]?.values[i] ?? null,
        s2: chartInputs.lineSeries[2]?.values[i] ?? null,
      }))
    : [];
  const animatedCompBarData = comparisonBarData.map((row, i) => {
    const p0 = easeInOutCubic(clampProgress((i * 3 + 0) * barStepFrames, barGrowFrames));
    const p1 = easeInOutCubic(clampProgress((i * 3 + 1) * barStepFrames, barGrowFrames));
    const p2 = easeInOutCubic(clampProgress((i * 3 + 2) * barStepFrames, barGrowFrames));
    return {
      ...row,
      s0: row.s0 == null ? null : row.s0 * p0,
      s1: row.s1 == null ? null : row.s1 * p1,
      s2: row.s2 == null ? null : row.s2 * p2,
    };
  });
  const compDataMax = Math.max(
    0,
    ...comparisonBarData.flatMap((r) => [r.s0 ?? 0, r.s1 ?? 0, r.s2 ?? 0]).map(Math.abs),
  );

  const animatedHistData = chartInputs.histogramRows.map((row, i) => ({
    label: row.label,
    value: row.value * easeInOutCubic(clampProgress(i * barStepFrames, barGrowFrames)),
  }));
  const histDataMax =
    resolvedChartType === "histogram" && hasComparisonBars
      ? compDataMax
      : Math.max(0, ...chartInputs.histogramRows.map((r) => Math.abs(r.value)));

  const barAxisTop = getAxisUpperBound(hasComparisonBars ? compDataMax : barDataMax);
  const histAxisTop = getAxisUpperBound(histDataMax);

  const customYAxis = useMemo(() => {
    if (!hasRealChart) return null;
    const raw = (chartYAxisTicks ?? []).map((s) => String(s ?? "").trim()).filter(Boolean);
    if (raw.length < 2) return null;
    if (resolvedChartType === "line") {
      const span = lineDataBounds.hi - lineDataBounds.lo;
      const pad = Math.max(span * 0.08, 1e-6);
      const low = lineDataBounds.lo - pad;
      const high = lineDataBounds.hi + pad;
      const parsedTickNums = raw.map((s) => toNumber(s)).filter((n): n is number => n !== null);
      if (parsedTickNums.length >= 2) {
        const tickMin = Math.min(...parsedTickNums);
        const tickMax = Math.max(...parsedTickNums);
        const margin = Math.max(span * 0.5, Math.abs(lineDataBounds.hi) * 1e-6, 1);
        if (tickMax < lineDataBounds.lo - margin || tickMin > lineDataBounds.hi + margin) return null;
      }
      return buildYAxisTickOverride(raw, low, high, false);
    }
    if (resolvedChartType === "histogram") return buildYAxisTickOverride(raw, 0, histAxisTop, true);
    return buildYAxisTickOverride(raw, 0, barAxisTop, true);
  }, [hasRealChart, chartYAxisTicks, resolvedChartType, lineDataBounds.lo, lineDataBounds.hi, histAxisTop, barAxisTop]);

  const useCompact =
    hasComparisonBars ||
    chartInputs.barRows.length >= 5 ||
    chartInputs.histogramRows.length >= 5 ||
    barDataMax >= 10_000 || compDataMax >= 10_000 || histDataMax >= 10_000;

  const barCategoryN =
    resolvedChartType === "bar"
      ? hasComparisonBars
        ? comparisonBarData.length
        : chartInputs.barRows.length
      : 0;
  const barMaxSizeSingle = barCategoryN >= 17 ? 26 : barCategoryN >= 13 ? 38 : 58;
  const barMaxSizeGrouped = barCategoryN >= 17 ? 18 : barCategoryN >= 13 ? 26 : 32;
  const barCatGapSinglePct = barCategoryN >= 17 ? "28%" : barCategoryN >= 13 ? "23%" : "18%";
  const barCatGapGroupedPct = barCategoryN >= 17 ? "22%" : "12%";
  const barGapGroupedPx = barCategoryN >= 14 ? 1 : 2;
  const showBarTopValueLabels = barCategoryN <= 24;

  const histCategoryN =
    resolvedChartType === "histogram"
      ? hasComparisonBars
        ? chartInputs.labels.length
        : chartInputs.histogramRows.length
      : 0;
  const histMaxSingleScaled =
    histCategoryN >= 17 ? 56 : histCategoryN >= 13 ? 76 : histCategoryN >= 10 ? 96 : HIST_MAX_BAR_SINGLE;
  const histMaxGroupedScaled = histCategoryN >= 17 ? 28 : histCategoryN >= 13 ? 38 : HIST_MAX_BAR_GROUPED;
  const histCatGapSinglePct = histCategoryN >= 16 ? "6%" : histCategoryN >= 12 ? "4%" : "1%";
  const histCatGapGroupedPct = histCategoryN >= 16 ? "14%" : histCategoryN >= 12 ? "10%" : "5%";
  const showHistTopLabels = histCategoryN <= 14;

  const estChartAreaPx = Math.round((p ? width : width * 0.84) * 0.9 - 170);
  const lineXAxisProps = buildXAxisProps(chartInputs.labels, p, descSize, true, estChartAreaPx, { largerXTicks: true });
  const barXAxisProps = (() => {
    const base = buildXAxisProps(
      hasComparisonBars ? comparisonBarData.map((d) => d.label) : chartInputs.barRows.map((r) => r.label),
      p, descSize, false, estChartAreaPx, { largerXTicks: true },
    );
    return { ...base, interval: 0 as const, minTickGap: 0 };
  })();
  const histXLabels = hasComparisonBars ? chartInputs.labels : chartInputs.histogramRows.map((r) => r.label);
  const histXAxisProps = buildXAxisProps(histXLabels, p, descSize, false, estChartAreaPx, { largerXTicks: true });

  const resolvedYAxisCaption = (yAxisLabel || tableAxisHeaders.value || "").trim();
  const xCaptionText = (subtitle || tableAxisHeaders.category || "").trim();

  const hasYLabel = resolvedYAxisCaption.length > 0;
  const yAxisWidth = hasYLabel ? 76 : 58;
  const chartLeft = hasYLabel ? (p ? 40 : 34) : (p ? 10 : 4);
  const chartMarginTop = 54;
  const chartMarginRight = (hasDualAxis ? 74 : 46) + (p ? 10 : 0);
  const chartMarginLeft = chartLeft + 10;
  const chartBottom = p ? 70 : 56;

  const yTickStyle = { fill: NEON.axisTxt, fontSize: Math.max(9, chartTickSize), fontWeight: 400, fontFamily: MONO };
  const yLabelProp = hasYLabel
    ? {
        value: resolvedYAxisCaption,
        angle: -90 as const,
        position: "left" as const,
        offset: 10,
        style: { fill: NEON.axisTxt, fontSize: chartAxisLabelSize, fontWeight: 400, textAnchor: "middle" as const, fontFamily: MONO },
      }
    : undefined;
  const yAxisTickFmt = customYAxis?.tickFormatter ?? formatAxisTick;
  const buildXCaption = () =>
    xCaptionText
      ? {
          value: xCaptionText,
          position: "bottom" as const,
          offset: 8,
          style: { fill: NEON.axisTxt, fontSize: chartAxisLabelSize, fontWeight: 400, fontFamily: MONO, letterSpacing: "0.06em" },
        }
      : undefined;
  const xCaption = buildXCaption();

  const renderChart = () => {
    if (resolvedChartType === "line") {
      return (
        <ComposedChart data={linePlotData} margin={{ top: chartMarginTop, right: chartMarginRight, left: chartMarginLeft, bottom: chartBottom }}>
          <defs>
            <linearGradient id="matrix-line-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={barColors[0]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={barColors[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={NEON.grid} vertical={false} />
          <XAxis dataKey="label" axisLine={AXIS_LINE_STYLE} label={xCaption} {...lineXAxisProps} tickLine={false} />
          <YAxis
            yAxisId="left" axisLine={AXIS_LINE_STYLE} tickLine={TICK_LINE_STYLE} tick={yTickStyle} width={yAxisWidth}
            domain={customYAxis ? customYAxis.domain : (["auto", "auto"] as const)}
            ticks={customYAxis?.ticks} tickFormatter={yAxisTickFmt} label={yLabelProp}
          />
          {hasDualAxis && (
            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={yTickStyle} width={66}
              domain={["auto", "auto"]} tickFormatter={(v) => formatAxisTick(Number(v))} />
          )}
          <Area
            yAxisId={axisForKey("s0")} type="monotone" dataKey="s0"
            stroke={barColors[0]} strokeWidth={linePointCount >= 14 ? 2.7 : 3.1}
            fill="url(#matrix-line-fill)" fillOpacity={0.28} isAnimationActive={false}
            dot={showDots0 ? { r: lineDotR0, fill: NEON.white, stroke: barColors[0], strokeWidth: 1.4 } : false}
            activeDot={false}
          >
            {showDots0 && (
              <LabelList dataKey="s0" position="top" offset={8}
                formatter={(v) => formatLineLabel(v as number | null | undefined)}
                fill={barColors[0]} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={MONO} />
            )}
          </Area>
          {lastS0 && <ReferenceLine yAxisId={axisForKey("s0")} y={lastS0.y} stroke={barColors[0]} strokeDasharray="3 4" strokeOpacity={0.45} />}
          {chartInputs.lineSeries[1] && (
            <Line yAxisId={axisForKey("s1")} type="monotone" dataKey="s1"
              stroke={barColors[1]} strokeWidth={linePointCount >= 14 ? 1.9 : 2.2} strokeOpacity={lineOp1}
              dot={showDots1 ? { r: lineDotR12, fill: NEON.white, stroke: barColors[1], strokeWidth: 1.1 } : false}
              activeDot={false} strokeDasharray="4 4" isAnimationActive={false}
            >
              {showDots1 && (
                <LabelList dataKey="s1" position="top" offset={8}
                  formatter={(v) => formatLineLabel(v as number | null | undefined)}
                  fill={barColors[1]} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={MONO} />
              )}
            </Line>
          )}
          {lastS1 && <ReferenceLine yAxisId={axisForKey("s1")} y={lastS1.y} stroke={barColors[1]} strokeDasharray="3 4" strokeOpacity={0.38} />}
          {chartInputs.lineSeries[2] && (
            <Line yAxisId={axisForKey("s2")} type="monotone" dataKey="s2"
              stroke={barColors[2]} strokeWidth={linePointCount >= 14 ? 1.9 : 2.2} strokeOpacity={lineOp2}
              dot={showDots2 ? { r: lineDotR12, fill: NEON.white, stroke: barColors[2], strokeWidth: 1.1 } : false}
              activeDot={false} isAnimationActive={false}
            >
              {showDots2 && (
                <LabelList dataKey="s2" position="top" offset={8}
                  formatter={(v) => formatLineLabel(v as number | null | undefined)}
                  fill={barColors[2]} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={MONO} />
              )}
            </Line>
          )}
          {showDots0 && lastS0 && <ReferenceDot yAxisId={axisForKey("s0")} x={lastS0.x} y={lastS0.y} r={linePointCount >= 16 ? 3 : 4} fill={NEON.white} stroke={barColors[0]} strokeWidth={2} />}
          {showDots1 && lastS1 && <ReferenceDot yAxisId={axisForKey("s1")} x={lastS1.x} y={lastS1.y} r={linePointCount >= 16 ? 2.8 : 3.5} fill={NEON.white} stroke={barColors[1]} strokeWidth={1.8} />}
          {showDots2 && lastS2 && <ReferenceDot yAxisId={axisForKey("s2")} x={lastS2.x} y={lastS2.y} r={linePointCount >= 16 ? 2.8 : 3.5} fill={NEON.white} stroke={barColors[2]} strokeWidth={1.8} />}
        </ComposedChart>
      );
    }

    if (resolvedChartType === "histogram") {
      const histBarStroke = { stroke: HIST_BIN_STROKE, strokeWidth: HIST_BIN_STROKE_W };
      if (hasComparisonBars) {
        return (
          <BarChart data={animatedCompBarData as BarDatum[]}
            margin={{ top: chartMarginTop, right: chartMarginRight, left: chartMarginLeft, bottom: chartBottom }}
            barGap={3} barCategoryGap={histCatGapGroupedPct}>
            <XAxis dataKey="label" axisLine={AXIS_LINE_STYLE} label={xCaption} {...histXAxisProps} tickLine={false} />
            <YAxis axisLine={AXIS_LINE_STYLE} tickLine={TICK_LINE_STYLE} tick={yTickStyle} width={yAxisWidth}
              domain={customYAxis ? customYAxis.domain : [0, histAxisTop]} ticks={customYAxis?.ticks} tickFormatter={yAxisTickFmt} label={yLabelProp} />
            <Bar dataKey="s0" fill={barColors[0]} radius={HIST_BIN_RADIUS} maxBarSize={histMaxGroupedScaled} isAnimationActive={false} {...histBarStroke}>
              {showHistTopLabels ? <LabelList dataKey="s0" position="top" offset={10} fill={barColors[0]} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={MONO} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
            </Bar>
            {chartInputs.lineSeries[1] && (
              <Bar dataKey="s1" fill={barColors[1]} radius={HIST_BIN_RADIUS} maxBarSize={histMaxGroupedScaled} isAnimationActive={false} {...histBarStroke}>
                {showHistTopLabels ? <LabelList dataKey="s1" position="top" offset={10} fill={barColors[1]} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={MONO} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
              </Bar>
            )}
            {chartInputs.lineSeries[2] && (
              <Bar dataKey="s2" fill={barColors[2]} radius={HIST_BIN_RADIUS} maxBarSize={histMaxGroupedScaled} isAnimationActive={false} {...histBarStroke}>
                {showHistTopLabels ? <LabelList dataKey="s2" position="top" offset={10} fill={barColors[2]} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={MONO} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
              </Bar>
            )}
          </BarChart>
        );
      }
      return (
        <BarChart data={animatedHistData}
          margin={{ top: chartMarginTop, right: chartMarginRight, left: chartMarginLeft, bottom: chartBottom }}
          barGap={0} barCategoryGap={histCatGapSinglePct}>
          <XAxis dataKey="label" axisLine={AXIS_LINE_STYLE} label={xCaption} {...histXAxisProps} tickLine={false} />
          <YAxis axisLine={AXIS_LINE_STYLE} tickLine={TICK_LINE_STYLE} tick={yTickStyle} width={yAxisWidth}
            domain={customYAxis ? customYAxis.domain : [0, histAxisTop]} ticks={customYAxis?.ticks} tickFormatter={yAxisTickFmt} label={yLabelProp} />
          <Bar dataKey="value" fill={defaultBarColor} radius={HIST_BIN_RADIUS} maxBarSize={histMaxSingleScaled} isAnimationActive={false} stroke={HIST_BIN_STROKE} strokeWidth={HIST_BIN_STROKE_W}>
            {showHistTopLabels ? <LabelList dataKey="value" position="top" offset={10} fill={defaultBarColor} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={MONO} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
          </Bar>
        </BarChart>
      );
    }

    // bar (default)
    return (
      <BarChart data={(hasComparisonBars ? animatedCompBarData : animatedBarData) as BarDatum[]}
        margin={{ top: chartMarginTop, right: chartMarginRight, left: chartMarginLeft, bottom: chartBottom }}
        barGap={hasComparisonBars ? barGapGroupedPx : 4}
        barCategoryGap={hasComparisonBars ? barCatGapGroupedPct : barCatGapSinglePct}>
        <CartesianGrid stroke={NEON.grid} vertical={false} />
        <XAxis dataKey="label" axisLine={AXIS_LINE_STYLE} label={xCaption} {...barXAxisProps} tickLine={false} />
        <YAxis axisLine={AXIS_LINE_STYLE} tickLine={TICK_LINE_STYLE} tick={yTickStyle} width={yAxisWidth}
          domain={customYAxis ? customYAxis.domain : [0, barAxisTop]} ticks={customYAxis?.ticks} tickFormatter={yAxisTickFmt} label={yLabelProp} />
        {hasComparisonBars ? (
          <>
            <Bar dataKey="s0" fill={barColors[0]} radius={[3, 3, 0, 0]} maxBarSize={barMaxSizeGrouped} isAnimationActive={false}>
              {showBarTopValueLabels ? <LabelList dataKey="s0" position="top" offset={10} fill={barColors[0]} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={MONO} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
            </Bar>
            {chartInputs.lineSeries[1] && (
              <Bar dataKey="s1" fill={barColors[1]} radius={[3, 3, 0, 0]} maxBarSize={barMaxSizeGrouped} isAnimationActive={false}>
                {showBarTopValueLabels ? <LabelList dataKey="s1" position="top" offset={10} fill={barColors[1]} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={MONO} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
              </Bar>
            )}
            {chartInputs.lineSeries[2] && (
              <Bar dataKey="s2" fill={barColors[2]} radius={[3, 3, 0, 0]} maxBarSize={barMaxSizeGrouped} isAnimationActive={false}>
                {showBarTopValueLabels ? <LabelList dataKey="s2" position="top" offset={10} fill={barColors[2]} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={MONO} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
              </Bar>
            )}
          </>
        ) : (
          <Bar dataKey="value" fill={defaultBarColor} radius={[4, 4, 0, 0]} maxBarSize={barMaxSizeSingle} isAnimationActive={false}>
            {showBarTopValueLabels ? <LabelList dataKey="value" position="top" offset={10} fill={defaultBarColor} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={MONO} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
          </Bar>
        )}
      </BarChart>
    );
  };

  const chromeTitle = `> ${title}`;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: bgColor }}>
      <MatrixBackground bgColor={bgColor} fontFamily={font} />

      {/* Decorative artifacts — quiet HUD, decode pass, rare glitch; the chart stays the hero. */}
      <TerminalHUD accentColor={accentColor} statusText={buildHudStatus("PLOTTING", title)} hexColumn={false} startFrame={4} seed={41} />
      <DecodeSweep accentColor={accentColor} startFrame={2} seed={43} />
      <GlitchSlice accentColor={accentColor} every={86} seed={69} />

      {/* Scanline overlay */}
      <AbsoluteFill
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, rgba(0,255,65,0.05) 0px, rgba(0,255,65,0.05) 1px, transparent 1px, transparent 3px)",
          pointerEvents: "none",
          mixBlendMode: "screen",
        }}
      />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: `${padV} ${padH}` }}>
        {/* Title */}
        <div style={{ opacity: ra, marginBottom: Math.round(height * 0.02) }}>
          <div
            style={{
              fontFamily: font,
              fontWeight: 700,
              fontSize: titleSize,
              letterSpacing: "0.01em",
              lineHeight: 1.1,
              color: accentColor,
              textShadow: `0 0 14px ${accentColor}99, 0 0 32px ${accentColor}55`,
            }}
          >
            {chromeTitle}
          </div>
        </div>

        {/* Chart + summary */}
        <div style={{ flex: 1, display: "flex", flexDirection: p ? "column" : "row", gap: p ? Math.round(height * 0.02) : Math.round(width * 0.02), minHeight: 0 }}>
          <div
            style={{
              position: "relative",
              flex: p ? "0 0 auto" : "0 0 84%",
              height: p ? "62%" : "auto",
              borderRadius: 8,
              overflow: "hidden",
              opacity: ra,
              background: NEON.panelBg,
              border: `1px solid ${NEON.panelBorder}`,
              boxShadow: `0 0 28px rgba(0,255,65,0.18), inset 0 0 40px rgba(0,255,65,0.05)`,
            }}
          >
            {hasRealChart ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "6px 10px 0 10px",
                  boxSizing: "border-box",
                  clipPath: resolvedChartType === "line" ? `inset(0 ${lineClipRight}% 0 0)` : undefined,
                }}
              >
                {(resolvedChartType === "line" ||
                  ((resolvedChartType === "bar" || resolvedChartType === "histogram") && hasComparisonBars)) && (
                  <div style={{ position: "absolute", top: 10, right: 20, zIndex: 2, display: "flex", gap: 10, maxWidth: "46%", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <LegendDot color={barColors[0]} label={chartInputs.lineSeries[0]?.label || "Series 1"} />
                    {chartInputs.lineSeries[1] && <LegendDot color={barColors[1]} label={chartInputs.lineSeries[1].label} />}
                    {chartInputs.lineSeries[2] && <LegendDot color={barColors[2]} label={chartInputs.lineSeries[2].label} />}
                  </div>
                )}
                <ResponsiveContainer width="100%" height="100%">
                  {renderChart()}
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, color: NEON.secondary, fontSize: descSize, fontStyle: "italic", opacity: ra }}>
                {"> NO_DATA :: add data by editing this scene"}
              </div>
            )}
          </div>

          {/* Summary panel */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div
              style={{
                opacity: Math.min(1, Math.max(0, (frame - 10) / 20)),
                borderTop: `1px solid ${accentColor}44`,
                borderLeft: p ? undefined : `1px solid ${accentColor}22`,
                paddingTop: Math.round(descSize * 0.45),
                paddingLeft: p ? 0 : Math.round(descSize * 0.35),
                overflow: "hidden",
              }}
            >
              <div style={{ fontFamily: font, fontWeight: 500, fontSize: descSize * 0.82, lineHeight: 1.5, color: textColor, opacity: 0.95, whiteSpace: "pre-wrap", textShadow: `0 0 8px ${accentColor}44` }}>
                {summaryText
                  ? summaryText.split(/(__[^_]+__)/).map((seg, i) => {
                      if (seg.startsWith("__") && seg.endsWith("__")) {
                        return (
                          <span key={i} style={{ color: accentColor, fontWeight: 700, textShadow: `0 0 12px ${accentColor}` }}>
                            {seg.slice(2, -2)}
                          </span>
                        );
                      }
                      return <span key={i}>{seg}</span>;
                    })
                  : " "}
              </div>
            </div>
          </div>
        </div>

        {/* Narration */}
        {narration && (
          <div style={{ opacity: Math.min(1, Math.max(0, (frame - 16) / 20)), marginTop: Math.round(height * 0.02) }}>
            <div style={{ fontFamily: font, fontStyle: "italic", fontSize: descSize * 0.84, color: textColor, opacity: 0.7, lineHeight: 1.45, overflowWrap: "break-word", wordBreak: "break-word" }}>
              {narration}
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
