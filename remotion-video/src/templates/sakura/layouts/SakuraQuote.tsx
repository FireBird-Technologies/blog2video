import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";

export const SakuraQuote: React.FC<SceneLayoutProps> = ({ title, narration, accentColor, bgColor, textColor, aspectRatio, titleFontSize, descriptionFontSize, fontFamily }) => {
  const p = aspectRatio === "portrait";
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, color: textColor, fontFamily, padding: 80, opacity, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <h1 style={{ color: accentColor, fontSize: titleFontSize ?? (p ? 92 : 76), margin: 0 }}>{title}</h1>
      <p style={{ fontSize: descriptionFontSize ?? (p ? 52 : 40), marginTop: 24 }}>{narration}</p>
    </AbsoluteFill>
  );
};
