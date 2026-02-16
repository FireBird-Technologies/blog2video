import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
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
  accentColor,
  textColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  // Prepare item list
  const list = items.length > 0 ? items : narration ? [narration] : [];
  const displayItems = list.slice(0, 3); // Max 3 for clean layout

  // Title animation
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

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground />
      
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 50 : 100,
          gap: p ? 20 : 28,
        }}
      >
        {/* Title */}
        {title && (
          <h2
            style={{
              fontSize: p ? 32 : 42,
              fontWeight: 700,
              color: textColor,
              fontFamily: "Inter, system-ui, sans-serif",
              marginBottom: p ? 20 : 28,
              opacity: titleOpacity,
              transform: `translateY(${(1 - titleY) * 30}px)`,
              textAlign: "center",
              letterSpacing: "-0.01em",
              textShadow: `0 2px 12px ${accentColor}30`,
            }}
          >
            {title}
          </h2>
        )}

        {/* Stacked Cards */}
        <div
          style={{
            position: "relative",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: p ? 16 : 20,
          }}
        >
          {displayItems.map((item, i) => {
            const delay = 20 + i * 12;
            
            // Spring animation for each card
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

            // Parallax offset — deeper cards move slower
            const parallaxOffset = (displayItems.length - i - 1) * (p ? 12 : 18);
            
            // Depth shadow — deeper cards have more shadow
            const shadowIntensity = 0.2 + (displayItems.length - i) * 0.1;

            return (
              <div
                key={i}
                style={{
                  width: p ? "92%" : "60%",
                  maxWidth: 750,
                  position: "relative",
                  marginLeft: parallaxOffset,
                  opacity: cardOpacity,
                  transform: `translateY(${(1 - cardY) * 60}px)`,
                  zIndex: displayItems.length - i,
                }}
              >
                {/* Connecting line to previous card */}
                {i > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: p ? -12 : -14,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 2,
                      height: p ? 16 : 20,
                      background: `linear-gradient(180deg, ${accentColor}40, ${accentColor}10)`,
                      opacity: cardOpacity,
                    }}
                  />
                )}

                {/* Card */}
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
                      fontSize: p ? 16 : 18,
                      fontWeight: 700,
                      color: accentColor,
                      fontFamily: "Inter, system-ui, sans-serif",
                      boxShadow: `0 0 20px ${accentColor}30`,
                    }}
                  >
                    {i + 1}
                  </div>

                  {/* Content */}
                  <p
                    style={{
                      fontSize: p ? 20 : 26,
                      fontWeight: 600,
                      color: textColor,
                      fontFamily: "Inter, system-ui, sans-serif",
                      lineHeight: 1.55,
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
    </AbsoluteFill>
  );
};