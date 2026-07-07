import React from "react";
import { useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SAKURA_TEMPO,
  SakuraScene,
  useSakuraFrame,
  SoftPetal,
  KagiKakko,
  BrushUnderline,
  SumiBrushText,
  HankoSeal,
  MoonDisc,
  hexToRgba,
  sakuraRand,
  readableTextColor,
} from "../sakuraStyle";

export const SakuraQuote: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor,
    bgColor,
    textColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
  } = props;

  const p = aspectRatio === "portrait";
  const frame = useSakuraFrame();
  const { width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  // Dark backdrop: accent drives the backdrop; text drives the quote copy, but
  // a near-black text color would vanish on dark, so fall back to light washi.
  const crimson = accentColor || SAKURA.crimson;
  const ink = readableTextColor(textColor, "dark");

  const quote = (props as any).quote ?? title ?? "";
  const quoteRoman = (props as any).quoteRoman ?? "";
  const quoteTranslation = (props as any).quoteTranslation ?? narration ?? "";
  const body = (props as any).body ?? (props as any).context ?? "";
  const attribution = (props as any).attribution ?? (props as any).author ?? "";

  const quotePx = titleFontSize ?? (p ? 92 : 76);
  const translationPx = descriptionFontSize ?? (p ? 52 : 48);

  // ── Sumi-e brush choreography ───────────────────────────────────────────────
  // The quote is "written in" one glyph at a time (SumiBrushText). Everything
  // else keys off when that finishes so the order holds for any quote length.
  const QUOTE_START = 6;
  const QUOTE_PER_CHAR = 3;
  const QUOTE_CHAR_DUR = 7;
  // Keep the whole reveal inside the scene, before the exit fade at (dur-16) on
  // the real clock — convert to the tempo clock with SAKURA_TEMPO.
  const quoteBudget = Math.max(24, (dur - 24) * SAKURA_TEMPO);
  const quoteChars = Math.max(1, Array.from(quote).length);
  const quoteStep = Math.min(
    QUOTE_PER_CHAR,
    (quoteBudget - QUOTE_CHAR_DUR) / Math.max(1, quoteChars - 1),
  );
  const quoteEnd = QUOTE_START + (quoteChars - 1) * quoteStep + QUOTE_CHAR_DUR;

  // Kagi-kakko brackets frame the page before the writing starts.
  const bracketReveal = interpolate(frame, [2, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  const romanReveal = interpolate(frame, [quoteEnd, quoteEnd + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Brush underline draws L→R as the last glyph lands.
  const lineReveal = interpolate(frame, [quoteEnd - 4, quoteEnd + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  });
  const translationReveal = interpolate(frame, [quoteEnd + 8, quoteEnd + 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  // Body paragraph fades up after the translation; attribution comes last.
  const bodyReveal = interpolate(frame, [quoteEnd + 20, quoteEnd + 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  const attribStart = body ? quoteEnd + 40 : quoteEnd + 18;
  const attributionReveal = interpolate(frame, [attribStart, attribStart + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Petal strips top + bottom: staggered fade with a slow horizontal drift
  const stripCount = p ? 12 : 20;
  const strip = (yPos: number, dirSign: number, seedBase: number) => (
    <svg
      width={width}
      height={44}
      viewBox={`0 0 ${width} 44`}
      style={{ position: "absolute", top: yPos, left: 0, pointerEvents: "none" }}
    >
      {Array.from({ length: stripCount }, (_, i) => {
        const appear = interpolate(frame, [8 + i * 1.5, 20 + i * 1.5], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const drift = Math.sin(frame * 0.02 + i) * 6 * dirSign;
        return (
          <SoftPetal
            key={i}
            cx={(i + 0.5) * (width / stripCount) + drift}
            cy={22}
            r={9 + sakuraRand(seedBase + i, 1) * 3}
            rotation={i * 23 * dirSign}
            color={i % 2 === 0 ? SAKURA.blush : SAKURA.deepBlush}
            opacity={0.55 * appear}
          />
        );
      })}
    </svg>
  );

  return (
    <SakuraScene
      backdrop="celebration"
      entranceLayout="sakura_quote"
      bgColor={bgColor}
      accentColor={crimson}
      dur={dur}
      ambient="kasumi"
      petals={p ? 18 : 28}
      petalIntensity={0.9}
      petalSeed={23}
      petalMode="float"
      petalsBehind
      chrome={
        <>
          {/* Tsukimi moon rising low behind the quote — a pale moon-grey disc
              (not amber) so it doesn't cast a yellow wash over the scene. */}
          <MoonDisc
            cx={width * 0.5}
            cy={height * (p ? 0.42 : 0.48)}
            r={p ? width * 0.32 : height * 0.3}
            color={SAKURA.mist}
            startFrame={2}
            opacity={0.36}
          />
          {/* Kagi-kakko 「 」 editorial framing around the quote block */}
          <KagiKakko
            width={width}
            height={height}
            size={p ? 110 : 140}
            progress={bracketReveal}
            color={SAKURA.deepBlush}
            thickness={p ? 6 : 7}
            opacity={0.3}
          />
          {strip(p ? 90 : 26, 1, 51)}
          {strip(height - (p ? 130 : 70), -1, 87)}
        </>
      }
    >
      {/* Quote content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: p ? "160px 90px" : "100px 200px",
        }}
      >
        {/* Main quote — brushed in one glyph at a time like sumi-e calligraphy */}
        <div style={{ marginBottom: 30 }}>
          <SumiBrushText
            text={quote}
            fontFamily={fontFamily ?? SAKURA_DISPLAY_FONT}
            fontSize={quotePx}
            fontWeight={700}
            color={ink}
            startFrame={QUOTE_START}
            perChar={QUOTE_PER_CHAR}
            charDuration={QUOTE_CHAR_DUR}
            maxTotalFrames={quoteBudget}
            seed={71}
            bleedScale={p ? 3 : 3.5}
            letterSpacing="0.1em"
            lineHeight={1.25}
          />
        </div>

        {/* Romanized reading in angle brackets */}
        {quoteRoman ? (
          <div
            style={{
              fontFamily: SAKURA_BODY_FONT,
              fontSize: p ? 24 : 22,
              color: hexToRgba(ink, 0.72),
              letterSpacing: "0.5em",
              opacity: romanReveal,
              marginBottom: 26,
            }}
          >
            《&nbsp;&nbsp;{quoteRoman}&nbsp;&nbsp;》
          </div>
        ) : null}

        {/* Sumi brush stroke — hero accent beneath the quote */}
        <div style={{ marginBottom: 28 }}>
          <BrushUnderline
            width={p ? 380 : 500}
            color={ink}
            strokeWidth={p ? 4 : 5}
            startFrame={quoteEnd - 4}
            durationFrames={22}
            opacity={0.85}
          />
        </div>

        {/* Translation */}
        <div
          style={{
            fontFamily: SAKURA_BODY_FONT,
            fontStyle: "italic",
            fontSize: translationPx,
            color: hexToRgba(ink, 0.82),
            letterSpacing: "0.04em",
            lineHeight: 1.6,
            maxWidth: p ? 800 : 900,
            opacity: translationReveal * 0.95,
            transform: `translateY(${(1 - translationReveal) * 18}px)`,
          }}
        >
          “{quoteTranslation}”
        </div>

        {/* Body — a fuller explanatory passage beneath the quote */}
        {body ? (
          <div
            style={{
              fontFamily: SAKURA_BODY_FONT,
              fontSize: Math.round(translationPx * 0.8),
              color: hexToRgba(ink, 0.7),
              letterSpacing: "0.02em",
              lineHeight: 1.7,
              maxWidth: p ? 760 : 820,
              marginTop: p ? 30 : 26,
              whiteSpace: "pre-wrap",
              opacity: bodyReveal * 0.95,
              transform: `translateY(${(1 - bodyReveal) * 16}px)`,
            }}
          >
            {body}
          </div>
        ) : null}

        {/* Attribution + hanko seal signature */}
        {attribution ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: p ? 22 : 26,
              marginTop: 40,
              opacity: attributionReveal,
            }}
          >
            <span
              style={{
                fontFamily: SAKURA_BODY_FONT,
                fontSize: p ? 18 : 15,
                color: hexToRgba(ink, 0.5),
                letterSpacing: "0.4em",
                textTransform: "uppercase",
              }}
            >
              — {attribution}
            </span>
            <HankoSeal size={p ? 70 : 76} char="桜" startFrame={attribStart + 6} rotation={-6} />
          </div>
        ) : null}
      </div>
    </SakuraScene>
  );
};
