import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface ImageSceneProps {
  title: string;
  narration: string;
  imageUrl?: string;
}

const ACCENT = "#7C3AED"; // Signature purple

export const ImageScene: React.FC<ImageSceneProps> = ({
  title,
  narration,
  imageUrl,
}) => {
  const frame = useCurrentFrame();

  // Image animations
  const imageScale = interpolate(frame, [0, 60], [1.05, 1.0], {
    extrapolateRight: "clamp",
  });
  const imageOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Text animations
  const titleOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleX = interpolate(frame, [10, 30], [-30, 0], {
    extrapolateRight: "clamp",
  });
  const textOpacity = interpolate(frame, [20, 45], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Shape animations
  const ringScale = interpolate(frame, [5, 40], [0, 1], {
    extrapolateRight: "clamp",
  });
  const barWidth = interpolate(frame, [0, 25], [0, 80], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#FFFFFF" }}>
      {/* Background image -- right side only */}
      {imageUrl && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "50%",
            height: "100%",
            overflow: "hidden",
          }}
        >
          <Img
            src={imageUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: imageOpacity * 0.6,
              transform: `scale(${imageScale})`,
            }}
          />
          {/* Gradient fade to left */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to right, #FFFFFF 0%, rgba(255,255,255,0.5) 60%, rgba(255,255,255,0.2) 100%)",
            }}
          />
        </div>
      )}

      {/* Geometric decorations */}
      {/* Ring top-right */}
      <div
        style={{
          position: "absolute",
          top: 60,
          right: 80,
          width: 120,
          height: 120,
          borderRadius: "50%",
          border: `2px solid ${ACCENT}40`,
          transform: `scale(${ringScale})`,
        }}
      />
      {/* Small accent dot */}
      <div
        style={{
          position: "absolute",
          top: 100,
          right: 160,
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: ACCENT,
          opacity: ringScale * 0.8,
        }}
      />
      {/* Vertical accent line */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: "15%",
          bottom: "15%",
          width: 3,
          backgroundColor: ACCENT,
          borderRadius: 2,
          opacity: titleOpacity * 0.7,
        }}
      />

      {/* Content -- left side */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 120px",
          maxWidth: "60%",
        }}
      >
        {/* Accent bar above title */}
        <div
          style={{
            width: barWidth,
            height: 4,
            backgroundColor: ACCENT,
            borderRadius: 2,
            marginBottom: 24,
          }}
        />

        {/* Title */}
        <h1
          style={{
            color: "#000000",
            fontSize: 52,
            fontWeight: 700,
            fontFamily: "Inter, system-ui, sans-serif",
            opacity: titleOpacity,
            transform: `translateX(${titleX}px)`,
            marginBottom: 28,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>

        {/* Narration */}
        <p
          style={{
            color: "#404040",
            fontSize: 26,
            fontFamily: "Inter, system-ui, sans-serif",
            lineHeight: 1.8,
            opacity: textOpacity,
          }}
        >
          {narration}
        </p>
      </div>

      {/* Bottom accent stripe */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 5,
          backgroundColor: ACCENT,
        }}
      />
    </AbsoluteFill>
  );
};
