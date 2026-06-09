import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS } from "../constants";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../fonts/economist-defaults";

/**
 * LeaderQuote — an oversized red opening quotation mark + a large centred serif
 * pull-quote (an optional phrase coloured red) + an attribution in sans
 * small-caps, framed by thin red rules.
 */
export const LeaderQuote: React.FC<EconomistLayoutProps> = ({
  quote,
  narration,
  attribution,
  highlightPhrase,
  accentColor = ECONOMIST_COLORS.accent,
  textColor = ECONOMIST_COLORS.ink,
  titleFontSize,
  aspectRatio = "landscape",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";

  const text = quote || narration || "";
  const quoteSize = (titleFontSize ?? (isPortrait ? 56 : 72)) as number;
  const pad = isPortrait ? 80 : width * 0.14;

  const markScale = spring({ frame: frame - 4, fps, config: { damping: 14, mass: 0.6 } });
  const ruleW = interpolate(frame, [10, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const quoteOp = interpolate(frame, [16, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const quoteY = interpolate(frame, [16, 36], [18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const attrOp = interpolate(frame, [38, 54], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Split out the highlighted phrase so it can be coloured red.
  let pre = text;
  let mid = "";
  let post = "";
  if (highlightPhrase && text.includes(highlightPhrase)) {
    const idx = text.indexOf(highlightPhrase);
    pre = text.slice(0, idx);
    mid = highlightPhrase;
    post = text.slice(idx + highlightPhrase.length);
  }

  return (
    <AbsoluteFill style={{ padding: `0 ${pad}px`, alignItems: "center", justifyContent: "center" }}>
      {/* Oversized opening quote mark. */}
      <div
        style={{
          fontFamily: ECONOMIST_SERIF_FONT,
          fontWeight: 900,
          fontSize: isPortrait ? 220 : 260,
          lineHeight: 0.7,
          color: accentColor,
          transform: `scale(${markScale})`,
          transformOrigin: "center bottom",
          marginBottom: isPortrait ? 4 : 8,
          height: isPortrait ? 120 : 150,
        }}
      >
        &ldquo;
      </div>

      <div style={{ width: 120, height: 3, background: accentColor, transform: `scaleX(${ruleW})`, marginBottom: isPortrait ? 28 : 34 }} />

      <div
        style={{
          fontFamily: ECONOMIST_SERIF_FONT,
          fontWeight: 700,
          fontSize: quoteSize,
          lineHeight: 1.22,
          color: textColor,
          textAlign: "center",
          maxWidth: isPortrait ? "100%" : "82%",
          opacity: quoteOp,
          transform: `translateY(${quoteY}px)`,
        }}
      >
        {pre}
        {mid && <span style={{ color: accentColor }}>{mid}</span>}
        {post}
      </div>

      {attribution && (
        <>
          <div style={{ width: 120, height: 3, background: accentColor, transform: `scaleX(${ruleW})`, margin: `${isPortrait ? 30 : 36}px 0 22px` }} />
          <div
            style={{
              fontFamily: ECONOMIST_SANS_FONT,
              fontWeight: 700,
              fontSize: isPortrait ? 24 : 24,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: ECONOMIST_COLORS.muted,
              opacity: attrOp,
            }}
          >
            — {attribution}
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};
