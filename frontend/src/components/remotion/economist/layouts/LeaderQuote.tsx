import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS, CHROME_INSET } from "../constants";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../../fonts/economist-defaults";
import { EditorialDivider, EngravingTexture } from "../components/EconomistOrnaments";

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
  sectionLabel,
  accentColor = ECONOMIST_COLORS.accent,
  textColor = ECONOMIST_COLORS.ink,
  titleFontSize,
  aspectRatio = "landscape",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";

  const text = quote || narration || "";
  const quoteSize = (titleFontSize ?? (isPortrait ? 64 : 84)) as number;
  const pad = isPortrait ? 64 : width * 0.085;
  const topInset = (isPortrait ? CHROME_INSET.topPortrait : CHROME_INSET.top) + 16;
  const botInset = (isPortrait ? CHROME_INSET.bottomPortrait : CHROME_INSET.bottom) + 16;

  const markScale = spring({ frame: frame - 4, fps, config: { damping: 14, mass: 0.6 } });
  const ruleW = interpolate(frame, [10, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Spring rise for the quote body — a touch of weight on entrance.
  const quoteSpring = spring({ frame: frame - 16, fps, config: { damping: 18, mass: 0.7 } });
  const quoteOp = interpolate(frame, [16, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const quoteY = interpolate(quoteSpring, [0, 1], [22, 0]);
  const kickerOp = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
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
    <AbsoluteFill style={{ padding: `${topInset}px ${pad}px ${botInset}px`, alignItems: "center", justifyContent: "center" }}>
      {/* Faint engraved field behind the quote to fill the wide empty paper. */}
      <EngravingTexture opacity={0.03} gap={11} />

      {/* Section kicker above the mark — fills the top space and frames the quote. */}
      {sectionLabel && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: isPortrait ? 18 : 24,
            opacity: kickerOp,
          }}
        >
          <span style={{ width: 28, height: 6, background: accentColor }} />
          <span
            style={{
              fontFamily: ECONOMIST_SANS_FONT,
              fontWeight: 700,
              fontSize: isPortrait ? 19 : 18,
              letterSpacing: 2.4,
              textTransform: "uppercase",
              color: ECONOMIST_COLORS.muted,
            }}
          >
            {sectionLabel}
          </span>
        </div>
      )}

      {/* Oversized opening quote mark. */}
      <div
        style={{
          fontFamily: ECONOMIST_SERIF_FONT,
          fontWeight: 900,
          fontSize: isPortrait ? 170 : 200,
          lineHeight: 0.7,
          color: accentColor,
          transform: `scale(${markScale})`,
          transformOrigin: "center bottom",
          marginBottom: isPortrait ? 4 : 8,
          height: isPortrait ? 96 : 120,
        }}
      >
        &ldquo;
      </div>

      <EditorialDivider width={160} progress={ruleW} accentColor={accentColor} height={16} style={{ marginBottom: isPortrait ? 22 : 28 }} />

      <div
        style={{
          fontFamily: ECONOMIST_SERIF_FONT,
          fontWeight: 700,
          fontSize: quoteSize,
          lineHeight: 1.22,
          color: textColor,
          textAlign: "center",
          maxWidth: isPortrait ? "100%" : "90%",
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
          <EditorialDivider width={160} progress={ruleW} accentColor={accentColor} height={16} style={{ margin: `${isPortrait ? 26 : 32}px 0 18px` }} />
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
