import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS, ECONOMIST_CHART_SERIES, CHROME_INSET } from "../constants";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../fonts/economist-defaults";
import {
  parseChartTable,
  extentY,
  niceTicks,
  scaleLinear,
  buildLinePath,
  buildAreaPath,
  pointAtReveal,
  fmtTick,
  easeInOutCubic,
  textRise,
  type ParsedSeries,
  type Pt,
} from "./chartHelpers";
import { clamp01, easeOutQuint, baselineSettle, ruleDraw, pulse, panelSqueeze } from "./motion";
import { ExplainerBox } from "./ExplainerBox";

/**
 * ChartLine — custom-SVG Economist line chart.
 *
 * Matches the references exactly: bold sans title + subtitle, a small red tab,
 * horizontal gridlines only, RIGHT-side y-axis tick labels, an emphasised black
 * zero line, up to 4 colour series with grey "context" series behind, direct
 * colour-coded end-labels (or inline labels), and an optional boxed panel
 * number. Lines draw on left→right.
 */
const DRAW_START = 20;
const DRAW_DUR = 70;
// Post-animation: end-labels and head-dot rings settle by ~114, then the chart
// squeezes up and the takeaway panel rises into the freed band. Min scene
// duration is 210f, so everything lands by ~146 with a comfortable hold.
const SQUEEZE_START = 118;
const SQUEEZE_DUR = 18;
const BOX_DELAY = SQUEEZE_START + 10;

