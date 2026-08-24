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
import { useFitText, useAvailableHeight } from "../components/useFitText";
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
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
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
  const { durationInFrames, height: videoHeight } = useVideoConfig();
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

  const baseNarrationSize = p ? 35 : 29;
  const narrationTargetSize = descriptionFontSize ?? baseNarrationSize;

  /* ── Auto-fit ──────────────────────────────────────────────
     The column count for the narration body. Landscape runs 2 CSS columns;
     portrait collapses to 1. */
  const columnCount = p ? 1 : 2;

  /* Title: a plain direct-ref budget fit against the header's own share of the
     frame — no give-back needed here (unlike ArticleLead), because the header
     and the two-column body are separate flexShrink:0 / flex:1 siblings, so an
     oversized title simply eats into contentLayer's flex layout and pushes the
     body budget down; useAvailableHeight for the body is measured AFTER the
     title is fitted (it depends on titlePx), so the body always sees the true
     remaining space regardless of how large the title got. */
  const titleRef = React.useRef<HTMLDivElement>(null);
  const contentLayerRef = React.useRef<HTMLDivElement>(null);
  const columnBoxRef = React.useRef<HTMLDivElement>(null);
  const mirrorRef = React.useRef<HTMLDivElement>(null);

  const actualTitleFontSize = titleFontSize ?? (p ? 65 : 61);

  const titleBudgetPx = React.useMemo(() => {
    // Header may claim at most this much of the frame's inner height; the rest
    // (image strip, if any, plus margin) is reserved for the two-column body.
    return Math.max(1, videoHeight * (p ? 0.3 : 0.32));
  }, [videoHeight, p]);

  const { px: titlePx } = useFitText(
    titleRef,
    actualTitleFontSize,
    titleFontSizeIsUserSet ? actualTitleFontSize : p ? 32 : 28,
    [title, actualTitleFontSize, titleFontSizeIsUserSet, titleBudgetPx, p],
    titleBudgetPx,
  );

  /* The column box's real pixel height, from untransformed layout geometry
     (offsetTop/offsetHeight) rather than getBoundingClientRect — this scene has
     no camera transform, but the pattern is kept consistent with the rest of
     the template family. */
  const perColumnBudgetPx = useAvailableHeight(columnBoxRef, contentLayerRef, [
    title, titlePx, hasVisual, narration, narrationTargetSize, p,
  ]);

  /* The visible box clips overflow into a phantom Nth column instead of
     growing, so its own clientHeight/scrollHeight can never report true
     overflow. Measure a hidden SINGLE-COLUMN mirror of the FULL narration
     (not the partial typewriter slice) instead, at the width one real column
     actually has, and treat "columnCount stacked columns of perColumnBudgetPx"
     as one tall single-column budget of perColumnBudgetPx * columnCount — the
     same total area, just unfolded into one column so useFitText's ordinary
     scrollHeight probe works unmodified. */
  const columnFitBudgetPx = Math.max(1, perColumnBudgetPx * columnCount);

  /* The mirror must be exactly ONE column wide (not the full box width),
     since it stands in for a single unfolded column — a full-width mirror
     would wrap the text too generously and under-report the true height.
     Derived from the box's real clientWidth so it tracks column count,
     gap and any responsive padding automatically. */
  const [columnWidthPx, setColumnWidthPx] = React.useState(0);
  React.useLayoutEffect(() => {
    const box = columnBoxRef.current;
    if (!box) return;
    const boxWidth = box.clientWidth;
    const next = Math.max(1, Math.round((boxWidth - 44 * (columnCount - 1)) / columnCount));
    setColumnWidthPx((prev) => (Math.abs(prev - next) <= 1 ? prev : next));
  }, [columnCount, p, hasVisual, title, titlePx]);

  const { px: narrationSize } = useFitText(
    mirrorRef,
    narrationTargetSize,
    descriptionFontSizeIsUserSet ? narrationTargetSize : p ? 18 : 15,
    [narration, narrationTargetSize, descriptionFontSizeIsUserSet, columnFitBudgetPx, columnWidthPx, columnCount, p],
    columnFitBudgetPx,
  );

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
        ref={contentLayerRef}
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
            ref={titleRef}
            style={{
              fontFamily: fontFamily ?? B_FONT,
              fontSize: titlePx,
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
          <div style={{ flex: p ? "0 1 auto" : "1 1 0", minWidth: 0, minHeight: 0, height: "100%", position: "relative" }}>
            {/* Hidden measurement mirror: the FULL narration (not the partial
                typewriter slice), laid out as a SINGLE column at the width one
                real column actually has, so its scrollHeight is a true content
                height unaffected by column-clipping or the reveal animation.
                `visibility:hidden` (not display:none, which reports 0 height)
                per this codebase's established mirror convention. */}
            <div
              ref={mirrorRef}
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: columnWidthPx || "100%",
                visibility: "hidden",
                pointerEvents: "none",
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
                  display: "inline-block",
                }}
              >
                {dropChar}
              </span>
              <span>{narration.length > 1 ? narration.slice(1) : ""}</span>
            </div>

            <div
              ref={columnBoxRef}
              style={{
                width: "100%",
                minHeight: 0,
                // columnFill:auto needs a definite height to know where column one
                // ends and column two begins; without it the column box grows and
                // everything stays in the first column.
                height: "100%",
                overflow: "hidden",
                // The column rule: the visual signature of this variant.
                columnCount,
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
