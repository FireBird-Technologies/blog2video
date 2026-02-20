import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img } from "remotion";
import { GridcraftLayoutProps } from "../types";
import { glass, FONT_FAMILY, COLORS } from "../utils/styles";

export const BentoSteps: React.FC<GridcraftLayoutProps> = ({
  steps,
  dataPoints,
  imageUrl,
  accentColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
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
        fontFamily: FONT_FAMILY.SANS,
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
            ...glass(false),
          }}
        >
          <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 16,
          flex: hasImage && !p ? 1 : "none",
          width: hasImage && !p ? "auto" : "100%",
        }}
      >
      {items.map((item, i) => {
          const delay = i * 5;
          const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 14 } });

          const scale = interpolate(s, [0, 1], [0.8, 1]);
          const opacity = interpolate(s, [0, 1], [0, 1]);

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
                  ...positions[i % 4],
                  ...glass(isLast),
                  backgroundColor: isLast ? (accentColor || COLORS.ACCENT) : undefined,
                  padding: 24,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  transform: `scale(${scale})`,
                  opacity,
                }}
              >
                  <div style={{ fontSize: 42, fontWeight: 700, color: isLast ? "rgba(255,255,255,0.4)" : COLORS.ACCENT, opacity: 0.5, marginBottom: 8, lineHeight: 1 }}>
                      {String(i + 1).padStart(2, "0")}
                  </div>
                  <div style={{ fontSize: titleFontSize ?? 18, fontWeight: 700, marginBottom: 4, color: isLast ? COLORS.WHITE : COLORS.DARK }}>
                      {item.label}
                  </div>
                  <div style={{ fontSize: descriptionFontSize ?? 13, lineHeight: 1.4, color: isLast ? "rgba(255,255,255,0.8)" : COLORS.MUTED }}>
                      {item.description}
                  </div>
              </div>
          )
      })}
      </div>
    </div>
  );
};
