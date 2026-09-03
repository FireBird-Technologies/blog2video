import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ChronicleLayoutProps } from "../types";
import {
  CHRONICLE_BODY_FONT,
  CHRONICLE_HEADING_FONT,
  CHRONICLE_SMALLCAPS_FONT,
} from "../../../../fonts/chronicle-defaults";
import { CompassRose, OrnamentalCorner } from "../components/OrnamentalBorder";
import { EmbossedImage } from "../components/EmbossedImage";
import { QuillText } from "../components/QuillInk";
import { useFitText } from "../components/useFitText";

/**
 * MapReveal — image layout styled as an unfurled cartographer's map.
 * With an image: torn parchment holds the map in the upper band and
 * narration caption beneath inside the same frame. Without an image,
 * narration fills the parchment as a gold typographic plate.
 */
export const MapReveal: React.FC<ChronicleLayoutProps> = ({
  title,
  narration,
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
  const { durationInFrames, height, width } = useVideoConfig();
  const p = aspectRatio === "portrait" || height > width;

  const hasMedia = Boolean(imageUrl || videoUrl);

  /* ── Auto-fit (title + narration) ─────────────────────────────
     Title and narration are unbounded user input inside the torn-parchment
     map frame. Narration renders in one of two mutually-exclusive places
     (caption strip under the map image, or the large no-image inscription),
     each with its own budget/floor, so each gets its own ref/hook. QuillText's
     mode="char" (title) reveals characters progressively — hidden mirror
     needed; mode="word" (both narration spots) renders full text from frame 0
     with only opacity/transform animating, so those are safe to ref directly. */
  const fitTitleRef = React.useRef<HTMLDivElement>(null);
  const fitTitleTarget = titleFontSize ?? (p ? 52 : 48);
  const { px: fitTitlePx } = useFitText(
    fitTitleRef,
    fitTitleTarget,
    titleFontSizeIsUserSet ? fitTitleTarget : Math.round(fitTitleTarget * 0.45),
    [title, fitTitleTarget, titleFontSizeIsUserSet, p, height],
    Math.round(height * 0.09),
  );
  const fitCaptionRef = React.useRef<HTMLDivElement>(null);
  const fitCaptionTarget = Math.round((descriptionFontSize ?? (p ? 24 : 22)) * 0.92);
  const { px: fitCaptionPx } = useFitText(
    fitCaptionRef,
    fitCaptionTarget,
    descriptionFontSizeIsUserSet ? fitCaptionTarget : Math.round(fitCaptionTarget * 0.55),
    [narration, fitCaptionTarget, descriptionFontSizeIsUserSet, hasMedia, p, height],
    Math.round(height * 0.1),
  );
  const fitInscriptionRef = React.useRef<HTMLDivElement>(null);
  const fitInscriptionTarget = descriptionFontSize ?? (p ? 40 : 44);
  const { px: fitInscriptionPx } = useFitText(
    fitInscriptionRef,
    fitInscriptionTarget,
    descriptionFontSizeIsUserSet ? fitInscriptionTarget : Math.round(fitInscriptionTarget * 0.5),
    [narration, fitInscriptionTarget, descriptionFontSizeIsUserSet, hasMedia, p, height],
    Math.round(height * (p ? 0.34 : 0.4)),
  );

  const mapScale = interpolate(frame, [0, 20], [0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const mapOp = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 18, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );

  // Generate deterministic lat/long tick positions
  const ticksX = Array.from({ length: 8 }, (_, i) => ({ pos: (i + 1) / 9 * 100 }));
  const ticksY = Array.from({ length: 6 }, (_, i) => ({ pos: (i + 1) / 7 * 100 }));

  return (
    <AbsoluteFill
      style={{
        padding: p ? "10% 6%" : "6% 8%",
        fontFamily: fontFamily ?? CHRONICLE_BODY_FONT,
        opacity: fadeOut,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <OrnamentalCorner
        position="top-right"
        size={p ? 110 : 130}
        color={accentColor}
        startFrame={0}
        variant="fleur"
      />

      {/* Title */}
      {title && (
        <div style={{ position: "relative", marginBottom: 18 }}>
          {/* QuillText mode="char" reveals characters progressively; this
              hidden full-text mirror keeps fitting stable from frame zero. */}
          <div
            ref={fitTitleRef}
            aria-hidden
            style={{
              visibility: "hidden",
              position: "absolute",
              inset: 0,
              fontFamily: CHRONICLE_HEADING_FONT,
              fontSize: fitTitlePx,
              fontWeight: 700,
              textAlign: "center",
              width: "100%",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontFamily: CHRONICLE_HEADING_FONT,
              fontSize: fitTitlePx,
              fontWeight: 700,
              color: textColor,
              textAlign: "center",
              opacity: mapOp,
            }}
          >
            <QuillText text={title} startFrame={5} durationFrames={25} mode="char" showCursor={false} />
          </div>
        </div>
      )}

      {/* Map (torn parchment frame) */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${mapScale})`,
          opacity: mapOp,
        }}
      >
        <div
          style={{
            position: "relative",
            width: p ? "95%" : "80%",
            height: p ? "70%" : "85%",
            background: "#F8EFD6",
            padding: p ? 18 : 28,
            boxShadow:
              "inset 0 0 0 1px rgba(40,25,12,0.3), 0 18px 40px rgba(40,25,12,0.35), inset 0 4px 14px rgba(40,25,12,0.25)",
            clipPath:
              "polygon(0% 3%, 4% 0%, 12% 2%, 22% 0%, 35% 3%, 48% 0%, 60% 2%, 72% 0%, 84% 3%, 94% 0%, 100% 4%, 98% 12%, 100% 22%, 97% 35%, 100% 48%, 97% 62%, 100% 75%, 97% 88%, 100% 97%, 94% 100%, 82% 97%, 70% 100%, 55% 97%, 40% 100%, 28% 97%, 14% 100%, 4% 97%, 0% 94%, 3% 82%, 0% 68%, 3% 52%, 0% 38%, 2% 22%, 0% 10%)",
          }}
        >
          {(imageUrl || videoUrl) ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                gap: p ? 10 : 14,
              }}
            >
              <div
                style={{
                  flex: narration ? "1 1 58%" : "1 1 100%",
                  minHeight: 0,
                  position: "relative",
                }}
              >
                <EmbossedImage
                  src={imageUrl}
                  videoUrl={videoUrl}
              videoMuted={videoMuted}
              videoVolume={videoVolume}
              videoDurationInFrames={videoDurationInFrames}
              videoStartInFrames={videoStartInFrames}
              objectPosition={imageObjectPosition}
              zoom={imageZoom}
              rotate={0}
                  revealStart={8}
                  matSize={8}
                  inkFrame={false}
                  style={{ width: "100%", height: "100%" }}
                />

                {/* Faint lat/long grid overlay */}
                <svg
                  style={{
                    position: "absolute",
                    inset: 10,
                    width: "calc(100% - 20px)",
                    height: "calc(100% - 20px)",
                    pointerEvents: "none",
                    opacity: interpolate(frame, [25, 45], [0, 0.35], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                  }}
                >
                  {ticksX.map((t, i) => (
                    <line
                      key={`x-${i}`}
                      x1={`${t.pos}%`}
                      y1="0"
                      x2={`${t.pos}%`}
                      y2="100%"
                      stroke={textColor}
                      strokeWidth="0.8"
                      strokeDasharray="4 6"
                    />
                  ))}
                  {ticksY.map((t, i) => (
                    <line
                      key={`y-${i}`}
                      x1="0"
                      y1={`${t.pos}%`}
                      x2="100%"
                      y2={`${t.pos}%`}
                      stroke={textColor}
                      strokeWidth="0.8"
                      strokeDasharray="4 6"
                    />
                  ))}
                </svg>
              </div>

              {narration ? (
                <div
                  ref={fitCaptionRef}
                  style={{
                    flex: "0 0 auto",
                    padding: p ? "4px 5% 2px" : "2px 6% 0",
                    textAlign: "center",
                    fontFamily: CHRONICLE_SMALLCAPS_FONT,
                    fontSize: fitCaptionPx,
                    color: textColor,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    lineHeight: 1.35,
                    opacity: interpolate(frame, [40, 60], [0, 0.92], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                    width: "100%",
                  }}
                >
                  <QuillText
                    text={narration}
                    startFrame={40}
                    durationFrames={Math.min(90, narration.length * 1.1)}
                    mode="word"
                    showCursor={false}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            // No scene image — gold inscription centered on parchment; depth
            // from text-shadow only (no panel behind the block).
            <div
              ref={fitInscriptionRef}
              style={{
                width: "100%",
                height: "100%",
                background: `repeating-linear-gradient(45deg, transparent 0 20px, rgba(40,25,12,0.06) 20px 22px), #F1E4C9`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: p ? "8% 8%" : "6% 10%",
                textAlign: "center",
                fontFamily: CHRONICLE_HEADING_FONT,
                color: accentColor,
                fontSize: fitInscriptionPx,
                fontWeight: 700,
                lineHeight: 1.25,
                letterSpacing: "0.04em",
                textShadow: `
                  0 1px 0 rgba(40, 25, 12, 0.22),
                  0 3px 5px rgba(40, 25, 12, 0.38),
                  0 7px 14px rgba(40, 25, 12, 0.22),
                  0 0 18px rgba(184, 134, 11, 0.2)
                `,
                opacity: interpolate(frame, [10, 35], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              <QuillText
                text={narration ?? "terra incognita"}
                startFrame={10}
                durationFrames={Math.min(110, (narration ?? "terra incognita").length * 1.3)}
                mode="word"
                showCursor={false}
              />
            </div>
          )}

          {/* Compass rose in top-right */}
          <div
            style={{
              position: "absolute",
              top: p ? 20 : 30,
              right: p ? 20 : 30,
              filter: "drop-shadow(0 2px 6px rgba(40,25,12,0.5))",
            }}
          >
            <CompassRose
              size={p ? 80 : 110}
              color={accentColor}
              startFrame={20}
            />
          </div>
        </div>
      </div>

      <OrnamentalCorner
        position="bottom-left"
        size={p ? 110 : 130}
        color={accentColor}
        startFrame={18}
        variant="fleur"
      />
    </AbsoluteFill>
  );
};
