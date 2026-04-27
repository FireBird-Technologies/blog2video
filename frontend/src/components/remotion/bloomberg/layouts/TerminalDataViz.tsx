import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY } from "../constants";
import type { BloombergChartType, BloombergLayoutProps } from "../types";

// ─── helpers ────────────────────────────────────────────────────────────────

const STRICT_NUM_RE =
  /^\s*\(?\s*[+\-]?\$?\s*\d[\d,]*(?:\.\d+)?\s*(?:%|[a-z]{1,12})?\s*\)?\s*$/i;

function toNum(v: string | number | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const raw = (v ?? "").toString().trim();
  if (!raw) return null;
  if (STRICT_NUM_RE.test(raw)) {
    const neg = raw.startsWith("(") && raw.endsWith(")");
    const n = Number(raw.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? (neg ? -Math.abs(n) : n) : null;
  }
  const compact = raw.replace(/[~≈]/g, "").replace(/\+/g, "").replace(/,/g, "").trim();
  const tok = compact.match(/-?\d*\.?\d+/)?.[0];
  if (!tok) return null;
  const n = Number(tok);
  if (!Number.isFinite(n)) return null;
  return (raw.startsWith("(") && raw.endsWith(")")) ? -Math.abs(n) : n;
}

function fmtTick(v: number): string {
  if (!Number.isFinite(v)) return "";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function fmtCompact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(1);
}

function fmtBarLabel(v: unknown): string {
  const n = toNum(v as string | number | undefined);
  return n === null ? "" : fmtCompact(n);
}

function upperBound(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const padded = max * 1.15;
  const mag = Math.pow(10, Math.floor(Math.log10(padded)));
  const step = mag / 2;
  return Math.ceil(padded / step) * step;
}

function easeInOutCubic(t: number): number {
  const p = Math.max(0, Math.min(1, t));
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

interface Series { label: string; values: number[] }
interface BarRow { label: string; value: number }

interface ChartInputs {
  labels: string[];
  series: Series[];
  barRows: BarRow[];
}

function parseChartTable(
  tbl: BloombergLayoutProps["chartTable"] | undefined,
): ChartInputs {
  const empty: ChartInputs = { labels: [], series: [], barRows: [] };
  if (!tbl) return empty;

  let rows = (tbl.rows ?? []).filter((r) => Array.isArray(r) && r.length >= 2);
  let headers = (tbl.headers ?? []).map((h) => String(h ?? "").trim());

  if (rows.length < 1) return empty;

  // Detect if first row is actually a header
  const synth = headers.length > 0 && headers.every((h) => /^col_\d+$/i.test(h));
  if ((headers.length === 0 || synth) && rows.length > 0) {
    const candidate = (rows[0] ?? []).map((c) => String(c ?? "").trim());
    const nonEmpty = candidate.filter(Boolean);
    const numericCount = nonEmpty.filter((c) => toNum(c) !== null).length;
    if (nonEmpty.length >= 2 && numericCount <= Math.floor(nonEmpty.length / 3)) {
      headers = candidate;
      rows = rows.slice(1);
    }
  }

  if (rows.length < 1) return empty;

  const colCount = Math.max(...rows.map((r) => r.length));
  const labels: string[] = [];
  const numCols: number[][] = Array.from({ length: colCount - 1 }, () => []);

  for (const row of rows) {
    labels.push(String(row[0] ?? "").trim() || `${labels.length + 1}`);
    for (let c = 1; c < colCount; c++) {
      const n = toNum((row[c] as string | number | undefined) ?? "");
      numCols[c - 1].push(n ?? NaN);
    }
  }

  const series: Series[] = numCols
    .map((values, i) => ({
      label: headers[i + 1] || `Series ${i + 1}`,
      values: values.filter((v) => Number.isFinite(v)),
    }))
    .filter((s) => s.values.length >= 2)
    .slice(0, 3);

  const primary = numCols[0] ?? [];
  const barRows: BarRow[] = labels.map((label, i) => ({
    label,
    value: Number.isFinite(primary[i]) ? primary[i] : 0,
  }));

  return { labels, series, barRows };
}

function resolvedChartType(
  requested: BloombergChartType | undefined,
  inputs: ChartInputs,
): "bar" | "line" | "histogram" {
  if (requested && requested !== "auto") return requested;
  // Time-like labels → prefer line (2+ points sufficient for a line chart)
  const timeLike = /^(q[1-4]|\d{4}|\d{1,2}[\/\-]\d{2,4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|start|now)/i;
  if (inputs.labels.length >= 2 && inputs.labels.some((l) => timeLike.test(l.trim()))) {
    return "line";
  }
  return "bar";
}

// ─── component ──────────────────────────────────────────────────────────────

export const TerminalDataViz: React.FC<BloombergLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
  aspectRatio = "landscape",
  chartType: chartTypeProp,
  chartTable,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const amber = textColor || BLOOMBERG_COLORS.amber;
  const blue = accentColor || BLOOMBERG_COLORS.accent;
  const bg = bgColor || BLOOMBERG_COLORS.bg;
  const neg = BLOOMBERG_COLORS.neg;
  const muted = BLOOMBERG_COLORS.muted;
  const border = BLOOMBERG_COLORS.border;
  const panelBg = BLOOMBERG_COLORS.panelBg;
  const headerBg = BLOOMBERG_COLORS.headerBg;

  const tSize = titleFontSize ?? (p ? 103 : 144);
  const dSize = descriptionFontSize ?? (p ? 54 : 38);
  const labelSize = dSize * 0.4;

  const headerOp = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [5, 22], [0, 1], { extrapolateRight: "clamp" });
  const panelOp = interpolate(frame, [10, 28], [0, 1], { extrapolateRight: "clamp" });

  const topH = p ? 56 : 48;
  const botH = p ? 44 : 36;
  const pad = p ? 36 : 44;

  // ── Chart data ────────────────────────────────────────────────────────────
  const inputs = useMemo(() => parseChartTable(chartTable), [chartTable]);
  const chartType = useMemo(() => resolvedChartType(chartTypeProp, inputs), [chartTypeProp, inputs]);

  const hasMultiSeries = inputs.series.length >= 2;
  const isLine = chartType === "line";

  // Animation budget
  const barCount = inputs.barRows.length || 1;
  const barBudget = Math.min(fps * 3.5, durationInFrames * 0.75);
  const growFrames = Math.max(10, Math.min(Math.round(fps * 1.2), Math.round(barBudget * 0.6)));
  const stepFrames = barCount > 1 ? Math.max(3, Math.floor((barBudget - growFrames) / (barCount - 1))) : growFrames;

  const lineRevealFrames = Math.max(54, Math.round(fps * 3.2));
  const rawReveal = Math.max(0, Math.min(1, frame / lineRevealFrames));
  const lineReveal = easeInOutCubic(rawReveal);
  const lineClipRight = ((1 - lineReveal) * 100).toFixed(2);
  const showDots = rawReveal >= 1;

  // Bar animation
  const animatedBars = useMemo(() => inputs.barRows.map((row, i) => {
    const progress = easeInOutCubic(
      Math.max(0, Math.min(1, (frame - i * stepFrames) / growFrames))
    );
    return { ...row, value: row.value * progress };
  }), [frame, inputs.barRows, stepFrames, growFrames]);

  const barMax = Math.max(0, ...inputs.barRows.map((r) => Math.abs(r.value)));
  const axisTop = upperBound(barMax);

  // Line chart data
  const maxLen = Math.max(0, ...inputs.series.map((s) => s.values.length));
  const lineData = Array.from({ length: maxLen }).map((_, i) => ({
    label: inputs.labels[i] ?? `${i + 1}`,
    s0: inputs.series[0]?.values[i] ?? null,
    s1: inputs.series[1]?.values[i] ?? null,
    s2: inputs.series[2]?.values[i] ?? null,
  }));

  // Colors
  const s0Vals = inputs.series[0]?.values ?? inputs.barRows.map((r) => r.value);
  const first = s0Vals[0] ?? 0;
  const last = s0Vals[s0Vals.length - 1] ?? first;
  const trendColor = last < first ? neg : last > first ? blue : amber;

  const barColors = [amber, blue, neg] as const;
  const useCompact = barCount >= 5 || barMax >= 10_000;

  // Chart type label
  const chartLabel = chartType === "line" ? "LINE CHART" : chartType === "histogram" ? "HISTOGRAM" : "BAR CHART";

  // Axis styles
  const axisTick = { fill: muted, fontSize: p ? 11 : 10, fontFamily: ff, fontWeight: 600 };
  const xAxisProps = {
    interval: 0 as const,
    tick: { ...axisTick, fontSize: p ? 12 : 10 },
    minTickGap: 4,
    angle: inputs.labels.length >= 8 ? (-35 as const) : (0 as const),
    textAnchor: inputs.labels.length >= 8 ? ("end" as const) : ("middle" as const),
    height: inputs.labels.length >= 8 ? (p ? 72 : 60) : (p ? 36 : 28),
  };
  const yAxisWidth = 52;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff }}>
      {/* Scanlines */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage:
          "repeating-linear-gradient(to bottom, rgba(255,179,64,0.02) 0px, rgba(255,179,64,0.02) 1px, transparent 1px, transparent 3px)",
        pointerEvents: "none",
      }} />

      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: topH,
        backgroundColor: headerBg,
        borderBottom: `2px solid ${amber}`,
        display: "flex", alignItems: "center", padding: `0 ${pad}px`, gap: 16,
        opacity: headerOp,
      }}>
        <div style={{ flex: 1 }} />
        <span style={{ color: blue, fontSize: labelSize * 0.95, letterSpacing: 2, fontWeight: 700 }}>{chartLabel}</span>
        <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: amber, display: "inline-block", opacity: 0.4 + 0.6 * Math.abs(Math.sin(frame / 7)) }} />
        <span style={{ color: amber, fontSize: labelSize, letterSpacing: 2 }}>LIVE</span>
      </div>

      {p ? (
        /* ── Portrait ──────────────────────────────────────────────────── */
        <>
          {/* Title */}
          <div style={{
            position: "absolute", top: topH + 12, left: pad, right: pad,
            fontSize: tSize * 0.48, opacity: titleOp, letterSpacing: -0.5, fontWeight: "bold",
          }}>
            <span style={{ backgroundColor: amber, color: "#000000", display: "inline-block", padding: "3px 14px 6px" }}>{title}</span>
          </div>

          {/* Chart */}
          <div style={{
            position: "absolute",
            top: topH + tSize * 0.48 + 30,
            left: pad, right: pad,
            height: "40%",
            opacity: panelOp,
            clipPath: isLine ? `inset(0 ${lineClipRight}% 0 0)` : undefined,
          }}>
            <ChartRenderer
              chartType={chartType}
              animatedBars={animatedBars}
              lineData={lineData}
              hasMultiSeries={hasMultiSeries}
              axisTop={axisTop}
              xAxisProps={xAxisProps}
              yAxisWidth={yAxisWidth}
              axisTick={axisTick}
              barColors={barColors}
              trendColor={trendColor}
              blue={blue}
              neg={neg}
              amber={amber}
              useCompact={useCompact}
              showDots={showDots}
              seriesLabels={inputs.series.map((s) => s.label)}
              isPortrait
              ff={ff}
              labelSize={labelSize}
            />
          </div>

          {/* Narration */}
          <div style={{
            position: "absolute",
            bottom: botH + 10, left: pad, right: pad,
            color: amber, fontSize: dSize * 0.62, lineHeight: 1.5,
            opacity: panelOp,
          }}>
            {narration}
          </div>
        </>
      ) : (
        /* ── Landscape ─────────────────────────────────────────────────── */
        <>
          {/* Title row */}
          <div style={{
            position: "absolute", top: topH + 10, left: pad, right: pad,
            fontSize: tSize * 0.42, opacity: titleOp, letterSpacing: -0.5,
          }}>
            <span style={{ backgroundColor: amber, color: "#000000", display: "inline-block", padding: "3px 14px 6px" }}>{title}</span>
          </div>

          {/* Chart area */}
          <div style={{
            position: "absolute",
            top: topH + tSize * 0.42 + 28,
            left: pad,
            right: pad * 1 + (p ? 0 : 340),
            bottom: botH + 10,
            opacity: panelOp,
            clipPath: isLine ? `inset(0 ${lineClipRight}% 0 0)` : undefined,
          }}>
            <ChartRenderer
              chartType={chartType}
              animatedBars={animatedBars}
              lineData={lineData}
              hasMultiSeries={hasMultiSeries}
              axisTop={axisTop}
              xAxisProps={xAxisProps}
              yAxisWidth={yAxisWidth}
              axisTick={axisTick}
              barColors={barColors}
              trendColor={trendColor}
              blue={blue}
              neg={neg}
              amber={amber}
              useCompact={useCompact}
              showDots={showDots}
              seriesLabels={inputs.series.map((s) => s.label)}
              isPortrait={false}
              ff={ff}
              labelSize={labelSize}
            />
          </div>

          {/* Right analysis panel */}
          <div style={{
            position: "absolute",
            top: topH + tSize * 0.42 + 28,
            right: pad,
            width: 310,
            bottom: botH + 10,
            backgroundColor: panelBg,
            border: `1px solid ${border}`,
            borderLeft: `3px solid ${amber}`,
            padding: "20px 22px",
            display: "flex", flexDirection: "column", gap: 14,
            opacity: panelOp,
          }}>
            <div style={{ color: muted, fontSize: labelSize * 0.9, letterSpacing: 4, textTransform: "uppercase" }}>
              Data Analysis
            </div>
            <div style={{ height: 1, background: `linear-gradient(90deg, ${amber}, ${amber}00)` }} />
            <div style={{ color: amber, fontSize: dSize * 0.68, lineHeight: 1.55, flex: 1 }}>
              {narration}
            </div>
            <div style={{ height: 1, backgroundColor: border }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 6, height: 6, backgroundColor: trendColor, flexShrink: 0 }} />
              <span style={{ color: trendColor, fontSize: labelSize * 0.9, letterSpacing: 2, fontWeight: 700 }}>
                {chartLabel}
              </span>
            </div>
            {hasMultiSeries && inputs.series.slice(0, 3).map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 10, height: 2, backgroundColor: barColors[i], flexShrink: 0 }} />
                <span style={{ color: muted, fontSize: labelSize * 0.85, letterSpacing: 1 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Bottom bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: botH,
        backgroundColor: headerBg,
        borderTop: `1px solid ${border}`,
        display: "flex", alignItems: "center", padding: `0 ${pad}px`, justifyContent: "space-between",
      }}>
        <span style={{ color: muted, fontSize: labelSize, letterSpacing: 2 }}>
          DATA VISUALIZATION
        </span>
        <span style={{ color: muted, fontSize: labelSize, letterSpacing: 1 }}>
          {inputs.barRows.length || maxLen} DATA POINTS
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ─── ChartRenderer ──────────────────────────────────────────────────────────

