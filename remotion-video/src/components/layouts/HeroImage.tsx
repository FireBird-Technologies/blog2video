import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "./types";

export const HeroImage: React.FC<SceneLayoutProps> = ({
  title,
  imageUrl,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  // Image animations
  const imgOpacity = interpolate(frame, [0, 40], [0, 1], {
    extrapolateRight: "clamp",
  });
  const imgScale = interpolate(frame, [0, 60], [1.12, 1.0], {
    extrapolateRight: "clamp",
  });

  // Title animations — fade & slide up after image starts appearing
  const titleOpacity = interpolate(frame, [15, 40], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [15, 40], [50, 0], {
    extrapolateRight: "clamp",
  });

  // Accent bar animation
  const barWidth = interpolate(frame, [25, 50], [0, p ? 80 : 120], {
    extrapolateRight: "clamp",
  });

  const isLight = bgColor === "#FFFFFF" || bgColor === "#ffffff";

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor }}>
      {/* Full-screen hero image — fill the entire frame */}
      {imageUrl && (
        <Img
          src={imageUrl}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: p ? "center top" : "center center",
            opacity: imgOpacity * (p ? 0.45 : 0.55),
            transform: `scale(${imgScale})`,
          }}
        />
      )}

      {/* Gradient overlay for text readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: p
            ? isLight
              ? "linear-gradient(to top, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.7) 35%, rgba(255,255,255,0.2) 70%, rgba(255,255,255,0.05) 100%)"
              : "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 35%, rgba(0,0,0,0.2) 70%, rgba(0,0,0,0.05) 100%)"
            : isLight
              ? "linear-gradient(to top, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.1) 100%)"
              : "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.1) 100%)",
        }}
      />

      {/* Title text overlay */}
      <div
        style={{
          position: "absolute",
          bottom: p ? 320 : 100,
          left: p ? 50 : 120,
          right: p ? 50 : 120,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            width: barWidth,
            height: p ? 4 : 5,
            backgroundColor: accentColor,
            borderRadius: 3,
            marginBottom: p ? 24 : 20,
          }}
        />

        {/* Title */}
        <h1
          style={{
            color: textColor,
            fontSize: p ? 48 : 64,
            fontWeight: 800,
            fontFamily: "Inter, system-ui, sans-serif",
            lineHeight: p ? 1.25 : 1.15,
            margin: 0,
            textAlign: "center",
            maxWidth: p ? 900 : undefined,
            textShadow: isLight ? "none" : "0 2px 20px rgba(0,0,0,0.5)",
          }}
        >
          {title}
        </h1>

        {/* Subtle accent underline below title for portrait */}
        {p && (
          <div
            style={{
              width: 60,
              height: 4,
              backgroundColor: accentColor,
              borderRadius: 2,
              marginTop: 28,
              opacity: titleOpacity,
            }}
          />
        )}
      </div>
    </AbsoluteFill>
  );
};
