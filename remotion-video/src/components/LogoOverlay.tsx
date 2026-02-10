import React from "react";
import { Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface LogoOverlayProps {
  src: string;
  position?: string; // "top_left" | "top_right" | "bottom_left" | "bottom_right"
  aspectRatio?: string; // "landscape" | "portrait"
}

/**
 * Persistent logo watermark that automatically sizes and positions itself
 * for both landscape (1920×1080) and portrait (1080×1920) videos.
 *
 * - Landscape: 80px logo, 30px margin from edge
 * - Portrait:  56px logo, 24px margin, pushed slightly inward to avoid
 *   mobile safe-area cutouts
 *
 * Fades in over the first 20 frames and stays at 85% opacity.
 */
export const LogoOverlay: React.FC<LogoOverlayProps> = ({
  src,
  position = "bottom_right",
  aspectRatio = "landscape",
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait" || height > width;

  // Fade in gently over the first 20 frames
  const opacity = interpolate(frame, [0, 20], [0, 0.85], {
    extrapolateRight: "clamp",
  });

  // Responsive sizing based on canvas dimensions
  // Landscape (1920w): ~6.5% = 125px   |  Portrait (1080w): ~8% = 86px
  const size = isPortrait
    ? Math.round(width * 0.08)    // ~86px on 1080w
    : Math.round(width * 0.065);  // ~125px on 1920w

  // Margin from edge — portrait gets extra inset for mobile safe areas
  const margin = isPortrait
    ? Math.round(width * 0.028)   // ~30px on 1080w
    : Math.round(width * 0.02);   // ~38px on 1920w

  // Build position style
  const posStyle: React.CSSProperties = {
    position: "absolute",
    zIndex: 100,
    opacity,
    width: size,
    height: size,
    // Subtle drop shadow so the logo is visible on any background
    filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.25))",
  };

  switch (position) {
    case "top_left":
      posStyle.top = margin;
      posStyle.left = margin;
      break;
    case "top_right":
      posStyle.top = margin;
      posStyle.right = margin;
      break;
    case "bottom_left":
      posStyle.bottom = margin;
      posStyle.left = margin;
      break;
    case "bottom_right":
    default:
      posStyle.bottom = margin;
      posStyle.right = margin;
      break;
  }

  return (
    <div style={posStyle}>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
    </div>
  );
};