export const ChartLine: React.FC<EconomistLayoutProps> = ({
  title,
  narration,
  chartTable,
  highlightSeries,
  seriesColors,
  emphasizeZero = true,
  panelNumber,
  unit = "",
  labelMode = "end",
  explainer,
  accentColor = ECONOMIST_COLORS.accent,
  textColor = ECONOMIST_COLORS.ink,
  titleFontSize,
  aspectRatio = "landscape",
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";

  const reveal = easeInOutCubic((frame - DRAW_START) / DRAW_DUR);
  const drawEnd = DRAW_START + DRAW_DUR;
  const headOp = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const labelOp = interpolate(frame, [drawEnd - 4, drawEnd + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const { labels, series } = parseChartTable(chartTable);

  // ── geometry ───────────────────────────────────────────────────────────────
  // Slightly smaller plot, nudged left: trim the left gutter and add a touch more
  // right breathing room so the chart sits left of centre.
  const chartT = (isPortrait ? CHROME_INSET.topPortrait : CHROME_INSET.top) + 24;
  const chartB = (isPortrait ? CHROME_INSET.bottomPortrait : CHROME_INSET.bottom) + 22;
  const pad = isPortrait
    ? { l: 60, r: 72, t: chartT, b: chartB }
    : { l: 96, r: 120, t: chartT, b: chartB };
  const innerL = pad.l;
  const innerR = width - pad.r;
  const innerT = pad.t;
  const innerB = height - pad.b;

  const titleSize = (titleFontSize ?? (isPortrait ? 58 : 50)) as number;
  const subSize = Math.round(titleSize * 0.62);

  const headerH = 6 + 16 + titleSize * 1.1 + (narration ? subSize * 1.5 : 0) + 20;

  const yLabelW = 62;
  const endReserve = labelMode === "end" ? (isPortrait ? 150 : 185) : 14;
  const xLabelH = 34;
  const footerH = 0;

  const plotL = innerL;
  const gridR = innerR - yLabelW;
  const plotR = gridR - endReserve;
  const naturalPlotB = innerB - footerH - xLabelH;
  // In portrait the available vertical band is very tall, which stretches the
  // line chart into an ungainly near-square. Cap the plot height so it keeps a
  // flatter, editorial aspect, then centre that shorter band in the leftover
  // space below the header (rather than leaving all the gap at the bottom).
  const headBottom = innerT + headerH;
  const plotH = isPortrait
    ? Math.min(naturalPlotB - headBottom, (innerB - headBottom) * 0.6)
    : naturalPlotB - headBottom;
  const plotVOffset = isPortrait ? (naturalPlotB - headBottom - plotH) * 0.5 : 0;
  const plotT = headBottom + plotVOffset;
  const plotB = plotT + plotH;

  // ── scales ─────────────────────────────────────────────────────────────────
  const { min, max } = extentY(series);
  const scale = niceTicks(min, max, 6, emphasizeZero || min < 0);
  const sx = scaleLinear(0, Math.max(1, labels.length - 1), plotL, plotR);
  const sy = scaleLinear(scale.niceMin, scale.niceMax, plotB, plotT);

  // ── colour resolution: highlighted (coloured) vs context (grey) ────────────
  const highlightSet =
    highlightSeries && highlightSeries.length ? new Set(highlightSeries) : null;
  let hi = -1;
  const resolved = series.map((s) => {
    const isH = highlightSet ? highlightSet.has(s.label) : true;
    let color: string = ECONOMIST_COLORS.context;
    if (isH) {
      hi += 1;
      color = seriesColors?.[hi] || ECONOMIST_CHART_SERIES[hi % ECONOMIST_CHART_SERIES.length];
    }
    return { ...s, isH, color };
  });
  const contextSeries = resolved.filter((s) => !s.isH);
  const highlighted = resolved.filter((s) => s.isH);

  // ── dynamic insight: the highlighted series with the biggest first→last move ─
  const insight = (() => {
    const firstLabel = labels[0] ?? "";
    let best: { label: string; delta: number } | null = null;
    for (const s of highlighted) {
      const finite = s.values.filter((v) => Number.isFinite(v));
      if (finite.length < 2) continue;
      const delta = finite[finite.length - 1] - finite[0];
      if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { label: s.label, delta };
    }
    if (!best) return "";
    const mag = Math.abs(best.delta);
    const magStr = Number.isInteger(mag) ? String(mag) : mag.toFixed(1);
    const u = (unit || "").trim();
    const since = firstLabel ? ` since ${firstLabel}` : "";
    if (best.delta > 0) return `${best.label} climbed the most, +${magStr}${u}${since}.`;
    if (best.delta < 0) return `${best.label} fell the most, −${magStr}${u}${since}.`;
    return `${best.label} held broadly flat${since}.`;
  })();

  const toPts = (s: ParsedSeries): Pt[] =>
    s.values.map((v, i) => ({ x: sx(i), y: sy(v), gap: !Number.isFinite(v) }));

  // ── end-label positions (collision-nudged) ─────────────────────────────────
  const endLabels = highlighted
    .map((s) => {
      let lastIdx = -1;
      for (let i = s.values.length - 1; i >= 0; i--) {
        if (Number.isFinite(s.values[i])) {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx < 0) return null;
      return { label: s.label, color: s.color, y: sy(s.values[lastIdx]), x: sx(lastIdx) };
    })
    .filter(Boolean) as Array<{ label: string; color: string; x: number; y: number }>;
  // Nudge apart vertically (min spacing) when in "end" mode.
  endLabels.sort((a, b) => a.y - b.y);
  const minGap = subSize + 8;
  for (let i = 1; i < endLabels.length; i++) {
    if (endLabels[i].y - endLabels[i - 1].y < minGap) {
      endLabels[i].y = endLabels[i - 1].y + minGap;
    }
  }

  // x-axis tick labels (thin them out so they never crowd).
  const maxXTicks = isPortrait ? 5 : 7;
  const xStep = Math.max(1, Math.ceil(labels.length / maxXTicks));
  const zeroY = sy(0);
  const showZero = emphasizeZero && scale.niceMin < 0 && scale.niceMax > 0;

  // Post-animation squeeze + takeaway panel. The squeeze is a wrapper transform
  // (never a plot-rect re-layout): sx/sy, end-label collision nudging and tick
  // thinning all derive from the plot rect, so recomputing it per frame would
  // jitter the labels. Scaling toward the top frees a band at the bottom.
  const sq = panelSqueeze(frame, SQUEEZE_START, isPortrait ? 0.92 : 0.86, SQUEEZE_DUR);
  const takeaway = (explainer ?? "").trim() || insight;

  return (
    <AbsoluteFill>
      {/* Header: red tab + title + subtitle, each rising in with a stagger. */}
      <div style={{ position: "absolute", left: innerL, top: innerT, width: gridR - innerL }}>
        <div
          style={{
            width: 34,
            height: 6,
            background: accentColor,
            marginBottom: 16,
            opacity: clamp01(frame / 6),
            ...ruleDraw(frame, 0, 12),
          }}
        />
        <div
          style={{
            fontFamily: ECONOMIST_SERIF_FONT,
            fontWeight: 700,
            fontSize: titleSize,
            lineHeight: 1.06,
            color: textColor,
            letterSpacing: -titleSize * 0.012,
            ...baselineSettle(frame, 4),
          }}
        >
          {title}
        </div>
        {narration && (
          <div
            style={{
              fontFamily: ECONOMIST_SANS_FONT,
              fontWeight: 400,
              fontSize: subSize,
              lineHeight: 1.3,
              color: ECONOMIST_COLORS.muted,
              marginTop: 8,
              ...textRise(frame, 12),
            }}
          >
            {narration}
          </div>
        )}
      </div>

      {/* Panel number box, top-right. */}
      {panelNumber !== undefined && panelNumber !== "" && (
        <div
          style={{
            position: "absolute",
            right: pad.r,
            top: innerT,
            width: isPortrait ? 54 : 44,
            height: isPortrait ? 54 : 44,
            border: `1.5px solid ${textColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: ECONOMIST_SANS_FONT,
            fontWeight: 700,
            fontSize: isPortrait ? 30 : 24,
            color: textColor,
            opacity: headOp,
          }}
        >
          {panelNumber}
        </div>
      )}

      {/* Chart canvas (SVG + inline HTML labels) in one squeezing wrapper. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${sq.toFixed(4)})`,
          transformOrigin: `${(plotL + gridR) / 2}px ${innerT}px`,
        }}
      >
      {/* Chart SVG. */}
      <svg
        style={{ position: "absolute", inset: 0 }}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        {/* Horizontal gridlines draw on left→right, each a beat after the last;
            the y tick labels rise into place alongside their line. */}
        {scale.ticks.map((t, i) => {
          const y = sy(t);
          const isZero = Math.abs(t) < scale.step * 1e-6;
          const tickT = clamp01((frame - 8 - i * 2) / 14);
          const lineX2 = plotL + (gridR - plotL) * easeOutQuint(tickT);
          const labelDy = (1 - easeOutQuint(tickT)) * 6;
          return (
            <g key={i}>
              <line
                x1={plotL}
                x2={lineX2}
                y1={y}
                y2={y}
                stroke={isZero && showZero ? ECONOMIST_COLORS.zero : ECONOMIST_COLORS.grid}
                strokeWidth={isZero && showZero ? 2 : 1}
              />
              <text
                x={innerR}
                y={y + 6 + labelDy}
                textAnchor="end"
                fontFamily={ECONOMIST_SANS_FONT}
                fontSize={subSize}
                fill={ECONOMIST_COLORS.muted}
                opacity={tickT}
              >
                {fmtTick(t)}
                {unit}
              </text>
            </g>
          );
        })}

        {/* Fill sweep under the lead highlighted series — advances with the
            line draw, a faint editorial area tint. */}
        {highlighted.length > 0 && (
          <path
            d={buildAreaPath(toPts(highlighted[0]), reveal, plotB)}
            fill={highlighted[0].color}
            opacity={0.07}
          />
        )}

        {/* Context (grey) series behind. */}
        {contextSeries.map((s, i) => (
          <path
            key={`ctx-${i}`}
            d={buildLinePath(toPts(s), reveal)}
            fill="none"
            stroke={ECONOMIST_COLORS.context}
            strokeWidth={isPortrait ? 3 : 3.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.75}
          />
        ))}

        {/* Highlighted (coloured) series on top. */}
        {highlighted.map((s, i) => (
          <path
            key={`hi-${i}`}
            d={buildLinePath(toPts(s), reveal)}
            fill="none"
            stroke={s.color}
            strokeWidth={isPortrait ? 6 : 7}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Head dots — ride each highlighted line's frontier during the draw,
            then settle on the end point with a soft continuous pulse and two
            one-shot expanding rings to land the terminal value. */}
        {highlighted.map((s, i) => {
          const head = pointAtReveal(toPts(s), reveal);
          if (!head || frame < DRAW_START + 2) return null;
          const settled = frame >= drawEnd;
          const r = (isPortrait ? 6 : 7) * (settled ? 1 + pulse(frame) * 0.12 : 1);
          const ring = (ringStart: number) => {
            const t = clamp01((frame - ringStart) / 18);
            if (t <= 0 || t >= 1) return null;
            return (
              <circle
                key={`ring-${ringStart}`}
                cx={head.x}
                cy={head.y}
                r={8 + 16 * easeOutQuint(t)}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                opacity={0.5 * (1 - t)}
              />
            );
          };
          return (
            <g key={`hd-${i}`}>
              <circle cx={head.x} cy={head.y} r={r} fill={s.color} />
              {settled && ring(drawEnd)}
              {settled && ring(drawEnd + 36)}
            </g>
          );
        })}

        {/* x-axis tick labels tick up into place behind the advancing line. */}
        {labels.map((lab, i) => {
          if (i % xStep !== 0 && i !== labels.length - 1) return null;
          const tickT = clamp01((frame - DRAW_START - (i / Math.max(1, labels.length - 1)) * 24) / 12);
          return (
            <text
              key={`x-${i}`}
              x={sx(i)}
              y={plotB + 26 + (1 - easeOutQuint(tickT)) * 8}
              textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"}
              fontFamily={ECONOMIST_SANS_FONT}
              fontSize={subSize}
              fill={ECONOMIST_COLORS.muted}
              opacity={tickT}
            >
              {lab}
            </text>
          );
        })}

        {/* Direct end-labels (mode "end") slide in off the line ends, each with
            a short leader tick drawing toward it. */}
        {labelMode === "end" &&
          endLabels.map((l, i) => {
            const t = clamp01((frame - (drawEnd - 4) - i * 4) / 14);
            const tx = (1 - easeOutQuint(t)) * -10;
            return (
              <g key={`el-${i}`} opacity={t} transform={`translate(${tx.toFixed(2)} 0)`}>
                <line
                  x1={plotR + 2}
                  x2={plotR + 2 + 8 * easeOutQuint(t)}
                  y1={l.y}
                  y2={l.y}
                  stroke={l.color}
                  strokeWidth={3}
                />
                <text
                  x={plotR + 14}
                  y={l.y + subSize * 0.34}
                  textAnchor="start"
                  fontFamily={ECONOMIST_SANS_FONT}
                  fontWeight={700}
                  fontSize={subSize}
                  fill={l.color}
                >
                  {l.label}
                </text>
              </g>
            );
          })}
      </svg>

      {/* Inline labels (mode "inline") — placed near each line, in HTML for crisp text. */}
      {labelMode === "inline" &&
        highlighted.map((s, i) => {
          const frac = 0.16 + i * 0.16;
          const idx = Math.round(frac * (s.values.length - 1));
          const safeIdx = Math.max(0, Math.min(s.values.length - 1, idx));
          const v = s.values[safeIdx];
          if (!Number.isFinite(v)) return null;
          const x = sx(safeIdx);
          const y = sy(v);
          const above = i % 2 === 0;
          return (
            <div
              key={`il-${i}`}
              style={{
                position: "absolute",
                left: x,
                top: above ? y - subSize * 2.0 : y + subSize * 0.7,
                fontFamily: ECONOMIST_SANS_FONT,
                fontWeight: 700,
                fontSize: subSize,
                lineHeight: 1.15,
                color: s.color,
                maxWidth: isPortrait ? 240 : 300,
                opacity: labelOp,
              }}
            >
              {s.label}
            </div>
          );
        })}
      </div>

      {/* Takeaway panel rising into the band freed by the squeeze. */}
      <ExplainerBox
        frame={frame}
        delay={BOX_DELAY}
        left={innerL}
        bottom={(isPortrait ? CHROME_INSET.bottomPortrait : CHROME_INSET.bottom) + (isPortrait ? 16 : 14)}
        width={(isPortrait ? innerR : gridR) - innerL}
        text={takeaway}
        keys={highlighted.map((s) => ({ label: s.label, color: s.color }))}
        accentColor={accentColor}
        fontSize={Math.round(subSize * (isPortrait ? 0.8 : 0.85))}
        isPortrait={isPortrait}
      />
    </AbsoluteFill>
  );
};
