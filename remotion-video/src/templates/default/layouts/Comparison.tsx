import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from "remotion";
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

  const { durationInFrames } = useVideoConfig();

  const exitStartFrame = durationInFrames - 30;

  // Left section exit animation
  const leftExitSpring = spring({
    frame: frame - exitStartFrame,
    fps,
    config: { damping: 18, stiffness: 100, mass: 1 },
  });
  const leftOutX = interpolate(leftExitSpring, [0, 1], [0, p ? 0 : -200], {
    extrapolateLeft: "clamp",
  });
  const leftOutY = interpolate(leftExitSpring, [0, 1], [0, p ? -150 : 0], {
    extrapolateLeft: "clamp",
  });

  // Right section exit animation
  const rightExitSpring = spring({
    frame: frame - exitStartFrame,
    fps,
    config: { damping: 18, stiffness: 100, mass: 1 },
  });
  const rightOutX = interpolate(rightExitSpring, [0, 1], [0, p ? 0 : 200], {
    extrapolateLeft: "clamp",
  });
  const rightOutY = interpolate(rightExitSpring, [0, 1], [0, p ? 150 : 0], {
    extrapolateLeft: "clamp",
  });

  // Combine entry and exit transformations
  const finalLeftX = leftX + leftOutX;
  const finalLeftY = leftY + leftOutY;
  const finalRightX = rightX + rightOutX;
  const finalRightY = rightY + rightOutY;

  // Combine entry and exit opacity
  const outroOp = interpolate(leftExitSpring, [0, 1], [1, 0], {
    extrapolateLeft: "clamp",
  });
  const finalOp = op * outroOp;

  const resolvedDescriptionFontSize = descriptionFontSize ?? (p ? 43 : 33);

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
          fontSize: titleFontSize ?? (p ? 70 : 78),
          fontWeight: 700,
          fontFamily: fontFamily ?? "'Roboto Slab', serif",
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
            opacity: finalOp,
            transform: p
              ? `translateY(${finalLeftY}px)`
              : `translateX(${finalLeftX}px)`,
          }}
        >
          <div
            style={{
              // Adjust width and height based on the new font size
              width: resolvedDescriptionFontSize * 1.2,
              height: resolvedDescriptionFontSize * 1.2,
              borderRadius: 12,
              backgroundColor: "#FEE2E2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: resolvedDescriptionFontSize, color: "#DC2626" }}>✕</span>
          </div>
          <h3
            style={{
              fontSize: resolvedDescriptionFontSize,
              fontWeight: 600,
              color: textColor,
              fontFamily: fontFamily ?? "'Roboto Slab', serif",
              margin: 0,
              marginBottom: 12,
            }}
          >
            {leftLabel}
          </h3>
          <p
            style={{
              fontSize: resolvedDescriptionFontSize,
              color: textColor,
              fontFamily: fontFamily ?? "'Roboto Slab', serif",
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
            opacity: finalOp,
            transform: p
              ? `translateY(${finalRightY}px)`
              : `translateX(${finalRightX}px)`,
          }}
        >
          <div
            style={{
              // Adjust width and height based on the new font size
              width: resolvedDescriptionFontSize * 1.2,
              height: resolvedDescriptionFontSize * 1.2,
              borderRadius: 12,
              backgroundColor: "#DCFCE7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: resolvedDescriptionFontSize, color: "#16A34A" }}>✓</span>
          </div>
          <h3
            style={{
              fontSize: resolvedDescriptionFontSize,
              fontWeight: 600,
              color: textColor,
              fontFamily: fontFamily ?? "'Roboto Slab', serif",
              margin: 0,
              marginBottom: 12,
            }}
          >
            {rightLabel}
          </h3>
          <p
            style={{
              fontSize: resolvedDescriptionFontSize,
              color: textColor,
              fontFamily: fontFamily ?? "'Roboto Slab', serif",
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
