/**
 * AI-generated outro scene component.
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
  const scale = interpolate(
    spring({ frame, fps, config: { damping: 10 } }),
    [0, 1],
    [0.9, 1]
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
          transform: `scale(${scale})`,
          color: props.brandColors?.text || "#ffffff",
          fontSize: props.titleFontSize || (props.aspectRatio === "portrait" ? 42 : 60),
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
