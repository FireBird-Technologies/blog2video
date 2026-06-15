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
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";
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
import { LineChartEndCallouts, lineChartCalloutMargin } from "../../_shared/LineChartEndCallouts";

/**
 * WhiteboardDataViz — data-visualization scene (line / bar / histogram) driven by
 * a scraped `chartTable`. Reuses the shared data pipeline (_shared/chartData) for
 * all parsing / type inference / animation, so the backend table-binding works
 * unchanged; only the rendering is styled into the whiteboard's hand-drawn
 * marker-on-paper aesthetic (ink-displaced strokes, dashed grid, taped panel).
 */

const HAND_FONT = "'Patrick Hand', system-ui, sans-serif";

// ─── Whiteboard marker chart palette ─────────────────────────────────────────
// Derived per-render from accentColor; these are static fallbacks/neutrals.
const PAPER_PANEL = "rgba(255,255,255,0.55)";
const GRID_INK = "rgba(31,41,55,0.28)";

const VALUE_LABEL_FW = 700;

// Histogram look — flat-topped bins with a hand-inked edge
const HIST_BIN_RADIUS: [number, number, number, number] = [2, 2, 0, 0];
const HIST_BIN_STROKE_W = 2.0;
const HIST_MAX_BAR_SINGLE = 120;
const HIST_MAX_BAR_GROUPED = 52;

type BarDatum =
  | { label: string; value: number }
  | { label: string; s0: number | null; s1: number | null; s2: number | null };

