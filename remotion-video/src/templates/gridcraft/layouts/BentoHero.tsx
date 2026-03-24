import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img } from "remotion";
import { GridcraftLayoutProps } from "../types";
import {
  GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY,
  GRIDCRAFT_DEFAULT_SERIF_FONT_FAMILY,
} from "../constants";
import { glass, COLORS } from "../utils/styles";

// Custom SVG Component for the Gridcraft Icon
const GridcraftSVG = ({ color, size = 80 }: { color: string; size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke={color} 
    strokeWidth="1.5" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    style={{ filter: "drop-shadow(0px 4px 8px rgba(0,0,0,0.05))" }}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);

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
  aspectRatio,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const p = aspectRatio === "portrait";

  // Dynamic content logic
  const categoryTag = (category ?? (title ? title.split(/\s+/)[0]?.slice(0, 14) : "Featured")) || "Featured";
  const tagline = subtitle || narration || "";
  const sansFontFamily = fontFamily ?? GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY;
  const serifFontFamily = fontFamily ?? GRIDCRAFT_DEFAULT_SERIF_FONT_FAMILY;
  const titleFontFamily = p ? sansFontFamily : serifFontFamily;

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
        gridTemplateColumns: p ? "1fr 1fr" : "2fr 1fr",
        gridTemplateRows: p ? "2fr 1fr" : "1fr 1fr",
        gap: 24,
        width: "90%",
        height: "80%",
        margin: "auto",
        fontFamily: sansFontFamily,
      }}
    >
      {/* Main Title Cell */}
      <div
        style={{
          gridColumn: p ? "1 / 3" : "1 / 2",
          gridRow: p ? "1 / 2" : "1 / 3",
          ...glass(true),
          backgroundColor: accentColor || COLORS.ACCENT,
          display: "flex",
          flexDirection: "column",
          justifyContent: p ? "center" : "flex-end",
          alignItems: p ? "center" : "flex-start",
          textAlign: p ? "center" : "left",
          padding: p ? 32 : 48,
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
            marginBottom: p ? 8 : 16,
            fontWeight: 500,
          }}
        >
          {categoryTag}
        </div>
        <div
          style={{
            fontSize: titleFontSize ?? (p ? 72 : 85),
            fontWeight: 700,
            lineHeight: 1.1,
            fontFamily: titleFontFamily,
            marginBottom: 16,
            maxWidth: "100%",
            minWidth: 0,
            wordBreak: "break-word",
          }}
        >
          {title || "Gridcraft"}
        </div>
      </div>

      {/* Box 2: SVG Icon & Sentence Cell */}
      <div
        style={{
          gridColumn: p ? "1 / 2" : "2 / 3",
          gridRow: p ? "2 / 3" : "1 / 2",
          ...glass(false),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${scale2})`,
          opacity: opacity2,
          padding: imageUrl ? 0 : (p ? 20 : 32),
          overflow: "hidden",
          gap: 20,
        }}
      >
        {imageUrl ? (
          <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <>
            <GridcraftSVG 
              color={textColor || COLORS.DARK} 
              size={p ? 60 : 100} // Increased size (portrait 60px, landscape 100px)
            />
            <div 
              style={{ 
                fontSize: categoryFontSize ?? (p ? 14 : 18), 
                fontWeight: 500, 
                color: textColor || COLORS.DARK, 
                textAlign: "center",
                maxWidth: "85%",
                lineHeight: 1.4,
                opacity: 0.7
              }}
            >
              {"Precision layouts, perfectly crafted."}
            </div>
          </>
        )}
      </div>

      {/* Box 3: Tagline/Subtitle Cell */}
      <div
        style={{
          gridColumn: p ? "2 / 3" : "2 / 3",
          gridRow: p ? "2 / 3" : "2 / 3",
          ...glass(false),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: p ? 24 : 32,
          transform: `scale(${scale3})`,
          opacity: opacity3,
        }}
      >
        {tagline ? (
          <>
            <div style={{ 
              fontSize: p ? 12 : 14, 
              color: COLORS.MUTED, 
              fontWeight: 500, 
              textTransform: "uppercase", 
              letterSpacing: "0.1em", 
              marginBottom: p ? 4 : 8 
            }}>
              Tagline
            </div>
            <div style={{ 
              fontSize: descriptionFontSize ?? (p ? 30 : 28), 
              fontWeight: 600, 
              color: textColor || COLORS.DARK, 
              lineHeight: 1.3 
            }}>
              {tagline}
            </div>
          </>
        ) : (
          <div style={{ 
            fontSize: p ? 16 : 18, 
            fontWeight: 500, 
            color: COLORS.MUTED, 
            fontStyle: "italic" 
          }}>
            Add a tagline
          </div>
        )}
      </div>
    </div>
  );
};