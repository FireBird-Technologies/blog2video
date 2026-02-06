import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface TextSceneProps {
  title: string;
  narration: string;
  imageUrl?: string;
}

export const TextScene: React.FC<TextSceneProps> = ({
  title,
  narration,
  imageUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animations
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [0, 20], [40, 0], {
    extrapolateRight: "clamp",
  });
  const textOpacity = interpolate(frame, [15, 40], [0, 1], {
    extrapolateRight: "clamp",
  });
  const textY = interpolate(frame, [15, 40], [30, 0], {
    extrapolateRight: "clamp",
  });
  const accentWidth = interpolate(frame, [5, 30], [0, 120], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px 100px",
      }}
    >
      {/* Decorative elements */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 100,
          width: accentWidth,
          height: 4,
          backgroundColor: "#3b82f6",
          borderRadius: 2,
        }}
      />

      {/* Title */}
      <h1
        style={{
          color: "#f8fafc",
          fontSize: 58,
          fontWeight: 700,
          fontFamily: "Inter, system-ui, sans-serif",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          marginBottom: 32,
          lineHeight: 1.2,
        }}
      >
        {title}
      </h1>

      {/* Narration text */}
      <p
        style={{
          color: "#cbd5e1",
          fontSize: 30,
          fontFamily: "Inter, system-ui, sans-serif",
          lineHeight: 1.7,
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
          maxWidth: 1000,
        }}
      >
        {narration}
      </p>

      {/* Bottom accent bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 6,
          background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6)",
        }}
      />
    </AbsoluteFill>
  );
};
