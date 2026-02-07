import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "./types";

export const QuoteCallout: React.FC<SceneLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  quote,
  quoteAuthor,
}) => {
  const frame = useCurrentFrame();
  const barH = interpolate(frame, [0, 25], [0, 100], {
    extrapolateRight: "clamp",
  });
  const textOp = interpolate(frame, [10, 30], [0, 1], {
    extrapolateRight: "clamp",
  });
  const textX = interpolate(frame, [10, 30], [-30, 0], {
    extrapolateRight: "clamp",
  });
  const labelOp = interpolate(frame, [20, 35], [0, 1], {
    extrapolateRight: "clamp",
  });
  const glowOp = interpolate(frame, [5, 40], [0, 0.15], {
    extrapolateRight: "clamp",
  });

  const displayQuote = quote || narration;
  const displayAuthor = quoteAuthor || title;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 120px",
      }}
    >
      {/* Glow effect */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "10%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}${Math.round(glowOp * 255)
            .toString(16)
            .padStart(2, "0")}, transparent)`,
        }}
      />

      <div
        style={{
          display: "flex",
          gap: 40,
          alignItems: "stretch",
          maxWidth: 1000,
          position: "relative",
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            width: 6,
            backgroundColor: accentColor,
            borderRadius: 3,
            height: `${barH}%`,
            alignSelf: "center",
            flexShrink: 0,
          }}
        />

        <div
          style={{
            opacity: textOp,
            transform: `translateX(${textX}px)`,
          }}
        >
          <p
            style={{
              color: textColor,
              fontSize: 36,
              fontWeight: 600,
              fontFamily: "Inter, sans-serif",
              lineHeight: 1.6,
              fontStyle: "italic",
              marginBottom: 24,
            }}
          >
            &ldquo;{displayQuote}&rdquo;
          </p>
          <p
            style={{
              color: accentColor,
              fontSize: 18,
              fontWeight: 500,
              fontFamily: "Inter, sans-serif",
              opacity: labelOp,
              textTransform: "uppercase",
              letterSpacing: 3,
            }}
          >
            {displayAuthor}
          </p>
        </div>
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
