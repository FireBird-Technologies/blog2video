import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import type { SpotlightLayoutProps } from "../types";

/**
 * RapidPoints — Fast-Cut Phrases
 *
 * 3-5 short phrases displayed sequentially, each taking the entire screen.
 * Hard cuts between phrases (no transitions). One key word per phrase
 * may be highlighted in accent. Fast-paced and energetic.
 */
export const RapidPoints: React.FC<SpotlightLayoutProps> = ({
  phrases,
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const displayPhrases =
    phrases && phrases.length > 0
      ? phrases
      : narration
        ? narration.split(/[.!?]+/).filter((s) => s.trim())
        : [title];

  const holdFrames = 36;
  const currentIdx = Math.floor(frame / holdFrames) % displayPhrases.length;

  const phraseProgress = interpolate(
    frame % holdFrames,
    [0, 4],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <SpotlightBackground bgColor={bgColor} />

      {displayPhrases.map((phrase, i) => {
        const isActive = currentIdx === i;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 8%",
              textAlign: "center",
              opacity: isActive ? phraseProgress : 0,
            }}
          >
            <div
              style={{
                fontSize: p ? 40 : 64,
                fontWeight: 800,
                color: textColor || "#FFFFFF",
                letterSpacing: "-0.025em",
                lineHeight: 1.15,
                fontFamily: "'Arial Black', sans-serif",
              }}
            >
              {phrase
                .trim()
                .split(" ")
                .map((word, wi) => {
                  const clean = word.replace(/[.,!?]/g, "").toLowerCase();
                  const isAccent =
                    clean.match(/^\d+$/) ||
                    clean === "free" ||
                    clean === "now" ||
                    clean === "fast";
                  return (
                    <span key={wi}>
                      {isAccent ? (
                        <span style={{ color: accentColor }}>{word}</span>
                      ) : (
                        word
                      )}{" "}
                    </span>
                  );
                })}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
