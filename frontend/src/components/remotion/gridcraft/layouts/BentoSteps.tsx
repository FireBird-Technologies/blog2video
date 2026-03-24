import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img } from "remotion";
import { GridcraftLayoutProps } from "../types";
import { GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY } from "../constants";
import { glass, COLORS } from "../utils/styles";

export const BentoSteps: React.FC<GridcraftLayoutProps> = ({
  steps,
  dataPoints,
  imageUrl,
  accentColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = steps || dataPoints || [
      { label: "Step 1", description: "Initialize" },
      { label: "Step 2", description: "Execute" },
      { label: "Step 3", description: "Verify" },
      { label: "Step 4", description: "Deploy" }
  ];

  const hasImage = !!imageUrl;
  const p = aspectRatio === "portrait";
  const resolvedFontFamily = fontFamily ?? GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY;

  const imageOpacity = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });
  const imageScale = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 14 } });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: hasImage && !p ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        width: "90%",
        height: "80%",
        margin: "auto",
        gap: hasImage ? (p ? 24 : 32) : 0,
        fontFamily: resolvedFontFamily,
      }}
    >
      {hasImage && (
        <div
          style={{
            flex: p ? "none" : "0 0 38%",
            width: p ? "80%" : "auto",
            height: p ? 220 : 320,
            borderRadius: 12,
            overflow: "hidden",
            opacity: imageOpacity,
            transform: `scale(${imageScale})`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: p ? "1fr" : "1fr 1fr 1fr 1fr",
          gridTemplateRows: p ? `repeat(${items.length}, auto)` : "1fr 1fr",
          gap: 16,
          flex: hasImage && !p ? 1 : "none",
          width: hasImage && !p ? "auto" : "100%",
          minWidth: 0,
        }}
      >
      {items.map((item, i) => {
          const delay = i * 5;
          const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 14 } });
          
          const scale = interpolate(s, [0, 1], [0.8, 1]);
          const opacity = interpolate(s, [0, 1], [0, 1]);
          
          // Zig-zag layout (landscape); single column (portrait)
          const positions = [
             { gridColumn: "1", gridRow: "1" },
             { gridColumn: "2", gridRow: "2" },
             { gridColumn: "3", gridRow: "1" },
             { gridColumn: "4", gridRow: "2" },
          ];

          const isLast = i === items.length - 1;

          return (
              <div
                key={i}
                style={{
                  ...(p
                    ? { gridColumn: "1", gridRow: i + 1 }
                    : positions[i % 4]),
                  ...glass(isLast),
                  backgroundColor: isLast ? (accentColor || COLORS.ACCENT) : undefined,
                  padding: p ? 20 : 24,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  minWidth: 0,
                  overflow: "hidden",
                  transform: `scale(${scale})`,
                  opacity,
                }}
              >
                  <div style={{ fontSize: p ? 32 : 42, fontWeight: 700, color: isLast ? "rgba(255,255,255,0.4)" : COLORS.ACCENT, opacity: 0.5, marginBottom: 8, lineHeight: 1 }}>
                      {String(i + 1).padStart(2, "0")}
                  </div>
                  <div style={{ fontSize: titleFontSize ?? (p ? 36 : 42), fontWeight: 700, marginBottom: 4, color: isLast ? COLORS.WHITE : COLORS.DARK, wordBreak: "break-word" }}>
                      {item.label}
                  </div>
                  <div style={{ fontSize: descriptionFontSize ?? (p ? 22 : 22), lineHeight: 1.4, color: isLast ? "rgba(255,255,255,0.8)" : COLORS.MUTED, wordBreak: "break-word" }}>
                      {item.description}
                  </div>
              </div>
          )
      })}
      </div>
    </div>
  );
};
