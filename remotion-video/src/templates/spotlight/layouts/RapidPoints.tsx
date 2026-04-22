import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import { SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY } from "../constants";
import type { SpotlightLayoutProps } from "../types";
import { ZoomCropImg } from "../components/ZoomCropImg";

/**
 * RapidPoints — Fast-Cut Phrases
 *
 * 3-5 short phrases displayed sequentially.
 * Optional image alongside phrases when available.
 */
export const RapidPoints: React.FC<SpotlightLayoutProps> = ({
  phrases,
  title,
  narration,imageUrl,
  imageObjectPosition,
  imageZoom,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const displayFontFamily =
    fontFamily ?? SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY;

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
                  flex: p ? "0 0 auto" : "0 0 38%",
                  width: p ? "76%" : undefined,
                  maxWidth: p ? 760 : undefined,
                  height: p ? "44%" : "100%",
                  padding: p ? "0" : "8% 0 8% 8%",
                  opacity: imageOpacity,
                  transform: `scale(${imageScale})`,
                }}
              >
                <div style={{ width: "100%", height: "100%", borderRadius: 4, overflow: "hidden" }}>
                  <ZoomCropImg
                    src={imageUrl}
                    imageObjectPosition={imageObjectPosition}
                    imageZoom={imageZoom}
                  />
                </div>
              </div>
            )}
            <div style={{ flex: hasImage && !p ? 1 : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                fontSize: titleFontSize ?? (p ? 96 : 90),
                fontWeight: 800,
                color: textColor || "#FFFFFF",
                letterSpacing: "-0.025em",
                lineHeight: 1.15,
                fontFamily: displayFontFamily,
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

