import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
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
  const { visibleText: visibleNarration, cursor: narrationCursor } = useTypewriterReveal(narration ?? "", 44);
  const heroTitle = chapterTitle ?? title;
  const titleTargetPx = titleFontSize ?? (p ? 48 : 90);
  const narrationTargetPx = descriptionFontSize ?? (p ? 21 : 38);

  // The hero title is rendered by ChippedHeading (an SVG-filtered wrapper), so
  // it is measured through a hidden mirror carrying the same text/typography
  // rather than by ref'ing the component's internals.
  const titleMirrorRef = React.useRef<HTMLDivElement>(null);
  const { px: titlePx } = useFitText(
    titleMirrorRef,
    titleTargetPx,
    titleFontSizeIsUserSet ? titleTargetPx : Math.round(titleTargetPx * 0.42),
    [heroTitle, titleTargetPx, titleFontSizeIsUserSet, p, aspectRatio],
    Math.round((p ? 48 : 90) * 2.6),
  );

  // Narration types out — measure a hidden full-text mirror, keyed on titlePx
  // so it re-fits after the title settles (one-directional; no give-back).
  const narrationMirrorRef = React.useRef<HTMLDivElement>(null);
  const { px: narrationPx } = useFitText(
    narrationMirrorRef,
    narrationTargetPx,
    descriptionFontSizeIsUserSet ? narrationTargetPx : Math.round(narrationTargetPx * 0.55),
    [narration, narrationTargetPx, descriptionFontSizeIsUserSet, titlePx, p],
    Math.round((p ? 21 : 38) * 6),
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
          <ChippedHeading fontSize={titlePx} color={theme.accent}>
            {heroTitle}
          </ChippedHeading>
        </div>

        {/* No fixed maxWidth cap here — the body is meant to hold a real
            paragraph of description, not a single short line, so it's free
            to use most of the frame's width (still bounded by the outer
            padding) rather than wrapping early. */}
        {narration ? (
          <div style={{ position: "relative", marginTop: 24, maxWidth: p ? "100%" : 1280 }}>
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
