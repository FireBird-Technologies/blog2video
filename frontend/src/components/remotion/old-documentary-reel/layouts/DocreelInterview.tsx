import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  DOCREEL_DISPLAY_FONT,
  DOCREEL_MONO_FONT,
  DocReelScene,
  ArchiveImageBackdrop,
  SingleFilmFrame,
  hexToRgba,
  useTypewriterReveal,
  DEFAULT_DOCREEL_ERA,
  useDocReelTheme,
} from "../docReelStyle";
import { useFitText } from "../components/useFitText";

/** Interview insert: a photo/clip with a lower-third quote card, like a documentary talking-head cutaway. */
export const DocreelInterview: React.FC<SceneLayoutProps> = (props) => {
  const theme = useDocReelTheme();
  const {
    title,
    narration,
    imageUrl,
    imageObjectPosition,
    imageZoom,
    videoUrl,
    videoMuted,
    videoVolume,
    videoDurationInFrames,
    videoStartInFrames,
    bgColor,
    accentColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    titleFontSizeIsUserSet,
    descriptionFontSize,
    descriptionFontSizeIsUserSet,
    era,
    interviewQuote,
    interviewSubject,
    interviewRole,
  } = props;

  const p = aspectRatio === "portrait";
  const frame = useCurrentFrame();
  const dur = sceneDurationInFrames ?? 130;
  const activeEra = era ?? DEFAULT_DOCREEL_ERA;

  // Fall back to the universal narration/title when the interview-specific
  // fields weren't populated, so the lower-third card never renders empty.
  const displayQuote = interviewQuote || narration || "";
  const displaySubject = interviewSubject || title || "";
  const { visibleText: visibleQuote, cursor: quoteCursor } = useTypewriterReveal(displayQuote, 34);

  // The pull-quote types out, so a hidden full-text mirror carries the ref —
  // measuring the growing visible copy would resize it mid-scene. The lower
  // third is anchored to the bottom of the frame, so the quote is budgeted
  // against a share of frame height rather than its own content box.
  const quoteTargetPx = titleFontSize ?? (p ? 23 : 46);
  const attribTargetPx = descriptionFontSize ?? (p ? 14 : 22);
  const quoteMirrorRef = React.useRef<HTMLDivElement>(null);
  const { px: quotePx } = useFitText(
    quoteMirrorRef,
    quoteTargetPx,
    titleFontSizeIsUserSet ? quoteTargetPx : Math.round(quoteTargetPx * 0.45),
    [displayQuote, quoteTargetPx, titleFontSizeIsUserSet, p, aspectRatio],
    Math.round((p ? 23 : 46) * 5),
  );

  const lowerThirdReveal = interpolate(frame, [16, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const quoteMarkReveal = interpolate(frame, [22, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <DocReelScene bgColor={bgColor} dur={dur} era={activeEra} textures={["dust_scratches"]} vignette>
      {/* The whole interview — photo/clip and quote card alike — sits inside
          a single physical film frame (one bordered cell, sprocket holes on
          all four edges) rather than behind loose flying filmstrips, so the
          scene reads as "looking at one frame of the reel" as a whole. */}
      <SingleFilmFrame inset={p ? 22 : 30}>
        {imageUrl || videoUrl ? (
          <ArchiveImageBackdrop
            imageUrl={imageUrl}
            videoUrl={videoUrl}
            // No local default: both composition roots always build
            // `${focusX}% ${focusY}%` (defaulting to 50/50), so a `??` fallback
            // here is unreachable and only implies a talking-head bias that
            // never actually applies.
            imageObjectPosition={imageObjectPosition}
            imageZoom={imageZoom}
            videoMuted={videoMuted}
            videoVolume={videoVolume}
            videoDurationInFrames={videoDurationInFrames}
            videoStartInFrames={videoStartInFrames}
            dur={dur}
            kenBurns={0.08}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: theme.bg }} />
        )}

        {/* Lower-third quote card — sits a bit higher than a true bottom-pinned
            lower third so the quote isn't crowded against the frame edge. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: p ? "14%" : "16%",
            padding: p ? "40px 28px 0" : "48px 90px 0",
            background: `linear-gradient(0deg, ${hexToRgba(theme.bg, 0.95)} 30%, transparent 100%)`,
            opacity: lowerThirdReveal,
            transform: `translateY(${(1 - lowerThirdReveal) * 20}px)`,
          }}
        >
          <div
            style={{
              fontFamily: DOCREEL_DISPLAY_FONT,
              fontWeight: 700,
              fontSize: p ? 44 : 56,
              color: theme.accent,
              opacity: quoteMarkReveal,
              lineHeight: 0.6,
              marginBottom: 4,
            }}
          >
            &ldquo;
          </div>
          {displayQuote ? (
            <div style={{ position: "relative", maxWidth: p ? "100%" : 960 }}>
              <div
                ref={quoteMirrorRef}
                aria-hidden
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  visibility: "hidden",
                  pointerEvents: "none",
                  fontFamily: DOCREEL_MONO_FONT,
                  fontSize: quotePx,
                  lineHeight: 1.45,
                }}
              >
                {displayQuote}
              </div>
              <div
                style={{
                  fontFamily: DOCREEL_MONO_FONT,
                  fontSize: quotePx,
                  color: theme.accent,
                  lineHeight: 1.45,
                }}
              >
                {visibleQuote}
                {quoteCursor}
              </div>
            </div>
          ) : null}
          {(displaySubject || interviewRole) ? (
            <div
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTop: `1px solid ${theme.line}`,
                fontFamily: DOCREEL_MONO_FONT,
                fontSize: attribTargetPx,
                letterSpacing: "0.1em",
                color: hexToRgba(theme.text, 0.75),
              }}
            >
              {displaySubject ? <span style={{ color: theme.text }}>{displaySubject.toUpperCase()}</span> : null}
              {displaySubject && interviewRole ? "  —  " : ""}
              {interviewRole || ""}
            </div>
          ) : null}
        </div>
      </SingleFilmFrame>
    </DocReelScene>
  );
};
