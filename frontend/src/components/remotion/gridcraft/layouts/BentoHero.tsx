import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img } from "remotion";
import { GridcraftLayoutProps } from "../types";
import { glass, FONT_FAMILY, COLORS } from "../utils/styles";

export const BentoHero: React.FC<GridcraftLayoutProps> = ({
  title,
  subtitle,
  narration,
  imageUrl,
  accentColor,
  textColor,
  category,
  icon,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Dynamic content: category tag from layoutProps, or first word of title, or "Featured"
  const categoryTag = (category ?? (title ? title.split(/\s+/)[0]?.slice(0, 14) : "Featured")) || "Featured";
  // Icon cell: layoutProps.icon (emoji/text), or category tag as dynamic text (no hardcoded emoji)
  const iconContent = icon ?? categoryTag;
  // Subtitle/tagline: layoutProps.subtitle, else scene narration (for bottom-right cell)
  const tagline = subtitle || narration || "";

  // Animations
  const spr = (delay: number) =>
    spring({
      frame: Math.max(0, frame - delay),
      fps,
      config: { damping: 14, stiffness: 100 },
    });

  const scale1 = interpolate(spr(0), [0, 1], [0.9, 1]);
  const opacity1 = interpolate(spr(0), [0, 1], [0, 1]);

  const scale2 = interpolate(spr(5), [0, 1], [0.8, 1]);
  const opacity2 = interpolate(spr(5), [0, 1], [0, 1]);

  const scale3 = interpolate(spr(10), [0, 1], [0.9, 1]);
  const opacity3 = interpolate(spr(10), [0, 1], [0, 1]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: 24,
        width: "90%",
        height: "80%",
        margin: "auto",
        fontFamily: FONT_FAMILY.SANS,
      }}
    >
      {/* Main Title Cell */}
      <div
        style={{
          gridRow: "1 / 3",
          ...glass(true), // Accent
          backgroundColor: accentColor || COLORS.ACCENT,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: 48,
          transform: `scale(${scale1})`,
          opacity: opacity1,
        }}
      >
        <div
          style={{
            fontSize: 16,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            opacity: 0.9,
            marginBottom: 16,
            fontWeight: 500,
          }}
        >
          {categoryTag}
        </div>
        <div
          style={{
            fontSize: title && title.length > 20 ? 56 : 72, // Dynamic font size
            fontWeight: 700,
            lineHeight: 1.1,
            fontFamily: FONT_FAMILY.SERIF,
            marginBottom: 16,
          }}
        >
          {title || "Gridcraft"}
        </div>
      </div>

      {/* Icon/Category Cell - or image when imageUrl provided */}
      <div
        style={{
          ...glass(false),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${scale2})`,
          opacity: opacity2,
          padding: imageUrl ? 0 : 24,
          overflow: "hidden",
        }}
      >
        {imageUrl ? (
          <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ fontSize: 28, fontWeight: 700, color: textColor || COLORS.DARK, textAlign: "center" }}>
            {iconContent}
          </div>
        )}
      </div>

      {/* Tagline/Subtitle Cell - narration or subtitle, no static "Version 1.0" */}
      <div
        style={{
          ...glass(false),
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 32,
          transform: `scale(${scale3})`,
          opacity: opacity3,
        }}
      >
        {tagline ? (
          <>
            <div style={{ fontSize: 14, color: COLORS.MUTED, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Tagline</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: textColor || COLORS.DARK, lineHeight: 1.3 }}>{tagline}</div>
          </>
        ) : (
          <div style={{ fontSize: 18, fontWeight: 500, color: COLORS.MUTED, fontStyle: "italic" }}>Add a tagline</div>
        )}
      </div>
    </div>
  );
};
