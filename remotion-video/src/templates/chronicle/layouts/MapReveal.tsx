import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ChronicleLayoutProps } from "../types";
import {
  CHRONICLE_BODY_FONT,
  CHRONICLE_HEADING_FONT,
  CHRONICLE_SMALLCAPS_FONT,
} from "../../../fonts/chronicle-defaults";
import { CompassRose, OrnamentalCorner } from "../components/OrnamentalBorder";
import { EmbossedImage } from "../components/EmbossedImage";
import { QuillText } from "../components/QuillInk";

/**
 * MapReveal — image layout styled as an unfurled cartographer's map.
 * Image sits inside a torn-parchment frame with compass rose + drawn
 * lat/long ticks + caption on a banner below.
 */
export const MapReveal: React.FC<ChronicleLayoutProps> = ({
  title,
  narration,
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
        <div
          style={{
            fontFamily: CHRONICLE_HEADING_FONT,
            fontSize: titleFontSize ?? (p ? 52 : 48),
            fontWeight: 700,
            color: textColor,
            textAlign: "center",
            marginBottom: 18,
            opacity: mapOp,
          }}
        >
          <QuillText text={title} startFrame={5} durationFrames={25} mode="char" showCursor={false} />
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
          {imageUrl ? (
            <div style={{ width: "100%", height: "100%", position: "relative" }}>
              <EmbossedImage
                src={imageUrl}
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
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: `repeating-linear-gradient(45deg, transparent 0 20px, rgba(40,25,12,0.06) 20px 22px), #F1E4C9`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: textColor,
                opacity: 0.5,
                fontFamily: CHRONICLE_HEADING_FONT,
                fontSize: 24,
              }}
            >
              terra incognita
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

      {/* Narration banner */}
      {narration && (
        <div
          style={{
            marginTop: 24,
            textAlign: "center",
            fontFamily: CHRONICLE_SMALLCAPS_FONT,
            fontSize: descriptionFontSize ?? (p ? 24 : 22),
            color: textColor,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            opacity: interpolate(frame, [40, 60], [0, 0.88], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            maxWidth: p ? "100%" : "75%",
            alignSelf: "center",
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
      )}

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
