import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring, staticFile } from "remotion";
import { NewsBackground } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const B_FONT = "'Source Sans 3', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export const DataSnapshot: React.FC<BlogLayoutProps> = ({
  title = "By the Numbers",
  narration,
  accentColor = "#FFE34D",
  bgColor = "#FAFAF8",
  textColor = "#111111",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  stats = [
    { value: "800K", label: "Federal workers affected" },
    { value: "47%", label: "Agencies impacted" },
    { value: "32", label: "Days until next deadline" },
    { value: "$6B", label: "Daily economic cost" },
  ],
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height, fps } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const items = stats.slice(0, 4);

  // Resolve description font size once for consistency
  const resolvedDescriptionFontSize = descriptionFontSize ?? (p ? 36 : 22);

  // --- Exit Logic (Modified for left slide transition) ---
  const EXIT_START = durationInFrames - 25;
  const exitSpring = spring({
    frame: frame - EXIT_START,
    fps,
    config: { stiffness: 60, damping: 15 },
  });

  const entranceZoom = interpolate(frame, [0, 40], [0.8, 1], { extrapolateRight: "clamp" });
  // Instead of exitZoom and exitRotateX, we'll use exitTranslateX
  const exitTranslateX = interpolate(exitSpring, [0, 1], [0, -width]); // Scene moves quickly to the left
  const exitOpacity = interpolate(exitSpring, [0.4, 1], [1, 0]);

  // --- Shard Logic (Optimized for Portrait Space) ---
  const shardProgress = interpolate(frame, [0, durationInFrames / 2], [0, 1], { extrapolateRight: "clamp" });
  const shardBreak = interpolate(frame, [durationInFrames * 0.8, durationInFrames], [0, 1], { extrapolateRight: "clamp" });

  // In portrait, we want the shards to overlap slightly more to reduce white space
  const shardWidth = p ? width * 0.7 : width / 2;
  const leftX = -shardWidth * (1 - shardProgress) - 50 * shardBreak;
  const rightX = width + (shardWidth * (1 - shardProgress)) + 50 * shardBreak;

  const titleOp = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const ruleW = interpolate(frame, [4, 20], [0, 100], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: fontFamily ?? B_FONT, backgroundColor: "#000", perspective: "1500px" }}>
      <div style={{
        width: "100%",
        height: "100%",
        transformStyle: "preserve-3d",
        opacity: exitOpacity,
        // Modified transform: uses entranceZoom and exitTranslateX for the exit transition
        transform: `scale(${entranceZoom}) translateX(${exitTranslateX}px)`,
      }}>
        <NewsBackground bgColor={bgColor} />

        <div style={{ position: "absolute", inset: 0, backgroundColor: bgColor, opacity: 0.45, zIndex: 2, pointerEvents: "none" }} />

        {/* Left shard */}
        <img
          src={staticFile("vintage-news.avif")}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: leftX,
            width: shardWidth,
            height: height,
            objectFit: "cover",
            opacity: 0.35,
            filter: "grayscale(75%) contrast(1.08)",
            zIndex: 1,
          }}
        />

        {/* Right shard */}
        <img
          src={staticFile("vintage-news.avif")}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            right: width - rightX, // Corrected right anchor logic
            width: shardWidth,
            height: height,
            objectFit: "cover",
            opacity: 0.35,
            filter: "grayscale(75%) contrast(1.08)",
            zIndex: 1,
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(235, 225, 210, 0.42) 0%, rgba(245, 238, 225, 0.38) 50%, rgba(225, 215, 195, 0.42) 100%)",
            zIndex: 2,
          }}
        />

        {/* Content Container */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            padding: p ? "12% 8%" : "6% 9%",
            gap: p ? 30 : 32,
            zIndex: 3,
            transform: "translateZ(50px)",
          }}
        >
          {/* Header */}
          <div style={{ opacity: titleOp }}>
            <div
              style={{
                fontFamily: fontFamily ?? H_FONT,
                fontSize: titleFontSize ?? (p ? 78 : 69),
                fontWeight: 800,
                color: textColor,
                lineHeight: 1.1,
                marginBottom: 10,
                textTransform: p ? "uppercase" : "none",
                letterSpacing: p ? "-0.02em" : "normal",
              }}
            >
              {title}
            </div>
            <div style={{ height: p ? 4 : 2, background: textColor, opacity: 0.15, width: `${ruleW}%` }} />
          </div>

          {/* Cards Grid / Stack */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: p ? "column" : "row",
              flexWrap: p ? "nowrap" : "wrap",
              gap: p ? 20 : 22,
              alignContent: "flex-start",
            }}
          >
            {items.map((item, i) => {
              const delay = 12 + i * 10;
              const cardOp = interpolate(frame, [delay, delay + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const cardY = interpolate(frame, [delay, delay + 18], [28, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const ulW = interpolate(frame, [delay + 8, delay + 22], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

              return (
                <div
                  key={i}
                  style={{
                    width: p ? "100%" : items.length <= 2 ? "calc(50% - 11px)" : "calc(25% - 17px)",
                    opacity: cardOp,
                    transform: `translateY(${cardY}px) translateZ(${i * 10}px)`,
                    backgroundColor: "rgba(255,255,255,0.85)",
                    border: "1px solid rgba(0,0,0,0.1)",
                    borderRadius: p ? 12 : 8,
                    padding: `${p ? 24 : 20}px ${p ? 28 : 22}px`,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
                  <div style={{ 
                    fontFamily: fontFamily ?? H_FONT, 
                    // Adjusted: Stats font size is now resolvedDescriptionFontSize + 10 for both portrait and landscape
                    fontSize: resolvedDescriptionFontSize + 20,
                    fontWeight: 900, 
                    color: textColor, 
                    lineHeight: 1, 
                    marginBottom: p ? 14 : 10
                  }}>
                    {item.value}
                  </div>

                  <div style={{ height: p ? 6 : 4, background: accentColor, borderRadius: 3, width: `${ulW}%`, marginBottom: p ? 14 : 10 }} />

                  <div style={{ 
                    fontFamily: fontFamily ?? B_FONT, 
                    fontSize: resolvedDescriptionFontSize, // Use resolved value
                    fontWeight: 600, 
                    color: textColor, 
                    opacity: 0.8, 
                    lineHeight: 1.2 
                  }}>
                    {item.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Caption */}
          {narration && (
            <div
              style={{
                fontFamily: fontFamily ?? B_FONT,
                fontSize: resolvedDescriptionFontSize, // Use resolved value
                fontWeight: 500,
                color: textColor,
                opacity: interpolate(frame, [60, 76], [0, 0.7], { extrapolateRight: "clamp" }),
                lineHeight: 1.4,
                paddingTop: p ? 10 : 0,
                borderTop: p ? `1px solid ${textColor}15` : "none",
              }}
            >
              {narration}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
