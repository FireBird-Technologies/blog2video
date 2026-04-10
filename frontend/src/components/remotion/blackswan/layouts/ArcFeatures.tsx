import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { BlackswanLayoutProps } from "../types";
import { NeonWater } from "./neonWater";

const mono = "'IBM Plex Mono', monospace";
const display = "'Syne', sans-serif";

function deriveItems(narration: string, count = 4): string[] {
  const parts = narration.split(/[.;•\n]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return [];
  return parts.slice(0, count);
}

export const ArcFeatures: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor = "#00E5FF",
    textColor = "#DFFFFF",
    items,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
    aspectRatio = "landscape",
  } = props;

  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  // Default icons cycling
  const ICONS = ["◈", "↯", "⬡", "⟁", "◇", "⟐"];

  const featureItems = (items && items.length > 0 ? items : deriveItems(narration, 4)).slice(0, 6);

  const eyebrowOp = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      {/* Right-biased water — matches HTML cx:740 */}
      <NeonWater
        uid="a3"
        cx={p ? 500 : 740}
        yPct={p ? 89 : 84}
        rxBase={160}
        ryBase={20}
        maxRx={320}
        nRings={4}
        delay={0.2}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "8% 6%" : "0",
        }}
      >
        <div
          style={{
            width: p ? "100%" : 720,
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              fontSize: p ? 8 : 9,
              letterSpacing: 5,
              color: "#00AAFF",
              textTransform: "uppercase",
              marginBottom: p ? 16 : 24,
              fontFamily: fontFamily ?? mono,
              opacity: eyebrowOp,
            }}
          >
            {title || "Capabilities"}
          </div>

          {/* 2-column card grid — exactly matches HTML grid-template-columns:1fr 1fr */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: p ? "1fr" : "1fr 1fr",
              gap: 0,
            }}
          >
            {featureItems.map((item, i) => {
              const cardOp = interpolate(frame, [8 + i * 6, 28 + i * 6], [0, 1], { extrapolateRight: "clamp" });
              const cardY  = interpolate(frame, [8 + i * 6, 28 + i * 6], [14, 0], { extrapolateRight: "clamp" });
              return (
                <div
                  key={`${item}-${i}`}
                  style={{
                    padding: p ? "20px 18px" : "28px 26px",
                    borderLeft: "1px solid #00E5FF18",
                    display: "flex",
                    flexDirection: "column",
                    gap: p ? 7 : 10,
                    opacity: cardOp,
                    transform: `translateY(${cardY}px)`,
                  }}
                >
                  {/* Icon + label row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                      style={{
                        fontSize: p ? 15 : 18,
                        color: accentColor,
                        fontFamily: fontFamily ?? mono,
                      }}
                    >
                      {ICONS[i % ICONS.length]}
                    </span>
                    <span
                      style={{
                        fontFamily: fontFamily ?? display,
                        fontSize: titleFontSize ? titleFontSize * 0.16 : (p ? 10 : 11),
                        fontWeight: 700,
                        color: accentColor,
                        letterSpacing: 2,
                        textTransform: "uppercase",
                      }}
                    >
                      {item.length > 20 ? item.slice(0, 20) : item}
                    </span>
                  </div>
                  {/* Description */}
                  <div
                    style={{
                      fontSize: descriptionFontSize ?? (p ? 11 : 12),
                      color: "#00AAFF",
                      lineHeight: 1.6,
                      paddingLeft: 30,
                      opacity: 0.8,
                      fontFamily: fontFamily ?? mono,
                    }}
                  >
                    {item.length > 20 ? item : narration?.split(/[.!?]/)[i] ?? ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};