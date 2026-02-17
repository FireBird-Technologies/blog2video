import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import type { SpotlightLayoutProps } from "../types";

const SLAM = { stiffness: 200, damping: 12, mass: 1 } as const;

/**
 * ImpactTitle — Slam-in hero title.
 *
 * Title starts at 200% scale and SLAMS down to 100% via spring.
 * With overshoot the scale briefly goes to ~0.94 then settles at 1.0.
 * Optional subtitle (narration) fades in below with a delay.
 */
export const ImpactTitle: React.FC<SpotlightLayoutProps> = ({
  title,
  narration,
  accentColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  const words = title.split(/\s+/);
  const isShort = words.length <= 3;

  // Title springs in from 200% scale → 100% (brief overshoot to ~94%)
  const titleS = spring({ frame, fps, config: SLAM });
  const scale = 2 - titleS;

  // Subtitle fades in at ~18 frames
  const subOp = interpolate(frame, [18, 38], [0, 1], { extrapolateRight: "clamp" });
  const subY = interpolate(frame, [18, 38], [18, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 48 : 100,
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: p ? 80 : isShort ? 160 : 120,
            fontWeight: 900,
            fontFamily: "Inter, system-ui, sans-serif",
            color: "#FFFFFF",
            lineHeight: 0.95,
            letterSpacing: "-0.04em",
            margin: 0,
            textTransform: "uppercase",
            transform: `scale(${scale})`,
          }}
        >
          {title}
        </h1>

        {narration && (
          <p
            style={{
              fontSize: p ? 18 : 24,
              fontWeight: 300,
              fontFamily: "Inter, system-ui, sans-serif",
              color: "#888888",
              marginTop: 44,
              opacity: subOp,
              transform: `translateY(${subY}px)`,
              maxWidth: p ? 320 : 720,
              lineHeight: 1.5,
            }}
          >
            {narration}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};
