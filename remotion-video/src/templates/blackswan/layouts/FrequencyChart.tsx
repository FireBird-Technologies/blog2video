import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { BlackswanLayoutProps } from "../types";
import { NeonWater } from "./neonWater";

const mono = "'IBM Plex Mono', monospace";
const display = "'Syne', sans-serif";

function deriveRows(narration: string): Array<{ label: string; value: string }> {
  const matches = narration.match(/(\d+(?:\.\d+)?)/g) ?? [];
  if (matches.length >= 2) {
    return matches.slice(0, 7).map((m, i) => ({ label: `Item ${i + 1}`, value: m }));
  }
  return [
    { label: "Q1", value: "42" },
    { label: "Q2", value: "67" },
    { label: "Q3", value: "58" },
    { label: "Q4", value: "89" },
  ];
}

export const FrequencyChart: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor = "#00E5FF",
    textColor = "#DFFFFF",
    barChartRows,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
    aspectRatio = "landscape",
  } = props;

  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const chartRows = (barChartRows && barChartRows.length > 0 ? barChartRows : deriveRows(narration)).slice(0, 7);

  const maxVal = Math.max(...chartRows.map((r) => Number(r.value) || 0), 1);

  // SVG chart dimensions — matches HTML exactly
  const W  = p ? 480 : 680;
  const H  = p ? 320 : 260;
  const pL = 32; // padding left (axis)
  const pB = 36; // padding bottom
  const pT = 12; // padding top
  const pR = 8;  // padding right
  const iW = W - pL - pR;
  const iH = H - pB - pT;
  const barCount = chartRows.length;
  const bG = iW / barCount;     // bar group width
  const bW = bG * 0.42;         // bar width

  const headerOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      {/* Wide low water rings — matches HTML cx:500 */}
      <NeonWater
        uid="fc10"
        cx={500}
        yPct={p ? 83 : 80}
        rxBase={220}
        ryBase={28}
        maxRx={400}
        nRings={5}
        delay={0.15}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "8% 5%" : "0",
        }}
      >
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Header row — matches HTML: display:flex;align-items:baseline;gap:10px */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              marginBottom: p ? 14 : 18,
              opacity: headerOp,
            }}
          >
            <div
              style={{
                fontFamily: fontFamily ?? display,
                fontSize: titleFontSize ?? (p ? 15 : 18),
                fontWeight: 700,
                color: accentColor,
              }}
            >
              {title || "Performance"}
            </div>
            <div
              style={{
                fontSize: descriptionFontSize ? descriptionFontSize * 0.6 : (p ? 7 : 9),
                letterSpacing: 3,
                color: "#00AAFF",
                fontFamily: fontFamily ?? mono,
              }}
            >
              {chartRows.map((r) => r.label).join("–")}
            </div>
          </div>

          {/* SVG bar chart — matches HTML exactly */}
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
          >
            <defs>
              {chartRows.map((_, i) => (
                <linearGradient key={i} id={`bg${i}-fc`} x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#0040FF" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#00E5FF" stopOpacity={0.68} />
                </linearGradient>
              ))}
            </defs>

            {/* Axis lines — matches HTML exactly */}
            <line
              x1={pL} y1={pT} x2={pL} y2={H - pB}
              stroke="#00AAFF" strokeWidth={0.4} opacity={0.12}
            />
            <line
              x1={pL} y1={H - pB} x2={W - pR} y2={H - pB}
              stroke="#00AAFF" strokeWidth={0.4} opacity={0.12}
            />

            {/* Bars */}
            {chartRows.map((row, i) => {
              const val = Number(row.value) || 0;
              const bh  = (val / maxVal) * iH;
              const bx  = pL + i * bG + bG * 0.29;
              const by  = H - pB - bh;

              // Bar grow from bottom animation
              const barProgress = interpolate(
                frame,
                [18 + i * 6, 40 + i * 6],
                [0, 1],
                { extrapolateRight: "clamp" }
              );
              const animBh = bh * barProgress;
              const animBy = H - pB - animBh;

              // Value label fade
              const valOp = interpolate(
                frame,
                [30 + i * 6, 48 + i * 6],
                [0, 1],
                { extrapolateRight: "clamp" }
              );

              return (
                <g key={`${row.label}-${i}`}>
                  {/* Ghost bar (dim, full height for reference) */}
                  <rect
                    x={bx}
                    y={by}
                    width={bW}
                    height={bh}
                    fill={`url(#bg${i}-fc)`}
                    opacity={0.07}
                  />
                  {/* Animated bar */}
                  <rect
                    x={bx}
                    y={animBy}
                    width={bW}
                    height={animBh}
                    fill={`url(#bg${i}-fc)`}
                  />
                  {/* X-axis label */}
                  <text
                    x={bx + bW / 2}
                    y={H - pB + 14}
                    fill="#00AAFF"
                    fontSize={p ? 7 : 8}
                    textAnchor="middle"
                    fontFamily={fontFamily ?? mono}
                    opacity={0.35}
                  >
                    {row.label}
                  </text>
                  {/* Value label above bar */}
                  <text
                    x={bx + bW / 2}
                    y={by - 6}
                    fill="#00E5FF"
                    fontSize={p ? 7 : 8}
                    textAnchor="middle"
                    fontFamily={fontFamily ?? mono}
                    opacity={valOp}
                  >
                    {row.value}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
};