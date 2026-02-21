import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import type { SpotlightLayoutProps } from "../types";

/**
 * SpotlightImage — Image From Darkness
 *
 * Image starts invisible on pure black. A radial vignette spotlight reveals
 * the image from center outward. Slow Ken Burns push-in. Frosted glass
 * caption strip at bottom with title + description.
 */
export const SpotlightImage: React.FC<SpotlightLayoutProps> = ({
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

  const radius = `${revealSpring * 75}%`;
  const imageScale = 1 + (frame / 900) * 0.02;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <SpotlightBackground bgColor={bgColor} />

      {/* Image layer */}
      {imageUrl ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${imageScale})`,
          }}
        >
          <Img
            src={imageUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </div>
      ) : (
        /* No image: show title + narration as main content */
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            transform: `scale(${imageScale})`,
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
                fontSize: titleFontSize ?? (p ? 62 : 84),
                fontWeight: 800,
                color: textColor || "#FFFFFF",
                fontFamily: "'Arial Black', sans-serif",
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
                opacity: captionOpacity,
                transform: `translateY(${(1 - captionSpring) * 8}px)`,
              }}
            >
              {title}
            </div>
            {narration && (
              <div
                style={{
                  fontSize: descriptionFontSize ?? (p ? 22 : 28),
                  fontWeight: 400,
                  color: "rgba(255,255,255,0.75)",
                  fontFamily: "Arial, sans-serif",
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

      {/* Vignette mask */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse ${radius} ${radius} at center, transparent 0%, rgba(0,0,0,0.92) 100%)`,
        }}
      />

      {/* Caption bar — larger text area */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          padding: p ? "28px 32px" : "40px 56px",
          display: "flex",
          alignItems: "center",
          gap: p ? 20 : 28,
          opacity: captionOpacity,
          transform: `translateY(${(1 - captionSpring) * 12}px)`,
        }}
      >
        <div
          style={{
            width: 5,
            height: p ? 48 : 60,
            backgroundColor: accentColor,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: titleFontSize ?? (p ? 28 : 36),
              fontWeight: 700,
              color: textColor || "#FFFFFF",
              fontFamily: "'Arial Black', sans-serif",
              lineHeight: 1.2,
            }}
          >
            {title}
          </div>
          {narration && (
            <div
              style={{
                fontSize: p ? 16 : 20,
                color: "rgba(255,255,255,0.85)",
                fontFamily: "Arial, sans-serif",
                marginTop: 8,
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
