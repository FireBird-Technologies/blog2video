import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS, CHROME_INSET } from "../constants";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../fonts/economist-defaults";
import {
  parseChartTable,
  niceTicks,
  scaleLinear,
  fmtTick,
  fmtValue,
  extentY,
  clamp,
  textRise,
} from "./chartHelpers";
import {
  clamp01,
  easeOutQuint,
  easeOutBack,
  baselineSettle,
  ruleDraw,
  letterpressStamp,
  panelSqueeze,
} from "./motion";
import { ExplainerBox } from "./ExplainerBox";

/**
 * ChartBar — custom-SVG Economist bar chart.
 *   chartType "bar"  → vertical bars (gridlines + right y-axis, value on top)
 *   chartType "hbar" → ranked horizontal bars (sorted desc, value at the end)
 * Both grow in staggered with an easeOutBack overshoot. Bars use the accent red;
 * negative bars switch to the Economist blue.
 */
const GROW_START = 18;
const GROW_DUR = 24;
const STAGGER = 7;
const SQUEEZE_DUR = 18;

interface BarHeaderProps {
  title: string;
  subtitle?: string;
  accentColor: string;
  textColor: string;
  titleSize: number;
  left: number;
  top: number;
  width: number;
  /** Current frame — drives staggered text-rise entrances. */
  frame: number;
  fontFamily?: string;
}
const BarHeader: React.FC<BarHeaderProps> = ({
  title,
  subtitle,
  accentColor,
  textColor,
  titleSize,
  left,
  top,
  width,
  frame,
  fontFamily,
}) => {
  const subSize = Math.round(titleSize * 0.56);
  return (
    <div style={{ position: "absolute", left, top, width }}>
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
          fontFamily: fontFamily ?? ECONOMIST_SERIF_FONT,
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
      {subtitle && (
        <div
          style={{
            fontFamily: fontFamily ?? ECONOMIST_SANS_FONT,
            fontSize: subSize,
            lineHeight: 1.3,
            color: ECONOMIST_COLORS.muted,
            marginTop: 8,
            ...textRise(frame, 12),
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
};

export const ChartBar: React.FC<EconomistLayoutProps> = ({
  title,
  narration,
  chartTable,
  chartType,
  seriesColors,
  unit = "",
  explainer,
  accentColor = ECONOMIST_COLORS.accent,
  textColor = ECONOMIST_COLORS.ink,
  titleFontSize,
  fontFamily,
  aspectRatio = "landscape",
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";
  const variant: "bar" | "hbar" = chartType === "hbar" ? "hbar" : "bar";

  const { labels, series } = parseChartTable(chartTable);
  const primary = series[0]?.values ?? [];
  const barColor = seriesColors?.[0] || accentColor;
  // Dynamic key: name of the measured series (+ unit), shown under the header.
  const keyLabel = series[0]
    ? `${series[0].label}${unit ? ` (${unit.trim()})` : ""}`
    : "";
  // Dynamic insight: the highest-ranked datum (and its lead over the next).
  const barInsight = (() => {
    const rows = labels
      .map((label, i) => ({ label, value: Number.isFinite(primary[i]) ? primary[i] : 0 }))
      .sort((a, b) => b.value - a.value);
    if (rows.length === 0) return "";
    const top = rows[0];
    const u = (unit || "").trim();
    const topVal = Number.isInteger(top.value) ? String(top.value) : top.value.toFixed(1);
    if (rows.length > 1) {
      const gap = top.value - rows[1].value;
      const gapStr = Number.isInteger(gap) ? String(gap) : gap.toFixed(1);
      return `${top.label} leads at ${topVal}${u}, ${gapStr}${u} ahead of ${rows[1].label}.`;
    }
    return `${top.label} leads at ${topVal}${u}.`;
  })();

  const chartT = (isPortrait ? CHROME_INSET.topPortrait : CHROME_INSET.top) + 24;
  const chartB = (isPortrait ? CHROME_INSET.bottomPortrait : CHROME_INSET.bottom) + 22;
  const pad = isPortrait
    ? { l: 70, r: 64, t: chartT, b: chartB }
    : { l: 96, r: 96, t: chartT, b: chartB };
  const innerL = pad.l;
  const innerR = width - pad.r;
  const innerT = pad.t;
  const innerB = height - pad.b;

  const titleSize = (titleFontSize ?? (isPortrait ? 68 : 50)) as number;
  const subSize = Math.round(titleSize * 0.62);
  const headerH = 6 + 16 + titleSize * 1.1 + (narration ? subSize * 1.5 : 0) + 22;
  const footerH = 0;

  // Raw 0..1 grow clock per bar; the bars themselves apply an easeOutBack
  // overshoot so each one springs slightly past its mark and settles.
  const growT = (i: number) => clamp((frame - GROW_START - i * STAGGER) / GROW_DUR, 0, 1);

  // Each datum.
  const data = labels.map((label, i) => ({ label, value: Number.isFinite(primary[i]) ? primary[i] : 0 }));

  // Post-animation squeeze + takeaway panel. The last bar finishes growing at a
  // data-dependent frame; the clamp keeps the squeeze + panel inside the 200f
  // minimum scene duration. Wrapper transform only — never re-lay-out the plot.
  const lastAnimEnd = GROW_START + (Math.max(1, data.length) - 1) * STAGGER + GROW_DUR;
  const squeezeStart = Math.min(lastAnimEnd + 14, 150);
  const boxDelay = squeezeStart + 10;
  const sq = panelSqueeze(frame, squeezeStart, isPortrait ? 0.92 : 0.86, SQUEEZE_DUR);
  const takeaway = (explainer ?? "").trim() || barInsight;

  return (
    <AbsoluteFill>
      <BarHeader
        title={title}
        subtitle={narration}
        accentColor={accentColor}
        textColor={textColor}
        titleSize={titleSize}
        left={innerL}
        top={innerT}
        width={innerR - innerL}
        frame={frame}
        fontFamily={fontFamily}
      />

      {/* Chart canvas in one squeezing wrapper (covers both variants). */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${sq.toFixed(4)})`,
          transformOrigin: `${(innerL + innerR) / 2}px ${innerT}px`,
        }}
      >
      {variant === "bar"
        ? (() => {
            const yLabelW = 62;
            const xLabelH = isPortrait ? 56 : 40;
            const gridR = innerR - yLabelW;
            const plotL = innerL;
            const plotR = gridR;
            // Portrait: the column below the header is very tall, which stretches
            // the bars into thin towers. Cap the plot height and centre that
            // shorter band in the leftover space (matches ChartLine).
            const headBottom = innerT + headerH;
            const naturalPlotB = innerB - footerH - xLabelH;
            const plotH = isPortrait
              ? Math.min(naturalPlotB - headBottom, (innerB - headBottom) * 0.6)
              : naturalPlotB - headBottom;
            const plotVOffset = isPortrait ? (naturalPlotB - headBottom - plotH) * 0.5 : 0;
            const plotT = headBottom + plotVOffset;
            const plotB = plotT + plotH;
            const { min, max } = extentY(series.length ? [series[0]] : []);
            const scale = niceTicks(Math.min(0, min), Math.max(0, max), 5, true);
            const sy = scaleLinear(scale.niceMin, scale.niceMax, plotB, plotT);
            const baseY = sy(0);
            const slot = (plotR - plotL) / Math.max(1, data.length);
            const barW = slot * 0.58;

            return (
              <svg style={{ position: "absolute", inset: 0 }} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                {/* gridlines draw on left→right with a stagger; y labels rise in */}
                {scale.ticks.map((t, i) => {
                  const y = sy(t);
                  const isZero = Math.abs(t) < scale.step * 1e-6;
                  const tickT = clamp01((frame - 8 - i * 2) / 14);
                  const lineX2 = plotL + (gridR - plotL) * easeOutQuint(tickT);
                  return (
                    <g key={i}>
                      <line x1={plotL} x2={lineX2} y1={y} y2={y} stroke={isZero ? ECONOMIST_COLORS.zero : ECONOMIST_COLORS.grid} strokeWidth={isZero ? 1.5 : 1} />
                      <text x={innerR} y={y + 6 + (1 - easeOutQuint(tickT)) * 6} textAnchor="end" fontFamily={fontFamily ?? ECONOMIST_SANS_FONT} fontSize={subSize} fill={ECONOMIST_COLORS.muted} opacity={tickT}>
                        {fmtTick(t)}{unit}
                      </text>
                    </g>
                  );
                })}
                {/* bars spring up past their mark and settle (capped overshoot) */}
                {data.map((d, i) => {
                  const p = easeOutBack(growT(i), 1.2);
                  const fullH = Math.abs(sy(d.value) - baseY);
                  let h = Math.max(0, Math.min(fullH * p, fullH + 10));
                  const isNeg = d.value < 0;
                  let y = isNeg ? baseY : baseY - h;
                  if (!isNeg && y < plotT) {
                    y = plotT;
                    h = baseY - plotT;
                  }
                  if (isNeg && baseY + h > plotB) {
                    h = plotB - baseY;
                  }
                  const x = plotL + slot * i + (slot - barW) / 2;
                  const col = isNeg ? ECONOMIST_COLORS.blue : barColor;
                  const stamp = letterpressStamp(frame, GROW_START + i * STAGGER + GROW_DUR - 6, 12);
                  const xLabT = clamp01((frame - 10 - i * 3) / 12);
                  return (
                    <g key={i}>
                      <rect x={x} y={y} width={barW} height={h} fill={col} />
                      {stamp.opacity > 0 && (
                        <text
                          x={x + barW / 2}
                          y={isNeg ? baseY + h + subSize + 4 : y - 8}
                          textAnchor="middle"
                          fontFamily={fontFamily ?? ECONOMIST_SANS_FONT}
                          fontWeight={700}
                          fontSize={subSize}
                          fill={textColor}
                          opacity={stamp.opacity}
                          style={{
                            transformBox: "fill-box",
                            transformOrigin: "center",
                            transform: stamp.transform,
                            filter: stamp.filter,
                          }}
                        >
                          {fmtValue(d.value, unit)}
                        </text>
                      )}
                      <text x={x + barW / 2} y={plotB + 26 + (1 - easeOutQuint(xLabT)) * 8} textAnchor="middle" fontFamily={fontFamily ?? ECONOMIST_SANS_FONT} fontSize={Math.round(subSize * 0.92)} fill={ECONOMIST_COLORS.muted} opacity={xLabT}>
                        {d.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            );
          })()
        : (() => {
            // Ranked horizontal — sort desc.
            const sorted = [...data].sort((a, b) => b.value - a.value);
            const labelGutter = isPortrait ? 250 : 360;
            const valueW = isPortrait ? 96 : 120;
            // Portrait: cap the rows' vertical band and centre it so the ranked
            // bars stay compact instead of spreading down the whole column.
            const headBottom = innerT + headerH;
            const naturalPlotB = innerB - footerH;
            const plotH = isPortrait
              ? Math.min(naturalPlotB - headBottom, (innerB - headBottom) * 0.6)
              : naturalPlotB - headBottom;
            const plotVOffset = isPortrait ? (naturalPlotB - headBottom - plotH) * 0.5 : 0;
            const plotT = headBottom + plotVOffset;
            const plotB = plotT + plotH;
            const barL = innerL + labelGutter;
            const barRight = innerR - valueW;
            const maxV = Math.max(...sorted.map((d) => d.value), 1);
            const sx = scaleLinear(0, maxV, barL, barRight);
            const rowH = (plotB - plotT) / Math.max(1, sorted.length);
            const barH = Math.min(rowH * 0.52, 46);

            return (
              <svg style={{ position: "absolute", inset: 0 }} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                {sorted.map((d, i) => {
                  const p = easeOutBack(growT(i), 1.1);
                  const cy = plotT + rowH * i + rowH / 2;
                  const fullW = Math.max(0, sx(d.value) - barL);
                  const w = Math.max(0, Math.min(fullW * p, fullW + 10));
                  const end = barL + w;
                  // Row label slides in from the left gutter just ahead of its bar.
                  const rowT = clamp01((frame - Math.max(0, GROW_START + i * STAGGER - 6)) / 16);
                  const rowX = (1 - easeOutQuint(rowT)) * -22;
                  const stamp = letterpressStamp(frame, GROW_START + i * STAGGER + GROW_DUR - 6, 12);
                  return (
                    <g key={i}>
                      <text
                        x={barL - 16}
                        y={cy + subSize * 0.34}
                        textAnchor="end"
                        fontFamily={fontFamily ?? ECONOMIST_SANS_FONT}
                        fontWeight={600}
                        fontSize={subSize}
                        fill={textColor}
                        opacity={clamp01(rowT / 0.5)}
                        transform={`translate(${rowX.toFixed(2)} 0)`}
                      >
                        {d.label}
                      </text>
                      <rect x={barL} y={cy - barH / 2} width={w} height={barH} fill={barColor} />
                      {stamp.opacity > 0 && (
                        <text
                          x={end + 12}
                          y={cy + subSize * 0.34}
                          textAnchor="start"
                          fontFamily={fontFamily ?? ECONOMIST_SANS_FONT}
                          fontWeight={700}
                          fontSize={subSize}
                          fill={textColor}
                          opacity={stamp.opacity}
                          style={{
                            transformBox: "fill-box",
                            transformOrigin: "center",
                            transform: stamp.transform,
                            filter: stamp.filter,
                          }}
                        >
                          {fmtValue(d.value, unit)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            );
          })()}
      </div>

      {/* Takeaway panel rising into the band freed by the squeeze. */}
      <ExplainerBox
        frame={frame}
        delay={boxDelay}
        left={innerL}
        bottom={(isPortrait ? CHROME_INSET.bottomPortrait : CHROME_INSET.bottom) + (isPortrait ? 16 : 14)}
        width={innerR - innerL}
        text={takeaway}
        keys={keyLabel ? [{ label: keyLabel, color: barColor }] : undefined}
        accentColor={accentColor}
        fontSize={Math.round(subSize * (isPortrait ? 0.8 : 0.85))}
        isPortrait={isPortrait}
        fontFamily={fontFamily}
      />
    </AbsoluteFill>
  );
};
