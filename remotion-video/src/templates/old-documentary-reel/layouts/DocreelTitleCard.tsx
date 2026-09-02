import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  DOCREEL_DISPLAY_FONT,
  DOCREEL_MONO_FONT,
  DocReelScene,
  ChippedHeading,
  ArchiveImageBackdrop,
  ReelChangeCue,
  DriftingFilmstripBackdrop,
  hexToRgba,
  useTypewriterReveal,
  DEFAULT_DOCREEL_ERA,
  useDocReelTheme,
} from "../docReelStyle";
import { useFitText } from "../components/useFitText";

/** Generic establishing title card — full-bleed archive photo behind a chapter number + title. */
export const DocreelTitleCard: React.FC<SceneLayoutProps> = (props) => {
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
    chapterTitle,
  } = props;

  const p = aspectRatio === "portrait";
  const frame = useCurrentFrame();
  const { height: frameHeight } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 100;
  const activeEra = era ?? DEFAULT_DOCREEL_ERA;

  const heroReveal = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  const titleReveal = interpolate(frame, [26, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const { visibleText: visibleNarration, cursor: narrationCursor } = useTypewriterReveal(narration ?? "", 44, dur);
  const heroTitle = chapterTitle ?? title;
  const titleTargetPx = titleFontSize ?? (p ? 85 : 90);
  const narrationTargetPx = descriptionFontSize ?? (p ? 60 : 42);

  // The hero title is rendered by ChippedHeading (an SVG-filtered wrapper), so
  // it is measured through a hidden mirror carrying the same text/typography
  // rather than by ref'ing the component's internals.
  // Frame-relative budget, not a multiple of the font size (see the newspaper
  // template, layouts/EndingSocials.tsx): a font-size multiple grows with the
  // copy it is meant to constrain and so can never detect overflow.
  const titleBudgetPx = Math.round(frameHeight * (p ? 0.22 : 0.26));
  const titleMirrorRef = React.useRef<HTMLDivElement>(null);
  const { px: titlePx } = useFitText(
    titleMirrorRef,
    titleTargetPx,
    titleFontSizeIsUserSet ? titleTargetPx : p ? 38 : 40,
    [heroTitle, titleTargetPx, titleFontSizeIsUserSet, titleBudgetPx, p, aspectRatio],
    titleBudgetPx,
  );

  // Narration types out — measure a hidden full-text mirror, keyed on titlePx
  // so it re-fits after the title settles (one-directional; no give-back).
  const narrationMirrorRef = React.useRef<HTMLDivElement>(null);
  const narrationBudgetPx = Math.round(frameHeight * (p ? 0.24 : 0.28));
  const { px: narrationPx } = useFitText(
    narrationMirrorRef,
    narrationTargetPx,
    descriptionFontSizeIsUserSet ? narrationTargetPx : p ? 24 : 18,
    [narration, narrationTargetPx, descriptionFontSizeIsUserSet, narrationBudgetPx, titlePx, p],
    narrationBudgetPx,
  );

  const hasVisual = Boolean(imageUrl || videoUrl);

  return (
    <DocReelScene bgColor={bgColor} dur={dur} era={activeEra} textures={["dust_scratches"]} sprockets vignette>
      <div style={{ position: "absolute", inset: 0, background: theme.bg, opacity: heroReveal }} />
      {/* Loose strips of film spilled across the light table, slowly and
          constantly drifting outward — the layout's own backdrop texture,
          present with or without a bound photo. Stays subtle (low opacity)
          under a real photo, becomes the dominant visual when there isn't one. */}
      <DriftingFilmstripBackdrop seed={dur} dim={hasVisual ? 1 : 2.4} />
      {hasVisual ? (
        <ArchiveImageBackdrop
          imageUrl={imageUrl}
          videoUrl={videoUrl}
          imageObjectPosition={imageObjectPosition}
          imageZoom={imageZoom}
          videoMuted={videoMuted}
          videoVolume={videoVolume}
          videoDurationInFrames={videoDurationInFrames}
          videoStartInFrames={videoStartInFrames}
          dur={dur}
          kenBurns={0.09}
        />
      ) : null}

      {/* Bottom scrim for legibility */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(0deg, ${hexToRgba(theme.bg, 0.92)} 0%, ${hexToRgba(theme.bg, 0.35)} 45%, transparent 75%)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          // Lifted toward the vertical center instead of pinned to the bottom
          // edge — a bottom-anchored block left a large dead gap above it
          // under the vignette.
          justifyContent: "center",
          textAlign: "center",
          padding: p ? "0 40px" : "0 120px",
        }}
      >
        <div
          style={{
            position: "relative",
            // Bounded for the same reason as the narration below: an unbounded
            // inline-block heading lays a long title out on one very wide line
            // and runs past the scene padding, which a height fitter cannot
            // see. A real width makes the copy wrap inside the safe column, so
            // the overrun becomes height the fitter can measure and shrink.
            width: p ? "100%" : 1280,
            maxWidth: "100%",
            opacity: titleReveal,
            transform: `translateY(${(1 - titleReveal) * 18}px)`,
          }}
        >
          {/* Hidden mirror carrying the measurement ref: ChippedHeading wraps
              its text in an SVG-filtered div, so we measure an equivalent
              plain node instead of reaching into the component. */}
          <div
            ref={titleMirrorRef}
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              visibility: "hidden",
              pointerEvents: "none",
              fontFamily: DOCREEL_DISPLAY_FONT,
              fontWeight: 700,
              fontSize: titlePx,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            {heroTitle}
          </div>
          {/* ChippedHeading's outer wrapper is an inline-block that shrink-wraps;
              `display:block` + `width:100%` carry this column's bound down to
              the text so a long title wraps instead of overrunning the frame. */}
          <ChippedHeading
            fontSize={titlePx}
            color={theme.accent}
            style={{ width: "100%", display: "block" }}
          >
            {heroTitle}
          </ChippedHeading>
        </div>

        {/* No fixed maxWidth cap here — the body is meant to hold a real
            paragraph of description, not a single short line, so it's free
            to use most of the frame's width (still bounded by the outer
            padding) rather than wrapping early. */}
        {narration ? (
          // `width` is set, not just capped. The column is `alignItems:center`,
          // so a child with only a maxWidth shrink-wraps — and this block's
          // visible text is a TYPEWRITER reveal, so at frame 0 it wraps to the
          // width of the first couple of words. The measuring mirror below is
          // `width:100%` of this box, so the fitter was measuring the whole
          // narration wrapped into a ~200px column, reading an enormous height,
          // and shrinking the font to its floor — the description rendered tiny
          // no matter what size was configured. Fixing the width makes the
          // measurement independent of how much text has typed out so far.
          <div style={{ position: "relative", marginTop: 24, width: p ? "100%" : 1280, maxWidth: "100%" }}>
            <div
              ref={narrationMirrorRef}
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                visibility: "hidden",
                pointerEvents: "none",
                fontFamily: DOCREEL_MONO_FONT,
                fontSize: narrationPx,
                lineHeight: 1.6,
              }}
            >
              {narration}
            </div>
            <div
              style={{
                fontFamily: DOCREEL_MONO_FONT,
                fontSize: narrationPx,
                color: hexToRgba(theme.text, 0.9),
                opacity: titleReveal,
                lineHeight: 1.6,
              }}
            >
              {visibleNarration}
              {narrationCursor}
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 32, borderTop: `1px solid ${theme.line}`, width: p ? "60%" : 460 }} />
      </div>

      {/* Reel-Change Cue archive effect, timed near the scene's tail. */}
      <ReelChangeCue triggerFrame={Math.max(0, dur - 18)} />
    </DocReelScene>
  );
};
