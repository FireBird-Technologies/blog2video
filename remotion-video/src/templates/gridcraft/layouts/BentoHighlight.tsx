import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img } from "remotion";
import { GridcraftLayoutProps } from "../types";
import { glass, FONT_FAMILY, COLORS } from "../utils/styles";

export const BentoHighlight: React.FC<GridcraftLayoutProps> = ({
  // Backend props
  mainPoint,
  supportingFacts,
  // Fallbacks
  title,
  dataPoints,

  imageUrl,
  subtitle,
  textColor,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const spr = (d: number) => spring({ frame: Math.max(0, frame - d), fps, config: { damping: 14, stiffness: 110 } });

  const scale1 = interpolate(spr(0), [0, 1], [0.95, 1]);
  const op1 = interpolate(spr(0), [0, 1], [0, 1]);

  // Resolve content
  const primaryText = mainPoint || title || "Highlight Key Feature Here";
  const facts = (supportingFacts && supportingFacts.length > 0) 
    ? supportingFacts 
    : (dataPoints || []).map(d => d.value || d.description || d.label || "");

  const hasImage = !!imageUrl;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1.8fr 1fr",
        gap: 20,
        width: "90%",
        height: "80%",
        margin: "auto",
        fontFamily: FONT_FAMILY.SANS,
      }}
    >
      {/* Main Highlight Box - with optional image */}
      <div
        style={{
          gridColumn: "1 / 3",
          ...glass(false),
          backgroundColor: "rgba(255,255,255,0.4)",
          border: `1px solid ${accentColor}40`,
          display: "flex",
          flexDirection: hasImage ? "row" : "column",
          justifyContent: "center",
          padding: hasImage ? 0 : 42,
          overflow: "hidden",
          transform: `scale(${scale1})`,
          opacity: op1,
        }}
      >
        {hasImage && (
          <div style={{ flex: 1, position: "relative", overflow: "hidden", minWidth: 0 }}>
            <Img
              src={imageUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 100%)", mixBlendMode: "overlay" }} />
          </div>
        )}
        <div
          style={{
            flex: hasImage ? 1 : "none",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: 42,
          }}
        >
          <div style={{
            fontSize: 14,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: accentColor || COLORS.ACCENT,
            fontWeight: 700,
            marginBottom: 16,
          }}>
            Main Point
          </div>
          <div style={{
            fontSize: 32,
            fontWeight: 700,
            lineHeight: 1.3,
            color: textColor || COLORS.DARK,
            maxWidth: "90%",
          }}>
            {primaryText}
          </div>
          {subtitle && (
            <div style={{ fontSize: 18, color: COLORS.MUTED, marginTop: 12 }}>{subtitle}</div>
          )}
        </div>
      </div>

      {/* Supporting Facts - Render up to 2 dynamically */}
      {facts.slice(0, 2).map((fact, i) => {
         const delay = 6 + i * 4;
         const s = interpolate(spr(delay), [0, 1], [0.9, 1]);
         const o = interpolate(spr(delay), [0, 1], [0, 1]);
         const isAccent = i === 1;

         return (
             <div key={i} style={{ 
                 ...glass(isAccent), 
                 backgroundColor: isAccent ? (accentColor || COLORS.ACCENT) : undefined,
                 padding: 24,
                 display: "flex",
                 flexDirection: "column",
                 justifyContent: "center",
                 transform: `scale(${s})`,
                 opacity: o,
             }}>
                 <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 500, marginBottom: 8, textTransform: "uppercase" }}>
                     Fact {i + 1}
                 </div>
                 <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4 }}>
                     {fact}
                 </div>
             </div>
         )
      })}
    </div>
  );
};
