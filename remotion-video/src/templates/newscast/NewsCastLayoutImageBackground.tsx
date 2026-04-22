import React from "react";
import { AbsoluteFill } from "remotion";
import { ZoomCropImg } from "./components/ZoomCropImg";
import { DEFAULT_NEWSCAST_ACCENT, toRgba } from "./themeUtils";

/**
 * Shared “photo plate” background used by NEWSCAST layouts.
 * It fills the scene and adds a navy/red editorial overlay for readability.
 */
export const NewsCastLayoutImageBackground: React.FC<{
  imageUrl?: string;
  accentColor?: string;
  imageObjectPosition?: string;
  imageZoom?: number;
}> = ({ imageUrl, accentColor, imageObjectPosition, imageZoom }) => {
  if (!imageUrl) return null;

  const plateZoom = 1.04 * Math.max(1, imageZoom ?? 1);

  return (
    <AbsoluteFill aria-hidden style={{ zIndex: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <ZoomCropImg
          src={imageUrl}
          imageObjectPosition={imageObjectPosition}
          imageZoom={plateZoom}
          alt=""
        />
      </div>
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


