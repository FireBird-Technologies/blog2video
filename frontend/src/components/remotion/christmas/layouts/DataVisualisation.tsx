/**
 * data_visualisation — a chart from the pipeline-bound `chartTable` only.
 * The chart hangs on a snow-capped wooden sign. Bars (and histograms) are candy
 * canes that grow up from the snow; line series are strings of fairy lights whose
 * bulbs switch on point by point. The highest value gets a gold star.
 * The Title and Display text (the chart summary) sit on the frosted side panel
 * (above in portrait). Data parsing uses the shared chartData helpers — plain SVG,
 * no ResponsiveContainer, so it never flickers in parallel renders.
 * Exit: the snow gust.
 *
 * Flicker-safe (same goal as _shared/MeasuredChart in the recharts templates — every
 * captured frame stable and deterministic): fixed pre-computed SVG size (no async
 * measuring), a unique pattern id per instance (useId), bars snapped to whole pixels
 * so the candy-cane stripes don't shimmer, value labels that fade in instead of
 * popping, a slow subtle bulb twinkle, and a sign entrance with no overshoot.
 *
 * Mirror byte-identical in all three trees.
 */
import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { formatAxisTick, orientChartInputsForType, resolveChartInputs, selectChartType } from "../../_shared/chartData";
import { MeasuredChart } from "../../_shared/MeasuredChart";
import type { SceneLayoutProps } from "../types";
import { clamp, FESTIVE, mix, withOpacity } from "../christmasStyle";
import { getChristmasTypography } from "../typography";
import { ease, useChristmasScene } from "../components/sceneKit";
import { FitText } from "../components/FitText";
import { WinterBackdrop } from "../components/WinterBackdrop";
import { LayeredSnow } from "../components/Snowfall";
import { FrostCard } from "../components/FrostCard";
import { starPath } from "../components/ChristmasTree";
import { SnowClearIn, SnowGustExit } from "../components/SnowGustExit";

/**
 * SVG text cannot measure itself, so chart labels are sized from their length: the
 * base size, shrunk so `text` fits in `maxW` px (≈0.58 em per character for Nunito
 * bold), never below `minPx`.
 */
const fitSvgPx = (text: string, basePx: number, maxW: number, minPx = 12) => {
  const len = Math.max(1, String(text || "").length);
  // Whole pixels: fractional font sizes jitter between frames in parallel renders.
  return Math.round(Math.max(minPx, Math.min(basePx, maxW / (len * 0.58))));
};

/**
 * The chart's SVG, given its pixel size by the shared MeasuredChart (the same
 * flicker fix the recharts templates use): MeasuredChart measures its box in
 * useLayoutEffect and holds delayRender until the size is known, so no frame of the
 * render is captured before the chart has its final, stable size. The viewBox stays
 * in sign coordinates, so the drawing is identical at any measured size.
 */
const ChartSvg: React.FC<{ width?: number; height?: number; vbW: number; vbH: number; children?: React.ReactNode }> = ({
  width,
  height,
  vbW,
  vbH,
  children,
}) => (
  <svg width={width ?? vbW} height={height ?? vbH} viewBox={`0 0 ${vbW} ${vbH}`} style={{ display: "block", overflow: "visible" }}>
    {children}
  </svg>
);

const showValue = (value: number) => {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  const dec = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return String(Number(value.toFixed(dec)));
};

