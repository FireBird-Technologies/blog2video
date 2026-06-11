import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS, CHROME_INSET } from "../constants";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../../fonts/economist-defaults";
import { EditorialDivider, EngravingTexture } from "../components/EconomistOrnaments";
import { baselineSettle, clamp01, easeOutQuint, inkBleed, redactionReveal } from "./motion";

/**
 * LeaderQuote — an oversized red opening quotation mark blooming in like a drop
 * of ink + a large serif pull-quote assembling word by word (an optional phrase
 * coloured red) + an attribution in sans small-caps uncovered by a sweeping
 * accent bar, framed by thin red rules.
 *
 * With an image the layout becomes a magazine spread: a matted editorial
 * portrait (white mat, hairline rule, red plate tab, photo developing from
 * monochrome) sits left of a left-aligned quote in landscape, or as a band
 * above the centred quote in portrait.
 */
export const LeaderQuote: React.FC<EconomistLayoutProps> = ({
  quote,
  narration,
  attribution,
  highlightPhrase,
  sectionLabel,
  imageUrl,
  imageObjectPosition = "50% 50%",
  imageZoom = 1,
  accentColor = ECONOMIST_COLORS.accent,
  textColor = ECONOMIST_COLORS.ink,
  titleFontSize,
  aspectRatio = "landscape",
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";
  const hasImage = Boolean(imageUrl);
  const splitView = hasImage && !isPortrait;

  const text = quote || narration || "";
  const baseQuoteSize = (titleFontSize ?? (isPortrait ? 64 : 84)) as number;
  // The split view's text column is narrower — scale the quote down a touch.
  const quoteSize = Math.round(baseQuoteSize * (splitView ? 0.82 : 1));
  const pad = isPortrait ? 64 : width * 0.085;
  const topInset = (isPortrait ? CHROME_INSET.topPortrait : CHROME_INSET.top) + 16;
  // Extra bottom padding in portrait biases the vertically-centred quote upward
  // so it sits a touch above dead-centre (less bias when a photo band is added).
  const botInset =
    (isPortrait ? CHROME_INSET.bottomPortrait : CHROME_INSET.bottom) +
    16 +
    (isPortrait ? (hasImage ? 80 : 180) : 0);

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

  // ── matted editorial portrait (image mode) ─────────────────────────────────
  // Slides in from the left (landscape) / fades down (portrait) while the
  // photo develops from newsprint monochrome to colour, like ImageFeature.
  const frameT = easeOutQuint(clamp01((frame - 6) / 18));
  const developT = clamp01((frame - 10) / 50);
  const kbScale = interpolate(frame, [0, 280], [1.03, 1.1], { extrapolateRight: "clamp" }) * imageZoom;
  const photoPane = hasImage ? (
    <div
      style={{
        flex: "0 0 auto",
        width: splitView ? width * 0.3 : Math.min(width - pad * 2, width * 0.56),
        height: splitView ? (height - topInset - botInset) * 0.82 : height * 0.255,
        background: "#FFFFFF",
        border: `1px solid ${ECONOMIST_COLORS.rule}`,
        boxShadow: "0 10px 36px rgba(26,26,26,0.14)",
        padding: 14,
        position: "relative",
        opacity: frameT,
        transform: splitView
          ? `translateX(${((1 - frameT) * -36).toFixed(2)}px)`
          : `translateY(${((1 - frameT) * -24).toFixed(2)}px)`,
        marginBottom: splitView ? 0 : 30,
      }}
    >
      <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
        <Img
          src={imageUrl as string}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: imageObjectPosition,
            transform: `scale(${kbScale.toFixed(4)})`,
            filter: `grayscale(${(1 - developT).toFixed(3)})`,
          }}
        />
      </div>
      {/* Red plate tab over the mat's top rule. */}
      <div style={{ position: "absolute", top: -1, left: 26, width: 44, height: 6, background: accentColor }} />
    </div>
  ) : null;

  const align: "center" | "flex-start" = splitView ? "flex-start" : "center";
  const textAlign: "center" | "left" = splitView ? "left" : "center";

  return (
    <AbsoluteFill
      style={{
        padding: `${topInset}px ${pad}px ${botInset}px`,
        flexDirection: splitView ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: splitView ? 72 : 0,
      }}
    >
      {/* Faint engraved field behind the quote to fill the wide empty paper. */}
      {!hasImage && <EngravingTexture opacity={0.03} gap={11} />}

      {photoPane}

      <div style={{ display: "flex", flexDirection: "column", alignItems: align, minWidth: 0, flex: splitView ? 1 : undefined }}>
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
            fontSize: splitView ? 150 : isPortrait ? 170 : 200,
            lineHeight: 0.7,
            color: accentColor,
            opacity: mark.opacity,
            transform: mark.transform,
            filter: mark.filter,
            transformOrigin: splitView ? "left bottom" : "center bottom",
            marginBottom: isPortrait ? 4 : 8,
            height: splitView ? 90 : isPortrait ? 96 : 120,
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
            textAlign,
            maxWidth: splitView ? "100%" : isPortrait ? "100%" : "90%",
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
      </div>
    </AbsoluteFill>
  );
};
