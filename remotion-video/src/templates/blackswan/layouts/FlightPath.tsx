import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useBlackswanBirdMotion } from "../blackswanAnimationStyles";
import type { BlackswanLayoutProps } from "../types";
import { NeonWater } from "./neonWater";

const mono = "'IBM Plex Mono', monospace";
const display = "'Syne', sans-serif";

function derivePhrases(narration: string, count = 4): string[] {
  const fromComma = narration.split(/[,;|]/).map((s) => s.trim()).filter((s) => s.length > 1);
  if (fromComma.length >= 2) return fromComma.slice(0, count);
  return narration.split(/[.!?]/).map((s) => s.trim()).filter(Boolean).slice(0, count);
}

export const FlightPath: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor = "#00E5FF",
    textColor = "#DFFFFF",
    phrases,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
    aspectRatio = "landscape",
  } = props;

  useBlackswanBirdMotion();
  const frame = useCurrentFrame();
  const { width: compWidth, height: compHeight, fps } = useVideoConfig();
  const t = frame / fps;
  const p = aspectRatio === "portrait";

  const pathPhrases = (phrases && phrases.length > 0 ? phrases : derivePhrases(narration, 4)).slice(0, 8);

  // SVG layout dimensions — matches HTML: W=860, Y=500, sx=80, ex=780
  const SVG_W = p ? 560 : 860;
  const SVG_H = p ? 900 : 1000;
  const nodeY  = p ? 450 : 500;
  const startX = p ? 60 : 80;
  const endX   = p ? 500 : 780;
  const nodeCount = pathPhrases.length;
  const spacing = nodeCount > 1 ? (endX - startX) / (nodeCount - 1) : 0;

  // Line draw animation — matches HTML: stroke-dasharray:780 animation:draw .9s
  const lineProgress = interpolate(frame, [10, 40], [0, 1], { extrapolateRight: "clamp" });
  const totalLen = endX - startX;
  const dashOffset = totalLen * (1 - lineProgress);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      {/* Centred water on path midpoint — matches HTML cx:470 */}
      <NeonWater
        uid="fp9"
        cx={p ? 500 : 470}
        yPct={p ? 88 : 84}
        rxBase={150}
        ryBase={20}
        maxRx={300}
        nRings={4}
        delay={0.15}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width={p ? "90%" : SVG_W}
          height={p ? "90%" : SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ overflow: "visible", position: "relative", zIndex: 1 }}
        >
          <defs>
            <filter id="fn-fp" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="bsw-fb-fp" x="-55%" y="-200%" width="210%" height="500%">
              <feGaussianBlur stdDeviation="1.8" result="b" />
              <feColorMatrix
                in="b"
                type="matrix"
                values="0 0 0 0 0  0 0.3 0.84 0 0  0 0.62 0.98 0 0  0 0 0 0.6 0"
                result="c"
              />
              <feMerge>
                <feMergeNode in="c" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Connecting line — matches HTML stroke-dasharray:780 animation:draw */}
          <line
            x1={startX}
            y1={nodeY}
            x2={endX}
            y2={nodeY}
            stroke="#00E5FF"
            strokeWidth={0.6}
            opacity={0.22}
            strokeDasharray={totalLen}
            strokeDashoffset={dashOffset}
          />

          {/* Nodes */}
          {pathPhrases.map((step, i) => {
            const nx = nodeCount === 1 ? (startX + endX) / 2 : startX + i * spacing;
            const nodeOp = interpolate(frame, [15 + i * 8, 35 + i * 8], [0, 1], { extrapolateRight: "clamp" });

            // Split step label from description if colon present
            const colonIdx = step.indexOf(":");
            const label = colonIdx > 0 ? step.slice(0, colonIdx).trim() : step;
            const desc  = colonIdx > 0 ? step.slice(colonIdx + 1).trim() : "";

            return (
              <g key={`${step}-${i}`} opacity={nodeOp}>
                {/* Outer glow ring */}
                <circle
                  cx={nx}
                  cy={nodeY}
                  r={22}
                  fill="none"
                  stroke="#00E5FF"
                  strokeWidth={0.7}
                  opacity={0.18}
                  filter="url(#fn-fp)"
                />
                {/* Inner circle */}
                <circle
                  cx={nx}
                  cy={nodeY}
                  r={12}
                  fill="#000"
                  stroke="#00E5FF"
                  strokeWidth={1}
                  opacity={0.7}
                />
                {/* Step number */}
                <text
                  x={nx}
                  y={nodeY + 4}
                  textAnchor="middle"
                  fill="#00E5FF"
                  fontSize={p ? 7 : 9}
                  fontFamily={fontFamily ?? mono}
                  opacity={0.8}
                >
                  {i + 1}
                </text>
                {/* Step label below */}
                <text
                  x={nx}
                  y={nodeY + (p ? 34 : 46)}
                  textAnchor="middle"
                  fill="#00E5FF"
                  fontSize={titleFontSize ? titleFontSize * 0.15 : (p ? 9 : 11)}
                  fontFamily={fontFamily ?? display}
                  fontWeight={700}
                >
                  {label}
                </text>
                {/* Description or sub-label */}
                <text
                  x={nx}
                  y={nodeY + (p ? 48 : 62)}
                  textAnchor="middle"
                  fill="#00AAFF"
                  fontSize={descriptionFontSize ? descriptionFontSize * 0.55 : (p ? 8 : 10)}
                  fontFamily={fontFamily ?? mono}
                  opacity={0.5}
                >
                  {desc}
                </text>
              </g>
            );
          })}

          {/* Neon bird on path — HTML: b1 4.5s 1.2s from path start */}
          <g
            filter="url(#bsw-fb-fp)"
            style={{
              transform: `translate(${startX}px, ${nodeY - 18}px) scale(0.7)`,
              opacity: 0,
              animation: `bsw-b1 4.5s cubic-bezier(0.3, 0.55, 0.5, 0.9) forwards`,
              animationDelay: `${1.2 - t}s`,
            }}
          >
            <g style={{ animation: `bsw-chirp 0.42s 0.05s ease-in-out infinite` }}>
              <path
                d="M0 0 C-4 -2 -9 -4 -14 -1 C-9 2 -4 1 0 0"
                fill="#00E5FF"
                opacity={0.9}
                style={{ animation: `bsw-wflap-l 0.42s ease-in-out infinite` }}
              />
              <path
                d="M0 0 C4 -2 9 -4 14 -1 C9 2 4 1 0 0"
                fill="#00E5FF"
                opacity={0.9}
                style={{ animation: `bsw-wflap-r 0.42s ease-in-out infinite` }}
              />
              <ellipse cx={0} cy={0} rx={2.5} ry={1.5} fill="#00E5FF" opacity={0.95} />
            </g>
          </g>
        </svg>
      </div>

      {/* Title eyebrow top-left */}
      {title && (
        <div
          style={{
            position: "absolute",
            top: p ? "6%" : "8%",
            left: p ? "6%" : "8%",
            fontSize: p ? 8 : 9,
            letterSpacing: 5,
            color: "#00AAFF",
            textTransform: "uppercase",
            fontFamily: fontFamily ?? mono,
            opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          {title}
        </div>
      )}
    </AbsoluteFill>
  );
};