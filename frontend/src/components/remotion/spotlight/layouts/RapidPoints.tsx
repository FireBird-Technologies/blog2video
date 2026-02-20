import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import type { SpotlightLayoutProps } from "../types";

/**
 * RapidPoints — Fast-Cut Phrases
 *
 * 3-5 short phrases displayed sequentially.
 * Optional image alongside phrases when available.
 */
export const RapidPoints: React.FC<SpotlightLayoutProps> = ({
  phrases,
  title,
  narration,
  imageUrl,
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

  const hasImage = !!imageUrl;
  const imageOpacity = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });
  const imageScale = spring({ frame: Math.max(0, frame - 5), fps: 30, config: { damping: 20, stiffness: 80 } });

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
              flexDirection: hasImage && !p ? "row" : "column",
              alignItems: "center",
              justifyContent: "center",
              padding: hasImage && !p ? "0 8% 0 0" : "0 8%",
              gap: hasImage ? 48 : 0,
              textAlign: "center",
              opacity: isActive ? phraseProgress : 0,
            }}
          >
            {hasImage && (
              <div
                style={{
                  flex: "0 0 38%",
                  height: "100%",
                  padding: "8% 0 8% 8%",
                  opacity: imageOpacity,
                  transform: `scale(${imageScale})`,
                }}
              >
                <div style={{ width: "100%", height: "100%", borderRadius: 4, overflow: "hidden" }}>
                  <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              </div>
            )}
            <div style={{ flex: hasImage && !p ? 1 : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                fontSize: p ? 32 : 52,
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
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
