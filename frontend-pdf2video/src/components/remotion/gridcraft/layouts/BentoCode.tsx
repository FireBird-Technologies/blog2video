import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { GridcraftLayoutProps } from "../types";
import {
  GRIDCRAFT_DEFAULT_MONO_FONT_FAMILY,
  GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY,
} from "../constants";
import { glass, COLORS } from "../utils/styles";

export const BentoCode: React.FC<GridcraftLayoutProps> = ({
  title, // Language
  narration, // Description
  codeSnippet, // Legacy string
  codeLines, // Backend array
  accentColor,
  titleFontSize,
  descriptionFontSize,
  aspectRatio,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const spr = (d: number) => spring({ frame: Math.max(0, frame - d), fps, config: { damping: 16 } });

  const lines = codeLines && codeLines.length > 0
    ? codeLines
    : (codeSnippet || "").split("\n");
  const sansFontFamily = fontFamily ?? GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY;
  const monoFontFamily = fontFamily ?? GRIDCRAFT_DEFAULT_MONO_FONT_FAMILY;
  const codeFontFamily = p ? sansFontFamily : monoFontFamily;

  // Constants for line-by-line code animation
  const LINE_APPEAR_START_OFFSET = 2; // Each line starts 2 frames after the previous
  const LINE_APPEAR_DURATION = 10;   // Each line takes 10 frames to animate in

  // Calculate when the entire code typing animation finishes
  const codeEndFrame = lines.length > 0
    ? (lines.length - 1) * LINE_APPEAR_START_OFFSET + LINE_APPEAR_DURATION
    : 0; // If no lines, it finishes at frame 0

  const CODE_FINISH_BUFFER = 10; // Extra buffer frames after code finishes before next card animates
  const codeFinishTime = codeEndFrame + CODE_FINISH_BUFFER;

  // Language Badge (Hello World card) animation timing
  const BADGE_START_DELAY_AFTER_CODE = 10; // Delay after code finishes
  const badgeAnimStart = codeFinishTime + BADGE_START_DELAY_AFTER_CODE;
  const badgeSpring = spr(badgeAnimStart);

  // Description (Details card) animation timing
  const DESCRIPTION_START_DELAY_AFTER_BADGE = 30; // Delay after badge animation starts (allowing it to settle a bit)
  const descriptionAnimStart = badgeAnimStart + DESCRIPTION_START_DELAY_AFTER_BADGE;
  const descriptionSpring = spr(descriptionAnimStart);

  // Layout calculations for portrait mode
  const gap = 20;
  const containerWidthPercentage = 0.9;
  const containerHeightPercentage = 0.8; // Default for landscape

  const effectiveContainerWidth = width * containerWidthPercentage;

  let gridTemplateRowsStyle: string;
  let overallContainerHeightStyle: string;

  if (p) {
    // For "2fr 1fr" columns, total 3 fractional units.
    // The width for the 1fr column (right side) is (effectiveContainerWidth - gap) / 3.
    const rightColumnWidth = (effectiveContainerWidth - gap) / 3;

    // To make right cards "compact and square-ish", their height should be roughly equal to their width.
    const desiredCardHeight = rightColumnWidth;

    // The total height needed for the grid, considering two fixed-height rows and the gap between them.
    // The code panel (left) will span these two rows, taking up this total height.
    const requiredTotalGridHeight = desiredCardHeight * 2 + gap;

    overallContainerHeightStyle = `${requiredTotalGridHeight}px`; // Set overall container height to fit the fixed rows
    gridTemplateRowsStyle = `${desiredCardHeight}px ${desiredCardHeight}px`; // Set gridTemplateRows for portrait: two rows of fixed height

  } else {
    // Landscape mode: keep existing behavior
    overallContainerHeightStyle = `${containerHeightPercentage * 100}%`;
    gridTemplateRowsStyle = "1fr 1fr";
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr",
        gridTemplateRows: gridTemplateRowsStyle, // Dynamically set gridTemplateRows
        gap: gap,
        width: `${containerWidthPercentage * 100}%`,
        height: overallContainerHeightStyle, // Dynamically set overall container height
        margin: "auto",
        fontFamily: sansFontFamily,
      }}
    >
      {/* Code Window */}
      <div
        style={{
           gridRow: "1 / 3",
           backgroundColor: "rgba(15, 23, 42, 0.85)", // Dark slate
           backdropFilter: "blur(20px)",
           borderRadius: 24,
           border: "1px solid rgba(255,255,255,0.1)",
           padding: 32,
           fontFamily: codeFontFamily,
           fontSize: descriptionFontSize ?? (p ? 27 : 27),
           lineHeight: 1.8,
           color: "#E2E8F0",
           overflow: "hidden", // Important for containing the typing lines
           boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
           minWidth: 0,
           fontVariantNumeric: p ? "tabular-nums" : undefined,
           letterSpacing: p ? "-0.01em" : undefined,
        }}
      >
        {lines.map((line, i) => (
            <div key={i} style={{
                opacity: interpolate(frame, [i * LINE_APPEAR_START_OFFSET, i * LINE_APPEAR_START_OFFSET + LINE_APPEAR_DURATION], [0, 1], { extrapolateRight: "clamp" }),
                transform: `translateX(${interpolate(frame, [i * LINE_APPEAR_START_OFFSET, i * LINE_APPEAR_START_OFFSET + LINE_APPEAR_DURATION], [-10, 0], { extrapolateRight: "clamp" })}px)`
            }}>
                {line || " "}
            </div>
        ))}
      </div>

      {/* Language Badge (Hello World Card) */}
      <div
        style={{
            ...glass(true),
            backgroundColor: accentColor || COLORS.ACCENT,
            display: "flex", alignItems: "center", justifyContent: "center",
            transform: `scale(${interpolate(badgeSpring, [0, 1], [0.8, 1])})`,
            opacity: interpolate(badgeSpring, [0, 1], [0, 1]),
        }}
      >
          <div style={{ fontSize: titleFontSize ?? (p ? 37 : 37), fontWeight: 700 }}>{title || "Code"}</div>
      </div>

      {/* Description (Details Card) */}
      <div
        style={{
            ...glass(false),
            padding: 24,
            display: "flex", flexDirection: "column", justifyContent: "center",
            transform: `translateY(${interpolate(descriptionSpring, [0, 1], [40, 0])}px) scale(${interpolate(descriptionSpring, [0, 1], [0.95, 1])})`,
            opacity: interpolate(descriptionSpring, [0, 1], [0, 1]),
        }}
      >
          <div style={{ fontSize: 12, color: COLORS.MUTED, textTransform: "uppercase", marginBottom: 8 }}>Details</div>
          <div style={{ fontSize: 20, lineHeight: 1.4, fontWeight: 500 }}>{narration}</div>
      </div>
    </div>
  );
};
