/**
 * Custom-template craft kit — CustomChart.
 *
 * Theme-driven data-viz (line / bar / histogram / grouped-bar) for AI-generated
 * custom scenes. Rendered ONLY when the scene actually has chart data
 * (props.chartTable). A generalization of the laduc/stickman data-viz layouts:
 * reuses the shared parsing/animation engine in _shared/chartData and the
 * flicker-safe MeasuredChart wrapper, but colors come from the brand palette.
 *
 * Follows the official Remotion charts rule: all recharts animations are
 * disabled (isAnimationActive={false}); every animation is driven by
 * useCurrentFrame() so headless renders never flicker.
 */

import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";
import {
  resolveChartInputs,
  selectChartType,
  orientChartInputsForType,
  filterBarChartNonNegativeRows,
  buildYAxisTickOverride,
  buildAutoChartSummary,
  buildXAxisProps,
  getAxisUpperBound,
  formatAxisTick,
  formatBarLabel,
  formatLineLabel,
  easeInOutCubic,
  clampProgressAt,
  toNumber,
  type ChartTableShape,
} from "../../_shared/chartData";
import { MeasuredChart } from "../../_shared/MeasuredChart";
import { useKit } from "./context";
import { withAlpha, type KitPalette } from "./theme";

export interface CustomChartProps {
  chartTable?: ChartTableShape;
  chartType?: string;
  /** Optional palette override; defaults to the SceneFrame context palette. */
  palette?: KitPalette;
  /** Override axis label font size. */
  descSize?: number;
  /** Custom Y-axis tick labels (e.g. ["0","2.5K","5K"]). */
  chartYAxisTicks?: string[];
  yAxisLabel?: string;
  xAxisLabel?: string;
  fontFamily?: string;
}

