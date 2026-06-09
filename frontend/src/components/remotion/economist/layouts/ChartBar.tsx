import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS, CHROME_INSET } from "../constants";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../../fonts/economist-defaults";
import {
  parseChartTable,
  niceTicks,
  scaleLinear,
  fmtTick,
  fmtValue,
  easeInOutCubic,
  extentY,
  clamp,
  textRise,
} from "./chartHelpers";

/**
 * ChartBar — custom-SVG Economist bar chart.
 *   chartType "bar"  → vertical bars (gridlines + right y-axis, value on top)
 *   chartType "hbar" → ranked horizontal bars (sorted desc, value at the end)
 * Both grow in with a staggered easeInOutCubic. Bars use the accent red;
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
      <div style={{ width: 34, height: 6, background: accentColor, marginBottom: 16, ...textRise(frame, 0, 14) }} />
      <div
        style={{
          fontFamily: ECONOMIST_SERIF_FONT,
          fontWeight: 700,
          fontSize: titleSize,
          lineHeight: 1.06,
          color: textColor,
          letterSpacing: -titleSize * 0.012,
          ...textRise(frame, 4),
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

  const axisOp = interpolate(frame, [8, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

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

  const growProgress = (i: number) =>
    easeInOutCubic((frame - GROW_START - i * STAGGER) / GROW_DUR);

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
                {/* gridlines + right y labels */}
                {scale.ticks.map((t, i) => {
                  const y = sy(t);
                  const isZero = Math.abs(t) < scale.step * 1e-6;
                  return (
                    <g key={i} opacity={axisOp}>
                      <line x1={plotL} x2={gridR} y1={y} y2={y} stroke={isZero ? ECONOMIST_COLORS.zero : ECONOMIST_COLORS.grid} strokeWidth={isZero ? 1.5 : 1} />
                      <text x={innerR} y={y + 6} textAnchor="end" fontFamily={ECONOMIST_SANS_FONT} fontSize={subSize} fill={ECONOMIST_COLORS.muted}>
                        {fmtTick(t)}{unit}
                      </text>
                    </g>
                  );
                })}
                {/* bars */}
                {data.map((d, i) => {
                  const p = clamp(growProgress(i), 0, 1);
                  const full = sy(d.value);
                  const top = baseY + (full - baseY) * p;
                  const x = plotL + slot * i + (slot - barW) / 2;
                  const h = Math.abs(top - baseY);
                  const y = Math.min(top, baseY);
                  const col = d.value < 0 ? ECONOMIST_COLORS.blue : barColor;
                  return (
                    <g key={i}>
                      <rect x={x} y={y} width={barW} height={h} fill={col} />
                      {p > 0.6 && (
                        <text
                          x={x + barW / 2}
                          y={(d.value < 0 ? top + subSize + 4 : top - 8)}
                          textAnchor="middle"
                          fontFamily={ECONOMIST_SANS_FONT}
                          fontWeight={700}
                          fontSize={subSize}
                          fill={textColor}
                          opacity={interpolate(p, [0.6, 1], [0, 1])}
                        >
                          {fmtValue(d.value, unit)}
                        </text>
                      )}
                      <text x={x + barW / 2} y={plotB + 26} textAnchor="middle" fontFamily={ECONOMIST_SANS_FONT} fontSize={Math.round(subSize * 0.92)} fill={ECONOMIST_COLORS.muted} opacity={axisOp}>
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
                  const p = clamp(growProgress(i), 0, 1);
                  const cy = plotT + rowH * i + rowH / 2;
                  const end = barL + (sx(d.value) - barL) * p;
                  return (
                    <g key={i} opacity={axisOp}>
                      <text x={barL - 16} y={cy + subSize * 0.34} textAnchor="end" fontFamily={ECONOMIST_SANS_FONT} fontWeight={600} fontSize={subSize} fill={textColor}>
                        {d.label}
                      </text>
                      <rect x={barL} y={cy - barH / 2} width={Math.max(0, end - barL)} height={barH} fill={barColor} />
                      {p > 0.5 && (
                        <text x={end + 12} y={cy + subSize * 0.34} textAnchor="start" fontFamily={ECONOMIST_SANS_FONT} fontWeight={700} fontSize={subSize} fill={textColor} opacity={interpolate(p, [0.5, 1], [0, 1])}>
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
