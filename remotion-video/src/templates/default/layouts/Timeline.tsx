import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "../types";

export const Timeline: React.FC<SceneLayoutProps> = ({
  title,
  accentColor,
  bgColor,
  textColor,
  timelineItems = [],
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const titleOp = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const lineH = interpolate(frame, [15, 80], [0, 100], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        padding: p ? "60px 50px" : "70px 100px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <h2
        style={{
          color: textColor,
          fontSize: p ? 36 : 44,
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          opacity: titleOp,
          marginBottom: p ? 36 : 50,
          textAlign: "center",
        }}
      >
        {title}
      </h2>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
          position: "relative",
          paddingLeft: p ? 30 : 40,
        }}
      >
        {/* Vertical line */}
        <div
          style={{
            position: "absolute",
            left: p ? 10 : 15,
            top: 0,
            width: 2,
            height: `${lineH}%`,
            backgroundColor: `${accentColor}30`,
            borderRadius: 1,
          }}
        />

        {timelineItems.map((item, i) => {
          const delay = 20 + i * 15;
          const op = interpolate(frame, [delay, delay + 12], [0, 1], {
            extrapolateRight: "clamp",
          });
          const x = interpolate(frame, [delay, delay + 12], [-30, 0], {
            extrapolateRight: "clamp",
          });
          const dotScale = interpolate(frame, [delay, delay + 8], [0, 1], {
            extrapolateRight: "clamp",
          });
          const isLast = i === timelineItems.length - 1;

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: p ? 20 : 28,
                marginBottom: p ? 28 : 36,
                opacity: op,
                transform: `translateX(${x}px)`,
              }}
            >
              <div
                style={{
                  width: p ? 26 : 32,
                  height: p ? 26 : 32,
                  borderRadius: "50%",
                  backgroundColor: isLast ? accentColor : `${accentColor}20`,
                  border: `2px solid ${accentColor}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transform: `scale(${dotScale})`,
                  marginLeft: p ? -13 : -16,
                }}
              >
                <span
                  style={{
                    color: isLast ? "#FFF" : accentColor,
                    fontSize: p ? 12 : 14,
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </span>
              </div>
              <div>
                <h3
                  style={{
                    fontSize: p ? 18 : 22,
                    fontWeight: 600,
                    color: textColor,
                    fontFamily: "Inter, sans-serif",
                    marginBottom: 4,
                  }}
                >
                  {item.label}
                </h3>
                <p
                  style={{
                    fontSize: p ? 15 : 18,
                    color: textColor,
                    fontFamily: "Inter, sans-serif",
                    opacity: 0.6,
                  }}
                >
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 4,
          backgroundColor: accentColor,
        }}
      />
    </AbsoluteFill>
  );
};
