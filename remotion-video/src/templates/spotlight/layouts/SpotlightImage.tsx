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
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            transform: `scale(${imageScale})`,
          }}
        >
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${(i + 1) * 20}%`,
                top: 0,
                bottom: 0,
                width: 1,
                background: "rgba(255,255,255,0.04)",
              }}
            />
          ))}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                fontSize: p ? 60 : 120,
                opacity: 0.15,
                color: "#FFFFFF",
                fontWeight: 900,
                fontFamily: "'Arial Black', sans-serif",
                letterSpacing: "-0.05em",
              }}
            >
              VISUAL
            </div>
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

      {/* Caption bar */}
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
          padding: p ? "12px 24px" : "18px 36px",
          display: "flex",
          alignItems: "center",
          gap: p ? 12 : 20,
          opacity: captionOpacity,
          transform: `translateY(${(1 - captionSpring) * 12}px)`,
        }}
      >
        <div
          style={{
            width: 3,
            height: p ? 28 : 38,
            backgroundColor: accentColor,
            flexShrink: 0,
          }}
        />
        <div>
          <div
            style={{
              fontSize: p ? 16 : 22,
              fontWeight: 700,
              color: textColor || "#FFFFFF",
              fontFamily: "'Arial Black', sans-serif",
            }}
          >
            {title}
          </div>
          {narration && (
            <div
              style={{
                fontSize: p ? 11 : 14,
                color: "#666666",
                fontFamily: "Arial, sans-serif",
                marginTop: 2,
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
