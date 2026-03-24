import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring, useVideoConfig } from "remotion";
import { DarkBackground } from "../DarkBackground";
import { glassCardStyle } from "../GlassCard";
import type { NightfallLayoutProps } from "../types";

/**
 * GlowMetric — Enhanced Professional Version
 * 
 * Improvements:
 * - Spring physics for organic motion
 * - Multi-ring glow effect for depth
 * - Staggered secondary metrics reveal
 * - Improved visual hierarchy
 * - Better number formatting
 * - Particle effect hints
 */

export const GlowMetric: React.FC<NightfallLayoutProps> = ({
  title,
  imageUrl,
  accentColor,
  bgColor,
  textColor,
  metrics = [],
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig(); // Get duration and fps from video config
  const p = aspectRatio === "portrait";

  // Enhanced spring-based animations for card entrance
  const cardY = spring({
    frame: frame - 5,
    fps,
    config: { damping: 20, stiffness: 80, mass: 1 },
  });
  
  const cardOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Primary metric animations
  const primaryScale = spring({
    frame: frame - 15,
    fps,
    config: { damping: 18, stiffness: 100, mass: 0.8 },
  });

  const primaryNum = metrics[0]
    ? parseFloat(metrics[0].value.replace(/[^0-9.-]/g, "")) || 0
    : 0;
  
  const animatedNum = interpolate(
    frame,
    [15, 55],
    [0, primaryNum],
    { extrapolateRight: "clamp" }
  );

  // Rotating rings with different speeds
  const ring1Rotation = interpolate(frame, [15, 90], [0, 360], {
    extrapolateRight: "extend",
  });
  const ring2Rotation = interpolate(frame, [15, 120], [0, -360], {
    extrapolateRight: "extend",
  });
  
  const ringOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Pulsing glow effect
  const glowIntensity = 0.5 + Math.sin(frame / 20) * 0.5;

  // Image animation
  const imageOpacity = interpolate(
    frame,
    [20, 45],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  const imageScale = spring({
    frame: frame - 20,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  // Format number with commas for readability
  const formatNumber = (num: number): string => {
    const rounded = Math.floor(num);
    return rounded.toLocaleString();
  };

  const hasImage = !!imageUrl;

  // Calculate effective font sizes based on descriptionFontSize for proportional scaling
  const effectiveDescriptionFontSize = descriptionFontSize ?? (p ? 42 : 30);

  // Scaling factors for primary metric value (number)
  const primaryMetricValueFontSize = effectiveDescriptionFontSize * (p ? (40 / 18) : (50 / 20)); // From 40px/18px in P, 50px/20px in L
  const primaryMetricSuffixFontSize = effectiveDescriptionFontSize * (p ? (36 / 18) : (45 / 20)); // From 36px/18px in P, 45px/20px in L

  // Scaling factors for secondary metric labels
  const secondaryMetricLabelFontSize = effectiveDescriptionFontSize * (p ? (13 / 18) : (14 / 20)); // From 13px/18px in P, 14px/20px in L


  // OUTRO ANIMATION: Portrait Mode - Sections move left and right
  const OUTRO_DURATION_FRAMES = 60; // The total duration of the outro animation
  const OUTRO_START_FRAME = durationInFrames - OUTRO_DURATION_FRAMES; 

  let portraitImageOutroTranslateX = 0; // in % relative to its own width
  let portraitMetricsOutroTranslateX = 0; // in % relative to its own width

  if (p) {
    const outroProgress = interpolate(
      frame,
      [OUTRO_START_FRAME, durationInFrames], // From start of outro to end of video
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    // Image section (top) moves left. 150% to ensure it's fully off-screen.
    portraitImageOutroTranslateX = outroProgress * -150; 
    
    // Metrics section (bottom) moves right. 150% to ensure it's fully off-screen.
    portraitMetricsOutroTranslateX = outroProgress * 150;
  }

  // Combine image section entrance animations with portrait outro animations
  // Outro for image section only affects translateX. Opacity and scale remain from entrance.
  const combinedImageOpacity = imageOpacity; // No outro specific opacity
  const combinedImageTransform = p
    ? `translateX(${portraitImageOutroTranslateX}%) scale(${imageScale})` // Use translateX
    : `scale(${imageScale})`;

  // Combine metrics section default state with portrait outro animations
  // Outro for metrics section only affects translateX. Opacity and scale are 1.
  const combinedMetricsOpacity = 1; // No outro specific opacity
  const combinedMetricsTransform = p
    ? `translateX(${portraitMetricsOutroTranslateX}%)` // Use translateX
    : "";

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground bgColor={bgColor} />
      
      {/* Outer container for centering (landscape) or full screen layout (portrait) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: p ? "stretch" : "center", // Stretch for portrait, center for landscape
          justifyContent: p ? "flex-start" : "center", // Align top for portrait, center for landscape
          padding: p ? 0 : 100, // No padding for full screen portrait, generous for landscape
          flexDirection: p ? "column" : "row", // Column for portrait, row for landscape
        }}
      >
        {/* Main Card Container with glass effect */}
        <div
          style={{
            ...glassCardStyle(accentColor, 0.1),
            padding: p ? 0 : 80, // No padding for portrait, inner sections will define. Generous for landscape.
            minWidth: p ? "100%" : (hasImage ? 1000 : 500), // Full width for portrait, wider for landscape with image
            maxWidth: p ? "100%" : (hasImage ? 1400 : 600), // Full width for portrait, wider for landscape with image
            width: p ? "100%" : "auto", // Full width for portrait, auto for landscape
            height: p ? "100%" : "auto", // Full height for portrait, auto for landscape
            opacity: cardOpacity, // Card entrance opacity, stays 1 after entrance
            transform: `translateY(${(1 - cardY) * 30}px)`, // Card entrance transform, stays 0px after entrance
            position: "relative",
            display: "flex",
            flexDirection: p ? "column" : (hasImage ? "row" : "column"), // Column for portrait, row for landscape with image
            gap: p ? 0 : (hasImage ? 32 : 0), // No gap for portrait, adjusted for landscape
            alignItems: p ? "stretch" : "center", // Stretch for portrait, center for landscape
            borderRadius: p ? 0 : 12, // No border radius for full screen portrait, keep for landscape
            overflow: "hidden", // Crucial for containing inner sections
          }}
        >
          {/* Ambient glow behind card - moved here to be a child of the main card container */}
          <div
            style={{
              position: "absolute",
              inset: -40,
              background: `radial-gradient(circle at center, ${accentColor}${Math.floor(glowIntensity * 40).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
              filter: "blur(40px)",
              zIndex: -1,
              pointerEvents: "none",
            }}
          />

          {/* Image Section */}
          {hasImage && (
            <div
              style={{
                flex: p ? 1 : "0 0 55%", // Adjusted from 60% to 55% for landscape mode to make image slightly smaller
                width: p ? "100%" : "auto",
                height: p ? "auto" : "100%", // Auto height for portrait (flex handles), 100% height for landscape
                position: "relative",
                borderRadius: p ? 0 : 12, // No radius for portrait, keep for landscape
                overflow: "hidden",
                marginBottom: 0, // No margin, flex handles spacing
                opacity: combinedImageOpacity, // Combined entrance and outro opacity
                transform: combinedImageTransform, // Combined entrance and outro transform
              }}
            >
              <Img
                src={imageUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover", // Always cover to fill space
                  borderRadius: p ? 0 : 12, // No radius for portrait, keep for landscape
                  border: p ? "none" : `1px solid ${accentColor}30`, // No border for portrait, keep for landscape
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

          {/* Metrics Section */}
          <div
            style={{
              flex: p ? 1 : (hasImage && !p ? 1 : "none"), // Take 50% height for portrait, remaining width for landscape
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              height: p ? "auto" : "100%", // Auto height for portrait (flex handles), 100% height for landscape
              justifyContent: p ? "center" : "flex-start", // Center content vertically in portrait
              padding: p ? 56 : 0, // Add internal padding to metrics section in portrait
              // The main card already has glassCardStyle, so no need to apply background here unless layered effect is desired.
              // For portrait, this section visually appears as the bottom half of the glass card.
              borderRadius: p ? 0 : 12, // No radius for portrait, keep for landscape
              opacity: combinedMetricsOpacity, // Outro opacity for portrait
              transform: combinedMetricsTransform, // Outro transform for portrait
            }}
          >
            {/* Title */}
            {title && (
              <h3
                style={{
                  fontSize: titleFontSize ?? (p ? 86 : 50),
                  fontWeight: 600,
                  color: textColor,
                  opacity: 0.8,
                  fontFamily: fontFamily ?? "'Playfair Display', Georgia, serif",
                  marginBottom: p ? 24 : 56, // Adjusted margin for portrait
                  textAlign: "center",
                  letterSpacing: "0.02em",
                }}
              >
                {title}
              </h3>
            )}

            {/* Primary Metric with Multi-Ring Glow */}
            {metrics[0] && (
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  marginBottom: metrics.length > 1 ? (p ? 24 : 48) : 0, // Adjusted margin for portrait
                }}
              >
                {/* Outer ring */}
                <div
                  style={{
                    width: p ? 140 : 180,
                    height: p ? 140 : 180,
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: `translate(-50%, -50%) rotate(${ring1Rotation}deg)`,
                    borderRadius: "50%",
                    border: "2px solid transparent",
                    borderTopColor: accentColor,
                    borderRightColor: `${accentColor}60`,
                    boxShadow: `0 0 40px ${accentColor}${Math.floor(glowIntensity * 80).toString(16).padStart(2, '0')}`,
                    opacity: ringOpacity,
                  }}
                />

                {/* Inner ring (counter-rotation) */}
                <div
                  style={{
                    width: p ? 120 : 150,
                    height: p ? 120 : 150,
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: `translate(-50%, -50%) rotate(${ring2Rotation}deg)`,
                    borderRadius: "50%",
                    border: "2px solid transparent",
                    borderBottomColor: `${accentColor}40`,
                    borderLeftColor: `${accentColor}20`,
                    opacity: ringOpacity * 0.7,
                  }}
                />

                {/* Number */}
                <div
                  style={{
                    fontSize: primaryMetricValueFontSize, // Scaled with descriptionFontSize
                    fontWeight: 800,
                    color: textColor,
                    fontFamily: fontFamily ?? "'Playfair Display', Georgia, serif",
                    textAlign: "center",
                    lineHeight: 1,
                    transform: `scale(${primaryScale})`,
                    textShadow: `0 0 20px ${accentColor}35`,
                    position: "relative",
                    zIndex: 1,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {formatNumber(animatedNum)}
                  <span
                    style={{
                      color: accentColor,
                      fontSize: primaryMetricSuffixFontSize, // Scaled with descriptionFontSize
                      marginLeft: 4,
                    }}
                  >
                    {metrics[0].suffix || "%"}
                  </span>
                </div>

                {/* Label */}
                {metrics[0].label && (
                  <p
                    style={{
                      fontSize: effectiveDescriptionFontSize, // Uses effectiveDescriptionFontSize
                      color: "rgba(226,232,240,0.45)",
                      fontFamily: fontFamily ?? "'Playfair Display', Georgia, serif",
                      marginTop: p ? 12 : 18, // Adjusted margin for portrait
                      textAlign: "center",
                      fontWeight: 400,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    {metrics[0].label}
                  </p>
                )}
              </div>
            )}

            {/* Secondary Metrics — Staggered Reveal */}
            {metrics.length > 1 && (
              <div
                style={{
                  display: "flex",
                  gap: p ? 24 : 48, // Adjusted gap for portrait
                  marginTop: p ? 24 : 40, // Adjusted margin for portrait
                  justifyContent: "center",
                  flexWrap: p ? "wrap" : "nowrap", // Ensure secondary metrics stay in one row for landscape
                  paddingTop: p ? 24 : 32, // Adjusted padding for portrait
                  borderTop: `1px solid rgba(255, 255, 255, 0.1)`,
                }}
              >
                {metrics.slice(1, 4).map((m, i) => {
                  const delay = 40 + i * 10;
                  const secondaryY = spring({
                    frame: frame - delay,
                    fps,
                    config: { damping: 20, stiffness: 90 },
                  });
                  const secondaryOp = interpolate(
                    frame,
                    [delay, delay + 20],
                    [0, 1],
                    { extrapolateRight: "clamp" }
                  );

                  return (
                    <div
                      key={i}
                      style={{
                        textAlign: "center",
                        minWidth: p ? 90 : 110,
                        opacity: secondaryOp,
                        transform: `translateY(${(1 - secondaryY) * 20}px)`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: titleFontSize ?? (p ? 86 : 50),
                          fontWeight: 700,
                          color: accentColor,
                          fontFamily: fontFamily ?? "'Playfair Display', Georgia, serif",
                          lineHeight: 1,
                        }}
                      >
                        {m.value}
                        {m.suffix && (
                          <span
                            style={{
                              fontSize: descriptionFontSize ?? (p ? 42 : 30),
                              opacity: 0.8,
                              marginLeft: 2,
                            }}
                          >
                            {m.suffix}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: secondaryMetricLabelFontSize, // Scaled with descriptionFontSize
                          color: textColor,
                          opacity: 0.6,
                          fontFamily: fontFamily ?? "'Playfair Display', Georgia, serif",
                          marginTop: 8,
                          fontWeight: 500,
                          letterSpacing: "0.02em",
                          textTransform: "uppercase",
                        }}
                      >
                        {m.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
