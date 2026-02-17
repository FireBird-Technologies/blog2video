import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { SpotlightLayoutProps } from "../types";

const FRAMES_PER_PHRASE = 38;

export const RapidPoints: React.FC<SpotlightLayoutProps> = ({
  phrases = [],
  narration,
  accentColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const displayPhrases = phrases.length > 0
    ? phrases.slice(0, 5)
    : (narration || "").split(/[.!?]+/).filter(s => s.trim()).slice(0, 5);

  if (displayPhrases.length === 0) {
    return <AbsoluteFill style={{ backgroundColor: "#000000" }} />;
  }

  const currentIndex = Math.min(
    Math.floor(frame / FRAMES_PER_PHRASE),
    displayPhrases.length - 1
  );

  const current = displayPhrases[currentIndex];
  const isInverted = currentIndex % 2 === 1;
  const bg = isInverted ? "#FFFFFF" : "#000000";
  const fg = isInverted ? "#000000" : "#FFFFFF";

  return (
    <AbsoluteFill style={{ backgroundColor: bg, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 56 : 120,
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontSize: p ? 48 : 64,
            fontWeight: 800,
            fontFamily: "Inter, system-ui, sans-serif",
            color: fg,
            lineHeight: 1.1,
            letterSpacing: "-0.025em",
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          {current}
        </h2>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 10,
        }}
      >
        {displayPhrases.map((_, i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              backgroundColor: i === currentIndex ? accentColor : "rgba(128,128,128,0.4)",
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
