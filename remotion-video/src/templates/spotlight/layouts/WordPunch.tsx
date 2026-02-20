import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import type { SpotlightLayoutProps } from "../types";

/**
 * WordPunch — Single Word Impact
 *
 * ONE word/short phrase fills the entire frame at 180-200px.
 * Springs from 0% to ~110% (overshoot) then settles to 100%.
 * Optional image alongside when available.
 */
export const WordPunch: React.FC<SpotlightLayoutProps> = ({
  word,
  title,
  imageUrl,
  accentColor,
  bgColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  const punchSpring = spring({
    frame: frame - 3,
    fps,
    config: { damping: 14, stiffness: 220, mass: 1.1 },
  });

  const scale = punchSpring * 1.1 - Math.sin(punchSpring * Math.PI) * 0.06;

  const opacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });

  const displayWord = word || title;
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
          gap: hasImage ? (p ? 24 : 48) : 0,
          padding: p ? "10% 8%" : "0 8%",
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
        <div
          style={{
            fontSize: p ? 96 : 140,
            fontWeight: 900,
            color: accentColor,
            textTransform: "uppercase",
            letterSpacing: "-0.05em",
            transform: `scale(${Math.max(scale, 0)})`,
            opacity,
            fontFamily: "'Arial Black', sans-serif",
            lineHeight: 1,
            textAlign: "center",
            padding: "0 5%",
            flex: hasImage && !p ? 1 : "none",
          }}
        >
          {displayWord}
        </div>
      </div>
    </AbsoluteFill>
  );
};
