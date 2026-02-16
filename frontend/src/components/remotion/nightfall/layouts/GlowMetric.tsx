import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
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
  textColor,
  metrics = [],
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  // Enhanced spring-based animations
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

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground />
      
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 50 : 100,
        }}
      >
        <div
          style={{
            ...glassCardStyle(accentColor, 0.1),
            padding: p ? 56 : 80,
            minWidth: p ? 320 : hasImage ? 800 : 500,
            maxWidth: hasImage ? 1200 : 600,
            opacity: cardOpacity,
            transform: `translateY(${(1 - cardY) * 30}px)`,
            position: "relative",
            display: "flex",
            flexDirection: p ? "column" : hasImage ? "row" : "column",
            gap: hasImage ? (p ? 24 : 32) : 0,
            alignItems: "center",
          }}
        >
          {/* Image Section */}
          {hasImage && (
            <div
              style={{
                flex: p ? "none" : "0 0 40%",
                width: p ? "100%" : "auto",
                height: p ? 200 : 300,
                position: "relative",
                opacity: imageOpacity,
                transform: `scale(${imageScale})`,
                borderRadius: 12,
                overflow: "hidden",
                marginBottom: p ? 20 : 0,
              }}
            >
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

          {/* Metrics Section */}
          <div
            style={{
              flex: hasImage && !p ? 1 : "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
            }}
          >
            {/* Ambient glow behind card */}
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

            {/* Title */}
            {title && (
              <h3
                style={{
                  fontSize: p ? 20 : 24,
                  fontWeight: 600,
                  color: textColor,
                  opacity: 0.8,
                  fontFamily: "Inter, system-ui, sans-serif",
                  marginBottom: 32,
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
                  marginBottom: metrics.length > 1 ? 48 : 0,
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
                    fontSize: p ? 72 : 96,
                    fontWeight: 800,
                    color: textColor,
                    fontFamily: "Inter, system-ui, sans-serif",
                    textAlign: "center",
                    lineHeight: 1,
                    transform: `scale(${primaryScale})`,
                    textShadow: `0 0 30px ${accentColor}40`,
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {formatNumber(animatedNum)}
                  <span
                    style={{
                      color: accentColor,
                      fontSize: p ? 48 : 60,
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
                      fontSize: p ? 16 : 18,
                      color: textColor,
                      opacity: 0.7,
                      fontFamily: "Inter, system-ui, sans-serif",
                      marginTop: 20,
                      textAlign: "center",
                      fontWeight: 500,
                      letterSpacing: "0.03em",
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
                  gap: p ? 32 : 48,
                  marginTop: 40,
                  justifyContent: "center",
                  flexWrap: "wrap",
                  paddingTop: 32,
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
                          fontSize: p ? 36 : 44,
                          fontWeight: 700,
                          color: accentColor,
                          fontFamily: "Inter, system-ui, sans-serif",
                          lineHeight: 1,
                        }}
                      >
                        {m.value}
                        {m.suffix && (
                          <span
                            style={{
                              fontSize: p ? 20 : 24,
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
                          fontSize: p ? 13 : 14,
                          color: textColor,
                          opacity: 0.6,
                          fontFamily: "Inter, system-ui, sans-serif",
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