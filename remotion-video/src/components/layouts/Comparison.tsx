import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "./types";

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
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const titleOp = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const leftX = interpolate(frame, [10, 30], [p ? 0 : -60, 0], {
    extrapolateRight: "clamp",
  });
  const leftY = interpolate(frame, [10, 30], [p ? -40 : 0, 0], {
    extrapolateRight: "clamp",
  });
  const rightX = interpolate(frame, [10, 30], [p ? 0 : 60, 0], {
    extrapolateRight: "clamp",
  });
  const rightY = interpolate(frame, [10, 30], [p ? 40 : 0, 0], {
    extrapolateRight: "clamp",
  });
  const op = interpolate(frame, [10, 30], [0, 1], {
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
          fontSize: p ? 30 : 38,
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
              fontSize: p ? 20 : 24,
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
              fontSize: p ? 16 : 19,
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
              fontSize: p ? 20 : 24,
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
              fontSize: p ? 16 : 19,
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
