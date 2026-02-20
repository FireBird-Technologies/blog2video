import { AbsoluteFill, interpolate, useCurrentFrame, spring, Img } from "remotion";
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
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
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

  const hasImage = !!imageUrl;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground />
      
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
        {/* Left Side - Title and Stacked Cards */}
        <div
          style={{
            flex: hasImage && !p ? "0 0 55%" : "none",
            width: hasImage && !p ? "auto" : "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Title */}
          {title && (
            <h2
              style={{
                fontSize: titleFontSize ?? (p ? 34 : 42),
                fontWeight: 600,
                color: textColor,
                fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
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
              gap: 0,
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

            // Parallax offset — cards move to the right as they go down
            const parallaxOffset = i * (p ? 12 : 18);
            
            // Depth shadow — deeper cards have more shadow
            const shadowIntensity = 0.2 + (displayItems.length - i) * 0.1;

            // Overlap amount - each card overlaps the one below by this amount (reduced)
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
                  opacity: cardOpacity,
                  transform: `translateY(${(1 - cardY) * 60}px)`,
                  zIndex: i + 1, // Reverse z-index: bottom cards on top
                }}
              >

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
                      fontSize: descriptionFontSize ?? (p ? 16 : 18),
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
                      fontSize: descriptionFontSize ?? (p ? 26 : 30),
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

        {/* Right Side - Image */}
        {hasImage && (
          <div
            style={{
              flex: p ? "none" : "0 0 40%",
              width: p ? "100%" : "auto",
              height: p ? 200 : 400,
              position: "relative",
              opacity: imageOpacity,
              transform: `scale(${imageScale})`,
              borderRadius: 12,
              overflow: "hidden",
              marginTop: p ? 20 : 0,
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
      </div>
    </AbsoluteFill>
  );
};