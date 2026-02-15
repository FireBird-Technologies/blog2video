import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "./types";

export const ImageCaption: React.FC<SceneLayoutProps> = ({
  title,
  narration,
  imageUrl,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const imgOp = interpolate(frame, [0, 25], [0, 1], {
    extrapolateRight: "clamp",
  });
  const imgScale = interpolate(frame, [0, 25], [1.05, 1], {
    extrapolateRight: "clamp",
  });
  const textOp = interpolate(frame, [15, 35], [0, 1], {
    extrapolateRight: "clamp",
  });
  const textY = interpolate(frame, [15, 35], [20, 0], {
    extrapolateRight: "clamp",
  });
  const borderW = interpolate(frame, [5, 30], [0, 100], {
    extrapolateRight: "clamp",
  });

  // ─── Dynamic sizing ───────────────────────────────────────
  const narrationLen = (narration || "").length;
  const titleLen = (title || "").length;
  const long = narrationLen > 200 || titleLen > 60;
  const veryLong = narrationLen > 400 || titleLen > 100;

  const titleSize = p
    ? veryLong ? 22 : long ? 26 : 32
    : veryLong ? 26 : long ? 32 : 38;
  const narrationSize = p
    ? veryLong ? 14 : long ? 17 : 20
    : veryLong ? 16 : long ? 19 : 22;
  const maxLines = veryLong ? 4 : long ? 6 : 8;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        display: "flex",
        flexDirection: p ? "column" : "row",
        alignItems: "center",
        padding: p ? "60px 50px" : "60px 80px",
        gap: p ? 40 : 60,
        overflow: "hidden",
      }}
    >
      {/* Image area */}
      <div
        style={{
          flex: p ? "none" : 1,
          width: p ? "100%" : undefined,
          height: p ? "45%" : undefined,
          borderRadius: 16,
          overflow: "hidden",
          opacity: imgOp,
          transform: `scale(${imgScale})`,
          boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
          border: `2px solid ${accentColor}20`,
          flexShrink: 0,
        }}
      >
        {imageUrl ? (
          <Img
            src={imageUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              aspectRatio: p ? "1/1" : "16/10",
              backgroundColor: `${accentColor}10`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                backgroundColor: `${accentColor}20`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  backgroundColor: accentColor,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Text area */}
      <div
        style={{
          flex: p ? "none" : 1,
          opacity: textOp,
          transform: `translateY(${textY}px)`,
          textAlign: p ? "center" : "left",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        <div
          style={{
            width: `${borderW}%`,
            maxWidth: p ? 80 : undefined,
            height: 4,
            backgroundColor: accentColor,
            borderRadius: 2,
            marginBottom: 20,
            marginLeft: p ? "auto" : undefined,
            marginRight: p ? "auto" : undefined,
          }}
        />
        <h2
          style={{
            color: textColor,
            fontSize: titleSize,
            fontWeight: 700,
            fontFamily: "Inter, sans-serif",
            marginBottom: 16,
            marginTop: 0,
            lineHeight: 1.3,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          {title}
        </h2>
        <p
          style={{
            color: textColor,
            fontSize: narrationSize,
            fontFamily: "Inter, sans-serif",
            lineHeight: 1.7,
            opacity: 0.7,
            margin: 0,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: maxLines,
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
