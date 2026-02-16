import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { DarkBackground } from "../DarkBackground";
import type { NightfallLayoutProps } from "../types";

/**
 * ChapterBreak — Enhanced Professional Version
 * 
 * Improvements:
 * - Elegant number reveal with mask effect
 * - Ornamental frame elements
 * - Breathing space with better pacing
 * - Gradient text effects
 * - Decorative corner accents
 * - Chapter progress indicator
 */

export const ChapterBreak: React.FC<NightfallLayoutProps> = ({
  title,
  narration,
  chapterNumber = 1,
  subtitle,
  textColor,
  accentColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  // Chapter number reveal
  const numScale = spring({
    frame: frame - 5,
    fps,
    config: { damping: 25, stiffness: 50, mass: 2 },
  });

  const numOpacity = interpolate(
    frame,
    [5, 35],
    [0, 0.18],
    { extrapolateRight: "clamp" }
  );

  // Title reveal
  const titleY = spring({
    frame: frame - 25,
    fps,
    config: { damping: 20, stiffness: 70 },
  });

  const titleOpacity = interpolate(
    frame,
    [25, 50],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  // Decorative lines
  const lineWidth = interpolate(
    frame,
    [15, 45],
    [0, 100],
    { extrapolateRight: "clamp" }
  );

  const lineOpacity = interpolate(
    frame,
    [15, 40],
    [0, 0.3],
    { extrapolateRight: "clamp" }
  );

  const sub = subtitle || narration || title;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground drift={false} />

      {/* Decorative corner frames */}
      <div
        style={{
          position: "absolute",
          top: p ? 40 : 60,
          left: p ? 40 : 60,
          width: p ? 60 : 80,
          height: p ? 60 : 80,
          borderTop: `2px solid ${accentColor}`,
          borderLeft: `2px solid ${accentColor}`,
          opacity: lineOpacity,
          borderRadius: "2px 0 0 0",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: p ? 40 : 60,
          right: p ? 40 : 60,
          width: p ? 60 : 80,
          height: p ? 60 : 80,
          borderTop: `2px solid ${accentColor}`,
          borderRight: `2px solid ${accentColor}`,
          opacity: lineOpacity,
          borderRadius: "0 2px 0 0",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: p ? 40 : 60,
          left: p ? 40 : 60,
          width: p ? 60 : 80,
          height: p ? 60 : 80,
          borderBottom: `2px solid ${accentColor}`,
          borderLeft: `2px solid ${accentColor}`,
          opacity: lineOpacity,
          borderRadius: "0 0 0 2px",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: p ? 40 : 60,
          right: p ? 40 : 60,
          width: p ? 60 : 80,
          height: p ? 60 : 80,
          borderBottom: `2px solid ${accentColor}`,
          borderRight: `2px solid ${accentColor}`,
          opacity: lineOpacity,
          borderRadius: "0 0 2px 0",
        }}
      />

      {/* Main content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 60 : 100,
        }}
      >
        {/* Chapter label */}
        <div
          style={{
            fontSize: p ? 12 : 14,
            fontWeight: 600,
            color: textColor,
            opacity: titleOpacity * 0.6,
            fontFamily: "Inter, system-ui, sans-serif",
            letterSpacing: 4,
            textTransform: "uppercase",
            marginBottom: p ? 16 : 24,
          }}
        >
          Chapter
        </div>

        {/* Giant chapter number */}
        <div
          style={{
            fontSize: p ? 160 : 240,
            fontWeight: 200,
            color: textColor,
            opacity: numOpacity,
            fontFamily: "Inter, system-ui, sans-serif",
            lineHeight: 1,
            transform: `scale(${numScale})`,
            position: "relative",
            textShadow: `0 0 60px ${accentColor}30`,
          }}
        >
          {chapterNumber}
          
          {/* Gradient overlay on number */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(180deg, transparent 0%, ${accentColor}15 100%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            }}
          />
        </div>

        {/* Decorative horizontal lines */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: p ? 16 : 24,
            marginTop: p ? 24 : 32,
            marginBottom: p ? 16 : 20,
          }}
        >
          <div
            style={{
              width: `${lineWidth}px`,
              maxWidth: p ? 60 : 100,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
              opacity: lineOpacity,
            }}
          />
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: accentColor,
              opacity: lineOpacity * 2,
              boxShadow: `0 0 20px ${accentColor}`,
            }}
          />
          <div
            style={{
              width: `${lineWidth}px`,
              maxWidth: p ? 60 : 100,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
              opacity: lineOpacity,
            }}
          />
        </div>

        {/* Title/Subtitle */}
        <h2
          style={{
            fontSize: p ? 32 : 48,
            fontWeight: 600,
            color: textColor,
            fontFamily: "Inter, system-ui, sans-serif",
            marginTop: p ? 20 : 28,
            textAlign: "center",
            opacity: titleOpacity,
            transform: `translateY(${(1 - titleY) * 25}px)`,
            maxWidth: p ? "90%" : "70%",
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
          }}
        >
          {sub || title}
        </h2>
      </div>
    </AbsoluteFill>
  );
};