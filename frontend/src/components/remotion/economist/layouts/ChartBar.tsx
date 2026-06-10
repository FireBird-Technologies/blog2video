import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS, CHROME_INSET } from "../constants";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../../fonts/economist-defaults";
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
} from "./motion";

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

interface BarHeaderProps {
  title: string;
  subtitle?: string;
  /** Dynamic key/legend line: the measured series name + unit. */
  keyLabel?: string;
  keyColor?: string;
  /** Dynamic one-line insight derived from the data (e.g. the leader). */
  insight?: string;
  accentColor: string;
  textColor: string;
  titleSize: number;
  left: number;
  top: number;
  width: number;
  /** Current frame — drives staggered text-rise entrances. */
  frame: number;
}
const BarHeader: React.FC<BarHeaderProps> = ({
  title,
  subtitle,
  keyLabel,
  keyColor,
  insight,
  accentColor,
  textColor,
  titleSize,
  left,
  top,
  width,
  frame,
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
      {subtitle && (
        <div
          style={{
            fontFamily: ECONOMIST_SANS_FONT,
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
      {/* Dynamic explainer — measured-series key + one-line insight. Lives in the
          header (above the bars) so it never overlaps the plot. */}
      {(keyLabel || insight) && (
        <div
          style={{
            display: "inline-block",
            marginTop: 14,
            padding: "10px 14px",
            background: "rgba(246,244,238,0.92)",
            border: `1px solid ${ECONOMIST_COLORS.rule}`,
            ...textRise(frame, 16, 14),
          }}
        >
          {keyLabel && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: Math.round(subSize * 0.85),
                  height: Math.max(3, Math.round(subSize * 0.2)),
                  background: keyColor,
                  borderRadius: 1,
                }}
              />
              <span
                style={{
                  fontFamily: ECONOMIST_SANS_FONT,
                  fontWeight: 700,
                  fontSize: Math.round(subSize * 0.86),
                  color: ECONOMIST_COLORS.ink,
                }}
              >
                {keyLabel}
              </span>
            </div>
          )}
          {insight && (
            <div
              style={{
                fontFamily: ECONOMIST_SERIF_FONT,
                fontStyle: "italic",
                fontSize: Math.round(subSize * 0.8),
                lineHeight: 1.36,
                color: ECONOMIST_COLORS.ink,
                marginTop: keyLabel ? 8 : 0,
                maxWidth: 420,
              }}
            >
              {insight}
            </div>
          )}
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
  accentColor = ECONOMIST_COLORS.accent,
  textColor = ECONOMIST_COLORS.ink,
  titleFontSize,
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

  const titleSize = (titleFontSize ?? (isPortrait ? 46 : 50)) as number;
  const subSize = Math.round(titleSize * 0.62);
  // Explainer box reserve: key row + insight (≈2 lines) + box padding.
  const keyH =
    keyLabel || barInsight
      ? 20 + (keyLabel ? Math.round(subSize * 0.95) : 0) + (barInsight ? Math.round(subSize * 0.8) * 2 + 8 : 0)
      : 0;
  const headerH = 6 + 16 + titleSize * 1.1 + (narration ? subSize * 1.5 : 0) + keyH + 22;
  const footerH = 0;

  // Raw 0..1 grow clock per bar; the bars themselves apply an easeOutBack
  // overshoot so each one springs slightly past its mark and settles.
  const growT = (i: number) => clamp((frame - GROW_START - i * STAGGER) / GROW_DUR, 0, 1);

  // Each datum.
  const data = labels.map((label, i) => ({ label, value: Number.isFinite(primary[i]) ? primary[i] : 0 }));

  return (
    <AbsoluteFill>
      <BarHeader
        title={title}
        subtitle={narration}
        keyLabel={keyLabel}
        keyColor={barColor}
        insight={barInsight}
        accentColor={accentColor}
        textColor={textColor}
        titleSize={titleSize}
        left={innerL}
        top={innerT}
        width={innerR - innerL}
        frame={frame}
      />

      {variant === "bar"
        ? (() => {
            const yLabelW = 62;
            const xLabelH = isPortrait ? 56 : 40;
            const gridR = innerR - yLabelW;
            const plotL = innerL;
            const plotR = gridR;
            const plotT = innerT + headerH;
            const plotB = innerB - footerH - xLabelH;
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
                      <text x={innerR} y={y + 6 + (1 - easeOutQuint(tickT)) * 6} textAnchor="end" fontFamily={ECONOMIST_SANS_FONT} fontSize={subSize} fill={ECONOMIST_COLORS.muted} opacity={tickT}>
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
                          fontFamily={ECONOMIST_SANS_FONT}
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
                      <text x={x + barW / 2} y={plotB + 26 + (1 - easeOutQuint(xLabT)) * 8} textAnchor="middle" fontFamily={ECONOMIST_SANS_FONT} fontSize={Math.round(subSize * 0.92)} fill={ECONOMIST_COLORS.muted} opacity={xLabT}>
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
            const plotT = innerT + headerH;
            const plotB = innerB - footerH;
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
                        fontFamily={ECONOMIST_SANS_FONT}
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
                          fontFamily={ECONOMIST_SANS_FONT}
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

    </AbsoluteFill>
  );
};
