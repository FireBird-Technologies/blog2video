import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "./types";

export const FlowDiagram: React.FC<SceneLayoutProps> = ({
  title,
  accentColor,
  bgColor,
  textColor,
  steps = [],
}) => {
  const frame = useCurrentFrame();
  const titleOp = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        padding: "80px 100px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <h2
        style={{
          color: textColor,
          fontSize: 44,
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          opacity: titleOp,
          marginBottom: 60,
        }}
      >
        {title}
      </h2>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
        {steps.map((step, i) => {
          const delay = 15 + i * 18;
          const scale = interpolate(frame, [delay, delay + 15], [0.5, 1], {
            extrapolateRight: "clamp",
          });
          const op = interpolate(frame, [delay, delay + 15], [0, 1], {
            extrapolateRight: "clamp",
          });
          const arrowOp = interpolate(frame, [delay + 8, delay + 18], [0, 1], {
            extrapolateRight: "clamp",
          });
          const isLast = i === steps.length - 1;

          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  padding: "20px 32px",
                  borderRadius: 14,
                  backgroundColor: isLast ? accentColor : `${accentColor}15`,
                  border: `2px solid ${isLast ? accentColor : accentColor + "40"}`,
                  transform: `scale(${scale})`,
                  opacity: op,
                }}
              >
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: isLast ? "#FFF" : textColor,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {step}
                </span>
              </div>
              {!isLast && (
                <svg width="32" height="20" style={{ opacity: arrowOp }}>
                  <path
                    d="M0 10 L24 10 M18 4 L24 10 L18 16"
                    stroke={accentColor}
                    strokeWidth="2.5"
                    fill="none"
                  />
                </svg>
              )}
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
