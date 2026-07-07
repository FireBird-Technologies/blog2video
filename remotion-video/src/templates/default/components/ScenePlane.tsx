import React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface ScenePlaneProps {
  /** Brand accent colour — the plane and tether use it. */
  accentColor: string;
  /** Scene index — alternates entry direction. */
  sceneIndex?: number;
  children: React.ReactNode;
}

// Durations in frames — deliberately slow and cinematic
const ENTER_DUR = 75; // plane takes ~2.5 s to cross and settle (30 fps)
const EXIT_DUR  = 60; // exit phase at the tail of the scene

/**
 * "One plane, only during transitions — plane leads, modal stops behind it."
 *
 * ENTER (first ENTER_DUR frames):
 *   • A single paper plane glides in from one edge along a gentle arc.
 *   • The text modal starts at the same off-screen position but on a much
 *     heavier spring — it lags behind the plane.
 *   • A dashed tether line connects the plane to the modal while the gap
 *     widens.  The plane exits the far edge; the tether snaps; the modal
 *     decelerates and settles at centre.
 *
 * HOLD:
 *   • No plane at all.  Modal sits at centre.
 *
 * EXIT (last EXIT_DUR frames):
 *   • The plane returns from the far side, passes the modal, re-tethers, and
 *     drags it off-screen in the same direction it came from.
 *
 * The plane SVG renders at z-index 10 — always above the text modal.
 */
