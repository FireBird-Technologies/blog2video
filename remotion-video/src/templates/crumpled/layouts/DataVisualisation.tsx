/**
 * Data layout — a graph-paper patch on the crumpled sheet. Axes and gridlines are
 * ruled in pencil, line series are sketched on point by point, bars are drawn as
 * hatched pencil boxes, and the peak value is circled in red pencil.
 * Data comes only from the pipeline-bound `chartTable` (shared chartData helpers).
 *
 * The chart is on a well-crumpled sheet of graph paper lying on the white desk; the
 * title / summary / legend are written straight on the white beside it.
 *
 * Entry (built in, first frames): the chart sheet starts folded in half and unfolds; then the writing starts.
 * Exit (built in, last frames): the whole graph is circled in pencil, then it is all dragged off to the left.
 */
import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import {
  formatAxisTick,
  orientChartInputsForType,
  resolveChartInputs,
  selectChartType,
} from "../../_shared/chartData";
import type { SceneLayoutProps } from "../types";
import { PaperBackdrop } from "../components/PaperBackdrop";
import { FitText } from "../components/FitText";
import { PencilLayer, PencilStroke, hatchPath, scribbleCirclePath, sketchBoxPath, underlinePath } from "../components/Pencil";
import { Written, ease } from "../components/Handwriting";
import { useCrumpledScene, scenePaper } from "../components/sceneKit";
import { getCrumpledTypography } from "../typography";
import { CrumpleLayer } from "../components/CrumpleLayer";
import { clamp, mix, withOpacity, CRUMPLED_DESK } from "../crumpledStyle";

const showValue = (value: number) => {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  const dec = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return String(Number(value.toFixed(dec)));
};

// ─── Entry / exit ───────────────────────────────────────────────

/**
 * Entry and exit are a "spec" applied to ONE fixed wrapper tree around the scene, so
 * the layout never remounts when they run; idle → every style is empty.
 */