export const WhiteboardDataViz: React.FC<WhiteboardLayoutProps> = ({
  title = "Comparison",
  narration = "See how the numbers stack up.",
  accentColor = "#1F2937",
  bgColor = "#F7F3E8",
  textColor = "#111827",
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
  const font = fontFamily || HAND_FONT;

  // Whiteboard marker series colors: accent + two warm marker hues, all
  // overridable from Studio.
  const MARKER_SECONDARY = "#C0563B"; // red marker
  const MARKER_TERTIARY = "#2F7D5B"; // green marker
  const DEFAULT_BAR_COLORS = [accentColor, MARKER_SECONDARY, MARKER_TERTIARY] as const;
  const axisInk = textColor;

  const titleSize = titleFontSize ?? (p ? 78 : 57);
  const descSize = descriptionFontSize ?? (p ? 33 : 27);
  const chartTickSize = Math.round(descSize * 0.86);
  const chartAxisLabelSize = Math.round(descSize * 0.72);
  const VALUE_LABEL_FS = Math.round(descSize * 0.6);

  const AXIS_LINE_STYLE = { stroke: axisInk, strokeWidth: 2.2, strokeOpacity: 0.6 };
  const TICK_LINE_STYLE = { stroke: axisInk, strokeWidth: 1.4, strokeOpacity: 0.5 };

  // Panel / text entry reveal
  const ra = Math.min(1, Math.max(0, frame / 16));

  const padH = p ? "8%" : "6%";
  const padV = p ? "8%" : "5%";

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

  function buildXAxisProps(
    labels: string[],
    isPortrait: boolean,
    dSize = 18,
    forceAllLabels = false,
    chartAreaPx = 0,
    opts?: { largerXTicks?: boolean },
  ) {
    return buildXAxisPropsShared(labels, isPortrait, dSize, forceAllLabels, chartAreaPx, {
      largerXTicks: opts?.largerXTicks,
      axisTextColor: axisInk,
      fontFamily: font,
    });
  }

  // ── Line animation ──────────────────────────────────────────────────────────
  const lineDrawFrames = Math.max(54, Math.round(fps * 3.0));
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
  const lineDotR0 = linePointCount >= 16 ? 1.8 : linePointCount >= 12 ? 2.4 : 3;
  const lineDotR12 = linePointCount >= 16 ? 1.4 : linePointCount >= 12 ? 1.8 : 2.4;

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
  const chartMarginTop = 50;
  const useLineEndCallouts = chartInputs.lineSeries.length >= 2;
  const chartMarginRight =
    (resolvedChartType === "line"
      ? hasDualAxis ? 74 : lineChartCalloutMargin(chartInputs.lineSeries.length, 46)
      : hasDualAxis ? 74 : 46) + (p ? 10 : 0);
  const chartMarginLeft = chartLeft + 10;
  const chartBottom = p ? 70 : 56;

  const yTickStyle = { fill: axisInk, fontSize: Math.max(9, chartTickSize), fontWeight: 400, fontFamily: font };
  const yLabelProp = hasYLabel
    ? {
        value: resolvedYAxisCaption,
        angle: -90 as const,
        position: "left" as const,
        offset: 10,
        style: { fill: axisInk, fontSize: chartAxisLabelSize, fontWeight: 400, textAnchor: "middle" as const, fontFamily: font },
      }
    : undefined;
  const yAxisTickFmt = customYAxis?.tickFormatter ?? formatAxisTick;
  const buildXCaption = () =>
    xCaptionText
      ? {
          value: xCaptionText,
          position: "bottom" as const,
          offset: 8,
          style: { fill: axisInk, fontSize: chartAxisLabelSize, fontWeight: 400, fontFamily: font, letterSpacing: "0.04em" },
        }
      : undefined;
  const xCaption = buildXCaption();

  const renderChart = () => {
    if (resolvedChartType === "line") {
      return (
        <ComposedChart data={linePlotData} margin={{ top: chartMarginTop, right: chartMarginRight, left: chartMarginLeft, bottom: chartBottom }}>
          <defs>
            <linearGradient id="wb-line-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={barColors[0]} stopOpacity={0.22} />
              <stop offset="95%" stopColor={barColors[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID_INK} strokeDasharray="6 5" vertical={false} />
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
            stroke={barColors[0]} strokeWidth={linePointCount >= 14 ? 3 : 3.6} strokeLinecap="round"
            fill="url(#wb-line-fill)" fillOpacity={0.28} isAnimationActive={false}
            dot={showDots0 && !useLineEndCallouts ? { r: lineDotR0, fill: bgColor, stroke: barColors[0], strokeWidth: 2 } : false}
            activeDot={false}
          >
            {showDots0 && !useLineEndCallouts && (
              <LabelList dataKey="s0" position="top" offset={8}
                formatter={(v) => formatLineLabel(v as number | null | undefined)}
                fill={barColors[0]} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={font} />
            )}
          </Area>
          {lastS0 && <ReferenceLine yAxisId={axisForKey("s0")} y={lastS0.y} stroke={barColors[0]} strokeDasharray="3 5" strokeOpacity={0.4} />}
          {chartInputs.lineSeries[1] && (
            <Line yAxisId={axisForKey("s1")} type="monotone" dataKey="s1"
              stroke={barColors[1]} strokeWidth={linePointCount >= 14 ? 2.2 : 2.6} strokeOpacity={lineOp1} strokeLinecap="round"
              dot={showDots1 && !useLineEndCallouts ? { r: lineDotR12, fill: bgColor, stroke: barColors[1], strokeWidth: 1.6 } : false}
              activeDot={false} strokeDasharray="5 5" isAnimationActive={false}
            >
              {showDots1 && !useLineEndCallouts && (
                <LabelList dataKey="s1" position="top" offset={8}
                  formatter={(v) => formatLineLabel(v as number | null | undefined)}
                  fill={barColors[1]} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={font} />
              )}
            </Line>
          )}
          {lastS1 && <ReferenceLine yAxisId={axisForKey("s1")} y={lastS1.y} stroke={barColors[1]} strokeDasharray="3 5" strokeOpacity={0.32} />}
          {chartInputs.lineSeries[2] && (
            <Line yAxisId={axisForKey("s2")} type="monotone" dataKey="s2"
              stroke={barColors[2]} strokeWidth={linePointCount >= 14 ? 2.2 : 2.6} strokeOpacity={lineOp2} strokeLinecap="round"
              dot={showDots2 && !useLineEndCallouts ? { r: lineDotR12, fill: bgColor, stroke: barColors[2], strokeWidth: 1.6 } : false}
              activeDot={false} isAnimationActive={false}
            >
              {showDots2 && !useLineEndCallouts && (
                <LabelList dataKey="s2" position="top" offset={8}
                  formatter={(v) => formatLineLabel(v as number | null | undefined)}
                  fill={barColors[2]} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={font} />
              )}
            </Line>
          )}
          {showDots0 && !useLineEndCallouts && lastS0 && <ReferenceDot yAxisId={axisForKey("s0")} x={lastS0.x} y={lastS0.y} r={linePointCount >= 16 ? 3.5 : 4.5} fill={bgColor} stroke={barColors[0]} strokeWidth={2.4} />}
          {showDots1 && !useLineEndCallouts && lastS1 && <ReferenceDot yAxisId={axisForKey("s1")} x={lastS1.x} y={lastS1.y} r={linePointCount >= 16 ? 3 : 4} fill={bgColor} stroke={barColors[1]} strokeWidth={2} />}
          {showDots2 && !useLineEndCallouts && lastS2 && <ReferenceDot yAxisId={axisForKey("s2")} x={lastS2.x} y={lastS2.y} r={linePointCount >= 16 ? 3 : 4} fill={bgColor} stroke={barColors[2]} strokeWidth={2} />}

          <LineChartEndCallouts
            config={{
              rows: linePlotData,
              series: [
                { dataKey: "s0", yAxisId: axisForKey("s0"), color: barColors[0], visible: showDots0 },
                { dataKey: "s1", yAxisId: axisForKey("s1"), color: barColors[1], visible: showDots1 && !!chartInputs.lineSeries[1] },
                { dataKey: "s2", yAxisId: axisForKey("s2"), color: barColors[2], visible: showDots2 && !!chartInputs.lineSeries[2] },
              ],
              formatValue: (v) => formatLineLabel(v),
              fontSize: VALUE_LABEL_FS,
              fontWeight: VALUE_LABEL_FW,
              fontFamily: font,
              dotFill: bgColor,
            }}
          />
        </ComposedChart>
      );
    }

    if (resolvedChartType === "histogram") {
      const histBarStroke = { stroke: axisInk, strokeWidth: HIST_BIN_STROKE_W, strokeOpacity: 0.55 };
      if (hasComparisonBars) {
        return (
          <BarChart data={animatedCompBarData as BarDatum[]}
            margin={{ top: chartMarginTop, right: chartMarginRight, left: chartMarginLeft, bottom: chartBottom }}
            barGap={3} barCategoryGap={histCatGapGroupedPct}>
            <XAxis dataKey="label" axisLine={AXIS_LINE_STYLE} label={xCaption} {...histXAxisProps} tickLine={false} />
            <YAxis axisLine={AXIS_LINE_STYLE} tickLine={TICK_LINE_STYLE} tick={yTickStyle} width={yAxisWidth}
              domain={customYAxis ? customYAxis.domain : [0, histAxisTop]} ticks={customYAxis?.ticks} tickFormatter={yAxisTickFmt} label={yLabelProp} />
            <Bar dataKey="s0" fill={barColors[0]} fillOpacity={0.85} radius={HIST_BIN_RADIUS} maxBarSize={histMaxGroupedScaled} isAnimationActive={false} {...histBarStroke}>
              {showHistTopLabels ? <LabelList dataKey="s0" position="top" offset={10} fill={barColors[0]} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={font} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
            </Bar>
            {chartInputs.lineSeries[1] && (
              <Bar dataKey="s1" fill={barColors[1]} fillOpacity={0.85} radius={HIST_BIN_RADIUS} maxBarSize={histMaxGroupedScaled} isAnimationActive={false} {...histBarStroke}>
                {showHistTopLabels ? <LabelList dataKey="s1" position="top" offset={10} fill={barColors[1]} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={font} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
              </Bar>
            )}
            {chartInputs.lineSeries[2] && (
              <Bar dataKey="s2" fill={barColors[2]} fillOpacity={0.85} radius={HIST_BIN_RADIUS} maxBarSize={histMaxGroupedScaled} isAnimationActive={false} {...histBarStroke}>
                {showHistTopLabels ? <LabelList dataKey="s2" position="top" offset={10} fill={barColors[2]} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={font} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
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
          <Bar dataKey="value" fill={defaultBarColor} fillOpacity={0.85} radius={HIST_BIN_RADIUS} maxBarSize={histMaxSingleScaled} isAnimationActive={false} stroke={axisInk} strokeWidth={HIST_BIN_STROKE_W} strokeOpacity={0.55}>
            {showHistTopLabels ? <LabelList dataKey="value" position="top" offset={10} fill={defaultBarColor} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={font} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
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
        <CartesianGrid stroke={GRID_INK} strokeDasharray="6 5" vertical={false} />
        <XAxis dataKey="label" axisLine={AXIS_LINE_STYLE} label={xCaption} {...barXAxisProps} tickLine={false} />
        <YAxis axisLine={AXIS_LINE_STYLE} tickLine={TICK_LINE_STYLE} tick={yTickStyle} width={yAxisWidth}
          domain={customYAxis ? customYAxis.domain : [0, barAxisTop]} ticks={customYAxis?.ticks} tickFormatter={yAxisTickFmt} label={yLabelProp} />
        {hasComparisonBars ? (
          <>
            <Bar dataKey="s0" fill={barColors[0]} fillOpacity={0.88} radius={[4, 4, 0, 0]} maxBarSize={barMaxSizeGrouped} isAnimationActive={false} stroke={axisInk} strokeWidth={1.5} strokeOpacity={0.4}>
              {showBarTopValueLabels ? <LabelList dataKey="s0" position="top" offset={10} fill={barColors[0]} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={font} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
            </Bar>
            {chartInputs.lineSeries[1] && (
              <Bar dataKey="s1" fill={barColors[1]} fillOpacity={0.88} radius={[4, 4, 0, 0]} maxBarSize={barMaxSizeGrouped} isAnimationActive={false} stroke={axisInk} strokeWidth={1.5} strokeOpacity={0.4}>
                {showBarTopValueLabels ? <LabelList dataKey="s1" position="top" offset={10} fill={barColors[1]} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={font} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
              </Bar>
            )}
            {chartInputs.lineSeries[2] && (
              <Bar dataKey="s2" fill={barColors[2]} fillOpacity={0.88} radius={[4, 4, 0, 0]} maxBarSize={barMaxSizeGrouped} isAnimationActive={false} stroke={axisInk} strokeWidth={1.5} strokeOpacity={0.4}>
                {showBarTopValueLabels ? <LabelList dataKey="s2" position="top" offset={10} fill={barColors[2]} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={font} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
              </Bar>
            )}
          </>
        ) : (
          <Bar dataKey="value" fill={defaultBarColor} fillOpacity={0.88} radius={[5, 5, 0, 0]} maxBarSize={barMaxSizeSingle} isAnimationActive={false} stroke={axisInk} strokeWidth={1.6} strokeOpacity={0.4}>
            {showBarTopValueLabels ? <LabelList dataKey="value" position="top" offset={10} fill={defaultBarColor} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={font} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
          </Bar>
        )}
      </BarChart>
    );
  };

  const LegendDot: React.FC<{ color: string; label: string }> = ({ color, label }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 12, height: 12, borderRadius: 3, background: color, border: `2px solid ${axisInk}55` }} />
      <span style={{ color: textColor, fontSize: 15, fontWeight: 700, fontFamily: font }}>{label}</span>
    </div>
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: font, letterSpacing: "0.5px" }}>
      <WhiteboardBackground bgColor={bgColor} />

      {/* Paper grain + ink displacement filters */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
        <defs>
          <filter id="dv-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer><feFuncA type="linear" slope="0.05" /></feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
          <filter id="dv-ink" x="-4%" y="-4%" width="108%" height="108%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" seed="23" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#dv-grain)" fill="none" />
        <g stroke={accentColor} strokeWidth="5" fill="none" opacity="0.8" filter="url(#dv-ink)">
          <path d="M 88%,86% L 95%,93% M 95%,86% L 88%,93%" />
        </g>
      </svg>

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: `${padV} ${padH}` }}>
        {/* Title */}
        <div style={{ opacity: ra, marginBottom: Math.round(height * 0.02) }}>
          <div
            style={{
              fontFamily: font,
              fontWeight: 700,
              fontSize: titleSize,
              lineHeight: 1.1,
              color: textColor,
              filter: "url(#dv-ink)",
              transform: "rotate(-0.6deg)",
            }}
          >
            {title}
          </div>
        </div>

        {/* Chart + summary */}
        <div style={{ flex: 1, display: "flex", flexDirection: p ? "column" : "row", gap: p ? Math.round(height * 0.02) : Math.round(width * 0.02), minHeight: 0 }}>
          <div
            style={{
              position: "relative",
              flex: p ? "0 0 auto" : "0 0 82%",
              height: p ? "60%" : "auto",
              borderRadius: 14,
              overflow: "hidden",
              opacity: ra,
              background: PAPER_PANEL,
              border: `3px dashed ${accentColor}55`,
              transform: "rotate(-0.4deg)",
            }}
          >
            {hasRealChart ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "8px 12px 0 12px",
                  boxSizing: "border-box",
                  clipPath: resolvedChartType === "line" ? `inset(0 ${lineClipRight}% 0 0)` : undefined,
                }}
              >
                {(resolvedChartType === "line" ||
                  ((resolvedChartType === "bar" || resolvedChartType === "histogram") && hasComparisonBars)) && (
                  <div style={{ position: "absolute", top: 10, right: 20, zIndex: 2, display: "flex", gap: 12, maxWidth: "46%", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {chartInputs.lineSeries.map((series, i) =>
                      series.label ? (
                        <LegendDot key={i} color={barColors[i]} label={series.label} />
                      ) : null,
                    )}
                  </div>
                )}
                <ResponsiveContainer width="100%" height="100%">
                  {renderChart()}
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, color: textColor, fontSize: descSize, fontStyle: "italic", opacity: 0.7 }}>
                {"No data yet — add a table by editing this scene"}
              </div>
            )}
          </div>

          {/* Summary panel */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div
              style={{
                opacity: Math.min(1, Math.max(0, (frame - 10) / 20)),
                borderTop: `3px solid ${accentColor}55`,
                paddingTop: Math.round(descSize * 0.5),
                paddingLeft: p ? 0 : Math.round(descSize * 0.35),
                overflow: "hidden",
              }}
            >
              <div style={{ fontFamily: font, fontWeight: 400, fontSize: descSize * 0.92, lineHeight: 1.5, color: textColor, opacity: 0.95, whiteSpace: "pre-wrap", filter: "url(#dv-ink)" }}>
                {summaryText
                  ? summaryText.split(/(__[^_]+__)/).map((seg, i) => {
                      if (seg.startsWith("__") && seg.endsWith("__")) {
                        return (
                          <span key={i} style={{ color: accentColor, fontWeight: 700 }}>
                            {seg.slice(2, -2)}
                          </span>
                        );
                      }
                      return <span key={i}>{seg}</span>;
                    })
                  : " "}
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
