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

  // ─── Dynamic sizing ───────────────────────────────────────
  const descLen = Math.max(
    (leftDescription as string).length,
    (rightDescription as string).length
  );
  const long = descLen > 200;
  const veryLong = descLen > 400;

  const titleSize = p
    ? veryLong ? 24 : long ? 30 : 36
    : veryLong ? 28 : long ? 36 : 44;
  const labelSize = p
    ? veryLong ? 18 : long ? 20 : 24
    : veryLong ? 20 : long ? 24 : 28;
  const descSize = p
    ? veryLong ? 14 : long ? 16 : 18
    : veryLong ? 16 : long ? 18 : 22;
  const maxLines = veryLong ? 5 : long ? 7 : 10;

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
          fontSize: titleSize,
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          opacity: titleOp,
          marginBottom: p ? 32 : 48,
          marginTop: 0,
          textAlign: "center",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          flexShrink: 0,
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
          overflow: "hidden",
          minHeight: 0,
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
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: p ? 40 : 48,
              height: p ? 40 : 48,
              borderRadius: 12,
              backgroundColor: "#FEE2E2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: p ? 20 : 24, color: "#DC2626" }}>✕</span>
          </div>
          <h3
            style={{
              fontSize: labelSize,
              fontWeight: 600,
              color: textColor,
              fontFamily: "Inter, sans-serif",
              marginBottom: 12,
              margin: 0,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {leftLabel}
          </h3>
          <p
            style={{
              fontSize: descSize,
              color: textColor,
              fontFamily: "Inter, sans-serif",
              lineHeight: 1.7,
              opacity: 0.7,
              margin: 0,
              marginTop: 12,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: maxLines,
              WebkitBoxOrient: "vertical",
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
                  flexShrink: 0,
                }
              : {
                  width: 2,
                  backgroundColor: `${accentColor}40`,
                  alignSelf: "center",
                  height: `${dividerH}%`,
                  borderRadius: 1,
                  flexShrink: 0,
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
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: p ? 40 : 48,
              height: p ? 40 : 48,
              borderRadius: 12,
              backgroundColor: "#DCFCE7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: p ? 20 : 24, color: "#16A34A" }}>✓</span>
          </div>
          <h3
            style={{
              fontSize: labelSize,
              fontWeight: 600,
              color: textColor,
              fontFamily: "Inter, sans-serif",
              marginBottom: 12,
              margin: 0,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {rightLabel}
          </h3>
          <p
            style={{
              fontSize: descSize,
              color: textColor,
              fontFamily: "Inter, sans-serif",
              lineHeight: 1.7,
              opacity: 0.7,
              margin: 0,
              marginTop: 12,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: maxLines,
              WebkitBoxOrient: "vertical",
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
