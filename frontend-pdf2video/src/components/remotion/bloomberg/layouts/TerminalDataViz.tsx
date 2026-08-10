import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
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
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY, derivePalette } from "../constants";
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
  xAxisLabel: string;
  yAxisLabel: string;
}

function parseChartTable(
  tbl: BloombergLayoutProps["chartTable"] | undefined,
): ChartInputs {
  const empty: ChartInputs = { labels: [], series: [], barRows: [], xAxisLabel: "", yAxisLabel: "" };
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

  const xAxisLabel = headers[0] || "";
  const yAxisLabel = headers[1] || "";

  return { labels, series, barRows, xAxisLabel, yAxisLabel };
}

function resolvedChartType(
  requested: BloombergChartType | undefined,
  inputs: ChartInputs,
): "bar" | "line" | "histogram" {
  if (requested && requested !== "auto") return requested;
  // Time-like labels → prefer line
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
  xAxisLabel: xAxisLabelProp,
  yAxisLabel: yAxisLabelProp,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const amber = textColor || BLOOMBERG_COLORS.amber;
  const blue = accentColor || BLOOMBERG_COLORS.accent;
  const bg = bgColor || BLOOMBERG_COLORS.bg;
  const neg = BLOOMBERG_COLORS.neg;
  const { panelBg, headerBg, border, muted } = derivePalette(bg, amber);

  const tSize = titleFontSize ?? (p ? 103 : 144);
  const dSize = descriptionFontSize ?? (p ? 42 : 30);
  const labelSize = dSize * 0.4;
  const titleOp = interpolate(frame, [5, 22], [0, 1], { extrapolateRight: "clamp" });
  const panelOp = interpolate(frame, [10, 28], [0, 1], { extrapolateRight: "clamp" });

  const topH = p ? 56 : 48;
  const botH = p ? 44 : 36;
  const pad = p ? 36 : 44;

  // ── Chart data ────────────────────────────────────────────────────────────
  const inputs = useMemo(() => {
    const parsed = parseChartTable(chartTable);
    return {
      ...parsed,
      xAxisLabel: xAxisLabelProp ?? parsed.xAxisLabel,
      yAxisLabel: yAxisLabelProp ?? parsed.yAxisLabel,
    };
  }, [chartTable, xAxisLabelProp, yAxisLabelProp]);
  const chartType = useMemo(() => resolvedChartType(chartTypeProp, inputs), [chartTypeProp, inputs]);

  const hasMultiSeries = inputs.series.length >= 2;

  // Animation budget
  const barCount = inputs.barRows.length || 1;
  const barBudget = Math.min(fps * 3.5, durationInFrames * 0.75);
  const growFrames = Math.max(10, Math.min(Math.round(fps * 1.2), Math.round(barBudget * 0.6)));
  const stepFrames = barCount > 1 ? Math.max(3, Math.floor((barBudget - growFrames) / (barCount - 1))) : growFrames;

  const lineRevealFrames = Math.max(54, Math.round(fps * 3.2));
  const rawReveal = Math.max(0, Math.min(1, frame / lineRevealFrames));
  const lineReveal = easeInOutCubic(rawReveal);
  const showDots = rawReveal >= 1;

  // Bar animation
  const animatedBars = useMemo(() => inputs.barRows.map((row, i) => {
    const progress = easeInOutCubic(
      Math.max(0, Math.min(1, (frame - i * stepFrames) / growFrames))
    );
    return { ...row, value: row.value * progress };
  }), [frame, inputs.barRows, stepFrames, growFrames]);

  // Use static (non-animated) values so the Y-axis domain never changes during animation
  const barMax = useMemo(() => Math.max(0, ...inputs.barRows.map((r) => Math.abs(r.value))), [inputs.barRows]);
  const axisTop = useMemo(() => upperBound(barMax), [barMax]);

  // Line chart data
  const maxLen = Math.max(0, ...inputs.series.map((s) => s.values.length));
  const lineData = Array.from({ length: maxLen }).map((_, i) => ({
    label: inputs.labels[i] ?? `${i + 1}`,
    s0: inputs.series[0]?.values[i] ?? null,
    s1: inputs.series[1]?.values[i] ?? null,
    s2: inputs.series[2]?.values[i] ?? null,
  }));

  // Stabilize line chart rendering:
  // - reveal by nulling future points
  // - lock Y-axis domain to prevent vertical drift
  const allLineValues = inputs.series.flatMap((s) => s.values).filter((v) => Number.isFinite(v));
  const rawLineMin = allLineValues.length ? Math.min(...allLineValues) : 0;
  const rawLineMax = allLineValues.length ? Math.max(...allLineValues) : 1;
  const linePad = (rawLineMax - rawLineMin) * 0.06 || 1;
  const lineDomainMin = rawLineMin - linePad;
  const lineDomainMax = rawLineMax + linePad;

  const visibleLineN = Math.min(maxLen, Math.max(1, Math.floor(maxLen * lineReveal)));
  const revealedLineData = lineData.map((d, i) => {
    if (i < visibleLineN) return d;
    return { ...d, s0: null, s1: null, s2: null };
  });

  const yTicksStep = (lineDomainMax - lineDomainMin) / 4;
  const lineTicks = [
    lineDomainMin,
    lineDomainMin + yTicksStep,
    lineDomainMin + yTicksStep * 2,
    lineDomainMin + yTicksStep * 3,
    lineDomainMax,
  ].map((v) => Number(v.toFixed(2)));

  // lineColors[i] is the definitive color for series i — used in both chart rendering and legend
  const lineColors = [amber, blue, neg] as const;
  const barColors = [amber, blue, neg] as const;
  const useCompact = barCount >= 5 || barMax >= 10_000;

  const chartLabel = chartType === "line" ? "LINE CHART" : chartType === "histogram" ? "HISTOGRAM" : "BAR CHART";

  const chartTitleFont = Math.round(dSize * 0.75);
  // yAxisWidth: tick numbers + optional rotated title
  const yAxisWidth = Math.round(dSize * 3.2) + (inputs.yAxisLabel ? chartTitleFont + 8 : 0);
  // xReserve: space below the SVG for x-tick labels + optional x-axis title
  const xAxisTickH = Math.round(dSize * 1.7);
  const xTitleH = inputs.xAxisLabel ? chartTitleFont + 36 : 0;
  const xReserve = xAxisTickH + xTitleH;

  const padRight = p ? pad : pad + 340;
  const chartWidth = Math.round(Math.max(100, width - pad - padRight));
  // chartHeight = the SVG chart area only; ChartRenderer adds xReserve below it
  const titleH = topH + Math.round(tSize * 0.44) + 20;
  const narrationH = p ? Math.round(dSize * 0.62 * 3.5) + 20 : 0;
  const chartHeight = p
    ? Math.round(Math.max(100, height - titleH - (botH + 10) - narrationH - xReserve - 120))
    : Math.round(Math.max(100, height - (topH + tSize * 0.42 + 28) - (botH + 10) - xReserve));

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff, overflow: "hidden" }}>

      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: topH,
        backgroundColor: headerBg,
        
        display: "flex", alignItems: "center", padding: `0 ${pad}px`, gap: 16,

      }}>
        <div style={{ flex: 1 }} />
        <span style={{ color: blue, fontSize: labelSize * 0.95, letterSpacing: 2, fontWeight: 600 }}>{chartLabel}</span>
        <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: amber, display: "inline-block", opacity: 0.4 + 0.6 * Math.abs(Math.sin(frame / 7)) }} />
        <span style={{ color: amber, fontSize: labelSize, letterSpacing: 2 }}>LIVE</span>
      </div>

      {p ? (
        /* ── Portrait ──────────────────────────────────────────────────── */
        <>
          {/* Title */}
          <div style={{
            position: "absolute", top: topH + 12, left: pad, right: pad,
            fontSize: tSize * 0.44, opacity: titleOp, letterSpacing: -0.3, fontWeight: 600,
          }}>
            <span style={{ backgroundColor: amber, color: bg, display: "inline-block", padding: "3px 14px 6px" }}>{title}</span>
          </div>

          {/* Chart */}
          <div style={{
            position: "absolute",
            top: titleH,
            left: pad, right: pad,
            height: chartHeight + xReserve,
            overflow: "visible",
            opacity: panelOp,
          }}>
            <ChartRenderer
              chartType={chartType}
              animatedBars={animatedBars}
              staticBars={inputs.barRows}
              lineData={revealedLineData}
              hasMultiSeries={hasMultiSeries}
              axisTop={axisTop}
              lineDomain={[lineDomainMin, lineDomainMax]}
              lineTicks={lineTicks}
              yAxisWidth={yAxisWidth}
              muted={muted}
              bg={bg}
              lineColors={lineColors}
              barColors={barColors}
              amber={amber}
              useCompact={useCompact}
              showDots={showDots}
              seriesLabels={inputs.series.map((s) => s.label)}
              isPortrait
              ff={ff}
              chartWidth={chartWidth}
              chartHeight={chartHeight}
              xLabels={inputs.labels}
              dSize={dSize}
              xAxisLabel={inputs.xAxisLabel}
              yAxisLabel={inputs.yAxisLabel}
            />
          </div>

          {/* Narration */}
          <div style={{
            position: "absolute",
            top: titleH + chartHeight + xReserve + 12,
            left: pad, right: pad,
            bottom: botH + 10,
            color: amber, fontSize: dSize * 0.62, lineHeight: 1.5,
            overflow: "hidden",
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
            <span style={{ backgroundColor: amber, color: bg, display: "inline-block", padding: "3px 14px 6px" }}>{title}</span>
          </div>

          {/* Chart area */}
          <div style={{
            position: "absolute",
            top: topH + tSize * 0.42 + 28,
            left: pad,
            right: pad * 1 + (p ? 0 : 340),
            height: chartHeight + xReserve,
            overflow: "visible",
            opacity: panelOp,
          }}>
            <ChartRenderer
              chartType={chartType}
              animatedBars={animatedBars}
              staticBars={inputs.barRows}
              lineData={revealedLineData}
              hasMultiSeries={hasMultiSeries}
              axisTop={axisTop}
              lineDomain={[lineDomainMin, lineDomainMax]}
              lineTicks={lineTicks}
              yAxisWidth={yAxisWidth}
              muted={muted}
              bg={bg}
              lineColors={lineColors}
              barColors={barColors}
              amber={amber}
              useCompact={useCompact}
              showDots={showDots}
              seriesLabels={inputs.series.map((s) => s.label)}
              isPortrait={false}
              ff={ff}
              chartWidth={chartWidth}
              chartHeight={chartHeight}
              xLabels={inputs.labels}
              dSize={dSize}
              xAxisLabel={inputs.xAxisLabel}
              yAxisLabel={inputs.yAxisLabel}
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
              <div style={{ width: 6, height: 6, backgroundColor: lineColors[0], flexShrink: 0 }} />
              <span style={{ color: lineColors[0], fontSize: labelSize * 0.88, letterSpacing: 1.6, fontWeight: 600 }}>
                {chartLabel}
              </span>
            </div>
            {inputs.series.slice(0, 3).map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 10, height: 2, backgroundColor: lineColors[i], flexShrink: 0 }} />
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
  staticBars: Array<{ label: string; value: number }>;
  lineData: Array<{ label: string; s0: number | null; s1: number | null; s2: number | null }>;
  hasMultiSeries: boolean;
  axisTop: number;
  lineDomain: [number, number];
  lineTicks: number[];
  yAxisWidth: number;
  muted: string;
  bg: string;
  lineColors: readonly [string, string, string];
  barColors: readonly [string, string, string];
  amber: string;
  useCompact: boolean;
  showDots: boolean;
  seriesLabels: string[];
  isPortrait: boolean;
  ff: string;
  dSize: number;
  chartWidth: number;
  chartHeight: number;
  xLabels: string[];
  xAxisLabel: string;
  yAxisLabel: string;
}

const gridStroke = (amber: string) => `${amber}1A`;
const VALUE_STROKE = "rgba(0,0,0,0.85)";
const LBL_WEIGHT = 500;
const MARGIN = { top: 34, right: 42, left: 6, bottom: 8 };

// Static HTML Y-axis: renders tick labels as absolutely-positioned divs, never reflowed by recharts
const StaticYAxis: React.FC<{
  ticks: number[];
  domain: [number, number];
  width: number;
  height: number;
  formatter: (v: number) => string;
  ff: string;
  muted: string;
  fontSize: number;
  leftOffset?: number;
}> = ({ ticks, domain, width, height, formatter, ff, muted, fontSize, leftOffset = 0 }) => {
  const [dMin, dMax] = domain;
  const range = dMax - dMin || 1;
  return (
    <div style={{ position: "absolute", top: MARGIN.top, left: leftOffset, width, height, pointerEvents: "none" }}>
      {ticks.map((v) => {
        const pct = 1 - (v - dMin) / range;
        const top = Math.round(pct * height);
        return (
          <div key={v} style={{
            position: "absolute", top, right: 6,
            transform: "translateY(-50%)",
            color: muted, fontSize, fontFamily: ff, fontWeight: 600,
            whiteSpace: "nowrap", lineHeight: 1,
          }}>
            {formatter(v)}
          </div>
        );
      })}
    </div>
  );
};

// Static HTML X-axis: renders tick labels as absolutely-positioned divs.
// Only renders labels that actually fit — skips any label whose slot is
// narrower than the estimated text width, always keeping first and last.
const StaticXAxis: React.FC<{
  labels: string[];
  width: number;
  height: number;
  ff: string;
  muted: string;
  fontSize: number;
  leftOffset: number;
  topOffset: number;
}> = ({ labels, width, height, ff, muted, fontSize, leftOffset, topOffset }) => {
  const n = labels.length;
  if (n === 0) return null;
  const slotW = width / n;
  // Shrink font until the longest label fits its slot (min 8px)
  const longestChars = Math.max(...labels.map((l) => l.length));
  const charW = 0.58;
  const fittedSize = Math.max(8, Math.min(fontSize, Math.floor(slotW / (longestChars * charW))));
  return (
    <div style={{
      position: "absolute", left: leftOffset, top: topOffset,
      width, height, pointerEvents: "none",
      display: "flex",
    }}>
      {labels.map((lbl, i) => (
        <div key={i} style={{
          width: slotW, flexShrink: 0,
          paddingTop: 6,
          textAlign: "center",
          color: muted, fontSize: fittedSize, fontFamily: ff, fontWeight: 600,
          whiteSpace: "nowrap", lineHeight: 1,
          boxSizing: "border-box",
        }}>
          {lbl}
        </div>
      ))}
    </div>
  );
};

const ChartRenderer: React.FC<ChartRendererProps> = ({
  chartType, animatedBars, lineData, axisTop,
  lineDomain, lineTicks, yAxisWidth, muted, bg, lineColors, amber,
  useCompact, showDots, seriesLabels, ff, dSize,
  chartWidth, chartHeight, xLabels, xAxisLabel, yAxisLabel,
  isPortrait,
}) => {
  // All font sizes derived from dSize so they scale with the composition resolution
  const tickFont  = Math.round(dSize * 0.60);
  const valueFont = Math.round(dSize * 0.66);
  const titleFont = Math.round(dSize * 0.94);
  const dotR      = Math.round(dSize * 0.10);

  // In portrait, thin x-axis to at most 5 evenly-spaced labels to avoid overlap
  const xAxisH = Math.round(dSize * 2.0);
  const xTitleH = xAxisLabel ? titleFont + 28 : 0;
  const totalH = chartHeight + xAxisH + xTitleH + 8;
  const plotH = chartHeight - MARGIN.top - MARGIN.bottom;
  const yTitleW = yAxisLabel ? titleFont + 8 : 0;
  const yTickW = yAxisWidth - yTitleW;
  const plotW = chartWidth - yAxisWidth - MARGIN.left - MARGIN.right;

  const c0 = lineColors[0], c1 = lineColors[1], c2 = lineColors[2];
  const lastIndex = Math.max(0, lineData.length - 1);

  // Only label first, last, and the peak — suppress all others to avoid clutter
  const s0Values = lineData.map((d) => (typeof d.s0 === "number" ? d.s0 : -Infinity));
  const peakIdx = s0Values.indexOf(Math.max(...s0Values));
  const labelledIndices = new Set([0, lastIndex, peakIdx].filter((i) => i >= 0));

  const renderPrimaryLineValue = (props: unknown) => {
    if (isPortrait) return null; // portrait: no inline labels, y-axis ticks carry the scale
    const p = props as { x?: number; y?: number; value?: unknown; index?: number };
    const n = Number(p.value);
    if (!Number.isFinite(n)) return null;
    const idx = typeof p.index === "number" ? p.index : 0;
    if (!labelledIndices.has(idx)) return null;

    const rawX = Number(p.x ?? 0);
    const rawY = Number(p.y ?? 0);
    const anchor: "start" | "middle" | "end" =
      idx <= 0 ? "start" : idx >= lastIndex ? "end" : "middle";
    const xMin = MARGIN.left + 6;
    const xMax = chartWidth - MARGIN.right - 6;
    const x = Math.max(xMin, Math.min(xMax, rawX));
    const y = Math.max(MARGIN.top + valueFont, rawY - 2);

    return (
      <text x={x} y={y} fill={c0} fontSize={valueFont} fontWeight={LBL_WEIGHT}
        fontFamily={ff} textAnchor={anchor} stroke={VALUE_STROKE} strokeWidth={1} paintOrder="stroke">
        {fmtCompact(n)}
      </text>
    );
  };

  const yTitleEl = yAxisLabel ? (
    <div style={{
      position: "absolute", top: MARGIN.top, left: 0,
      width: yTitleW, height: plotH,
      display: "flex", justifyContent: "center", alignItems: "center",
      pointerEvents: "none",
    }}>
      <span style={{
        display: "block", transform: "rotate(-90deg)",
        color: `${amber}F0`, fontSize: titleFont, fontFamily: ff, fontWeight: 700,
        whiteSpace: "nowrap", letterSpacing: 1.2,
        background: `linear-gradient(180deg, ${amber}30, ${amber}12)`,
        border: `1px solid ${amber}66`,
        borderRadius: 4,
        padding: "2px 8px",
      }}>{yAxisLabel}</span>
    </div>
  ) : null;

  const xTitleEl = xAxisLabel ? (
    <div style={{
      position: "absolute",
      top: chartHeight + xAxisH + 10,
      left: yAxisWidth + MARGIN.left, width: plotW,
      textAlign: "center",
      pointerEvents: "none", whiteSpace: "nowrap",
    }}>
      <span style={{
        display: "inline-block",
        color: `${amber}F0`, fontSize: titleFont, fontFamily: ff, fontWeight: 700,
        letterSpacing: 1.2,
        background: `linear-gradient(180deg, ${amber}30, ${amber}12)`,
        border: `1px solid ${amber}66`,
        borderRadius: 4,
        padding: "2px 10px",
      }}>
        {xAxisLabel}
      </span>
    </div>
  ) : null;

  if (chartType === "line") {
    return (
      <div style={{ position: "relative", width: chartWidth, height: totalH }}>
        {yTitleEl}
        <StaticYAxis
          ticks={lineTicks} domain={lineDomain}
          width={yTickW} height={plotH}
          formatter={fmtTick} ff={ff} muted={muted} fontSize={tickFont}
          leftOffset={yTitleW}
        />
        <StaticXAxis
          labels={xLabels} width={plotW} height={xAxisH}
          ff={ff} muted={muted} fontSize={tickFont}
          leftOffset={yAxisWidth + MARGIN.left}
          topOffset={chartHeight}
        />
        {xTitleEl}
        <div style={{ position: "absolute", top: 0, left: 0 }}>
          <ComposedChart width={chartWidth} height={chartHeight} data={lineData} margin={MARGIN}>
            <defs>
              <linearGradient id="bb-line-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={c0} stopOpacity={0.25} />
                <stop offset="95%" stopColor={c0} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridStroke(amber)} vertical={false} />
            <XAxis dataKey="label" hide />
            <YAxis hide domain={lineDomain} ticks={lineTicks} width={yAxisWidth} />
            <Area type="monotone" dataKey="s0" stroke={c0} strokeWidth={3}
              fill="url(#bb-line-fill)" fillOpacity={1} isAnimationActive={false}
              dot={showDots ? { r: dotR, fill: c0, stroke: bg, strokeWidth: 1.5 } : false}
              activeDot={false}>
              {showDots && (
                <LabelList dataKey="s0" position="top" content={renderPrimaryLineValue} />
              )}
            </Area>
            {seriesLabels[1] && (
              <Area type="monotone" dataKey="s1" stroke={c1} strokeWidth={2.5}
                fill="none" strokeDasharray="6 4" isAnimationActive={false}
                dot={showDots ? { r: dotR - 1, fill: c1, stroke: bg, strokeWidth: 1.5 } : false}
                activeDot={false} />
            )}
            {seriesLabels[2] && (
              <Area type="monotone" dataKey="s2" stroke={c2} strokeWidth={2.5}
                fill="none" strokeDasharray="6 4" isAnimationActive={false}
                dot={showDots ? { r: dotR - 1, fill: c2, stroke: bg, strokeWidth: 1.5 } : false}
                activeDot={false} />
            )}
          </ComposedChart>
        </div>
      </div>
    );
  }

  // bar / histogram
  const yTickCount = 5;
  const yStep = axisTop / (yTickCount - 1);
  const yTicks = Array.from({ length: yTickCount }, (_, i) => Math.round(yStep * i));

  return (
    <div style={{ position: "relative", width: chartWidth, height: totalH }}>
      {yTitleEl}
      <StaticYAxis
        ticks={yTicks} domain={[0, axisTop]}
        width={yTickW} height={plotH}
        formatter={fmtTick} ff={ff} muted={muted} fontSize={tickFont}
        leftOffset={yTitleW}
      />
      <StaticXAxis
        labels={xLabels} width={plotW} height={xAxisH}
        ff={ff} muted={muted} fontSize={tickFont}
        leftOffset={yAxisWidth + MARGIN.left}
        topOffset={chartHeight}
      />
      {xTitleEl}
      <div style={{ position: "absolute", top: 0, left: 0 }}>
        <BarChart
          width={chartWidth} height={chartHeight}
          data={animatedBars} margin={MARGIN}
          barCategoryGap="18%" barGap={4}
        >
          <CartesianGrid stroke={gridStroke(amber)} vertical={false} />
          <XAxis dataKey="label" hide />
          <YAxis hide domain={[0, axisTop]} ticks={yTicks} width={yAxisWidth} />
          <Bar dataKey="value" isAnimationActive={false}
            radius={chartType === "histogram" ? [0, 0, 0, 0] : [4, 4, 0, 0]}
            maxBarSize={chartType === "histogram" ? 999 : 80}
            fill={amber}>
            {!isPortrait && (
              <LabelList dataKey="value" position="top" fill={amber}
                fontSize={valueFont} fontWeight={LBL_WEIGHT} fontFamily={ff}
                stroke={VALUE_STROKE} strokeWidth={1} paintOrder="stroke"
                formatter={(v: unknown) => (useCompact ? fmtBarLabel(v) : fmtCompact(Number(toNum(v as string | number | undefined))))} />
            )}
          </Bar>
        </BarChart>
      </div>
    </div>
  );
};
