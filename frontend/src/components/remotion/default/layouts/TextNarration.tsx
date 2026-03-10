import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from "remotion";
import React from "react";
import { SceneLayoutProps } from "../types";

// A decorative geometric shape to be placed in the corners.
const CornerShape: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const purple = "#6366F1";
  const cyan = "#22D3EE";

  return (
    <div style={{ position: "absolute", ...style }}>
      <svg
        width="500"
        height="500"
        viewBox="0 0 150 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M137.5 73L101 131.5L28.5 110.5L2.5 40.5L50.5 3.5L137.5 73Z"
          stroke={purple}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M147.5 42L112.5 2L42.5 21L8 85.5L46 148L147.5 42Z"
          stroke={cyan}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
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
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const p = aspectRatio === "portrait";

  // Title: spring-driven entrance with slide up
  const titleSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 200, stiffness: 250, mass: 1.2 },
  });
  const titleOp = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [30, 0]);

  // Narration: spring-driven with slight delay
  const textSpring = spring({
    frame: frame - 20,
    fps,
    config: { damping: 200, stiffness: 250 },
  });
  const textOp = interpolate(textSpring, [0, 1], [0, 1]);

  // Corner shapes entrance animation
  const shapeEntranceSpring = spring({
    frame: frame,
    fps,
    config: { damping: 200, stiffness: 150 },
  });
  const entranceShapeScale = interpolate(shapeEntranceSpring, [0, 1], [0.6, 1]);
  const entranceShapeOpacity = interpolate(shapeEntranceSpring, [0, 1], [0, 1]);

  // Corner shapes exit animation: move to center and vanish
  const vanishAnimationDuration = 45; // frames (1.5 seconds at 30fps)
  const vanishStartFrame = durationInFrames - vanishAnimationDuration;

  const shapeExitSpring = spring({
    frame: frame - vanishStartFrame,
    fps,
    config: { damping: 200, stiffness: 150, mass: 0.8 },
    durationInFrames: vanishAnimationDuration,
  });

  const exitShapeScale = interpolate(shapeExitSpring, [0, 1], [1, 0]);
  const exitShapeOpacity = interpolate(shapeExitSpring, [0, 1], [1, 0]);

  // Combined scale and opacity for shapes (entrance * exit)
  const combinedShapeScale = entranceShapeScale * exitShapeScale;
  const combinedShapeOpacity = entranceShapeOpacity * exitShapeOpacity;

  // Text fade out at the end, synchronized with shape exit
  const textFadeOutSpring = spring({
    frame: frame - vanishStartFrame,
    fps,
    config: { damping: 200, stiffness: 150, mass: 0.8 },
    durationInFrames: vanishAnimationDuration,
  });
  const textFadeOutOpacity = interpolate(textFadeOutSpring, [0, 1], [1, 0]);

  const cornerOffset = p ? -100 : -150;
  const shapeSize = 500; // Based on SVG width/height in CornerShape
  const centerScreenX = width / 2;
  const centerScreenY = height / 2;

  // --- Top-Left Shape (no initial scale flips) ---
  const initialCenterX_TL = cornerOffset + shapeSize / 2;
  const initialCenterY_TL = cornerOffset + shapeSize / 2;
  const deltaX_TL = centerScreenX - initialCenterX_TL;
  const deltaY_TL = centerScreenY - initialCenterY_TL;
  const tx_TL = interpolate(shapeExitSpring, [0, 1], [0, deltaX_TL]);
  const ty_TL = interpolate(shapeExitSpring, [0, 1], [0, deltaY_TL]);

  // --- Top-Right Shape (scaleX(-1) applied) ---
  const initialCenterX_TR = width - cornerOffset - shapeSize / 2;
  const initialCenterY_TR = cornerOffset + shapeSize / 2;
  const deltaX_TR = centerScreenX - initialCenterX_TR;
  const deltaY_TR = centerScreenY - initialCenterY_TR;
  // For scaleX(-1), positive translateX moves left in screen space.
  // We want to move it by deltaX_TR, so if deltaX_TR is positive (move right),
  // we need a negative translateX value in its local flipped coord system.
  const tx_TR = interpolate(shapeExitSpring, [0, 1], [0, -deltaX_TR]);
  const ty_TR = interpolate(shapeExitSpring, [0, 1], [0, deltaY_TR]); // Y is not affected by scaleX(-1)

  // --- Bottom-Left Shape (scaleY(-1) applied) ---
  const initialCenterX_BL = cornerOffset + shapeSize / 2;
  const initialCenterY_BL = height - cornerOffset - shapeSize / 2;
  const deltaX_BL = centerScreenX - initialCenterX_BL;
  const deltaY_BL = centerScreenY - initialCenterY_BL;
  // For scaleY(-1), positive translateY moves up in screen space.
  // We want to move it by deltaY_BL, so if deltaY_BL is positive (move down),
  // we need a negative translateY value in its local flipped coord system.
  const tx_BL = interpolate(shapeExitSpring, [0, 1], [0, deltaX_BL]);
  const ty_BL = interpolate(shapeExitSpring, [0, 1], [0, -deltaY_BL]);

  // --- Bottom-Right Shape (scaleX(-1) and scaleY(-1) applied) ---
  const initialCenterX_BR = width - cornerOffset - shapeSize / 2;
  const initialCenterY_BR = height - cornerOffset - shapeSize / 2;
  const deltaX_BR = centerScreenX - initialCenterX_BR;
  const deltaY_BR = centerScreenY - initialCenterY_BR;
  // Both X and Y are flipped.
  const tx_BR = interpolate(shapeExitSpring, [0, 1], [0, -deltaX_BR]);
  const ty_BR = interpolate(shapeExitSpring, [0, 1], [0, -deltaY_BR]);

  // Determine if text is explicitly black or very dark
  const isDarkText = textColor === '#000000' || textColor === '#000' || textColor === 'black';

  // Adjust background color: if text is dark, make background white for prominence.
  // Otherwise, use the provided bgColor.
  const adjustedBgColor = isDarkText ? '#FFFFFF' : bgColor;

  // Adjust narration text opacity: if text is dark, make it fully opaque for prominence.
  // Otherwise, use the original reduced opacity.
  const narrationOpacity = isDarkText ? textOp : textOp * 0.7;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: adjustedBgColor,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <CornerShape
        style={{
          opacity: combinedShapeOpacity,
          top: cornerOffset,
          left: cornerOffset,
          transform: `scale(${combinedShapeScale}) translateX(${tx_TL}px) translateY(${ty_TL}px)`,
        }}
      />
      <CornerShape
        style={{
          opacity: combinedShapeOpacity,
          top: cornerOffset,
          right: cornerOffset,
          transform: `scale(${combinedShapeScale}) scaleX(-1) translateX(${tx_TR}px) translateY(${ty_TR}px)`,
        }}
      />
      <CornerShape
        style={{
          opacity: combinedShapeOpacity,
          bottom: cornerOffset,
          left: cornerOffset,
          transform: `scale(${combinedShapeScale}) scaleY(-1) translateX(${tx_BL}px) translateY(${ty_BL}px)`,
        }}
      />
      <CornerShape
        style={{
          opacity: combinedShapeOpacity,
          bottom: cornerOffset,
          right: cornerOffset,
          transform: `scale(${combinedShapeScale}) scaleX(-1) scaleY(-1) translateX(${tx_BR}px) translateY(${ty_BR}px)`,
        }}
      />

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
            opacity: titleOp * textFadeOutOpacity,
            transform: `translateY(${titleY}px)`,
            margin: 0,
            marginBottom: 32,
            fontFamily: "Inter, sans-serif",
            lineHeight: 1.1,
            whiteSpace: "pre-wrap",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            color: textColor,
            fontSize: descriptionFontSize ?? (p ? 52 : 47),
            lineHeight: 1.5,
            opacity: narrationOpacity * textFadeOutOpacity, // Apply textFadeOutOpacity here
            maxWidth: "45ch",
            margin: "0 auto",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {narration}
        </p>
      </div>
    </AbsoluteFill>
  );
};
