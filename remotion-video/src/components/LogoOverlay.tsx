import React from "react";
import { Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const LOGO_SIZE_MULT: Record<string, number> = {
  small: 0.6,
  medium: 0.8,
  default: 1,
  large: 1.2,
  extra_large: 1.5,
};

interface LogoOverlayProps {
  src: string;
  position?: string; // "top_left" | "top_right" | "bottom_left" | "bottom_right"
  maxOpacity?: number; // 0.0 - 1.0 (default 0.9)
  size?: string; // "default" | "small" | "medium" | "large" | "extra_large"
  aspectRatio?: string; // "landscape" | "portrait"
}

/**
 * Persistent logo watermark that automatically sizes and positions itself
 * for both landscape (1920×1080) and portrait (1080×1920) videos.
 *
 * - Landscape (1920w): ~200px logo, ~40px margin
 * - Portrait  (1080w): ~130px logo, ~35px margin
 *
 * Fades in over the first 20 frames and stays at 90% opacity.
 */
export const LogoOverlay: React.FC<LogoOverlayProps> = ({
  src,
  position = "bottom_right",
  maxOpacity = 0.9,
  size: sizePreset = "default",
  aspectRatio = "landscape",
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait" || height > width;

  // Fade in gently over the first 20 frames to the user-chosen opacity
  const opacity = interpolate(frame, [0, 20], [0, maxOpacity], {
    extrapolateRight: "clamp",
  });

  const mult = LOGO_SIZE_MULT[sizePreset] ?? 1;
  // Responsive sizing — sized to be clearly visible in the final video
  const baseSize = isPortrait
    ? Math.round(width * 0.12)
    : Math.round(width * 0.105);
  const size = Math.round(baseSize * mult);

  // Margin from edge
  const margin = isPortrait
    ? Math.round(width * 0.032)   // ~35px on 1080w
    : Math.round(width * 0.022);  // ~42px on 1920w

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
