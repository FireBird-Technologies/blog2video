import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface FlybyPlaneProps {
  /** Brand accent colour */
  accentColor: string;
  /**
   * Frame number within the scene at which the flyby starts.
   * Default 40 — lets the scene's own entrance finish first.
   */
  startFrame?: number;
  /**
   * Vertical position of the flyby as a fraction of canvas height.
   * 0.12 = top 12% of screen.  Default 0.13.
   */
  yZone?: number;
}

/**
 * Decorative paper-plane flyby — left to right, top area of screen.
 *
 * Path:
 *   • Front-loaded rapid wobble (2–3 oscillations that damp out quickly) — the
 *     "spiraling" feel as the plane first appears.
 *   • One graceful central dip halfway across.
 *   • Smooth eased crossing from off-screen left to off-screen right.
 *
 * Renders above scene content (z-index 8) but below the theatrical ScenePlane
 * (z-index 10).  Purely decorative — not connected to any text modal.
 */
export const FlybyPlane: React.FC<FlybyPlaneProps> = ({
  accentColor,
  startFrame = 40,
  yZone = 0.13,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const DUR    = 68; // frames for the full crossing
  const OS     = width * 0.13; // how far off-screen the plane starts / ends

  // t: 0 at startFrame, 1 when crossing is complete
  const t = interpolate(frame, [startFrame, startFrame + DUR], [0, 1], {
    extrapolateLeft:  "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.28, 0.0, 0.72, 1.0), // smooth S-curve
  });

  // ── X: left to right ─────────────────────────────────────────────────────
  const x = interpolate(t, [0, 1], [-OS, width + OS]);

  // ── Y: top area + dip + front-loaded spiral wobble ───────────────────────
  const baseY     = height * yZone;
  // Central dip — one gentle arc peaking at mid-crossing
  const dipH      = height * 0.065;
  const mainDip   = dipH * Math.sin(t * Math.PI);
  // Spiral wobble — fast oscillations that damp out in the first 40% of travel
  const wobbleH   = height * 0.028;
  const wobble    = wobbleH * Math.sin(t * 5.6 * Math.PI) * Math.max(0, 1 - t * 2.5);
  const y         = baseY + mainDip + wobble;

  // ── Rotation: tangent of the combined path ───────────────────────────────
  const dt  = 0.008;
  const t2  = Math.min(t + dt, 1.0);
  const x2  = interpolate(t2, [0, 1], [-OS, width + OS]);
  const y2  = baseY
    + dipH    * Math.sin(t2 * Math.PI)
    + wobbleH * Math.sin(t2 * 5.6 * Math.PI) * Math.max(0, 1 - t2 * 2.5);
  // +90 so the plane's nose (which points up in SVG) faces in direction of travel
  const angle = Math.atan2(y2 - y, x2 - x) * (180 / Math.PI) + 90;

  // ── Opacity: fade in/out at edges ────────────────────────────────────────
  const opacity = interpolate(
    t,
    [0, 0.06, 0.88, 1.0],
    [0,    1,    1,   0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  if (opacity < 0.01) return null;

  const SCALE = 2.8;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 8,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      <g opacity={opacity}>
        {/* Soft glow halo */}
        <circle
          cx={x}
          cy={y}
          r={SCALE * 18}
          fill={accentColor}
          fillOpacity={0.13}
          style={{ filter: "blur(8px)" }}
        />
        {/* Paper plane */}
        <g
          transform={`translate(${x}, ${y}) rotate(${angle}) scale(${SCALE}) translate(-11.5, -11)`}
          style={{ filter: `drop-shadow(0 0 10px ${accentColor}99)` }}
        >
          <path
            d="M21,16L21,14L13,9L13,3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z"
            fill={accentColor}
          />
          <path d="M11.5,2 L13,9 L10,9 Z" fill="white" fillOpacity={0.38} />
        </g>
      </g>
    </svg>
  );
};
