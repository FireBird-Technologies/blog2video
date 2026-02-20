import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import type { SpotlightLayoutProps } from "../types";

/**
 * Statement — Sentence Drop
 *
 * Narration split across 2-3 lines, each dropping in with spring bounce.
 * One word highlighted in accent color at ~1.15x size.
 * Optional image alongside text.
 */
export const Statement: React.FC<SpotlightLayoutProps> = ({
  title,
  narration,
  imageUrl,
  highlightWord,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const hasImage = !!imageUrl;

  const lines = narration
    ? narration.split(/(?<=\.)\s+|(?<=\n)/).filter((l) => l.trim())
    : [title];

  if (lines.length === 1 && lines[0].length > 40) {
    const words = lines[0].split(" ");
    const mid = Math.ceil(words.length / 2);
    lines.length = 0;
    lines.push(words.slice(0, mid).join(" "), words.slice(mid).join(" "));
  }

  const imageOpacity = interpolate(frame, [10, 35], [0, 1], {
    extrapolateRight: "clamp",
  });

  const imageScale = spring({
    frame: frame - 10,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <SpotlightBackground bgColor={bgColor} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: hasImage && !p ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "10% 8%" : "0 8%",
          gap: hasImage ? (p ? 30 : 60) : 0,
        }}
      >
        {hasImage && (
          <div
            style={{
              flex: p ? "none" : "0 0 38%",
              width: p ? "80%" : "auto",
              height: p ? 240 : 400,
              borderRadius: 4,
              overflow: "hidden",
              opacity: imageOpacity,
              transform: `scale(${imageScale})`,
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
        )}

        <div style={{ width: hasImage && !p ? "58%" : "100%" }}>
          {lines.map((line, i) => {
            const lineSpring = spring({
              frame: frame - i * 8,
              fps,
              config: { damping: 18, stiffness: 200, mass: 1 },
            });

            const words = line.trim().split(" ");

            return (
              <div
                key={i}
                style={{
                  transform: `translateY(${(1 - lineSpring) * -40}px)`,
                  opacity: lineSpring,
                  lineHeight: 1.15,
                  marginBottom: 4,
                }}
              >
                {words.map((word, wi) => {
                  const isHighlight =
                    highlightWord &&
                    word.toLowerCase().replace(/[.,!?]/g, "") ===
                      highlightWord.toLowerCase();
                  return (
                    <span
                      key={wi}
                      style={{
                        fontSize: isHighlight
                          ? p
                            ? 44
                            : 56
                          : p
                            ? 36
                            : 48,
                        fontWeight: 800,
                        color: isHighlight ? accentColor : textColor || "#FFFFFF",
                        fontFamily: "'Arial Black', sans-serif",
                        letterSpacing: isHighlight ? "-0.04em" : "-0.02em",
                        textTransform: isHighlight ? "uppercase" : "none",
                        display: "inline",
                      }}
                    >
                      {word}{" "}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
