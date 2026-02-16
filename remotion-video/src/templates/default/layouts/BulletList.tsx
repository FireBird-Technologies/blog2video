import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "../types";

export const BulletList: React.FC<SceneLayoutProps> = ({
  title,
  accentColor,
  bgColor,
  textColor,
  bullets = [],
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const titleOp = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        padding: p ? "60px 50px" : "80px 120px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: p ? 250 : 350,
          height: p ? 250 : 350,
          borderRadius: "50%",
          border: `2px solid ${accentColor}15`,
        }}
      />
      <h2
        style={{
          color: textColor,
          fontSize: p ? 36 : 48,
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          opacity: titleOp,
          marginBottom: p ? 36 : 48,
        }}
      >
        {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: p ? 20 : 24 }}>
        {bullets.map((b, i) => {
          const delay = 20 + i * 12;
          const op = interpolate(frame, [delay, delay + 15], [0, 1], {
            extrapolateRight: "clamp",
          });
          const x = interpolate(frame, [delay, delay + 15], [-40, 0], {
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: p ? 16 : 20,
                opacity: op,
                transform: `translateX(${x}px)`,
              }}
            >
              <div
                style={{
                  width: p ? 30 : 36,
                  height: p ? 30 : 36,
                  borderRadius: 10,
                  backgroundColor: `${accentColor}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    color: accentColor,
                    fontWeight: 700,
                    fontSize: p ? 15 : 18,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {i + 1}
                </span>
              </div>
              <span
                style={{
                  color: textColor,
                  fontSize: p ? 22 : 28,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                }}
              >
                {b}
              </span>
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
