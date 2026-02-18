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
 */

export const GlassNarrative: React.FC<NightfallLayoutProps> = ({
  title,
  narration,
  imageUrl,
  accentColor,
  textColor,
  aspectRatio,
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
        {/* Ambient glow behind card */}
        <div
          style={{
            position: "absolute",
            width: p ? "95%" : hasImage ? "95%" : "75%",
            maxWidth: hasImage ? 1200 : 950,
            height: p ? 400 : 500,
            background: `radial-gradient(ellipse at center, ${accentColor}15 0%, transparent 70%)`,
            filter: "blur(60px)",
            opacity: cardOpacity * 0.6,
          }}
        />

        {/* Main Card */}
        <div
          style={{
            ...glassCardStyle(accentColor, 0.1),
            width: p ? "95%" : hasImage ? "95%" : "75%",
            maxWidth: hasImage ? 1200 : 950,
            padding: p ? 44 : 64,
            transform: `translateY(${(1 - cardY) * 50 + floatY}px)`,
            opacity: cardOpacity,
            position: "relative",
            boxShadow: `
              0 8px 32px rgba(0, 0, 0, 0.3),
              0 0 0 1px rgba(255, 255, 255, 0.05),
              inset 0 1px 0 rgba(255, 255, 255, 0.08)
            `,
            display: "flex",
            flexDirection: hasImage && !p ? "row" : "column",
            gap: hasImage ? (p ? 24 : 32) : 0,
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

          {/* Image Section */}
          {hasImage && (
            <div
              style={{
                flex: p ? "none" : "0 0 40%",
                width: p ? "100%" : "auto",
                height: p ? 200 : "auto",
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

          {/* Text Content */}
          <div
            style={{
              flex: hasImage && !p ? 1 : "none",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Title */}
            <h2
              style={{
                fontSize: p ? 36 : 46,
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

            {/* Narration Content */}
            <div
              style={{
                opacity: narrationOpacity,
                transform: `translateY(${narrationY}px)`,
                fontSize: 25,
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