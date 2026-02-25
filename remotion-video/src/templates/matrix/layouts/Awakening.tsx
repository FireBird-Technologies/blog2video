import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { MatrixBackground } from "../MatrixBackground";
import type { MatrixLayoutProps } from "../types";

/**
 * Awakening — Blur-to-Sharp Closer
 *
 * Text sharpens from gaussian blur (like waking from the Matrix).
 * Green underline draws beneath key phrase. System-style CTA fades in.
 * Always the last scene.
 */
export const Awakening: React.FC<MatrixLayoutProps> = ({
  title,
  narration,
  highlightPhrase,
  cta,
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
  const accent = accentColor || "#00FF41";

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
  const displayCta = cta || "> Read the full article";
  const hasImage = !!imageUrl;

  const imageOpacity = interpolate(frame, [10, 35], [0, 1], {
    extrapolateRight: "clamp",
  });
  const imageScale = spring({
    frame: frame - 10,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  const renderTextWithHighlight = () => {
    if (!highlightPhrase) {
      return (
        <span style={{ position: "relative", display: "inline" }}>
          {displayText}
          <span
            style={{
              position: "absolute",
              bottom: -4,
              left: 0,
              height: 2,
              width: `${lineSpring * 100}%`,
              backgroundColor: accent,
              boxShadow: `0 0 8px ${accent}`,
              display: "block",
            }}
          />
        </span>
      );
    }

    const idx = displayText
      .toLowerCase()
      .indexOf(highlightPhrase.toLowerCase());
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
          <span style={{ color: "#FFFFFF" }}>{match}</span>
          <span
            style={{
              position: "absolute",
              bottom: -4,
              left: 0,
              height: 2,
              width: `${lineSpring * 100}%`,
              backgroundColor: accent,
              boxShadow: `0 0 8px ${accent}`,
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
      <MatrixBackground bgColor={bgColor} opacity={0.15} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: hasImage && !p ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "0 8%" : "0 12%",
          textAlign: "center",
          gap: hasImage ? (p ? 24 : 48) : 0,
        }}
      >
        {hasImage && (
          <div
            style={{
              flex: p ? "none" : "0 0 38%",
              width: p ? "70%" : "auto",
              height: p ? 220 : 320,
              overflow: "hidden",
              opacity: imageOpacity,
              transform: `scale(${imageScale})`,
              border: `1px solid ${accent}33`,
            }}
          >
            <Img
              src={imageUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        )}

        <div
          style={{
            flex: hasImage && !p ? 1 : "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: titleFontSize ?? (p ? 32 : 46),
              fontWeight: 700,
              color: accent,
              letterSpacing: "-0.01em",
              lineHeight: 1.3,
              filter: `blur(${blur}px)`,
              opacity: Math.min(textOpacity * 1.5, 1),
              fontFamily: "'Fira Code', 'Courier New', monospace",
              position: "relative",
              textShadow: blur < 2 ? `0 0 12px ${accent}44` : "none",
            }}
          >
            {renderTextWithHighlight()}
          </div>

          <div
            style={{
              marginTop: p ? 24 : 36,
              fontSize: descriptionFontSize ?? (p ? 14 : 18),
              fontWeight: 400,
              color: `${accent}66`,
              letterSpacing: "0.1em",
              fontFamily: "'Fira Code', 'Courier New', monospace",
              opacity: ctaOpacity,
              transform: `translateY(${(1 - ctaY) * 10}px)`,
            }}
          >
            [EXECUTE] {displayCta}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