interface ChartRendererProps {
  chartType: "bar" | "line" | "histogram";
  animatedBars: Array<{ label: string; value: number }>;
  lineData: Array<{ label: string; s0: number | null; s1: number | null; s2: number | null }>;
  hasMultiSeries: boolean;
  axisTop: number;
  xAxisProps: object;
  yAxisWidth: number;
  axisTick: object;
  barColors: readonly [string, string, string];
  trendColor: string;
  blue: string;
  neg: string;
  amber: string;
  useCompact: boolean;
  showDots: boolean;
  seriesLabels: string[];
  isPortrait: boolean;
  ff: string;
  labelSize: number;
}

const GRID_STROKE = "rgba(255,179,64,0.10)";
const VALUE_STROKE = "rgba(0,0,0,0.85)";
const LBL_WEIGHT = 800;
const LBL_SIZE = 11;

const ChartRenderer: React.FC<ChartRendererProps> = ({
  chartType, animatedBars, lineData, hasMultiSeries, axisTop,
  xAxisProps, yAxisWidth, axisTick, barColors, trendColor,
  blue, neg, amber, useCompact, showDots, seriesLabels, ff, labelSize,
}) => {
  const margin = { top: 10, right: 16, left: 4, bottom: 8 };

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={lineData} margin={margin}>
          <defs>
            <linearGradient id="bb-line-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={trendColor} stopOpacity={0.25} />
              <stop offset="95%" stopColor={trendColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} {...(xAxisProps as object)} />
          <YAxis axisLine={false} tickLine={false} tick={axisTick} width={yAxisWidth}
            domain={["auto", "auto"]} tickFormatter={(v) => fmtTick(Number(v))} />
          <Area type="monotone" dataKey="s0" stroke={trendColor} strokeWidth={2.5}
            fill="url(#bb-line-fill)" fillOpacity={1} isAnimationActive={false}
            dot={showDots ? { r: 2.5, fill: trendColor, stroke: "#000", strokeWidth: 1 } : false}
            activeDot={false}>
            {showDots && (
              <LabelList dataKey="s0" position="top" fill={trendColor}
                fontSize={LBL_SIZE} fontWeight={LBL_WEIGHT} fontFamily={ff}
                stroke={VALUE_STROKE} strokeWidth={0.9} paintOrder="stroke"
                formatter={(v: unknown) => fmtCompact(Number(v))} />
            )}
          </Area>
          {seriesLabels[1] && (
            <Area type="monotone" dataKey="s1" stroke={blue} strokeWidth={2}
              fill="none" strokeDasharray="5 4" isAnimationActive={false}
              dot={showDots ? { r: 2, fill: blue, stroke: "#000", strokeWidth: 1 } : false}
              activeDot={false} />
          )}
          {seriesLabels[2] && (
            <Area type="monotone" dataKey="s2" stroke={neg} strokeWidth={2}
              fill="none" strokeDasharray="5 4" isAnimationActive={false}
              dot={showDots ? { r: 2, fill: neg, stroke: "#000", strokeWidth: 1 } : false}
              activeDot={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  // bar / histogram
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={animatedBars} margin={margin}
        barCategoryGap="18%" barGap={4}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} {...(xAxisProps as object)} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} width={yAxisWidth}
          domain={[0, axisTop]} tickFormatter={(v) => fmtTick(Number(v))} />
        <Bar dataKey="value" isAnimationActive={false}
          radius={chartType === "histogram" ? [0, 0, 0, 0] : [3, 3, 0, 0]}
          maxBarSize={chartType === "histogram" ? 999 : 58}
          fill={amber}>
          <LabelList dataKey="value" position="top" fill={amber}
            fontSize={LBL_SIZE} fontWeight={LBL_WEIGHT} fontFamily={ff}
            stroke={VALUE_STROKE} strokeWidth={0.9} paintOrder="stroke"
            formatter={(v: unknown) => (useCompact ? fmtBarLabel(v) : fmtCompact(Number(toNum(v as string | number | undefined))))} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
