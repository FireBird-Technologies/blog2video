import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { BlackswanLayoutProps } from "../types";
import { NeonWater } from "./neonWater";
import { neonTitleTubeStyle, StarField } from "./scenePrimitives";
import { blackswanNeonPalette } from "./blackswanAccent";

const mono = "'Righteous', cursive";
const display = "'Righteous', cursive";

function deriveMetrics(narration: string) {
  const matches = narration.match(/(\d+(?:\.\d+)?)(%|x|k|m|K|M|\+)?/g) ?? [];
  if (matches.length === 0) return [];
  return matches.slice(0, 8).map((m, i) => {
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
    bgColor = "#000000",
    textColor = "#DFFFFF",
    metrics,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
    aspectRatio = "landscape",
  } = props;

  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const neonPal = useMemo(() => blackswanNeonPalette(accentColor), [accentColor]);

  const metricItems = (metrics && metrics.length > 0 ? metrics : deriveMetrics(narration)).slice(0, 8);

  const titleOp   = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleY    = interpolate(frame, [0, 20], [12, 0], { extrapolateRight: "clamp" });
  const narOp     = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" });
  const narY      = interpolate(frame, [30, 50], [10, 0], { extrapolateRight: "clamp" });

  const metricNumSize = titleFontSize ?? (p ? 80 : 72);
  const suffixSize    = metricNumSize * 0.32;
  const labelSize     = descriptionFontSize ?? (p ? 28 : 33);
  const narSize       = descriptionFontSize ?? (p ? 28 : 33);

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      <StarField accentColor={accentColor} />

      {/* NeonWater — bottom center, no shade */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: p ? 0.7 : 1, // Slightly decrease opacity in portrait mode
        }}
      >
        <NeonWater
          uid="m4"
          cx={500}
          yPct={p ? 70 : 65}
          rxBase={200}
          ryBase={32}
          maxRx={380}
          nRings={5}
          delay={0.2}
          hideBg
          fadeEdges
          accentColor={accentColor}
        />
      </div>

      {/* Title — top of frame */}
      <div
        style={{
          position: "absolute",
          top: p ? "25%" : "15%", // Bring title more towards center in portrait and landscape
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: p ? 12 : 16,
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
          zIndex: 2,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: fontFamily ?? display,
            fontSize: titleFontSize ?? (p ? 80 : 72),
            fontWeight: 400,
            ...neonTitleTubeStyle(accentColor, { bgColor }),
            lineHeight: 1.1,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            textAlign: "center",
            paddingLeft: "6%",
            paddingRight: "6%",
          }}
        >
          {title}
        </h1>

        {/* Neon accent line under title */}
        <div
          style={{
            height: 2,
            width: p ? 220 : 280,
            background: accentColor,
            boxShadow: `0 0 8px ${accentColor}, 0 0 18px ${accentColor}88`,
          }}
        />
      </div>

      {/* Metrics row — centered in the middle of the frame */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row", // Always row
            alignItems: "center",
            position: "relative",
            zIndex: 1,
            gap: p ? "40px 20px" : 60, // Row-gap 40px, Column-gap 20px for portrait; 60px all-around for landscape
            flexWrap: "wrap", // Always wrap to allow 2 per row in portrait
            justifyContent: "center",
            maxWidth: "90%", // Allow sufficient width for content
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
                    padding: "0 10px", // Consistent horizontal padding
                    opacity: cellOp,
                    transform: `translateY(${cellY}px)`,
                    // Force 2 metrics per row in portrait mode
                    flex: p ? "0 0 calc(50% - 10px)" : undefined, // 50% width minus half of the column-gap
                    maxWidth: p ? "calc(50% - 10px)" : undefined,
                  }}
                >
                  {/* Big number */}
                  <div
                    style={{
                      fontFamily: fontFamily ?? display,
                      fontSize: metricNumSize,
                      fontWeight: 400,
                      color: accentColor,
                      lineHeight: 1,
                      textShadow: `0 0 2px ${accentColor}, 0 0 18px ${accentColor}66`,
                    }}
                  >
                    {m.value}
                    {m.suffix && (
                      <span
                        style={{
                          fontSize: suffixSize,
                          color: neonPal.mid,
                          marginLeft: 4,
                        }}
                      >
                        {m.suffix}
                      </span>
                    )}
                  </div>
                  {/* Label */}
                  <div
                    style={{
                      fontSize: labelSize,
                      letterSpacing: 4,
                      color: neonPal.mid,
                      textTransform: "uppercase",
                      marginTop: p ? 10 : 12,
                      fontFamily: fontFamily ?? mono,
                      fontWeight: 400,
                    }}
                  >
                    {m.label}
                  </div>
                </div>

                {/* Removed vertical divider, using gap for spacing */}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Narration — below the neon water area */}
      {narration && (
        <div
          style={{
            position: "absolute",
            bottom: p ? "25%" : "15%", // Bring narration more towards center in portrait and landscape
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            paddingLeft: "8%",
            paddingRight: "8%",
            opacity: narOp,
            transform: `translateY(${narY}px)`,
            zIndex: 2,
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: fontFamily ?? display,
              fontSize: narSize,
              fontWeight: 400,
              color: textColor,
              lineHeight: 1.7,
              letterSpacing: "0.04em",
              textAlign: "center",
              maxWidth: p ? "90%" : "70%",
            }}
          >
            {narration}
          </p>
        </div>
      )}
    </AbsoluteFill>
  );
};
