/**
 * AI-generated content scene component.
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
  const slideUp = interpolate(
    spring({ frame, fps, config: { damping: 12 } }),
    [0, 1],
    [30, 0]
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: props.brandColors?.background || "#ffffff",
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
          transform: `translateY(${slideUp}px)`,
          color: props.brandColors?.text || "#1a1a2e",
          fontSize: props.titleFontSize || (props.aspectRatio === "portrait" ? 36 : 48),
          fontWeight: 600,
          textAlign: "center",
          lineHeight: 1.3,
          maxWidth: "80%",
        }}
      >
        {props.displayText}
      </div>
    </AbsoluteFill>
  );
};

export default SceneComponent;
