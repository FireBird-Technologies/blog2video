import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import {
  formatAxisTick,
  orientChartInputsForType,
  resolveChartInputs,
  selectChartType,
} from "../../_shared/chartData";
import { SpaceBackdrop } from "../components/SpaceBackdrop";
import { FitText } from "../components/FitText";
import type { SceneLayoutProps } from "../types";
import { getStarlitFontFamily, getStarlitTypography } from "../typography";
import { mixTheme, withOpacity } from "../components/themeColor";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const withAlpha = withOpacity;

const tintWithWhite = (hex: string, amount: number) => {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((x) => x + x).join("") : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return hex;
  const n = Number.parseInt(full, 16);
  const channel = (value: number) => Math.round(value + (255 - value) * amount).toString(16).padStart(2, "0");
  return `#${channel((n >> 16) & 255)}${channel((n >> 8) & 255)}${channel(n & 255)}`;
};

const DataVisualisationScene: React.FC<SceneLayoutProps> = (props) => {
  const thTxt = props.textColor || "#ffffff"; const thBg = props.bgColor || "#000000"; const thAcc = props.accentColor || "#217cff"; const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const portrait = props.aspectRatio === "portrait" || height > width;
  const p = portrait;
  const type = getStarlitTypography({
    ...props,
    titleFontSize: props.titleFontSize ?? (p ? 92 : 76),
    descriptionFontSize: props.descriptionFontSize ?? (p ? 74 : 54),
  }, p);
  const font = getStarlitFontFamily(props);
  const accent = props.accentColor || "#217cff";
  const text = props.textColor || "#ffffff";
  const bg = props.bgColor || "#000000";
  const inputs = useMemo(() => resolveChartInputs(props.chartTable), [props.chartTable]);
  const kind = useMemo(() => selectChartType(props.chartType, inputs), [inputs, props.chartType]);
  const data = useMemo(() => orientChartInputsForType(inputs, kind), [inputs, kind]);
  const reveal = interpolate(frame, [30, 76], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const titleIn = interpolate(frame, [16, 40], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const panelIn = interpolate(frame, [0, 30], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const axisIn = interpolate(frame, [36, 54], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const orbitIn = interpolate(frame, [28, 50], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const constellationPulse = .88 + Math.sin(frame * .055) * .12;

  const values = data.lineSeries.flatMap((series) => series.values).filter(Number.isFinite);
  const minRaw = values.length ? Math.min(...values) : 0;
  const maxRaw = values.length ? Math.max(...values) : 1;
  const min = Math.min(0, minRaw);
  const max = maxRaw === min ? min + 1 : maxRaw;
  const range = max - min || 1;
  const seriesColors = [accent, tintWithWhite(accent, .38), tintWithWhite(accent, .68)];
  const labels = data.labels.slice(0, 20);
  const hasData = labels.length > 0 && data.lineSeries.length > 0;
  const yTicks = props.chartYAxisTicks?.length
    ? props.chartYAxisTicks.slice(0, 4)
    : [max, min + range * 0.5, min].map(formatAxisTick);
  const title = props.title || "";
  const summary = props.chartSummary || props.narration || "";
  const xAxisLabel = props.xAxisLabel || props.chartTable?.headers?.[0] || "";
  const yAxisLabel = props.yAxisLabel || props.chartTable?.headers?.[1] || "";
  const outerX = width * (portrait ? .07 : .065);
  const outerTop = height * (portrait ? .075 : .08);
  const outerBottom = height * (portrait ? .105 : .08);
  const contentW = width - outerX * 2;
  const contentH = height - outerTop - outerBottom;
  const contentGap = portrait ? 38 : 64;
  const copyW = portrait ? contentW : contentW * .31;
  const copyH = portrait ? Math.min(430, contentH * .27) : contentH;
  const chartW = portrait ? contentW : contentW - copyW - contentGap;
  const chartH = portrait ? contentH - copyH - contentGap : contentH;
  const titleSize = type.titleIsUserSet ? type.title : Math.min(portrait ? 76 : 72, Math.max(type.title * .76, portrait ? 60 : 56));
  const summarySize = type.bodyIsUserSet ? type.body : Math.min(portrait ? 38 : 34, Math.max(type.body * .58, portrait ? 30 : 26));
  const plot = {
    x: portrait ? 118 : 104,
    y: portrait ? 72 : 78,
    w: chartW - (portrait ? 172 : 158),
    h: chartH - (portrait ? 190 : 180),
  };
  const pointX = (index: number) => plot.x + (labels.length <= 1 ? plot.w / 2 : (index / (labels.length - 1)) * plot.w);
  const pointY = (value: number) => plot.y + plot.h - ((value - min) / range) * plot.h;
  const linePath = (valuesIn: number[]) => {
    const points = valuesIn.slice(0, labels.length).map((value, index) => ({x: pointX(index), y: pointY(Number.isFinite(value) ? value : min)}));
    return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  };
  const scatteredPoint = (seriesIndex: number, pointIndex: number) => {
    const seed = (seriesIndex + 1) * 97 + (pointIndex + 1) * 53;
    const xNoise = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
    const yNoise = Math.abs(Math.sin(seed * 78.233) * 24634.6345) % 1;
    return {
      x: plot.x + plot.w * (.06 + xNoise * .88),
      y: plot.y + plot.h * (.06 + yNoise * .88),
    };
  };
  const scanCycle = Math.max(0, frame - 72) / 120;
  const scanPhase = scanCycle - Math.floor(scanCycle);
  const scanProgress = Easing.inOut(Easing.sin)(scanPhase);
  const scanOpacity = frame < 72 ? 0 : Math.sin(scanPhase * Math.PI) * .72;
  const scanX = plot.x + plot.w * scanProgress;
  const scanY = (valuesIn: number[]) => {
    const seriesValues = valuesIn.slice(0, labels.length);
    if (!seriesValues.length) return pointY(min);
    if (seriesValues.length === 1) return pointY(seriesValues[0]);
    const position = scanProgress * (seriesValues.length - 1);
    const left = Math.floor(position);
    const right = Math.min(seriesValues.length - 1, left + 1);
    const mix = position - left;
    const value = seriesValues[left] + (seriesValues[right] - seriesValues[left]) * mix;
    return pointY(Number.isFinite(value) ? value : min);
  };
  const axisFontSize = type.bodyIsUserSet ? type.body : Math.min(portrait ? 36 : 29, Math.max(type.body * .42, portrait ? 29 : 23));
  const axisLabelSize = type.bodyIsUserSet ? type.body : portrait ? 22 : 18;
  const valueFont = type.bodyIsUserSet ? type.body : Math.min(portrait ? 32 : 26, Math.max(axisFontSize * .95, portrait ? 24 : 20));
  const showValue = (value: number) => {
    if (!Number.isFinite(value)) return "";
    const abs = Math.abs(value);
    const dec = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
    return String(Number(value.toFixed(dec)));
  };
  const valueLabel = (value: number, x: number, y: number, color: string, show: number, key: string) => (
    <text key={key} x={x} y={y} textAnchor="middle" fill={thTxt} fontSize={valueFont} fontWeight="800" stroke={thBg} strokeWidth={valueFont * .22} strokeLinejoin="round" paintOrder="stroke" opacity={show} style={{filter: `drop-shadow(0 0 8px ${color})`}}>{showValue(value)}</text>
  );
  const valueLabelSeriesCount = kind === "histogram" ? 1 : Math.min(3, data.lineSeries.length);
  const denseValueLabels = labels.length > 12 || labels.length * valueLabelSeriesCount > 30;
  const valueLabelStride = labels.length > 12 ? Math.ceil(labels.length / 6) : labels.length > 8 ? 2 : 1;
  const shouldShowValueLabel = (index: number, seriesIndex: number) => {
    const isSampledPoint = index % valueLabelStride === 0 || index === labels.length - 1;
    return isSampledPoint && (!denseValueLabels || seriesIndex === 0);
  };

  return (
    <AbsoluteFill style={{ background: bg, color: text, fontFamily: font, overflow: "hidden" }}>
      <SpaceBackdrop seed={props.seed ?? 142} density={portrait ? 150 : 190} dustDensity={45} accentColor={accent} backgroundColor={bg} textColor={text} />
      <div style={{ position: "absolute", left: outerX, top: outerTop, width: contentW, height: contentH, display: "flex", flexDirection: portrait ? "column" : "row", gap: contentGap, minHeight: 0 }}>
        <div style={{ position: "relative", width: copyW, height: copyH, flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", paddingLeft: portrait ? 0 : 28, boxSizing: "border-box", opacity: titleIn, transform: portrait ? `translateY(${(1 - titleIn) * 22}px)` : `translateX(${(1 - titleIn) * -26}px)`, overflow: "hidden" }}>
          {!portrait ? <div style={{ position: "absolute", left: 0, top: "18%", bottom: "18%", width: 1, background: `linear-gradient(180deg, transparent, ${accent} 30%, ${withAlpha(text, .7)} 50%, ${accent} 70%, transparent)`, boxShadow: `0 0 18px ${withAlpha(accent, .72)}` }} /> : null}
          <FitText targetPx={titleSize} minPx={portrait ? 32 : 29} maxHeightPx={copyH * .28} fitKey={`chart-title:${title}:${portrait}`} exact={type.titleIsUserSet} style={{ color: text, lineHeight: 1.01, fontWeight: 680, letterSpacing: "-.045em", textShadow: `0 0 34px ${withAlpha(accent, .28)}`, marginTop: portrait ? 22 : 28 }}>{title}</FitText>
          <FitText targetPx={summarySize} minPx={portrait ? 20 : 18} maxHeightPx={copyH * .40} fitKey={`chart-summary:${summary}:${portrait}`} exact={type.bodyIsUserSet} style={{ color: withAlpha(text, .74), lineHeight: 1.42, fontWeight: 430, marginTop: portrait ? 18 : 24, maxWidth: portrait ? "96%" : "92%" }}>{summary}</FitText>
          <div style={{ display: "flex", flexWrap: "wrap", gap: portrait ? "12px 26px" : "14px 24px", marginTop: portrait ? 22 : 32 }}>
            {data.lineSeries.slice(0, 3).map((series, index) => <div key={series.label} style={{ display: "flex", alignItems: "center", gap: 10, color: withAlpha(text, .82), fontSize: type.bodyIsUserSet ? type.body : portrait ? 22 : 19, fontWeight: 600 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: seriesColors[index], border: `2px solid ${withAlpha(text, .7)}`, boxShadow: `0 0 14px ${seriesColors[index]}` }} />{series.label}</div>)}
          </div>
        </div>

        <div style={{ position: "relative", width: chartW, height: chartH, flexShrink: 0, minHeight: 0, overflow: "visible", opacity: panelIn, transform: `scale(${.975 + panelIn * .025})` }}>
            <div style={{ position: "absolute", inset: "5% 0 3% 2%", background: `radial-gradient(ellipse at 54% 48%, ${withAlpha(accent, .16)} 0%, ${withAlpha(accent, .07)} 36%, transparent 72%)`, filter: "blur(18px)" }} />
            {!hasData ? (
              <div />
            ) : (
              <svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
                <defs>
                  <filter id="starlit-chart-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                  <clipPath id="starlit-chart-reveal"><rect x={plot.x - 32} y={0} width={(plot.w + 64) * reveal} height={chartH} /></clipPath>
                  {seriesColors.map((color, index) => <radialGradient key={color} id={`starlit-node-${index}`}><stop offset="0%" stopColor={thTxt} stopOpacity=".96" /><stop offset="18%" stopColor={color} stopOpacity=".82" /><stop offset="100%" stopColor={color} stopOpacity="0" /></radialGradient>)}
                </defs>
                <g opacity={.2 * orbitIn}>
                  <ellipse cx={plot.x + plot.w * .55} cy={plot.y + plot.h * .5} rx={plot.w * .48} ry={plot.h * .27} fill="none" stroke={withAlpha(accent, .28)} strokeWidth="1" strokeDasharray="2 12" transform={`rotate(-9 ${plot.x + plot.w * .55} ${plot.y + plot.h * .5})`} />
                  <ellipse cx={plot.x + plot.w * .55} cy={plot.y + plot.h * .5} rx={plot.w * .32} ry={plot.h * .43} fill="none" stroke={withAlpha(text, .2)} strokeWidth=".8" strokeDasharray="1 14" transform={`rotate(18 ${plot.x + plot.w * .55} ${plot.y + plot.h * .5})`} />
                </g>
                <g opacity={axisIn}>
                  {yTicks.map((tick, index) => {
                    const y = plot.y + (index / Math.max(1, yTicks.length - 1)) * plot.h;
                    return <g key={index}><line x1={plot.x} x2={plot.x + plot.w} y1={y} y2={y} stroke={withAlpha(accent, .17)} strokeDasharray="3 12" /><text x={plot.x - 18} y={y + axisFontSize * .36} textAnchor="end" fill={thTxt} fontSize={axisFontSize} fontWeight="800">{tick}</text></g>;
                  })}
                  <line x1={plot.x} x2={plot.x} y1={plot.y} y2={plot.y + plot.h} stroke={thTxt} strokeWidth="3.2" strokeLinecap="round" />
                  <line x1={plot.x} x2={plot.x + plot.w} y1={pointY(0)} y2={pointY(0)} stroke={thTxt} strokeWidth="3.2" strokeLinecap="round" />
                </g>
                {kind === "line" ? data.lineSeries.slice(0, 3).map((series, si) => (
                  <g key={series.label}>
                    <g clipPath="url(#starlit-chart-reveal)"><path d={linePath(series.values)} fill="none" stroke={seriesColors[si]} strokeWidth={si === 0 ? 2.4 : 2.1} strokeOpacity={si === 0 ? .9 : .8} strokeLinecap="round" strokeLinejoin="round" /></g>
                    {series.values.slice(0, labels.length).map((value, index) => {
                      const targetX = pointX(index);
                      const targetY = pointY(value);
                      const origin = scatteredPoint(si, index);
                      const primary = si === 0;
                      const latest = primary && index === Math.min(series.values.length, labels.length) - 1;
                      const settle = spring({fps, frame: frame - index * 2 - si, durationInFrames: 28, config: {damping: 20, stiffness: 86}});
                      const starIn = interpolate(frame, [index + si, index + si + 7], [0, 1], clamp);
                      const x = interpolate(settle, [0, 1], [origin.x, targetX]);
                      const y = interpolate(settle, [0, 1], [origin.y, targetY]);
                      return <g key={index} transform={`translate(${x} ${y}) scale(${.72 + settle * .28})`} opacity={starIn}><circle r={primary ? 26 : 18} fill={`url(#starlit-node-${si})`} opacity={primary ? .82 : .58} />{primary ? <path d="M-22 0H22M0-22V22" stroke={withAlpha(seriesColors[si], .34)} strokeWidth="1" opacity={.35 + settle * .65} /> : null}{latest ? <circle r={18 * constellationPulse} fill="none" stroke={seriesColors[si]} strokeWidth="1.5" strokeDasharray="3 6" opacity={reveal * .76} transform={`rotate(${frame * 1.4})`} /> : null}<circle r={primary ? 7 : 5} fill={seriesColors[si]} stroke={withAlpha(text, .9)} strokeWidth={primary ? 2 : 1.4} filter="url(#starlit-chart-glow)" />{primary ? <circle r="2.2" fill={thTxt} /> : null}{shouldShowValueLabel(index, si) ? valueLabel(value, 0, primary ? -40 : valueFont + 22, seriesColors[si], interpolate(settle, [.5, 1], [0, 1], clamp), `v${si}-${index}`) : null}</g>;
                    })}
                  </g>
                )) : labels.map((label, index) => {
                  const groupW = plot.w / Math.max(1, labels.length);
                  const activeSeries = kind === "histogram" ? data.lineSeries.slice(0, 1) : data.lineSeries.slice(0, 3);
                  const barW = Math.max(7, Math.min(64, (groupW * .72) / Math.max(1, activeSeries.length)));
                  return activeSeries.map((series, si) => {
                    const value = Number.isFinite(series.values[index]) ? series.values[index] : 0;
                    const zeroY = pointY(0);
                    const targetY = pointY(value);
                    const h = Math.abs(zeroY - targetY) * reveal;
                    const x = plot.x + index * groupW + (groupW - barW * activeSeries.length) / 2 + si * barW;
                    const y = value >= 0 ? zeroY - h : zeroY;
                    return <g key={`${index}-${si}`}><rect x={x} y={y} width={barW - (kind === "histogram" ? 1 : 4)} height={h} rx={kind === "histogram" ? 1 : 5} fill={withAlpha(seriesColors[si], .16)} stroke={seriesColors[si]} strokeWidth="1.2" /><circle cx={x + (barW - (kind === "histogram" ? 1 : 4)) / 2} cy={value >= 0 ? y : y + h} r="14" fill={`url(#starlit-node-${si})`} /><circle cx={x + (barW - (kind === "histogram" ? 1 : 4)) / 2} cy={value >= 0 ? y : y + h} r="4.5" fill={seriesColors[si]} stroke={text} strokeWidth="1.2" filter="url(#starlit-chart-glow)" />{shouldShowValueLabel(index, si) ? valueLabel(value, x + (barW - (kind === "histogram" ? 1 : 4)) / 2, value >= 0 ? y - 26 : y + h + 36, seriesColors[si], interpolate(reveal, [.6, 1], [0, 1], clamp), `bv${index}-${si}`) : null}</g>;
                  });
                })}
                <g opacity={scanOpacity} clipPath="url(#starlit-chart-reveal)">
                  <line x1={scanX} x2={scanX} y1={plot.y - 26} y2={plot.y + plot.h + 18} stroke={withAlpha(accent, .5)} strokeWidth="1" strokeDasharray="3 9" filter="url(#starlit-chart-glow)" />
                  {kind === "line" ? data.lineSeries.slice(0, 3).map((series, index) => <g key={series.label} transform={`translate(${scanX} ${scanY(series.values)})`}><circle r={index === 0 ? 30 : 21} fill={`url(#starlit-node-${index})`} /><circle r={index === 0 ? 6 : 4.5} fill={thTxt} stroke={seriesColors[index]} strokeWidth="2" filter="url(#starlit-chart-glow)" /></g>) : null}
                </g>
                <g opacity={axisIn}>
                  {labels.map((label, index) => {
                    const stride = labels.length > 10 ? Math.ceil(labels.length / (portrait ? 4 : 7)) : 1;
                    const lastIndex = labels.length - 1;
                    const tooCloseToLast = index !== lastIndex && lastIndex - index < Math.max(2, stride);
                    if (index !== lastIndex && (index % stride !== 0 || tooCloseToLast)) return null;
                    return <text key={index} x={pointX(index)} y={plot.y + plot.h + axisFontSize + 8} textAnchor="middle" fill={thTxt} fontSize={axisFontSize} fontWeight="800">{label.length > 10 ? `${label.slice(0, 9)}…` : label}</text>;
                  })}
                  <text x={plot.x + plot.w / 2} y={chartH - 18} textAnchor="middle" fill={thTxt} fontSize={axisLabelSize} fontWeight="800" letterSpacing={portrait ? 3.2 : 2.8}>{xAxisLabel.toUpperCase()}</text>
                  <text transform={`translate(${portrait ? 24 : 22} ${plot.y + plot.h / 2}) rotate(-90)`} textAnchor="middle" fill={thTxt} fontSize={axisLabelSize} fontWeight="800" letterSpacing={portrait ? 3.2 : 2.8}>{yAxisLabel.toUpperCase()}</text>
                </g>
              </svg>
            )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const DataVisualisation: React.FC<SceneLayoutProps> = (props) => <DataVisualisationScene {...props} />;
