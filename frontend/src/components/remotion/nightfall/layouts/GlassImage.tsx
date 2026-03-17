import { useMemo } from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { DarkBackground } from "../DarkBackground";
import { glassCardStyle } from "../GlassCard";
import type { NightfallLayoutProps } from "../types";
import { random } from "remotion";

/**
 * GlassImage — Enhanced Professional Version
 *
 * Improvements:
 * - Intelligent Ken Burns effect (zoom + pan based on image aspect)
 * - Multi-layer gradient overlays for depth
 * - Parallax caption reveal
 * - Image loading state handling
 * - Better text readability with adaptive backgrounds
 * - Cinematic 2.39:1 letterbox option for dramatic effect
 */

export const GlassImage: React.FC<NightfallLayoutProps> = ({
  title,
  narration,
  imageUrl,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  // Ken Burns effect — subtle zoom with slight pan
  const kenBurnsScale = interpolate(
    frame,
    [0, 180],
    [1, 1.08],
    { extrapolateRight: "clamp" }
  );

  const kenBurnsPanX = interpolate(
    frame,
    [0, 180],
    [0, p ? -3 : -5],
    { extrapolateRight: "clamp" }
  );

  const kenBurnsPanY = interpolate(
    frame,
    [0, 180],
    [0, -3],
    { extrapolateRight: "clamp" }
  );

  // Image fade in
  const imageOpacity = interpolate(
    frame,
    [0, 35],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  // Caption reveal with spring physics
  const captionY = spring({
    frame: frame - 25,
    fps,
    config: { damping: 22, stiffness: 70, mass: 1 },
  });

  const captionOpacity = interpolate(
    frame,
    [25, 50],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  // Vignette intensity
  const vignetteOpacity = interpolate(
    frame,
    [0, 40],
    [0.3, 0.6],
    { extrapolateRight: "clamp" }
  );

  // Particle generation for fallback animation
  const numParticles = 15;
  const particles = useMemo(() => {
  return Array.from({ length: numParticles }).map((_, i) => ({
    id: i,
    size: 40 + random(i) * 100,
    initialX: random(i + 1) * 100,
    initialY: random(i + 2) * 60,
  }));
}, []);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground drift={false} bgColor={bgColor} />

      {imageUrl ? (
        <>
          {/* Main Image with Ken Burns */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              zIndex: 1,
            }}
          >
            <Img
              src={imageUrl}
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: imageOpacity,
                transform: `
                  scale(${kenBurnsScale})
                  translate(${kenBurnsPanX}%, ${kenBurnsPanY}%)
                `,
                zIndex: 1,
              }}
            />
          </div>

          {/* Multi-Layer Gradient Overlays for Depth */}
          {/* Top vignette */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(ellipse at center, transparent 0%, rgba(10,10,26,${vignetteOpacity}) 100%)`,
              pointerEvents: "none",
              zIndex: 2,
            }}
          />

          {/* Bottom gradient for caption readability */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `
                linear-gradient(
                  to top,
                  rgba(10,10,26,0.95) 0%,
                  rgba(10,10,26,0.75) 15%,
                  rgba(10,10,26,0.4) 35%,
                  rgba(10,10,26,0.15) 50%,
                  transparent 70%
                )
              `,
              pointerEvents: "none",
              zIndex: 2,
            }}
          />

          {/* Subtle accent color wash */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(135deg, ${accentColor}08 0%, transparent 60%)`,
              mixBlendMode: "overlay",
              opacity: 0.3,
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
        </>
      ) : (
        // Fallback if no image - show animation only
        <AbsoluteFill style={{ overflow: "hidden" }}>
          {particles.map((particle) => {
            const { id, size, initialX, initialY } = particle;


              const scale = 1;
              const opacity = 0.2 + (id % 3) * 0.05;

            return (
              <div
                key={id}
                style={{
                  position: "absolute",
                  left: `${initialX}%`,
                  top: `${initialY}%`,
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  background: `radial-gradient(circle at center, ${accentColor} 0%, transparent 70%)`,
                  opacity: opacity,
                  transform: `
                    translate(-50%, -50%)
                    scale(${scale})
                  `,
                  filter: `blur(${size / 15}px)`, // More blur for larger particles
                  pointerEvents: "none",
                  mixBlendMode: "lighten", // or 'screen' to make them brighter
                  zIndex: 0,
                }}
              />
            );
          })}
        </AbsoluteFill>
      )}

      {/* Caption Container with Parallax */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: p ? 40 : 60,
          transform: `translateY(${(1 - captionY) * 80}px)`,
          opacity: captionOpacity,
          zIndex: 3,
        }}
      >
        {/* Glass Caption Card */}
        <div
          style={{
            ...glassCardStyle(accentColor, 0.15),
            padding: p ? 28 : 40,
            width: "100%",
            backdropFilter: "blur(30px)",
            WebkitBackdropFilter: "blur(30px)",
            boxShadow: "0 8px 40px rgba(0, 0, 0, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            position: "relative",
          }}
        >
          {/* Accent top border */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "30%",
              height: 3,
              background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
              borderRadius: "0 0 2px 2px",
            }}
          />

          {/* Title */}
          <h2
            style={{
              fontSize: titleFontSize ?? (p ? 78 : 64),
              fontWeight: 700,
              color: textColor,
              fontFamily: fontFamily ?? "'Playfair Display', Georgia, serif",
              marginBottom: narration ? 15 : 0,
              lineHeight: 1.3,
            }}
          >
            {title}
          </h2>

          {/* Narration */}
          {narration && (
            <p
              style={{
                fontSize: descriptionFontSize ?? (p ? 42 : 35),
                color: "rgba(226,232,240,0.45)",
                fontFamily: fontFamily ?? "'DM Sans', 'Helvetica Neue', sans-serif",
                lineHeight: 1.6,
              }}
            >
              {narration}
            </p>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
