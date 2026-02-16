import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "../types";
import { AnimatedImage } from "./AnimatedImage";

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
  const isLight = bgColor === "#FFFFFF" || bgColor === "#ffffff";

  // Image animations
  const imgOpacity = interpolate(frame, [0, 40], [0, 1], {
    extrapolateRight: "clamp",
  });
  const imgScale = interpolate(frame, [0, 60], [1.08, 1.0], {
    extrapolateRight: "clamp",
  });

  // Title animations
  const titleOpacity = interpolate(frame, [15, 40], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [15, 40], [40, 0], {
    extrapolateRight: "clamp",
  });

  // Accent bar animation
  const barWidth = interpolate(frame, [25, 50], [0, p ? 80 : 120], {
    extrapolateRight: "clamp",
  });

  /* ───── PORTRAIT: shrunk image card + big title below ───── */
  if (p) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: bgColor,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 50px",
          gap: 40,
          overflow: "hidden",
        }}
      >
        {/* Shrunk image card */}
        {imageUrl && (
          <div
            style={{
              width: "85%",
              maxHeight: 650,
              borderRadius: 20,
              overflow: "hidden",
              opacity: imgOpacity,
              transform: `scale(${imgScale})`,
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              border: `2px solid ${accentColor}25`,
              flexShrink: 0,
            }}
          >
            <AnimatedImage
              src={imageUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
        )}

        {/* Title area */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          {/* Accent bar */}
          <div
            style={{
              width: barWidth,
              height: 4,
              backgroundColor: accentColor,
              borderRadius: 3,
              marginBottom: 24,
            }}
          />

          <h1
            style={{
              color: textColor,
              fontSize: 40,
              fontWeight: 800,
              fontFamily: "Inter, system-ui, sans-serif",
              lineHeight: 1.25,
              margin: 0,
              textAlign: "center",
              maxWidth: 900,
            }}
          >
            {title}
          </h1>

          {/* Accent underline */}
          <div
            style={{
              width: 60,
              height: 4,
              backgroundColor: accentColor,
              borderRadius: 2,
              marginTop: 28,
            }}
          />
        </div>
      </AbsoluteFill>
    );
  }

  /* ───── LANDSCAPE: full-screen hero image background ───── */
  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      {imageUrl && (
        <AnimatedImage
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

      {/* Gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: isLight
            ? "linear-gradient(to top, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.1) 100%)"
            : "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.1) 100%)",
        }}
      />

      {/* Title overlay — bottom-center */}
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
        <div
          style={{
            width: barWidth,
            height: 5,
            backgroundColor: accentColor,
            borderRadius: 3,
            marginBottom: 20,
          }}
        />
        <h1
          style={{
            color: textColor,
            fontSize: 54,
            fontWeight: 800,
            fontFamily: "Inter, system-ui, sans-serif",
            lineHeight: 1.15,
            margin: 0,
            textShadow: isLight ? "none" : "0 2px 20px rgba(0,0,0,0.5)",
          }}
        >
          {title}
        </h1>
      </div>
    </AbsoluteFill>
  );
};
