import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { DarkBackground } from "../DarkBackground";
import type { NightfallLayoutProps } from "../types";

/**
 * KineticInsight — Enhanced Professional Version
 * 
 * Improvements:
 * - Word-by-word spring animation
 * - Dynamic highlight with glow
 * - Scale emphasis on key words
 * - Parallax background elements
 * - Quote marks for emphasis
 * - Better word spacing and kerning
 */

export const KineticInsight: React.FC<NightfallLayoutProps> = ({
  quote,
  narration,
  highlightWord,
  accentColor,
  textColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";
  
  const text = quote || narration || "";
  const words = text ? text.split(/\s+/) : [];

  // Background accent elements
  const bgAccent1 = interpolate(frame, [0, 120], [0, 360], {
    extrapolateRight: "extend",
  });
  const bgAccent2 = interpolate(frame, [0, 150], [0, -360], {
    extrapolateRight: "extend",
  });

  // Opening quote mark animation
  const quoteOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const quoteScale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 60 },
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkBackground drift={false} />

      {/* Animated background accents */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "15%",
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}20 0%, transparent 70%)`,
          filter: "blur(60px)",
          transform: `rotate(${bgAccent1}deg)`,
          opacity: 0.4,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "25%",
          right: "20%",
          width: 250,
          height: 250,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}15 0%, transparent 70%)`,
          filter: "blur(70px)",
          transform: `rotate(${bgAccent2}deg)`,
          opacity: 0.3,
        }}
      />

      {/* Opening quote mark */}
      {quote && (
        <div
          style={{
            position: "absolute",
            top: p ? "15%" : "20%",
            left: p ? "10%" : "15%",
            fontSize: p ? 80 : 120,
            color: accentColor,
            opacity: quoteOpacity * 0.25,
            fontFamily: "Georgia, serif",
            fontWeight: 700,
            transform: `scale(${quoteScale})`,
            lineHeight: 1,
          }}
        >
          "
        </div>
      )}

      {/* Main content container */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 60 : 120,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: p ? "1em" : "1.25em",
            maxWidth: p ? "100%" : 1300,
            alignItems: "baseline",
          }}
        >
          {words.map((word, i) => {
            const delay = i * 6;
            
            // Spring animation for each word
            const wordY = spring({
              frame: frame - delay,
              fps,
              config: { damping: 18, stiffness: 80, mass: 0.9 },
            });

            const wordOpacity = interpolate(
              frame,
              [delay, delay + 15],
              [0, 1],
              { extrapolateRight: "clamp" }
            );

            // Determine if this word should be highlighted
            const isHighlight = highlightWord
              ? word.toLowerCase().includes(highlightWord.toLowerCase())
              : i === Math.floor(words.length / 2);

            // Scale for highlighted words - increased for more distinction
            const highlightScale = isHighlight ? 1.35 : 1;

            return (
              <span
                key={i}
                style={{
                  fontSize: p ? 52 : 72,
                  fontWeight: isHighlight ? 800 : 600,
                  color: isHighlight ? accentColor : textColor,
                  opacity: wordOpacity,
                  transform: `translateY(${(1 - wordY) * 30}px) scale(${highlightScale})`,
                  fontFamily: "Inter, system-ui, sans-serif",
                  lineHeight: 1.4,
                  letterSpacing: "-0.01em",
                  textShadow: isHighlight
                    ? `0 0 10px ${accentColor}80, 0 0 20px ${accentColor}60, 0 0 30px ${accentColor}40, 0 2px 8px rgba(0, 0, 0, 0.3)`
                    : "0 2px 8px rgba(0, 0, 0, 0.3)",
                  position: "relative",
                  display: "inline-block",
                  padding: "0",
                  margin: isHighlight ? (p ? "0 0.3em" : "0 0.5em") : "0",
                  borderRadius: isHighlight ? "8px" : "0",
                  background: "transparent",
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>

      {/* Closing quote mark */}
      {quote && (
        <div
          style={{
            position: "absolute",
            bottom: p ? "15%" : "20%",
            right: p ? "10%" : "15%",
            fontSize: p ? 80 : 120,
            color: accentColor,
            opacity: interpolate(
              frame,
              [words.length * 6, words.length * 6 + 20],
              [0, 0.25],
              { extrapolateRight: "clamp" }
            ),
            fontFamily: "Georgia, serif",
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          "
        </div>
      )}
    </AbsoluteFill>
  );
};