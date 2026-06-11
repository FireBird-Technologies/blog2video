import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS, CHROME_INSET } from "../constants";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../fonts/economist-defaults";
import { EditorialDivider, EngravingTexture } from "../components/EconomistOrnaments";
import { baselineSettle, inkBleed, redactionReveal } from "./motion";

/**
 * LeaderQuote — an oversized red opening quotation mark blooming in like a drop
 * of ink + a large centred serif pull-quote assembling word by word (an
 * optional phrase coloured red) + an attribution in sans small-caps uncovered
 * by a sweeping accent bar, framed by thin red rules.
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
  const { width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";

  const text = quote || narration || "";
  const quoteSize = (titleFontSize ?? (isPortrait ? 64 : 84)) as number;
  const pad = isPortrait ? 64 : width * 0.085;
  const topInset = (isPortrait ? CHROME_INSET.topPortrait : CHROME_INSET.top) + 16;
  // Extra bottom padding in portrait biases the vertically-centred quote upward
  // so it sits a touch above dead-centre.
  const botInset = (isPortrait ? CHROME_INSET.bottomPortrait : CHROME_INSET.bottom) + 16 + (isPortrait ? 180 : 0);

  const mark = inkBleed(frame, 4);
  const ruleW = interpolate(frame, [10, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const kickerOp = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const attrReveal = redactionReveal(frame, 46, 16);

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

  // The quote assembles word by word; the stagger shrinks for long quotes so
  // the full line always lands by ~frame 60 regardless of length.
  const quoteWords: Array<{ word: string; hi: boolean }> = [
    ...pre.split(/\s+/).filter(Boolean).map((w) => ({ word: w, hi: false })),
    ...mid.split(/\s+/).filter(Boolean).map((w) => ({ word: w, hi: true })),
    ...post.split(/\s+/).filter(Boolean).map((w) => ({ word: w, hi: false })),
  ];
  const wordStep = Math.min(3, 40 / Math.max(1, quoteWords.length));

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

      {/* Oversized opening quote mark blooming in like a drop of ink. */}
      <div
        style={{
          fontFamily: ECONOMIST_SERIF_FONT,
          fontWeight: 900,
          fontSize: isPortrait ? 170 : 200,
          lineHeight: 0.7,
          color: accentColor,
          opacity: mark.opacity,
          transform: mark.transform,
          filter: mark.filter,
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
        }}
      >
        {quoteWords.map((w, i) => {
          const settle = baselineSettle(frame, 16 + i * wordStep, 18, 14);
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                whiteSpace: "pre",
                color: w.hi ? accentColor : undefined,
                opacity: settle.opacity,
                transform: settle.transform,
                filter: settle.filter,
              }}
            >
              {w.word}
              {i < quoteWords.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>

      {attribution && (
        <>
          <EditorialDivider width={160} progress={ruleW} accentColor={accentColor} height={16} style={{ margin: `${isPortrait ? 26 : 32}px 0 18px` }} />
          <div style={{ position: "relative", display: "inline-block" }}>
            <div
              style={{
                fontFamily: ECONOMIST_SANS_FONT,
                fontWeight: 700,
                fontSize: isPortrait ? 24 : 24,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: ECONOMIST_COLORS.muted,
                clipPath: attrReveal.clipPath,
              }}
            >
              — {attribution}
            </div>
            <span
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${attrReveal.barLeftPct.toFixed(2)}%`,
                width: `${attrReveal.barWidthPct}%`,
                background: accentColor,
                opacity: attrReveal.barOpacity,
              }}
            />
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};
