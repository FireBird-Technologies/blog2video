import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { DarkBackground } from "../DarkBackground";
import { glassCardStyle } from "../GlassCard";
import type { NightfallLayoutProps } from "../types";

/**
 * GlassNarrative — Enhanced Professional Version
 * 
 * Improvements:
 * - Layered card depth with shadow variations
 * - Reading-optimized typography
 * - Progressive text reveal
 * - Accent color integration for emphasis
 * - Better content hierarchy
 * - Subtle floating animation for life
 * - Image support: shows image alongside text when available
 * - Portrait mode: image large, then title, then narration
 */

export const GlassNarrative: React.FC<NightfallLayoutProps> = ({
  title,
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
  const fps = 30;
  const p = aspectRatio === "portrait";

  // Card entrance with spring
  const cardY = spring({
    frame: frame - 5,
    fps,
    config: { damping: 22, stiffness: 75, mass: 1 },
  });

  const cardOpacity = interpolate(
    frame,
    [0, 30],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  // Title reveal
  const titleOpacity = interpolate(
    frame,
    [10, 35],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  const titleY = interpolate(
    frame,
    [10, 35],
    [20, 0],
    { extrapolateRight: "clamp" }
  );

  // Narration reveal (slightly delayed)
  const narrationOpacity = interpolate(
    frame,
    [25, 50],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  const narrationY = interpolate(
    frame,
    [25, 50],
    [15, 0],
    { extrapolateRight: "clamp" }
  );

  // Subtle floating effect
  const floatY = Math.sin(frame / 60) * 3;

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

  // Split narration into paragraphs if it contains line breaks
  const paragraphs = narration.split('\n').filter(p => p.trim());
  const hasImage = !!imageUrl;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground bgColor={bgColor} />
      
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
        {/* Ambient glow behind card */}
        <div
          style={{
            position: "absolute",
            width: p ? "95%" : hasImage ? "92%" : "75%",
            maxWidth: hasImage ? 1400 : 950,
            // Increased height for portrait with image to accommodate more content
            height: p ? (hasImage ? 800 : 400) : (hasImage ? 600 : 500), 
            background: `radial-gradient(ellipse at center, ${accentColor}15 0%, transparent 70%)`,
            filter: "blur(60px)",
            opacity: cardOpacity * 0.6,
          }}
        />

        {/* Main Card */}
        <div
          style={{
            ...glassCardStyle(accentColor, 0.1),
            width: p ? "95%" : hasImage ? "92%" : "75%",
            maxWidth: hasImage ? 1400 : 950,
            // Adjust padding based on portrait and image presence
            padding: p ? (hasImage ? 60 : 44) : (hasImage ? 72 : 64), 
            transform: `translateY(${(1 - cardY) * 50 + floatY}px)`,
            opacity: cardOpacity,
            position: "relative",
            boxShadow: `
              0 8px 32px rgba(0, 0, 0, 0.3),
              0 0 0 1px rgba(255, 255, 255, 0.05),
              inset 0 1px 0 rgba(255, 255, 255, 0.08)
            `,
            display: "flex",
            flexDirection: "column",
            // Adjust gap within the card based on image and portrait
            gap: hasImage ? (p ? 32 : 32) : 0, 
          }}
        >
          {/* Top accent line */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "10%",
              width: "80%",
              height: 2,
              background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)`,
              opacity: cardOpacity,
            }}
          />

          {/* Title - shown at top when image exists AND NOT IN PORTRAIT */}
          {hasImage && !p && (
            <h2
              style={{
                fontSize: titleFontSize ?? (p ? 76 : 63), // Default for landscape with image
                fontWeight: 700,
                color: textColor,
                fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
                marginBottom: 32, // Default for landscape
                lineHeight: 1.25,
                letterSpacing: "-0.01em",
                opacity: titleOpacity,
                transform: `translateY(${titleY}px)`,
                width: "100%",
              }}
            >
              {title}
            </h2>
          )}

          {/* Content Row: Image + Text */}
          <div
            style={{
              display: "flex",
              // Layout image and text in a row for landscape (if image), column otherwise
              flexDirection: hasImage && !p ? "row" : "column", 
              // Gap between image and text section
              gap: hasImage ? (p ? 32 : 40) : 0, 
              alignItems: hasImage && !p ? "flex-start" : "stretch",
            }}
          >
            {/* Image Section */}
            {hasImage && (
              <div
                style={{
                  flex: p ? "none" : "0 0 42%",
                  width: p ? "100%" : "auto",
                  // Make image larger in portrait mode with image
                  height: p && hasImage ? 400 : (p ? 220 : 380), 
                  position: "relative",
                  opacity: imageOpacity,
                  transform: `scale(${imageScale})`,
                  borderRadius: 12,
                  overflow: "hidden",
                  // Add more margin below image in portrait mode with image
                  marginBottom: p && hasImage ? 30 : (p ? 20 : 0), 
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

            {/* Text Content */}
            <div
              style={{
                flex: hasImage && !p ? 1 : "none",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Title - shown here when no image OR in portrait mode (below image) */}
              {(!hasImage || p) && (
                <h2
                  style={{
                    // Adjust font size for title based on portrait, image presence
                    fontSize: titleFontSize ?? (p ? (hasImage ? 40 : 36) : 46), 
                    fontWeight: 700,
                    color: textColor,
                    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
                    marginBottom: 28,
                    lineHeight: 1.25,
                    letterSpacing: "-0.01em",
                    opacity: titleOpacity,
                    transform: `translateY(${titleY}px)`,
                  }}
                >
                  {title}
                </h2>
              )}

              {/* Narration Content */}
              <div
                style={{
                  opacity: narrationOpacity,
                  transform: `translateY(${narrationY}px)`,
                  // Adjust font size for narration based on portrait, image presence
                  fontSize: descriptionFontSize ?? (p ? 34 : 36), 
                  lineHeight: 1.8,
                  color: "rgba(226,232,240,0.8)",
                  fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
                }}
              >
                {paragraphs.length > 1 ? (
                  // Multiple paragraphs with drop cap on first paragraph
                  paragraphs.map((para, i) => {
                    const firstLetter = i === 0 ? para[0] : null;
                    const rest = i === 0 ? para.slice(1) : para;
                    return (
                      <p
                        key={i}
                        style={{
                          marginBottom: i < paragraphs.length - 1 ? 20 : 0,
                        }}
                      >
                        {firstLetter && (
                          <span
                            style={{
                              float: "left",
                              fontSize: p ? 120 : 140,
                              lineHeight: 0.85,
                              fontFamily: "'Playfair Display', Georgia, serif",
                              color: accentColor,
                              fontWeight: 700,
                              marginRight: 12,
                              marginTop: p ? 4 : 8,
                              textShadow: `0 0 30px ${accentColor}50, 0 0 60px ${accentColor}30`,
                              filter: `drop-shadow(0 0 8px ${accentColor}40)`,
                            }}
                          >
                            {firstLetter}
                          </span>
                        )}
                        {rest}
                      </p>
                    );
                  })
                ) : (
                  // Single paragraph with drop cap
                  (() => {
                    const firstLetter = narration[0];
                    const rest = narration.slice(1);
                    return (
                      <p>
                        <span
                          style={{
                            float: "left",
                            fontSize: p ? 120 : 140,
                            lineHeight: 0.85,
                            fontFamily: "'Playfair Display', Georgia, serif",
                            color: accentColor,
                            fontWeight: 700,
                            marginRight: 12,
                            marginBottom: 4,
                            textShadow: `0 0 30px ${accentColor}50, 0 0 60px ${accentColor}30`,
                            filter: `drop-shadow(0 0 8px ${accentColor}40)`,
                          }}
                        >
                          {firstLetter}
                        </span>
                        {rest}
                      </p>
                    );
                  })()
                )}
              </div>
            </div>
          </div>

          {/* Decorative corner accent */}
          <div
            style={{
              position: "absolute",
              bottom: p ? 24 : 32,
              right: p ? 24 : 32,
              width: 40,
              height: 40,
              borderRight: `2px solid ${accentColor}30`,
              borderBottom: `2px solid ${accentColor}30`,
              borderRadius: "0 0 4px 0",
              opacity: cardOpacity * 0.5,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
