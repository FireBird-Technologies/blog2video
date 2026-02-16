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
        overflow: "hidden",
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
          fontSize: p ? 30 : 40,
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          opacity: titleOp,
          marginTop: 0,
          marginBottom: p ? 28 : 36,
          lineHeight: 1.2,
        }}
      >
        {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: p ? 16 : 20 }}>
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
                alignItems: "flex-start",
                gap: p ? 16 : 20,
                opacity: op,
                transform: `translateX(${x}px)`,
              }}
            >
              <div
                style={{
                  width: p ? 28 : 32,
                  height: p ? 28 : 32,
                  borderRadius: 10,
                  backgroundColor: `${accentColor}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <span
                  style={{
                    color: accentColor,
                    fontWeight: 700,
                    fontSize: p ? 14 : 16,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {i + 1}
                </span>
              </div>
              <span
                style={{
                  color: textColor,
                  fontSize: p ? 18 : 22,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                  lineHeight: 1.4,
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