export const DataVisualisation: React.FC<SceneLayoutProps> = (props) => {
  const { frame, width, height, portrait, pal, fonts, pad, exit, seed } = useChristmasScene(props);
  const p = portrait;
  // Default sizes — must match backend/templates/christmas/meta.json; Template Studio rewrites these literals.
  const type = getChristmasTypography(props, (titleFontSize, descriptionFontSize) => ({
    title: titleFontSize ?? (p ? 88 : 76),
    body: descriptionFontSize ?? (p ? 40 : 36),
  }));
  const inputs = useMemo(() => resolveChartInputs(props.chartTable), [props.chartTable]);
  const kind = useMemo(() => selectChartType(props.chartType, inputs), [inputs, props.chartType]);
  const data = useMemo(() => orientChartInputsForType(inputs, kind), [inputs, kind]);

  const heading = (props.title || "").trim();
  const summary = (props.displayText || "").trim();
  const xAxisLabel = props.xAxisLabel || props.chartTable?.headers?.[0] || "";
  const yAxisLabel = props.yAxisLabel || props.chartTable?.headers?.[1] || "";

  const labels = data.labels.slice(0, 20);
  const series = (kind === "histogram" ? data.lineSeries.slice(0, 1) : data.lineSeries.slice(0, 3)).map((s) => ({
    ...s,
    values: s.values.slice(0, labels.length),
  }));
  const values = series.flatMap((s) => s.values).filter(Number.isFinite);
  const minRaw = values.length ? Math.min(...values) : 0;
  const maxRaw = values.length ? Math.max(...values) : 1;
  const min = Math.min(0, minRaw);
  const max = maxRaw === min ? min + 1 : maxRaw;
  const range = max - min || 1;
  const yTicks = props.chartYAxisTicks?.length
    ? props.chartYAxisTicks.slice(0, 4)
    : [max, min + range * (2 / 3), min + range / 3, min].map(formatAxisTick);
  const seriesColors = [pal.accent, FESTIVE.pine, FESTIVE.gold];

  // ── geometry ──
  const contentW = width - pad.x * 2;
  const copyW = portrait ? contentW : contentW * 0.3;
  const copyH = portrait ? height * 0.24 : height - pad.top - pad.bottom - 40;
  const gap = portrait ? 70 : 70;
  const signX = portrait ? pad.x : pad.x + copyW + gap;
  const signY = portrait ? pad.top + copyH + gap : pad.top + 40;
  const signW = portrait ? contentW : contentW - copyW - gap;
  const signH = portrait ? height - signY - pad.bottom : height - signY - pad.bottom;
  const border = Math.max(14, Math.min(signW, signH) * 0.035);

  const axisFont = type.bodyRelative(portrait ? 28 : 24);
  const valueFont = type.bodyRelative(portrait ? 28 : 24);
  const legendFont = type.bodyRelative(portrait ? 28 : 24);
  const legendH = series.length > 1 ? legendFont * 1.8 : 0;
  // Plot area in sign-local coordinates (inside the frame).
  // Y-axis column: wide enough for the LONGEST tick label at ONE shared size, so the
  // ticks never get squeezed to tiny, mismatched sizes (tiny text shimmers once the
  // video is encoded). Capped so the plot keeps most of the sign.
  const yLabelChars = Math.max(1, ...yTicks.map((t) => String(t).length));
  const yTitleW = yAxisLabel ? axisFont * 1.8 : 0;
  const yTickPx = Math.round(Math.max(18, Math.min(axisFont, (portrait ? 200 : 230) / (yLabelChars * 0.58))));
  const yTickColW = Math.ceil(yLabelChars * 0.58 * yTickPx);
  const plotX = Math.round(Math.max(border + (portrait ? 110 : 120), border + 12 + yTitleW + yTickColW + 16));
  const plot = {
    x: plotX,
    y: border + 50 + legendH,
    w: signW - plotX - border - 50,
    h: signH - border * 2 - (portrait ? 150 : 150) - legendH,
  };
  const pointX = (i: number) => plot.x + (labels.length <= 1 ? plot.w / 2 : (i / (labels.length - 1)) * plot.w);
  const pointY = (v: number) => plot.y + plot.h - ((v - min) / range) * plot.h;
  const zeroY = pointY(0);

  const groupW = plot.w / Math.max(1, labels.length);
  const barW = Math.max(8, Math.min(70, (groupW * 0.66) / Math.max(1, series.length)));
  const barX = (i: number, si: number) => plot.x + i * groupW + (groupW - barW * series.length) / 2 + si * barW;
  const isLine = kind === "line";
  const lineX = (i: number) => (isLine ? pointX(i) : barX(i, 0) + barW / 2);

  const primary = series[0]?.values ?? [];
  const peakIndex = primary.reduce((best, v, i) => (Number.isFinite(v) && v > (primary[best] ?? -Infinity) ? i : best), 0);
  const peakValue = primary[peakIndex];
  const peakX = lineX(peakIndex);
  const peakY = Number.isFinite(peakValue) ? pointY(peakValue) : plot.y;

  const labelStride = labels.length > 10 ? Math.ceil(labels.length / (portrait ? 4 : 7)) : 1;
  const valueStride = labels.length > 12 ? Math.ceil(labels.length / 6) : labels.length > 8 ? 2 : 1;
  const dense = labels.length * series.length > 30;
  // Horizontal room for one x label (labels shrink to fit it).
  const xLabelRoom = (isLine ? plot.w / Math.max(1, labels.length - 1) : groupW) * labelStride * 0.94;

  // ── timing ──
  const headIn = ease(frame, 4, 26);
  const bodyIn = ease(frame, 18, 46);
  // No overshoot: the whole chart SVG must land on exactly scale(1) and stay there
  // (an overshooting spring re-rasterises text + stripes at fractional scales).
  const signIn = ease(frame, 4, 28, Easing.out(Easing.cubic));
  const axesIn = ease(frame, 18, 36);
  const plotIn = ease(frame, 30, 86, Easing.inOut(Easing.cubic));
  const starIn = ease(frame, 86, 104, Easing.out(Easing.back(2)));
  // Unique per instance: two chart scenes on one page (Studio "All Scenes", several
  // previews) must never resolve url(#…) to each other's pattern.
  const caneId = `cane-${React.useId().replace(/:/g, "")}`;

  return (
    <AbsoluteFill style={{ overflow: "hidden", color: pal.ink }}>
      <WinterBackdrop pal={pal} seed={seed + 12} horizon={portrait ? 0.92 : 0.9} trees={false} />
      <LayeredSnow portrait={portrait} seed={seed} layer="back" density={0.55} />

      {/* copy panel */}
      <div style={{ position: "absolute", left: pad.x, top: pad.top + (portrait ? 0 : 40), opacity: headIn }}>
        <FrostCard pal={pal} width={copyW} height={copyH} variant="frost" seed={seed + 2} snow={headIn}>
          <div style={{ position: "absolute", inset: portrait ? 34 : 38, display: "flex", flexDirection: "column", justifyContent: "center", gap: portrait ? 16 : 22 }}>
            <FitText
              targetPx={type.title}
              minPx={portrait ? 40 : 34}
              maxHeightPx={copyH * (summary ? 0.42 : 0.8)}
              maxWidthPx={copyW - (portrait ? 68 : 76)}
              fitKey={`dv-head:${heading}:${portrait}`}
              exact={type.titleIsUserSet}
              style={{ fontFamily: fonts.title, fontWeight: fonts.titleWeight, lineHeight: 1.05, color: pal.accent }}
            >
              {heading}
            </FitText>
            {summary ? (
              <div style={{ opacity: bodyIn }}>
                <FitText
                  targetPx={type.body}
                  minPx={portrait ? 22 : 20}
                  maxHeightPx={copyH * 0.46}
                  maxWidthPx={copyW - (portrait ? 68 : 76)}
                  fitKey={`dv-body:${summary}:${portrait}`}
                  exact={type.bodyIsUserSet}
                  style={{ fontFamily: fonts.body, fontWeight: 600, lineHeight: 1.38, color: pal.inkSoft }}
                >
                  {summary}
                </FitText>
              </div>
            ) : null}
          </div>
        </FrostCard>
      </div>

      {/* chart sign */}
      <div style={{ position: "absolute", left: signX, top: signY, transform: `scale(${0.9 + signIn * 0.1})`, opacity: Math.min(1, signIn * 2), transformOrigin: "50% 0%" }}>
        <FrostCard pal={pal} width={signW} height={signH} seed={seed + 9} snow={signIn}>
          <div style={{ position: "absolute", left: -border, top: -border, width: signW, height: signH }}>
          <MeasuredChart>
          <ChartSvg vbW={signW} vbH={signH}>
            <defs>
              <pattern id={caneId} width={28} height={28} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width={28} height={28} fill={FESTIVE.snow} />
                <rect width={14} height={28} fill={pal.accent} />
              </pattern>
            </defs>

            {/* legend */}
            {series.length > 1
              ? series.map((s, si) => (
                  <g key={si} transform={`translate(${plot.x + si * (plot.w / series.length)} ${border + 22})`} opacity={axesIn}>
                    <circle cx={10} cy={legendFont * 0.5} r={legendFont * 0.36} fill={seriesColors[si]} />
                    <text x={30} y={legendFont * 0.85} fontFamily={fonts.body} fontWeight={700} fontSize={fitSvgPx(s.label, legendFont, plot.w / series.length - 44)} fill={pal.ink}>
                      {s.label}
                    </text>
                  </g>
                ))
              : null}

            {/* y gridlines (the tick NUMBERS are HTML — see the overlay below the chart) */}
            {yTicks.map((t, i) => {
              // Whole pixels for the y axis (fractional positions jitter in renders).
              const y = Math.round(plot.y + (i / Math.max(1, yTicks.length - 1)) * plot.h);
              return (
                <g key={i} opacity={axesIn}>
                  {/* solid gridline: a faint fine dash pattern shimmers after video encoding */}
                  <line x1={Math.round(plot.x)} x2={Math.round(plot.x + plot.w * axesIn)} y1={y} y2={y} stroke={withOpacity(pal.ink, 0.14)} strokeWidth={2} />
                </g>
              );
            })}
            {/* baseline (snowbank) */}
            <path
              d={`M${plot.x - 20} ${zeroY} Q${plot.x + plot.w * 0.25} ${zeroY - 14} ${plot.x + plot.w * 0.5} ${zeroY} Q${plot.x + plot.w * 0.75} ${zeroY + 10} ${plot.x + plot.w + 20} ${zeroY} L${plot.x + plot.w + 20} ${zeroY + 16} L${plot.x - 20} ${zeroY + 16} Z`}
              fill={FESTIVE.snow}
              stroke={withOpacity(pal.snowShade, 0.9)}
              strokeWidth={2}
              opacity={axesIn}
            />

            {/* x labels */}
            {labels.map((l, i) =>
              i % labelStride === 0 ? (
                <text
                  key={i}
                  x={lineX(i) + (isLine ? 0 : (barW * (series.length - 1)) / 2)}
                  y={plot.y + plot.h + axisFont * 1.6}
                  textAnchor="middle"
                  fontFamily={fonts.body}
                  fontWeight={700}
                  fontSize={fitSvgPx(l.length > 18 ? `${l.slice(0, 17)}…` : l, axisFont, xLabelRoom)}
                  fill={pal.inkSoft}
                  opacity={axesIn}
                >
                  {l.length > 18 ? `${l.slice(0, 17)}…` : l}
                </text>
              ) : null,
            )}
            {xAxisLabel ? (
              <text x={plot.x + plot.w / 2} y={plot.y + plot.h + axisFont * 3.1} textAnchor="middle" fontFamily={fonts.body} fontWeight={800} fontSize={fitSvgPx(xAxisLabel, axisFont, plot.w)} fill={pal.ink} opacity={axesIn}>
                {xAxisLabel}
              </text>
            ) : null}
            {yAxisLabel ? (
              <text
                transform={`translate(${Math.round(border + axisFont * 0.9)} ${Math.round(plot.y + plot.h / 2)}) rotate(-90)`}
                textAnchor="middle"
                fontFamily={fonts.body}
                fontWeight={800}
                fontSize={fitSvgPx(yAxisLabel, axisFont, plot.h)}
                fill={pal.ink}
                opacity={axesIn}
              >
                {yAxisLabel}
              </text>
            ) : null}

            {/* bars: candy canes */}
            {!isLine
              ? series.map((s, si) =>
                  s.values.map((v, i) => {
                    if (!Number.isFinite(v)) return null;
                    const grow = Math.max(0, Math.min(1, plotIn * labels.length - i * 0.6));
                    const top = pointY(v);
                    const y = Math.min(top, zeroY);
                    // Whole pixels, so the stripe pattern never shimmers as the bar grows.
                    const h = Math.round(Math.abs(zeroY - top) * grow);
                    const x = Math.round(barX(i, si));
                    const valueIn = interpolate(grow, [0.85, 1], [0, 1], clamp);
                    const fill = si === 0 ? `url(#${caneId})` : seriesColors[si];
                    return (
                      <g key={`${si}-${i}`}>
                        <rect x={x + 2} y={v >= 0 ? zeroY - h : zeroY} width={barW - 4} height={h} rx={Math.min(10, barW / 3)} fill={fill} stroke={mix(seriesColors[si], "#000", 0.2)} strokeWidth={2} />
                        {v >= 0 && h > 6 ? <path d={`M${x + 2} ${zeroY - h + 4} Q${x + barW / 2} ${zeroY - h - barW * 0.45} ${x + barW - 2} ${zeroY - h + 4}`} fill={FESTIVE.snow} /> : null}
                        {!dense && i % valueStride === 0 && valueIn > 0 ? (
                          <text x={x + barW / 2} y={y - 14} textAnchor="middle" fontFamily={fonts.body} fontWeight={800} fontSize={fitSvgPx(showValue(v), valueFont, Math.max(barW * 1.4, groupW / series.length) - 4)} fill={pal.ink} opacity={valueIn}>
                            {showValue(v)}
                          </text>
                        ) : null}
                      </g>
                    );
                  }),
                )
              : null}

            {/* lines: strings of fairy lights */}
            {isLine
              ? series.map((s, si) => {
                  const pts = s.values.map((v, i) => [pointX(i), Number.isFinite(v) ? pointY(v) : NaN] as const).filter(([, y]) => Number.isFinite(y));
                  if (!pts.length) return null;
                  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
                  return (
                    <g key={si}>
                      <path d={d} stroke="#2E4A3A" strokeWidth={4} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - plotIn} strokeLinejoin="round" />
                      {pts.map(([x, y], i) => {
                        const on = Math.max(0, Math.min(1, plotIn * pts.length - i));
                        if (on <= 0) return null;
                        // Slow, subtle twinkle (a fast deep pulse reads as flicker).
                        const tw = 0.88 + 0.12 * Math.sin(frame / 16 + i * 1.9 + si);
                        const r = Math.max(7, Math.min(14, plot.w / pts.length / 4));
                        return (
                          <g key={i}>
                            <circle cx={x} cy={y} r={r * 2.4} fill={withOpacity(seriesColors[si], 0.25 * tw * on)} />
                            <ellipse cx={x} cy={y + r * 0.3} rx={r * 0.7} ry={r} fill={seriesColors[si]} opacity={on} />
                            <rect x={x - r * 0.35} y={y - r * 1.05} width={r * 0.7} height={r * 0.6} fill="#2E4A3A" />
                            {!dense && i % valueStride === 0 && on > 0.4 && si === 0 ? (
                              <text x={x} y={y - r * 1.6} textAnchor="middle" fontFamily={fonts.body} fontWeight={800} fontSize={fitSvgPx(showValue(s.values[i]), valueFont, (plot.w / Math.max(1, pts.length - 1)) * valueStride * 0.9)} fill={pal.ink} opacity={interpolate(on, [0.4, 1], [0, 1], clamp)}>
                                {showValue(s.values[i])}
                              </text>
                            ) : null}
                          </g>
                        );
                      })}
                    </g>
                  );
                })
              : null}

            {/* peak star */}
            {Number.isFinite(peakValue) && starIn > 0 ? (
              <g transform={`translate(${peakX + (isLine ? 0 : (barW * (series.length - 1)) / 2)} ${peakY - (isLine ? 60 : valueFont * 2.6)}) scale(${starIn})`}>
                <circle r={34} fill={withOpacity(FESTIVE.goldLight, 0.45)} />
                <path d={starPath(0, 0, 24)} fill={FESTIVE.gold} stroke={mix(FESTIVE.gold, "#7a5a10", 0.4)} strokeWidth={2.5} strokeLinejoin="round" />
              </g>
            ) : null}
          </ChartSvg>
          </MeasuredChart>
          </div>
          {/* Y-axis numbers as plain HTML text, not SVG <text>: the right-anchored SVG
              numbers flickered in rendered videos only, while HTML text (every title and
              card in the template) renders stably. Same positions, whole pixels. */}
          <div style={{ position: "absolute", left: -border, top: -border, width: signW, height: signH, pointerEvents: "none" }}>
            {yTicks.map((t, i) => {
              const y = Math.round(plot.y + (i / Math.max(1, yTicks.length - 1)) * plot.h);
              const lineH = Math.round(yTickPx * 1.2);
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: Math.round(plot.x - 16 - yTickColW - 20),
                    width: Math.round(yTickColW + 20),
                    top: y - Math.round(lineH / 2),
                    height: lineH,
                    lineHeight: `${lineH}px`,
                    textAlign: "right",
                    whiteSpace: "nowrap",
                    fontFamily: fonts.body,
                    fontWeight: 700,
                    fontSize: yTickPx,
                    fontVariantNumeric: "tabular-nums",
                    color: pal.inkSoft,
                    opacity: axesIn,
                  }}
                >
                  {t}
                </div>
              );
            })}
          </div>
        </FrostCard>
      </div>

      <LayeredSnow portrait={portrait} seed={seed} layer="front" density={0.35} />
      <SnowClearIn frame={frame} />
      <SnowGustExit exit={exit} portrait={portrait} seed={seed} />
    </AbsoluteFill>
  );
};
