import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { NewsBackground } from "../NewsBackground";
import { useFitText, useAvailableHeight } from "../components/useFitText";
import type { BlogLayoutProps } from "../types";

const H_FONT = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const B_FONT = "'Source Sans 3', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export const PullQuote: React.FC<BlogLayoutProps> = ({
  title = "This is not a political game. Real people will feel real consequences starting tomorrow.",
  narration = "— Senate Majority Leader",
  accentColor = "#FFE34D",
  bgColor = "#FAFAF8",
  textColor = "#111111",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  stats,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const p = aspectRatio === "portrait";
  // Use 1280 as the baseline so 720p portrait/landscape don't shrink; never go below 1
  const source = stats?.[0]?.label ?? "";

  // --- Continuous Motion Logic ---
  const motionProgress = interpolate(frame, [0, 50, durationInFrames], [0, 1, 1.2], {
    extrapolateRight: "clamp",
  });

  // --- Exit Transition Logic ---
  const EXIT_TRANSITION_START = durationInFrames - 50; // Shards and text start their exit movement/scale
  const CONTENT_FADE_START = durationInFrames - 15; // All content fades out

  // Opacity for all content (except the main AbsoluteFill background)
  const contentOpacity = interpolate(frame, 
    [CONTENT_FADE_START, durationInFrames], 
    [1, 0], 
    { extrapolateLeft: "clamp" }
  );

  // --- Shard Logic: Optimized for Portrait Aspect Ratio ---
  const shardWidthFactor = p ? 0.8 : 0.5; 

  // Intro animation for shards
  const leftShardX_intro = interpolate(motionProgress, [0, 1, 1.2], [-width, 0, 0], { extrapolateRight: "clamp" });
  const leftShardRot_intro = interpolate(motionProgress, [0, 1, 1.2], [-15, 0, 0], { extrapolateRight: "clamp" });
  
  const rightShardX_intro = interpolate(motionProgress, [0, 1, 1.2], [width, 0, 0], { extrapolateRight: "clamp" });
  const rightShardRot_intro = interpolate(motionProgress, [0, 1, 1.2], [15, 0, 0], { extrapolateRight: "clamp" });

  // Exit animation for shards: Scale and extra translation/rotation to cover screen
  const shardScale = interpolate(frame, 
    [EXIT_TRANSITION_START, durationInFrames], 
    [1, 4], // Scale up significantly to ensure full coverage
    { extrapolateLeft: "clamp" }
  );

  const leftShardExitTranslateX = interpolate(frame, 
    [EXIT_TRANSITION_START, durationInFrames], 
    [0, -width * 0.7], // Push left shard further left
    { extrapolateLeft: "clamp" }
  );

  const rightShardExitTranslateX = interpolate(frame, 
    [EXIT_TRANSITION_START, durationInFrames], 
    [0, width * 0.7], // Push right shard further right
    { extrapolateLeft: "clamp" }
  );

  const leftShardExitRotate = interpolate(frame, 
    [EXIT_TRANSITION_START, durationInFrames], 
    [0, -30], 
    { extrapolateLeft: "clamp" }
  );

  const rightShardExitRotate = interpolate(frame, 
    [EXIT_TRANSITION_START, durationInFrames], 
    [0, 30], 
    { extrapolateLeft: "clamp" }
  );

  // Combine intro and exit transforms for shards
  const finalLeftShardTransform = `
    translateX(${leftShardX_intro + leftShardExitTranslateX}px) 
    rotate(${leftShardRot_intro + leftShardExitRotate}deg) 
    scale(${shardScale})
  `;

  const finalRightShardTransform = `
    translateX(${rightShardX_intro + rightShardExitTranslateX}px) 
    rotate(${rightShardRot_intro + rightShardExitRotate}deg) 
    scale(${shardScale})
  `;

  // UI Animations
  const barH = interpolate(frame, [0, 18], [0, 100], { extrapolateRight: "clamp" });
  const quoteMarkS = interpolate(frame, [6, 22], [0.6, 1.2], { extrapolateRight: "clamp" });
  const quoteMarkOp = interpolate(frame, [6, 20], [0, 1], { extrapolateRight: "clamp" });
  
  const words = title.split(" ");
  const wordProgress = interpolate(frame, [16, 54], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const visWords = Math.floor(words.length * wordProgress);

  const attrOp = interpolate(frame, [50, 64], [0, 1], { extrapolateRight: "clamp" });
  const sourceOp = interpolate(frame, [58, 72], [0, 1], { extrapolateRight: "clamp" });

  /* ── Auto-fit ──────────────────────────────────────────────
     Quote and attribution are unbounded user input; long copy overflows the
     card and is clipped. Fit the quote to the space between the quote mark and
     the bottom of the content box, then the attribution to what remains.
     An explicitly chosen size is honored exactly (minPx === targetPx no-ops). */
  const contentRef = React.useRef<HTMLDivElement>(null);
  const quoteRef = React.useRef<HTMLDivElement>(null);
  const attrRef = React.useRef<HTMLDivElement>(null);

  const quoteTarget = titleFontSize ?? (p ? 90 : 71);
  const attrTarget = descriptionFontSize ?? (p ? 27 : 23);

  // The quote must leave room for the attribution block below it.
  const quoteAvail = useAvailableHeight(quoteRef, contentRef, [title, quoteTarget, p]);
  // Reserve what sits BELOW the quote (attribution + source + margin) AND the
  // quote mark above it, so the fitted quote leaves room for both.
  const markReserve = Math.round((p ? 140 : 120) * 0.5 + (p ? 20 : 15));
  const attrReserve = Math.round(attrTarget * 1.4 + 8 + 18 * 1.4 + 40) + markReserve;
  const { px: quotePx } = useFitText(
    quoteRef,
    quoteTarget,
    titleFontSizeIsUserSet ? quoteTarget : p ? 34 : 28,
    [title, quoteTarget, titleFontSizeIsUserSet, quoteAvail, attrReserve, p],
    quoteAvail ? Math.max(1, quoteAvail - attrReserve) : undefined,
  );

  const attrAvail = useAvailableHeight(attrRef, contentRef, [title, quotePx, attrTarget, p]);
  const { px: attrPx } = useFitText(
    attrRef,
    attrTarget,
    descriptionFontSizeIsUserSet ? attrTarget : p ? 16 : 14,
    [narration, attrTarget, descriptionFontSizeIsUserSet, quotePx, attrAvail, p],
    attrAvail || undefined,
  );

  // --- New: Content exit scale for text zoom ---
  const contentExitScale = interpolate(frame,
    [EXIT_TRANSITION_START, durationInFrames],
    [1, 4], // Scale up at the same rate as shards
    { extrapolateLeft: "clamp" }
  );

  // --- New: Content blur for text exit ---
  const contentBlur = interpolate(frame,
    [EXIT_TRANSITION_START, durationInFrames],
    [0, 10], // From 0px blur to 10px blur
    { extrapolateLeft: "clamp" }
  );

  return (
    <AbsoluteFill style={{ 
      overflow: "hidden", 
      fontFamily: fontFamily ?? B_FONT, 
      backgroundColor: bgColor,
      perspective: "1200px" 
    }}>
      <div style={{
        width: "100%",
        height: "100%",
        opacity: contentOpacity,
        transformStyle: "preserve-3d"
      }}>
        <NewsBackground bgColor={bgColor} />

        <div style={{
            position: "absolute",
            inset: 0,
            backgroundColor: bgColor,
            opacity: 0.45,
            zIndex: 2,
        }} />

        {/* Shards: Width adjusted for aspect ratio, applying combined transform */}
        <img
          src={staticFile("vintage-news.avif")}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: `${shardWidthFactor * 100}%`,
            height: "100%",
            objectFit: "cover",
            opacity: 0.35,
            transform: finalLeftShardTransform,
            zIndex: 1,
          }}
        />

        <img
          src={staticFile("vintage-news.avif")}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: `${shardWidthFactor * 100}%`,
            height: "100%",
            objectFit: "cover",
            opacity: 0.35,
            transform: finalRightShardTransform,
            zIndex: 1,
          }}
        />

        {/* Main Content */}
        <div ref={contentRef} style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "10% 10%" : "6% 10%",
          zIndex: 3,
          transform: `translateZ(80px) scale(${contentExitScale})`, // Added contentExitScale for text zoom
          filter: `blur(${contentBlur}px)`, // Added blur filter
        }}>
          <div style={{
            display: "flex",
            flexDirection: "row",
            gap: p ? 24 : 32,
            alignItems: "flex-start",
            maxWidth: p ? width * 0.9 : 1000,
            width: "100%",
            // Bound the block to the padded content box. Unbounded, a long quote
            // grew in BOTH directions out of the centred container — pushing the
            // opening quote mark off the top and the attribution off the bottom.
            maxHeight: "100%",
            minHeight: 0,
          }}>
            {/* Accent Bar */}
            <div style={{
              width: p ? 10 : 8,
              flexShrink: 0,
              background: accentColor,
              alignSelf: "stretch",
              clipPath: `inset(0 0 ${100 - barH}% 0)`,
              minHeight: p ? 120 : 80,
              borderRadius: 4,
            }} />

            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Quote Mark */}
              <div style={{
                fontFamily: fontFamily ?? H_FONT,
                fontSize: p ? 140 : 120, 
                lineHeight: 0.5,
                color: accentColor,
                opacity: quoteMarkOp,
                transform: `scale(${quoteMarkS})`,
                transformOrigin: "left top",
                marginBottom: p ? 20 : 15,
                flexShrink: 0,
              }}>
                &#8220;
              </div>

              {/* Main Quote Text */}
              <div style={{ position: "relative", marginBottom: 40 }}>
                {/* Measurement mirror: the quote reveals word by word, so the
                    visible copy would measure short and the size would change
                    mid-scene. Measure the FULL quote, hidden, instead. */}
                <div
                  ref={quoteRef}
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    visibility: "hidden",
                    pointerEvents: "none",
                    fontFamily: fontFamily ?? H_FONT,
                    fontSize: quotePx,
                    fontWeight: 600,
                    lineHeight: 1.25,
                    letterSpacing: p ? "-0.02em" : "normal",
                  }}
                >
                  {title}
                </div>
                <div style={{
                  fontFamily: fontFamily ?? H_FONT,
                  fontSize: quotePx,
                  fontWeight: 600,
                  lineHeight: 1.25,
                  color: textColor,
                  letterSpacing: p ? "-0.02em" : "normal",
                }}>
                  {words.slice(0, visWords).join(" ")}
                  {visWords < words.length && visWords > 0 && (
                    <span style={{
                      display: "inline-block",
                      width: p ? 4 : 3,
                      height: "0.8em",
                      background: textColor,
                      opacity: 0.5,
                      marginLeft: 6,
                      verticalAlign: "middle"
                    }} />
                  )}
                </div>
              </div>

              {/* Attribution */}
              <div style={{ opacity: attrOp }}>
                <div ref={attrRef} style={{
                    fontFamily: fontFamily ?? B_FONT,
                    fontSize: attrPx,
                    fontWeight: 800,
                    color: textColor, 
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em"
                }}>
                  {narration}
                </div>
                {source && (
                  <div style={{ 
                    fontFamily: fontFamily ?? B_FONT, 
                    fontSize: 18,
                    fontWeight: 600, 
                    color: textColor, 
                    opacity: sourceOp * 0.7 
                  }}>
                    {source}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
