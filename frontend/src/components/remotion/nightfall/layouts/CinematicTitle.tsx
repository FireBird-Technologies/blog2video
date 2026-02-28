import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { DarkBackground } from "../DarkBackground";
import type { NightfallLayoutProps } from "../types";

/**
 * CinematicTitle — Enhanced Professional Version
 *
 * Improvements:
 * - Layered title reveal with mask animation
 * - Particle-like accent elements
 * - Dynamic subtitle tracking
 * - Cinematic build-up: intro text first (0–70), then hero image reveals (70+)
 * - Image appears AFTER intro text with lighter overlay so it's visible
 */

export const CinematicTitle: React.FC<NightfallLayoutProps> = ({
  title,
  narration,
  textColor,
  accentColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  imageUrl,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  // Image appears AFTER intro text (frames 70–110) — full-bleed, visible
  const imageOpacity = interpolate(
    frame,
    [70, 110],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const imageScale = interpolate(
    frame,
    [70, 150],
    [1.05, 1],
    { extrapolateRight: "clamp" }
  );

  // Title animations with spring
  const titleY = spring({
    frame: frame - 5,
    fps,
    config: { damping: 25, stiffness: 60, mass: 1.5 },
  });

  const titleOpacity = interpolate(
    frame,
    [0, 30],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  // Title scale with slight overshoot for impact
  const titleScale = spring({
    frame: frame - 5,
    fps,
    config: { damping: 15, stiffness: 80, mass: 1.2 },
  });

  // Decorative elements
  const stripWidth = interpolate(
    frame,
    [20, 50],
    [0, 100],
    { extrapolateRight: "clamp" }
  );

  const stripOpacity = interpolate(
    frame,
    [20, 45],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  // Subtitle reveal
  const subY = spring({
    frame: frame - 35,
    fps,
    config: { damping: 20, stiffness: 70 },
  });

  const subOpacity = interpolate(
    frame,
    [35, 60],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  // Accent particles
  const particles = [
    { x: 20, y: 30, delay: 15, size: 8 },
    { x: 80, y: 25, delay: 20, size: 6 },
    { x: 15, y: 70, delay: 25, size: 10 },
    { x: 85, y: 75, delay: 30, size: 7 },
  ];

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>

      {/* ── Background: dark first, then image reveals after intro ── */}
      <DarkBackground />

      {/* ── Hero image: appears AFTER intro text (frame 70+), full-bleed with lighter overlay ── */}
      {imageUrl && (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: imageOpacity,
              transform: `scale(${imageScale})`,
              transformOrigin: "center center",
            }}
          >
            <img
              src={imageUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>
          {/* Lighter overlay — image stays prominent (lower = more image visibility) */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at center, rgba(10,10,26,0.25) 0%, rgba(10,10,26,0.55) 100%)",
              opacity: imageOpacity,
              pointerEvents: "none",
            }}
          />
        </>
      )}

      {/* Accent Particles */}
      {particles.map((particle, i) => {
        const particleOpacity = interpolate(
          frame,
          [particle.delay, particle.delay + 30, particle.delay + 90],
          [0, 0.4, 0],
          { extrapolateRight: "clamp" }
        );
        const particleScale = interpolate(
          frame,
          [particle.delay, particle.delay + 30],
          [0, 1],
          { extrapolateRight: "clamp" }
        );

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: particle.size,
              height: particle.size,
              borderRadius: "50%",
              backgroundColor: accentColor,
              opacity: particleOpacity,
              transform: `scale(${particleScale})`,
              boxShadow: `0 0 20px ${accentColor}`,
              filter: "blur(1px)",
              zIndex: 2,
            }}
          />
        );
      })}

      {/* Main Content Container */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 60 : 120,
          zIndex: 2,
        }}
      >

        {/* Title — bright white text */}
        <h1
          style={{
            fontSize: titleFontSize ?? (p ? 88 : 140),
            fontWeight: 800,
            color: "#FFFFFF",
            fontFamily: "'Playfair Display', Georgia, serif",
            textAlign: "center",
            lineHeight: 1.1,
            transform: `translateY(${(1 - titleY) * 40}px) scale(${titleScale})`,
            opacity: titleOpacity,
            letterSpacing: "-0.01em",
            maxWidth: "90%",
            textShadow: `0 0 60px ${accentColor}35`,
          }}
        >
          {title}
        </h1>

        {/* Decorative Strip */}
        <div
          style={{
            width: `${stripWidth}%`,
            maxWidth: p ? 280 : 600,
            height: 3,
            marginTop: p ? 32 : 48,
            background: `linear-gradient(
              90deg,
              transparent 0%,
              ${accentColor} 50%,
              transparent 100%
            )`,
            borderRadius: 2,
            opacity: stripOpacity,
            boxShadow: `0 0 20px ${accentColor}50`,
            position: "relative",
          }}
        >
          {/* Glowing center point */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: accentColor,
              boxShadow: `0 0 30px ${accentColor}`,
            }}
          />
        </div>

        {/* Subtitle/Narration */}
        {narration && (
          <p
            style={{
              fontSize: descriptionFontSize ?? (p ? 26 : 36),
              fontWeight: 400,
              color: "rgba(226,232,240,0.45)",
              fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
              textAlign: "center",
              marginTop: p ? 28 : 36,
              maxWidth: p ? "85%" : 950,
              opacity: subOpacity * 0.95,
              transform: `translateY(${(1 - subY) * 30}px)`,
              lineHeight: 1.5,
              letterSpacing: "0.01em",
            }}
          >
            {narration}
          </p>
        )}
      </div>

      {/* Bottom accent line */}
      <div
        style={{
          position: "absolute",
          bottom: p ? 40 : 60,
          left: "50%",
          transform: "translateX(-50%)",
          width: p ? 120 : 180,
          height: 1,
          backgroundColor: `${textColor}20`,
          opacity: interpolate(frame, [60, 80], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      />
    </AbsoluteFill>
  );
};