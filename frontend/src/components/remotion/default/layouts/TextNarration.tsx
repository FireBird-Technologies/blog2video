import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "../types";

export const TextNarration: React.FC<SceneLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
}) => {
  const frame = useCurrentFrame();
  const titleOp = interpolate(frame, [0, 25], [0, 1], {
    extrapolateRight: "clamp",
  });
  const textOp = interpolate(frame, [15, 40], [0, 1], {
    extrapolateRight: "clamp",
  });
  const textY = interpolate(frame, [15, 40], [20, 0], {
    extrapolateRight: "clamp",
  });
  const circleScale = interpolate(frame, [0, 35], [0, 1], {
    extrapolateRight: "clamp",
  });
  const barW = interpolate(frame, [5, 25], [0, 120], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        padding: "80px 120px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 300,
          height: 300,
          borderRadius: "50%",
          border: `2px solid ${accentColor}20`,
          transform: `scale(${circleScale})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 120,
          width: barW,
          height: 4,
          backgroundColor: accentColor,
          borderRadius: 2,
        }}
      />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100 }}>
        <h1
          style={{
            color: textColor,
            fontSize: 52,
            fontWeight: 700,
            opacity: titleOp,
            marginBottom: 24,
            fontFamily: "Inter, sans-serif",
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        <div
          style={{
            width: 50,
            height: 4,
            backgroundColor: accentColor,
            borderRadius: 2,
            marginBottom: 24,
          }}
        />
        <p
          style={{
            color: textColor,
            fontSize: 27,
            lineHeight: 1.8,
            opacity: textOp * 0.8,
            transform: `translateY(${textY}px)`,
            maxWidth: 950,
            fontFamily: "Inter, sans-serif",
          }}
        >
          {narration}
        </p>
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
