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
  titleFontSize,
  descriptionFontSize,
  categoryFontSize,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig(); // Added width, height for responsiveness

  const isPortrait = height > width; // Detect portrait mode

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
        // Adjust grid layout based on orientation
        gridTemplateColumns: isPortrait ? "1fr 1fr" : "2fr 1fr",
        gridTemplateRows: isPortrait ? "2fr 1fr" : "1fr 1fr", // Adjust row height distribution for portrait
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
          // Grid area adjusts based on orientation
          gridColumn: isPortrait ? "1 / 3" : "1 / 2", // Spans both columns for portrait, or 1st column for landscape
          gridRow: isPortrait ? "1 / 2" : "1 / 3", // Spans 1st row for portrait, or both rows for landscape
          ...glass(true), // Accent
          backgroundColor: accentColor || COLORS.ACCENT,
          display: "flex",
          flexDirection: "column",
          // Text centering for portrait
          justifyContent: isPortrait ? "center" : "flex-end", // Vertically center for portrait
          alignItems: isPortrait ? "center" : "flex-start", // Horizontally center for portrait
          textAlign: isPortrait ? "center" : "left", // Center text for portrait
          padding: isPortrait ? 32 : 48, // Reduced padding for portrait
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
            marginBottom: isPortrait ? 8 : 16, // Smaller margin for portrait
            fontWeight: 500,
          }}
        >
          {categoryTag}
        </div>
        <div
          style={{
            fontSize: titleFontSize ?? (isPortrait
              ? (title && title.length > 20 ? 48 : 64)
              : (title && title.length > 20 ? 66 : 84)),
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
          // Grid area adjusts based on orientation
          gridColumn: isPortrait ? "1 / 2" : "2 / 3", // 1st column in 2nd row for portrait, 2nd column in 1st row for landscape
          gridRow: isPortrait ? "2 / 3" : "1 / 2",
          ...glass(false),
          display: "flex",
          alignItems: "center", // Already centered vertically
          justifyContent: "center", // Already centered horizontally
          transform: `scale(${scale2})`,
          opacity: opacity2,
          padding: imageUrl ? 0 : (isPortrait ? 16 : 24), // Adjust padding for portrait
          overflow: "hidden",
        }}
      >
        {imageUrl ? (
          <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ fontSize: categoryFontSize ?? (isPortrait ? 24 : 28), fontWeight: 700, color: textColor || COLORS.DARK, textAlign: "center" }}>
            {iconContent}
          </div>
        )}
      </div>

      {/* Tagline/Subtitle Cell - narration or subtitle */}
      <div
        style={{
          // Grid area adjusts based on orientation
          gridColumn: isPortrait ? "2 / 3" : "2 / 3", // 2nd column in 2nd row for portrait, 2nd column in 2nd row for landscape
          gridRow: isPortrait ? "2 / 3" : "2 / 3",
          ...glass(false),
          display: "flex",
          flexDirection: "column",
          alignItems: "center", // Center horizontally for portrait
          justifyContent: "center", // Already centered vertically
          textAlign: "center", // Center text
          padding: isPortrait ? 24 : 32, // Adjust padding for portrait
          transform: `scale(${scale3})`,
          opacity: opacity3,
        }}
      >
        {tagline ? (
          <>
            <div style={{ fontSize: isPortrait ? 12 : 14, color: COLORS.MUTED, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: isPortrait ? 4 : 8 }}>Tagline</div>
            <div style={{ fontSize: descriptionFontSize ?? (isPortrait ? 18 : 28), fontWeight: 600, color: textColor || COLORS.DARK, lineHeight: 1.3 }}>{tagline}</div>
          </>
        ) : (
          <div style={{ fontSize: isPortrait ? 16 : 18, fontWeight: 500, color: COLORS.MUTED, fontStyle: "italic" }}>Add a tagline</div>
        )}
      </div>
    </div>
  );
};
