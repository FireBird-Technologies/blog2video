import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "../types";
import { AnimatedImage } from "./AnimatedImage";

export const ImageCaption: React.FC<SceneLayoutProps> = ({
  title,
  narration,
  imageUrl,
  accentColor,
  bgColor,
  textColor,
}) => {
  const frame = useCurrentFrame();
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
        flexDirection: "row",
        alignItems: "center",
        padding: "60px 80px",
        gap: 60,
      }}
    >
      {/* Image area */}
      <div
        style={{
          flex: 1,
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
              aspectRatio: "16/10",
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
          flex: 1,
          opacity: textOp,
          transform: `translateY(${textY}px)`,
        }}
      >
        <div
          style={{
            width: `${borderW}%`,
            height: 4,
            backgroundColor: accentColor,
            borderRadius: 2,
            marginBottom: 20,
          }}
        />
        <h2
          style={{
            color: textColor,
            fontSize: 38,
            fontWeight: 700,
            fontFamily: "Inter, sans-serif",
            marginBottom: 20,
            lineHeight: 1.3,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            color: textColor,
            fontSize: 22,
            fontFamily: "Inter, sans-serif",
            lineHeight: 1.7,
            opacity: 0.7,
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
