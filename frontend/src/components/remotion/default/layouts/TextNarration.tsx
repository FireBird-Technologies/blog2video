import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
  random,
} from "remotion";
import React from "react";
import { SceneLayoutProps } from "../types";
import { GeometricBackground } from "../components/GeometricBackground";

export const TextNarration: React.FC<SceneLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const p = aspectRatio === "portrait";

  /* ---------------- Title Animation ---------------- */

  const titleSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 200, stiffness: 250, mass: 1.2 },
  });

  const titleOp = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [30, 0]);

  /* ---------------- Narration Entrance ---------------- */

  const textSpring = spring({
    frame: frame - 20,
    fps,
    config: { damping: 200, stiffness: 250 },
  });

  const textOp = interpolate(textSpring, [0, 1], [0, 1]);

  /* ---------------- Character Blow Away Animation ---------------- */

  const vanishAnimationDuration = 45;
  const vanishStartFrame = durationInFrames - vanishAnimationDuration;
  const maxCharFadeOutDelay = 15;
  const charBlowAwayDuration = vanishAnimationDuration + maxCharFadeOutDelay;

  const charFadeOutSpring = spring({
    frame: frame - vanishStartFrame,
    fps,
    config: { damping: 200, stiffness: 150 },
    durationInFrames: charBlowAwayDuration,
  });

  /* ---------------- Character Preparation ---------------- */

  interface AnimatedChar {
    id: string;
    char: string;
    offsetX: number;
    offsetY: number;
    rotate: number;
    delay: number;
  }

  const animatedChars = React.useMemo<AnimatedChar[]>(() => {
    return narration.split("").map((char, i) => ({
      id: `char-${i}`,
      char,
      offsetX: random(`x-${i}`) * 200 - 100,
      offsetY: random(`y-${i}`) * 200 - 100,
      rotate: random(`r-${i}`) * 720 - 360,
      delay: random(`d-${i}`) * maxCharFadeOutDelay,
    }));
  }, [narration]);

  /* ---------------- Background Handling ---------------- */

  const isDarkText =
    textColor === "#000000" || textColor === "#000" || textColor === "black";

  const adjustedBgColor = isDarkText ? "#FFFFFF" : bgColor;
  const narrationSteadyOpacity = isDarkText ? textOp : textOp * 0.7;

  /* ---------------- Render ---------------- */

  return (
    <AbsoluteFill
      style={{
        backgroundColor: adjustedBgColor,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Geometric SVG background (replaces old static CornerShape polygons) */}
      <GeometricBackground
        accentColor={accentColor || "#6366F1"}
        frame={frame}
      />

      {/* Text */}
      <div
        style={{
          textAlign: "center",
          maxWidth: p ? "90%" : "75%",
          position: "relative",
          zIndex: 1,
        }}
      >
        <h1
          style={{
            color: textColor,
            fontSize: titleFontSize ?? (p ? 102 : 84),
            fontWeight: 800,
            opacity: titleOp * interpolate(charFadeOutSpring, [0, 1], [1, 0]),
            transform: `translateY(${titleY}px)`,
            marginBottom: 32,
            fontFamily: fontFamily ?? "'Roboto Slab', serif",
          }}
        >
          {title}
        </h1>

        <p
          style={{
            color: textColor,
            fontSize: descriptionFontSize ?? (p ? 52 : 47),
            lineHeight: 1.5,
            maxWidth: "45ch",
            margin: "0 auto",
            fontFamily: fontFamily ?? "'Roboto Slab', serif",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {animatedChars.map((c, i) => {
            const charOpacity = interpolate(
              charFadeOutSpring,
              [c.delay / charBlowAwayDuration, 1 + c.delay / charBlowAwayDuration],
              [narrationSteadyOpacity, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            const charTranslateX = interpolate(
              charFadeOutSpring,
              [c.delay / charBlowAwayDuration, 1 + c.delay / charBlowAwayDuration],
              [0, c.offsetX],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            const charTranslateY = interpolate(
              charFadeOutSpring,
              [c.delay / charBlowAwayDuration, 1 + c.delay / charBlowAwayDuration],
              [0, c.offsetY],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            const charRotate = interpolate(
              charFadeOutSpring,
              [c.delay / charBlowAwayDuration, 1 + c.delay / charBlowAwayDuration],
              [0, c.rotate],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            return (
              <span
                key={c.id}
                style={{
                  display: "inline-block",
                  opacity: charOpacity,
                  transform: `translateX(${charTranslateX}px) translateY(${charTranslateY}px) rotate(${charRotate}deg)`,
                  whiteSpace: "pre",
                }}
              >
                {c.char}
              </span>
            );
          })}
        </p>
      </div>
    </AbsoluteFill>
  );
};
