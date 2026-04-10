import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { BlackswanLayoutProps } from "../types";
import { NeonWater } from "./neonWater";

const mono = "'IBM Plex Mono', monospace";
const display = "'Syne', sans-serif";

const NeonLine: React.FC<{ width?: string | number }> = ({ width = "160px" }) => (
  <div
    style={{
      height: 1,
      width,
      background: "#00E5FF",
      boxShadow: "0 0 2px #00E5FF, 0 0 5px #00AAFF",
    }}
  />
);

export const NeonNarrative: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor = "#00E5FF",
    textColor = "#DFFFFF",
    titleFontSize,
    descriptionFontSize,
    fontFamily,
    aspectRatio = "landscape",
  } = props;

  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const eyebrowOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleOp   = interpolate(frame, [10, 35], [0, 1], { extrapolateRight: "clamp" });
  const titleY    = interpolate(frame, [10, 35], [14, 0], { extrapolateRight: "clamp" });
  const bodyOp    = interpolate(frame, [25, 50], [0, 1], { extrapolateRight: "clamp" });
  const bodyY     = interpolate(frame, [25, 50], [14, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      {/* Left-biased water — matches HTML cx:260 */}
      <NeonWater
        uid="n2"
        cx={p ? 500 : 260}
        yPct={p ? 88 : 84}
        scale={p ? 0.85 : 1}
        rxBase={180}
        ryBase={22}
        maxRx={360}
        nRings={4}
        delay={0.3}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "10% 8%" : "0",
        }}
      >
        {/* Content column — 680px wide matching HTML exactly */}
        <div
          style={{
            width: p ? "100%" : 680,
            display: "flex",
            flexDirection: "column",
            gap: p ? 18 : 22,
            position: "relative",
            zIndex: 1,
            paddingTop: p ? 0 : 20,
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              fontSize: p ? 8 : 9,
              letterSpacing: 5,
              color: "#00AAFF",
              textTransform: "uppercase",
              fontFamily: fontFamily ?? mono,
              opacity: eyebrowOp,
            }}
          >
            Insight
          </div>

          {/* Title */}
          <h1
            style={{
              margin: 0,
              fontFamily: fontFamily ?? display,
              fontSize: titleFontSize ?? (p ? 72 : 99),
              fontWeight: 800,
              color: accentColor,
              lineHeight: 1.1,
              textShadow: `0 0 2px ${accentColor}, 0 0 8px #00AAFF18`,
              opacity: titleOp,
              transform: `translateY(${titleY}px)`,
            }}
          >
            {title}
          </h1>

          {/* Neon line */}
          <NeonLine width={p ? "120px" : "160px"} />

          {/* Narration body */}
          {narration && (
            <p
              style={{
                margin: 0,
                fontFamily: fontFamily ?? mono,
                fontSize: descriptionFontSize ?? (p ? 42 : 37),
                lineHeight: 1.8,
                color: "#00AAFF",
                maxWidth: p ? "100%" : 520,
                opacity: bodyOp,
                transform: `translateY(${bodyY}px)`,
              }}
            >
              {narration}
            </p>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};