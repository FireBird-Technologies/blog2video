import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Img, useVideoConfig, spring, staticFile } from "remotion";
import { NewsBackground } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "Georgia, 'Times New Roman', serif";
const B_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export const NewsTimeline: React.FC<BlogLayoutProps & { imageUrl?: string }> = ({
  title = "How We Got Here",
  narration,
  accentColor = "#960f16",
  bgColor = "#FAFAF8",
  textColor = "#111111",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  stats = [
    { value: "Sep 30", label: "Fiscal year deadline passes without a budget" },
    { value: "Oct 15", label: "House passes short-term CR — Senate delays vote" },
    { value: "Jan 19", label: "Senate reaches bipartisan deal on 45-day extension" },
    { value: "Jan 31", label: "Midnight deadline missed — partial shutdown begins" },
    { value: "Feb 3", label: "Emergency session called to negotiate reopening" },
  ],
  imageUrl,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, width } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const scale = width / 1920;
  const items = stats.slice(0, 5);

  // --- Animation Constants ---
  const cameraRotateX = interpolate(frame, [0, 75], [12, 0], { extrapolateRight: "clamp" });
  const cameraRotateY = interpolate(frame, [0, 75], [-18, 0], { extrapolateRight: "clamp" });
  const cameraScale = interpolate(frame, [0, 30, durationInFrames], [1.1, 1.25, 0.95], { extrapolateRight: "clamp" });
  const bgZoom = interpolate(frame, [0, durationInFrames], [1, 1.1], { extrapolateRight: "clamp" });
  const EXIT_START = durationInFrames - 25;
  const flipProgress = spring({ frame: frame - EXIT_START, fps, config: { stiffness: 40, damping: 12 } });
  const motionBlur = interpolate(flipProgress, [0, 0.5, 1], [0, 15, 0]);
  const exitRotateY = interpolate(flipProgress, [0, 1], [0, -100]);
  const exitTranslateX = interpolate(flipProgress, [0, 1], [0, -1200]);
  const exitOpacity = interpolate(flipProgress, [0.4, 0.9], [1, 0], { extrapolateLeft: "clamp" });
  const titleOp = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const ruleW = interpolate(frame, [4, 20], [0, 100], { extrapolateRight: "clamp" });
  const spineH = interpolate(frame, [12, 12 + items.length * 14 + 10], [0, 100], { extrapolateRight: "clamp" });
  const ITEM_START = 18;
  const ITEM_STEP = 14;
  const imageSpring = spring({ frame: frame - 10, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000", perspective: "2000px" }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          transformOrigin: "left center",
          transform: `translateX(${exitTranslateX}px) rotateY(${exitRotateY}deg) scale(${cameraScale}) rotateX(${cameraRotateX}deg) rotateY(${cameraRotateY}deg)`,
          filter: `blur(${motionBlur}px)`,
          opacity: exitOpacity,
          transformStyle: "preserve-3d",
        }}
      >
        <NewsBackground bgColor={bgColor} />
        <div style={{ position: "absolute", inset: 0, backgroundColor: bgColor, opacity: 0.45, zIndex: 2 }} />

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
            transform: `scale(${bgZoom})`,
            filter: "grayscale(100%) sepia(20%)",
            zIndex: 1,
          }}
        />

        {/* Content Layer */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            padding: p ? "12% 8%" : "5% 8%",
            zIndex: 5,
            transform: "translateZ(20px)",
          }}
        >
          {/* 1. HEADER */}
          <div style={{ opacity: titleOp, marginBottom: p ? 30 : 40 }}>
            <h1
              style={{
                fontFamily: H_FONT,
                fontSize: titleFontSize ?? (p ? 72 * scale : 80 * scale),
                fontWeight: 900,
                color: textColor,
                margin: 0,
                textTransform: "uppercase",
                lineHeight: 1.0,
                letterSpacing: "-0.03em",
              }}
            >
              {title}
            </h1>
            <div style={{ height: p ? 8 : 6, background: textColor, width: `${ruleW}%`, marginTop: 15 }} />
          </div>

          {/* 2. BODY SECTION (Layout depends on Aspect Ratio) */}
          <div style={{ 
            display: "flex", 
            flexDirection: p ? "column" : "row", 
            flex: 1, 
            gap: 50,
            alignItems: p ? "stretch" : "center" 
          }}>
            
            {/* NEWSPAPER IMAGE CUTOUT */}
            {imageUrl && (
              <div
                style={{
                  position: "relative",
                  width: p ? "100%" : "45%",
                  height: p ? 360 * scale : 500 * scale,
                  background: "#fff",
                  padding: "10px 10px 40px 10px",
                  boxShadow: "10px 15px 40px rgba(0,0,0,0.2)",
                  // Rotation logic: Subtle for portrait, tilted for landscape
                  transform: p 
                    ? `rotate(${interpolate(imageSpring, [0, 1], [-1, 1.5])}deg) scale(${imageSpring})`
                    : `rotate(${interpolate(imageSpring, [0, 1], [-4, -1])}deg) scale(${imageSpring})`,
                  opacity: imageSpring,
                  clipPath: "polygon(0% 2%, 98% 0%, 100% 95%, 96% 100%, 50% 97%, 4% 100%, 0% 50%)",
                  zIndex: 10
                }}
              >
                <div style={{ width: "100%", height: "100%", overflow: "hidden", border: "1px solid #ddd" }}>
                  <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.1) grayscale(30%) sepia(15%)" }} />
                </div>
              </div>
            )}

            {/* TIMELINE ITEMS */}
            <div style={{ flex: 1, display: "flex", position: "relative" }}>
              <div style={{ width: 4, background: `${textColor}15`, marginRight: p ? 25 : 30, position: "relative" }}>
                <div style={{ position: "absolute", top: 0, width: "100%", height: `${spineH}%`, background: accentColor }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: p ? 30 : 25, width: "100%", justifyContent: 'center' }}>
                {items.map((item, i) => {
                  const start = ITEM_START + i * ITEM_STEP;
                  const itemSpring = spring({ frame: frame - start, fps, config: { stiffness: 100 } });
                  const isLatest = i === items.length - 1;

                  return (
                    <div key={i} style={{ 
                      display: "flex", 
                      alignItems: "flex-start", 
                      gap: 20, 
                      opacity: interpolate(itemSpring, [0, 1], [0, 1]),
                      transform: `translateX(${interpolate(itemSpring, [0, 1], [-20, 0])}px)`
                    }}>
                      <div style={{
                        minWidth: p ? 110 : 100,
                        fontFamily: B_FONT,
                        fontSize: p ? 30 * scale : 26 * scale,
                        fontWeight: 900,
                        color: isLatest ? accentColor : textColor,
                        padding: "4px 8px",
                        border: `2px solid ${isLatest ? accentColor : textColor + '20'}`,
                        textAlign: 'center',
                      }}>
                        {item.value}
                      </div>
                      <div style={{
                        fontFamily: B_FONT,
                        fontSize: descriptionFontSize ?? (p ? 32 * scale : 28 * scale),
                        color: textColor,
                        fontWeight: isLatest ? 700 : 400,
                        maxWidth: "100%",
                        lineHeight: 1.25,
                      }}>
                        {item.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. NARRATION (BOTTOM) */}
          {narration && (
            <div
              style={{
                fontFamily: B_FONT,
                // Calculation: Uses custom descriptionFontSize if provided, otherwise falls back to your defaults, then subtracts 7
                fontSize: ((descriptionFontSize ?? (p ? 48 : 37)) - 7) * scale,
                fontStyle: "italic",
                color: textColor,
                opacity: interpolate(frame, [80, 100], [0, 0.75], {
                  extrapolateLeft: "clamp",
                }),
                marginTop: 30,
                borderTop: `2px solid ${textColor}15`,
                paddingTop: 20,
                lineHeight: 1.4,
                width: p ? "100%" : "60%",
                // Keeps the layout balanced: left-aligned for portrait, right-aligned for landscape
                alignSelf: p ? "flex-start" : "flex-end",
              }}
            >
              "{narration}"
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};