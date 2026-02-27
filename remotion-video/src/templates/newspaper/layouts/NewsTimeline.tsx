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
  const { durationInFrames, fps } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const items = stats.slice(0, 5);

  // --- 1. Camera & Continuous Zoom ---
  // Initial straighten: 0 to 75 frames
  const cameraRotateX = interpolate(frame, [0, 75], [12, 0], { extrapolateRight: "clamp" });
  const cameraRotateY = interpolate(frame, [0, 75], [-18, 0], { extrapolateRight: "clamp" });

  // Multi-stage Zoom: Quick zoom in (0-30), then a very slow zoom out until the end
  const cameraScale = interpolate(
    frame,
    [0, 30, durationInFrames],
    [1.1, 1.25, 0.95], 
    { extrapolateRight: "clamp" }
  );

  const bgZoom = interpolate(frame, [0, durationInFrames], [1, 1.1], {
    extrapolateRight: "clamp",
  });

  // --- 2. Exit Animation (The Fold & Vanish) ---
  const EXIT_START = durationInFrames - 25;
  const flipProgress = spring({
    frame: frame - EXIT_START,
    fps,
    config: { stiffness: 40, damping: 12 },
  });

  // Motion Blur logic: Blur increases as the flip reaches the midpoint
  const motionBlur = interpolate(flipProgress, [0, 0.5, 1], [0, 15, 0]);
  const exitRotateY = interpolate(flipProgress, [0, 1], [0, -100]);
  const exitTranslateX = interpolate(flipProgress, [0, 1], [0, -1200]);
  const exitOpacity = interpolate(flipProgress, [0.4, 0.9], [1, 0], { extrapolateLeft: "clamp" });

  // --- 3. Internal Content Timings ---
  const titleOp = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const ruleW = interpolate(frame, [4, 20], [0, 100], { extrapolateRight: "clamp" });
  const spineH = interpolate(frame, [12, 12 + items.length * 14 + 10], [0, 100], { extrapolateRight: "clamp" });
  const ITEM_START = 18;
  const ITEM_STEP = 14;

  const imageSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 12 },
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000", perspective: "2000px" }}>
      {/* 3D Camera & Exit Wrapper */}
      <div
        style={{
          width: "100%",
          height: "100%",
          transformOrigin: "left center",
          transform: `
            translateX(${exitTranslateX}px) 
            rotateY(${exitRotateY}deg) 
            scale(${cameraScale}) 
            rotateX(${cameraRotateX}deg) 
            rotateY(${cameraRotateY}deg)
          `,
          filter: `blur(${motionBlur}px)`,
          opacity: exitOpacity,
          transformStyle: "preserve-3d",
        }}
      >
        <NewsBackground bgColor={bgColor} />

        {/* Vintage texture */}
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

        {/* Newspaper Cutout Image */}
        {imageUrl && (
          <div
            style={{
              position: "absolute",
              bottom: p ? "15%" : "20%",
              right: p ? "5%" : "8%",
              width: p ? 300 : 480,
              height: p ? 240 : 340,
              background: "#fff",
              padding: "12px 12px 40px 12px",
              boxShadow: "10px 15px 30px rgba(0,0,0,0.4), inset 0 0 10px rgba(0,0,0,0.05)",
              transform: `rotate(${interpolate(imageSpring, [0, 1], [5, -6])}deg) scale(${imageSpring}) translateZ(50px)`,
              opacity: imageSpring,
              zIndex: 10,
              clipPath: "polygon(2% 0%, 98% 1%, 100% 98%, 95% 100%, 50% 98%, 2% 100%, 0% 50%)",
            }}
          >
            <div style={{ width: "100%", height: "100%", overflow: "hidden", border: "1px solid #ddd" }}>
              <Img
                src={imageUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: "contrast(1.1) grayscale(30%)",
                }}
              />
            </div>
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(#000 1px, transparent 0)',
              backgroundSize: '4px 4px',
              opacity: 0.03,
              pointerEvents: 'none'
            }} />
          </div>
        )}

        {/* Content Layer */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            padding: p ? "8% 6%" : "6% 10%",
            zIndex: 2,
            transform: "translateZ(20px)",
          }}
        >
          {/* Header */}
          <div style={{ opacity: titleOp, marginBottom: p ? 30 : 50 }}>
            <h1
              style={{
                fontFamily: H_FONT,
                fontSize: titleFontSize ?? (p ? 50 : 72),
                fontWeight: 900,
                color: textColor,
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "-0.02em",
              }}
            >
              {title}
            </h1>
            <div style={{ height: 4, background: textColor, width: `${ruleW}%`, marginTop: 10 }} />
          </div>

          {/* Timeline Container */}
          <div style={{ flex: 1, display: "flex", position: "relative" }}>
            <div
              style={{
                width: 3,
                background: `${textColor}15`,
                marginRight: p ? 25 : 40,
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  width: "100%",
                  height: `${spineH}%`,
                  background: accentColor,
                  boxShadow: `0 0 10px ${accentColor}66`,
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: p ? 20 : 30 }}>
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
                      minWidth: p ? 80 : 110,
                      fontFamily: B_FONT,
                      fontSize: 18,
                      fontWeight: 900,
                      color: isLatest ? accentColor : textColor,
                      padding: "4px 8px",
                      border: `1px solid ${isLatest ? accentColor : 'transparent'}`,
                      textAlign: 'center'
                    }}>
                      {item.value}
                    </div>
                    <div style={{
                      fontFamily: B_FONT,
                      fontSize: descriptionFontSize ?? (p ? 20 : 28),
                      color: textColor,
                      fontWeight: isLatest ? 700 : 400,
                      maxWidth: "60%",
                      lineHeight: 1.3,
                    }}>
                      {item.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Narration/Footer */}
          {narration && (
            <div
              style={{
                fontFamily: B_FONT,
                fontSize: 20,
                fontStyle: "italic",
                color: textColor,
                opacity: interpolate(frame, [80, 100], [0, 0.7], { extrapolateLeft: "clamp" }),
                marginTop: 20,
                borderTop: `1px solid ${textColor}22`,
                paddingTop: 15
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