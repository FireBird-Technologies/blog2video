import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  DOCREEL_DISPLAY_FONT,
  DOCREEL_MONO_FONT,
  DocReelScene,
  ChippedHeading,
  ArchiveImageBackdrop,
  hexToRgba,
  DEFAULT_DOCREEL_ERA,
  useDocReelTheme,
} from "../docReelStyle";
import { useFitText } from "../components/useFitText";

/** A ledger-style overlay: a big Oswald number with a Courier Prime tally readout beside it. */
export const DocreelStatistic: React.FC<SceneLayoutProps> = (props) => {
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
    statValue,
    statLabel,
    statContext,
  } = props;

  const p = aspectRatio === "portrait";
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 90;
  const activeEra = era ?? DEFAULT_DOCREEL_ERA;

  // Fall back to the universal title/narration when the layout-specific stat
  // fields weren't populated, so the scene never renders as a bare number.
  // Label always prefers statLabel, then falls back to title (regardless of
  // whether statValue itself came from title too) — narration is shown
  // whenever it carries content, so real description text is never dropped
  // just because a short statContext also happened to be set.
  const displayValue = statValue || title || "—";
  const displayLabel = statLabel || title || "";
  const displayContext = statContext || narration || "";
  const showNarrationSeparately = Boolean(narration && narration !== displayContext);

  const numberPx = titleFontSize ?? (p ? 285 : 211);
  const contextTargetPx = descriptionFontSize ?? (p ? 44 : 33);

  // The context line renders in full from frame 0 (no typewriter), so the real
  // element can be measured directly — no hidden mirror needed. The stat NUMBER
  // is deliberately not fitted: it is a short glyph run at a very large display
  // size and is the whole point of the scene — shrinking it to accommodate a
  // long context line would invert the visual hierarchy.
  const contextRef = React.useRef<HTMLDivElement>(null);
  const { px: contextPx } = useFitText(
    contextRef,
    contextTargetPx,
    descriptionFontSizeIsUserSet ? contextTargetPx : Math.round(contextTargetPx * 0.55),
    [displayContext, contextTargetPx, descriptionFontSizeIsUserSet, p, aspectRatio],
    Math.round((p ? 44 : 33) * 4),
  );
  // Stat label scales off the description size instead of sitting at a fixed
  // pixel size, so the slider moves it along with the context line.
  const labelPx = Math.round(contextPx * 0.72);

  // Ticker count-up: the digits settle in like a mechanical counter.
  const countProgress = interpolate(frame, [8, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const labelReveal = interpolate(frame, [30, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const contextReveal = interpolate(frame, [44, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scanY = interpolate(frame % 60, [0, 60], [0, 100]);

  return (
    <DocReelScene bgColor={bgColor} dur={dur} era={activeEra} textures={["dust_scratches"]} sprockets>
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
        dim={0.28}
      />
      {(imageUrl || videoUrl) ? (
        <div style={{ position: "absolute", inset: 0, background: hexToRgba(theme.bg, 0.55) }} />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "140px 40px" : "80px 160px",
        }}
      >
        <div
          style={{
            position: "relative",
            border: `1px solid ${theme.lineStrong}`,
            padding: p ? "36px 28px" : "44px 90px",
            overflow: "hidden",
          }}
        >
          {/* Scanning readout line */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${scanY}%`,
              height: 2,
              background: hexToRgba(theme.accent, 0.35),
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              opacity: interpolate(countProgress, [0, 0.15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              transform: `scale(${interpolate(countProgress, [0, 1], [0.85, 1])})`,
            }}
          >
            <ChippedHeading fontSize={statValue ? numberPx : numberPx * 0.42} color={theme.accent} letterSpacing="0.01em">
              {displayValue}
            </ChippedHeading>
          </div>
        </div>

        {displayLabel ? (
          <div
            style={{
              marginTop: 28,
              fontFamily: DOCREEL_DISPLAY_FONT,
              fontWeight: 500,
              fontSize: labelPx,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: theme.text,
              opacity: labelReveal,
              transform: `translateY(${(1 - labelReveal) * 14}px)`,
              textAlign: "center",
            }}
          >
            {displayLabel}
          </div>
        ) : null}

        {displayContext ? (
          <div
            ref={contextRef}
            style={{
              marginTop: 18,
              width: "100%",
              maxWidth: p ? 640 : 920,
              fontFamily: DOCREEL_MONO_FONT,
              fontSize: contextPx,
              color: hexToRgba(theme.text, 0.8),
              opacity: contextReveal,
              transform: `translateY(${(1 - contextReveal) * 10}px)`,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            {displayContext}
          </div>
        ) : null}

        {showNarrationSeparately ? (
          <div
            style={{
              marginTop: 12,
              fontFamily: DOCREEL_MONO_FONT,
              fontSize: Math.round(contextPx * 0.85),
              color: hexToRgba(theme.text, 0.65),
              opacity: contextReveal,
              maxWidth: p ? 600 : 860,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            {narration}
          </div>
        ) : null}

        <div
          style={{
            position: "absolute",
            bottom: p ? 60 : 50,
            left: p ? 40 : 60,
            right: p ? 40 : 60,
            borderTop: `1px solid ${theme.line}`,
          }}
        />
      </div>
    </DocReelScene>
  );
};
