import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { SceneLayoutProps } from "../types";

export const FlowDiagram: React.FC<SceneLayoutProps> = ({
  title,
  accentColor,
  bgColor,
  textColor,
  steps = [],
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

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        padding: p ? "60px 50px" : "80px 100px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
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
          marginBottom: p ? 36 : 50,
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
          maxWidth: "100%",
        }}
      >
        {steps.map((step, i) => {
          const delay = 12 + i * 14;
          const stepSpring = spring({
            frame: frame - delay,
            fps,
            config: { damping: 16, stiffness: 130, mass: 1 },
          });
          const scale = interpolate(stepSpring, [0, 1], [0.5, 1], {
            extrapolateRight: "clamp",
          });
          const op = interpolate(stepSpring, [0, 1], [0, 1], {
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
                  padding: p ? "14px 22px" : "16px 28px",
                  borderRadius: 14,
                  backgroundColor: isLast ? accentColor : `${accentColor}15`,
                  border: `2px solid ${isLast ? accentColor : accentColor + "40"}`,
                  transform: `scale(${scale})`,
                  opacity: op,
                  textAlign: "center",
                  maxWidth: p ? "100%" : 220,
                }}
              >
                <span
                  style={{
                    fontSize: descriptionFontSize ?? (p ? 20 : 24),
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
                  <svg width="20" height="32" style={{ opacity: arrowOp, flexShrink: 0 }}>
                    <path
                      d="M10 0 L10 24 M4 18 L10 24 L16 18"
                      stroke={accentColor}
                      strokeWidth="2.5"
                      fill="none"
                    />
                  </svg>
                ) : (
                  <svg width="32" height="20" style={{ opacity: arrowOp, flexShrink: 0 }}>
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
