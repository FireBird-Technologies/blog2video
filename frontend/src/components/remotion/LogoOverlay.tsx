import React from "react";
import { Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface LogoOverlayProps {
  src: string;
  position?: string; // "top_left" | "top_right" | "bottom_left" | "bottom_right"
  maxOpacity?: number; // 0.0 - 1.0 (default 0.9)
  aspectRatio?: string; // "landscape" | "portrait"
}

/**
 * Persistent logo watermark for the in-browser preview player.
 * Mirrors the rendering-side LogoOverlay in remotion-video/.
 */
export const LogoOverlay: React.FC<LogoOverlayProps> = ({
  src,
  position = "bottom_right",
  maxOpacity = 0.9,
  aspectRatio = "landscape",
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait" || height > width;

  const opacity = interpolate(frame, [0, 20], [0, maxOpacity], {
    extrapolateRight: "clamp",
  });

  const size = isPortrait
    ? Math.round(width * 0.12)
    : Math.round(width * 0.105);

  const margin = isPortrait
    ? Math.round(width * 0.032)
    : Math.round(width * 0.022);

  const posStyle: React.CSSProperties = {
    position: "absolute",
    zIndex: 100,
    opacity,
    width: size,
    height: size,
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
