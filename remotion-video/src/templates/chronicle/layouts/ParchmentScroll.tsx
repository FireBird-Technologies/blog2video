import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ChronicleLayoutProps } from "../types";
import {
  CHRONICLE_BODY_FONT,
  CHRONICLE_HEADING_FONT,
  CHRONICLE_SMALLCAPS_FONT,
} from "../../../fonts/chronicle-defaults";
import { IlluminatedDropCap } from "../components/IlluminatedDropCap";
import { OrnamentalCorner } from "../components/OrnamentalBorder";
import { InkFlourish } from "../components/ChronicleArtifacts";
import { EmbossedImage } from "../components/EmbossedImage";
import { QuillText } from "../components/QuillInk";
import { useFitText } from "../components/useFitText";

/**
 * ParchmentScroll — main narrative body layout.
 * Title inked at top, illuminated drop cap on first letter of narration,
 * optional embossed image on the right (landscape) or bottom (portrait).
 */
export const ParchmentScroll: React.FC<ChronicleLayoutProps> = ({
  title = "The Story Unfolds",
  narration = "And so it was, that events took their course — shaped not by chance, but by choice.",
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
  illuminatedLetter,
  category,
  stats,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, height, width } = useVideoConfig();
  const p = aspectRatio === "portrait" || height > width;

  // Title ink-writes (0-35)
  const titleOp = interpolate(frame, [15, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Byline fades in (40-55)
  const bylineOp = interpolate(frame, [40, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const dropCapChar = (illuminatedLetter ?? narration.charAt(0) ?? "A").toUpperCase();
  const bodyRest = narration.slice(1);

  /* ── Auto-fit (title + body) ──────────────────────────────────
     Title and narration body are unbounded user input in the text column.
     QuillText's default mode="char" (used here for both — the title
     explicitly, the body implicitly since no `mode` prop is passed) reveals
     characters progressively, so hidden full-text mirrors are measured for
     both instead of the animated elements themselves. */
  const fitTitleRef = React.useRef<HTMLDivElement>(null);
  const fitTitleTarget = titleFontSize ?? (p ? 66 : 62);
  const { px: fitTitlePx } = useFitText(
    fitTitleRef,
    fitTitleTarget,
    titleFontSizeIsUserSet ? fitTitleTarget : Math.round(fitTitleTarget * 0.45),
    [title, fitTitleTarget, titleFontSizeIsUserSet, p, height],
    Math.round(height * 0.1),
  );
  const fitBodyRef = React.useRef<HTMLDivElement>(null);
  const fitBodyTarget = descriptionFontSize ?? (p ? 34 : 28);
  const { px: fitBodyPx } = useFitText(
    fitBodyRef,
    fitBodyTarget,
    descriptionFontSizeIsUserSet ? fitBodyTarget : Math.round(fitBodyTarget * 0.55),
    [bodyRest, fitBodyTarget, descriptionFontSizeIsUserSet, fitTitlePx, p, height],
    Math.round(height * (p ? 0.32 : 0.4)),
  );

  // Overall fade out
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );

  const bylineText = stats && stats.length > 0
    ? stats.map((s) => [s.value, s.label].filter(Boolean).join(" ")).join("  \u2022  ")
    : null;

  return (
    <AbsoluteFill
      style={{
        opacity: fadeOut,
        fontFamily: fontFamily ?? CHRONICLE_BODY_FONT,
        padding: p ? "8% 8%" : "6% 8%",
        overflow: "hidden",
      }}
    >
      {/* Quill divider flourish inks in beneath the scroll. */}
      <InkFlourish variant="divider" position="bottom-center" color={accentColor} startFrame={40} />

      {/* Top-left fleur corner */}
      <OrnamentalCorner
        position="top-left"
        size={p ? 110 : 130}
        color={accentColor}
        startFrame={0}
        variant="vine"
      />

      {/* Category tag */}
      {category && (
        <div
          style={{
            position: "absolute",
            top: p ? "12%" : "9%",
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: CHRONICLE_SMALLCAPS_FONT,
            fontSize: p ? 22 : 18,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: accentColor,
            fontWeight: 700,
            opacity: titleOp,
          }}
        >
          {category}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: p ? "column" : (imageUrl || videoUrl) ? "row" : "column",
          gap: p ? 30 : 50,
          alignItems: "stretch",
          height: "100%",
          paddingTop: category ? (p ? 60 : 40) : 0,
        }}
      >
        {/* Text column */}
        <div
          style={{
            flex: (imageUrl || videoUrl) ? 1.1 : 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {/* Title */}
          <div style={{ position: "relative", marginBottom: 28 }}>
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
                fontWeight: 700,
                fontSize: fitTitlePx,
                lineHeight: 1.05,
                width: "100%",
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontFamily: CHRONICLE_HEADING_FONT,
                fontWeight: 700,
                fontSize: fitTitlePx,
                color: textColor,
                lineHeight: 1.05,
                opacity: titleOp,
                textShadow: "1px 1px 0 rgba(184,134,11,0.15)",
              }}
            >
              <QuillText text={title} startFrame={12} durationFrames={28} mode="char" showCursor={false} />
            </div>
          </div>

          {/* Divider line */}
          <div
            style={{
              height: 1.5,
              background: textColor,
              width: `${interpolate(frame, [20, 38], [0, 60], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}%`,
              marginBottom: 30,
              opacity: 0.6,
            }}
          />

          {/* Body with drop cap */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 22,
            }}
          >
            <div style={{ flexShrink: 0, opacity: interpolate(frame, [30, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
              <IlluminatedDropCap
                letter={dropCapChar}
                size={p ? 120 : 110}
                accentColor={accentColor}
                textColor={textColor}
                startFrame={30}
              />
            </div>
            <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
              {/* QuillText defaults to mode="char", which reveals characters
                  progressively; this hidden full-text mirror keeps fitting
                  stable from frame zero. */}
              <div
                ref={fitBodyRef}
                aria-hidden
                style={{
                  visibility: "hidden",
                  position: "absolute",
                  inset: 0,
                  fontFamily: fontFamily ?? CHRONICLE_BODY_FONT,
                  fontSize: fitBodyPx,
                  lineHeight: 1.55,
                  width: "100%",
                }}
              >
                {bodyRest}
              </div>
              <div
                style={{
                  fontFamily: fontFamily ?? CHRONICLE_BODY_FONT,
                  fontSize: fitBodyPx,
                  color: textColor,
                  lineHeight: 1.55,
                }}
              >
                <QuillText text={bodyRest} startFrame={50} durationFrames={Math.min(150, bodyRest.length * 1.1)} showCursor={true} />
              </div>
            </div>
          </div>

          {/* Byline */}
          {bylineText && (
            <div
              style={{
                marginTop: 30,
                fontFamily: CHRONICLE_SMALLCAPS_FONT,
                fontSize: p ? 20 : 18,
                color: textColor,
                opacity: bylineOp * 0.75,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                fontStyle: "italic",
              }}
            >
              &mdash; {bylineText}
            </div>
          )}
        </div>

        {/* Image column */}
        {(imageUrl || videoUrl) && (
          <div
            style={{
              flex: p ? "0 0 auto" : 0.9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: p ? "35%" : "auto",
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
              rotate={-2.5}
              revealStart={20}
              style={{
                width: p ? "88%" : "100%",
                aspectRatio: p ? "3 / 2" : "4 / 5",
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom-right vine corner */}
      <OrnamentalCorner
        position="bottom-right"
        size={p ? 110 : 130}
        color={accentColor}
        startFrame={15}
        variant="vine"
      />
    </AbsoluteFill>
  );
};
