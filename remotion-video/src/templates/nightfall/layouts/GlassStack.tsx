import { AbsoluteFill, interpolate, useCurrentFrame, spring, Img, useVideoConfig } from "remotion";
import { DarkBackground } from "../DarkBackground";
import { glassCardStyle } from "../GlassCard";
import type { NightfallLayoutProps } from "../types";

/**
 * GlassStack — Enhanced Professional Version
 * 
 * Improvements:
 * - True 3D layered depth with shadows
 * - Sequential card reveals with spring physics
 * - Hover-like elevation effect
 * - Better visual hierarchy
 * - Icons or numbers for each card (optional)
 * - Smooth connecting lines between cards
 */

export const GlassStack: React.FC<NightfallLayoutProps> = ({
  title,
  items = [],
  narration,
  imageUrl,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, height: videoHeight } = useVideoConfig();
  const p = aspectRatio === "portrait";

  // Prepare item list
  const list = items.length > 0 ? items : narration ? [narration] : [];
  const displayItems = list.slice(0, 3); // Max 3 for clean layout

  // Title intro animation
  const titleIntroY = spring({
    frame: frame - 5,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  const titleIntroOpacity = interpolate(
    frame,
    [0, 25],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  // Image intro animation
  const imageIntroOpacity = interpolate(
    frame,
    [20, 45],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  const imageIntroScale = spring({
    frame: frame - 20,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  const hasImage = !!imageUrl;

  // Outro Animation for Portrait Mode
  // Starts 3 seconds before the end of the scene
  const pOutroStart = durationInFrames - 90;
  const pOutroDuration = 90; // 3 seconds
  // const pOutroEnd = pOutroStart + pOutroDuration; // Not directly used, but implied

  // Spring for the swap animation (first half of outro)
  const pSwapSpring = spring({
    frame: frame - pOutroStart,
    fps,
    config: { damping: 10, stiffness: 70 },
    durationInFrames: pOutroDuration * 0.5,
  });

  // Spring for the vanish animation (starts slightly before swap ends, continues to end)
  const pVanishSpring = spring({
    frame: frame - pOutroStart - (pOutroDuration * 0.25), // Starts 0.75s into outro, before swap finishes
    fps,
    config: { damping: 10, stiffness: 70 },
    durationInFrames: pOutroDuration * 0.75,
  });

  // Calculate translation for swapping sections in portrait mode
  const cardsOutroTranslateY = interpolate(pSwapSpring, [0, 1], [0, videoHeight / 2]);
  const imageOutroTranslateY = interpolate(pSwapSpring, [0, 1], [0, -videoHeight / 2]);

  // Calculate scale and opacity for vanishing in portrait mode
  const combinedOutroScale = interpolate(pVanishSpring, [0, 1], [1, 0.5]); // Scales down to 50%
  const combinedOutroOpacity = interpolate(pVanishSpring, [0, 1], [1, 0]); // Fades to 0

  // Base styles for the two main content sections
  const cardsSectionBaseStyle: React.CSSProperties = {
    flex: p ? 1 : (hasImage ? "0 0 55%" : "none"), // Take 50% height in portrait
    width: p ? "100%" : (hasImage ? "auto" : "100%"),
    height: p ? "50%" : "auto", // 50% height for portrait
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden", // Ensures content inside doesn't spill during transform
  };

  const imageSectionBaseStyle: React.CSSProperties = {
    flex: p ? 1 : (hasImage ? "0 0 40%" : "none"), // Take 50% height in portrait
    width: p ? "100%" : (hasImage ? "auto" : "100%"),
    height: p ? "50%" : 400, // 50% for portrait, fixed 400 for landscape
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: p ? 20 : 0, // Keep original margin for general cases if not overwritten by flex gap
  };

  // Dynamic styles that combine intro and outro animations for the main sections
  let cardsSectionDynamicStyle: React.CSSProperties = {};
  let imageSectionDynamicStyle: React.CSSProperties = {};

  if (p && frame >= pOutroStart) {
    // Apply outro animations for portrait mode
    cardsSectionDynamicStyle = {
      transform: `translateY(${cardsOutroTranslateY}px) scale(${combinedOutroScale})`,
      opacity: combinedOutroOpacity,
    };
    imageSectionDynamicStyle = {
      transform: `translateY(${imageOutroTranslateY}px) scale(${combinedOutroScale})`,
      opacity: combinedOutroOpacity,
    };
  } else {
    // Apply intro animations for all other cases (landscape/square or portrait intro)
    cardsSectionDynamicStyle = {
      transform: `translateY(${(1 - titleIntroY) * 30}px)`,
      opacity: titleIntroOpacity,
    };
    imageSectionDynamicStyle = {
      transform: `scale(${imageIntroScale})`,
      opacity: imageIntroOpacity,
    };
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground bgColor={bgColor} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: p ? "column" : hasImage ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 50 : 100,
          gap: p ? 20 : hasImage ? 40 : 28,
        }}
      >
        {/* Cards Section: Contains Title and Stacked Cards */}
        <div style={{ ...cardsSectionBaseStyle, ...cardsSectionDynamicStyle }}>
          <div // Inner wrapper to keep title and cards centered within their allocated 50% height
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {title && (
              <h2
                style={{
                  fontSize: titleFontSize ?? (p ? 81 : 71),
                  fontWeight: 600,
                  color: textColor,
                  fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
                  marginBottom: p ? 20 : 28,
                  textAlign: "center",
                  letterSpacing: "-0.01em",
                  textShadow: `0 2px 12px ${accentColor}30`,
                  // Opacity and transform are now controlled by the parent 'cardsSectionDynamicStyle'
                  // so they are removed from the h2 itself to avoid conflicts/multiplication.
                }}
              >
                {title}
              </h2>
            )}

            {/* Stacked Cards Container */}
            <div
              style={{
                position: "relative",
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0,
              }}
            >
              {displayItems.map((item, i) => {
                const delay = 20 + i * 12;

                const cardY = spring({
                  frame: frame - delay,
                  fps,
                  config: { damping: 18, stiffness: 90, mass: 0.8 },
                });

                const cardOpacity = interpolate(
                  frame,
                  [delay, delay + 25],
                  [0, 1],
                  { extrapolateRight: "clamp" }
                );

                const parallaxOffset = i * (p ? 12 : 18);
                const shadowIntensity = 0.2 + (displayItems.length - i) * 0.1;
                const overlapAmount = p ? -5 : -6;

                return (
                  <div
                    key={i}
                    style={{
                      width: p ? "98%" : "80%",
                      maxWidth: 1000,
                      position: "relative",
                      marginLeft: parallaxOffset,
                      marginTop: i > 0 ? overlapAmount : 0,
                      // Individual card intro animations should still apply.
                      // Their combined effect will be scaled/faded by the parent 'cardsSectionDynamicStyle'.
                      opacity: cardOpacity,
                      transform: `translateY(${(1 - cardY) * 60}px)`,
                      zIndex: i + 1,
                    }}
                  >
                    <div
                      style={{
                        ...glassCardStyle(accentColor, 0.09 + i * 0.01),
                        padding: p ? 32 : 40,
                        boxShadow: `
                          0 ${4 + i * 4}px ${16 + i * 8}px rgba(0, 0, 0, ${shadowIntensity}),
                          0 0 0 1px rgba(255, 255, 255, ${0.08 - i * 0.02}),
                          inset 0 1px 0 rgba(255, 255, 255, 0.1)
                        `,
                        position: "relative",
                      }}
                    >
                      {/* Card number badge */}
                      <div
                        style={{
                          position: "absolute",
                          top: p ? 16 : 20,
                          left: p ? 16 : 20,
                          width: p ? 32 : 40,
                          height: p ? 32 : 40,
                          borderRadius: "50%",
                          background: `linear-gradient(135deg, ${accentColor}40, ${accentColor}20)`,
                          border: `1.5px solid ${accentColor}60`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: descriptionFontSize ?? (p ? 44 : 40),
                          fontWeight: 700,
                          color: accentColor,
                          fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
                          boxShadow: `0 0 20px ${accentColor}30`,
                        }}
                      >
                        {i + 1}
                      </div>

                      {/* Content */}
                      <p
                        style={{
                          fontSize: descriptionFontSize ?? (p ? 44 : 40),
                          fontWeight: 400,
                          color: "rgba(226,232,240,0.85)",
                          fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
                          lineHeight: 1.5,
                          paddingLeft: p ? 48 : 60,
                          opacity: 0.95,
                        }}
                      >
                        {item}
                      </p>

                      {/* Bottom accent line */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: "15%",
                          right: "15%",
                          height: 2,
                          background: `linear-gradient(90deg, transparent, ${accentColor}30, transparent)`,
                          opacity: 0.6,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Image Section */}
        {hasImage && (
          <div style={{ ...imageSectionBaseStyle, ...imageSectionDynamicStyle }}>
            <Img
              src={imageUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: 12,
                border: `1px solid ${accentColor}30`,
              }}
            />
            {/* Image glow overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(135deg, ${accentColor}10 0%, transparent 50%)`,
                pointerEvents: "none",
              }}
            />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
