import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Img, useVideoConfig, staticFile } from "remotion";
import { NewsBackground } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "Georgia, 'Times New Roman', serif";
const B_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export const ArticleLead: React.FC<BlogLayoutProps & { imageUrl?: string }> = ({
  title = "The Story",
  narration = "Lawmakers failed to pass a short-term spending bill before the midnight deadline, triggering a partial shutdown affecting hundreds of thousands of federal workers.",
  accentColor = "#FFE34D",
  bgColor = "#FAFAF8",
  textColor = "#111111",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  stats,
  imageUrl,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const pullVal = stats?.[0]?.value ?? "";
  const pullCap = stats?.[0]?.label ?? "";

  // --- 3D Camera Animation ---
  const cameraRotateX = interpolate(frame, [0, 60], [15, 5], { extrapolateRight: "clamp" });
  const cameraRotateY = interpolate(frame, [0, 60], [8, 0], { extrapolateRight: "clamp" });
  const cameraScale = interpolate(frame, [0, 40, 200, durationInFrames], [1.05, 1.2, 0.92, 0.90], { extrapolateRight: "clamp" });
  const cameraTranslateY = interpolate(frame, [0, durationInFrames], [0, -35]);

  // --- Existing Animations ---
  const ruleW = interpolate(frame, [0, 16], [0, 100], { extrapolateRight: "clamp" });
  const labelOp = interpolate(frame, [6, 20], [0, 1], { extrapolateRight: "clamp" });
  const dropCapOp = interpolate(frame, [10, 26], [0, 1], { extrapolateRight: "clamp" });
  const dropCapY = interpolate(frame, [10, 26], [16, 0], { extrapolateRight: "clamp" });
  const bodyProgress = interpolate(frame, [20, 74], [0, 1], { extrapolateRight: "clamp" });
  const visChars = Math.floor(narration.length * bodyProgress);
  const visText = narration.slice(0, visChars);
  const showCursor = visChars < narration.length;
  const pullSlide = interpolate(frame, [54, 72], [80, 0], { extrapolateRight: "clamp" });
  const pullOp = interpolate(frame, [54, 70], [0, 1], { extrapolateRight: "clamp" });
  const pullNumP = interpolate(frame, [66, 82], [0, 1], { extrapolateRight: "clamp" });

  // --- Image Cutout Entrance ---
  const imageOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });
  const imageScale = interpolate(frame, [25, 45], [0.8, 1], { extrapolateRight: "clamp" });
  const imageRotation = interpolate(frame, [25, 45], [5, -2], { extrapolateRight: "clamp" });

  const numericMatch = pullVal.match(/^(\d+(?:\.\d+)?)(.*)/);
  const baseNum = numericMatch ? parseFloat(numericMatch[1]) : null;
  const numSuffix = numericMatch ? numericMatch[2] : pullVal;
  const animatedNum = baseNum !== null ? Math.round(baseNum * pullNumP) : null;
  const displayVal = animatedNum !== null ? `${animatedNum}${numSuffix}` : pullVal;

  const dropChar = narration[0] ?? "";

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: B_FONT, backgroundColor: "#000", perspective: "1500px" }}>
      <div style={{
        width: "100%",
        height: "100%",
        transformStyle: "preserve-3d",
        transform: `scale(${cameraScale}) rotateX(${cameraRotateX}deg) rotateY(${cameraRotateY}deg) translateY(${cameraTranslateY}px)`,
      }}>
        
        {/* Z-Index 0: The Base Background */}
        <NewsBackground bgColor={bgColor} />

        {/* Z-Index 1: Vintage texture overlaying the background */}
        <img
          src={staticFile("vintage-news.avif")}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.4,
            filter: "grayscale(75%) contrast(1.08)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        {/* --- VINTAGE IMAGE CUTOUT --- */}
        {imageUrl && (
          <div style={{
            position: "absolute",
            bottom: "8%",
            left: "50%",
            width: p ? "50%" : "35%",
            zIndex: 2, 
            transformStyle: "preserve-3d",
            transform: `translateX(-50%) translateZ(10px) scale(${imageScale}) rotate(${imageRotation}deg)`,
            opacity: imageOpacity,
            padding: "10px",
            // Changed: The base paper is now slightly yellowed
            backgroundColor: "#fdf8e6", 
            boxShadow: "2px 10px 30px rgba(0,0,0,0.3)",
            // Changed: Dashed border looks like it was hand-cut
            border: "1px dashed #999", 
          }}>
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              <Img
                src={imageUrl}
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  // New: Vintage print filters (High contrast, slightly blurred, grayscale)
                  filter: "grayscale(100%) contrast(1.3) brightness(0.9) blur(0.3px)",
                  mixBlendMode: "multiply", // Blends ink onto the paper color
                }}
              />
              {/* HALFTONE DOT OVERLAY */}
              {/* This absolute-filled layer creates the "dots" pattern seen in old newsprint */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  opacity: 0.15, // Keep it subtle
                  mixBlendMode: "multiply",
                  // Complex gradient pattern simulating newspaper half-tone
                  backgroundImage: `
                    radial-gradient(circle at center, black 1px, transparent 1.5px),
                    radial-gradient(circle at center, black 1px, transparent 1.5px)
                  `,
                  backgroundSize: "4px 4px",
                  backgroundPosition: "0 0, 2px 2px",
                }}
              />
            </div>
          </div>
        )}

        {/* Z-Index 3: Main Text Content */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            padding: p ? "7% 6%" : "6% 9%",
            zIndex: 3, 
            transform: "translateZ(50px)", 
          }}
        >
          {/* Header Section */}
          <div style={{ marginBottom: p ? 18 : 24 }}>
            <div style={{ height: 3, background: textColor, width: `${ruleW}%`, marginBottom: 10 }} />
            <div style={{
              fontFamily: B_FONT,
              fontSize: titleFontSize ?? 34,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: textColor,
              opacity: labelOp,
            }}>
              {title}
            </div>
          </div>

          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: p ? "column" : "row",
            gap: p ? 24 : 48,
            alignItems: "flex-start",
          }}>
            {/* Body Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: B_FONT,
                fontSize: descriptionFontSize ?? (p ? 24 : 28),
                fontWeight: 500,
                color: textColor,
                lineHeight: 1.65,
              }}>
                <span style={{
                  float: "left",
                  fontFamily: H_FONT,
                  fontSize: p ? 84 : 104,
                  fontWeight: 800,
                  lineHeight: 0.78,
                  marginRight: 10,
                  marginTop: 6,
                  color: textColor,
                  opacity: dropCapOp,
                  transform: `translateY(${dropCapY}px)`,
                  display: "inline-block",
                }}>
                  {dropChar}
                </span>

                <span style={{ textShadow: `0 0 15px ${bgColor}, 0 0 5px ${bgColor}` }}>
                  {visText.length > 1 ? visText.slice(1) : ""}
                  {showCursor && visChars > 0 && (
                    <span style={{
                      display: "inline-block",
                      width: 2,
                      height: "1em",
                      background: textColor,
                      opacity: 0.5,
                      marginLeft: 2,
                      verticalAlign: "text-bottom",
                    }} />
                  )}
                </span>
              </div>
            </div>

            {/* Pull Stat */}
            {pullVal && (
              <div style={{
                width: p ? "100%" : 220,
                flexShrink: 0,
                opacity: pullOp,
                transform: `translateX(${pullSlide}px) translateZ(20px)`,
                borderLeft: `4px solid ${accentColor}`,
                paddingLeft: 18,
                paddingTop: 4,
                paddingBottom: 4,
                alignSelf: p ? "flex-start" : "center",
              }}>
                <div style={{
                  fontFamily: H_FONT,
                  fontSize: p ? 56 : 70,
                  fontWeight: 700,
                  color: textColor,
                  lineHeight: 1,
                  marginBottom: 8,
                }}>
                  {displayVal}
                </div>
                {pullCap && (
                  <div style={{
                    fontFamily: B_FONT,
                    fontSize: p ? 16 : 18,
                    color: textColor,
                    opacity: 0.68,
                    lineHeight: 1.4,
                  }}>
                    {pullCap}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};