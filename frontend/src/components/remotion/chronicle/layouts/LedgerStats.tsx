import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ChronicleLayoutProps } from "../types";
import {
  CHRONICLE_BODY_FONT,
  CHRONICLE_HEADING_FONT,
  CHRONICLE_SMALLCAPS_FONT,
} from "../../../../fonts/chronicle-defaults";
import { WaxSeal } from "../components/WaxSeal";
import { OrnamentalCorner } from "../components/OrnamentalBorder";
import { EmbossedImage } from "../components/EmbossedImage";
import { QuillText } from "../components/QuillInk";

/**
 * LedgerStats — aged-parchment ledger with up to 3 handwritten stat cells.
 * Primary stat gets a red wax seal stamped beside it.
 */
export const LedgerStats: React.FC<ChronicleLayoutProps> = ({
  title = "A Ledger of Facts",
  narration,
  stats,
  accentColor = "#B8860B",
  textColor = "#2A1810",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  fontFamily,
  imageUrl,
  imageObjectPosition,
  imageZoom,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, height, width } = useVideoConfig();
  const p = aspectRatio === "portrait" || height > width;

  const cells = (stats ?? []).slice(0, 3);
  // Ensure we always render something sensible even if no stats passed
  const displayCells = cells.length
    ? cells
    : [
        { value: "III", label: "Placeholder" },
        { value: "VII", label: "Placeholder" },
        { value: "XII", label: "Placeholder" },
      ];

  // Title fades in (0-20)
  const titleOp = interpolate(frame, [5, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 18, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        padding: p ? "10% 8%" : "7% 10%",
        fontFamily: fontFamily ?? CHRONICLE_BODY_FONT,
        opacity: fadeOut,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <OrnamentalCorner
        position="top-left"
        size={p ? 100 : 120}
        color={accentColor}
        startFrame={0}
        variant="celtic"
      />
      <OrnamentalCorner
        position="top-right"
        size={p ? 100 : 120}
        color={accentColor}
        startFrame={4}
        variant="celtic"
      />

      {/* Title */}
      <div
        style={{
          fontFamily: CHRONICLE_HEADING_FONT,
          fontSize: titleFontSize ?? (p ? 64 : 58),
          fontWeight: 700,
          color: textColor,
          textAlign: "center",
          marginBottom: 12,
          opacity: titleOp,
          textShadow: "1px 1px 0 rgba(184,134,11,0.15)",
        }}
      >
        <QuillText text={title} startFrame={5} durationFrames={25} mode="char" showCursor={false} />
      </div>

      {/* Narration subtitle */}
      {narration && (
        <div
          style={{
            fontFamily: fontFamily ?? CHRONICLE_BODY_FONT,
            fontSize: descriptionFontSize ?? (p ? 26 : 22),
            color: textColor,
            opacity: titleOp * 0.75,
            textAlign: "center",
            fontStyle: "italic",
            maxWidth: p ? "100%" : "75%",
            alignSelf: "center",
            marginBottom: 40,
            lineHeight: 1.4,
          }}
        >
          {narration}
        </div>
      )}

      {/* Optional image strip above stats */}
      {imageUrl && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 32,
          }}
        >
          <EmbossedImage
            src={imageUrl}
            objectPosition={imageObjectPosition}
            zoom={imageZoom}
            rotate={-1.5}
            revealStart={15}
            style={{
              width: p ? "85%" : "55%",
              aspectRatio: p ? "5 / 3" : "5 / 2",
            }}
          />
        </div>
      )}

      {/* Ledger row of stat cells */}
      <div
        style={{
          display: "flex",
          flexDirection: p ? "column" : "row",
          gap: p ? 30 : 40,
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {displayCells.map((cell, i) => {
          const cellStart = 30 + i * 10;
          const cellOp = interpolate(frame, [cellStart, cellStart + 15], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          // Counter roll-up if value is numeric
          const numericMatch = cell.value?.match(/^([+-]?\d+(?:\.\d+)?)(.*)$/);
          const baseNum = numericMatch ? parseFloat(numericMatch[1]) : null;
          const suffix = numericMatch ? numericMatch[2] : "";
          const rollProgress = interpolate(frame, [cellStart + 5, cellStart + 30], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const displayValue = baseNum !== null
            ? `${Math.round(baseNum * rollProgress)}${suffix}`
            : cell.value;

          const isPrimary = i === 0;

          return (
            <div
              key={i}
              style={{
                flex: p ? "0 0 auto" : 1,
                width: p ? "80%" : "auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "24px 20px",
                background: "rgba(248,239,214,0.4)",
                border: `1.5px dashed ${textColor}33`,
                opacity: cellOp,
                transform: `translateY(${interpolate(cellOp, [0, 1], [20, 0])}px)`,
                position: "relative",
                minHeight: p ? 180 : 240,
                justifyContent: "center",
              }}
            >
              {/* Wax seal on primary stat */}
              {isPrimary && (
                <div
                  style={{
                    position: "absolute",
                    top: -20,
                    right: p ? 20 : -12,
                    zIndex: 2,
                  }}
                >
                  <WaxSeal
                    size={p ? 72 : 84}
                    color="#8B2E1D"
                    monogram={"\u2736"}
                    stampFrame={cellStart + 8}
                  />
                </div>
              )}

              {/* Big numeral */}
              <div
                style={{
                  fontFamily: CHRONICLE_HEADING_FONT,
                  fontSize: p ? 96 : 108,
                  fontWeight: 900,
                  color: isPrimary ? accentColor : textColor,
                  lineHeight: 0.95,
                  textShadow: "2px 2px 0 rgba(40,25,12,0.15)",
                  marginBottom: 12,
                }}
              >
                {displayValue}
              </div>

              {/* Underline */}
              <div
                style={{
                  width: `${interpolate(frame, [cellStart + 10, cellStart + 25], [0, 70], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })}%`,
                  height: 2,
                  background: textColor,
                  opacity: 0.55,
                  marginBottom: 14,
                }}
              />

              {/* Label */}
              <div
                style={{
                  fontFamily: CHRONICLE_SMALLCAPS_FONT,
                  fontSize: descriptionFontSize ?? (p ? 22 : 19),
                  color: textColor,
                  textAlign: "center",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  opacity: 0.88,
                  lineHeight: 1.3,
                  maxWidth: "100%",
                }}
              >
                {cell.label}
              </div>
            </div>
          );
        })}
      </div>

      <OrnamentalCorner
        position="bottom-left"
        size={p ? 100 : 120}
        color={accentColor}
        startFrame={15}
        variant="celtic"
      />
      <OrnamentalCorner
        position="bottom-right"
        size={p ? 100 : 120}
        color={accentColor}
        startFrame={19}
        variant="celtic"
      />
    </AbsoluteFill>
  );
};
