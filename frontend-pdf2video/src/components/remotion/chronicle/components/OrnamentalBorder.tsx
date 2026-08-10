import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface OrnamentalCornerProps {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  size?: number;
  color?: string;
  startFrame?: number;
  variant?: "fleur" | "vine" | "celtic";
}

/**
 * Ornamental corner that draws in via stroke-dashoffset.
 * Multiple variants: fleur-de-lys, vine curl, celtic knot.
 */
export const OrnamentalCorner: React.FC<OrnamentalCornerProps> = ({
  position,
  size = 120,
  color = "#B8860B",
  startFrame = 0,
  variant = "vine",
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const draw = interpolate(local, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dashLength = 400;
  const dashOffset = dashLength * (1 - draw);

  // Position + rotation per corner
  const posStyle: React.CSSProperties = { position: "absolute", width: size, height: size };
  let rotate = 0;
  switch (position) {
    case "top-left":
      posStyle.top = 0;
      posStyle.left = 0;
      rotate = 0;
      break;
    case "top-right":
      posStyle.top = 0;
      posStyle.right = 0;
      rotate = 90;
      break;
    case "bottom-right":
      posStyle.bottom = 0;
      posStyle.right = 0;
      rotate = 180;
      break;
    case "bottom-left":
      posStyle.bottom = 0;
      posStyle.left = 0;
      rotate = 270;
      break;
  }

  return (
    <div style={posStyle}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ transform: `rotate(${rotate}deg)` }}
      >
        {variant === "vine" && (
          <g
            fill="none"
            stroke={color}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray={dashLength}
            strokeDashoffset={dashOffset}
          >
            <path d="M4,4 L40,4 M4,4 L4,40" strokeWidth="2.2" />
            <path d="M40,4 Q50,4 54,12 Q56,20 46,22 Q36,22 40,14" />
            <path d="M4,40 Q4,50 12,54 Q20,56 22,46 Q22,36 14,40" />
            <path d="M10,10 Q18,14 16,22 M10,10 Q14,18 22,16" />
            <circle cx="50" cy="18" r="2" fill={color} stroke="none" />
            <circle cx="18" cy="50" r="2" fill={color} stroke="none" />
            <circle cx="10" cy="10" r="1.5" fill={color} stroke="none" />
          </g>
        )}
        {variant === "fleur" && (
          <g
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray={dashLength}
            strokeDashoffset={dashOffset}
          >
            <path d="M4,4 L42,4" strokeWidth="2.2" />
            <path d="M4,4 L4,42" strokeWidth="2.2" />
            {/* Fleur-de-lys */}
            <path d="M22,10 Q22,20 16,24 Q22,22 22,28 Q22,22 28,24 Q22,20 22,10 Z" fill={color} />
            <path d="M10,22 Q20,22 24,16 Q22,22 28,22 Q22,22 24,28 Q20,22 10,22 Z" fill={color} />
            <circle cx="6" cy="6" r="1.8" fill={color} />
          </g>
        )}
        {variant === "celtic" && (
          <g
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray={dashLength}
            strokeDashoffset={dashOffset}
          >
            <path d="M4,4 L40,4" strokeWidth="2.2" />
            <path d="M4,4 L4,40" strokeWidth="2.2" />
            <path d="M14,14 Q24,14 24,24 Q24,34 14,34 Q4,34 4,24" />
            <path d="M14,14 Q14,24 24,24 Q34,24 34,14 Q34,4 24,4" />
            <circle cx="14" cy="14" r="1.8" fill={color} stroke="none" />
            <circle cx="24" cy="24" r="1.8" fill={color} stroke="none" />
          </g>
        )}
      </svg>
    </div>
  );
};

interface OrnamentalBorderProps {
  color?: string;
  size?: number;
  startFrame?: number;
  variant?: "fleur" | "vine" | "celtic";
}

/** Four corners at once. */
export const OrnamentalBorder: React.FC<OrnamentalBorderProps> = ({
  color = "#B8860B",
  size = 120,
  startFrame = 0,
  variant = "vine",
}) => (
  <>
    <OrnamentalCorner position="top-left" size={size} color={color} startFrame={startFrame} variant={variant} />
    <OrnamentalCorner position="top-right" size={size} color={color} startFrame={startFrame + 4} variant={variant} />
    <OrnamentalCorner position="bottom-right" size={size} color={color} startFrame={startFrame + 8} variant={variant} />
    <OrnamentalCorner position="bottom-left" size={size} color={color} startFrame={startFrame + 12} variant={variant} />
  </>
);

/** Horizontal ink divider with central diamond — used as a title separator. */
export const InkDivider: React.FC<{
  color?: string;
  width?: number | string;
  startFrame?: number;
}> = ({ color = "#2A1810", width = "60%", startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const draw = interpolate(local, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          flex: 1,
          height: 1.5,
          background: color,
          transformOrigin: "right center",
          transform: `scaleX(${draw})`,
        }}
      />
      <div
        style={{
          width: 10,
          height: 10,
          background: color,
          transform: `rotate(45deg) scale(${draw})`,
          opacity: draw,
        }}
      />
      <div
        style={{
          flex: 1,
          height: 1.5,
          background: color,
          transformOrigin: "left center",
          transform: `scaleX(${draw})`,
        }}
      />
    </div>
  );
};

/** Compass rose SVG, draws in by stroke-dashoffset. */
export const CompassRose: React.FC<{ size?: number; color?: string; startFrame?: number }> = ({
  size = 120,
  color = "#2A1810",
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const draw = interpolate(local, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dashLength = 600;
  const dashOffset = dashLength * (1 - draw);

  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <g
        fill="none"
        stroke={color}
        strokeWidth="0.8"
        strokeDasharray={dashLength}
        strokeDashoffset={dashOffset}
      >
        <circle cx="50" cy="50" r="46" />
        <circle cx="50" cy="50" r="38" opacity="0.5" />
        <circle cx="50" cy="50" r="24" opacity="0.4" />
        {/* Cardinal points */}
        <polygon points="50,4 55,50 50,50" fill={color} stroke="none" />
        <polygon points="50,96 45,50 50,50" fill={color} stroke="none" />
        <polygon points="4,50 50,45 50,50" fill={color} stroke="none" />
        <polygon points="96,50 50,55 50,50" fill={color} stroke="none" />
        {/* Diagonal points (smaller) */}
        <polygon points="18,18 48,48 50,50" fill={color} stroke="none" opacity="0.7" />
        <polygon points="82,18 52,48 50,50" fill={color} stroke="none" opacity="0.7" />
        <polygon points="18,82 48,52 50,50" fill={color} stroke="none" opacity="0.7" />
        <polygon points="82,82 52,52 50,50" fill={color} stroke="none" opacity="0.7" />
      </g>
      <text
        x="50"
        y="14"
        textAnchor="middle"
        fontFamily="'Cinzel Decorative', serif"
        fontSize="8"
        fontWeight="700"
        fill={color}
        opacity={draw}
      >
        N
      </text>
    </svg>
  );
};
