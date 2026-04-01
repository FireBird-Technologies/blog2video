/**
 * AI-generated intro scene component.
 * This file is overwritten in the render workspace with the actual generated code.
 * The placeholder below is used only if no generated code is available.
 */
import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  AbsoluteFill,
  Sequence,
  Img,
  random,
} from "remotion";
import type { GeneratedSceneProps } from "./types";

const SceneComponent: React.FC<GeneratedSceneProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(
    spring({ frame, fps, config: { damping: 12 } }),
    [0, 1],
    [40, 0]
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: props.brandColors?.background || "#1a1a2e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        padding: 80,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${titleY}px)`,
          color: props.brandColors?.text || "#ffffff",
          fontSize: props.titleFontSize || (props.aspectRatio === "portrait" ? 48 : 72),
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.2,
          maxWidth: "80%",
        }}
      >
        {props.displayText}
      </div>
    </AbsoluteFill>
  );
};

export default SceneComponent;
