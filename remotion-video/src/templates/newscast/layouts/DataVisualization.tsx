import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { NewscastLayoutProps } from "./types";
import { NewsCastLayoutImageBackground } from "../NewsCastLayoutImageBackground";
import {
  DEFAULT_NEWSCAST_ACCENT,
  DEFAULT_NEWSCAST_TEXT,
  getNewscastPortraitTypeScale,
  newscastFont,
  resolveNewscastDescriptionSize,
  resolveNewscastTitleSize,
  scaleNewscastPx,
} from "../themeUtils";
import {
  HEADLINE_WEIGHT,
  headlinePop,
  headlinePopStyle,
  headlineTextShadow,
  panelTumbleStyle,
  panelTumbleUp,
} from "../newscastLayoutMotion";

const BLUE = "#1E5FD4";
const GOLD = "#D4AA50";

function toNumber(v: unknown): number {
  const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

const LINE_COLORS = ["#E82020", BLUE, GOLD];

/** Pie wedge path; angles in degrees, 0° = top. */
function pieSlicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const rad = Math.PI / 180;
  const x1 = cx + r * Math.cos((startDeg - 90) * rad);
  const y1 = cy + r * Math.sin((startDeg - 90) * rad);
  const x2 = cx + r * Math.cos((endDeg - 90) * rad);
  const y2 = cy + r * Math.sin((endDeg - 90) * rad);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

export const DataVisualization: React.FC<NewscastLayoutProps> = ({
  title,
  narration,
  barChartRows,
  barChart,
  lineChartLabels,
  lineChartDatasets,
  pieChartRows,
  tickerItems,
  lowerThirdTag,
  lowerThirdHeadline,
  lowerThirdSub,
  imageUrl,
  accentColor,
  textColor,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const chartT = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  // Bar overshoot + label fade synced to the existing `chartT` timeline.
  const barOvershootT = interpolate(chartT, [0, 0.76, 1], [0, 1.26, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const labelOpacity = interpolate(chartT, [0, 0.68, 1], [0, 0.22, 0.95], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const barOpacity = interpolate(chartT, [0, 0.62, 1], [0, 1, 0.95], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const { width, height } = useVideoConfig();
  const portraitScale = getNewscastPortraitTypeScale(width, height);
  const isNarrow = width < 900;

  const zEnter = chartT; // tie Z entrance to chart reveal
  // Keep 3D tilt subtle so bars stay readable (steep Y-rotate hid bars on some GPUs).
  const zRotY = interpolate(frame, [0, 34], [11, 0], { extrapolateRight: "clamp" });
  const tumble = panelTumbleUp(frame);
  const titlePop = headlinePop(frame, 2);

  const safeTickerItems = (tickerItems?.filter(Boolean) ?? []).slice(0, 4);
  const safeLowerTag = lowerThirdTag ?? "LIVE COVERAGE";
  const safeLowerHeadline = lowerThirdHeadline ?? "Correspondent Report";
  const safeLowerSub = lowerThirdSub ?? "Reporting live from the broadcast desk";
  const RED = accentColor || DEFAULT_NEWSCAST_ACCENT;
  const STEEL_COLOR = textColor || DEFAULT_NEWSCAST_TEXT;

  const bar = useMemo(() => {
    if (Array.isArray(barChartRows) && barChartRows.length > 0) {
      const labels = barChartRows.map((r) => String(r?.label ?? ""));
      const values = barChartRows.map((r) => toNumber(r?.value));
      return { labels, values };
    }
    if (barChart && Array.isArray(barChart.labels) && barChart.labels.length > 0 && Array.isArray(barChart.values)) {
      return {
        labels: barChart.labels.map((l) => String(l)),
        values: barChart.values.map((v) => toNumber(v)),
      };
    }
    return null;
  }, [barChartRows, barChart]);

  const line = useMemo(() => {
    if (!lineChartLabels?.length || !lineChartDatasets?.length) return null;
    const labels = lineChartLabels;
    const datasets = lineChartDatasets.map((d) => ({
      label: d?.label ?? "",
      values: (d?.valuesStr ?? "")
        .split(",")
        .map((s) => toNumber(s))
        .slice(0, labels.length),
      color: d?.color ?? undefined,
    }));
    return { labels, datasets };
  }, [lineChartLabels, lineChartDatasets]);

  const pie = useMemo(() => {
    if (!pieChartRows?.length) return null;
    const labels = pieChartRows.map((r) => String(r?.label ?? ""));
    const values = pieChartRows.map((r) => toNumber(r?.value));
    return { labels, values };
  }, [pieChartRows]);

  const hasBar = !!bar;
  const hasLine = !!line && !hasBar;
  const hasPie = !!pie && !hasBar && !hasLine;
  const hasAnyChart = hasBar || hasLine || hasPie;

  const lineStrokeOpacity = interpolate(chartT, [0, 0.62, 1], [0, 1, 0.95], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ zIndex: 60, overflow: "hidden", opacity: cardOpacity }}>
      <NewsCastLayoutImageBackground imageUrl={imageUrl} accentColor={RED} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isNarrow ? "6% 4% 12% 6%" : "6% 6% 12% 6%",
          gap: 18,
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: isNarrow ? "85%" : "74%",
            maxWidth: isNarrow ? 980 : 740,
            background: "rgba(10,42,110,0.25)",
            border: "1px solid rgba(200,220,255,0.25)",
            backdropFilter: "blur(8px)",
            borderTop: `2px solid ${RED}`,
            borderRadius: 14,
            padding: 22,
            overflow: "hidden",
            ...panelTumbleStyle(tumble),
            opacity: tumble.opacity,
          }}
        >
          <div
            style={{
              fontFamily: newscastFont(fontFamily, "title"),
              fontSize: resolveNewscastTitleSize(titleFontSize, 22, portraitScale),
              fontWeight: HEADLINE_WEIGHT,
              color: "white",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 12,
              textShadow: headlineTextShadow.light,
              ...headlinePopStyle(titlePop),
            }}
          >
            {title}
          </div>

          <div
            style={{
              position: "relative",
              minHeight: 250,
              overflow: "visible",
              transformStyle: "preserve-3d",
              transform: `perspective(900px) rotateY(${zRotY}deg) rotateX(${-zRotY * 0.45}deg) translateZ(${zEnter * 18}px)`,
            }}
          >
            {/* Grid lines */}
            <svg width="100%" height="250" viewBox="0 0 900 250" style={{ position: "relative", display: "block" }}>
              {Array.from({ length: 6 }).map((_, i) => {
                const y = 40 + i * 30;
                return <line key={i} x1={60} y1={y} x2={880} y2={y} stroke="rgba(212,170,80,0.25)" strokeWidth="1" opacity={0.6} />;
              })}
            </svg>

            {hasBar && bar ? (
              <svg width="100%" height="250" viewBox="0 0 900 250" style={{ position: "absolute", left: 0, top: 0 }}>
                {bar.labels.map((lab, i) => {
                  const n = bar.values[i] ?? 0;
                  const rawMax = Math.max(...bar.values, 0);
                  const maxV = rawMax > 0 ? rawMax : 1;
                  const chartH = 150;
                  const minBarPx = 6;
                  const w = 780 / Math.max(bar.values.length, 1);
                  const x = 80 + i * w + w * 0.12;
                  const barW = w * 0.76;
                  const fullH = n > 0 ? Math.max((n / maxV) * chartH, minBarPx) : 0;
                  const h = fullH * barOvershootT;
                  const y = 190 - h;
                  const fill = i % 2 === 0 ? RED : BLUE;

                  return (
                    <g key={lab || i}>
                      <rect
                        x={x}
                        y={y}
                        width={barW}
                        height={h}
                        rx={10}
                        fill={fill}
                        opacity={barOpacity}
                      />
                      <rect
                        x={x}
                        y={y}
                        width={barW}
                        height={h}
                        rx={10}
                        fill="none"
                        stroke={fill}
                        strokeWidth="2"
                        opacity={0.18 + 0.28 * barOvershootT}
                      />
                      <text
                        x={x + barW / 2}
                        y={225}
                        textAnchor="middle"
                        fontFamily={newscastFont(fontFamily, "label")}
                        fontSize={scaleNewscastPx(12, portraitScale)}
                        fill={STEEL_COLOR}
                        opacity={labelOpacity}
                      >
                        {lab}
                      </text>
                    </g>
                  );
                })}
              </svg>
            ) : null}

            {hasLine && line ? (
              <svg width="100%" height="250" viewBox="0 0 900 250" style={{ position: "absolute", left: 0, top: 0 }}>
                {(() => {
                  const n = line.labels.length;
                  const plotLeft = 80;
                  const plotRight = 880;
                  const plotW = plotRight - plotLeft;
                  const plotTop = 45;
                  const plotBot = 190;
                  const plotH = plotBot - plotTop;
                  const allVals = line.datasets.flatMap((d) => d.values);
                  const vmin = Math.min(0, ...allVals);
                  const vmax = Math.max(...allVals, vmin + 1e-6);
                  const vspan = vmax - vmin || 1;
                  const xAt = (i: number) =>
                    n <= 1 ? plotLeft + plotW / 2 : plotLeft + (i / Math.max(n - 1, 1)) * plotW;
                  const yAt = (v: number) => plotBot - ((v - vmin) / vspan) * plotH;
                  return (
                    <>
                      {line.datasets.map((ds, di) => {
                        const pts = ds.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
                        const stroke = ds.color ?? LINE_COLORS[di % LINE_COLORS.length];
                        return (
                          <polyline
                            key={`${ds.label}-${di}`}
                            fill="none"
                            stroke={stroke}
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={pts}
                            opacity={lineStrokeOpacity}
                          />
                        );
                      })}
                      {line.datasets.flatMap((ds, di) =>
                        ds.values.map((v, i) => (
                          <circle
                            key={`${ds.label}-${di}-${i}`}
                            cx={xAt(i)}
                            cy={yAt(v)}
                            r={4}
                            fill={ds.color ?? LINE_COLORS[di % LINE_COLORS.length]}
                            opacity={lineStrokeOpacity}
                          />
                        )),
                      )}
                      {line.labels.map((lab, i) => (
                        <text
                          key={lab || `lx-${i}`}
                          x={xAt(i)}
                          y={225}
                          textAnchor="middle"
                          fontFamily={newscastFont(fontFamily, "label")}
                          fontSize={scaleNewscastPx(12, portraitScale)}
                          fill={STEEL_COLOR}
                          opacity={labelOpacity}
                        >
                          {lab}
                        </text>
                      ))}
                    </>
                  );
                })()}
              </svg>
            ) : null}

            {hasPie && pie ? (
              <svg width="100%" height="250" viewBox="0 0 900 250" style={{ position: "absolute", left: 0, top: 0 }}>
                {(() => {
                  const cx = 400;
                  const cy = 118;
                  const r = 88;
                  const total = pie.values.reduce((a, b) => a + b, 0);
                  const sum = total > 0 ? total : 1;
                  let angle = 0;
                  return pie.labels.map((lab, i) => {
                    const frac = (pie.values[i] ?? 0) / sum;
                    const sweep = frac * 360;
                    const start = angle;
                    const end = angle + sweep;
                    angle = end;
                    const path = pieSlicePath(cx, cy, r, start, end);
                    const fill = LINE_COLORS[i % LINE_COLORS.length];
                    return (
                      <g key={lab || `pie-${i}`}>
                        <path d={path} fill={fill} opacity={0.75 * lineStrokeOpacity} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                        <text
                          x={cx + (r * 0.55) * Math.cos(((start + end) / 2 - 90) * (Math.PI / 180))}
                          y={cy + (r * 0.55) * Math.sin(((start + end) / 2 - 90) * (Math.PI / 180))}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontFamily={newscastFont(fontFamily, "label")}
                          fontSize={scaleNewscastPx(11, portraitScale)}
                          fill="white"
                          opacity={labelOpacity}
                        >
                          {lab}
                        </text>
                      </g>
                    );
                  });
                })()}
              </svg>
            ) : null}

            {!hasAnyChart ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    fontFamily: newscastFont(fontFamily, "body"),
                    color: STEEL_COLOR,
                    opacity: 0.85,
                    textAlign: "center",
                    fontSize: scaleNewscastPx(15, portraitScale),
                    letterSpacing: 0.5,
                  }}
                >
                  No chart data
                </div>
              </div>
            ) : null}
          </div>

          {narration ? (
            <div
              style={{
                marginTop: 10,
                fontFamily: newscastFont(fontFamily, "body"),
                fontSize: scaleNewscastPx(14, portraitScale),
                lineHeight: 1.6,
                color: STEEL_COLOR,
                opacity: 0.92,
                textAlign: "center",
                whiteSpace: "pre-wrap",
              }}
            >
              {narration}
            </div>
          ) : null}
        </div>

        {/* Right: bulletin rail */}
        <div style={{ flex: "0 0 28%", minWidth: isNarrow ? 190 : 250, display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              background: "rgba(10,42,110,0.25)",
              border: "1px solid rgba(200,220,255,0.20)",
              borderRadius: 12,
              backdropFilter: "blur(8px)",
              padding: "12px 14px 12px",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, transparent 100%)", pointerEvents: "none" }} />
            <div style={{ position: "relative" }}>
              <div style={{ fontFamily: newscastFont(fontFamily, "label"), fontSize: scaleNewscastPx(10, portraitScale), letterSpacing: 4, fontWeight: 600, color: "#B8C8E0", textTransform: "uppercase" }}>
                {safeLowerTag}
              </div>
              <div style={{ marginTop: 6, fontFamily: newscastFont(fontFamily, "title"), fontSize: scaleNewscastPx(22, portraitScale), fontWeight: 700, color: "white", textTransform: "uppercase", letterSpacing: 0.5, lineHeight: 1.05 }}>
                {safeLowerHeadline}
              </div>
              <div style={{ marginTop: 6, fontFamily: newscastFont(fontFamily, "body"), fontSize: resolveNewscastDescriptionSize(descriptionFontSize, 13, portraitScale), color: STEEL_COLOR, lineHeight: 1.5 }}>
                {safeLowerSub}
              </div>
            </div>
          </div>

          <div
            style={{
              background: "rgba(10,42,110,0.25)",
              border: "1px solid rgba(200,220,255,0.20)",
              borderRadius: 12,
              backdropFilter: "blur(8px)",
              padding: "12px 14px",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div style={{ position: "relative" }}>
              <div style={{ fontFamily: newscastFont(fontFamily, "label"), fontSize: scaleNewscastPx(10, portraitScale), letterSpacing: 4, fontWeight: 600, color: "#B8C8E0", textTransform: "uppercase" }}>
                Latest
              </div>
              <div style={{ height: 1, marginTop: 8, background: `linear-gradient(90deg, transparent, ${RED}, ${GOLD})`, opacity: 0.8 }} />
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {(safeTickerItems.length ? safeTickerItems : ["LIVE BREAKING FEED", "LATEST UPDATES", "OFFICIAL CONFIRMATIONS"])
                  .slice(0, 3)
                  .map((t, i) => (
                    <div key={`${t}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: newscastFont(fontFamily, "body"), color: STEEL_COLOR, fontSize: resolveNewscastDescriptionSize(descriptionFontSize, 13, portraitScale), lineHeight: 1.3 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 999, background: i === 0 ? RED : "#1E5FD4", boxShadow: i === 0 ? "0 0 14px rgba(232,32,32,0.35)" : "0 0 14px rgba(30,95,212,0.35)" }} />
                      <div style={{ flex: 1 }}>{t}</div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

