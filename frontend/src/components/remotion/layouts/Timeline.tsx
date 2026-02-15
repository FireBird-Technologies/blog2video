import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "./types";

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

  // ─── Dynamic sizing ───────────────────────────────────────
  const count = timelineItems.length;
  const dense = count > 3;
  const veryDense = count > 5;

  const titleSize = p
    ? veryDense ? 24 : dense ? 30 : 36
    : veryDense ? 28 : dense ? 36 : 44;
  const labelSize = p
    ? veryDense ? 14 : dense ? 16 : 18
    : veryDense ? 16 : dense ? 18 : 22;
  const descSize = p
    ? veryDense ? 12 : dense ? 13 : 15
    : veryDense ? 13 : dense ? 15 : 18;
  const dotSize = p
    ? veryDense ? 18 : dense ? 22 : 26
    : veryDense ? 22 : dense ? 26 : 32;
  const itemMb = p
    ? veryDense ? 12 : dense ? 18 : 28
    : veryDense ? 14 : dense ? 22 : 36;
  const titleMb = p
    ? veryDense ? 16 : dense ? 24 : 36
    : veryDense ? 20 : dense ? 32 : 50;

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
          fontSize: titleSize,
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          opacity: titleOp,
          marginBottom: titleMb,
          marginTop: 0,
          textAlign: "center",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          flexShrink: 0,
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
          overflow: "hidden",
          flex: 1,
          minHeight: 0,
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
                marginBottom: itemMb,
                opacity: op,
                transform: `translateX(${x}px)`,
                flexShrink: 1,
                minHeight: 0,
              }}
            >
              <div
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: "50%",
                  backgroundColor: isLast ? accentColor : `${accentColor}20`,
                  border: `2px solid ${accentColor}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transform: `scale(${dotScale})`,
                  marginLeft: -(dotSize / 2),
                }}
              >
                <span
                  style={{
                    color: isLast ? "#FFF" : accentColor,
                    fontSize: Math.round(dotSize * 0.45),
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </span>
              </div>
              <div style={{ overflow: "hidden", minWidth: 0 }}>
                <h3
                  style={{
                    fontSize: labelSize,
                    fontWeight: 600,
                    color: textColor,
                    fontFamily: "Inter, sans-serif",
                    marginBottom: 4,
                    margin: 0,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {item.label}
                </h3>
                <p
                  style={{
                    fontSize: descSize,
                    color: textColor,
                    fontFamily: "Inter, sans-serif",
                    opacity: 0.6,
                    margin: 0,
                    marginTop: 4,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
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
