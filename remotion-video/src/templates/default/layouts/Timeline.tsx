import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { SceneLayoutProps } from "../types";

export const Timeline: React.FC<SceneLayoutProps> = ({
  title,
  accentColor,
  bgColor,
  textColor,
  timelineItems = [],
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";

  const titleSpring = spring({
    frame: frame - 3,
    fps,
    config: { damping: 22, stiffness: 90, mass: 1 },
  });
  const titleOp = interpolate(titleSpring, [0, 1], [0, 1], {
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
        overflow: "hidden",
      }}
    >
      <h2
        style={{
          color: textColor,
          fontSize: titleFontSize ?? (p ? 36 : 46),
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          opacity: titleOp,
          marginTop: 0,
          marginBottom: p ? 30 : 40,
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
          const delay = 18 + i * 12;
          const itemSpring = spring({
            frame: frame - delay,
            fps,
            config: { damping: 16, stiffness: 120, mass: 1 },
          });
          const op = interpolate(itemSpring, [0, 1], [0, 1], {
            extrapolateRight: "clamp",
          });
          const x = interpolate(itemSpring, [0, 1], [-30, 0], {
            extrapolateRight: "clamp",
          });
          const dotScale = interpolate(itemSpring, [0, 0.6], [0, 1], {
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
                marginBottom: p ? 22 : 28,
                opacity: op,
                transform: `translateX(${x}px)`,
              }}
            >
              <div
                style={{
                  width: p ? 24 : 28,
                  height: p ? 24 : 28,
                  borderRadius: "50%",
                  backgroundColor: isLast ? accentColor : `${accentColor}20`,
                  border: `2px solid ${accentColor}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transform: `scale(${dotScale})`,
                  marginLeft: p ? -12 : -14,
                }}
              >
                <span
                  style={{
                    color: isLast ? "#FFF" : accentColor,
                    fontSize: p ? 11 : 13,
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </span>
              </div>
              <div>
                <h3
                  style={{
                    fontSize: descriptionFontSize ?? (p ? 20 : 24),
                    fontWeight: 600,
                    color: textColor,
                    fontFamily: "Inter, sans-serif",
                    margin: 0,
                    marginBottom: 4,
                  }}
                >
                  {item.label}
                </h3>
                <p
                  style={{
                    fontSize: descriptionFontSize ?? (p ? 22 : 24),
                    color: textColor,
                    fontFamily: "Inter, sans-serif",
                    opacity: 0.6,
                    margin: 0,
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
