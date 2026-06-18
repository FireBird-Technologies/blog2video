import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import type { SceneLayoutProps } from "../types";
import { FootballPitchBackdrop, FROSTED_CARD_STYLE, estimateWrappedTextHeight } from "./FootballPitchBackdrop";
import {
  resolveChartInputs,
  selectChartType,
  orientChartInputsForType,
  filterBarChartNonNegativeRows,
  getAxisUpperBound,
  normalizeHex,
  buildAutoChartSummary,
  easeInOutCubic,
  clampProgressAt,
  formatAxisTick,
  formatLineLabel,
} from "../../_shared/chartData";
import { MeasuredChart } from "../../_shared/MeasuredChart";

const HAND_FONT = "'Patrick Hand', system-ui, sans-serif";
const MAX_CHART_ROWS = 10;
const GRID_INK = "rgba(17,17,17,0.14)";

// ── Hand-drawn (sketchy) geometry helpers ────────────────────────────────────
// All wobble is DETERMINISTIC (seeded by position), never frame-random, so the
// strokes stay rock-steady across a headless render instead of shimmering.
const handRand = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x); // 0..1
};
// Signed jitter in [-amp, amp] from an integer-ish seed.
const jitter = (seed: number, amp: number): number => (handRand(seed) - 0.5) * 2 * amp;

// A wobbly line from (x1,y1)→(x2,y2): a quadratic curve whose control point is
// nudged perpendicular to the line, so a straight edge looks freehand.
const handLine = (x1: number, y1: number, x2: number, y2: number, seed: number, amp = 2): string => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len; // unit normal
  const ny = dx / len;
  const off = jitter(seed, amp);
  const mx = (x1 + x2) / 2 + nx * off;
  const my = (y1 + y2) / 2 + ny * off;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
};

// A hand-sketched bar/column: corners jittered, edges bow a touch, and — crucially —
// the TOP is drawn as a freehand ROUNDED cap (asymmetric, slightly off so it looks
// drawn without a ruler) rather than a flat ruled edge.
const handRectPath = (x: number, y: number, w: number, h: number, seed: number, amp = 1.6): string => {
  if (h <= 0 || w <= 0) return "";
  const j = (k: number) => jitter(seed + k, amp);
  // How rounded the top is: ~25% of the bar width, capped so thin/short bars stay sane.
  const r = Math.min(w * 0.28, h * 0.6, 16) + handRand(seed + 20) * 4;
  // Side ends just below where the rounded top begins.
  const x0 = x + j(1), y0 = y + r + j(2);            // top-left (start of left→top arc)
  const x1 = x + w + j(3), y1 = y + r + j(4);        // top-right (end of top→right arc)
  const x2 = x + w + j(5), y2 = y + h + j(6);        // bottom-right
  const x3 = x + j(7), y3 = y + h + j(8);            // bottom-left
  // Top apex: a single freehand crest, nudged off-centre and up a hair (over-drawn).
  const apexX = x + w * (0.46 + handRand(seed + 30) * 0.12); // off-centre crest
  const apexY = y - handRand(seed + 31) * (amp + 1.5);       // slightly above the box top
  const rightB = j(10), botB = j(11), leftB = j(12);
  return (
    // start at top-left side
    `M ${x0.toFixed(1)} ${y0.toFixed(1)} ` +
    // freehand rounded top: left corner up over the crest and down to the right corner
    `C ${(x0 + j(13)).toFixed(1)} ${(y - r * 0.5 + j(14)).toFixed(1)} ` +
      `${(apexX - w * 0.18).toFixed(1)} ${apexY.toFixed(1)} ` +
      `${apexX.toFixed(1)} ${apexY.toFixed(1)} ` +
    `C ${(apexX + w * 0.18).toFixed(1)} ${apexY.toFixed(1)} ` +
      `${(x1 + j(15)).toFixed(1)} ${(y - r * 0.5 + j(16)).toFixed(1)} ` +
      `${x1.toFixed(1)} ${y1.toFixed(1)} ` +
    // right side (bowed)
    `Q ${((x1 + x2) / 2 + rightB).toFixed(1)} ${((y1 + y2) / 2).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)} ` +
    // bottom (bowed)
    `Q ${((x2 + x3) / 2).toFixed(1)} ${((y2 + y3) / 2 + botB).toFixed(1)} ${x3.toFixed(1)} ${y3.toFixed(1)} ` +
    // left side (bowed) back to start
    `Q ${((x3 + x0) / 2 + leftB).toFixed(1)} ${((y3 + y0) / 2).toFixed(1)} ${x0.toFixed(1)} ${y0.toFixed(1)} Z`
  );
};

