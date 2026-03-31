import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { DEFAULT_NEWSCAST_ACCENT, toRgba } from "./themeUtils";

/**
 * Shared “photo plate” background used by NEWSCAST layouts.
 * It fills the scene and adds a navy/red editorial overlay for readability.
 */
export const NewsCastLayoutImageBackground: React.FC<{
  imageUrl?: string;
  accentColor?: string;
}> = ({ imageUrl, accentColor }) => {
  if (!imageUrl) return null;

  return (
    <AbsoluteFill aria-hidden style={{ zIndex: 0, overflow: "hidden" }}>
      <Img
        src={imageUrl}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scale(1.04)",
        }}
      />
      {/* Editorial overlays (navy to reduce bright photos) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(6,6,20,0.82) 0%, rgba(10,42,110,0.25) 45%, rgba(6,6,20,0.78) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 25% 18%, ${toRgba(
            accentColor || DEFAULT_NEWSCAST_ACCENT,
            0.18,
          )} 0%, transparent 55%)`,
          opacity: 0.9,
        }}
      />
    </AbsoluteFill>
  );
};