export const ScenePlane: React.FC<ScenePlaneProps> = ({
  accentColor,
  sceneIndex = 0,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  // Alternate direction each scene
  const ltr = Math.abs(sceneIndex) % 2 === 0;

  // Off-screen overshoot
  const OS    = width  * 0.72;
  // Vertical arc height — plane rises gently as it crosses then dips back down
  const ARC_H = height * 0.09;
  // Horizontal offset below centre of modal for tether anchor
  const TETHER_ANCHOR_Y = 28;

  const exitStart = Math.max(0, durationInFrames - EXIT_DUR);
  const inExit    = frame >= exitStart;

  // ── ENTER: plane on smooth eased interpolate, modal on heavy spring ─────────
  //
  // Using easeOut so the plane appears to decelerate/glide as it exits, not
  // a jarring snap.  The slow cubic bezier curve gives it a cinematic feel.
  const enterT = interpolate(frame, [0, ENTER_DUR], [0, 1], {
    extrapolateLeft:  "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 0.72, 0.44, 1.0),
  });

  // Full crossing: offscreen-near → offscreen-far
  const planeEnterX = interpolate(enterT, [0, 1], ltr ? [-OS, OS] : [OS, -OS]);
  // Gentle parabolic arc — peaks at mid-crossing
  const planeEnterY = -ARC_H * Math.sin(enterT * Math.PI);

  const planeEnterOpacity = interpolate(
    enterT,
    [0, 0.05, 0.82, 0.96],
    [0,    1,    1,    0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Heavy spring for the modal — settles at centre after the plane lets go
  const modalEnterSpring = spring({
    frame,
    fps,
    config: { damping: 30, stiffness: 22, mass: 4.0 },
  });
  const modalEnterX = interpolate(modalEnterSpring, [0, 1], ltr ? [-OS, 0] : [OS, 0]);
  const modalEnterY = interpolate(modalEnterSpring, [0, 1], [18, 0]);
  const modalEnterOpacity = interpolate(
    modalEnterSpring,
    [0, 0.10],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  // Tether opacity — smooth fade based on separation gap
  const enterGap = ltr
    ? planeEnterX - modalEnterX
    : modalEnterX - planeEnterX;
  const planeEnterInFrame = Math.abs(planeEnterX) < OS * 0.90;
  const enterTetherRaw = planeEnterInFrame && enterGap > 20
    ? interpolate(enterT, [0.04, 0.12, 0.76, 0.90], [0, 1, 1, 0], {
        extrapolateLeft:  "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  // ── EXIT: plane returns from far side, drags modal away ─────────────────────
  //
  // easeIn so the plane starts slow (picking up the modal) then accelerates away.
  const exitT = interpolate(
    frame,
    [exitStart, exitStart + EXIT_DUR],
    [0, 1],
    {
      extrapolateLeft:  "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.44, 0, 0.84, 0.18),
    }
  );

  // Plane comes from the far side (where it exited during entry) and leaves near side
  const planeExitX = interpolate(exitT, [0, 1], ltr ? [OS, -OS] : [-OS, OS]);
  const planeExitY = -ARC_H * Math.sin(exitT * Math.PI);

  const planeExitOpacity = interpolate(
    exitT,
    [0, 0.05, 0.82, 0.96],
    [0,    1,    1,    0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Modal dragged off-screen in the same direction the exit plane travels
  const modalExitSpring = spring({
    frame: frame - exitStart,
    fps,
    config: { damping: 30, stiffness: 22, mass: 4.0 },
    durationInFrames: EXIT_DUR,
  });
  const modalExitX = interpolate(modalExitSpring, [0, 1], ltr ? [0, -OS] : [0, OS]);
  const modalExitOpacity = interpolate(
    modalExitSpring,
    [0.50, 0.85],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Exit tether
  const exitGap = ltr
    ? modalExitX - planeExitX
    : planeExitX - modalExitX;
  const planeExitInFrame = Math.abs(planeExitX) < OS * 0.90;
  const exitTetherRaw = planeExitInFrame && exitGap > 20
    ? interpolate(exitT, [0.04, 0.12, 0.76, 0.90], [0, 1, 1, 0], {
        extrapolateLeft:  "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  // ── Combine enter / exit ────────────────────────────────────────────────────
  const activePlaneX   = inExit ? planeExitX      : planeEnterX;
  const activePlaneY   = inExit ? planeExitY      : planeEnterY;
  const planeOpacity   = inExit ? planeExitOpacity : planeEnterOpacity;
  const tetherOpacity  = inExit ? exitTetherRaw    : enterTetherRaw;

  const modalX         = inExit ? modalExitX      : modalEnterX;
  const modalY         = inExit ? 0               : modalEnterY;
  const modalOpacity   = inExit ? modalExitOpacity : modalEnterOpacity;

  // ── Screen coordinates ──────────────────────────────────────────────────────
  const cx = width  / 2;
  const cy = height / 2;
  const planeScreenX = cx + activePlaneX;
  const planeScreenY = cy + activePlaneY;
  const modalScreenX = cx + modalX;
  const modalScreenY = cy;

  // ── Plane rotation: face travel direction, tilt with arc ───────────────────
  // Base: ltr → face right (+90°), rtl → face left (−90°)
  const baseAngle = ltr ? 90 : -90;
  // tilt from arc derivative: d/dt(-ARC_H * sin(t * π)) = -ARC_H * π * cos(t * π)
  // Divide by horizontal speed proxy (2*OS) to get a small angle in px/px units
  const activeT = inExit ? exitT : enterT;
  const arcDeriv = -ARC_H * Math.PI * Math.cos(activeT * Math.PI);
  const tiltDeg  = (Math.atan2(arcDeriv, OS * 2) * 180) / Math.PI * (ltr ? 1 : -1);
  const planeRotate = baseAngle + tiltDeg * 0.6;

  // ── Plane scale: larger at screen centre ───────────────────────────────────
  const planeCenterFrac = Math.abs(activePlaneX) / OS; // 0 = centre, 1 = offscreen
  const planeScale = interpolate(
    planeCenterFrac,
    [0, 0.30, 1.0],
    [7.8, 6.2, 5.2],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <>
      {/* ── Text modal ─────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: modalOpacity,
          transform: `translateX(${modalX}px) translateY(${modalY}px)`,
          zIndex: 2,
        }}
      >
        {children}
      </div>

      {/* ── Plane + tether — above everything (z-index 10) ───────────────── */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 10,
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        {/* Glow halo behind the plane */}
        {planeOpacity > 0.02 && (
          <circle
            cx={planeScreenX}
            cy={planeScreenY}
            r={planeScale * 14}
            fill={accentColor}
            fillOpacity={planeOpacity * 0.18}
            style={{ filter: "blur(10px)" }}
          />
        )}

        {/* Dashed tether from plane body to modal centre */}
        {tetherOpacity > 0.01 && (
          <line
            x1={planeScreenX}
            y1={planeScreenY + TETHER_ANCHOR_Y}
            x2={modalScreenX}
            y2={modalScreenY}
            stroke={accentColor}
            strokeWidth={2}
            strokeDasharray="12 9"
            strokeOpacity={tetherOpacity * 0.50}
            strokeLinecap="round"
          />
        )}

        {/* Paper plane */}
        <g
          opacity={planeOpacity}
          transform={`translate(${planeScreenX}, ${planeScreenY})
                      rotate(${planeRotate})
                      scale(${planeScale})
                      translate(-11.5, -11)`}
          style={{ filter: `drop-shadow(0 0 18px ${accentColor}cc)` }}
        >
          <path
            d="M21,16L21,14L13,9L13,3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z"
            fill={accentColor}
          />
          {/* Wing highlight */}
          <path
            d="M11.5,2 L13,9 L10,9 Z"
            fill="white"
            fillOpacity={0.40}
          />
        </g>
      </svg>
    </>
  );
};
