import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

interface MagazinePageCurlProps {
  accentColor?: string;
  position?: "top-right" | "bottom-right";
  size?: number;
}

export const MagazinePageCurl: React.FC<MagazinePageCurlProps> = ({
  accentColor = "#E63946",
  position = "top-right",
  size = 180,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, Math.round(fps * 0.35)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const breathe = Math.sin(frame * 0.04) * 8;
  const dim = size + breathe;
  const isTop = position === "top-right";

  return (
    <div
      style={{
        position: "absolute",
        [isTop ? "top" : "bottom"]: 0,
        right: 0,
        width: dim,
        height: dim,
        pointerEvents: "none",
        zIndex: 9999,
        opacity: fadeIn,
        transform: isTop ? undefined : "scaleY(-1)",
      }}
    >
      <svg
        viewBox="0 0 100 100"
        style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="curlBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#F5F5F5" />
            <stop offset="65%" stopColor="#E8E8E8" />
            <stop offset="100%" stopColor="#B8B8B8" />
          </linearGradient>
          <radialGradient id="curlRoll" cx="100%" cy="0%" r="120%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.0)" />
            <stop offset="50%" stopColor="rgba(0,0,0,0.03)" />
            <stop offset="80%" stopColor="rgba(0,0,0,0.10)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.22)" />
          </radialGradient>
          <linearGradient id="curlHighlight" x1="30%" y1="70%" x2="80%" y2="20%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="40%" stopColor="rgba(255,255,255,0.6)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0.3)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <filter id="curlShadow" x="-20%" y="-10%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </filter>
        </defs>

        <path
          d="M 32,0 Q 70,28 100,52 L 100,78 Q 56,44 26,8 Z"
          fill="rgba(0,0,0,0.18)"
          filter="url(#curlShadow)"
          transform="translate(-6,7)"
        />

        <path
          d="M 38,0 Q 74,26 100,50 L 100,60 Q 68,32 34,4 Z"
          fill="rgba(0,0,0,0.10)"
          transform="translate(-3,4)"
        />

        <path
          d="M 32,0 L 100,0 L 100,52 Q 80,22 32,0 Z"
          fill="url(#curlBody)"
          stroke="rgba(0,0,0,0.06)"
          strokeWidth="0.3"
        />

        <path
          d="M 32,0 L 100,0 L 100,52 Q 80,22 32,0 Z"
          fill="url(#curlRoll)"
        />

        <path
          d="M 50,0 L 100,0 L 100,38 Q 84,16 50,0 Z"
          fill="url(#curlHighlight)"
        />

        <path
          d="M 32,0 Q 80,22 100,52"
          fill="none"
          stroke="rgba(255,255,255,0.92)"
          strokeWidth="1.2"
        />

        <path
          d="M 34,2 Q 80,24 100,54"
          fill="none"
          stroke="rgba(0,0,0,0.12)"
          strokeWidth="0.6"
        />

        <circle
          cx="100"
          cy="0"
          r="3"
          fill={accentColor}
          opacity="0.4"
        />
      </svg>
    </div>
  );
};
