import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneLayoutProps } from "../types";
import { GeometricBackground } from "../components/GeometricBackground";
import { FlybyPlane } from "../components/FlybyPlane";

// Approximate total stroke length for the arrow paths (used for draw-on animation)
const ARROW_STROKE_LEN = 41;

export const FlowDiagram: React.FC<SceneLayoutProps> = ({
  title,
  accentColor,
  bgColor,
  textColor,
  steps = [],
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
  sceneIndex,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const p = aspectRatio === "portrait";

  // ── Title ────────────────────────────────────────────────────────────────
  const titleSp = spring({ frame: frame - 3, fps, config: { damping: 22, stiffness: 90, mass: 1 } });
  const titleOp = interpolate(titleSp, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const titleY  = interpolate(titleSp, [0, 1], [-22, 0], { extrapolateRight: "clamp" });

  const underlineSp = spring({ frame: frame - 15, fps, config: { damping: 18, stiffness: 80, mass: 1 } });
  const underlineW  = interpolate(underlineSp, [0, 1], [0, 100], { extrapolateRight: "clamp" });
  const underlineOp = interpolate(underlineSp, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });

  // ── Exit timing ──────────────────────────────────────────────────────────
  const EXIT_DUR   = 26;
  const EXIT_START = Math.max(0, durationInFrames - EXIT_DUR);

  const safeSteps = Array.isArray(steps) ? steps : [];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        padding: p ? "60px 50px" : "80px 100px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <GeometricBackground accentColor={accentColor} frame={frame} sceneIndex={sceneIndex} />

      {/* Decorative plane sweeps top area mid-scene */}
      <FlybyPlane accentColor={accentColor} startFrame={45} yZone={0.10} />

      {/* ── Title block ────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          marginBottom: p ? 72 : 100,
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <h2
          style={{
            color: textColor,
            fontSize: titleFontSize ?? (p ? 50 : 51),
            fontWeight: 700,
            fontFamily: fontFamily ?? "'Roboto Slab', serif",
            marginTop: 0,
            marginBottom: 0,
            textAlign: "center",
            lineHeight: 1.1,
          }}
        >
          {title}
        </h2>
        {/* Animated underline */}
        <div
          style={{
            position: "absolute",
            bottom: p ? -10 : -15,
            left: "50%",
            transform: "translateX(-50%)",
            width: `${underlineW}%`,
            height: 4,
            backgroundColor: accentColor,
            borderRadius: 4,
            opacity: underlineOp,
          }}
        />
      </div>

      {/* ── Steps row / column ──────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: p ? "column" : "row",
          alignItems: "center",
          gap: p ? 12 : 16,
          flexWrap: p ? "nowrap" : "wrap",
          justifyContent: "center",
          maxWidth: "100%",
        }}
      >
        {safeSteps.map((step, i) => {
          const isLast   = i === safeSteps.length - 1;
          const entDelay = 12 + i * 14;

          // ── Entry spring ───────────────────────────────────────────────
          const entrySp = spring({
            frame: frame - entDelay,
            fps,
            config: { damping: 18, stiffness: 120, mass: 1 },
          });
          const entScale = interpolate(entrySp, [0, 1], [0.7, 1], { extrapolateRight: "clamp" });
          const entOp    = interpolate(entrySp, [0, 1], [0, 1],   { extrapolateRight: "clamp" });

          // Alternating slide direction:
          //   landscape → even nodes come from below, odd from above
          //   portrait  → even from left, odd from right
          const slideDir = i % 2 === 0 ? 1 : -1;
          const entX = p ? interpolate(entrySp, [0, 1], [slideDir * 50, 0], { extrapolateRight: "clamp" }) : 0;
          const entY = p ? 0 : interpolate(entrySp, [0, 1], [slideDir * 38, 0], { extrapolateRight: "clamp" });

          // ── Entry glow burst (brief accent ring after node settles) ────
          const glowOp = interpolate(
            frame,
            [entDelay + 12, entDelay + 18, entDelay + 30, entDelay + 40],
            [0, 0.55, 0.55, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          // ── Arrow draw-on animation ───────────────────────────────────
          // Arrow draws itself starting when this node appears
          const arrowDashOffset = interpolate(
            frame,
            [entDelay + 4, entDelay + 18],
            [ARROW_STROKE_LEN, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const arrowOp = interpolate(frame, [entDelay + 4, entDelay + 10], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });

          // ── Exit animation (reverse stagger: later steps exit first) ──
          const exitDelay = EXIT_START + (safeSteps.length - 1 - i) * 5;
          const exitSp    = spring({
            frame: frame - exitDelay,
            fps,
            config: { damping: 14, stiffness: 130, mass: 0.9 },
            durationInFrames: EXIT_DUR,
          });
          const exitScale = interpolate(exitSp, [0, 1], [1, 0.65], { extrapolateLeft: "clamp" });
          const exitOp    = interpolate(exitSp, [0, 0.45], [1, 0],  { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const exitY     = p ? 0 : interpolate(exitSp, [0, 1], [0, slideDir * -30], { extrapolateLeft: "clamp" });
          const exitX     = p ? interpolate(exitSp, [0, 1], [0, slideDir * -40], { extrapolateLeft: "clamp" }) : 0;

          const inExit    = frame >= exitDelay;
          const nodeScale = inExit ? exitScale : entScale;
          const nodeOp    = inExit ? exitOp    : entOp;
          const nodeX     = inExit ? exitX     : entX;
          const nodeY     = inExit ? exitY     : entY;

          const nodeFontSize = descriptionFontSize ?? (p ? 35 : 27);

          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: p ? "column" : "row",
                alignItems: "center",
                gap: p ? 12 : 16,
              }}
            >
              {/* ── Node card ─────────────────────────────────────────── */}
              <div
                style={{
                  position: "relative",
                  transform: `translateX(${nodeX}px) translateY(${nodeY}px) scale(${nodeScale})`,
                  opacity: nodeOp,
                }}
              >
                {/* Entry glow ring — briefly lights up after appearing */}
                {glowOp > 0.01 && (
                  <div
                    style={{
                      position: "absolute",
                      inset: -6,
                      borderRadius: 18,
                      border: `3px solid ${accentColor}`,
                      opacity: glowOp,
                      boxShadow: `0 0 22px ${accentColor}66`,
                      pointerEvents: "none",
                    }}
                  />
                )}

                {/* Main pill */}
                <div
                  style={{
                    padding: p ? "14px 22px" : "16px 28px",
                    borderRadius: 14,
                    backgroundColor: isLast ? accentColor : `${accentColor}15`,
                    border: `2px solid ${isLast ? accentColor : accentColor + "40"}`,
                    textAlign: "center",
                    boxShadow: isLast
                      ? `0 8px 28px ${accentColor}44`
                      : `0 4px 14px rgba(0,0,0,0.08)`,
                  }}
                >
                  <span
                    style={{
                      fontSize: nodeFontSize,
                      fontWeight: 600,
                      color: isLast ? "#FFF" : textColor,
                      fontFamily: fontFamily ?? "'Roboto Slab', serif",
                      wordBreak: "break-word",
                      hyphens: "auto",
                    }}
                  >
                    {step}
                  </span>
                </div>

                {/* Step number badge — pops in with the node */}
                <div
                  style={{
                    position: "absolute",
                    top: -10,
                    right: -10,
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    backgroundColor: isLast ? "#fff" : accentColor,
                    border: `2px solid ${isLast ? accentColor : bgColor}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 800,
                    color: isLast ? accentColor : "#fff",
                    fontFamily: fontFamily ?? "'Roboto Slab', serif",
                    opacity: entOp,
                    transform: `scale(${entScale})`,
                  }}
                >
                  {i + 1}
                </div>
              </div>

              {/* ── Arrow — draws itself on ─────────────────────────── */}
              {!isLast &&
                (p ? (
                  <svg
                    width="20"
                    height="32"
                    style={{ opacity: arrowOp, flexShrink: 0 }}
                  >
                    <path
                      d="M10 0 L10 24 M4 18 L10 24 L16 18"
                      stroke={accentColor}
                      strokeWidth="2.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={ARROW_STROKE_LEN}
                      strokeDashoffset={arrowDashOffset}
                    />
                  </svg>
                ) : (
                  <svg
                    width="32"
                    height="20"
                    style={{ opacity: arrowOp, flexShrink: 0 }}
                  >
                    <path
                      d="M0 10 L24 10 M18 4 L24 10 L18 16"
                      stroke={accentColor}
                      strokeWidth="2.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={ARROW_STROKE_LEN}
                      strokeDashoffset={arrowDashOffset}
                    />
                  </svg>
                ))}
            </div>
          );
        })}
      </div>

      {/* Accent bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 4,
          backgroundColor: accentColor,
        }}
      />
    </AbsoluteFill>
  );
};
