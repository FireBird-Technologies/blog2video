import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "./types";
import { AnimatedImage } from "./AnimatedImage";

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

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        display: "flex",
        flexDirection: p ? "column" : "row",
        alignItems: "center",
        padding: p ? "60px 50px" : "60px 80px",
        gap: p ? 36 : 56,
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
        }}
      >
        {imageUrl ? (
          <AnimatedImage
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
            fontSize: p ? 26 : 32,
            fontWeight: 700,
            fontFamily: "Inter, sans-serif",
            marginTop: 0,
            marginBottom: 16,
            lineHeight: 1.3,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            color: textColor,
            fontSize: p ? 17 : 20,
            fontFamily: "Inter, sans-serif",
            lineHeight: 1.6,
            opacity: 0.7,
            margin: 0,
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
