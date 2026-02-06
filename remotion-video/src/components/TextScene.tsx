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

const ACCENT = "#7C3AED"; // Signature purple

export const TextScene: React.FC<TextSceneProps> = ({
  title,
  narration,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Animations
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [0, 20], [30, 0], {
    extrapolateRight: "clamp",
  });
  const textOpacity = interpolate(frame, [12, 35], [0, 1], {
    extrapolateRight: "clamp",
  });
  const textY = interpolate(frame, [12, 35], [20, 0], {
    extrapolateRight: "clamp",
  });

  // Geometric shape animations
  const circleScale = interpolate(frame, [0, 40], [0, 1], {
    extrapolateRight: "clamp",
  });
  const rectWidth = interpolate(frame, [5, 30], [0, 200], {
    extrapolateRight: "clamp",
  });
  const dotOpacity = interpolate(frame, [15, 30], [0, 0.15], {
    extrapolateRight: "clamp",
  });
  const lineHeight = interpolate(frame, [8, 35], [0, 300], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px 120px",
      }}
    >
      {/* Background geometric shapes */}
      {/* Large circle top-right */}
      <div
        style={{
          position: "absolute",
          top: -80,
          right: -80,
          width: 400,
          height: 400,
          borderRadius: "50%",
          border: `2px solid ${ACCENT}20`,
          transform: `scale(${circleScale})`,
        }}
      />
      {/* Small filled circle */}
      <div
        style={{
          position: "absolute",
          top: 120,
          right: 200,
          width: 12,
          height: 12,
          borderRadius: "50%",
          backgroundColor: ACCENT,
          opacity: circleScale * 0.6,
        }}
      />
      {/* Accent bar top-left */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 120,
          width: rectWidth,
          height: 4,
          backgroundColor: ACCENT,
          borderRadius: 2,
        }}
      />
      {/* Vertical line right side */}
      <div
        style={{
          position: "absolute",
          right: 120,
          top: "50%",
          width: 2,
          height: lineHeight,
          backgroundColor: "#00000008",
          transform: "translateY(-50%)",
        }}
      />
      {/* Dot grid pattern */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          right: 140,
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 20,
          opacity: dotOpacity,
        }}
      >
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "#000000",
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1200 }}>
        {/* Title */}
        <h1
          style={{
            color: "#0A0A0A",
            fontSize: 56,
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

        {/* Divider */}
        <div
          style={{
            width: 60,
            height: 4,
            backgroundColor: ACCENT,
            borderRadius: 2,
            marginBottom: 28,
            opacity: titleOpacity,
          }}
        />

        {/* Narration text */}
        <p
          style={{
            color: "#404040",
            fontSize: 28,
            fontFamily: "Inter, system-ui, sans-serif",
            lineHeight: 1.8,
            opacity: textOpacity,
            transform: `translateY(${textY}px)`,
            maxWidth: 950,
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
