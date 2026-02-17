import { AbsoluteFill, useCurrentFrame, spring } from "remotion";
import type { SpotlightLayoutProps } from "../types";

const SLAM = { stiffness: 200, damping: 12, mass: 1 } as const;

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
