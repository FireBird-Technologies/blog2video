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
          elements.push(
            <rect
              key={`b-${i}-${si}`}
              x={x}
              y={y}
              width={bw}
              height={h}
              rx={histogram ? 2 : 4}
              fill={barColors[si]}
              fillOpacity={histogram ? 0.85 : 0.88}
              stroke={text}
              strokeWidth={histogram ? 1.8 : 1.2}
              strokeOpacity={histogram ? 0.55 : 0.35}
            />,
          );
        });
      } else {
        const innerW = histogram ? groupW * 0.94 : groupW * 0.62;
        const gx = margin.left + i * groupW + (groupW - innerW) / 2;
        const raw = getValue(i);
        const prog = clampBar(i);
        const h = (Math.abs(raw) / axisTop) * plotH * prog;
        elements.push(
          <rect
            key={`b-${i}`}
            x={gx}
            y={margin.top + plotH - h}
            width={innerW}
            height={h}
            rx={histogram ? 2 : 5}
            fill={barColors[0]}
            fillOpacity={histogram ? 0.85 : 0.9}
            stroke={text}
            strokeWidth={histogram ? 1.8 : 1.4}
            strokeOpacity={histogram ? 0.55 : 0.35}
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
      const pts = series.values.map((v, i) => {
        const x = margin.left + (n > 1 ? i * stepX : plotW / 2);
        const y = toPlotY(Math.max(0, v));
        return `${x},${y}`;
      });
      const pathD = pts.length > 1 ? `M ${pts.join(" L ")}` : "";
      const visibleLen = pts.length > 1 ? plotW * 1.4 * lineReveal : 0;
      elements.push(
        <polyline
          key={`line-${si}`}
          points={pts.join(" ")}
          fill="none"
          stroke={barColors[si]}
          strokeWidth={si === 0 ? 4 : 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={plotW * 1.4}
          strokeDashoffset={plotW * 1.4 - visibleLen}
          opacity={si === 0 ? 1 : 0.55 + si * 0.15}
        />,
      );
      if (si === 0 && pts.length > 1) {
        const areaPts = `${pts[0]} L ${pts.slice(1).join(" L ")} L ${margin.left + plotW},${margin.top + plotH} L ${margin.left},${margin.top + plotH} Z`;
        elements.push(
          <path
            key="area-0"
            d={`M ${areaPts}`}
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
          <circle key={`dot-${si}-${i}`} cx={x} cy={y} r={4} fill="#FFFFFF" stroke={barColors[si]} strokeWidth={2} />,
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
                <rect x={0} y={0} width={legendSwatch} height={legendSwatch} rx={3} fill={entry.color} />
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
            <line x1={yAxisLineX} y1={y} x2={yAxisLineX + plotW} y2={y} stroke={GRID_INK} strokeWidth={1.5} strokeDasharray="5 6" />
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
            <line
              key={`hv-${i}`}
              x1={x}
              y1={margin.top}
              x2={x}
              y2={margin.top + plotH}
              stroke={GRID_INK}
              strokeWidth={1}
              strokeOpacity={0.45}
            />
          );
        })}
      <line x1={yAxisLineX} y1={margin.top + plotH} x2={yAxisLineX + plotW} y2={margin.top + plotH} stroke={text} strokeWidth={2.2} strokeOpacity={0.55} />
      <line x1={yAxisLineX} y1={margin.top} x2={yAxisLineX} y2={margin.top + plotH} stroke={text} strokeWidth={2.2} strokeOpacity={0.55} />
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
