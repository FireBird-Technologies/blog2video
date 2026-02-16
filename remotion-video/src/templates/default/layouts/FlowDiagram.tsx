import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "../types";

export const FlowDiagram: React.FC<SceneLayoutProps> = ({
  title,
  accentColor,
  bgColor,
  textColor,
  steps = [],
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
        padding: p ? "60px 50px" : "80px 100px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <h2
        style={{
          color: textColor,
          fontSize: p ? 36 : 44,
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          opacity: titleOp,
          marginBottom: p ? 40 : 60,
          textAlign: "center",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: "flex",
          flexDirection: p ? "column" : "row",
          alignItems: "center",
          gap: p ? 12 : 16,
          flexWrap: p ? "nowrap" : "wrap",
          justifyContent: "center",
        }}
      >
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
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: p ? "column" : "row",
                alignItems: "center",
                gap: p ? 12 : 16,
              }}
            >
              <div
                style={{
                  padding: p ? "16px 24px" : "20px 32px",
                  borderRadius: 14,
                  backgroundColor: isLast ? accentColor : `${accentColor}15`,
                  border: `2px solid ${isLast ? accentColor : accentColor + "40"}`,
                  transform: `scale(${scale})`,
                  opacity: op,
                  textAlign: "center",
                }}
              >
                <span
                  style={{
                    fontSize: p ? 18 : 22,
                    fontWeight: 600,
                    color: isLast ? "#FFF" : textColor,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {step}
                </span>
              </div>
              {!isLast && (
                p ? (
                  <svg width="20" height="32" style={{ opacity: arrowOp }}>
                    <path
                      d="M10 0 L10 24 M4 18 L10 24 L16 18"
                      stroke={accentColor}
                      strokeWidth="2.5"
                      fill="none"
                    />
                  </svg>
                ) : (
                  <svg width="32" height="20" style={{ opacity: arrowOp }}>
                    <path
                      d="M0 10 L24 10 M18 4 L24 10 L18 16"
                      stroke={accentColor}
                      strokeWidth="2.5"
                      fill="none"
                    />
                  </svg>
                )
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
