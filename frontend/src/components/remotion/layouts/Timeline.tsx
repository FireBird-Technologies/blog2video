import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "./types";

export const Timeline: React.FC<SceneLayoutProps> = ({
  title,
  accentColor,
  bgColor,
  textColor,
  timelineItems = [],
}) => {
  const frame = useCurrentFrame();
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
        padding: "70px 100px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <h2
        style={{
          color: textColor,
          fontSize: 44,
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          opacity: titleOp,
          marginBottom: 50,
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
          paddingLeft: 40,
        }}
      >
        {/* Vertical line */}
        <div
          style={{
            position: "absolute",
            left: 15,
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
                gap: 28,
                marginBottom: 36,
                opacity: op,
                transform: `translateX(${x}px)`,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  backgroundColor: isLast ? accentColor : `${accentColor}20`,
                  border: `2px solid ${accentColor}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transform: `scale(${dotScale})`,
                  marginLeft: -16,
                }}
              >
                <span
                  style={{
                    color: isLast ? "#FFF" : accentColor,
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </span>
              </div>
              <div>
                <h3
                  style={{
                    fontSize: 22,
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
                    fontSize: 18,
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