export const CustomChart: React.FC<CustomChartProps> = ({
  chartTable,
  chartType,
  palette: paletteProp,
  descSize: descSizeProp,
  chartYAxisTicks = [],
  yAxisLabel,
  xAxisLabel,
  fontFamily: fontProp,
}) => {
  const frame = useCurrentFrame();
  const { width, fps, durationInFrames } = useVideoConfig();
  const kit = useKit();
  const palette = paletteProp ?? kit.palette;
  const isPortrait = kit.isPortrait;
  const font = fontProp ?? kit.fonts.body;
  const descSize = descSizeProp ?? kit.type.body;

  const axisInk = palette.text;
  const tickSize = Math.round(descSize * 0.84);
  const axisLabelSize = Math.round(descSize * 0.72);
  const valueLabelFs = Math.round(descSize * 0.58);
  const GRID_INK = palette.grid;
  const AXIS_LINE = { stroke: axisInk, strokeWidth: 1.6, strokeOpacity: 0.5 };
  const TICK_LINE = { stroke: axisInk, strokeWidth: 1.0, strokeOpacity: 0.4 };
  const series = palette.series;

  const hasRealChart = useMemo(() => {
    const rows = chartTable?.rows ?? [];
    return Array.isArray(rows) && rows.length >= 1;
  }, [chartTable]);

  const inputsRaw = useMemo(() => resolveChartInputs(chartTable), [chartTable]);
  const kind = useMemo(
    () => selectChartType(chartType as Parameters<typeof selectChartType>[0], inputsRaw),
    [chartType, inputsRaw],
  );
  const inputs = useMemo(() => {
    const oriented = orientChartInputsForType(inputsRaw, kind);
    return kind === "bar" ? filterBarChartNonNegativeRows(oriented) : oriented;
  }, [inputsRaw, kind]);

  const headers = useMemo(() => {
    const h = chartTable?.headers ?? [];
    return { category: String(h[0] ?? "").trim(), value: String(h[1] ?? "").trim() };
  }, [chartTable]);

  const clamp = (start: number, dur: number) => clampProgressAt(frame, start, dur);

  const xProps = (labels: string[], forceAll: boolean) =>
    buildXAxisProps(labels, isPortrait, descSize, forceAll, Math.round(width * 0.8 - 170), {
      largerXTicks: true,
      axisTextColor: axisInk,
      fontFamily: font,
    });

  // ── Custom Y ticks ──────────────────────────────────────────
  // Hoisted above the early return so this hook is never called conditionally
  // (rules-of-hooks). lineBounds/axisTop are inlined here since the render-only
  // copies below run only after the `hasRealChart` guard.
  const customYAxis = useMemo(() => {
    const raw = (chartYAxisTicks ?? []).map((s) => String(s ?? "").trim()).filter(Boolean);
    if (raw.length < 2) return null;
    if (kind === "line") {
      let lo = Infinity, hi = -Infinity;
      for (const s of inputs.lineSeries)
        for (const v of s.values)
          if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      const lb = Number.isFinite(lo) && Number.isFinite(hi) ? { lo, hi } : { lo: 0, hi: 1 };
      const span = lb.hi - lb.lo;
      const pad = Math.max(span * 0.08, 1e-6);
      const nums = raw.map(toNumber).filter((n): n is number => n !== null);
      if (nums.length >= 2) {
        const margin = Math.max(span * 0.5, 1);
        if (Math.max(...nums) < lb.lo - margin || Math.min(...nums) > lb.hi + margin)
          return null;
      }
      return buildYAxisTickOverride(raw, lb.lo - pad, lb.hi + pad, false);
    }
    const rowsForAxis = kind === "histogram" ? inputs.histogramRows : inputs.barRows;
    const barMaxForAxis = Math.max(0, ...rowsForAxis.map((r) => Math.abs(r.value)));
    return buildYAxisTickOverride(raw, 0, getAxisUpperBound(barMaxForAxis), true);
  }, [chartYAxisTicks, kind, inputs]);

  if (!hasRealChart) return null;

  // ── Line ────────────────────────────────────────────────────
  const lineDrawFrames = Math.max(54, Math.round(fps * 3.0));
  const reveal0 = clamp(0, lineDrawFrames);
  const lineClipRight = ((1 - easeInOutCubic(reveal0)) * 100).toFixed(2);
  const showDots = reveal0 >= 1;

  const maxLen = Math.max(0, ...inputs.lineSeries.map((s) => s.values.length));
  const lineData = Array.from({ length: maxLen }).map((_, i) => ({
    label: inputs.labels[i] ?? `${i + 1}`,
    s0: inputs.lineSeries[0]?.values[i] ?? null,
    s1: inputs.lineSeries[1]?.values[i] ?? null,
    s2: inputs.lineSeries[2]?.values[i] ?? null,
  }));
  const pointCount = lineData.length;
  const dotR = pointCount >= 16 ? 1.6 : pointCount >= 12 ? 2.2 : 2.8;

  const lineBounds = (() => {
    let lo = Infinity, hi = -Infinity;
    for (const s of inputs.lineSeries)
      for (const v of s.values)
        if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    return Number.isFinite(lo) && Number.isFinite(hi) ? { lo, hi } : { lo: 0, hi: 1 };
  })();

  // ── Bars / histogram ────────────────────────────────────────
  const rows = kind === "histogram" ? inputs.histogramRows : inputs.barRows;
  const barCount = rows.length;
  const barBudget = Math.min(fps * 3.5, durationInFrames * 0.75);
  const barGrow = Math.max(10, Math.min(Math.round(fps * 1.2), Math.round(barBudget * 0.6)));
  const barStep = barCount > 1 ? Math.max(3, Math.floor((barBudget - barGrow) / (barCount - 1))) : barGrow;
  const animatedBars = rows.map((row, i) => ({
    label: row.label,
    value: row.value * easeInOutCubic(clamp(i * barStep, barGrow)),
  }));
  const barMax = Math.max(0, ...rows.map((r) => Math.abs(r.value)));
  const axisTop = getAxisUpperBound(barMax);
  const barMaxSize = barCount >= 17 ? 26 : barCount >= 13 ? 38 : 58;
  const showBarLabels = barCount <= 24;

  const yTickStyle = { fill: axisInk, fontSize: Math.max(9, tickSize), fontWeight: 400, fontFamily: font };
  const yFmt = customYAxis?.tickFormatter ?? formatAxisTick;
  const yCaption = (yAxisLabel || headers.value || "").trim();
  const xCaption = (xAxisLabel || headers.category || "").trim();
  const yWidth = yCaption ? 76 : 58;

  const yLabel = yCaption
    ? { value: yCaption, angle: -90 as const, position: "left" as const, offset: 10,
        style: { fill: axisInk, fontSize: axisLabelSize, textAnchor: "middle" as const, fontFamily: font } }
    : undefined;
  const xLabel = xCaption
    ? { value: xCaption, position: "bottom" as const, offset: 8,
        style: { fill: axisInk, fontSize: axisLabelSize, fontFamily: font, letterSpacing: "0.04em" } }
    : undefined;

  const margin = { top: 46, right: isPortrait ? 56 : 56, left: yCaption ? 44 : 14, bottom: isPortrait ? 70 : 56 };

  const chart =
    kind === "line" ? (
      <ComposedChart data={lineData} margin={margin}>
        <defs>
          <linearGradient id="cc-line-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={series[0]} stopOpacity={0.24} />
            <stop offset="95%" stopColor={series[0]} stopOpacity={0} />
          </linearGradient>
          <clipPath id="cc-line-clip">
            <rect x="0" y="0" width={`${(100 - Number(lineClipRight)).toFixed(2)}%`} height="100%" />
          </clipPath>
        </defs>
        <CartesianGrid stroke={GRID_INK} strokeDasharray="5 6" vertical={false} />
        <XAxis dataKey="label" axisLine={AXIS_LINE} label={xLabel} {...xProps(inputs.labels, true)} tickLine={false} />
        <YAxis
          axisLine={AXIS_LINE} tickLine={TICK_LINE} tick={yTickStyle} width={yWidth}
          domain={customYAxis ? customYAxis.domain : (["auto", "auto"] as const)}
          ticks={customYAxis?.ticks} tickFormatter={yFmt} label={yLabel}
        />
        {([0, 1, 2] as const).map((si) => {
          const key = `s${si}` as "s0" | "s1" | "s2";
          if (!inputs.lineSeries[si]) return null;
          return (
            <Area
              key={key} type="monotone" dataKey={key}
              stroke={series[si]} strokeWidth={pointCount >= 14 ? 2.8 : 3.2} strokeLinecap="round"
              fill={si === 0 ? "url(#cc-line-fill)" : "none"} fillOpacity={si === 0 ? 0.24 : 0}
              isAnimationActive={false} clipPath="url(#cc-line-clip)"
              dot={showDots ? { r: dotR, fill: palette.bg, stroke: series[si], strokeWidth: 1.8 } : false}
              activeDot={false}
            >
              {showDots && (
                <LabelList dataKey={key} position="top" offset={8}
                  formatter={(v) => formatLineLabel(v as number | null | undefined)}
                  fill={series[si]} fontSize={valueLabelFs} fontWeight={700} fontFamily={font} />
              )}
            </Area>
          );
        })}
      </ComposedChart>
    ) : (
      <BarChart data={animatedBars} margin={margin} maxBarSize={barMaxSize}>
        <CartesianGrid stroke={GRID_INK} strokeDasharray="5 6" vertical={false} />
        <XAxis dataKey="label" axisLine={AXIS_LINE} label={xLabel} {...xProps(rows.map((r) => r.label), false)} interval={0} minTickGap={0} tickLine={false} />
        <YAxis
          axisLine={AXIS_LINE} tickLine={TICK_LINE} tick={yTickStyle} width={yWidth}
          domain={customYAxis ? customYAxis.domain : [0, axisTop]}
          ticks={customYAxis?.ticks} tickFormatter={yFmt} label={yLabel}
        />
        <Bar dataKey="value" fill={series[0]} radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {showBarLabels && (
            <LabelList dataKey="value" position="top" offset={8}
              formatter={(v) => formatBarLabel(v as number)}
              fill={axisInk} fontSize={valueLabelFs} fontWeight={700} fontFamily={font} />
          )}
        </Bar>
      </BarChart>
    );

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <MeasuredChart>{chart}</MeasuredChart>
      </div>
    </div>
  );
};

/** Auto chart-summary string (one-liner insight) for an optional caption. */
export function autoChartSummary(chartTable?: ChartTableShape, chartType?: string): string {
  const inputs = resolveChartInputs(chartTable);
  const kind = selectChartType(chartType as Parameters<typeof selectChartType>[0], inputs);
  return buildAutoChartSummary(orientChartInputsForType(inputs, kind), kind);
}
