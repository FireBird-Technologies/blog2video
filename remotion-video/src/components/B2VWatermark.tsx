import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Blog2Video logo watermark — renders the actual b2v-logo.png badge
 * plus "Blog2Video" wordmark, bottom-left corner of every scene.
 * Fades in over 20 frames at 70% opacity.
 */
export const B2VWatermark: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isPortrait = height > width;

  const opacity = interpolate(frame, [0, 20], [0, 0.70], {
    extrapolateRight: "clamp",
  });

  const badgeSize = isPortrait
    ? Math.round(width * 0.072)
    : Math.round(width * 0.038);

  const margin = isPortrait
    ? Math.round(width * 0.03)
    : Math.round(width * 0.018);

  const gap = Math.round(badgeSize * 0.28);
  const wordmarkFontSize = Math.round(badgeSize * 0.38);

  return (
    <div
      style={{
        position: "absolute",
        bottom: margin,
        left: margin,
        zIndex: 200,
        opacity,
        display: "flex",
        alignItems: "center",
        gap,
        pointerEvents: "none",
      }}
    >
      <Img
        src={staticFile("b2v-logo.png")}
        style={{
          width: badgeSize,
          height: badgeSize,
          objectFit: "contain",
          flexShrink: 0,
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.35))",
        }}
      />
      <span
        style={{
          color: "#FFFFFF",
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          fontSize: wordmarkFontSize,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          lineHeight: 1,
          whiteSpace: "nowrap",
          textShadow: "0 1px 6px rgba(0,0,0,0.55)",
          userSelect: "none",
        }}
      >
        Blog2Video
      </span>
    </div>
  );
};
