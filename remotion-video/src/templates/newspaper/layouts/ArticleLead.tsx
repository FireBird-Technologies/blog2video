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

  // --- Animation Logic (Unchanged) ---
  const cameraRotateX = interpolate(frame, [0, 60], [15, 5], { extrapolateRight: "clamp" });
  const cameraRotateY = interpolate(frame, [0, 60], [8, 0], { extrapolateRight: "clamp" });
  const cameraScale = interpolate(frame, [0, 30, 100, durationInFrames], [1.05, 1.2, 0.92, 0.90], { extrapolateRight: "clamp" });
  const cameraTranslateY = interpolate(frame, [0, durationInFrames], [0, -35]);

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

  const imageOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });
  const imageScale = interpolate(frame, [25, 45], [0.8, 1], { extrapolateRight: "clamp" });
  const imageRotation = interpolate(frame, [25, 45], [5, p ? -2 : 3], { extrapolateRight: "clamp" });

  const numericMatch = pullVal.match(/^(\d+(?:\.\d+)?)(.*)/);
  const baseNum = numericMatch ? parseFloat(numericMatch[1]) : null;
  const numSuffix = numericMatch ? numericMatch[2] : pullVal;
  const animatedNum = baseNum !== null ? Math.round(baseNum * pullNumP) : null;
  const displayVal = animatedNum !== null ? `${animatedNum}${numSuffix}` : pullVal;

  const dropChar = narration[0] ?? "";

  // --- Custom Logic for User Instructions ---
  const isLandscapeWithImage = !p && imageUrl;
  const isPortraitWithImage = p && imageUrl; // Helper for portrait + image
  const isPortraitWithoutImage = p && !imageUrl;

  let actualTitleMarginBottom: string | number;
  let bodyContentAreaMarginTop: string | number = 0; // New variable for vertical spacing

  if (isPortraitWithImage) {
    // In portrait format with an image, adjust spacing:
    // 1. Give title a smaller bottom margin to bring it slightly closer to the image's conceptual space.
    actualTitleMarginBottom = 20; 
    // 2. Add a top margin to the narration/body content area to push it down,
    //    creating a clear gap between the absolutely positioned image and the text section.
    //    The image is positioned around 25% top and 25% height, ending at 50%.
    //    This margin pushes the narration to start well below the image.
    bodyContentAreaMarginTop = "20vh"; // Pushes content down by 20% of viewport height
  } else {
    // Original logic for titleMarginBottom when no image in portrait or landscape
    actualTitleMarginBottom = isPortraitWithoutImage ? 50 : (p ? "40%" : 50);
    bodyContentAreaMarginTop = 0; // Default to no extra margin
  }

  const bodyContentAreaFlexDirection = isPortraitWithoutImage ? "column" : (p ? "column-reverse" : "row");
  const bodyContentAreaJustifyContent = isPortraitWithoutImage ? "flex-start" : (p ? "flex-start" : "space-between");

  const narrationWidth = p ? "100%" : "52%";

  // Stats Box Styling
  const statsContainerStyles: React.CSSProperties = {
    opacity: pullOp,
    transform: `translateX(${pullSlide}px) translateZ(30px)`,
    fontFamily: B_FONT,
    color: textColor,
    // Default styles for flex item or portrait mode
    width: p ? "100%" : "30%",
    borderLeft: `${p ? 12 : 8}px solid ${accentColor}`,
    paddingLeft: 25,
    alignSelf: p ? "flex-start" : "center", // Only applies if it's a flex item
  };

  if (isLandscapeWithImage) {
    // Landscape with image: Stats move to the bottom, become absolutely positioned
    statsContainerStyles.position = "absolute";
    statsContainerStyles.bottom = "6%";
    statsContainerStyles.right = "8%";
    statsContainerStyles.width = "30%";
    statsContainerStyles.borderLeft = "none";
    statsContainerStyles.borderTop = `8px solid ${accentColor}`;
    statsContainerStyles.paddingTop = 25;
    statsContainerStyles.paddingLeft = 0;
    delete statsContainerStyles.alignSelf; // Not a flex item anymore
  }


  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: B_FONT, backgroundColor: "#000", perspective: "1500px" }}>
      <div style={{
        width: "100%",
        height: "100%",
        transformStyle: "preserve-3d",
        transform: `scale(${cameraScale}) rotateX(${cameraRotateX}deg) rotateY(${cameraRotateY}deg) translateY(${cameraTranslateY}px)`,
      }}>
        
        <NewsBackground bgColor={bgColor} />
        <div style={{ position: "absolute", inset: 0, backgroundColor: bgColor, opacity: 0.45, zIndex: 2 }} />
        <img src={staticFile("vintage-news.avif")} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.4, filter: "grayscale(75%) contrast(1.08)", zIndex: 1 }} />

        {/* --- DYNAMIC IMAGE PLACEMENT --- */}
        {imageUrl && (
          <div
            style={{
              position: "absolute",
              // Portrait: Centered Middle | Landscape: Anchored Right
              top: p ? "25%" : "20%", // Modified for portrait: "a bit at top"
              right: p ? "auto" : "6%",
              left: p ? "50%" : "auto",
              width: p ? "88%" : "38%",
              height: p ? "25%" : "60%",
              transform: p 
                ? `translateX(-50%) translateZ(40px) scale(${imageScale}) rotate(${imageRotation}deg)`
                : `translateZ(40px) scale(${imageScale}) rotate(${imageRotation}deg)`,
              opacity: imageOpacity,
              zIndex: 10,
              padding: "10px",
              backgroundColor: "#fff",
              boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
              clipPath: "polygon(0% 0%, 100% 2%, 98% 98%, 2% 100%)",
            }}
          >
            <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
              <Img
                src={imageUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: "grayscale(0.7) contrast(1.1)",
                }}
              />
            </div>
          </div>
        )}

        {/* --- MAIN CONTENT LAYER --- */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            padding: p ? "10% 8%" : "6% 8%",
            zIndex: 5,
            transform: "translateZ(60px)",
          }}
        >
          {/* 1. HEADER - Bold & Large */}
          <div style={{ marginBottom: actualTitleMarginBottom, width: p ? "100%" : "55%" }}>
            <div style={{ height: p ? 12 : 8, background: textColor, width: `${ruleW}%`, marginBottom: 20 }} />
            <div
              style={{
                fontFamily: B_FONT,
                fontSize: titleFontSize ?? (p ? 72 : 85), // Massive Defaults
                fontWeight: 900,
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
                color: textColor,
                opacity: labelOp,
                lineHeight: 0.95,
              }}
            >
              {title}
            </div>
          </div>

          {/* 2. BODY CONTENT AREA (Narration and Stats) */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: bodyContentAreaFlexDirection,
              gap: p ? 30 : 60,
              alignItems: p ? "stretch" : "center",
              justifyContent: bodyContentAreaJustifyContent,
              marginTop: bodyContentAreaMarginTop, // Apply dynamic margin here
            }}
          >
            {/* NARRATION TEXT */}
            <div style={{ 
              width: narrationWidth, 
            }}>
              <div
                style={{
                  fontFamily: B_FONT,
                  fontSize: descriptionFontSize ?? (p ? 38 : 32),
                  fontWeight: 500,
                  color: textColor,
                  lineHeight: 1.45,
                }}
              >
                <span
                  style={{
                    float: "left",
                    fontFamily: H_FONT,
                    fontSize: p ? 130 : 110,
                    fontWeight: 800,
                    lineHeight: 0.7,
                    marginRight: 15,
                    marginTop: 5,
                    color: textColor,
                    opacity: dropCapOp,
                    transform: `translateY(${dropCapY}px)`,
                    display: "inline-block",
                  }}
                >
                  {dropChar}
                </span>

                <span style={{ textShadow: `0 0 2px ${bgColor}` }}>
                  {visText.length > 1 ? visText.slice(1) : ""}
                  {showCursor && visChars > 0 && (
                    <span style={{ display: "inline-block", width: 4, height: "0.9em", background: textColor, opacity: 0.6, marginLeft: 2, verticalAlign: "middle" }} />
                  )}
                </span>
              </div>
            </div>

            {/* PULL STAT (Right side in Landscape / Top of bottom section in Portrait) */}
            {pullVal && !isLandscapeWithImage && ( // Render here IF NOT Landscape with Image
              <div style={statsContainerStyles}>
                <div
                  style={{
                    fontFamily: H_FONT,
                    fontSize: p ? 90 : 80,
                    fontWeight: 800,
                    color: textColor,
                    lineHeight: 1,
                    marginBottom: 5,
                  }}
                >
                  {displayVal}
                </div>
                {pullCap && (
                  <div
                    style={{
                      fontFamily: B_FONT,
                      fontSize: p ? 24 : 18,
                      fontWeight: 700,
                      color: textColor,
                      opacity: 0.7,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em"
                    }}
                  >
                    {pullCap}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PULL STAT (Only for Landscape with Image, positioned at bottom) */}
          {pullVal && isLandscapeWithImage && (
            <div style={statsContainerStyles}>
              <div
                style={{
                  fontFamily: H_FONT,
                  fontSize: p ? 90 : 80, // p is false here, so 80
                  fontWeight: 800,
                  color: textColor,
                  lineHeight: 1,
                  marginBottom: 5,
                }}
              >
                {displayVal}
              </div>
              {pullCap && (
                <div
                  style={{
                    fontFamily: B_FONT,
                    fontSize: p ? 24 : 18, // p is false here, so 18
                    fontWeight: 700,
                    color: textColor,
                    opacity: 0.7,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em"
                  }}
                >
                  {pullCap}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </AbsoluteFill>
  );
};
