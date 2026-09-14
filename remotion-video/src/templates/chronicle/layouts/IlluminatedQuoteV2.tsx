import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ChronicleLayoutProps } from "../types";
import {
  CHRONICLE_BODY_FONT,
  CHRONICLE_HEADING_FONT,
  CHRONICLE_SMALLCAPS_FONT,
} from "../../../fonts/chronicle-defaults";
import { IlluminatedDropCap } from "../components/IlluminatedDropCap";
import { OrnamentalBorder } from "../components/OrnamentalBorder";
import { EmbossedImage } from "../components/EmbossedImage";
import { QuillText } from "../components/QuillInk";
import { useFitText } from "../components/useFitText";
import { IlluminatedStoryCompass } from "./ParchmentScrollV2";

/**
 * illuminated_quote__v2 — "The Witnessed Passage".
 *
 * A quotation preserved as a manuscript testimony: an illuminated initial,
 * measured text, a signed attribution, and a narrow marginalia rail. The rail
 * becomes a painted miniature when media is supplied, otherwise it carries a
 * heraldic witness mark. Nothing reads as a modern card or banner.
 */
export const IlluminatedQuoteV2: React.FC<ChronicleLayoutProps> = ({
  title,
  narration,
  quote,
  attribution,
  highlightPhrase,
  rubricLabel = "A witnessed passage",
  accentColor = "#B8860B",
  textColor = "#2A1810",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  fontFamily,
  imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, width, height } = useVideoConfig();
  const portrait = aspectRatio === "portrait" || height > width;
  // Template Studio's source-default updater recognizes responsive fallbacks
  // written in the standard `p ? portrait : landscape` form.
  const p = portrait;

  // Empty schema defaults must not suppress the scene narration/title. Using
  // `??` here made quote: "" resolve to a completely blank witnessed passage.
  const rubricText = rubricLabel.trim();
  const quoteText = quote?.trim() || narration?.trim() || title?.trim() || rubricText || "Witnessed passage";
  const attributionText = attribution?.trim() || title?.trim() || "";
  const firstLetterIndex = quoteText.search(/[A-Za-z]/);
  const initial = firstLetterIndex >= 0 ? quoteText[firstLetterIndex].toUpperCase() : "A";
  const quoteBody = firstLetterIndex >= 0
    ? `${quoteText.slice(0, firstLetterIndex)}${quoteText.slice(firstLetterIndex + 1)}`.trim()
    : quoteText;
  const hasMedia = Boolean(imageUrl || videoUrl);

  const pageIn = spring({
    frame: frame - 4,
    fps,
    config: { damping: 24, stiffness: 68, mass: 1.2 },
  });
  const rubricIn = interpolate(frame, [15, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const attributionIn = interpolate(frame, [78, 104], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const heading = fontFamily ?? CHRONICLE_HEADING_FONT;
  const body = fontFamily ?? CHRONICLE_BODY_FONT;
  const pageW = portrait ? width * 0.88 : width * 0.82;
  const pageH = portrait ? height * 0.86 : height * 0.8;

  const quoteRef = React.useRef<HTMLDivElement>(null);
  const quoteTarget = titleFontSize ?? (p ? 66 : 75);
  const quoteBudgetPx = Math.round(pageH * (portrait ? 0.34 : 0.46));
  // A floor of ~0.4x the target (≈30px) is fine for realistic copy, but an
  // extreme quote (many repeated sentences) can still overflow at that floor
  // — the text must keep shrinking until it actually fits, never stop early
  // and clip/fade what's left. 12px is small but legible; useFitText only
  // goes this low when nothing larger fits the box.
  const quoteMinPx = 12;
  const { px: quotePx } = useFitText(
    quoteRef,
    quoteTarget,
    titleFontSizeIsUserSet ? quoteTarget : quoteMinPx,
    [quoteBody, highlightPhrase, quoteTarget, titleFontSizeIsUserSet, portrait, hasMedia, pageW],
    quoteBudgetPx,
  );

  /* Attribution — like the quote above, QuillText mode="word" renders every
     word into the DOM from frame 0 (only opacity/translateY animate per
     word), so a direct ref on the visible element is safe — no measurement
     mirror needed, matching quoteRef's own pattern a few lines above. */
  const attributionRef = React.useRef<HTMLSpanElement>(null);
  const attributionTarget = descriptionFontSize ?? (p ? 77 : 40);
  const { px: attributionPx } = useFitText(
    attributionRef,
    attributionTarget,
    descriptionFontSizeIsUserSet ? attributionTarget : Math.round(attributionTarget * 0.4),
    [attributionText, attributionTarget, descriptionFontSizeIsUserSet, portrait, pageW],
    undefined,
  );
  const smallCapsPx = Math.max(11, Math.round(attributionPx * 0.64));
  const dropCapSize = portrait
    ? Math.max(92, Math.min(150, quotePx * 2.05))
    : Math.max(104, Math.min(170, quotePx * 2.1));

  const renderQuoteBody = () => {
    const highlight = (highlightPhrase ?? "").trim();
    const index = highlight ? quoteBody.toLowerCase().indexOf(highlight.toLowerCase()) : -1;
    if (index < 0) {
      return (
        <QuillText
          text={quoteBody}
          startFrame={31}
          durationFrames={Math.min(105, Math.max(42, quoteBody.length * 1.15))}
          mode="word"
          showCursor={false}
          style={{ fontStyle: "normal" }}
        />
      );
    }

    const before = quoteBody.slice(0, index);
    const marked = quoteBody.slice(index, index + highlight.length);
    const after = quoteBody.slice(index + highlight.length);
    const markIn = interpolate(frame, [48, 72], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    return (
      <>
        <QuillText text={before} startFrame={31} durationFrames={Math.min(62, Math.max(18, before.length))} mode="word" showCursor={false} style={{ fontStyle: "normal" }} />
        <span
          style={{
            position: "relative",
            display: "inline",
            color: textColor,
            fontStyle: "normal",
            boxShadow: `inset 0 -0.28em 0 ${accentColor}55`,
            background: `linear-gradient(105deg, transparent ${Math.max(0, markIn * 100 - 22)}%, rgba(255,244,190,0.8) ${markIn * 100}%, transparent ${Math.min(100, markIn * 100 + 18)}%)`,
          }}
        >
          <QuillText text={marked} startFrame={47} durationFrames={32} mode="word" showCursor={false} style={{ fontStyle: "normal" }} />
        </span>
        <QuillText text={after} startFrame={57} durationFrames={Math.min(62, Math.max(18, after.length))} mode="word" showCursor={false} style={{ fontStyle: "normal" }} />
      </>
    );
  };

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", overflow: "hidden", opacity: fadeOut, fontFamily: body }}>
      <div
        style={{
          position: "absolute",
          width: portrait ? "105%" : "75%",
          height: portrait ? "58%" : "90%",
          background: "radial-gradient(ellipse, rgba(255,201,108,0.2), rgba(255,190,85,0.05) 50%, transparent 72%)",
          filter: "blur(26px)",
        }}
      />

      <div
        style={{
          position: "relative",
          width: pageW,
          height: pageH,
          opacity: pageIn,
          transform: `translateY(${interpolate(pageIn, [0, 1], [30, 0])}px) scale(${interpolate(pageIn, [0, 1], [0.98, 1])})`,
          filter: "drop-shadow(0 28px 34px rgba(38,22,9,0.28))",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: "polygon(.8% 1%,18% .3%,37% .9%,56% .2%,78% .7%,99.1% .2%,99.7% 26%,99.1% 52%,99.8% 78%,99.1% 99%,76% 99.6%,53% 99%,29% 99.7%,.7% 99.1%,.2% 72%,.8% 46%,.3% 21%)",
            background: "radial-gradient(ellipse at 22% 12%,rgba(255,246,211,.82),transparent 43%),radial-gradient(ellipse at 78% 84%,rgba(133,83,27,.11),transparent 44%),linear-gradient(96deg,#d8be84 0%,#f5e8c7 3.5%,#f1e0b9 96%,#c8a96c 100%)",
            boxShadow: `inset 0 0 0 1px ${accentColor}, inset 0 0 72px rgba(72,43,14,0.15)`,
          }}
        />

        <div style={{ position: "absolute", inset: portrait ? "4.5%" : "5.5%" }}>
          <OrnamentalBorder color={accentColor} size={portrait ? 96 : 118} startFrame={7} variant="fleur" />

          <div
            style={{
              position: "absolute",
              inset: portrait ? "5% 5.5%" : "5% 6%",
              display: "flex",
              flexDirection: portrait ? "column" : "row",
              minWidth: 0,
              minHeight: 0,
            }}
          >
            <div
              style={{
                flex: portrait ? "1 1 auto" : "1 1 70%",
                minWidth: 0,
                minHeight: 0,
                padding: portrait ? "3% 3% 1%" : "3% 6% 3% 2%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                position: "relative",
              }}
            >
              {rubricText && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    color: accentColor,
                    fontFamily: CHRONICLE_SMALLCAPS_FONT,
                    fontSize: smallCapsPx,
                    fontWeight: 700,
                    letterSpacing: "0.26em",
                    textTransform: "uppercase",
                    opacity: rubricIn,
                    marginBottom: portrait ? 30 : 34,
                  }}
                >
                  <span style={{ flex: 1, height: 1, background: accentColor }} />
                  {rubricText}
                  <span style={{ width: portrait ? 34 : 54, height: 1, background: accentColor }} />
                </div>
              )}

              <div style={{ display: "flex", alignItems: "flex-start", gap: portrait ? 24 : 30, minHeight: 0 }}>
                <div style={{ flexShrink: 0, marginTop: portrait ? 2 : 4 }}>
                  <IlluminatedDropCap
                    letter={initial}
                    size={dropCapSize}
                    accentColor={accentColor}
                    textColor={textColor}
                    startFrame={22}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
                  <div
                    style={{
                      position: "absolute",
                      top: portrait ? -84 : -108,
                      right: 4,
                      fontFamily: CHRONICLE_HEADING_FONT,
                      fontSize: portrait ? 175 : 210,
                      lineHeight: 1,
                      color: accentColor,
                      opacity: 0.11 * rubricIn,
                      pointerEvents: "none",
                    }}
                  >
                    &rdquo;
                  </div>
                  <div
                    ref={quoteRef}
                    style={{
                      fontFamily: heading,
                      fontSize: quotePx,
                      fontStyle: "normal",
                      fontWeight: 400,
                      lineHeight: 1.28,
                      letterSpacing: "0.008em",
                      color: textColor,
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    {renderQuoteBody()}
                  </div>
                </div>
              </div>

              {attributionText && (
                <div
                  style={{
                    marginTop: portrait ? 42 : 48,
                    marginLeft: dropCapSize + (portrait ? 24 : 30),
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    opacity: attributionIn,
                    transform: `translateX(${(1 - attributionIn) * -12}px)`,
                    color: textColor,
                    minWidth: 0,
                  }}
                >
                  <span style={{ width: portrait ? 44 : 66, height: 1, background: accentColor, flexShrink: 0 }} />
                  <span style={{ color: accentColor, fontSize: attributionPx * 0.7 }}>◆</span>
                  <span
                    ref={attributionRef}
                    style={{
                      fontFamily: body,
                      fontSize: attributionPx,
                      fontStyle: "italic",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      minWidth: 0,
                    }}
                  >
                    {attributionText}
                  </span>
                </div>
              )}
            </div>

            <aside
              style={{
                flex: portrait ? "0 0 27%" : "0 0 27%",
                minHeight: 0,
                minWidth: 0,
                borderLeft: portrait ? undefined : `1px solid ${accentColor}`,
                borderTop: portrait ? `1px solid ${accentColor}` : undefined,
                margin: portrait ? "1% 3% 0" : "3% 0",
                padding: portrait ? "22px 7% 0" : "3% 0 3% 5%",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {hasMedia ? (
                <div style={{ width: portrait ? "46%" : "78%", position: "relative", zIndex: 2 }}>
                  <div style={{ position: "absolute", inset: portrait ? -11 : -14, border: `1px solid ${accentColor}`, transform: "rotate(2deg)" }} />
                  <EmbossedImage
                    src={imageUrl}
                    videoUrl={videoUrl}
                    videoMuted={videoMuted}
                    videoVolume={videoVolume}
                    videoDurationInFrames={videoDurationInFrames}
                    videoStartInFrames={videoStartInFrames}
                    objectPosition={imageObjectPosition}
                    zoom={imageZoom}
                    rotate={-1.5}
                    revealStart={18}
                    style={{ width: "100%", aspectRatio: portrait ? "4 / 3" : "3 / 4" }}
                  />
                </div>
              ) : (
                <IlluminatedStoryCompass
                  accentColor={accentColor}
                  textColor={textColor}
                  portrait={portrait}
                />
              )}
            </aside>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
