import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from "remotion";
import { SceneLayoutProps } from "../types";
import { AnimatedImage } from "./AnimatedImage";

export const HeroImage: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    imageUrl,
    accentColor,
    bgColor,
    textColor,
    aspectRatio,
    titleFontSize,
    descriptionFontSize,
  } = props;

  const frame = useCurrentFrame();
  const fps = 30;
  const { durationInFrames, width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";
  const hasImage = !!imageUrl;

  // --- ENTRANCE ANIMATIONS ---
  const contentEntranceDelay = 10;
  const contentSpringVal = spring({
    frame: frame - contentEntranceDelay,
    fps,
    config: { damping: 40, stiffness: 80, mass: 1 },
  });
  const contentOpacity = interpolate(contentSpringVal, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });
  const contentScale = interpolate(contentSpringVal, [0, 1], [0.98, 1], {
    extrapolateRight: "clamp",
  });

  // --- PLANE MOTION LOGIC ---
  // We use sine and cosine to create a circular/elliptical path
  const radiusX = isPortrait ? width * 0.45 : width * 0.24;
  const radiusY = isPortrait ? height * 0.25 : height * 0.32;
  const speed = frame * 0.05; // Adjust speed here

  const planeX = Math.cos(speed) * radiusX;
  const planeY = Math.sin(speed) * radiusY;
  
  // Calculate rotation so the plane "steers" into the curve
  const angle = (Math.atan2(Math.cos(speed), -Math.sin(speed)) * 180) / Math.PI;

  // --- VANISH / EXIT ANIMATIONS ---
  const vanishDurationFrames = 30;
  const vanishStartFrame = durationInFrames - vanishDurationFrames;
  const vanishSpringVal = spring({
    frame: frame - vanishStartFrame,
    fps,
    config: { damping: 40, stiffness: 80, mass: 1 },
  });

  // The Plane flies "out" of the screen (scales up significantly)
  const planeExitScale = interpolate(vanishSpringVal, [0, 1], [1, 15], {
    extrapolateRight: "clamp",
  });
  const planeExitOpacity = interpolate(vanishSpringVal, [0.8, 1], [1, 0]);

  // Layout Vanish logic
  const imageHalfTranslate = hasImage
    ? interpolate(vanishSpringVal, [0, 1], [0, isPortrait ? -height : -width])
    : 0;
  const contentHalfTranslate = hasImage
    ? interpolate(vanishSpringVal, [0, 1], [0, isPortrait ? height : width])
    : 0;
  const vanishItemOpacity = interpolate(vanishSpringVal, [0, 1], [1, 0]);
  const vanishItemScale = interpolate(vanishSpringVal, [0, 1], [1, 0.8]);

  // Title Vanish (Zoom in)
  const titleVanishStart = durationInFrames - 20;
  const titleVanishSpring = spring({
    frame: frame - titleVanishStart,
    fps,
    config: { damping: 10, stiffness: 100, mass: 0.5 },
  });
  const titleVanishScale = interpolate(titleVanishSpring, [0, 1], [1, 10], {
    extrapolateRight: "clamp",
  });
  const titleVanishOpacity = interpolate(titleVanishSpring, [0, 1], [1, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor || "#F0F0F0",
        display: "flex",
        flexDirection: hasImage ? (isPortrait ? "column" : "row") : "column",
        overflow: "hidden",
      }}
    >
      {/* IMAGE SECTION */}
      {hasImage && (
        <div
          style={{
            flex: 1,
            position: "relative",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            transform: `${
              isPortrait
                ? `translateY(${imageHalfTranslate}px)`
                : `translateX(${imageHalfTranslate}px)`
            } scale(${contentScale})`,
            opacity: contentOpacity,
          }}
        >
          <AbsoluteFill
            style={{
              transform: `scale(${
                interpolate(
                  spring({ frame, fps, config: { damping: 200 } }),
                  [0, 1],
                  [1.1, 1]
                ) * vanishItemScale
              })`,
              opacity: vanishItemOpacity,
            }}
          >
            <AnimatedImage
              src={imageUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </AbsoluteFill>
        </div>
      )}

      {/* CONTENT SECTION */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "80px",
          position: "relative",
          transform: `${
            isPortrait
              ? `translateY(${contentHalfTranslate}px)`
              : `translateX(${contentHalfTranslate}px)`
          } scale(${contentScale * (!hasImage ? vanishItemScale : 1)})`,
          opacity: contentOpacity * (!hasImage ? vanishItemOpacity : 1),
        }}
      >
        {/* --- THE MOVING PLANE --- */}
        <div
          style={{
            position: "absolute",
            zIndex: 100,
            transform: `translate(${planeX}px, ${planeY}px) rotate(${angle}deg) scale(${planeExitScale})`,
            opacity: planeExitOpacity,
            filter: "drop-shadow(0 10px 10px rgba(0,0,0,0.2))",
          }}
        >
          <svg
            width="60"
            height="60"
            viewBox="0 0 24 24"
            fill={accentColor || "#000"}
            style={{ transform: "rotate(90deg)" }} // Adjust based on SVG orientation
          >
            <path d="M21,16L21,14L13,9L13,3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z" />
          </svg>
        </div>

        <div style={{ textAlign: "center", maxWidth: "90%", zIndex: 10 }}>
          <h1
            style={{
              fontFamily: "'Roboto Slab', serif",
              fontSize: titleFontSize ?? 76,
              fontWeight: 800,
              lineHeight: 1.1,
              color: textColor || "black",
              margin: 0,
              textTransform: "uppercase",
              transform: `scale(${hasImage ? titleVanishScale : 1})`,
              opacity: hasImage ? titleVanishOpacity : 1,
            }}
          >
            {title}
          </h1>

          <div
            style={{
              height: 5,
              width: interpolate(
                spring({ frame: frame - (contentEntranceDelay + 10), fps }),
                [0, 1],
                [0, 250]
              ),
              backgroundColor: accentColor || textColor || "black",
              margin: "20px auto",
              borderRadius: 2,
              transform: `scale(${hasImage ? vanishItemScale : 1})`,
              opacity: hasImage ? vanishItemOpacity : 1,
            }}
          />

          {narration && (
            <p
              style={{
                fontFamily: "'Roboto Slab', serif",
                fontSize: descriptionFontSize ?? 40,
                fontWeight: 400,
                lineHeight: 1.4,
                color: textColor || "black",
                margin: "30px auto 0 auto",
                maxWidth: "40ch",
                transform: `scale(${hasImage ? vanishItemScale : 1})`,
                opacity: hasImage ? vanishItemOpacity : 1,
              }}
            >
              {narration}
            </p>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};