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

export const WingStack: React.FC<BlackswanLayoutProps> = (props) => {
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

  const stackItems = (items && items.length > 0 ? items : deriveItems(narration, 4)).slice(0, 6);

  const eyebrowOp = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      {/* Far-left water — matches HTML cx:160 */}
      <NeonWater
        uid="w7"
        cx={p ? 500 : 160}
        yPct={p ? 89 : 84}
        rxBase={140}
        ryBase={18}
        maxRx={260}
        nRings={3}
        delay={0.18}
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
            width: p ? "100%" : 560,
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
              fontFamily: fontFamily ?? mono,
              opacity: eyebrowOp,
            }}
          >
            {title || "Features"}
          </div>

          {/* Stacked items — matches HTML border-top:1px solid #00E5FF12 */}
          <div
            style={{
              borderTop: "1px solid #00E5FF18",
              marginTop: p ? 14 : 20,
            }}
          >
            {stackItems.map((item, i) => {
              const itemOp = interpolate(frame, [8 + i * 8, 28 + i * 8], [0, 1], { extrapolateRight: "clamp" });
              const itemY  = interpolate(frame, [8 + i * 8, 28 + i * 8], [14, 0], { extrapolateRight: "clamp" });

              // Split "Label: description" if available, else use raw item
              const colonIdx = item.indexOf(":");
              const label = colonIdx > 0 ? item.slice(0, colonIdx).trim() : item;
              const desc  = colonIdx > 0 ? item.slice(colonIdx + 1).trim() : "";

              return (
                <div
                  key={`${item}-${i}`}
                  style={{
                    padding: p ? "16px 0" : "24px 0",
                    borderTop: i > 0 ? "1px solid #00E5FF12" : "none",
                    opacity: itemOp,
                    transform: `translateY(${itemY}px)`,
                  }}
                >
                  {/* Label — Syne bold uppercase */}
                  <div
                    style={{
                      fontFamily: fontFamily ?? display,
                      fontSize: titleFontSize ? titleFontSize * 0.22 : (p ? 13 : 16),
                      fontWeight: 700,
                      color: accentColor,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      textShadow: `0 0 2px ${accentColor}`,
                    }}
                  >
                    {label}
                  </div>
                  {/* Description */}
                  {desc && (
                    <div
                      style={{
                        fontFamily: fontFamily ?? mono,
                        fontSize: descriptionFontSize ?? (p ? 11 : 13),
                        color: "#00AAFF",
                        marginTop: p ? 4 : 6,
                      }}
                    >
                      {desc}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};