interface Spec {
  outer?: React.CSSProperties;
  mid?: React.CSSProperties;
  inner?: React.CSSProperties;
  midOverlay?: React.ReactNode;
  extras?: React.ReactNode;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const easeInOut = Easing.inOut(Easing.cubic);
const easeOut = Easing.out(Easing.cubic);
const seg = (t: number, a: number, b: number, e = easeInOut) => interpolate(t, [a, b], [0, 1], { ...clamp, easing: e });

/**
 * Entry: every sheet starts folded in half — its right half (bottom half in portrait)
 * folded OVER the front, showing the paper's back — and all of them swing open toward
 * the viewer at the same moment. The flaps are copies of the scene cropped to each
 * sheet's second half; the scene itself is clipped to the sheets' first halves.
 */
const unfoldSheets = (t: number, sheets: Rect[], w: number, h: number, portrait: boolean, paper: string, ink: string, children: React.ReactNode): Spec => {
  const appear = seg(t, 0, 0.15, easeOut);
  const open = seg(t, 0.1, 0.9);
  const k = 1 - open;
  const crease = Math.sin(open * Math.PI);
  const persp = Math.max(w, h) * 1.4;
  const m = 60; // room for the sheets' shadows outside the clip
  const first = (r: Rect) =>
    portrait ? { x: r.x - m, y: r.y - m, w: r.w + m * 2, h: r.h / 2 + m } : { x: r.x - m, y: r.y - m, w: r.w / 2 + m, h: r.h + m * 2 };
  const clip = `path("${sheets
    .map(first)
    .map((q) => `M${q.x.toFixed(1)} ${q.y.toFixed(1)} H${(q.x + q.w).toFixed(1)} V${(q.y + q.h).toFixed(1)} H${q.x.toFixed(1)} Z`)
    .join(" ")}")`;
  const shadeDir = portrait ? "180deg" : "90deg";
  return {
    outer: { opacity: appear, transform: `scale(${(1 + (1 - appear) * 0.04).toFixed(4)})`, transformOrigin: "50% 50%" },
    mid: open < 1 ? { clipPath: clip } : undefined,
    extras:
      open < 1 ? (
        <AbsoluteFill style={{ perspective: persp, perspectiveOrigin: `${w / 2}px ${h / 2}px` }}>
          {sheets.map((r, i) => {
            const fx = portrait ? r.x : r.x + r.w / 2;
            const fy = portrait ? r.y + r.h / 2 : r.y;
            const fw = portrait ? r.w : r.w / 2;
            const fh = portrait ? r.h / 2 : r.h;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: fx,
                  top: fy,
                  width: fw,
                  height: fh,
                  transformStyle: "preserve-3d",
                  transformOrigin: portrait ? "50% 0%" : "0% 50%",
                  transform: portrait ? `rotateX(${(k * 180).toFixed(2)}deg)` : `rotateY(${(-k * 180).toFixed(2)}deg)`,
                }}
              >
                <div style={{ position: "absolute", inset: 0, overflow: "hidden", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                  <div style={{ position: "absolute", left: -fx, top: -fy, width: w, height: h }}>{children}</div>
                  <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${shadeDir}, ${withOpacity(ink, 0.3 * crease)} 0%, transparent 60%)` }} />
                </div>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `linear-gradient(${portrait ? "0deg" : "270deg"}, ${mix(paper, ink, 0.1)} 0%, ${mix(paper, "#ffffff", 0.3)} 55%, ${mix(paper, ink, 0.05)} 100%)`,
                    boxShadow: `0 8px 20px ${withOpacity(ink, 0.18)}`,
                    transform: portrait ? "rotateX(180deg)" : "rotateY(180deg)",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                  }}
                />
              </div>
            );
          })}
        </AbsoluteFill>
      ) : null,
  };
};

/**
 * Exit: a big pencil circle is scribbled round the whole graph, then the page — graph,
 * circle and writing together — is dragged off to the left, leaving the white desk.
 */
const circleDrag = (t: number, chart: Rect, w: number, seed: number, accent: string, ink: string): Spec => {
  const ring = seg(t, 0, 0.45, Easing.inOut(Easing.quad));
  const drag = seg(t, 0.45, 1, Easing.in(Easing.cubic));
  const cx = chart.x + chart.w / 2;
  const cy = chart.y + chart.h / 2;
  const stroke = Math.max(3.5, Math.min(chart.w, chart.h) * 0.0065);
  return {
    outer: {
      transform: `translateX(${(-drag * w * 1.25).toFixed(1)}px) rotate(${(-drag * 3).toFixed(2)}deg)`,
      transformOrigin: "50% 50%",
    },
    midOverlay: (
      <PencilLayer wobble={3}>
        <PencilStroke d={scribbleCirclePath(cx, cy, (chart.w / 2) * 1.07, (chart.h / 2) * 1.05, seed + 5, 1.12)} progress={ring} color={accent} width={stroke} />
      </PencilLayer>
    ),
  };
};

/** Nominal entry length; capped at 30% of the scene. */
const ENTRY_FRAMES = 40;

/** Nominal exit length; capped at 35% of the scene. */
const EXIT_FRAMES = 44;

export const DataVisualisation: React.FC<SceneLayoutProps> = (props) => {
  const { frame: sceneFrame, width, height, portrait, pal, font, pad } = useCrumpledScene(props);
  const total = props.sceneDurationInFrames ?? 300;
  const entryLen = Math.min(ENTRY_FRAMES, Math.floor(total * 0.3));
  // Writing and chart drawing start as the papers finish unfolding.
  const frame = sceneFrame - Math.round(entryLen * 0.85);
  const p = portrait;
  // Default sizes — must match backend/templates/crumpled/meta.json; Template Studio rewrites these literals.
  const type = getCrumpledTypography(props, (titleFontSize, descriptionFontSize) => ({
    title: titleFontSize ?? (p ? 112 : 98),
    body: descriptionFontSize ?? (p ? 67 : 60),
  }));
  const seed = props.seed ?? 142;
  const sheet = scenePaper(props, seed, 3);
  const inputs = useMemo(() => resolveChartInputs(props.chartTable), [props.chartTable]);
  const kind = useMemo(() => selectChartType(props.chartType, inputs), [inputs, props.chartType]);
  const data = useMemo(() => orientChartInputsForType(inputs, kind), [inputs, kind]);

  const title = (props.title || "").trim();
  const summary = (props.chartSummary || props.narration || "").trim();
  const xAxisLabel = props.xAxisLabel || props.chartTable?.headers?.[0] || "";
  const yAxisLabel = props.yAxisLabel || props.chartTable?.headers?.[1] || "";

  const labels = data.labels.slice(0, 20);
  const series = (kind === "histogram" ? data.lineSeries.slice(0, 1) : data.lineSeries.slice(0, 3)).map((s) => ({
    ...s,
    values: s.values.slice(0, labels.length),
  }));
  const hasData = labels.length > 0 && series.length > 0;
  const values = series.flatMap((s) => s.values).filter(Number.isFinite);
  const minRaw = values.length ? Math.min(...values) : 0;
  const maxRaw = values.length ? Math.max(...values) : 1;
  const min = Math.min(0, minRaw);
  const max = maxRaw === min ? min + 1 : maxRaw;
  const range = max - min || 1;
  const yTicks = props.chartYAxisTicks?.length
    ? props.chartYAxisTicks.slice(0, 4)
    : [max, min + range * (2 / 3), min + range / 3, min].map(formatAxisTick);
  const seriesColors = [pal.accent, pal.ink, mix(pal.ink, pal.paper, 0.45)];

  // ── geometry ──
  const contentW = width - pad.x * 2;
  const gap = portrait ? 90 : 120;
  const copyW = portrait ? contentW : contentW * 0.3;
  const copyH = portrait ? height * 0.24 : height - pad.top - pad.bottom;
  const chartX = portrait ? pad.x - 40 : pad.x + copyW + gap - 40;
  const chartY = portrait ? pad.top + copyH + gap - 30 : pad.top - 50;
  const chartW = portrait ? contentW + 80 : contentW - copyW - gap + 90;
  const chartH = portrait ? height - chartY - pad.bottom + 50 : height - pad.top - pad.bottom + 100;

  // The two papers: the chart sheet (crumpled) and the text sheet around the copy.
  const chartSheet: Rect = { x: chartX, y: chartY, w: chartW, h: chartH };
  const sheetShadow = `0 12px 26px ${withOpacity(pal.ink, 0.16)}, 0 2px 5px ${withOpacity(pal.ink, 0.1)}`;

  // Secondary chart text scales with the body slider; the summary is the body's primary.
  const axisFont = type.bodyRelative(portrait ? 34 : 30);
  const axisLabelFont = type.bodyRelative(portrait ? 32 : 28);
  const valueFont = type.bodyRelative(portrait ? 32 : 28);
  const plot = {
    x: chartX + (portrait ? 120 : 130),
    y: chartY + (portrait ? 70 : 70),
    w: chartW - (portrait ? 160 : 180),
    h: chartH - (portrait ? 180 : 190),
  };
  const pointX = (i: number) => plot.x + (labels.length <= 1 ? plot.w / 2 : (i / (labels.length - 1)) * plot.w);
  const pointY = (v: number) => plot.y + plot.h - ((v - min) / range) * plot.h;
  const zeroY = pointY(0);

  // ── timing ──
  const titleIn = ease(frame, 0, 30, Easing.inOut(Easing.quad));
  const summaryIn = ease(frame, 26, 80, Easing.linear);
  const gridIn = ease(frame, 6, 30);
  const axesIn = ease(frame, 14, 40, Easing.inOut(Easing.quad));
  const plotIn = ease(frame, 40, 100, Easing.inOut(Easing.cubic));
  const peakIn = ease(frame, 100, 126);

  // Peak (first series)
  const primary = series[0]?.values ?? [];
  const peakIndex = primary.reduce((best, v, i) => (Number.isFinite(v) && v > (primary[best] ?? -Infinity) ? i : best), 0);
  const peakValue = primary[peakIndex];

  const groupW = plot.w / Math.max(1, labels.length);
  const barW = Math.max(8, Math.min(80, (groupW * 0.7) / Math.max(1, series.length)));
  const barX = (i: number, si: number) => plot.x + i * groupW + (groupW - barW * series.length) / 2 + si * barW;
  const peakX = kind === "line" ? pointX(peakIndex) : barX(peakIndex, 0) + barW / 2;
  const peakY = Number.isFinite(peakValue) ? pointY(peakValue) : plot.y;

  const labelStride = labels.length > 10 ? Math.ceil(labels.length / (portrait ? 4 : 7)) : 1;
  const valueStride = labels.length > 12 ? Math.ceil(labels.length / 6) : labels.length > 8 ? 2 : 1;
  const dense = labels.length * series.length > 30;

  const content = (
    <AbsoluteFill style={{ fontFamily: font, color: pal.ink, overflow: "hidden", background: CRUMPLED_DESK }}>
      {/* The chart sheet: crumpled paper (only here) with a graph-paper grid. */}
      <div style={{ position: "absolute", left: chartX, top: chartY, width: chartW, height: chartH, overflow: "hidden", boxShadow: sheetShadow }}>
        <div style={{ position: "absolute", left: -chartX, top: -chartY, width, height }}>
      <PaperBackdrop paper={pal.paper} ink={pal.ink} seed={sheet.seed} orientation={sheet.orientation} density={11} depth={sheet.depth + 0.25}>
        {/* graph-paper patch behind the chart */}
        <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: gridIn }}>
          <defs>
            <pattern id={`crumpled-grid-${seed}`} width={portrait ? 36 : 32} height={portrait ? 36 : 32} patternUnits="userSpaceOnUse" x={chartX} y={chartY}>
              <path d={`M ${portrait ? 36 : 32} 0 L 0 0 0 ${portrait ? 36 : 32}`} fill="none" stroke={withOpacity(pal.ink, 0.09)} strokeWidth={1} />
            </pattern>
          </defs>
          <rect x={chartX} y={chartY} width={chartW} height={chartH} fill={mix(pal.paper, "#ffffff", 0.4)} opacity={0.12} />
          <rect x={chartX} y={chartY} width={chartW} height={chartH} fill={`url(#crumpled-grid-${seed})`} />
        </svg>
      </PaperBackdrop>
          {/* deeper creases + a fine web of wrinkles: a properly crumpled sheet */}
          <CrumpleLayer seed={sheet.seed} orientation={sheet.orientation} paper={pal.paper} amount={0.75} density={11} />
        </div>
      </div>

      {/* copy */}
      <div style={{ position: "absolute", left: pad.x, top: pad.top, width: copyW, height: copyH, display: "flex", flexDirection: "column", justifyContent: portrait ? "flex-start" : "center" }}>
        <Written progress={titleIn}>
          <FitText
            targetPx={type.title}
            minPx={portrait ? 42 : 34}
            maxHeightPx={copyH * (portrait ? 0.42 : 0.34)}
            maxWidthPx={copyW}
            fitKey={`dv-title:${title}:${portrait}`}
            exact={type.titleIsUserSet}
            style={{ fontWeight: 700, lineHeight: 1.02 }}
          >
            {title}
          </FitText>
        </Written>
        <PencilLayer width={Math.min(copyW * 0.8, 480)} height={30} style={{ marginTop: portrait ? 12 : 10, marginLeft: -6 }}>
          <PencilStroke d={underlinePath(2, 12, Math.min(copyW * 0.8, 480) - 24, seed)} progress={ease(frame, 22, 42)} color={pal.accent} width={5} />
        </PencilLayer>
        <div style={{ height: portrait ? 20 : 26 }} />
        {summary ? (
          <Written progress={summaryIn} mode="block">
            <FitText
              targetPx={type.body}
              minPx={portrait ? 30 : 26}
              maxHeightPx={copyH * (portrait ? 0.42 : 0.42)}
              maxWidthPx={copyW}
              fitKey={`dv-sum:${summary}:${portrait}`}
              exact={type.bodyIsUserSet}
              style={{ fontWeight: 500, lineHeight: 1.26, color: pal.inkSoft }}
            >
              {summary}
            </FitText>
          </Written>
        ) : null}
        {series.length > 1 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 28px", marginTop: portrait ? 18 : 30, opacity: summaryIn }}>
            {series.map((s, i) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: axisLabelFont, fontWeight: 600 }}>
                <svg width={44} height={16}>
                  <path d="M2 9 Q 12 3 22 8 T 42 7" stroke={seriesColors[i]} strokeWidth={5} fill="none" strokeLinecap="round" />
                </svg>
                {s.label}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {hasData ? (
        <PencilLayer wobble={2}>
          {/* gridlines + y ticks */}
          {yTicks.map((tick, i) => {
            const y = plot.y + (i / Math.max(1, yTicks.length - 1)) * plot.h;
            return (
              <g key={`t${i}`} opacity={axesIn}>
                <line x1={plot.x} x2={plot.x + plot.w} y1={y} y2={y} stroke={withOpacity(pal.ink, 0.22)} strokeWidth={1.6} strokeDasharray="10 10" />
                <text x={plot.x - 22} y={y + axisFont * 0.32} textAnchor="end" fontFamily={font} fontSize={axisFont} fontWeight={600} fill={pal.ink}>
                  {tick}
                </text>
              </g>
            );
          })}
          {/* axes */}
          <PencilStroke d={`M${plot.x} ${plot.y - 20} L${plot.x} ${plot.y + plot.h + 6}`} progress={axesIn} color={pal.ink} width={4} />
          <PencilStroke d={`M${plot.x - 6} ${zeroY} L${plot.x + plot.w + 24} ${zeroY}`} progress={axesIn} color={pal.ink} width={4} />

          {kind === "line"
            ? series.map((s, si) => {
                const d = s.values
                  .map((v, i) => `${i === 0 ? "M" : "L"}${pointX(i).toFixed(1)} ${pointY(Number.isFinite(v) ? v : min).toFixed(1)}`)
                  .join(" ");
                const reveal = interpolate(plotIn, [si * 0.12, Math.min(1, 0.7 + si * 0.12)], [0, 1], clamp);
                return (
                  <g key={s.label}>
                    <PencilStroke d={d} progress={reveal} color={seriesColors[si]} width={si === 0 ? 6 : 4.5} />
                    {s.values.map((v, i) => {
                      const at = labels.length <= 1 ? 1 : i / (labels.length - 1);
                      const on = interpolate(reveal, [at - 0.02, at + 0.04], [0, 1], clamp);
                      const showV = (i % valueStride === 0 || i === labels.length - 1) && (!dense || si === 0);
                      return (
                        <g key={i} opacity={on}>
                          <circle cx={pointX(i)} cy={pointY(v)} r={si === 0 ? 9 : 7} fill={pal.paper} stroke={seriesColors[si]} strokeWidth={4} />
                          {showV ? (
                            <text x={pointX(i)} y={pointY(v) - 22} textAnchor="middle" fontFamily={font} fontSize={valueFont} fontWeight={700} fill={seriesColors[si]} stroke={pal.paper} strokeWidth={valueFont * 0.18} paintOrder="stroke">
                              {showValue(v)}
                            </text>
                          ) : null}
                        </g>
                      );
                    })}
                  </g>
                );
              })
            : labels.map((_, i) =>
                series.map((s, si) => {
                  const v = Number.isFinite(s.values[i]) ? s.values[i] : 0;
                  const grow = interpolate(plotIn, [i / labels.length * 0.6, i / labels.length * 0.6 + 0.4], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
                  const full = Math.abs(zeroY - pointY(v));
                  const h = full * grow;
                  const x = barX(i, si);
                  const w = barW - (kind === "histogram" ? 2 : 8);
                  const y = v >= 0 ? zeroY - h : zeroY;
                  const showV = (i % valueStride === 0 || i === labels.length - 1) && (!dense || si === 0);
                  return (
                    <g key={`${i}-${si}`}>
                      {h > 2 ? (
                        <>
                          <path d={hatchPath(x, y, w, h, si === 0 ? 11 : 15)} stroke={withOpacity(seriesColors[si], si === 0 ? 0.55 : 0.4)} strokeWidth={2.4} fill="none" />
                          <PencilStroke d={sketchBoxPath(x, y, w, h, seed + i * 3 + si)} progress={1} color={seriesColors[si]} width={3.4} double={false} />
                        </>
                      ) : null}
                      {showV && grow > 0.95 ? (
                        <text x={x + w / 2} y={v >= 0 ? y - 16 : y + h + valueFont} textAnchor="middle" fontFamily={font} fontSize={valueFont} fontWeight={700} fill={seriesColors[si]}>
                          {showValue(v)}
                        </text>
                      ) : null}
                    </g>
                  );
                }),
              )}

          {/* x labels */}
          <g opacity={axesIn}>
            {labels.map((label, i) => {
              const last = labels.length - 1;
              const tooClose = i !== last && last - i < Math.max(2, labelStride);
              if (i !== last && (i % labelStride !== 0 || tooClose)) return null;
              const x = kind === "line" ? pointX(i) : plot.x + i * groupW + groupW / 2;
              return (
                <text key={i} x={x} y={zeroY + axisFont + 18} textAnchor="middle" fontFamily={font} fontSize={axisFont} fontWeight={600} fill={pal.ink}>
                  {label.length > 12 ? `${label.slice(0, 11)}…` : label}
                </text>
              );
            })}
            {xAxisLabel ? (
              <text x={plot.x + plot.w / 2} y={chartY + chartH - 22} textAnchor="middle" fontFamily={font} fontSize={axisLabelFont} fontWeight={700} fill={pal.inkSoft}>
                {xAxisLabel}
              </text>
            ) : null}
            {yAxisLabel ? (
              <text transform={`translate(${chartX + 34} ${plot.y + plot.h / 2}) rotate(-90)`} textAnchor="middle" fontFamily={font} fontSize={axisLabelFont} fontWeight={700} fill={pal.inkSoft}>
                {yAxisLabel}
              </text>
            ) : null}
          </g>

          {/* peak circled in red pencil */}
          {Number.isFinite(peakValue) ? (
            <PencilStroke d={scribbleCirclePath(peakX, peakY - (kind === "line" ? 10 : 30), portrait ? 62 : 58, portrait ? 52 : 46, seed)} progress={peakIn} color={pal.accent} width={4.5} opacity={0.85} />
          ) : null}
        </PencilLayer>
      ) : null}
    </AbsoluteFill>
  );

  // Exit, in the scene's own last frames (raw frame, so it tracks the real scene end
  // and plays the same in the full video and when the scene is played on its own).
  const rawFrame = useCurrentFrame();
  const exitLen = Math.min(EXIT_FRAMES, Math.floor(total * 0.35));
  const exitT = interpolate(rawFrame, [total - exitLen, total], [0, 1], clamp);
  const entryT = entryLen > 0 ? interpolate(sceneFrame, [0, entryLen], [0, 1], clamp) : 1;
  const spec: Spec =
    exitT > 0
      ? circleDrag(exitT, chartSheet, width, sheet.seed, pal.accent, pal.ink)
      : entryT < 1
        ? unfoldSheets(entryT, [chartSheet], width, height, portrait, pal.paper, pal.ink, content)
        : {};

  return (
    <AbsoluteFill style={{ background: CRUMPLED_DESK }}>
      <AbsoluteFill style={spec.outer}>
        <AbsoluteFill style={spec.mid}>
          <AbsoluteFill style={spec.inner}>{content}</AbsoluteFill>
          {spec.midOverlay ?? null}
        </AbsoluteFill>
        {spec.extras ?? null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
