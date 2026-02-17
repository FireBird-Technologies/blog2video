import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { SpotlightLayoutProps } from "../types";

/**
 * Closer — Final takeaway scene.
 *
 * Text sharpens from a gaussian blur over 20 frames (starts soft, snaps clear).
 * If `highlightPhrase` is set, it appears below as a separate accented phrase
 * with a growing accent-colored underline drawing from left to right.
 * Small CTA text fades in last.
 */
export const Closer: React.FC<SpotlightLayoutProps> = ({
  title,
  narration,
  highlightPhrase,
  cta,
  accentColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const text = narration || title;

  // Blur sharpens over 20 frames
  const blur = interpolate(frame, [0, 20], [14, 0], { extrapolateRight: "clamp" });
  const textOp = interpolate(frame, [0, 18], [0.15, 1], { extrapolateRight: "clamp" });

  // Highlight phrase appears at frame 18
  const phraseOp = interpolate(frame, [18, 34], [0, 1], { extrapolateRight: "clamp" });
  const phraseY = interpolate(frame, [18, 34], [-16, 0], { extrapolateRight: "clamp" });

  // Accent underline grows left to right
  const underlineW = interpolate(frame, [26, 44], [0, 100], {
    extrapolateRight: "clamp",
  });

  // CTA fades in last
  const ctaOp = interpolate(frame, [46, 62], [0, 1], { extrapolateRight: "clamp" });
  const ctaY = interpolate(frame, [46, 62], [14, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 56 : 120,
          textAlign: "center",
        }}
      >
        {/* Main takeaway — blur to sharp */}
        <div
          style={{
            fontSize: p ? 38 : 52,
            fontWeight: 700,
            fontFamily: "Inter, system-ui, sans-serif",
            color: "#FFFFFF",
            lineHeight: 1.3,
            letterSpacing: "-0.02em",
            opacity: textOp,
            filter: `blur(${blur}px)`,
            maxWidth: p ? 420 : 1060,
            textTransform: "uppercase",
          }}
        >
          {text}
        </div>

        {/* Highlight phrase + growing accent underline */}
        {highlightPhrase && (
          <div
            style={{
              marginTop: 40,
              opacity: phraseOp,
              transform: `translateY(${phraseY}px)`,
            }}
          >
            <div
              style={{
                fontSize: p ? 28 : 38,
                fontWeight: 800,
                fontFamily: "Inter, system-ui, sans-serif",
                color: "#FFFFFF",
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              {highlightPhrase}
            </div>
            {/* Growing underline */}
            <div
              style={{
                height: 3,
                width: `${underlineW}%`,
                backgroundColor: accentColor,
                boxShadow: `0 0 16px ${accentColor}`,
              }}
            />
          </div>
        )}

        {/* CTA */}
        {cta && (
          <div
            style={{
              marginTop: 52,
              fontSize: p ? 14 : 17,
              fontWeight: 300,
              fontFamily: "Inter, system-ui, sans-serif",
              color: "#666666",
              opacity: ctaOp,
              transform: `translateY(${ctaY}px)`,
              letterSpacing: "0.06em",
            }}
          >
            {cta}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