// A wavy multi-point path (for the line series). Each straight segment between two
// data points is broken into several sub-steps that undulate side-to-side along the
// segment (alternating perpendicular offsets), so the join between two points reads
// like a hand-drawn wiggle rather than a ruled straight line. The data points
// themselves are hit exactly.
const handPath = (pts: { x: number; y: number }[], seed: number, amp = 2.2): string => {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  const WIGGLES = 3; // undulations per segment
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len; // perpendicular unit
    const ny = dx / len;
    // Walk the segment in small quadratic steps, pushing the control points to
    // alternating sides of the line so it snakes between the two data points.
    for (let s = 1; s <= WIGGLES; s++) {
      const t0 = (s - 1) / WIGGLES;
      const t1 = s / WIGGLES;
      const tm = (t0 + t1) / 2;
      const ex = a.x + dx * t1;
      const ey = a.y + dy * t1;
      // Alternate the bump side each step; vary the amount a little per position.
      const dir = s % 2 === 0 ? -1 : 1;
      const mag = amp * (0.7 + handRand(seed + i * 9.1 + s * 3.7) * 0.6);
      const cx = a.x + dx * tm + nx * dir * mag;
      const cy = a.y + dy * tm + ny * dir * mag;
      d += ` Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    }
  }
  return d;
};

export const FootballDataViz: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor,
    textColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
    chartTable,
    chartType,
    chartSummary = "",
    subtitle = "",
    yAxisLabel = "",
    chartYAxisTicks,
    barPrimaryColor,
    barSecondaryColor,
    barTertiaryColor,
  } = props;

  const p = aspectRatio === "portrait";
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;
  const accent = accentColor ?? "#2E7D32";
  const text = textColor ?? "#111111";
  const font = fontFamily ?? HAND_FONT;

  const W = p ? 1080 : 1920;
  const H = p ? 1920 : 1080;

  const titlePx = titleFontSize ?? (p ? 66 : 64);
  const descPx = descriptionFontSize ?? (p ? 41 : 36);
  const tickPx = Math.round(descPx * 0.82);

  const enter = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [dur - 16, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sceneOpacity = enter * exit;
  const titleOp = interpolate(frame, [8, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const underline = interpolate(frame, [18, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cardOp = interpolate(frame, [12, 32], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const hasRealChart = useMemo(() => {
    const rows = chartTable?.rows ?? [];
    return Array.isArray(rows) && rows.length >= 1;
  }, [chartTable]);

  const limitedChartTable = useMemo(() => {
    if (!chartTable?.rows?.length) return chartTable;
    return { ...chartTable, rows: chartTable.rows.slice(0, MAX_CHART_ROWS) };
  }, [chartTable]);

  const chartInputsRaw = useMemo(() => resolveChartInputs(limitedChartTable), [limitedChartTable]);
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

  const barColors = [
    normalizeHex(barPrimaryColor, accent),
    normalizeHex(barSecondaryColor, "#C0563B"),
    normalizeHex(barTertiaryColor, "#E0B000"),
  ] as const;

  const tableAxisHeaders = useMemo(() => {
    const h = chartTable?.headers ?? [];
    return { category: String(h[0] ?? "").trim(), value: String(h[1] ?? "").trim() };
  }, [chartTable]);

  const xAxisLegendLabel = (tableAxisHeaders.category || "X Axis").trim();
  const yAxisLegendLabel = (yAxisLabel || tableAxisHeaders.value || "Y Axis").trim();

  const hasComparisonBars = chartInputs.lineSeries.length >= 2 && chartInputs.labels.length >= 2;
  const barRows =
    resolvedChartType === "histogram"
      ? chartInputs.histogramRows
      : chartInputs.barRows;
  const barDataMax = Math.max(
    0,
    ...(hasComparisonBars
      ? chartInputs.labels.flatMap((_, i) =>
          chartInputs.lineSeries.slice(0, 3).map((s) => Math.abs(s.values[i] ?? 0)),
        )
      : barRows.map((r) => Math.abs(r.value))),
  );
  const lineMax = Math.max(
    0,
    ...chartInputs.lineSeries.flatMap((s) => s.values.map((v) => Math.abs(v))),
  );
  const axisTop = getAxisUpperBound(
    resolvedChartType === "line" ? lineMax : barDataMax,
  );

  const lineDrawFrames = Math.max(48, Math.round(fps * 2.6));
  const lineReveal = easeInOutCubic(clampProgressAt(frame, 0, lineDrawFrames));
  const barGrowFrames = Math.max(12, Math.round(fps * 0.9));
  const barStep = Math.max(4, Math.round(fps * 0.12));
  const barCount = hasComparisonBars
    ? chartInputs.labels.length * Math.min(3, chartInputs.lineSeries.length)
    : barRows.length;

  const clampBar = (i: number) =>
    easeInOutCubic(clampProgressAt(frame, i * barStep, barGrowFrames));

  const cardInsetX = W * (p ? 0.07 : 0.08);
  const cardW = W - cardInsetX * 2;
  const narrFontSize = descPx * 0.88;
  const narrBottom = p ? H * 0.05 : H * 0.045;
  const narrGap = p ? 18 : 16;
  const titleTop = p ? H * 0.06 : H * 0.07;
  const titleCardGap = p ? 16 : 12;
  const cardNarrGap = p ? 16 : 0;
  const titleUnderlineH = 12;
  const titleTextH = title
    ? estimateWrappedTextHeight(title, cardW, titlePx, 1.15)
    : 0;
  const titleBlockH = title ? titleTextH + titleUnderlineH : 0;
  const narrHeight = narration
    ? estimateWrappedTextHeight(narration, cardW, narrFontSize, 1.4)
    : 0;
  const cardInsetY = titleTop + titleBlockH + titleCardGap;
  const belowCardReserve = p
    ? cardNarrGap + narrHeight + narrBottom
    : (narration ? narrHeight + narrGap : 0) + narrBottom;
  const availableCardH = H - cardInsetY - belowCardReserve;
  const absoluteMinCardH = H * 0.12;
  const cardH = Math.max(absoluteMinCardH, availableCardH);
  const portraitNarrTop = cardInsetY + cardH + cardNarrGap;
  const margin = { top: 44, right: 28, bottom: p ? 56 : 48, left: 76 };
  const yAxisLineX = margin.left;
  const yTickLabelX = yAxisLineX - 14;
  const plotW = cardW - margin.left - margin.right;
  const summaryReserve = summaryText ? estimateWrappedTextHeight(summaryText, cardW - 48, descPx * 0.92, 1.45) + 24 : 0;
  const plotH = Math.max(0, cardH - margin.top - margin.bottom - summaryReserve);
  const xTickY = margin.top + plotH + Math.round(tickPx * 0.85);
  const isHistogram = resolvedChartType === "histogram";

  const yTicks = [0, axisTop * 0.33, axisTop * 0.66, axisTop];
  const toPlotY = (v: number) => margin.top + plotH - (v / axisTop) * plotH;

  const renderBarRects = (
    labels: string[],
    getValue: (i: number, si?: number) => number,
    opts: { grouped?: boolean; histogram?: boolean },
  ) => {
    const n = labels.length;
    if (n === 0) return null;
    const grouped = opts.grouped ?? false;
    const histogram = opts.histogram ?? false;
    const groupW = plotW / n;
    const elements: React.ReactNode[] = [];

    labels.forEach((label, i) => {
      if (grouped) {
        const seriesCount = Math.min(3, chartInputs.lineSeries.length);
        const innerW = histogram ? groupW * 0.88 : groupW * 0.76;
        const gx = margin.left + i * groupW + (groupW - innerW) / 2;
        const bw = histogram
          ? (innerW - (seriesCount - 1) * 3) / seriesCount
          : innerW / seriesCount - 4;
        chartInputs.lineSeries.slice(0, 3).forEach((series, si) => {
          const raw = getValue(i, si);
          const prog = clampBar(i * seriesCount + si);
          const h = (Math.abs(raw) / axisTop) * plotH * prog;
          const x = histogram ? gx + si * (bw + 3) : gx + si * (bw + 4);
          const y = margin.top + plotH - h;
          const seed = (i + 1) * 53.1 + (si + 1) * 17.7;
          const d = handRectPath(x, y, bw, h, seed, histogram ? 1.3 : 1.6);
          elements.push(
            <path
              key={`b-${i}-${si}`}
              d={d}
              fill={barColors[si]}
              fillOpacity={histogram ? 0.82 : 0.85}
              stroke={text}
              strokeWidth={histogram ? 2 : 2.2}
              strokeOpacity={histogram ? 0.7 : 0.6}
              strokeLinejoin="round"
              strokeLinecap="round"
            />,
          );
        });
      } else {
        const innerW = histogram ? groupW * 0.94 : groupW * 0.62;
        const gx = margin.left + i * groupW + (groupW - innerW) / 2;
        const raw = getValue(i);
        const prog = clampBar(i);
        const h = (Math.abs(raw) / axisTop) * plotH * prog;
        const seed = (i + 1) * 53.1 + 7.3;
        const d = handRectPath(gx, margin.top + plotH - h, innerW, h, seed, histogram ? 1.3 : 1.8);
        elements.push(
          <path
            key={`b-${i}`}
            d={d}
            fill={barColors[0]}
            fillOpacity={histogram ? 0.82 : 0.88}
            stroke={text}
            strokeWidth={histogram ? 2 : 2.4}
            strokeOpacity={histogram ? 0.7 : 0.6}
            strokeLinejoin="round"
            strokeLinecap="round"
          />,
        );
      }
      elements.push(
        <text
          key={`xl-${i}`}
          x={margin.left + i * groupW + groupW / 2}
          y={xTickY}
          textAnchor="middle"
          fill={text}
          fontSize={tickPx}
          fontFamily={font}
          opacity={0.85}
        >
          {label.length > 10 ? `${label.slice(0, 9)}…` : label}
        </text>,
      );
    });
    return elements;
  };

  const renderBars = () => {
    const labels = hasComparisonBars ? chartInputs.labels : barRows.map((r) => r.label);
    return renderBarRects(
      labels,
      (i, si) => (hasComparisonBars ? chartInputs.lineSeries[si ?? 0]?.values[i] ?? 0 : barRows[i]?.value ?? 0),
      { grouped: hasComparisonBars, histogram: false },
    );
  };

  const renderHistogram = () => {
    const labels = hasComparisonBars ? chartInputs.labels : barRows.map((r) => r.label);
    return renderBarRects(
      labels,
      (i, si) => (hasComparisonBars ? chartInputs.lineSeries[si ?? 0]?.values[i] ?? 0 : barRows[i]?.value ?? 0),
      { grouped: hasComparisonBars, histogram: true },
    );
  };

  const renderLine = () => {
    const labels = chartInputs.labels;
    const n = labels.length;
    if (n === 0) return null;
    const stepX = n > 1 ? plotW / (n - 1) : 0;
    const elements: React.ReactNode[] = [];

    chartInputs.lineSeries.slice(0, 3).forEach((series, si) => {
      const pts = series.values.map((v, i) => ({
        x: margin.left + (n > 1 ? i * stepX : plotW / 2),
        y: toPlotY(Math.max(0, v)),
      }));
      // Hand-drawn wavy line through the data points (seeded so it never shimmers).
      const handD = handPath(pts, (si + 1) * 91.3, si === 0 ? 3.2 : 2.6);
      const dashTotal = plotW * 2.0; // generous over-estimate of the wavy path length
      const visibleLen = pts.length > 1 ? dashTotal * lineReveal : 0;
      elements.push(
        <path
          key={`line-${si}`}
          d={handD}
          fill="none"
          stroke={barColors[si]}
          strokeWidth={si === 0 ? 4.5 : 3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashTotal}
          strokeDashoffset={dashTotal - visibleLen}
          opacity={si === 0 ? 1 : 0.55 + si * 0.15}
        />,
      );
      if (si === 0 && pts.length > 1) {
        // Filled area under the hand-drawn line (reuse the exact same wavy top edge).
        const areaD =
          handPath(pts, (si + 1) * 91.3, 3.2) +
          ` L ${(margin.left + plotW).toFixed(1)} ${(margin.top + plotH).toFixed(1)}` +
          ` L ${margin.left.toFixed(1)} ${(margin.top + plotH).toFixed(1)} Z`;
        elements.push(
          <path
            key="area-0"
            d={areaD}
            fill={barColors[0]}
            fillOpacity={0.12 * lineReveal}
            stroke="none"
          />,
        );
      }
      series.values.forEach((v, i) => {
        if (lineReveal < (i + 1) / n - 0.05) return;
        const x = margin.left + (n > 1 ? i * stepX : plotW / 2);
        const y = toPlotY(Math.max(0, v));
        elements.push(
          <circle key={`dot-${si}-${i}`} cx={x + jitter(si * 31 + i * 13 + 1, 0.8)} cy={y + jitter(si * 31 + i * 13 + 2, 0.8)} r={4.2} fill="#FFFFFF" stroke={barColors[si]} strokeWidth={2.4} />,
        );
        if (n <= 8) {
          elements.push(
            <text key={`vl-${si}-${i}`} x={x} y={y - 10} textAnchor="middle" fill={barColors[si]} fontSize={tickPx - 2} fontFamily={font} fontWeight={700}>
              {formatLineLabel(v)}
            </text>,
          );
        }
      });
    });
    labels.forEach((label, i) => {
      const x = margin.left + (n > 1 ? i * stepX : plotW / 2);
      elements.push(
        <text key={`x-${i}`} x={x} y={xTickY} textAnchor="middle" fill={text} fontSize={tickPx} fontFamily={font} opacity={0.85}>
          {label.length > 10 ? `${label.slice(0, 9)}…` : label}
        </text>,
      );
    });
    return elements;
  };

  type LegendEntry = { kind: "label"; text: string } | { kind: "series"; text: string; color: string };
  const legendEntries: LegendEntry[] = [];
  if (xAxisLegendLabel) legendEntries.push({ kind: "label", text: `X: ${xAxisLegendLabel}` });
  if (yAxisLegendLabel) legendEntries.push({ kind: "label", text: `Y: ${yAxisLegendLabel}` });
  if (hasComparisonBars) {
    chartInputs.lineSeries.slice(0, 3).forEach((s, i) => {
      if (s.label) legendEntries.push({ kind: "series", text: s.label, color: barColors[i] });
    });
  }
  const legendFont = tickPx - 2;
  const legendEntryGap = 22;
  const legendPadY = 10;
  const legendSwatch = 14;
  const legendTextW = (s: string) => Math.max(28, s.length * legendFont * 0.56);
  const legendItemWidths = legendEntries.map((e) =>
    e.kind === "label" ? legendTextW(e.text) : legendSwatch + 10 + legendTextW(e.text),
  );
  const legendTotalW =
    legendItemWidths.reduce((sum, w) => sum + w, 0) + legendEntryGap * Math.max(0, legendEntries.length - 1);
  const legendRowH = legendSwatch + legendPadY * 2;
  const legendTopY = margin.top - legendRowH - 2;
  const legendStartX = margin.left + plotW - legendTotalW;
  const legendRowTop = legendTopY + legendPadY;

  const renderLegend = () => {
    if (legendEntries.length === 0) return null;
    let x = legendStartX;
    return (
      <g>
        {legendEntries.map((entry, i) => {
          const itemW = legendItemWidths[i];
          const node = (
            <g key={`leg-${i}`} transform={`translate(${x}, ${legendRowTop})`}>
              {entry.kind === "series" && (
                <path
                  d={handRectPath(0, 0, legendSwatch, legendSwatch, 500 + i * 13, 1.1)}
                  fill={entry.color}
                  stroke={text}
                  strokeWidth={1.2}
                  strokeOpacity={0.45}
                  strokeLinejoin="round"
                />
              )}
              <text
                x={entry.kind === "series" ? legendSwatch + 10 : 0}
                y={legendSwatch * 0.82}
                fill={text}
                fontSize={legendFont}
                fontFamily={font}
                opacity={entry.kind === "label" ? 0.78 : 1}
              >
                {entry.text}
              </text>
            </g>
          );
          x += itemW + legendEntryGap;
          return node;
        })}
      </g>
    );
  };

  const FootballChartGraphic: React.FC<{ width: number; height: number }> = ({ width, height }) => (
    <svg width={width} height={height} viewBox={`0 0 ${cardW} ${cardH}`} preserveAspectRatio="xMidYMid meet">
      {yTicks.map((t, i) => {
        const y = toPlotY(t);
        return (
          <g key={`yt-${i}`}>
            <path d={handLine(yAxisLineX, y, yAxisLineX + plotW, y, 200 + i * 9, 1.6)} fill="none" stroke={GRID_INK} strokeWidth={1.5} strokeDasharray="5 6" strokeLinecap="round" />
            <text x={yTickLabelX} y={y + 5} textAnchor="end" fill={text} fontSize={tickPx - 1} fontFamily={font} opacity={0.75}>
              {formatAxisTick(t)}
            </text>
          </g>
        );
      })}
      {isHistogram &&
        barRows.map((_, i) => {
          const groupW = plotW / Math.max(barRows.length, 1);
          const x = yAxisLineX + i * groupW;
          return (
            <path
              key={`hv-${i}`}
              d={handLine(x, margin.top, x, margin.top + plotH, 300 + i * 11, 1.4)}
              fill="none"
              stroke={GRID_INK}
              strokeWidth={1}
              strokeOpacity={0.45}
              strokeLinecap="round"
            />
          );
        })}
      {/* Hand-drawn axes (double-stroked for a sketched look). */}
      <path d={handLine(yAxisLineX, margin.top + plotH, yAxisLineX + plotW, margin.top + plotH, 401, 2)} fill="none" stroke={text} strokeWidth={2.4} strokeOpacity={0.6} strokeLinecap="round" />
      <path d={handLine(yAxisLineX, margin.top + plotH, yAxisLineX + plotW, margin.top + plotH, 402, 1.4)} fill="none" stroke={text} strokeWidth={1.4} strokeOpacity={0.35} strokeLinecap="round" />
      <path d={handLine(yAxisLineX, margin.top, yAxisLineX, margin.top + plotH, 403, 2)} fill="none" stroke={text} strokeWidth={2.4} strokeOpacity={0.6} strokeLinecap="round" />
      <path d={handLine(yAxisLineX, margin.top, yAxisLineX, margin.top + plotH, 404, 1.4)} fill="none" stroke={text} strokeWidth={1.4} strokeOpacity={0.35} strokeLinecap="round" />
      {resolvedChartType === "line" ? renderLine() : isHistogram ? renderHistogram() : renderBars()}
      {renderLegend()}
    </svg>
  );

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity, overflow: "hidden", fontFamily: font }}>
      <FootballPitchBackdrop W={W} H={H} p={p} accent={accent} frame={frame} fps={fps} />

      {!p ? (
        <div
          style={{
            position: "absolute",
            top: titleTop,
            left: cardInsetX,
            right: cardInsetX,
            opacity: titleOp,
            pointerEvents: "none",
          }}
        >
          <div style={{ fontSize: titlePx, fontWeight: 700, color: text, textTransform: "uppercase", letterSpacing: "0.02em" }}>
            {title}
          </div>
          <div
            style={{
              marginTop: 8,
              height: 4,
              width: "38%",
              background: accent,
              transformOrigin: "left center",
              transform: `scaleX(${underline})`,
              borderRadius: 2,
            }}
          />
        </div>
      ) : title ? (
        <div
          style={{
            position: "absolute",
            top: titleTop,
            left: cardInsetX,
            right: cardInsetX,
            opacity: titleOp,
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontSize: titlePx, fontWeight: 700, color: text, textTransform: "uppercase", letterSpacing: "0.02em" }}>
            {title}
          </div>
          <div
            style={{
              marginTop: 8,
              marginLeft: "auto",
              marginRight: "auto",
              height: 4,
              width: "55%",
              background: accent,
              transformOrigin: "center center",
              transform: `scaleX(${underline})`,
              borderRadius: 2,
            }}
          />
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: cardInsetX,
          top: cardInsetY,
          width: cardW,
          height: cardH,
          opacity: cardOp,
          ...FROSTED_CARD_STYLE,
          padding: p ? "20px 18px" : "22px 24px",
          boxSizing: "border-box",
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {!hasRealChart ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: text, fontSize: descPx, fontStyle: "italic", opacity: 0.65 }}>
            No data yet — add a table by editing this scene
          </div>
        ) : (
          <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                bottom: summaryReserve,
                boxSizing: "border-box",
              }}
            >
              <MeasuredChart>
                <FootballChartGraphic width={0} height={0} />
              </MeasuredChart>
            </div>
          </div>
        )}

        {summaryText && hasRealChart && (
          <div
            style={{
              position: "absolute",
              left: 24,
              right: 24,
              bottom: 16,
              fontSize: descPx * 0.92,
              lineHeight: 1.45,
              color: text,
              opacity: interpolate(frame, [24, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}
          >
            {summaryText.split(/(__[^_]+__)/).map((seg, i) =>
              seg.startsWith("__") && seg.endsWith("__") ? (
                <span key={i} style={{ color: accent, fontWeight: 700 }}>{seg.slice(2, -2)}</span>
              ) : (
                <span key={i}>{seg}</span>
              ),
            )}
          </div>
        )}
      </div>

      {narration && (
        <div
          style={{
            position: "absolute",
            left: cardInsetX,
            right: cardInsetX,
            ...(p
              ? { top: portraitNarrTop, textAlign: "center" as const }
              : { bottom: narrBottom }),
            fontSize: narrFontSize,
            color: text,
            opacity: interpolate(frame, [28, 48], [0, 0.85], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            lineHeight: 1.4,
            wordBreak: "break-word",
            overflowWrap: "break-word",
          }}
        >
          {narration}
        </div>
      )}
    </AbsoluteFill>
  );
};
