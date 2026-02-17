import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import type { SpotlightLayoutProps } from "../types";

const SLAM = { stiffness: 200, damping: 12, mass: 1 } as const;
const STAGGER = 12;

export const CascadeList: React.FC<SpotlightLayoutProps> = ({
  title,
  items = [],
  accentColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  const displayItems = items.slice(0, 6);

  const activeIndex = displayItems.reduce<number>((acc, _, i) => {
    return frame >= i * STAGGER ? i : acc;
  }, -1);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: p ? 48 : 100,
          gap: p ? 24 : 32,
        }}
      >
        {title && activeIndex < 0 && (
          <div
            style={{
              fontSize: p ? 20 : 26,
              fontWeight: 700,
              color: "rgba(255,255,255,0.35)",
              fontFamily: "Inter, system-ui, sans-serif",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            {title}
          </div>
        )}

        {displayItems.map((item, i) => {
          const delay = i * STAGGER;
          const entered = frame >= delay;
          if (!entered) return null;

          const isCurrent = i === activeIndex;
          const slideS = spring({ frame: frame - delay, fps, config: SLAM });
          const slideX = (1 - slideS) * 500;
          const opacity = isCurrent ? 1 : 0.37;

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: p ? 20 : 36,
                opacity,
                transform: `translateX(${slideX}px)`,
              }}
            >
              <span
                style={{
                  fontSize: p ? 24 : 32,
                  fontWeight: 900,
                  fontFamily: "Inter, system-ui, sans-serif",
                  color: accentColor,
                  minWidth: p ? 40 : 54,
                  textAlign: "right",
                  lineHeight: 1,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                style={{
                  fontSize: p ? 34 : 46,
                  fontWeight: 700,
                  fontFamily: "Inter, system-ui, sans-serif",
                  color: "#FFFFFF",
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  textTransform: "uppercase",
                }}
              >
                {item}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
