import React from "react";
import { NewspaperClip } from "../components/NewspaperClip";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Img,
  staticFile,
} from "remotion";
import { NewsBackground, NewsPaperWash } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const B_FONT = "'Source Sans 3', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * article_lead__v2 — "Two Column".
 *
 * Same props and prop meanings as ArticleLead (stats[0].value = pull stat,
 * stats[0].label = its caption). Body text flows in two justified columns under
 * a column rule, the way a print lead actually sets.
 */
export const ArticleLeadV2: React.FC<BlogLayoutProps & { imageUrl?: string }> = ({
  title = "The Story",
  narration = "Lawmakers failed to pass a short-term spending bill before the midnight deadline, triggering a partial shutdown affecting hundreds of thousands of federal workers.",
  accentColor = "#FFE34D",
  bgColor = "#FAFAF8",
  textColor = "#111111",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  stats,
  imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const fadeIn = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 22, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );
  const contentOpacity = fadeIn * fadeOut;

  const ruleW = interpolate(frame, [0, 18], [0, 100], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [6, 22], [0, 1], { extrapolateRight: "clamp" });
  const dropCapOp = interpolate(frame, [14, 30], [0, 1], { extrapolateRight: "clamp" });
  const dropCapY = interpolate(frame, [14, 30], [16, 0], { extrapolateRight: "clamp" });

  // Body reveals by character, same device as the base layout.
  const bodyProgress = interpolate(frame, [22, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const visChars = Math.floor(narration.length * bodyProgress);
  const visText = narration.slice(0, visChars);
  const showCursor = visChars < narration.length;
  const dropChar = narration[0] ?? "";

  const pullVal = stats?.[0]?.value ?? "";
  const pullCap = stats?.[0]?.label ?? "";
  const pullOp = interpolate(frame, [56, 74], [0, 1], { extrapolateRight: "clamp" });
  const pullNumP = interpolate(frame, [62, 82], [0, 1], { extrapolateRight: "clamp" });

  const numericMatch = pullVal.match(/^(\d+(?:\.\d+)?)(.*)/);
  const baseNum = numericMatch ? parseFloat(numericMatch[1]) : null;
  const numSuffix = numericMatch ? numericMatch[2] : pullVal;
  const animatedNum = baseNum !== null ? Math.round(baseNum * pullNumP) : null;
  const displayVal = animatedNum !== null ? `${animatedNum}${numSuffix}` : pullVal;

  const imageOp = interpolate(frame, [28, 48], [0, 1], { extrapolateRight: "clamp" });
  const hasVisual = Boolean(imageUrl || videoUrl);

  // A taller image leaves less room for the body, and the column box clips what
  // doesn't fit — so long copy steps down to stay readable end-to-end. Only when
  // the size is not explicitly set by the user.
  const baseNarrationSize = p ? 35 : 29;
  const narrationLen = narration.length;
  const fitScale =
    !hasVisual ? 1
      : narrationLen > 320 ? 0.72
      : narrationLen > 240 ? 0.82
      : narrationLen > 170 ? 0.9
      : 1;
  const narrationSize = descriptionFontSize ?? Math.round(baseNarrationSize * fitScale);
  const baseForStats = narrationSize;
  const statsValueSize = baseForStats + 34;
  const statsLabelSize = Math.max(12, baseForStats - 15);

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: fontFamily ?? B_FONT,
        backgroundColor: bgColor,
      }}
    >
      <NewsBackground bgColor={bgColor} />
      <div
        style={{ position: "absolute", inset: 0, backgroundColor: bgColor, opacity: 0.45, zIndex: 2 }}
      />
      <img
        src={staticFile("vintage-news.avif")}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.3,
          filter: "grayscale(75%) contrast(1.08)",
          zIndex: 1,
        }}
      />
      {/* Sits above BOTH the grayscale texture (z1) and the flat bgColor wash
          (z2). Those two together neutralise the warm cast from
          NewsBackground, which is what left this scene looking cold. */}
      <NewsPaperWash zIndex={3} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          padding: p ? "9% 8%" : "5% 8%",
          zIndex: 5,
          opacity: contentOpacity,
        }}
      >
        {/* HEADER */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ height: p ? 10 : 7, background: textColor, width: `${ruleW}%`, marginBottom: 18 }} />
          <div
            style={{
              fontFamily: fontFamily ?? B_FONT,
              fontSize: titleFontSize ?? (p ? 65 : 61),
              fontWeight: 900,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              color: textColor,
              opacity: titleOp,
              lineHeight: 0.95,
            }}
          >
            {title}
          </div>
        </div>

        {/* OPTIONAL VISUAL — a wide strip under the head, keeping the columns intact */}
        {hasVisual && (
          <div
            style={{
              marginTop: p ? 26 : 22,
              width: "100%",
              height: p ? "32%" : "38%",
              flexShrink: 0,
              background: "#fff",
              padding: 8,
              boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
              opacity: imageOp,
              clipPath: "polygon(0% 0%, 100% 1%, 99% 100%, 1% 99%)",
            }}
          >
            <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
              {videoUrl ? (
                <NewspaperClip
                  src={videoUrl}
                  imageObjectPosition={imageObjectPosition}
                  imageZoom={imageZoom}
                  muted={videoMuted ?? true}
                  volume={videoVolume ?? 0.35}
                  durationInFrames={videoDurationInFrames}
                  startInFrames={videoStartInFrames}
                  style={{ filter: "grayscale(0.7) contrast(1.1)" }}
                />
              ) : imageUrl ? (
                <Img
                  src={imageUrl}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
                    objectPosition:
                      (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
                    transform: `scale(${imageZoom ?? 1})`,
                    transformOrigin:
                      (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
                    filter: "grayscale(0.7) contrast(1.1)",
                  }}
                />
              ) : null}
            </div>
          </div>
        )}

        {/* TWO-COLUMN BODY */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            marginTop: p ? 26 : 24,
            display: "flex",
            flexDirection: p ? "column" : "row",
            gap: p ? 20 : 46,
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              flex: p ? "0 1 auto" : "1 1 0",
              minWidth: 0,
              minHeight: 0,
              // columnFill:auto needs a definite height to know where column one
              // ends and column two begins; without it the column box grows and
              // everything stays in the first column.
              height: "100%",
              overflow: "hidden",
              // The column rule: the visual signature of this variant.
              columnCount: p ? 1 : 2,
              columnGap: 44,
              // `auto` fills column ONE to the bottom before starting column two.
              // The default (`balance`) spreads the text evenly across both, so
              // during the typewriter reveal it would start mid-second-column and
              // reflow on every frame instead of writing left to right.
              columnFill: "auto",
              columnRule: `2px solid ${textColor}`,
              fontFamily: fontFamily ?? B_FONT,
              fontSize: narrationSize,
              fontWeight: 500,
              color: textColor,
              lineHeight: 1.45,
              textAlign: "justify",
            }}
          >
            <span
              style={{
                float: "left",
                fontFamily: fontFamily ?? H_FONT,
                fontSize: p ? 120 : 104,
                fontWeight: 800,
                lineHeight: 0.7,
                marginRight: 14,
                marginTop: 6,
                color: textColor,
                opacity: dropCapOp,
                transform: `translateY(${dropCapY}px)`,
                display: "inline-block",
              }}
            >
              {dropChar}
            </span>
            <span style={{ textShadow: `0 0 2px ${bgColor}` }}>
              {visText.length > 1 ? visText.slice(1) : ""}
              {showCursor && visChars > 0 && (
                <span
                  style={{
                    display: "inline-block",
                    width: 4,
                    height: "0.9em",
                    background: textColor,
                    opacity: 0.6,
                    marginLeft: 2,
                    verticalAlign: "middle",
                  }}
                />
              )}
            </span>
          </div>

          {/* PULL STAT — boxed rail beside the columns */}
          {pullVal && (
            <div
              style={{
                flexShrink: 0,
                width: p ? "100%" : "24%",
                alignSelf: p ? "stretch" : "center",
                opacity: pullOp,
                border: `3px solid ${textColor}`,
                borderTop: `10px solid ${accentColor}`,
                padding: p ? "18px 20px" : "22px 20px",
                background: bgColor,
                fontFamily: fontFamily ?? B_FONT,
                color: textColor,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: fontFamily ?? H_FONT,
                  fontSize: statsValueSize,
                  fontWeight: 800,
                  lineHeight: 1,
                  marginBottom: 6,
                }}
              >
                {displayVal}
              </div>
              {pullCap && (
                <div
                  style={{
                    fontSize: statsLabelSize,
                    fontWeight: 700,
                    opacity: 0.7,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {pullCap}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
