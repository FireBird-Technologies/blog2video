import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import type { SpotlightLayoutProps } from "../types";

/**
 * ImpactTitle — Slam-In Title
 *
 * Title text springs from 200% scale, overshoots to ~105%, settles to 100%.
 * Optional subtitle fades in below with delay.
 * Optional image alongside title when available.
 */
export const ImpactTitle: React.FC<SpotlightLayoutProps> = ({
  title,
  narration,
  imageUrl,
  accentColor,
  bgColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  const titleScale = spring({
    frame: frame - 3,
    fps,
    config: { damping: 16, stiffness: 210, mass: 1.2 },
  });

  const titleOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subtitleOpacity = interpolate(frame, [25, 45], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subtitleY = spring({
    frame: frame - 25,
    fps,
    config: { damping: 20, stiffness: 160 },
  });

  const scale = 0.6 + titleScale * 0.4 + Math.sin(titleScale * Math.PI) * 0.05;
  const hasImage = !!imageUrl;

  const imageOpacity = interpolate(frame, [10, 35], [0, 1], { extrapolateRight: "clamp" });
  const imageScale = spring({ frame: frame - 10, fps, config: { damping: 20, stiffness: 80 } });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <SpotlightBackground bgColor={bgColor} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: hasImage && !p ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 40 : 80,
          gap: hasImage ? (p ? 24 : 48) : 0,
        }}
      >
        {hasImage && (
          <div
            style={{
              flex: p ? "none" : "0 0 38%",
              width: p ? "70%" : "auto",
              height: p ? 220 : 360,
              borderRadius: 4,
              overflow: "hidden",
              opacity: imageOpacity,
              transform: `scale(${imageScale})`,
            }}
          >
            <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}
        <div style={{ flex: hasImage && !p ? 1 : "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <h1
          style={{
            fontSize: titleFontSize ?? (p ? 76 : 118),
            fontWeight: 900,
            color: "#FFFFFF",
            fontFamily: "'Arial Black', 'Helvetica Neue', sans-serif",
            textAlign: "center",
            lineHeight: 1.05,
            transform: `scale(${scale})`,
            opacity: titleOpacity,
            letterSpacing: "-0.03em",
            textTransform: "uppercase",
            maxWidth: "95%",
          }}
        >
          {title}
        </h1>

        {narration && (
          <p
            style={{
              fontSize: descriptionFontSize ?? (p ? 22 : 26),
              fontWeight: 300,
              color: "#666666",
              fontFamily: "Arial, sans-serif",
              textAlign: "center",
              marginTop: p ? 20 : 28,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              opacity: subtitleOpacity,
              transform: `translateY(${(1 - subtitleY) * 12}px)`,
              maxWidth: p ? "85%" : 900,
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
