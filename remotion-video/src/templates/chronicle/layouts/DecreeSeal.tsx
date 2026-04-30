import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ChronicleLayoutProps } from "../types";
import {
  CHRONICLE_BLACKLETTER_FONT,
  CHRONICLE_BODY_FONT,
  CHRONICLE_HEADING_FONT,
  CHRONICLE_SMALLCAPS_FONT,
} from "../../../fonts/chronicle-defaults";
import { WaxSeal } from "../components/WaxSeal";
import { InkSplatter, QuillText } from "../components/QuillInk";

/**
 * DecreeSeal — single punch-line layout. Blackletter keyword,
 * red wax seal stamps down with a dust puff, small CTA below.
 * Used for one-word beats or royal-decree-style conclusions.
 */
export const DecreeSeal: React.FC<ChronicleLayoutProps> = ({
  title,
  narration,
  word,
  highlightWord,
  cta,
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

  // Preamble fades in
  const preambleOp = interpolate(frame, [5, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The word writes in
  const wordText = (word ?? highlightWord ?? title ?? "DECREED").toUpperCase();

  // Seal stamps at frame 45
  const sealFrame = 40;

  // CTA pulses after seal lands
  const ctaOp = interpolate(frame, [65, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaPulse = 1 + Math.sin((frame - 80) / 20) * 0.03;

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 18, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        padding: p ? "10% 8%" : "8% 12%",
        fontFamily: fontFamily ?? CHRONICLE_BODY_FONT,
        opacity: fadeOut,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
      }}
    >
      {/* Preamble — "Hear ye" style */}
      {(narration || title) && (
        <div
          style={{
            fontFamily: CHRONICLE_SMALLCAPS_FONT,
            fontSize: descriptionFontSize ?? (p ? 26 : 22),
            color: textColor,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            opacity: preambleOp * 0.8,
            textAlign: "center",
            fontWeight: 700,
            maxWidth: "85%",
          }}
        >
          <QuillText
            text={narration ?? title ?? ""}
            startFrame={5}
            durationFrames={Math.min(30, (narration ?? title ?? "").length * 1)}
            mode="word"
            showCursor={false}
          />
        </div>
      )}

      {/* The blackletter word */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: p ? 260 : 320,
        }}
      >
        {/* Ink splatter behind word */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%) scale(1.6)",
            opacity: 0.15,
            zIndex: 0,
          }}
        >
          <InkSplatter color={textColor} size={p ? 300 : 400} startFrame={18} />
        </div>

        <div
          style={{
            fontFamily: CHRONICLE_BLACKLETTER_FONT,
            fontSize: titleFontSize ?? (p ? 180 : 220),
            fontWeight: 400,
            color: textColor,
            lineHeight: 0.9,
            letterSpacing: "0.02em",
            textAlign: "center",
            textShadow: "3px 3px 0 rgba(184,134,11,0.25), 5px 5px 15px rgba(40,25,12,0.45)",
            position: "relative",
            zIndex: 1,
          }}
        >
          <QuillText
            text={wordText}
            startFrame={22}
            durationFrames={Math.max(20, wordText.length * 2.5)}
            mode="char"
            showCursor={false}
          />
        </div>

        {/* Wax seal stamping over corner */}
        <div
          style={{
            position: "absolute",
            bottom: p ? -15 : -10,
            right: p ? "5%" : "15%",
            zIndex: 3,
            transform: `rotate(-12deg)`,
          }}
        >
          <WaxSeal
            size={p ? 140 : 180}
            color="#8B2E1D"
            monogram="R"
            stampFrame={sealFrame}
          />
        </div>
      </div>

      {/* CTA / sign-off */}
      {cta && (
        <div
          style={{
            marginTop: 30,
            fontFamily: CHRONICLE_HEADING_FONT,
            fontSize: descriptionFontSize ?? (p ? 32 : 30),
            color: textColor,
            textAlign: "center",
            opacity: ctaOp,
            transform: `scale(${ctaPulse})`,
            fontStyle: "italic",
            letterSpacing: "0.05em",
          }}
        >
          &mdash; {cta} &mdash;
        </div>
      )}
    </AbsoluteFill>
  );
};
