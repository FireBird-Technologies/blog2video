import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import type { SpotlightLayoutProps } from "../types";

/**
 * WordPunch — Single Word Impact
 *
 * ONE word/short phrase fills the entire frame at 180-200px.
 * Springs from 0% to ~110% (overshoot) then settles to 100%.
 * Accent colored. Maximum 1 per video.
 */
export const WordPunch: React.FC<SpotlightLayoutProps> = ({
  word,
  title,
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

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <SpotlightBackground bgColor={bgColor} />

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
            fontSize: p ? 120 : 180,
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
          }}
        >
          {displayWord}
        </div>
      </div>
    </AbsoluteFill>
  );
};
