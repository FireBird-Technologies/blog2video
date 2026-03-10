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
  bgColor,
  textColor,
  leftLabel = "Before",
  rightLabel = "After",
  leftDescription = "",
  rightDescription = "",
  narration,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait"; // 'p' for portrait

  // Constants for card widths
  // Increased width for landscape mode (from 500px to 650px)
  const CARD_WIDTH_LANDSCAPE = 650; 
  // Changed portrait mode cards from dynamic "80%" to a fixed pixel width (800px)
  const CARD_WIDTH_PORTRAIT = 800;  

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

  // --- Animation variables ---

  // Landscape panel slide-ins from opposite sides
  const landscapeLeftX = spring({
    frame: frame - 15,
    fps,
    config: { damping: 20, stiffness: 70, mass: 1 },
  });

  const landscapeRightX = spring({
    frame: frame - 15,
    fps,
    config: { damping: 20, stiffness: 70, mass: 1 },
  });

  const landscapePanelOpacity = interpolate(
    frame,
    [15, 40],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  // Portrait specific animation timings and values
  const pEntryStart = 15;
  const pEntrySettled = pEntryStart + 40; // When entry animation settles
  const pHoldDuration = 60; // How long cards are visible and stable
  const pHoldEnd = pEntrySettled + pHoldDuration;
  const pExitStart = pHoldEnd; // When exit animation starts
  const pExitEnd = pExitStart + 30; // When exit animation finishes

  // Portrait card opacity (fade in, stay, fade out)
  const pCardOpacity = interpolate(
    frame,
    [pEntryStart, pEntryStart + 20, pExitStart, pExitEnd],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp" }
  );

  // Portrait card Y position (start high, settle, stay, drop down)
  const pCardTransformY = interpolate(
    frame,
    [pEntryStart, pEntrySettled, pExitStart, pExitEnd],
    [-300, 0, 0, 300],
    { extrapolateRight: "clamp" }
  );

  // Portrait card X position for "round" entry (from side to center)
  const pLeftCardTransformX = interpolate(
    frame,
    [pEntryStart, pEntrySettled],
    [-100, 0], // Start from left, move to center
    { extrapolateRight: "clamp" }
  );
  const pRightCardTransformX = interpolate(
    frame,
    [pEntryStart, pEntrySettled],
    [100, 0], // Start from right, move to center
    { extrapolateRight: "clamp" }
  );

  // Portrait card rotation for "round" entry
  const pCardRotation = interpolate(
    frame,
    [pEntryStart, pEntrySettled],
    [-10, 0], // Rotate from -10 degrees to 0 degrees
    { extrapolateRight: "clamp" }
  );

  // Unified animation values based on aspect ratio
  const cardOpacity = p ? pCardOpacity : landscapePanelOpacity;
  const leftCardX = p ? pLeftCardTransformX : (1 - landscapeLeftX) * -100;
  const rightCardX = p ? pRightCardTransformX : (1 - landscapeRightX) * 100;
  const cardY = p ? pCardTransformY : 0; // Only portrait has vertical motion

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
      <DarkBackground bgColor={bgColor} />
      
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          padding: p ? "30px 50px" : "40px 80px",
        }}
      >
        {/* Title */}
        {title && (
          <h2
            style={{
              fontSize: titleFontSize ?? (p ? 65 : 61),
              fontWeight: 700,
              color: textColor,
              fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
              marginTop: p ? 100 : 90, // Increased margin to bring the title down
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
            gap: p ? 20 : 30, // Gap between cards and divider
            alignItems: "center", // This centers items horizontally in column (portrait mode)
            justifyContent: "center", // Center cards and divider
            position: "relative",
          }}
        >
          {/* Left Panel */}
          <div
            style={{
              opacity: cardOpacity,
              transform: `translateX(${leftCardX}px) translateY(${cardY}px) ${p ? `rotate(${pCardRotation}deg)` : ""}`,
              flexShrink: 0, // Prevent cards from shrinking
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
                width: p ? CARD_WIDTH_PORTRAIT : CARD_WIDTH_LANDSCAPE, // Updated width
                height: p ? 400 : 500, // Fixed height for constant sizes
                display: "flex", // Enable flexbox for content alignment
                flexDirection: "column",
              }}
            >
              {/* Label - positioned at top left */}
              <div
                style={{
                  position: "absolute",
                  top: p ? 20 : 24,
                  left: p ? 24 : 28,
                  fontSize: descriptionFontSize ?? (p ? 35 : 28),
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
                  fontSize: descriptionFontSize ?? (p ? 35 : 28),
                  lineHeight: 1.75,
                  color: "rgba(226,232,240,0.85)",
                  fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
                  marginTop: p ? 8 : 12,
                  flex: 1, // Allow content to take available space
                  overflow: "hidden", // Hide overflowing text
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
              // Removed margin here, gap property on parent handles spacing
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
              opacity: cardOpacity,
              transform: `translateX(${rightCardX}px) translateY(${cardY}px) ${p ? `rotate(${-pCardRotation}deg)` : ""}`, // Opposite rotation for right card
              flexShrink: 0, // Prevent cards from shrinking
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
                width: p ? CARD_WIDTH_PORTRAIT : CARD_WIDTH_LANDSCAPE, // Updated width
                height: p ? 400 : 500, // Fixed height for constant sizes
                display: "flex", // Enable flexbox for content alignment
                flexDirection: "column",
              }}
            >
              {/* Label - positioned at top left */}
              <div
                style={{
                  position: "absolute",
                  top: p ? 20 : 24,
                  left: p ? 24 : 28,
                  fontSize: descriptionFontSize ?? (p ? 35 : 28),
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
                  fontSize: descriptionFontSize ?? (p ? 35 : 28),
                  lineHeight: 1.75,
                  color: "rgba(226,232,240,0.85)",
                  fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
                  marginTop: p ? 8 : 12,
                  flex: 1, // Allow content to take available space
                  overflow: "hidden", // Hide overflowing text
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
