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

// Decorative corner shape
const CornerShape: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const purple = "#6366F1";
  const cyan = "#22D3EE";

  return (
    <div style={{ position: "absolute", ...style }}>
      <svg width="500" height="500" viewBox="0 0 150 150" fill="none">
        <path
          d="M137.5 73L101 131.5L28.5 110.5L2.5 40.5L50.5 3.5L137.5 73Z"
          stroke={purple}
          strokeWidth="3"
        />
        <path
          d="M147.5 42L112.5 2L42.5 21L8 85.5L46 148L147.5 42Z"
          stroke={cyan}
          strokeWidth="3"
        />
      </svg>
    </div>
  );
};

export const TextNarration: React.FC<SceneLayoutProps> = ({
  title,
  narration,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
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

  /* ---------------- Corner Shapes ---------------- */

  const shapeEntranceSpring = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 150 },
  });

  const entranceShapeScale = interpolate(shapeEntranceSpring, [0, 1], [0.6, 1]);
  const entranceShapeOpacity = interpolate(shapeEntranceSpring, [0, 1], [0, 1]);

  const vanishAnimationDuration = 45;
  const vanishStartFrame = durationInFrames - vanishAnimationDuration;

  const shapeExitSpring = spring({
    frame: frame - vanishStartFrame,
    fps,
    config: { damping: 200, stiffness: 150, mass: 0.8 },
    durationInFrames: vanishAnimationDuration,
  });

  const exitShapeScale = interpolate(shapeExitSpring, [0, 1], [1, 0]);
  const exitShapeOpacity = interpolate(shapeExitSpring, [0, 1], [1, 0]);

  const combinedShapeScale = entranceShapeScale * exitShapeScale;
  const combinedShapeOpacity = entranceShapeOpacity * exitShapeOpacity;

  /* ---------------- Character Blow Away Animation ---------------- */

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

  const animatedChars = React.useMemo(() => {
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

  /* ---------------- Corner Positions ---------------- */

  const cornerOffset = p ? -100 : -150;
  const shapeSize = 500;

  const centerScreenX = width / 2;
  const centerScreenY = height / 2;

  const initialCenterX = cornerOffset + shapeSize / 2;
  const initialCenterY = cornerOffset + shapeSize / 2;

  const deltaX = centerScreenX - initialCenterX;
  const deltaY = centerScreenY - initialCenterY;

  const tx = interpolate(shapeExitSpring, [0, 1], [0, deltaX]);
  const ty = interpolate(shapeExitSpring, [0, 1], [0, deltaY]);

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
      {/* Top Left */}
      <CornerShape
        style={{
          opacity: combinedShapeOpacity,
          top: cornerOffset,
          left: cornerOffset,
          transform: `scale(${combinedShapeScale}) translate(${tx}px, ${ty}px)`,
        }}
      />

      {/* Top Right */}
      <CornerShape
        style={{
          opacity: combinedShapeOpacity,
          top: cornerOffset,
          right: cornerOffset,
          transform: `scale(${combinedShapeScale}) scaleX(-1) translate(${tx}px, ${ty}px)`,
        }}
      />

      {/* Bottom Left */}
      <CornerShape
        style={{
          opacity: combinedShapeOpacity,
          bottom: cornerOffset,
          left: cornerOffset,
          transform: `scale(${combinedShapeScale}) scaleY(-1) translate(${tx}px, ${ty}px)`,
        }}
      />

      {/* Bottom Right */}
      <CornerShape
        style={{
          opacity: combinedShapeOpacity,
          bottom: cornerOffset,
          right: cornerOffset,
          transform: `scale(${combinedShapeScale}) scaleX(-1) scaleY(-1) translate(${tx}px, ${ty}px)`,
        }}
      />

      {/* Text */}

      <div
        style={{
          textAlign: "center",
          maxWidth: p ? "90%" : "75%",
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