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
import { EmbossedImage } from "../components/EmbossedImage";
import { QuillText } from "../components/QuillInk";

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
  fontFamily,
  imageUrl,
  imageObjectPosition,
  imageZoom,
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
          flexDirection: p ? "column" : imageUrl ? "row" : "column",
          gap: p ? 30 : 50,
          alignItems: "stretch",
          height: "100%",
          paddingTop: category ? (p ? 60 : 40) : 0,
        }}
      >
        {/* Text column */}
        <div
          style={{
            flex: imageUrl ? 1.1 : 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {/* Title */}
          <div
            style={{
              fontFamily: CHRONICLE_HEADING_FONT,
              fontWeight: 700,
              fontSize: titleFontSize ?? (p ? 66 : 62),
              color: textColor,
              lineHeight: 1.05,
              marginBottom: 28,
              opacity: titleOp,
              textShadow: "1px 1px 0 rgba(184,134,11,0.15)",
            }}
          >
            <QuillText text={title} startFrame={12} durationFrames={28} mode="char" showCursor={false} />
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
            <div
              style={{
                fontFamily: fontFamily ?? CHRONICLE_BODY_FONT,
                fontSize: descriptionFontSize ?? (p ? 34 : 28),
                color: textColor,
                lineHeight: 1.55,
                flex: 1,
              }}
            >
              <QuillText text={bodyRest} startFrame={50} durationFrames={Math.min(150, bodyRest.length * 1.1)} showCursor={true} />
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
        {imageUrl && (
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
