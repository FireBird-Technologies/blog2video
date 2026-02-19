import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import type { SpotlightLayoutProps } from "../types";

/**
 * Closer — Final Takeaway
 *
 * Text fades in from gaussian blur, sharpens over ~20 frames.
 * A thin accent underline draws beneath key phrase from left to right.
 * Small CTA text fades in below with delay.
 */
export const Closer: React.FC<SpotlightLayoutProps> = ({
  title,
  narration,
  highlightPhrase,
  cta,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  const blurSpring = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 120, mass: 1 },
  });

  const blur = Math.max(0, 16 - blurSpring * 16);
  const textOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const lineSpring = spring({
    frame: frame - 28,
    fps,
    config: { damping: 18, stiffness: 180 },
  });

  const ctaOpacity = interpolate(frame, [40, 55], [0, 1], {
    extrapolateRight: "clamp",
  });

  const ctaY = spring({
    frame: frame - 40,
    fps,
    config: { damping: 20, stiffness: 160 },
  });

  const displayText = narration || title;
  const displayCta = cta || "Read the full article →";

  const renderTextWithHighlight = () => {
    if (!highlightPhrase) {
      return (
        <span>
          {displayText}
          <span
            style={{
              position: "absolute",
              bottom: -4,
              left: 0,
              height: 3,
              width: `${lineSpring * 100}%`,
              backgroundColor: accentColor,
              display: "block",
            }}
          />
        </span>
      );
    }

    const idx = displayText.toLowerCase().indexOf(highlightPhrase.toLowerCase());
    if (idx === -1) {
      return displayText;
    }

    const before = displayText.slice(0, idx);
    const match = displayText.slice(idx, idx + highlightPhrase.length);
    const after = displayText.slice(idx + highlightPhrase.length);

    return (
      <>
        {before}
        <span style={{ position: "relative", display: "inline-block" }}>
          <span style={{ color: accentColor }}>{match}</span>
          <span
            style={{
              position: "absolute",
              bottom: -4,
              left: 0,
              height: 3,
              width: `${lineSpring * 100}%`,
              backgroundColor: accentColor,
              display: "block",
            }}
          />
        </span>
        {after}
      </>
    );
  };

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <SpotlightBackground bgColor={bgColor} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "0 8%" : "0 12%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: p ? 34 : 52,
            fontWeight: 700,
            color: textColor || "#FFFFFF",
            letterSpacing: "-0.02em",
            lineHeight: 1.25,
            filter: `blur(${blur}px)`,
            opacity: Math.min(textOpacity * 1.5, 1),
            fontFamily: "Arial, sans-serif",
            position: "relative",
          }}
        >
          {renderTextWithHighlight()}
        </div>

        <div
          style={{
            marginTop: p ? 24 : 36,
            fontSize: p ? 12 : 16,
            fontWeight: 300,
            color: "#666666",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontFamily: "Arial, sans-serif",
            opacity: ctaOpacity,
            transform: `translateY(${(1 - ctaY) * 10}px)`,
          }}
        >
          {displayCta}
        </div>
      </div>
    </AbsoluteFill>
  );
};
