import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  DOCREEL_DISPLAY_FONT,
  DOCREEL_MONO_FONT,
  DocReelScene,
  ArchiveImageBackdrop,
  FilmstripThreeCell,
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
  const { height: frameHeight } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 130;
  const activeEra = era ?? DEFAULT_DOCREEL_ERA;

  // Fall back to the universal narration/title when the interview-specific
  // fields weren't populated, so the lower-third card never renders empty.
  const displayQuote = interviewQuote || narration || "";
  const displaySubject = interviewSubject || title || "";
  const { visibleText: visibleQuote, cursor: quoteCursor } = useTypewriterReveal(displayQuote, 34, dur);

  // The pull-quote types out, so a hidden full-text mirror carries the ref —
  // measuring the growing visible copy would resize it mid-scene. The lower
  // third is anchored to the bottom of the frame, so the quote is budgeted
  // against a share of frame height rather than its own content box.
  const quoteTargetPx = titleFontSize ?? (p ? 64 : 48);
  const attribTargetPx = descriptionFontSize ?? (p ? 32 : 25);
  // Frame-relative budget (newspaper pattern), not a font-size multiple.
  const quoteBudgetPx = Math.round(frameHeight * (p ? 0.26 : 0.22));
  const quoteMirrorRef = React.useRef<HTMLDivElement>(null);
  const { px: fittedQuotePx } = useFitText(
    quoteMirrorRef,
    quoteTargetPx,
    titleFontSizeIsUserSet ? quoteTargetPx : p ? 30 : 22,
    [displayQuote, quoteTargetPx, titleFontSizeIsUserSet, quoteBudgetPx, p, aspectRatio],
    quoteBudgetPx,
  );
  // Both orientations go through the fitter. Portrait used to bypass it
  // entirely (`p ? quoteTargetPx : fittedQuotePx`) as a point-fix for the
  // slider appearing inert — with a frame-relative budget that workaround is
  // unnecessary, and it had cost portrait its overflow protection.
  const quotePx = fittedQuotePx;

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
      {/* A classic 3-frame filmstrip: three blank cells in a strip, sprocket
          holes on each cell's top/bottom edge, plain dividers between cells.
          The interview photo/clip and quote card render only in the middle
          cell — the outer two stay empty, matching the reference icon.
          Landscape lays the cells in a row; portrait stacks them in a
          column so each cell stays wide enough to be usable. */}
      <FilmstripThreeCell inset={p ? 22 : 30} portrait={p}>
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

        {/* Portrait centers the interview copy in the frame; landscape keeps
            the conventional lower-third placement. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: p ? "50%" : undefined,
            bottom: p ? undefined : "16%",
            padding: p ? "40px 28px 0" : "48px 90px 0",
            background: `linear-gradient(0deg, ${hexToRgba(theme.bg, 0.95)} 30%, transparent 100%)`,
            opacity: lowerThirdReveal,
            transform: p
              ? `translateY(calc(-50% + ${(1 - lowerThirdReveal) * 20}px))`
              : `translateY(${(1 - lowerThirdReveal) * 20}px)`,
            textAlign: p ? "center" : "left",
          }}
        >
          <div
            style={{
              fontFamily: DOCREEL_DISPLAY_FONT,
              fontWeight: 700,
              // Scales with the quote it opens, rather than staying fixed while
              // the quote under it grows.
              fontSize: Math.round(quotePx * (p ? 1.4 : 1.2)),
              color: theme.accent,
              opacity: quoteMarkReveal,
              lineHeight: 0.6,
              marginBottom: 4,
            }}
          >
            &ldquo;
          </div>
          {displayQuote ? (
            <div
              style={{
                position: "relative",
                maxWidth: p ? "100%" : 960,
                margin: p ? "0 auto" : undefined,
              }}
            >
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
      </FilmstripThreeCell>
    </DocReelScene>
  );
};
