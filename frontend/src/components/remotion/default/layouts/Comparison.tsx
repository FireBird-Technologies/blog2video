import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
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
}) => {
  const frame = useCurrentFrame();
  const titleOp = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const leftX = interpolate(frame, [10, 30], [-60, 0], {
    extrapolateRight: "clamp",
  });
  const rightX = interpolate(frame, [10, 30], [60, 0], {
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
        padding: "80px 100px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <h2
        style={{
          color: textColor,
          fontSize: 44,
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          opacity: titleOp,
          marginBottom: 48,
          textAlign: "center",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: "flex",
          flex: 1,
          gap: 0,
          position: "relative",
        }}
      >
        {/* Left side */}
        <div
          style={{
            flex: 1,
            padding: 40,
            opacity: op,
            transform: `translateX(${leftX}px)`,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: "#FEE2E2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <span style={{ fontSize: 24, color: "#DC2626" }}>✕</span>
          </div>
          <h3
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: textColor,
              fontFamily: "Inter, sans-serif",
              marginBottom: 16,
            }}
          >
            {leftLabel}
          </h3>
          <p
            style={{
              fontSize: 22,
              color: textColor,
              fontFamily: "Inter, sans-serif",
              lineHeight: 1.7,
              opacity: 0.7,
            }}
          >
            {leftDescription}
          </p>
        </div>

        {/* Divider */}
        <div
          style={{
            width: 2,
            backgroundColor: `${accentColor}40`,
            alignSelf: "center",
            height: `${dividerH}%`,
            borderRadius: 1,
          }}
        />

        {/* Right side */}
        <div
          style={{
            flex: 1,
            padding: 40,
            opacity: op,
            transform: `translateX(${rightX}px)`,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: "#DCFCE7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <span style={{ fontSize: 24, color: "#16A34A" }}>✓</span>
          </div>
          <h3
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: textColor,
              fontFamily: "Inter, sans-serif",
              marginBottom: 16,
            }}
          >
            {rightLabel}
          </h3>
          <p
            style={{
              fontSize: 22,
              color: textColor,
              fontFamily: "Inter, sans-serif",
              lineHeight: 1.7,
              opacity: 0.7,
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
