import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { MatrixBackground } from "../MatrixBackground";
import type { MatrixLayoutProps } from "../types";

/**
 * Transmission — Intercepted Signal Flash
 *
 * 3-5 short phrases displayed sequentially like intercepted transmissions.
 * Each phrase: centered, monospace, green. Hard cuts between phrases.
 * [SIGNAL] prefix in dimmer green.
 */
export const Transmission: React.FC<MatrixLayoutProps> = ({
  phrases,
  title,
  narration,
  imageUrl,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";

  const displayPhrases =
    phrases && phrases.length > 0
      ? phrases
      : narration
        ? narration.split(/[.!?]+/).filter((s) => s.trim())
        : [title];

  const holdFrames = 36;
  const currentIdx = Math.floor(frame / holdFrames) % displayPhrases.length;

  const phraseProgress = interpolate(frame % holdFrames, [0, 4], [0, 1], {
    extrapolateRight: "clamp",
  });

  const hasImage = !!imageUrl;
  const imageOpacity = interpolate(frame, [5, 25], [0, 1], {
    extrapolateRight: "clamp",
  });
  const imageScale = spring({
    frame: Math.max(0, frame - 5),
    fps: 30,
    config: { damping: 20, stiffness: 80 },
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <MatrixBackground bgColor={bgColor} opacity={0.2} />

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
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    border: `1px solid ${accent}33`,
                  }}
                >
                  <Img
                    src={imageUrl}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>
              </div>
            )}
            <div
              style={{
                flex: hasImage && !p ? 1 : "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Signal prefix */}
              <div
                style={{
                  fontSize: p ? 14 : 18,
                  fontWeight: 400,
                  color: `${accent}44`,
                  fontFamily: "'Fira Code', 'Courier New', monospace",
                  letterSpacing: "0.2em",
                  marginBottom: p ? 12 : 20,
                  textTransform: "uppercase",
                }}
              >
                [SIGNAL INTERCEPTED]
              </div>

              {/* Main phrase */}
              <div
                style={{
                  fontSize: titleFontSize ?? (p ? 34 : 56),
                  fontWeight: 700,
                  color: accent,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                  fontFamily: "'Fira Code', 'Courier New', monospace",
                  textShadow: `0 0 16px ${accent}44`,
                }}
              >
                {phrase.trim()}
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
