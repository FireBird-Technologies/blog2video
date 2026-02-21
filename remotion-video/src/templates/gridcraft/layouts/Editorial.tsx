import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img } from "remotion";
import { GridcraftLayoutProps } from "../types";
import { glass, FONT_FAMILY, COLORS } from "../utils/styles";

export const Editorial: React.FC<GridcraftLayoutProps> = ({
  title,
  narration,
  imageUrl,
  accentColor,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const spr = spring({ frame, fps, config: { damping: 14 } });
  
  const scale = interpolate(spr, [0, 1], [0.95, 1]);
  const opacity = interpolate(spr, [0, 1], [0, 1]);
  const slideUp = interpolate(spr, [0, 1], [30, 0]);

  // Dynamic Layout: If image exists, split 50/50. Else center text.
  const hasImage = !!imageUrl;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "90%",
        height: "80%",
        margin: "auto",
        fontFamily: FONT_FAMILY.SANS,
      }}
    >
      <div
        style={{
           ...glass(false),
           display: "flex",
           flexDirection: hasImage ? "row" : "column",
           width: "100%",
           height: "100%",
           padding: hasImage ? 0 : 60,
           overflow: "hidden",
           transform: `scale(${scale}) translateY(${slideUp}px)`,
           opacity,
        }}
      >
        {/* Image Half */}
        {hasImage && (
            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 100%)", mixBlendMode: "overlay" }} />
            </div>
        )}

        {/* Text Half */}
        <div style={{ 
            flex: 1, 
            display: "flex", 
            flexDirection: "column", 
            justifyContent: "center", 
            padding: hasImage ? 48 : 0,
            textAlign: hasImage ? "left" : "center",
            maxWidth: hasImage ? "none" : "800px",
            margin: hasImage ? 0 : "auto",
        }}>
           <div style={{ 
               fontSize: titleFontSize ?? 42, 
               fontWeight: 700, 
               lineHeight: 1.2, 
               color: COLORS.DARK, 
               marginBottom: 24,
               fontFamily: FONT_FAMILY.SERIF 
            }}>
               {title}
           </div>
           
           <div style={{ width: hasImage ? "40%" : "20%", height: 3, backgroundColor: accentColor || COLORS.ACCENT, marginBottom: 24, alignSelf: hasImage ? "flex-start" : "center" }} />

           <div style={{ 
               fontSize: descriptionFontSize ?? 22, 
               lineHeight: 1.6, 
               color: COLORS.DARK, 
               opacity: 0.85 
            }}>
               {narration}
           </div>
        </div>
      </div>
    </div>
  );
};
