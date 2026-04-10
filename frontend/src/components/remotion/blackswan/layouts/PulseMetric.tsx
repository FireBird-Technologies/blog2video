import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { BlackswanLayoutProps } from "../types";
import { NeonWater } from "./neonWater";

const mono = "'IBM Plex Mono', monospace";
const display = "'Syne', sans-serif";

function deriveMetrics(narration: string) {
  const matches = narration.match(/(\d+(?:\.\d+)?)(%|x|k|m|K|M|\+)?/g) ?? [];
  if (matches.length === 0) return [];
  return matches.slice(0, 3).map((m, i) => {
    const value = m.replace(/[%xkKmM+]/g, "");
    const suffix = m.slice(value.length) || undefined;
    return { value, suffix, label: `Metric ${i + 1}` };
  });
}

export const PulseMetric: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor = "#00E5FF",
    textColor = "#DFFFFF",
    metrics,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
    aspectRatio = "landscape",
  } = props;

  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const metricItems = (metrics && metrics.length > 0 ? metrics : deriveMetrics(narration)).slice(0, 3);

  const eyebrowOp = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      {/* Centred water rings — tight slow-breathing rings matches HTML */}
      <NeonWater
        uid="m4"
        cx={500}
        yPct={p ? 82 : 80}
        rxBase={200}
        ryBase={32}
        maxRx={380}
        nRings={5}
        delay={0.2}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "8% 6%" : "0",
        }}
      >
        {/* Eyebrow "Results" */}
        <div
          style={{
            fontSize: p ? 8 : 9,
            letterSpacing: 5,
            color: "#00AAFF",
            textTransform: "uppercase",
            marginBottom: p ? 36 : 52,
            fontFamily: fontFamily ?? mono,
            opacity: eyebrowOp,
          }}
        >
          {title || "Results"}
        </div>

        {/* Metrics row — exactly as HTML: flex row with dividers */}
        <div
          style={{
            display: "flex",
            flexDirection: p ? "column" : "row",
            alignItems: "center",
            position: "relative",
            zIndex: 1,
            gap: p ? 32 : 0,
          }}
        >
          {metricItems.map((m, i) => {
            const cellOp = interpolate(frame, [5 + i * 8, 25 + i * 8], [0, 1], { extrapolateRight: "clamp" });
            const cellY  = interpolate(frame, [5 + i * 8, 25 + i * 8], [14, 0], { extrapolateRight: "clamp" });
            return (
              <React.Fragment key={`${m.label}-${i}`}>
                {/* Metric cell */}
                <div
                  style={{
                    textAlign: "center",
                    padding: p ? "0 28px" : "0 52px",
                    opacity: cellOp,
                    transform: `translateY(${cellY}px)`,
                  }}
                >
                  {/* Big number */}
                  <div
                    style={{
                      fontFamily: fontFamily ?? display,
                      fontSize: titleFontSize ?? (p ? 64 : 82),
                      fontWeight: 800,
                      color: accentColor,
                      lineHeight: 1,
                      textShadow: `0 0 2px ${accentColor}, 0 0 12px #00AAFF1e`,
                    }}
                  >
                    {m.value}
                    {m.suffix && (
                      <span
                        style={{
                          fontSize: titleFontSize ? titleFontSize * 0.3 : (p ? 20 : 24),
                          color: "#00AAFF",
                          marginLeft: 3,
                        }}
                      >
                        {m.suffix}
                      </span>
                    )}
                  </div>
                  {/* Label */}
                  <div
                    style={{
                      fontSize: descriptionFontSize ?? (p ? 8 : 9),
                      letterSpacing: 4,
                      color: "#00AAFF",
                      textTransform: "uppercase",
                      marginTop: p ? 8 : 10,
                      fontFamily: fontFamily ?? mono,
                    }}
                  >
                    {m.label}
                  </div>
                </div>

                {/* Vertical divider between cells — matches HTML */}
                {!p && i < metricItems.length - 1 && (
                  <div
                    style={{
                      width: 1,
                      height: 90,
                      background: "#00E5FF12",
                      alignSelf: "center",
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};