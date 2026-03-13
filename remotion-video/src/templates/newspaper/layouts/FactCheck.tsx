import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Img, staticFile } from "remotion";
import { NewsBackground } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const B_FONT = "'Source Sans 3', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export const FactCheck: React.FC<BlogLayoutProps & { imageUrl?: string }> = ({
  title = "Fact Check",
  narration,
  leftThought = "The shutdown will only last a few hours.",
  rightThought = "Past shutdowns have averaged 16 days. Essential services may be suspended indefinitely.",
  accentColor = "#FFE34D",
  bgColor = "#FAFAF8",
  textColor = "#111111",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  stats,
  imageUrl,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const scale = width / 1920;

  const leftLabel = stats?.[0]?.label ?? "CLAIMED";
  const rightLabel = stats?.[1]?.label ?? "THE FACTS";

  // --- Animation Logic ---
  const headerOp = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const leftOp = interpolate(frame, [8, 28], [0, 1], { extrapolateRight: "clamp" });
  const rightOp = interpolate(frame, [14, 34], [0, 1], { extrapolateRight: "clamp" });
  const imageOpacity = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" });
  const verdictOp = interpolate(frame, [42, 56], [0, 1], { extrapolateRight: "clamp" });
  const hlSweep = interpolate(frame, [18, 40], [0, 1], { extrapolateRight: "clamp" });

  // Shard Entrance/Exit Animations
  const joinProgress = interpolate(frame, [0, 40], [0, 1], { extrapolateRight: "clamp" });
  const breakProgress = interpolate(frame, [durationInFrames - 30, durationInFrames], [0, 1], { extrapolateRight: "clamp" });

  const leftShardX = -width / 2 * (1 - joinProgress) - 40 * breakProgress;
  const leftShardY = -height / 5 * (1 - joinProgress) - 20 * breakProgress;
  const leftShardRot = -8 + 8 * joinProgress + 2 * breakProgress;
  
  const rightShardX = -40 * breakProgress;
  const rightShardY = height / 5 * (1 - joinProgress) + 20 * breakProgress;
  const rightShardRot = 8 - 8 * joinProgress - 2 * breakProgress;

  const badgeHL = (color: string) => ({
    backgroundImage: `linear-gradient(${color}, ${color})`,
    backgroundSize: `${hlSweep * 100}% 100%`,
    backgroundRepeat: "no-repeat" as const,
    backgroundPosition: "0 0",
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: fontFamily ?? B_FONT, backgroundColor: "#000" }}>
      <NewsBackground bgColor={bgColor} />

      {/* Background Tint */}
      <div style={{ position: "absolute", inset: 0, backgroundColor: bgColor, opacity: 0.45, zIndex: 2 }} />

      {/* Restored Shards */}
      <img
        src={staticFile("vintage-news.avif")}
        alt=""
        style={{
          position: "absolute",
          top: leftShardY,
          left: leftShardX,
          width: width / 2,
          height: height,
          objectFit: "cover",
          opacity: 0.4,
          transform: `rotate(${leftShardRot}deg)`,
          zIndex: 1,
        }}
      />
      <img
        src={staticFile("vintage-news.avif")}
        alt=""
        style={{
          position: "absolute",
          top: rightShardY,
          right: rightShardX,
          width: width / 2,
          height: height,
          objectFit: "cover",
          opacity: 0.4,
          transform: `rotate(${rightShardRot}deg)`,
          zIndex: 1,
        }}
      />

      {/* Main Content Container */}
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        padding: p ? "12% 8%" : "5% 8%",
        zIndex: 10,
      }}>
        
        {/* HEADER */}
        <div style={{ opacity: headerOp, marginBottom: p ? 30 * scale : 40 * scale }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 * scale, marginBottom: 12 * scale }}>
             <svg width={30} height={30} viewBox="0 0 34 34" fill="none">
              <circle cx="14" cy="14" r="10" stroke={textColor} strokeWidth="3" />
              <line x1="22" y1="22" x2="31" y2="31" stroke={textColor} strokeWidth="3" strokeLinecap="round" />
            </svg>
            <div style={{ fontFamily: fontFamily ?? H_FONT, fontSize: titleFontSize ?? (p ? 84 * scale : 70 * scale), fontWeight: 900, color: textColor, textTransform: "uppercase" }}>
              {title}
            </div>
          </div>
          <div style={{ height: 3, background: textColor, width: "100%", opacity: 0.2 }} />
        </div>

        {/* MAIN BODY AREA */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: p ? "column" : "row",
          gap: p ? 25 * scale : 40 * scale,
          alignItems: "stretch",
        }}>
          
          {/* LEFT SECTION (CLAIM) */}
          <div style={{ 
            flex: 1, 
            opacity: leftOp,
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{ display: "inline-block", alignSelf: "flex-start", fontFamily: fontFamily ?? B_FONT, fontSize: p ? 14 : 13, fontWeight: 800, letterSpacing: "0.1em", color: textColor, ...badgeHL(accentColor), padding: "4px 8px", marginBottom: 15 * scale }}>
              {leftLabel}
            </div>
            <div style={{ fontFamily: fontFamily ?? H_FONT, fontSize: descriptionFontSize ?? (p ? 35 * scale : 41 * scale), fontWeight: 500, color: textColor, lineHeight: 1.3, fontStyle: "italic" }}>
              "{leftThought}"
            </div>
          </div>

          {/* MIDDLE IMAGE (PORTRAIT ONLY) */}
          {imageUrl && p && (
            <div style={{ opacity: imageOpacity, width: "100%", display: "flex", justifyContent: "center", margin: "10px 0" }}>
               <div style={{ 
                  width: "100%", 
                  padding: "8px", 
                  backgroundColor: "#fff", 
                  boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
                  transform: "rotate(-1deg)",
                  border: "1px solid #ddd"
                }}>
                  <Img src={imageUrl} style={{ width: "100%", height: 360 * scale, objectFit: "cover", filter: "sepia(0.2) grayscale(0.3)" }} />
               </div>
            </div>
          )}

          {/* LANDSCAPE DIVIDER */}
          {!p && <div style={{ width: 1, background: textColor, opacity: 0.1 }} />}

          {/* RIGHT SECTION (FACTS) */}
          <div style={{ 
            flex: 1, 
            opacity: rightOp,
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{ display: "inline-block", alignSelf: "flex-start", fontFamily: fontFamily ?? B_FONT, fontSize: p ? 14 : 13, fontWeight: 800, letterSpacing: "0.1em", color: textColor, border: `1.5px solid ${textColor}`, padding: "4px 8px", marginBottom: 15 * scale }}>
              {rightLabel}
            </div>
            <div style={{ fontFamily: fontFamily ?? B_FONT, fontSize: descriptionFontSize ?? (p ? 35 * scale : 41 * scale), fontWeight: 500, color: textColor, lineHeight: 1.4 }}>
              {rightThought}
            </div>
          </div>

          {/* LANDSCAPE IMAGE (THIRD COLUMN) */}
          {!p && imageUrl && (
            <>
              <div style={{ width: 1, background: textColor, opacity: 0.1 }} />
              <div style={{ flex: 0.8, opacity: imageOpacity }}>
                <div style={{ 
                  padding: "10px", 
                  backgroundColor: "#fff", 
                  boxShadow: "0 15px 35px rgba(0,0,0,0.15)",
                  transform: "rotate(2deg)",
                  border: "1px solid #ddd"
                }}>
                  <Img src={imageUrl} style={{ width: "100%", height: "auto", display: "block", filter: "sepia(0.2) contrast(1.1)" }} />
                  <div style={{ marginTop: 8, fontFamily: fontFamily ?? H_FONT, fontSize: 11, color: "#666", fontStyle: "italic", borderTop: "1px solid #eee", paddingTop: 4 }}>
                    Newspaper Archive / Photo
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* VERDICT (NARRATION) */}
        {narration && (
          <div style={{ 
            opacity: verdictOp, 
            marginTop: p ? 20 * scale : 40 * scale,
            paddingTop: 20 * scale,
            borderTop: `${3 * scale}px solid ${accentColor}`,
            fontFamily: fontFamily ?? B_FONT, 
            fontSize: descriptionFontSize ?? (p ? 35 * scale : 41 * scale),
            fontWeight: 700,
            color: textColor 
          }}>
            {narration}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};