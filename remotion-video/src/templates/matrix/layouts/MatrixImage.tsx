import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { MatrixBackground } from "../MatrixBackground";
import type { MatrixLayoutProps } from "../types";

/**
 * MatrixImage — Image Revealed Through Digital Rain
 *
 * Image starts hidden behind black. Expanding horizontal slit reveals
 * the image. Scanline overlay on image. Green-tinted caption bar
 * slides up from bottom.
 */
export const MatrixImage: React.FC<MatrixLayoutProps> = ({
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
  const accent = accentColor || "#00FF41";

  const revealSpring = spring({
    frame: frame - 3,
    fps,
    config: { damping: 22, stiffness: 140, mass: 1.2 },
  });

  const captionSpring = spring({
    frame: frame - 20,
    fps,
    config: { damping: 20, stiffness: 160 },
  });

  const captionOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateRight: "clamp",
  });

  const revealPercent = revealSpring * 100;
  const imageScale = 1 + (frame / 900) * 0.02;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <MatrixBackground bgColor={bgColor} opacity={0.3} />

      {/* Image layer */}
      {imageUrl ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${imageScale})`,
            clipPath: `inset(${50 - revealPercent / 2}% 0 ${50 - revealPercent / 2}% 0)`,
          }}
        >
          <Img
            src={imageUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {/* Scanline overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `repeating-linear-gradient(0deg, transparent, transparent 3px, ${accent}06 3px, ${accent}06 6px)`,
              pointerEvents: "none",
            }}
          />
          {/* Green tint overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: `${accent}0A`,
              pointerEvents: "none",
            }}
          />
        </div>
      ) : (
        /* No image: show title + narration on dark background */
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: p ? "12%" : "15%",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 900 }}>
            <div
              style={{
                fontSize: titleFontSize ?? (p ? 58 : 80),
                fontWeight: 700,
                color: accent,
                fontFamily: "'Fira Code', 'Courier New', monospace",
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
                opacity: captionOpacity,
                transform: `translateY(${(1 - captionSpring) * 8}px)`,
                textShadow: `0 0 20px ${accent}44`,
              }}
            >
              {title}
            </div>
            {narration && (
              <div
                style={{
                  fontSize: descriptionFontSize ?? (p ? 20 : 26),
                  fontWeight: 400,
                  color: `${accent}88`,
                  fontFamily: "'Fira Code', 'Courier New', monospace",
                  marginTop: p ? 16 : 24,
                  lineHeight: 1.4,
                  opacity: captionOpacity,
                  transform: `translateY(${(1 - captionSpring) * 8}px)`,
                }}
              >
                {narration}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Caption bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(0,0,0,0.85)",
          borderTop: `1px solid ${accent}33`,
          padding: p ? "24px 28px" : "36px 52px",
          display: "flex",
          alignItems: "center",
          gap: p ? 16 : 24,
          opacity: captionOpacity,
          transform: `translateY(${(1 - captionSpring) * 12}px)`,
        }}
      >
        <div
          style={{
            width: 3,
            height: p ? 44 : 56,
            backgroundColor: accent,
            boxShadow: `0 0 8px ${accent}`,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: titleFontSize ?? (p ? 24 : 32),
              fontWeight: 700,
              color: accent,
              fontFamily: "'Fira Code', 'Courier New', monospace",
              lineHeight: 1.2,
            }}
          >
            {title}
          </div>
          {narration && (
            <div
              style={{
                fontSize: p ? 14 : 18,
                color: `${accent}88`,
                fontFamily: "'Fira Code', 'Courier New', monospace",
                marginTop: 6,
                lineHeight: 1.4,
              }}
            >
              {narration}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
