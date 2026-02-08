import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "./types";

export const HeroImage: React.FC<SceneLayoutProps> = ({
  title,
  imageUrl,
  accentColor,
  bgColor,
  textColor,
}) => {
  const frame = useCurrentFrame();

  // Image animations
  const imgOpacity = interpolate(frame, [0, 40], [0, 1], {
    extrapolateRight: "clamp",
  });
  const imgScale = interpolate(frame, [0, 60], [1.08, 1.0], {
    extrapolateRight: "clamp",
  });

  // Title animations — fade & slide up after image starts appearing
  const titleOpacity = interpolate(frame, [15, 40], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [15, 40], [40, 0], {
    extrapolateRight: "clamp",
  });

  // Accent bar animation
  const barWidth = interpolate(frame, [25, 50], [0, 120], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor }}>
      {/* Full-screen hero image */}
      {imageUrl && (
        <Img
          src={imageUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: imgOpacity * 0.55,
            transform: `scale(${imgScale})`,
          }}
        />
      )}

      {/* Dark/light overlay gradient for text readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            bgColor === "#FFFFFF" || bgColor === "#ffffff"
              ? "linear-gradient(to top, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.1) 100%)"
              : "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.1) 100%)",
        }}
      />

      {/* Title text overlay — bottom-center */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: 120,
          right: 120,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            width: barWidth,
            height: 5,
            backgroundColor: accentColor,
            borderRadius: 3,
            marginBottom: 20,
          }}
        />

        {/* Title */}
        <h1
          style={{
            color: textColor,
            fontSize: 64,
            fontWeight: 800,
            fontFamily: "Inter, system-ui, sans-serif",
            lineHeight: 1.15,
            margin: 0,
            textShadow:
              bgColor === "#FFFFFF" || bgColor === "#ffffff"
                ? "none"
                : "0 2px 20px rgba(0,0,0,0.5)",
          }}
        >
          {title}
        </h1>
      </div>
    </AbsoluteFill>
  );
};
