import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import { AccentBars, SpotlightBeam, StreakField } from "../components/SpotlightArtifacts";
import { SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY } from "../constants";
import type { SpotlightLayoutProps } from "../types";
import { ZoomCropVideo } from "../components/ZoomCropVideo";
import { useFitText } from "../components/useFitText";

/**
 * Statement — Sentence Drop
 *
 * Narration split across 2-3 lines, each dropping in with spring bounce.
 * One word highlighted in accent color at ~1.15x size.
 * Optional image alongside text.
 */
export const Statement: React.FC<SpotlightLayoutProps> = ({
  title,
  narration,imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  highlightWord,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const displayFontFamily =
    fontFamily ?? SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY;

  const lines = narration
    ? narration.split(/(?<=\.)\s+|(?<=\n)/).filter((l) => l.trim())
    : [title];

  if (lines.length === 1 && lines[0].length > 40) {
    const words = lines[0].split(" ");
    const mid = Math.ceil(words.length / 2);
    lines.length = 0;
    lines.push(words.slice(0, mid).join(" "), words.slice(mid).join(" "));
  }

  /* ── Auto-fit ──────────────────────────────────────────────
     Lines are unbounded user input (narration or title, split into 1-2 lines
     of huge display type) with no height cap today — long copy just grows past
     the stage. The highlighted word renders 1.2x the base size, so a single
     hidden mirror carrying all lines at their real word/highlight ratio is
     measured, and the fitted px is applied to every word proportionally
     (isHighlight ? 1.2x : 1x), keeping the emphasis ratio intact at any size. */
  const fitRef = React.useRef<HTMLDivElement>(null);
  const baseTargetPx = titleFontSize ?? (p ? 42 : 56);
  const stackBudgetPx = Math.round(height * (p ? 0.55 : 0.6));
  const { px: fittedBasePx } = useFitText(
    fitRef,
    baseTargetPx,
    p ? 22 : 26,
    [lines.join("|"), baseTargetPx, stackBudgetPx, highlightWord],
    stackBudgetPx,
  );
  const highlightScale = titleFontSize ? 1.2 : (p ? 50 / 42 : 66 / 56);

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
      <SpotlightBackground bgColor={bgColor} accentColor={accentColor} />

      {/* Decorative artifacts — drifting stage light + streak energy. */}
      <SpotlightBeam mode="drift" targetX={p ? 50 : 62} intensity={0.8} />
      <StreakField accentColor={accentColor} count={9} seed={25} startFrame={6} />
      {!imageUrl && !videoUrl && <AccentBars accentColor={accentColor} position="top-left" count={2} startFrame={6} />}

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: p ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "10% 8%" : "0 8%",
          gap: p ? 30 : 60,
        }}
      >
        {(imageUrl || videoUrl) && (
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
            {videoUrl ? (
              <ZoomCropVideo
                src={videoUrl}
                imageObjectPosition={imageObjectPosition}
                imageZoom={imageZoom}
                muted={videoMuted ?? true}
                volume={videoVolume ?? 0.35}
                durationInFrames={videoDurationInFrames}
                startInFrames={videoStartInFrames}
              />
            ) : (
              <Img
                src={imageUrl!}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
                  objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
                  transform: `scale(${imageZoom ?? 1})`,
                  transformOrigin: (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
                }}
              />
            )}
          </div>
        )}

        <div style={{ width: p ? "100%" : "58%", position: "relative" }}>
          {/* Measurement mirror: same lines/words/highlight ratio as the visible
              content, hidden and off-flow, so the fitter can read its natural
              height without fighting the spring entrance transforms below.
              Children use `em` so the hook's own fontSize probe on this
              wrapper (which it sets directly during the binary search) is
              what actually changes their rendered size — an explicit px value
              on the children would ignore the probe and freeze the measurement. */}
          <div
            ref={fitRef}
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              visibility: "hidden",
              pointerEvents: "none",
              fontSize: fittedBasePx,
            }}
          >
            {lines.map((line, i) => {
              const words = line.trim().split(" ");
              return (
                <div key={i} style={{ lineHeight: 1.15, marginBottom: 4, textAlign: p ? "center" : "left" }}>
                  {words.map((word, wi) => {
                    const isHighlight =
                      highlightWord &&
                      word.toLowerCase().replace(/[.,!?]/g, "") === highlightWord.toLowerCase();
                    return (
                      <span
                        key={wi}
                        style={{
                          fontSize: isHighlight ? `${highlightScale}em` : "1em",
                          fontWeight: 800,
                          fontFamily: displayFontFamily,
                          letterSpacing: isHighlight ? "-0.04em" : "-0.02em",
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
                  textAlign: p ? "center" : "left",
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
                          ? Math.round(fittedBasePx * highlightScale)
                          : fittedBasePx,
                        fontWeight: 800,
                        color: isHighlight ? accentColor : textColor || "#FFFFFF",
                        fontFamily: displayFontFamily,
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

