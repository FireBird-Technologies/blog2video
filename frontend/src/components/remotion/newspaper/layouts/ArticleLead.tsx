import React from "react";
import { NewspaperClip } from "../components/NewspaperClip";
import { useFitText } from "../components/useFitText";
import { AbsoluteFill, interpolate, useCurrentFrame, Img, useVideoConfig, staticFile } from "remotion";
import { NewsBackground } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const B_FONT = "'Source Sans 3', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * Lead paragraph with its drop cap and typewriter reveal.
 *
 * The visible copy is only partially revealed on most frames, so measuring it
 * would yield a height that grows with the animation and a font size that
 * changed mid-scene. Instead a hidden mirror of the FULL narration — same font,
 * width and drop cap — carries the measurement ref, so the fitted size is
 * computed once against the final text and stays fixed for the whole scene.
 */
const NarrationBody: React.FC<{
  measureRef: React.RefObject<HTMLDivElement>;
  fontSize: number;
  dropCapSize: number;
  narration: string;
  visText: string;
  showCursor: boolean;
  visChars: number;
  dropChar: string;
  dropCapOp: number;
  dropCapY: number;
  bodyFont: string;
  capFont: string;
  textColor: string;
  bgColor: string;
}> = ({
  measureRef, fontSize, dropCapSize, narration, visText, showCursor, visChars,
  dropChar, dropCapOp, dropCapY, bodyFont, capFont, textColor, bgColor,
}) => {
  const bodyStyle: React.CSSProperties = {
    fontFamily: bodyFont,
    fontSize,
    fontWeight: 500,
    color: textColor,
    lineHeight: 1.45,
  };
  const capStyle: React.CSSProperties = {
    float: "left",
    fontFamily: capFont,
    fontSize: dropCapSize,
    fontWeight: 800,
    lineHeight: 0.7,
    marginRight: 15,
    marginTop: 5,
    color: textColor,
    display: "inline-block",
  };

  return (
    <div style={{ position: "relative" }}>
      {/* Measurement mirror: full text, laid out identically, never painted. */}
      <div
        ref={measureRef}
        aria-hidden
        style={{
          ...bodyStyle,
          position: "absolute",
          inset: 0,
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        <span style={capStyle}>{dropChar}</span>
        <span>{narration.length > 1 ? narration.slice(1) : ""}</span>
      </div>

      <div style={bodyStyle}>
        <span style={{ ...capStyle, opacity: dropCapOp, transform: `translateY(${dropCapY}px)` }}>
          {dropChar}
        </span>
        <span style={{ textShadow: `0 0 2px ${bgColor}` }}>
          {visText.length > 1 ? visText.slice(1) : ""}
          {showCursor && visChars > 0 && (
            <span style={{ display: "inline-block", width: 4, height: "0.9em", background: textColor, opacity: 0.6, marginLeft: 2, verticalAlign: "middle" }} />
          )}
        </span>
      </div>
    </div>
  );
};

export const ArticleLead: React.FC<BlogLayoutProps & { imageUrl?: string }> = ({
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
  stats,imageUrl,
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
  const { durationInFrames, width: videoWidth, height: videoHeight } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const pullVal = stats?.[0]?.value ?? "";
  const pullCap = stats?.[0]?.label ?? "";

  // --- Animation Logic (Unchanged) ---
  const cameraRotateX = interpolate(frame, [0, 60], [15, 5], { extrapolateRight: "clamp" });
  const cameraRotateY = interpolate(frame, [0, 60], [8, 0], { extrapolateRight: "clamp" });
  const cameraScale = interpolate(frame, [0, 30, 100, durationInFrames], [1.05, 1.2, 0.92, 0.90], { extrapolateRight: "clamp" });
  const cameraTranslateY = interpolate(frame, [0, durationInFrames], [0, -35]);

  const ruleW = interpolate(frame, [0, 16], [0, 100], { extrapolateRight: "clamp" });
  const labelOp = interpolate(frame, [6, 20], [0, 1], { extrapolateRight: "clamp" });
  const dropCapOp = interpolate(frame, [10, 26], [0, 1], { extrapolateRight: "clamp" });
  const dropCapY = interpolate(frame, [10, 26], [16, 0], { extrapolateRight: "clamp" });

  const bodyProgress = interpolate(frame, [20, 74], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const visChars = Math.floor(narration.length * bodyProgress);
  const visText = narration.slice(0, visChars);
  const showCursor = visChars < narration.length;

  const pullSlide = interpolate(frame, [54, 72], [80, 0], { extrapolateRight: "clamp" });
  const pullOp = interpolate(frame, [54, 70], [0, 1], { extrapolateRight: "clamp" });
  const pullNumP = interpolate(frame, [66, 82], [0, 1], { extrapolateRight: "clamp" });

  const imageOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });
  const imageScale = interpolate(frame, [25, 45], [0.8, 1], { extrapolateRight: "clamp" });
  const imageRotation = interpolate(frame, [25, 45], [5, p ? -2 : 3], { extrapolateRight: "clamp" });

  const numericMatch = pullVal.match(/^(\d+(?:\.\d+)?)(.*)/);
  const baseNum = numericMatch ? parseFloat(numericMatch[1]) : null;
  const numSuffix = numericMatch ? numericMatch[2] : pullVal;
  const animatedNum = baseNum !== null ? Math.round(baseNum * pullNumP) : null;
  const displayVal = animatedNum !== null ? `${animatedNum}${numSuffix}` : pullVal;

  const dropChar = narration[0] ?? "";

  // --- Custom Logic for User Instructions ---
  const isLandscapeWithImage = !p && (imageUrl || videoUrl);

  const narrationSize = descriptionFontSize ?? (p ? 35 : 30);
  const baseForStats = descriptionFontSize ?? (p ? 35 : 30);
  const statsValueSize = baseForStats + 40;
  const statsLabelSize = baseForStats - 15;

  let actualTitleMarginBottom: string | number;
  let bodyContentAreaMarginTop: string | number = 0;

  // A clip fills the same visual slot as a still, so it must not trigger
  // the no-image layout variant.
  const hasVisual = Boolean(imageUrl || videoUrl);

  if (p && !hasVisual) {
    // Portrait mode, NO image: Narration at top, stats in middle
    actualTitleMarginBottom = 40; // More space below title for narration
    bodyContentAreaMarginTop = 0; // Narration starts high in the body area
  } else if (p) { // This handles portrait WITH an image (keep current layout)
    actualTitleMarginBottom = 20;
    bodyContentAreaMarginTop = "20vh";
  } else { // This handles landscape (with or without image) - keep current layout
    actualTitleMarginBottom = 50;
    bodyContentAreaMarginTop = 0;
  }

  const bodyContentAreaFlexDirection = (p && !hasVisual) ? "column" : (p ? "column-reverse" : "row");
  const bodyContentAreaJustifyContent = (p && !hasVisual) ? "flex-start" : (p ? "flex-start" : "space-between");

  const narrationWidth = p ? "100%" : "52%";

  /* ── Auto-fit ──────────────────────────────────────────────
     Title and narration are both unbounded user input, so long copy overflows
     the card and is clipped by the AbsoluteFill's overflow:hidden (and pushes
     the pull-stat out of frame). Measure the real available height and shrink.

     Same contract as news_headline: the headline fits its own share of the
     column first, then the narration fits whatever is left; if the narration
     bottoms out at its floor and still overflows, the headline gives back
     exactly the shortfall. A size the user explicitly picked is honored
     exactly (minPx === targetPx makes the hook a no-op). */
  const titleRef = React.useRef<HTMLDivElement>(null);
  const contentLayerRef = React.useRef<HTMLDivElement>(null);
  const narrationRef = React.useRef<HTMLDivElement>(null);

  const actualTitleFontSize = titleFontSize ?? (p ? 84 : 67);

  const titleBudgetPx = React.useMemo(() => {
    // Content layer height minus its vertical padding (a % of the frame).
    const inner = videoHeight * (1 - (p ? 0.17 : 0.09));
    // The headline may claim at most this much; the rest is reserved for the
    // rule, the narration and the pull-stat.
    return Math.max(1, inner * (p ? 0.4 : 0.45));
  }, [videoHeight, p]);

  const { px: titlePx } = useFitText(
    titleRef,
    actualTitleFontSize,
    titleFontSizeIsUserSet ? actualTitleFontSize : p ? 36 : 30,
    [title, actualTitleFontSize, titleFontSizeIsUserSet, titleBudgetPx, p],
    titleBudgetPx,
  );

  /* The narration sits in a row (landscape) / column whose children are not
     height-constrained, so its own clientHeight is just the copy height and
     could never report overflow. Budget it explicitly from the REAL measured
     height of the header block (rule + headline + margin), which is already in
     the DOM by the time the narration is fitted. */
  /* The body row's children are not height-constrained, so the narration's own
     clientHeight is just the copy height and could never report overflow.
     Budget it from untransformed layout geometry — offsetTop/offsetHeight,
     which the animated 3D camera does not affect (unlike getBoundingClientRect,
     which returns a perspective-projected box that changes every frame). */
  const [narrationBudgetPx, setNarrationBudgetPx] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = narrationRef.current;
    const layer = contentLayerRef.current;
    if (!el || !layer) return;
    const padBottom = parseFloat(window.getComputedStyle(layer).paddingBottom) || 0;
    // offsetTop is relative to the nearest positioned ancestor (the layer).
    let top = 0;
    for (let n = el as HTMLElement | null; n && n !== layer; n = n.offsetParent as HTMLElement | null) {
      top += n.offsetTop;
    }
    const next = Math.max(1, Math.round(layer.offsetHeight - padBottom - top));
    setNarrationBudgetPx((prev) => (Math.abs(prev - next) <= 1 ? prev : next));
  }, [titlePx, title, narration, narrationSize, p, hasVisual]);

  const { px: narrationPx } = useFitText(
    narrationRef,
    narrationSize,
    descriptionFontSizeIsUserSet ? narrationSize : p ? 18 : 15,
    [narration, narrationSize, descriptionFontSizeIsUserSet, titlePx, narrationBudgetPx, p, hasVisual],
    narrationBudgetPx,
  );

  // Keep the drop cap proportional to the fitted body so it never dwarfs
  // shrunken copy (it is ~3.7x the body size at the default sizes).
  const dropCapPx = Math.round(narrationPx * ((p ? 130 : 110) / (p ? 35 : 30)));

  const narrationCommon = {
    narration,
    visText,
    showCursor,
    visChars,
    dropChar,
    dropCapOp,
    dropCapY,
    bodyFont: fontFamily ?? B_FONT,
    capFont: fontFamily ?? H_FONT,
    textColor,
    bgColor,
  };

  // Stats Box Styling
  const statsContainerStyles: React.CSSProperties = {
    opacity: pullOp,
    transform: `translateX(${pullSlide}px) translateZ(30px)`,
    fontFamily: fontFamily ?? B_FONT,
    color: textColor,
    width: p ? "100%" : "30%", // Default for portrait or flex item in landscape
    borderLeft: `${(p ? 12 : 8)}px solid ${accentColor}`,
    paddingLeft: 25,
    alignSelf: p ? "center" : "center", // Horizontal centering for portrait; default for landscape
  };

  if (p && !hasVisual) {
    // Portrait, NO image: Stats in middle, no left border, top border instead, centered
    statsContainerStyles.borderLeft = "none";
    statsContainerStyles.borderTop = `8px solid ${accentColor}`;
    statsContainerStyles.paddingTop = 25;
    statsContainerStyles.paddingLeft = 0;
    statsContainerStyles.marginTop = "auto"; // Push to bottom (after narration), then center with marginBottom
    statsContainerStyles.marginBottom = "auto"; // Attempt to center vertically in remaining space
    statsContainerStyles.width = "88%"; // Make it narrower for better centering
  } else if (isLandscapeWithImage) {
    // Landscape with image: Stats move to the bottom, become absolutely positioned
    statsContainerStyles.position = "absolute";
    statsContainerStyles.bottom = "6%";
    statsContainerStyles.right = "8%";
    statsContainerStyles.width = "30%";
    statsContainerStyles.borderLeft = "none";
    statsContainerStyles.borderTop = `${8}px solid ${accentColor}`;
    statsContainerStyles.paddingTop = 25;
    statsContainerStyles.paddingLeft = 0;
    delete statsContainerStyles.alignSelf; // Not a flex item anymore
    delete statsContainerStyles.marginTop; // Clear auto margins if they were set
    delete statsContainerStyles.marginBottom;
  } else if (p) { // Portrait with image (current behavior: stats appear above narration due to column-reverse)
    statsContainerStyles.alignSelf = "flex-start"; // Keep it at the start for column-reverse (it's the first flex item)
  }


  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: fontFamily ?? B_FONT, backgroundColor: "#000", perspective: "1500px" }}>
      <div style={{
        width: "100%",
        height: "100%",
        transformStyle: "preserve-3d",
        transform: `scale(${cameraScale}) rotateX(${cameraRotateX}deg) rotateY(${cameraRotateY}deg) translateY(${cameraTranslateY}px)`,
      }}>
        
        <NewsBackground bgColor={bgColor} />
        <div style={{ position: "absolute", inset: 0, backgroundColor: bgColor, opacity: 0.45, zIndex: 2 }} />
        <img src={staticFile("vintage-news.avif")} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.4, filter: "grayscale(75%) contrast(1.08)", zIndex: 1 }} />

        {/* --- DYNAMIC IMAGE PLACEMENT --- */}
        {hasVisual && (
          <div
            style={{
              position: "absolute",
              // Portrait: Centered Middle | Landscape: Anchored Right
              top: p ? "23%" : "20%",
              right: p ? "auto" : "6%",
              left: p ? "50%" : "auto",
              width: p ? "88%" : "38%",
              height: p ? "38%" : "60%", // Decreased height for portrait mode
              transform: p
                ? `translateX(-50%) translateZ(40px) scale(${imageScale}) rotate(${imageRotation}deg)`
                : `translateZ(40px) scale(${imageScale}) rotate(${imageRotation}deg)`,
              opacity: imageOpacity,
              zIndex: 10,
              padding: "10px",
              backgroundColor: "#fff",
              boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
              clipPath: "polygon(0% 0%, 100% 2%, 98% 98%, 2% 100%)",
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
                  style={{
                filter: "grayscale(0.7) contrast(1.1)",
                  }}
                />
              ) : imageUrl ? (
              <Img
                src={imageUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
                  objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
                  transform: `scale(${imageZoom ?? 1})`,
                  transformOrigin: (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
                  filter: "grayscale(0.7) contrast(1.1)",
                }}
              />
              ) : null}
            </div>
          </div>
        )}

        {/* --- MAIN CONTENT LAYER --- */}
        <div
          ref={contentLayerRef}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            padding: p ? "8.5% 8%" : "4.5% 8%",
            zIndex: 5,
            transform: "translateZ(60px)",
          }}
        >
          {/* 1. HEADER - Bold & Large */}
          <div style={{ marginBottom: actualTitleMarginBottom, width: p ? "100%" : "55%", flexShrink: 0 }}>
            <div style={{ height: p ? 12 : 8, background: textColor, width: `${ruleW}%`, marginBottom: 20 }} />
            <div
              ref={titleRef}
              style={{
                fontFamily: fontFamily ?? B_FONT,
                fontSize: titlePx,
                fontWeight: 900,
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
                color: textColor,
                opacity: labelOp,
                lineHeight: 0.95,
              }}
            >
              {title}
            </div>
          </div>

          {/* 2. BODY CONTENT AREA (Narration and Stats) */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: bodyContentAreaFlexDirection,
              gap: p ? 30 : 60,
              alignItems: p ? "stretch" : "center", // 'stretch' for columns allows children to take full width
              justifyContent: bodyContentAreaJustifyContent,
              marginTop: bodyContentAreaMarginTop,
              // Let the narration shrink into the leftover space instead of
              // pushing past the card and taking the pull-stat with it.
              minHeight: 0,
            }}
          >
            {/* Conditional ordering based on `p` and `imageUrl` */}
            {p && !hasVisual ? ( // Portrait, NO image: Narration then Stats
              <>
                {/* NARRATION TEXT (First in column) */}
                <div style={{ width: narrationWidth, marginBottom: 50, minHeight: 0, flexShrink: 1 }}>
                  <NarrationBody
                    measureRef={narrationRef}
                    fontSize={narrationPx}
                    dropCapSize={dropCapPx}
                    {...narrationCommon}
                  />
                </div>
                {/* PULL STAT (Second in column, pushed to middle) */}
                {pullVal && (
                  <div style={statsContainerStyles}>
                    <div
                      style={{
                        fontFamily: fontFamily ?? H_FONT,
                        fontSize: statsValueSize,
                        fontWeight: 800,
                        color: textColor,
                        lineHeight: 1,
                        marginBottom: 5,
                      }}
                    >
                      {displayVal}
                    </div>
                    {pullCap && (
                      <div
                        style={{
                          fontFamily: fontFamily ?? B_FONT,
                          fontSize: statsLabelSize,
                          fontWeight: 700,
                          color: textColor,
                          opacity: 0.7,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em"
                        }}
                      >
                        {pullCap}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : ( // All other cases: Portrait WITH image or Landscape
                  // Portrait WITH image: Stats then Narration (column-reverse)
                  // Landscape: Narration then Stats (row, narration first by default layout if stats is absent or to right)
              <>
                {/* PULL STAT (If not landscape with image, it's a flex item here) */}
                {pullVal && !isLandscapeWithImage && (
                  <div style={statsContainerStyles}>
                    <div
                      style={{
                        fontFamily: fontFamily ?? H_FONT,
                        fontSize: statsValueSize,
                        fontWeight: 800,
                        color: textColor,
                        lineHeight: 1,
                        marginBottom: 5,
                      }}
                    >
                      {displayVal}
                    </div>
                    {pullCap && (
                      <div
                        style={{
                          fontFamily: fontFamily ?? B_FONT,
                          fontSize: statsLabelSize,
                          fontWeight: 700,
                          color: textColor,
                          opacity: 0.7,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em"
                        }}
                      >
                        {pullCap}
                      </div>
                    )}
                  </div>
                )}

                {/* NARRATION TEXT */}
                <div style={{ width: narrationWidth, minHeight: 0, flexShrink: 1 }}>
                  <NarrationBody
                    measureRef={narrationRef}
                    fontSize={narrationPx}
                    dropCapSize={dropCapPx}
                    {...narrationCommon}
                  />
                </div>
              </>
            )}
          </div>

          {/* PULL STAT (Only for Landscape with Image, positioned at bottom) */}
          {pullVal && isLandscapeWithImage && (
            <div style={statsContainerStyles}>
              <div
                style={{
                  fontFamily: fontFamily ?? H_FONT,
                  fontSize: statsValueSize,
                  fontWeight: 800,
                  color: textColor,
                  lineHeight: 1,
                  marginBottom: 5,
                }}
              >
                {displayVal}
              </div>
              {pullCap && (
                <div
                  style={{
                    fontFamily: fontFamily ?? B_FONT,
                    fontSize: statsLabelSize,
                    fontWeight: 700,
                    color: textColor,
                    opacity: 0.7,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em"
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

