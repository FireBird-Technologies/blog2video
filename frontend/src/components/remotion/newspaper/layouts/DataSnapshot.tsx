import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { NewsBackground } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "Georgia, 'Times New Roman', serif";
const B_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

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
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height, fps } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const items = stats.slice(0, 4);

  // --- 3D Camera & Exit Logic ---
  const EXIT_START = durationInFrames - 25;
  const exitSpring = spring({
    frame: frame - EXIT_START,
    fps,
    config: { stiffness: 60, damping: 15 },
  });

  // Entrance: Zoom in from far away
  const entranceZoom = interpolate(frame, [0, 40], [0.8, 1], { extrapolateRight: "clamp" });
  // Exit: Tilt back and shrink
  const exitZoom = interpolate(exitSpring, [0, 1], [1, 0.85]);
  const exitRotateX = interpolate(exitSpring, [0, 1], [0, 12]);
  const exitOpacity = interpolate(exitSpring, [0.4, 1], [1, 0]);

  // Combined scale for the wrapper
  const currentScale = entranceZoom * exitZoom;

  // --- Shard Logic (Intact) ---
  const shardProgress = interpolate(frame, [0, durationInFrames / 2], [0, 1], { extrapolateRight: "clamp" });
  const shardBreak = interpolate(frame, [durationInFrames * 0.8, durationInFrames], [0, 1], { extrapolateRight: "clamp" });

  const leftX = -width / 2 * (1 - shardProgress) - 50 * shardBreak;
  const rightX = width / 2 + width / 2 * (1 - shardProgress) + 50 * shardBreak;

  // Header/Text Animations
  const titleOp = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const ruleW = interpolate(frame, [4, 20], [0, 100], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: B_FONT, backgroundColor: "#000", perspective: "1500px" }}>
      {/* 3D Camera Wrapper */}
      <div style={{
        width: "100%",
        height: "100%",
        transformStyle: "preserve-3d",
        opacity: exitOpacity,
        transform: `scale(${currentScale}) rotateX(${exitRotateX}deg)`,
      }}>
        <NewsBackground bgColor={bgColor} />

        {/* Left shard */}
        <img
          src="/vintage-news.avif"
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: leftX,
            width: width / 2,
            height: height,
            objectFit: "cover",
            opacity: 0.35,
            filter: "grayscale(75%) contrast(1.08)",
            zIndex: 1,
          }}
        />

        {/* Right shard (using your existing anchor logic) */}
        <img
          src="/vintage-news.avif"
          alt=""
          style={{
            position: "absolute",
            top: 0,
            right: rightX,
            width: width / 2,
            height: height,
            objectFit: "cover",
            opacity: 0.35,
            filter: "grayscale(75%) contrast(1.08)",
            zIndex: 1,
          }}
        />

        {/* Gradient overlay */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, rgba(235, 225, 210, 0.42) 0%, rgba(245, 238, 225, 0.38) 50%, rgba(225, 215, 195, 0.42) 100%)",
            pointerEvents: "none",
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
            padding: p ? "7% 6%" : "6% 9%",
            gap: p ? 24 : 32,
            zIndex: 3,
            transform: "translateZ(50px)", // Adds depth to the cards
          }}
        >
          {/* Header */}
          <div style={{ opacity: titleOp }}>
            <div
              style={{
                fontFamily: H_FONT,
                fontSize: titleFontSize ?? (p ? 42 : 54),
                fontWeight: 800,
                color: textColor,
                lineHeight: 1.1,
                marginBottom: 10,
              }}
            >
              {title}
            </div>
            <div style={{ height: 2, background: textColor, opacity: 0.12, width: `${ruleW}%` }} />
          </div>

          {/* Cards Grid */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexWrap: "wrap",
              gap: p ? 16 : 22,
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
                    width: p ? "calc(50% - 8px)" : items.length <= 2 ? "calc(50% - 11px)" : "calc(25% - 17px)",
                    opacity: cardOp,
                    transform: `translateY(${cardY}px) translateZ(${i * 10}px)`, // Staggered depth
                    backgroundColor: "rgba(255,255,255,0.7)",
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: 8,
                    padding: p ? "16px 18px" : "20px 22px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                >
                  <div style={{ fontFamily: H_FONT, fontSize: p ? 46 : 58, fontWeight: 800, color: textColor, lineHeight: 1, marginBottom: 10 }}>
                    {item.value}
                  </div>

                  <div style={{ height: 4, background: accentColor, borderRadius: 2, width: `${ulW}%`, marginBottom: 10 }} />

                  <div style={{ fontFamily: B_FONT, fontSize: descriptionFontSize ?? (p ? 15 : 17), fontWeight: 500, color: textColor, opacity: 0.75, lineHeight: 1.3 }}>
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
                fontFamily: B_FONT,
                fontSize: descriptionFontSize ?? (p ? 15 : 17),
                fontWeight: 500,
                color: textColor,
                opacity: interpolate(frame, [60, 76], [0, 0.6], { extrapolateRight: "clamp" }),
                lineHeight: 1.4,
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