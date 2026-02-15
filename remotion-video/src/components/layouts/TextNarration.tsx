import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "./types";

export const TextNarration: React.FC<SceneLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

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
  const barW = interpolate(frame, [5, 25], [0, p ? 80 : 120], {
    extrapolateRight: "clamp",
  });

  // ─── Dynamic sizing based on content length ───────────────
  const textLen = (narration || "").length;
  const titleLen = (title || "").length;
  const long = textLen > 300 || titleLen > 60;
  const veryLong = textLen > 500 || titleLen > 100;

  const titleSize = p
    ? veryLong ? 28 : long ? 34 : 40
    : veryLong ? 34 : long ? 44 : 52;

  const narrationSize = p
    ? veryLong ? 18 : long ? 20 : 24
    : veryLong ? 20 : long ? 23 : 27;

  const narrationLineHeight = veryLong ? 1.5 : long ? 1.6 : 1.8;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        padding: p ? "60px 50px" : "80px 120px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: p ? 200 : 300,
          height: p ? 200 : 300,
          borderRadius: "50%",
          border: `2px solid ${accentColor}20`,
          transform: `scale(${circleScale})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: p ? 60 : 80,
          left: p ? 50 : 120,
          width: barW,
          height: 4,
          backgroundColor: accentColor,
          borderRadius: 2,
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: p ? 900 : 1100,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "100%",
        }}
      >
        <h1
          style={{
            color: textColor,
            fontSize: titleSize,
            fontWeight: 700,
            opacity: titleOp,
            marginBottom: 24,
            marginTop: 0,
            fontFamily: "Inter, sans-serif",
            lineHeight: 1.2,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            flexShrink: 0,
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
            flexShrink: 0,
          }}
        />
        <p
          style={{
            color: textColor,
            fontSize: narrationSize,
            lineHeight: narrationLineHeight,
            opacity: textOp * 0.8,
            transform: `translateY(${textY}px)`,
            maxWidth: p ? 850 : 950,
            fontFamily: "Inter, sans-serif",
            margin: 0,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: veryLong ? 10 : long ? 12 : 14,
            WebkitBoxOrient: "vertical",
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
