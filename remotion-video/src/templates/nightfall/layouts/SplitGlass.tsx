import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { DarkBackground } from "../DarkBackground";
import { glassCardStyle } from "../GlassCard";
import type { NightfallLayoutProps } from "../types";

/**
 * SplitGlass — Enhanced Professional Version
 * 
 * Improvements:
 * - Dynamic center divider with glow effect
 * - Opposing slide-in animations for drama
 * - Color-coded panels for visual distinction
 * - Better comparison layout
 * - Icons/indicators for each side
 * - Subtle depth difference between panels
 */

export const SplitGlass: React.FC<NightfallLayoutProps> = ({
  title,
  accentColor,
  textColor,
  leftLabel = "Before",
  rightLabel = "After",
  leftDescription = "",
  rightDescription = "",
  narration,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  // Title reveal
  const titleY = spring({
    frame: frame - 5,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  const titleOpacity = interpolate(
    frame,
    [0, 25],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  // Panel slide-ins from opposite sides
  const leftX = spring({
    frame: frame - 15,
    fps,
    config: { damping: 20, stiffness: 70, mass: 1 },
  });

  const rightX = spring({
    frame: frame - 15,
    fps,
    config: { damping: 20, stiffness: 70, mass: 1 },
  });

  const panelOpacity = interpolate(
    frame,
    [15, 40],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  // Center divider animation
  const dividerHeight = interpolate(
    frame,
    [25, 50],
    [0, 100],
    { extrapolateRight: "clamp" }
  );

  const dividerGlow = Math.sin(frame / 20) * 0.5 + 0.5;

  // Content
  const leftDesc = leftDescription || title || "";
  const rightDesc = rightDescription || narration || "";

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground />
      
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          padding: p ? "20px 35px" : "30px 60px",
        }}
      >
        {/* Title */}
        {title && (
          <h2
            style={{
              fontSize: p ? 34 : 46,
              fontWeight: 700,
              color: textColor,
              fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
              marginBottom: p ? 20 : 28,
              textAlign: "center",
              opacity: titleOpacity,
              transform: `translateY(${(1 - titleY) * 30}px)`,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h2>
        )}

        {/* Split Panels Container */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: p ? "column" : "row",
            gap: 0,
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {/* Left Panel */}
          <div
            style={{
              opacity: panelOpacity,
              transform: `translateX(${(1 - leftX) * -100}px)`,
              paddingRight: p ? 0 : 12,
              paddingBottom: p ? 12 : 0,
            }}
          >
            <div
              style={{
                ...glassCardStyle(accentColor, 0.08),
                padding: p ? 48 : 64,
                paddingTop: p ? 56 : 72,
                position: "relative",
                border: `1px solid ${accentColor}20`,
                boxShadow: `
                  0 8px 32px rgba(0, 0, 0, 0.3),
                  inset 0 1px 0 rgba(255, 255, 255, 0.08)
                `,
                maxWidth: p ? "100%" : 720,
                minHeight: p ? 400 : 500,
              }}
            >
              {/* Label - positioned at top left */}
              <div
                style={{
                  position: "absolute",
                  top: p ? 20 : 24,
                  left: p ? 24 : 28,
                  fontSize: p ? 20 : 24,
                  color: "rgba(226,232,240,0.45)",
                  fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                {leftLabel}
              </div>

              {/* Content */}
              <div
                style={{
                  fontSize: p ? 28 : 32,
                  lineHeight: 1.75,
                  color: "rgba(226,232,240,0.85)",
                  fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
                  marginTop: p ? 8 : 12,
                }}
              >
                {leftDesc}
              </div>
            </div>
          </div>

          {/* Center Divider */}
          <div
            style={{
              width: p ? "100%" : 3,
              height: p ? 3 : "auto",
              alignSelf: "center",
              position: "relative",
              flexShrink: 0,
              margin: p ? "12px 0" : "0 12px",
            }}
          >
            {/* Animated divider line */}
            <div
              style={{
                position: "absolute",
                [p ? "left" : "top"]: "50%",
                [p ? "top" : "left"]: "50%",
                transform: p
                  ? `translate(-50%, -50%)`
                  : `translate(-50%, -50%)`,
                [p ? "width" : "height"]: `${dividerHeight}%`,
                [p ? "height" : "width"]: 3,
                background: `linear-gradient(
                  ${p ? "90deg" : "180deg"},
                  transparent,
                  ${accentColor},
                  transparent
                )`,
                boxShadow: `0 0 ${20 + dividerGlow * 10}px ${accentColor}${Math.floor((0.5 + dividerGlow * 0.3) * 255).toString(16)}`,
              }}
            />

            {/* Center indicator */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 16,
                height: 16,
                borderRadius: "50%",
                backgroundColor: accentColor,
                boxShadow: `0 0 30px ${accentColor}`,
                opacity: interpolate(frame, [30, 50], [0, 1], {
                  extrapolateRight: "clamp",
                }),
                border: "2px solid rgba(0, 0, 0, 0.5)",
              }}
            />
          </div>

          {/* Right Panel */}
          <div
            style={{
              opacity: panelOpacity,
              transform: `translateX(${(1 - rightX) * 100}px)`,
              paddingLeft: p ? 0 : 12,
              paddingTop: p ? 12 : 0,
            }}
          >
            <div
              style={{
                ...glassCardStyle(accentColor, 0.1),
                padding: p ? 48 : 64,
                paddingTop: p ? 56 : 72,
                position: "relative",
                border: `1px solid ${accentColor}30`,
                boxShadow: `
                  0 8px 32px rgba(0, 0, 0, 0.3),
                  0 0 0 1px rgba(255, 255, 255, 0.05),
                  inset 0 1px 0 rgba(255, 255, 255, 0.1)
                `,
                maxWidth: p ? "100%" : 720,
                minHeight: p ? 400 : 500,
              }}
            >
              {/* Label - positioned at top left */}
              <div
                style={{
                  position: "absolute",
                  top: p ? 20 : 24,
                  left: p ? 24 : 28,
                  fontSize: p ? 20 : 24,
                  color: accentColor,
                  fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                {rightLabel}
              </div>

              {/* Content */}
              <div
                style={{
                  fontSize: p ? 28 : 32,
                  lineHeight: 1.75,
                  color: "rgba(226,232,240,0.85)",
                  fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
                  marginTop: p ? 8 : 12,
                }}
              >
                {rightDesc}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};