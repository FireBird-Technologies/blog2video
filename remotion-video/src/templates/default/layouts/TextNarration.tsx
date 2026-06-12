import { AbsoluteFill } from "remotion";
import React from "react";
import { SceneLayoutProps } from "../types";
import { GeometricBackground } from "../components/GeometricBackground";
import { ScenePlane } from "../components/ScenePlane";
import { useCurrentFrame } from "remotion";

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
  sceneIndex,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const isDarkText =
    textColor === "#000000" || textColor === "#000" || textColor === "black";
  const adjustedBgColor = isDarkText ? "#FFFFFF" : bgColor;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: adjustedBgColor,
        overflow: "hidden",
      }}
    >
      {/* Flowing-contour background that flies in/out per scene */}
      <GeometricBackground
        accentColor={accentColor || "#6366F1"}
        frame={frame}
        sceneIndex={sceneIndex}
      />

      {/* The plane sweeps in, reveals the text "modal", and sweeps it away on exit */}
      <ScenePlane accentColor={accentColor || "#6366F1"} sceneIndex={sceneIndex}>
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
              opacity: isDarkText ? 1 : 0.85,
            }}
          >
            {narration}
          </p>
        </div>
      </ScenePlane>
    </AbsoluteFill>
  );
};
