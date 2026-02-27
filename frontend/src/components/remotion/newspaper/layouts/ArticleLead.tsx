import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Img, useVideoConfig } from "remotion";
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

  // --- 3D Camera Animation (Faster Zoom Out) ---
  // Starts tilted, then settles into a slight desk tilt
  const cameraRotateX = interpolate(frame, [0, 60], [15, 5], { extrapolateRight: "clamp" });
  const cameraRotateY = interpolate(frame, [0, 60], [8, 0], { extrapolateRight: "clamp" });

  // Scale: Quick zoom in (0-25), then a FASTER zoom out (25-80), then slow drift
  const cameraScale = interpolate(
    frame, 
    [0, 40, 200, durationInFrames], 
    [1.05, 1.2, 0.92, 0.90], // Pulls back further (to 0.92) much earlier (frame 80)
    { extrapolateRight: "clamp" }
  );

  // Vertical slide: matches the faster pull-back energy
  const cameraTranslateY = interpolate(frame, [0, durationInFrames], [0, -35]);

  // Existing Animations
  const ruleW = interpolate(frame, [0, 16], [0, 100], { extrapolateRight: "clamp" });
  const labelOp = interpolate(frame, [6, 20], [0, 1], { extrapolateRight: "clamp" });
  const dropCapOp = interpolate(frame, [10, 26], [0, 1], { extrapolateRight: "clamp" });
  const dropCapY = interpolate(frame, [10, 26], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const bodyProgress = interpolate(frame, [20, 74], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const visChars = Math.floor(narration.length * bodyProgress);
  const visText = narration.slice(0, visChars);
  const showCursor = visChars < narration.length;

  const pullSlide = interpolate(frame, [54, 72], [80, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pullOp = interpolate(frame, [54, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pullNumP = interpolate(frame, [66, 82], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const numericMatch = pullVal.match(/^(\d+(?:\.\d+)?)(.*)/);
  const baseNum = numericMatch ? parseFloat(numericMatch[1]) : null;
  const numSuffix = numericMatch ? numericMatch[2] : pullVal;
  const animatedNum = baseNum !== null ? Math.round(baseNum * pullNumP) : null;
  const displayVal = animatedNum !== null ? `${animatedNum}${numSuffix}` : pullVal;

  const dropChar = narration[0] ?? "";

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: B_FONT, backgroundColor: "#000", perspective: "1500px" }}>
      {/* 3D Camera Wrapper */}
      <div style={{
        width: "100%",
        height: "100%",
        transformStyle: "preserve-3d",
        transform: `
          scale(${cameraScale}) 
          rotateX(${cameraRotateX}deg) 
          rotateY(${cameraRotateY}deg)
          translateY(${cameraTranslateY}px)
        `,
      }}>
        {/* Background image with newspaper overlay */}
        {imageUrl && (
          <>
            <Img
              src={imageUrl}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "grayscale(70%) contrast(90%) brightness(85%)",
                zIndex: 0,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(220,220,220,0.5)",
                zIndex: 1,
                mixBlendMode: "multiply",
              }}
            />
          </>
        )}

        <NewsBackground bgColor={bgColor} />

        {/* Vintage texture */}
        <img
          src="/vintage-news.avif"
          alt=""
          aria-hidden
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
        
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, rgba(235, 225, 210, 0.42) 0%, rgba(245, 238, 225, 0.38) 50%, rgba(225, 215, 195, 0.42) 100%)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        {/* Main Content Layer */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            padding: p ? "7% 6%" : "6% 9%",
            zIndex: 2,
            transform: "translateZ(30px)", // Float content slightly for depth
          }}
        >
          {/* Top rule + section label */}
          <div style={{ marginBottom: p ? 18 : 24 }}>
            <div style={{ height: 3, background: textColor, width: `${ruleW}%`, marginBottom: 10 }} />
            <div
              style={{
                fontFamily: B_FONT,
                fontSize: titleFontSize ?? (p ? 34 : 34),
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: textColor,
                opacity: labelOp,
              }}
            >
              {title}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: p ? "column" : "row",
              gap: p ? 24 : 48,
              alignItems: "flex-start",
            }}
          >
            {/* Body text with drop cap */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: B_FONT,
                  fontSize: descriptionFontSize ?? (p ? 24 : 28),
                  fontWeight: 500,
                  color: textColor,
                  lineHeight: 1.65,
                }}
              >
                <span
                  style={{
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
                  }}
                >
                  {dropChar}
                </span>

                <span>
                  {visText.length > 1 ? visText.slice(1) : ""}
                  {showCursor && visChars > 0 && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 2,
                        height: "1em",
                        background: textColor,
                        opacity: 0.5,
                        marginLeft: 2,
                        verticalAlign: "text-bottom",
                      }}
                    />
                  )}
                </span>
              </div>
            </div>

            {/* Pull stat */}
            {pullVal && (
              <div
                style={{
                  width: p ? "100%" : 220,
                  flexShrink: 0,
                  opacity: pullOp,
                  transform: `translateX(${pullSlide}px) translateZ(20px)`, // Extra depth for the stat
                  borderLeft: `4px solid ${accentColor}`,
                  paddingLeft: 18,
                  paddingTop: 4,
                  paddingBottom: 4,
                  alignSelf: p ? "flex-start" : "center",
                }}
              >
                <div
                  style={{
                    fontFamily: H_FONT,
                    fontSize: p ? 56 : 70,
                    fontWeight: 700,
                    color: textColor,
                    lineHeight: 1,
                    marginBottom: 8,
                  }}
                >
                  {displayVal}
                </div>
                {pullCap && (
                  <div
                    style={{
                      fontFamily: B_FONT,
                      fontSize: p ? 16 : 18,
                      color: textColor,
                      opacity: 0.68,
                      lineHeight: 1.4,
                    }}
                  >
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