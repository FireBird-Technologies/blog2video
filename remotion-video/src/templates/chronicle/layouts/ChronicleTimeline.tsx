import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ChronicleLayoutProps } from "../types";
import {
  CHRONICLE_BODY_FONT,
  CHRONICLE_HEADING_FONT,
  CHRONICLE_SMALLCAPS_FONT,
} from "../../../fonts/chronicle-defaults";
import { OrnamentalCorner } from "../components/OrnamentalBorder";
import { QuillText } from "../components/QuillInk";

/**
 * ChronicleTimeline — horizontal (landscape) / vertical (portrait) timeline
 * of up to 4 waypoints drawn by a quill.
 */
export const ChronicleTimeline: React.FC<ChronicleLayoutProps> = ({
  title = "A Timeline of Events",
  narration,
  stats,
  accentColor = "#B8860B",
  textColor = "#2A1810",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, height, width } = useVideoConfig();
  const p = aspectRatio === "portrait" || height > width;

  const waypoints = (stats ?? []).slice(0, 4);
  const displayWaypoints = waypoints.length
    ? waypoints
    : [
        { value: "I", label: "First marker" },
        { value: "II", label: "Second marker" },
        { value: "III", label: "Third marker" },
        { value: "IV", label: "Fourth marker" },
      ];

  const titleOp = interpolate(frame, [5, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Line draw starts at 25, waypoints appear one by one
  const lineDraw = interpolate(frame, [25, 45 + displayWaypoints.length * 8], [0, 1], {
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
        padding: p ? "10% 8%" : "7% 8%",
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
        variant="vine"
      />
      <OrnamentalCorner
        position="bottom-right"
        size={p ? 100 : 120}
        color={accentColor}
        startFrame={10}
        variant="vine"
      />

      {/* Title */}
      <div
        style={{
          fontFamily: CHRONICLE_HEADING_FONT,
          fontSize: titleFontSize ?? (p ? 60 : 56),
          fontWeight: 700,
          color: textColor,
          textAlign: "center",
          marginBottom: 8,
          opacity: titleOp,
        }}
      >
        <QuillText text={title} startFrame={5} durationFrames={25} mode="char" showCursor={false} />
      </div>

      {narration && (
        <div
          style={{
            fontFamily: fontFamily ?? CHRONICLE_BODY_FONT,
            fontSize: descriptionFontSize ?? (p ? 26 : 22),
            color: textColor,
            fontStyle: "italic",
            textAlign: "center",
            opacity: titleOp * 0.75,
            marginBottom: 40,
            maxWidth: "80%",
            alignSelf: "center",
          }}
        >
          {narration}
        </div>
      )}

      {/* Timeline */}
      <div
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "30px 10px" : "40px 60px",
        }}
      >
        {/* Ink line (draws from left to right or top to bottom) */}
        <div
          style={{
            position: "absolute",
            ...(p
              ? {
                  top: 20,
                  bottom: 20,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 3,
                  background: `linear-gradient(to bottom, ${textColor} 0%, ${textColor} 100%)`,
                  height: `calc((100% - 40px) * ${lineDraw})`,
                }
              : {
                  left: 40,
                  right: 40,
                  top: "50%",
                  transform: "translateY(-50%)",
                  height: 3,
                  background: `linear-gradient(to right, ${textColor} 0%, ${textColor} 100%)`,
                  width: `calc((100% - 80px) * ${lineDraw})`,
                }),
            borderRadius: 2,
            boxShadow: `0 0 0 1px rgba(40,25,12,0.2)`,
          }}
        />

        {/* Waypoints */}
        <div
          style={{
            display: "flex",
            flexDirection: p ? "column" : "row",
            justifyContent: "space-between",
            width: "100%",
            height: p ? "100%" : "auto",
            position: "relative",
            zIndex: 2,
          }}
        >
          {displayWaypoints.map((w, i) => {
            const cellStart = 30 + i * 12;
            const cellOp = interpolate(frame, [cellStart, cellStart + 15], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const dotScale = interpolate(frame, [cellStart + 3, cellStart + 15], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            // Alternate label position above/below (landscape) or left/right (portrait)
            const above = i % 2 === 0;

            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: p ? "row" : "column",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  opacity: cellOp,
                }}
              >
                {/* Label */}
                <div
                  style={{
                    position: "absolute",
                    ...(p
                      ? above
                        ? { left: "calc(50% + 30px)", top: "50%", transform: "translateY(-50%)", width: "45%" }
                        : { right: "calc(50% + 30px)", top: "50%", transform: "translateY(-50%)", width: "45%", textAlign: "right" }
                      : above
                        ? { bottom: "calc(50% + 30px)", left: "50%", transform: "translateX(-50%)", width: "90%", textAlign: "center" }
                        : { top: "calc(50% + 30px)", left: "50%", transform: "translateX(-50%)", width: "90%", textAlign: "center" }),
                    pointerEvents: "none",
                  }}
                >
                  <div
                    style={{
                      fontFamily: CHRONICLE_HEADING_FONT,
                      fontSize: p ? 36 : 40,
                      fontWeight: 900,
                      color: accentColor,
                      lineHeight: 1,
                      marginBottom: 6,
                      textShadow: "1px 1px 0 rgba(40,25,12,0.2)",
                    }}
                  >
                    {w.value}
                  </div>
                  <div
                    style={{
                      fontFamily: CHRONICLE_SMALLCAPS_FONT,
                      fontSize: descriptionFontSize ?? (p ? 20 : 18),
                      color: textColor,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      opacity: 0.88,
                      lineHeight: 1.3,
                    }}
                  >
                    {w.label}
                  </div>
                </div>

                {/* Dot */}
                <div
                  style={{
                    width: p ? 22 : 24,
                    height: p ? 22 : 24,
                    borderRadius: "50%",
                    background: textColor,
                    border: `3px solid ${accentColor}`,
                    boxShadow: `0 0 0 6px rgba(184,134,11,${0.25 * dotScale})`,
                    transform: `scale(${dotScale})`,
                    zIndex: 3,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
