import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MosaicBackground } from "../MosaicBackground";
import { getSceneTransition, getStaggeredReveal } from "../transitions";
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
import type { MosaicLayoutProps } from "../types";
import { MOSAIC_DEFAULT_FONT_FAMILY } from "../constants";
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

// ─── Mosaic chart palette (stone & terracotta) ────────────────────────────────
const MOSAIC_BG = "#EAE4DA";
const MOSAIC_INK = "#2A2A28";
const MOSAIC = {
  terracotta: "#C26240",
  stone:      "#6B645E",
  sand:       "#A09A92",
  axisTxt:    "rgba(42,42,40,0.80)",
  grid:       "rgba(42,42,40,0.12)",
  panelBg:    "rgba(234,228,218,0.55)",
  panelBorder:"rgba(42,42,40,0.22)",
} as const;

const DEFAULT_BAR_COLORS = [MOSAIC.terracotta, MOSAIC.stone, MOSAIC.sand] as const;
const VALUE_LABEL_FW = 700;
const AXIS_LINE_STYLE = { stroke: "rgba(42,42,40,0.45)", strokeWidth: 1.4 };
const TICK_LINE_STYLE = { stroke: "rgba(42,42,40,0.35)", strokeWidth: 1.0 };

const HIST_BIN_RADIUS: [number, number, number, number] = [0, 0, 0, 0];
const HIST_BIN_STROKE = "rgba(42,42,40,0.35)";
const HIST_BIN_STROKE_W = 1.0;
const HIST_MAX_BAR_SINGLE = 120;
const HIST_MAX_BAR_GROUPED = 52;

type BarDatum =
  | { label: string; value: number }
  | { label: string; s0: number | null; s1: number | null; s2: number | null };

