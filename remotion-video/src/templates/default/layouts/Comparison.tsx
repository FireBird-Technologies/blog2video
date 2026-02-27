import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { SceneLayoutProps } from "../types";

export const Comparison: React.FC<SceneLayoutProps> = ({
  title,
  accentColor,
  bgColor,
  textColor,
  leftLabel = "Before",
  rightLabel = "After",
  leftDescription = "",
  rightDescription = "",
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

  // Left side slides in with spring
  const leftSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 18, stiffness: 100, mass: 1 },
  });
  const leftX = interpolate(leftSpring, [0, 1], [p ? 0 : -60, 0], {
    extrapolateRight: "clamp",
  });
  const leftY = interpolate(leftSpring, [0, 1], [p ? -40 : 0, 0], {
    extrapolateRight: "clamp",
  });

  // Right side slides in with spring (slightly delayed)
  const rightSpring = spring({
    frame: frame - 16,
    fps,
    config: { damping: 18, stiffness: 100, mass: 1 },
  });
  const rightX = interpolate(rightSpring, [0, 1], [p ? 0 : 60, 0], {
    extrapolateRight: "clamp",
  });
  const rightY = interpolate(rightSpring, [0, 1], [p ? 40 : 0, 0], {
    extrapolateRight: "clamp",
  });

  const op = interpolate(frame, [10, 25], [0, 1], {
    extrapolateRight: "clamp",
  });
  const dividerH = interpolate(frame, [5, 35], [0, 100], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        padding: p ? "60px 50px" : "80px 100px",
        display: "flex",
        flexDirection: "column",
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
          marginBottom: p ? 28 : 40,
          textAlign: "center",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: "flex",
          flexDirection: p ? "column" : "row",
          flex: 1,
          gap: 0,
          position: "relative",
        }}
      >
        {/* Left / Top side */}
        <div
          style={{
            flex: 1,
            padding: p ? "24px 20px" : 40,
            opacity: op,
            transform: p
              ? `translateY(${leftY}px)`
              : `translateX(${leftX}px)`,
          }}
        >
          <div
            style={{
              width: p ? 36 : 44,
              height: p ? 36 : 44,
              borderRadius: 12,
              backgroundColor: "#FEE2E2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: p ? 18 : 22, color: "#DC2626" }}>✕</span>
          </div>
          <h3
            style={{
              fontSize: descriptionFontSize ?? (p ? 24 : 28),
              fontWeight: 600,
              color: textColor,
              fontFamily: "Inter, sans-serif",
              margin: 0,
              marginBottom: 12,
            }}
          >
            {leftLabel}
          </h3>
          <p
            style={{
              fontSize: descriptionFontSize ?? (p ? 20 : 24),
              color: textColor,
              fontFamily: "Inter, sans-serif",
              lineHeight: 1.6,
              opacity: 0.7,
              margin: 0,
            }}
          >
            {leftDescription}
          </p>
        </div>

        {/* Divider */}
        <div
          style={
            p
              ? {
                  height: 2,
                  backgroundColor: `${accentColor}40`,
                  alignSelf: "center",
                  width: `${dividerH}%`,
                  borderRadius: 1,
                }
              : {
                  width: 2,
                  backgroundColor: `${accentColor}40`,
                  alignSelf: "center",
                  height: `${dividerH}%`,
                  borderRadius: 1,
                }
          }
        />

        {/* Right / Bottom side */}
        <div
          style={{
            flex: 1,
            padding: p ? "24px 20px" : 40,
            opacity: op,
            transform: p
              ? `translateY(${rightY}px)`
              : `translateX(${rightX}px)`,
          }}
        >
          <div
            style={{
              width: p ? 36 : 44,
              height: p ? 36 : 44,
              borderRadius: 12,
              backgroundColor: "#DCFCE7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: p ? 18 : 22, color: "#16A34A" }}>✓</span>
          </div>
          <h3
            style={{
              fontSize: descriptionFontSize ?? (p ? 24 : 28),
              fontWeight: 600,
              color: textColor,
              fontFamily: "Inter, sans-serif",
              margin: 0,
              marginBottom: 12,
            }}
          >
            {rightLabel}
          </h3>
          <p
            style={{
              fontSize: descriptionFontSize ?? (p ? 20 : 24),
              color: textColor,
              fontFamily: "Inter, sans-serif",
              lineHeight: 1.6,
              opacity: 0.7,
              margin: 0,
            }}
          >
            {rightDescription}
          </p>
        </div>
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
