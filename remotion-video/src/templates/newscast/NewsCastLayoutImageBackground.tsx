import React from "react";
<<<<<<< HEAD
import { AbsoluteFill, Img } from "remotion";
import { DEFAULT_NEWSCAST_ACCENT, toRgba } from "./themeUtils";

/**
 * Shared “photo plate” background used by NEWSCAST layouts.
 * It fills the scene and adds a navy/red editorial overlay for readability.
=======
import { AbsoluteFill } from "remotion";
import { ZoomCropImg } from "./components/ZoomCropImg";
import { DEFAULT_NEWSCAST_ACCENT, toRgba } from "./themeUtils";

/**
 * Shared "photo plate" background used by NEWSCAST layouts.
 * It fills the scene and adds a navy/red editorial overlay for readability.
 * Empty areas when imageZoom < 1 are transparent — the composition's base
 * background and the editorial overlay above handle visual consistency.
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
 */
export const NewsCastLayoutImageBackground: React.FC<{
  imageUrl?: string;
  accentColor?: string;
<<<<<<< HEAD
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
=======
  imageObjectPosition?: string;
  imageZoom?: number;
}> = ({ imageUrl, accentColor, imageObjectPosition, imageZoom }) => {
  if (!imageUrl) return null;

  const plateZoom = 1.04 * Math.max(0.1, imageZoom ?? 1);

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
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
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
<<<<<<< HEAD

=======
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
