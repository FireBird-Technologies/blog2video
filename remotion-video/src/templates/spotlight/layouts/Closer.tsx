import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { SpotlightLayoutProps } from "../types";

export const Closer: React.FC<SpotlightLayoutProps> = ({
  title,
  narration,
  highlightPhrase,
  cta,
  accentColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const text = narration || title;

  const blur = interpolate(frame, [0, 20], [14, 0], { extrapolateRight: "clamp" });
  const textOp = interpolate(frame, [0, 18], [0.15, 1], { extrapolateRight: "clamp" });

  const phraseOp = interpolate(frame, [18, 34], [0, 1], { extrapolateRight: "clamp" });
  const phraseY = interpolate(frame, [18, 34], [-16, 0], { extrapolateRight: "clamp" });

  const underlineW = interpolate(frame, [26, 44], [0, 100], {
    extrapolateRight: "clamp",
  });

  const ctaOp = interpolate(frame, [46, 62], [0, 1], { extrapolateRight: "clamp" });
  const ctaY = interpolate(frame, [46, 62], [14, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 56 : 120,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: p ? 38 : 52,
            fontWeight: 700,
            fontFamily: "Inter, system-ui, sans-serif",
            color: "#FFFFFF",
            lineHeight: 1.3,
            letterSpacing: "-0.02em",
            opacity: textOp,
            filter: `blur(${blur}px)`,
            maxWidth: p ? 420 : 1060,
            textTransform: "uppercase",
          }}
        >
          {text}
        </div>

        {highlightPhrase && (
          <div
            style={{
              marginTop: 40,
              opacity: phraseOp,
              transform: `translateY(${phraseY}px)`,
            }}
          >
            <div
              style={{
                fontSize: p ? 28 : 38,
                fontWeight: 800,
                fontFamily: "Inter, system-ui, sans-serif",
                color: "#FFFFFF",
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              {highlightPhrase}
            </div>
            <div
              style={{
                height: 3,
                width: `${underlineW}%`,
                backgroundColor: accentColor,
                boxShadow: `0 0 16px ${accentColor}`,
              }}
            />
          </div>
        )}

        {cta && (
          <div
            style={{
              marginTop: 52,
              fontSize: p ? 14 : 17,
              fontWeight: 300,
              fontFamily: "Inter, system-ui, sans-serif",
              color: "#666666",
              opacity: ctaOp,
              transform: `translateY(${ctaY}px)`,
              letterSpacing: "0.06em",
            }}
          >
            {cta}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
