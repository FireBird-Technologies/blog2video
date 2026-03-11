import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
  Img,
} from "remotion";
import { SceneLayoutProps } from "../types";

export const Timeline: React.FC<SceneLayoutProps & { imageUrl?: string }> = (props) => {
  const {
    title,
    accentColor,
    bgColor,
    textColor,
    timelineItems = [],
    aspectRatio,
    titleFontSize,
    descriptionFontSize,
    imageUrl,
  } = props;

  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const p = aspectRatio === "portrait" || height > width;

  // --- ENTRANCE ANIMATIONS ---
  const entranceSpring = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 60 },
  });

  const sectionOpacity = interpolate(entranceSpring, [0, 1], [0, 1]);
  const slideIn = interpolate(entranceSpring, [0, 1], [100, 0]);

  // --- EXIT (VANISH) ANIMATIONS ---
  const vanishDuration = 20;
  const vanishStart = durationInFrames - vanishDuration;
  const vanishSpring = spring({
    frame: frame - vanishStart,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const vanishOpacity = interpolate(vanishSpring, [0, 1], [1, 0]);
  const vanishScale = interpolate(vanishSpring, [0, 1], [1, 0.95]);

  const numColumns = timelineItems.length > 4 && !p ? 2 : 1;
  const columnItems = Array.from({ length: numColumns }, (_, i) =>
    timelineItems.filter((_, idx) => idx % numColumns === i)
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor || "#0a0a0a",
        fontFamily: "'Roboto Slab', serif",
        overflow: "hidden",
        opacity: vanishOpacity,
        transform: `scale(${vanishScale})`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: p ? "column" : "row",
          width: "100%",
          height: "100%",
        }}
      >
        {/* --- LEFT SIDE: STICKY IMAGE --- */}
        {imageUrl && (
          <div
            style={{
              flex: p ? "0.6" : "1",
              position: "relative",
              overflow: "hidden",
              opacity: sectionOpacity,
              transform: p ? `translateY(-${slideIn}px)` : `translateX(-${slideIn}px)`,
              // BUG FIX: Negative margin to overlap the containers by 1px
              marginRight: p ? 0 : -1,
              marginBottom: p ? -1 : 0,
              zIndex: 2, // Ensure image/gradient sits above any content-side bleed
            }}
          >
            <Img
              src={imageUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block", // BUG FIX: Removes baseline whitespace
                transform: `scale(${interpolate(entranceSpring, [0, 1], [1.1, 1])})`,
              }}
            />
            {/* Gradient Overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: p
                  ? `linear-gradient(to bottom, transparent 40%, ${bgColor} 100%)`
                  : `linear-gradient(to right, transparent 40%, ${bgColor} 100%)`,
              }}
            />
          </div>
        )}

        {/* --- RIGHT SIDE: TIMELINE CONTENT --- */}
        <div
          style={{
            flex: 1.5,
            padding: p ? "40px 30px" : "60px 80px",
            display: "flex",
            flexDirection: "column",
            backgroundColor: bgColor, // Explicitly match BG to fill any gaps
            opacity: sectionOpacity,
            transform: p ? `translateY(${slideIn}px)` : `translateX(${slideIn}px)`,
            zIndex: 1,
          }}
        >
          <h2
            style={{
              fontSize: titleFontSize ?? (p ? 85 : 74),
              fontWeight: 900,
              color: textColor || "#fff",
              marginBottom: 40,
              textAlign: p ? "center" : "left",
              lineHeight: 1.1,
            }}
          >
            {title}
          </h2>

          <div style={{ display: "flex", flexDirection: "row", gap: 60, flex: 1 }}>
            {columnItems.map((col, colIndex) => (
              <div
                key={colIndex}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  paddingLeft: 35,
                  flex: 1,
                }}
              >
                {/* Track Line */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 10,
                    bottom: 0,
                    width: 2,
                    background: `linear-gradient(to bottom, ${accentColor}, transparent)`,
                    opacity: 0.4,
                  }}
                />

                {col.map((item, i) => {
                  const overallIndex = colIndex * col.length + i;
                  const itemDelay = 10 + overallIndex * 5;
                  const itemSpring = spring({ frame: frame - itemDelay, fps, config: { damping: 12 } });

                  return (
                    <div
                      key={i}
                      style={{
                        position: "relative",
                        marginBottom: 30,
                        opacity: itemSpring,
                        transform: `translateY(${interpolate(itemSpring, [0, 1], [10, 0])}px)`,
                      }}
                    >
                      {/* Animated Dot */}
                      <div
                        style={{
                          position: "absolute",
                          left: -41,
                          top: 8,
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          backgroundColor: accentColor,
                          boxShadow: `0 0 10px ${accentColor}`,
                          transform: `scale(${itemSpring})`,
                        }}
                      />

                      <div
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.03)",
                          padding: "12px 18px",
                          borderRadius: 12,
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                        }}
                      >
                        <h3 style={{ fontSize: descriptionFontSize ?? (p ? 40 : 30), fontWeight: 700, color: accentColor, margin: "0 0 4px 0" }}>
                          {item.label}
                        </h3>
                        <p style={{ fontSize: descriptionFontSize ?? (p ? 40 : 30), color: textColor, opacity: 0.7, margin: 0, lineHeight: 1.3 }}>
                          {item.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};