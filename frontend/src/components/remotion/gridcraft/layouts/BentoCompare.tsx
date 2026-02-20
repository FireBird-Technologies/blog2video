import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img } from "remotion";
import { GridcraftLayoutProps } from "../types";
import { glass, FONT_FAMILY, COLORS } from "../utils/styles";

export const BentoCompare: React.FC<GridcraftLayoutProps> = ({
  dataPoints,
  leftLabel,
  rightLabel,
  leftDescription,
  rightDescription,
  verdict,
  title,
  imageUrl,
  accentColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const spr = (d: number) => spring({ frame: Math.max(0, frame - d), fps, config: { damping: 16 } });

  // Construct points from specific props or fallback to dataPoints
  const points = (leftLabel && rightLabel) ? [
      { label: leftLabel, title: leftLabel, description: leftDescription },
      { label: rightLabel, title: rightLabel, description: rightDescription }
  ] : (dataPoints || [
      { label: "Old Way", title: "Slow & Static", description: "Hard coded pages." },
      { label: "New Way", title: "Dynamic & Fast", description: "Generated on the fly." }
  ]);

  const finalVerdict = verdict || title;
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
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr auto",
          gap: 20,
          flex: hasImage && !p ? 1 : "none",
          width: hasImage && !p ? "auto" : "100%",
        }}
      >
      {/* Left Item */}
      <div style={{
          ...glass(false),
          padding: 32,
          display: "flex", flexDirection: "column", justifyContent: "center",
          transform: `translateX(${interpolate(spr(0), [0, 1], [-50, 0])}px)`,
          opacity: interpolate(spr(0), [0, 1], [0, 1]),
      }}>
         <div style={{ fontSize: 12, color: COLORS.MUTED, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
             {points[0]?.label || "Before"}
         </div>
         <div style={{ fontSize: titleFontSize ?? 24, fontWeight: 700, marginBottom: 12, color: COLORS.DARK }}>
             {points[0]?.title}
         </div>
         <div style={{ fontSize: descriptionFontSize ?? 16, lineHeight: 1.5, color: COLORS.MUTED }}>
             {points[0]?.description}
         </div>
      </div>

       {/* Right Item */}
       <div style={{
          ...glass(false),
          padding: 32,
          display: "flex", flexDirection: "column", justifyContent: "center",
          transform: `translateX(${interpolate(spr(5), [0, 1], [50, 0])}px)`,
          opacity: interpolate(spr(5), [0, 1], [0, 1]),
      }}>
         <div style={{ fontSize: 12, color: COLORS.MUTED, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
             {points[1]?.label || "After"}
         </div>
         <div style={{ fontSize: titleFontSize ?? 24, fontWeight: 700, marginBottom: 12, color: COLORS.DARK }}>
             {points[1]?.title}
         </div>
         <div style={{ fontSize: descriptionFontSize ?? 16, lineHeight: 1.5, color: COLORS.MUTED }}>
             {points[1]?.description}
         </div>
      </div>

      {/* Verdict / Bottom Bar */}
      {finalVerdict && (
          <div style={{
              gridColumn: "1 / 3",
              ...glass(true),
              backgroundColor: accentColor || COLORS.ACCENT,
              padding: "20px",
              textAlign: "center",
              display: "flex", alignItems: "center", justifyContent: "center",
              transform: `translateY(${interpolate(spr(15), [0, 1], [20, 0])}px)`,
              opacity: interpolate(spr(15), [0, 1], [0, 1]),
          }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{finalVerdict}</div>
          </div>
      )}
      </div>
    </div>
  );
};
