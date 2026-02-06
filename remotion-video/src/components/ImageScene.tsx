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

export const ImageScene: React.FC<ImageSceneProps> = ({
  title,
  narration,
  imageUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Image animations
  const imageScale = interpolate(frame, [0, 60], [1.1, 1.0], {
    extrapolateRight: "clamp",
  });
  const imageOpacity = interpolate(frame, [0, 20], [0, 0.5], {
    extrapolateRight: "clamp",
  });

  // Text animations
  const titleOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleX = interpolate(frame, [10, 30], [-40, 0], {
    extrapolateRight: "clamp",
  });
  const textOpacity = interpolate(frame, [20, 45], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0f172a" }}>
      {/* Background image */}
      {imageUrl && (
        <AbsoluteFill>
          <Img
            src={imageUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: imageOpacity,
              transform: `scale(${imageScale})`,
            }}
          />
          {/* Gradient overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to right, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.7) 50%, rgba(15,23,42,0.4) 100%)",
            }}
          />
        </AbsoluteFill>
      )}

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 100px",
          maxWidth: "65%",
        }}
      >
        {/* Title */}
        <h1
          style={{
            color: "#f8fafc",
            fontSize: 54,
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
            color: "#e2e8f0",
            fontSize: 28,
            fontFamily: "Inter, system-ui, sans-serif",
            lineHeight: 1.7,
            opacity: textOpacity,
          }}
        >
          {narration}
        </p>
      </div>

      {/* Accent line */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: "20%",
          bottom: "20%",
          width: 4,
          backgroundColor: "#3b82f6",
          borderRadius: 2,
          opacity: titleOpacity,
        }}
      />
    </AbsoluteFill>
  );
};
