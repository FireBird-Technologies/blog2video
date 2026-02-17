import { AbsoluteFill, useCurrentFrame, spring } from "remotion";
import type { SpotlightLayoutProps } from "../types";

const SLAM = { stiffness: 200, damping: 12, mass: 1 } as const;

/**
 * WordPunch — Single word fills the entire frame.
 *
 * ONE word, 180–200px, weight 900, accent colored.
 * Springs from 0% to 100% with natural overshoot (~106%), then settles.
 * The visual: word PUNCHES onto the screen from nothing.
 * Maximum 1 per video — used for the biggest mic-drop moment.
 */
export const WordPunch: React.FC<SpotlightLayoutProps> = ({
  word,
  title,
  accentColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  const displayWord = word || title;

  // Spring from 0 → 1+ (overshoot) → 1.0
  const s = spring({ frame, fps, config: SLAM });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: p ? 120 : 200,
            fontWeight: 900,
            fontFamily: "Inter, system-ui, sans-serif",
            color: accentColor,
            textTransform: "uppercase",
            letterSpacing: "-0.04em",
            lineHeight: 1,
            transform: `scale(${s})`,
            display: "block",
            textAlign: "center",
          }}
        >
          {displayWord}
        </span>
      </div>
    </AbsoluteFill>
  );
};
