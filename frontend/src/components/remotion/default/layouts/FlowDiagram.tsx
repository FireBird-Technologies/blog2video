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
  fontFamily,
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

  const underlineSpring = spring({
    frame: frame - 15, // Start animation after title appears
    fps,
    config: { damping: 18, stiffness: 80, mass: 1 },
  });

  const underlineWidth = interpolate(underlineSpring, [0, 1], [0, 100], {
    extrapolateRight: "clamp",
  });
  const underlineOpacity = interpolate(underlineSpring, [0, 0.5], [0, 1], {
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative", // Needed for absolute positioning of underline
          marginBottom: p ? 72 : 100, // Increased gap between title and steps
          opacity: titleOp,
        }}
      >
        <h2
          style={{
            color: textColor,
            fontSize: titleFontSize ?? (p ? 50 : 51),
            fontWeight: 700,
            fontFamily: fontFamily ?? "'Roboto Slab', serif",
            marginTop: 0,
            marginBottom: 0, // Reset margin since parent div handles spacing
            textAlign: "center",
            lineHeight: 1.1,
          }}
        >
          {title}
        </h2>
        <div
          style={{
            position: "absolute",
            bottom: p ? -10 : -15, // Adjust position relative to title
            left: "50%",
            transform: `translateX(-50%)`,
            width: `${underlineWidth}%`, // Animated width
            height: p ? 4 : 4,
            backgroundColor: accentColor,
            borderRadius: 4,
            opacity: underlineOpacity, // Animated opacity
          }}
        />
      </div>
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
                  // Removed maxWidth to allow the pill to adjust its width based on content
                  // The parent `steps` container with `flexWrap: "wrap"` and `maxWidth: "100%"` will handle overall layout.
                }}
              >
                <span
                  style={{
                    fontSize: descriptionFontSize ?? (p ? 35 : 27),
                    fontWeight: 600,
                    color: isLast ? "#FFF" : textColor,
                    fontFamily: fontFamily ?? "'Roboto Slab', serif",
                    // Added wordBreak and hyphens to better handle long content without overflowing
                    wordBreak: "break-word",
                    hyphens: "auto",
                  }}
                >
                  {step}
                </span>
              </div>
              {!isLast &&
                (p ? (
                  <svg
                    width="20"
                    height="32"
                    style={{ opacity: arrowOp, flexShrink: 0 }}
                  >
                    <path
                      d="M10 0 L10 24 M4 18 L10 24 L16 18"
                      stroke={accentColor}
                      strokeWidth="2.5"
                      fill="none"
                    />
                  </svg>
                ) : (
                  <svg
                    width="32"
                    height="20"
                    style={{ opacity: arrowOp, flexShrink: 0 }}
                  >
                    <path
                      d="M0 10 L24 10 M18 4 L24 10 L18 16"
                      stroke={accentColor}
                      strokeWidth="2.5"
                      fill="none"
                    />
                  </svg>
                ))}
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
