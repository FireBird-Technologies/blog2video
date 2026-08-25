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
import { AnimatedVideo } from "./AnimatedVideo";
import { useFitText } from "../components/useFitText";

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
    titleFontSizeIsUserSet,
    descriptionFontSizeIsUserSet,imageUrl,
  imageObjectPosition,
  imageZoom,
    videoUrl,
    videoMuted,
    videoVolume,
    videoDurationInFrames,
    videoStartInFrames,
    fontFamily,
  } = props;

  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const p = aspectRatio === "portrait" || height > width;

  /* ── Auto-fit ──────────────────────────────────────────────
     Title and timeline-item copy are unbounded user input; the right-side
     content column is a real `flex:1.5` sibling of a fixed-height row, so its
     clientHeight is a genuine leftover-space budget, but the title has a
     fixed marginBottom and the items list has no height limit of its own —
     long copy just grows past the frame and is clipped by the AbsoluteFill's
     overflow:hidden. Title fits against its own fixed budget; the items
     block (every item shares one descriptionFontSize, so they must shrink
     together) fits against the real leftover flex space. A size the user
     explicitly picked is honored exactly (minPx === targetPx no-ops).

     No give-back cross-talk between the two: a useLayoutEffect+setState
     chain reacting to another useFitText's overflow output creates a
     multi-render convergence that Remotion's per-frame headless capture can
     settle at different points on different frames (confirmed via a real
     render — frame-to-frame scene-change score hit 1.0, i.e. maximum, twice
     in the first ten frames, in the equivalent newscast/newspaper opening
     scenes). */
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const itemsRef = React.useRef<HTMLDivElement>(null);

  const actualTitleFontSize = titleFontSize ?? (p ? 85 : 74);
  const actualDescriptionFontSize = descriptionFontSize ?? (p ? 40 : 30);

  const titleBudgetPx = Math.round(height * (p ? 0.16 : 0.2));

  const { px: titlePx } = useFitText(
    titleRef,
    actualTitleFontSize,
    titleFontSizeIsUserSet ? actualTitleFontSize : p ? 34 : 30,
    [title, actualTitleFontSize, titleFontSizeIsUserSet, titleBudgetPx, p],
    titleBudgetPx,
  );

  const { px: itemFontSize } = useFitText(
    itemsRef,
    actualDescriptionFontSize,
    descriptionFontSizeIsUserSet ? actualDescriptionFontSize : p ? 18 : 15,
    [timelineItems, actualDescriptionFontSize, descriptionFontSizeIsUserSet, titlePx, p],
  );

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
        fontFamily: fontFamily ?? "'Roboto Slab', serif",
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
        {(imageUrl || videoUrl) && (
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
            {videoUrl ? (
              <AnimatedVideo
                src={videoUrl}
                muted={videoMuted ?? true}
                volume={videoVolume ?? 0.35}
                durationInFrames={videoDurationInFrames}
                startInFrames={videoStartInFrames}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
                  objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
                  display: "block",
                  transform: `scale(${(imageZoom ?? 1) * interpolate(entranceSpring, [0, 1], [1.1, 1])})`,
                  transformOrigin: (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
                }}
              />
            ) : (
              <Img
                src={imageUrl!}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
                  objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
                  display: "block", // BUG FIX: Removes baseline whitespace
                  transform: `scale(${(imageZoom ?? 1) * interpolate(entranceSpring, [0, 1], [1.1, 1])})`,
                  transformOrigin: (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
                }}
              />
            )}
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
            ref={titleRef}
            style={{
              fontSize: titlePx,
              fontWeight: 900,
              color: textColor || "#fff",
              marginBottom: 40,
              textAlign: p ? "center" : "left",
              lineHeight: 1.1,
              flexShrink: 0,
            }}
          >
            {title}
          </h2>

          <div ref={itemsRef} style={{ display: "flex", flexDirection: "row", gap: 60, flex: "0 1 auto", minHeight: 0, overflow: "hidden" }}>
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
                        <h3 style={{ fontSize: itemFontSize, fontWeight: 700, color: accentColor, margin: "0 0 4px 0" }}>
                          {item.label}
                        </h3>
                        <p style={{ fontSize: itemFontSize, color: textColor, opacity: 0.7, margin: 0, lineHeight: 1.3 }}>
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