export const MosaicDataChart: React.FC<MosaicLayoutProps> = ({
  title = "The pattern in the numbers",
  narration = "",
  accentColor = MOSAIC.terracotta,
  bgColor,
  textColor = MOSAIC_INK,
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
  mosaicPattern,
  mosaicIntensity,
  mosaicTileSize,
  mosaicTileGap,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const p = aspectRatio === "portrait" || height > width;
  const bodyFont = fontFamily || MOSAIC_DEFAULT_FONT_FAMILY;

  const ink = textColor || MOSAIC_INK;
  const accent = accentColor || MOSAIC.terracotta;

  const titleSize = titleFontSize ?? (p ? 56 : 52);
  const descSize = descriptionFontSize ?? (p ? 28 : 26);
  const chartTickSize = Math.round(descSize * 0.86);
  const chartAxisLabelSize = Math.round(descSize * 0.72);
  const VALUE_LABEL_FS = Math.round(descSize * 0.56);

  const buildXAxisProps = (
    labels: string[],
    isPortrait: boolean,
    descSizeArg = 18,
    forceAllLabels = false,
    chartAreaPx = 0,
    opts?: { largerXTicks?: boolean },
  ) =>
    buildXAxisPropsShared(labels, isPortrait, descSizeArg, forceAllLabels, chartAreaPx, {
      largerXTicks: opts?.largerXTicks,
      axisTextColor: MOSAIC.axisTxt,
      fontFamily: bodyFont,
    });

  // ── Mosaic tile / scene transition ──────────────────────────────────────────
  const motion = getSceneTransition(frame, durationInFrames, 24, 18);
  const tileEntry = interpolate(frame, [0, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tileExit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 18), durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const seamGrow = getStaggeredReveal(frame, 30, 28);

  const titleOp = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ra = interpolate(frame, [50, 72], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = motion.exit;

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
    () => selectChartType(chartType as "auto" | "line" | "bar" | "histogram" | undefined, chartInputsRaw),
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
      ? hasComparisonBars ? comparisonBarData.length : chartInputs.barRows.length
      : 0;
  const barMaxSizeSingle = barCategoryN >= 17 ? 26 : barCategoryN >= 13 ? 38 : 58;
  const barMaxSizeGrouped = barCategoryN >= 17 ? 18 : barCategoryN >= 13 ? 26 : 32;
  const barCatGapSinglePct = barCategoryN >= 17 ? "28%" : barCategoryN >= 13 ? "23%" : "18%";
  const barCatGapGroupedPct = barCategoryN >= 17 ? "22%" : "12%";
  const barGapGroupedPx = barCategoryN >= 14 ? 1 : 2;
  const showBarTopValueLabels = barCategoryN <= 24;

  const histCategoryN =
    resolvedChartType === "histogram"
      ? hasComparisonBars ? chartInputs.labels.length : chartInputs.histogramRows.length
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

  const yTickStyle = { fill: MOSAIC.axisTxt, fontSize: Math.max(9, chartTickSize), fontWeight: 500, fontFamily: bodyFont };
  const yLabelProp = hasYLabel
    ? {
        value: resolvedYAxisCaption,
        angle: -90 as const,
        position: "left" as const,
        offset: 10,
        style: { fill: MOSAIC.axisTxt, fontSize: chartAxisLabelSize, fontWeight: 600, textAnchor: "middle" as const, fontFamily: bodyFont },
      }
    : undefined;
  const yAxisTickFmt = customYAxis?.tickFormatter ?? formatAxisTick;
  const buildXCaption = () =>
    xCaptionText
      ? {
          value: xCaptionText,
          position: "bottom" as const,
          offset: 8,
          style: { fill: MOSAIC.axisTxt, fontSize: chartAxisLabelSize, fontWeight: 600, fontFamily: bodyFont, letterSpacing: "0.06em" },
        }
      : undefined;
  const xCaption = buildXCaption();

  const LegendDot: React.FC<{ color: string; label: string }> = ({ color, label }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 11, height: 11, borderRadius: 2, background: color, border: `1px solid rgba(42,42,40,0.25)` }} />
      <span style={{ color: ink, fontSize: 14, fontWeight: 700, fontFamily: bodyFont, opacity: 0.92 }}>
        {label}
      </span>
    </div>
  );

  const renderChart = () => {
    if (resolvedChartType === "line") {
      return (
        <ComposedChart data={linePlotData} margin={{ top: chartMarginTop, right: chartMarginRight, left: chartMarginLeft, bottom: chartBottom }}>
          <defs>
            <linearGradient id="mosaic-line-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={barColors[0]} stopOpacity={0.28} />
              <stop offset="95%" stopColor={barColors[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={MOSAIC.grid} vertical={false} />
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
            stroke={barColors[0]} strokeWidth={linePointCount >= 14 ? 3 : 3.6}
            fill="url(#mosaic-line-fill)" fillOpacity={0.28} isAnimationActive={false}
            dot={showDots0 ? { r: lineDotR0, fill: MOSAIC_BG, stroke: barColors[0], strokeWidth: 1.6 } : false}
            activeDot={false}
          >
            {showDots0 && (
              <LabelList dataKey="s0" position="top" offset={8}
                formatter={(v) => formatLineLabel(v as number | null | undefined)}
                fill={ink} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={bodyFont} />
            )}
          </Area>
          {lastS0 && <ReferenceLine yAxisId={axisForKey("s0")} y={lastS0.y} stroke={barColors[0]} strokeDasharray="3 4" strokeOpacity={0.40} />}
          {chartInputs.lineSeries[1] && (
            <Line yAxisId={axisForKey("s1")} type="monotone" dataKey="s1"
              stroke={barColors[1]} strokeWidth={linePointCount >= 14 ? 2.1 : 2.5} strokeOpacity={lineOp1}
              dot={showDots1 ? { r: lineDotR12, fill: MOSAIC_BG, stroke: barColors[1], strokeWidth: 1.2 } : false}
              activeDot={false} strokeDasharray="5 4" isAnimationActive={false}
            >
              {showDots1 && (
                <LabelList dataKey="s1" position="top" offset={8}
                  formatter={(v) => formatLineLabel(v as number | null | undefined)}
                  fill={barColors[1]} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={bodyFont} />
              )}
            </Line>
          )}
          {lastS1 && <ReferenceLine yAxisId={axisForKey("s1")} y={lastS1.y} stroke={barColors[1]} strokeDasharray="3 4" strokeOpacity={0.35} />}
          {chartInputs.lineSeries[2] && (
            <Line yAxisId={axisForKey("s2")} type="monotone" dataKey="s2"
              stroke={barColors[2]} strokeWidth={linePointCount >= 14 ? 2.1 : 2.5} strokeOpacity={lineOp2}
              dot={showDots2 ? { r: lineDotR12, fill: MOSAIC_BG, stroke: barColors[2], strokeWidth: 1.2 } : false}
              activeDot={false} isAnimationActive={false}
            >
              {showDots2 && (
                <LabelList dataKey="s2" position="top" offset={8}
                  formatter={(v) => formatLineLabel(v as number | null | undefined)}
                  fill={barColors[2]} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={bodyFont} />
              )}
            </Line>
          )}
          {showDots0 && lastS0 && <ReferenceDot yAxisId={axisForKey("s0")} x={lastS0.x} y={lastS0.y} r={linePointCount >= 16 ? 3 : 4.5} fill={MOSAIC_BG} stroke={barColors[0]} strokeWidth={2.2} />}
          {showDots1 && lastS1 && <ReferenceDot yAxisId={axisForKey("s1")} x={lastS1.x} y={lastS1.y} r={linePointCount >= 16 ? 2.8 : 3.5} fill={MOSAIC_BG} stroke={barColors[1]} strokeWidth={1.8} />}
          {showDots2 && lastS2 && <ReferenceDot yAxisId={axisForKey("s2")} x={lastS2.x} y={lastS2.y} r={linePointCount >= 16 ? 2.8 : 3.5} fill={MOSAIC_BG} stroke={barColors[2]} strokeWidth={1.8} />}
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
              {showHistTopLabels ? <LabelList dataKey="s0" position="top" offset={10} fill={ink} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={bodyFont} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
            </Bar>
            {chartInputs.lineSeries[1] && (
              <Bar dataKey="s1" fill={barColors[1]} radius={HIST_BIN_RADIUS} maxBarSize={histMaxGroupedScaled} isAnimationActive={false} {...histBarStroke}>
                {showHistTopLabels ? <LabelList dataKey="s1" position="top" offset={10} fill={ink} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={bodyFont} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
              </Bar>
            )}
            {chartInputs.lineSeries[2] && (
              <Bar dataKey="s2" fill={barColors[2]} radius={HIST_BIN_RADIUS} maxBarSize={histMaxGroupedScaled} isAnimationActive={false} {...histBarStroke}>
                {showHistTopLabels ? <LabelList dataKey="s2" position="top" offset={10} fill={ink} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={bodyFont} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
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
            {showHistTopLabels ? <LabelList dataKey="value" position="top" offset={10} fill={ink} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={bodyFont} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
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
        <CartesianGrid stroke={MOSAIC.grid} vertical={false} />
        <XAxis dataKey="label" axisLine={AXIS_LINE_STYLE} label={xCaption} {...barXAxisProps} tickLine={false} />
        <YAxis axisLine={AXIS_LINE_STYLE} tickLine={TICK_LINE_STYLE} tick={yTickStyle} width={yAxisWidth}
          domain={customYAxis ? customYAxis.domain : [0, barAxisTop]} ticks={customYAxis?.ticks} tickFormatter={yAxisTickFmt} label={yLabelProp} />
        {hasComparisonBars ? (
          <>
            <Bar dataKey="s0" fill={barColors[0]} radius={[3, 3, 0, 0]} maxBarSize={barMaxSizeGrouped} isAnimationActive={false}>
              {showBarTopValueLabels ? <LabelList dataKey="s0" position="top" offset={10} fill={ink} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={bodyFont} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
            </Bar>
            {chartInputs.lineSeries[1] && (
              <Bar dataKey="s1" fill={barColors[1]} radius={[3, 3, 0, 0]} maxBarSize={barMaxSizeGrouped} isAnimationActive={false}>
                {showBarTopValueLabels ? <LabelList dataKey="s1" position="top" offset={10} fill={ink} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={bodyFont} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
              </Bar>
            )}
            {chartInputs.lineSeries[2] && (
              <Bar dataKey="s2" fill={barColors[2]} radius={[3, 3, 0, 0]} maxBarSize={barMaxSizeGrouped} isAnimationActive={false}>
                {showBarTopValueLabels ? <LabelList dataKey="s2" position="top" offset={10} fill={ink} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={bodyFont} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
              </Bar>
            )}
          </>
        ) : (
          <Bar dataKey="value" fill={defaultBarColor} radius={[4, 4, 0, 0]} maxBarSize={barMaxSizeSingle} isAnimationActive={false}>
            {showBarTopValueLabels ? <LabelList dataKey="value" position="top" offset={10} fill={ink} fontSize={VALUE_LABEL_FS} fontWeight={VALUE_LABEL_FW} fontFamily={bodyFont} formatter={(v) => formatBarLabel(v, useCompact)} /> : null}
          </Bar>
        )}
      </BarChart>
    );
  };

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* ── Mosaic tile background ── */}
      <MosaicBackground
        bgColor={bgColor}
        accentColor={accentColor}
        variant="panelField"
        frameReveal={tileEntry * motion.exit}
        frameDrift={tileEntry}
        tileBuildProgress={tileEntry}
        tileEntryPattern={mosaicPattern ?? "diagonal"}
        tileEntryIntensity={mosaicIntensity ?? 18}
        tileExitProgress={tileExit}
        tileExitSeed={42}
        tileExitIntensity={mosaicIntensity ?? 22}
        tileExitPattern={mosaicPattern ?? "diagonal"}
        tileGridSize={mosaicTileSize}
        tileGridGap={mosaicTileGap}
      />

      {/* ── Decorative seam lines (like MosaicPunch) ── */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        {/* horizontal rule near top */}
        <div style={{ position: "absolute", top: p ? "11%" : "9%", left: "6%", right: "6%", height: 1, background: "rgba(42,42,40,0.18)" }} />
        {/* growing accent bars */}
        <div style={{ position: "absolute", top: p ? "11%" : "9%", left: "6%", width: Math.round(width * 0.22 * seamGrow), height: 2, background: accent, opacity: 0.75 * fadeOut }} />
        <div style={{ position: "absolute", top: p ? "11%" : "9%", right: "6%", width: Math.round(width * 0.22 * seamGrow), height: 2, background: accent, opacity: 0.75 * fadeOut, transform: "translateX(0)" }} />
        {/* vertical margin line */}
        <div style={{ position: "absolute", left: "6%", top: "9%", bottom: "7%", width: 1, background: "rgba(42,42,40,0.14)" }} />
      </AbsoluteFill>

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: p ? "14% 7% 6%" : "12% 7% 5%", opacity: fadeOut }}>
        {/* Title */}
        <div style={{ opacity: titleOp, marginBottom: Math.round(height * 0.022), textAlign: "center" }}>
          <div style={{ fontFamily: bodyFont, fontWeight: 800, fontSize: titleSize, lineHeight: 1.05, color: ink, letterSpacing: "0.01em" }}>
            {title}
          </div>
          {/* mosaic-style accent underline: wide bar + small square */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, margin: `${Math.round(height * 0.012)}px auto 0` }}>
            <div style={{ width: 56, height: 3, background: accent, opacity: 0.85, borderRadius: 1 }} />
            <div style={{ width: 6, height: 6, background: accent, opacity: 0.70, transform: "rotate(45deg)" }} />
            <div style={{ width: 56, height: 3, background: accent, opacity: 0.85, borderRadius: 1 }} />
          </div>
        </div>

        {/* Chart panel + summary */}
        <div style={{ flex: 1, display: "flex", flexDirection: p ? "column" : "row", gap: p ? Math.round(height * 0.02) : Math.round(width * 0.02), minHeight: 0 }}>
          <div
            style={{
              position: "relative",
              flex: p ? "0 0 auto" : "0 0 80%",
              height: p ? "60%" : "auto",
              borderRadius: 4,
              overflow: "hidden",
              opacity: ra,
              background: MOSAIC.panelBg,
              border: `1.5px solid ${MOSAIC.panelBorder}`,
              borderTop: `3px solid ${accent}`,
              boxShadow: "0 2px 16px rgba(42,42,40,0.10)",
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
                  <div style={{ position: "absolute", top: 12, right: 22, zIndex: 2, display: "flex", gap: 14, maxWidth: "46%", flexWrap: "wrap", justifyContent: "flex-end" }}>
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
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: bodyFont, color: "rgba(42,42,40,0.50)", fontSize: descSize, fontStyle: "italic", opacity: ra }}>
                No data — add data by editing this scene
              </div>
            )}
          </div>

          {/* Summary panel */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div
              style={{
                opacity: interpolate(frame, [55, 75], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                borderTop: `2px solid ${accent}`,
                borderLeft: p ? undefined : `1px solid rgba(42,42,40,0.18)`,
                paddingTop: Math.round(descSize * 0.5),
                paddingLeft: p ? 0 : Math.round(descSize * 0.4),
                overflow: "hidden",
              }}
            >
              <div style={{ fontFamily: bodyFont, fontWeight: 500, fontSize: descSize * 0.9, lineHeight: 1.5, color: ink, opacity: 0.95, whiteSpace: "pre-wrap" }}>
                {summaryText
                  ? summaryText.split(/(__[^_]+__)/).map((seg: string, i: number) => {
                      if (seg.startsWith("__") && seg.endsWith("__")) {
                        return <span key={i} style={{ color: accent, fontWeight: 700 }}>{seg.slice(2, -2)}</span>;
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
          <div style={{ opacity: interpolate(frame, [60, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), marginTop: Math.round(height * 0.018) }}>
            <div style={{ fontFamily: bodyFont, fontStyle: "italic", fontSize: descSize * 0.82, color: ink, opacity: 0.60, lineHeight: 1.45, textAlign: "center", overflowWrap: "break-word", wordBreak: "break-word" }}>
              {narration}
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
