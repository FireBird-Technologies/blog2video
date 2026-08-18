import React from "react";
import { useVideoConfig, interpolate, Img } from "remotion";
import { SceneLayoutProps } from "../types";
import { SakuraClip } from "../components/SakuraClip";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SakuraScene,
  useSakuraFrame,
  SumiBrushText,
  HankoSeal,
  MoonDisc,
  PetalDivider,
  hexToRgba,
  readableTextColor,
  petalTint,
} from "../sakuraStyle";

/**
 * SakuraIntroV2 — "Hanging Scroll" (kakejiku)
 *
 * Variant of `sakura_intro`. Same props, different composition.
 *
 * Base springs a giant 桜 kanji centre-frame over a dimmed full-bleed hero image,
 * with a petal STORM and split brush lines. This one hangs a vertical SCROLL.
 *
 * ── Where the image goes, and why it moved ──────────────────────────────────
 * A kakejiku is a PAINTING MOUNTED ON SILK with an inscription — so the image is
 * mounted INSIDE the scroll and the title is the inscription beneath it.
 *
 * It used to be a full-bleed wash behind the scroll, which was broken two ways:
 *   1. the scroll is an OPAQUE washi panel across the middle of the frame, so the
 *      image was only ever visible in the margins around it — it could never be a
 *      real element, only wallpaper;
 *   2. the attenuation stacked — opacity 0.3 × brightness(0.55) × grayscale(55%),
 *      then a 0.55→0.94 dark radial over the top — leaving roughly 3-5% effective
 *      visibility. It read as an empty dark ground, which is the bug reported.
 * Mounted in the scroll the picture is a first-class element and needs only a
 * light paper tint to sit in the washi world.
 *
 * Motion register is deliberately the opposite of the base: `petalMode="settle"`
 * and a slow unroll, against the base's storm — so the two openings do not read as
 * the same shot with different type.
 *
 * All timing goes through `useSakuraFrame()` (SAKURA_TEMPO 0.8), matching the rest
 * of the template. Seeds 13/17 are fresh.
 */
export const SakuraIntroV2: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    imageUrl,
    imageObjectPosition,
    imageZoom,
    videoUrl,
    videoMuted,
    videoVolume,
    videoDurationInFrames,
    videoStartInFrames,
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

  // Same colour derivation contract as the base: this is a DARK backdrop, so the
  // body text runs through readableTextColor (a near-black textColor would vanish),
  // and the petals take a derived tint.
  const crimson = accentColor || SAKURA.crimson;
  const ink = readableTextColor(textColor, "dark");
  const petal = petalTint(accentColor);

  const displayFont = fontFamily ?? SAKURA_DISPLAY_FONT;
  const bodyFont = fontFamily ?? SAKURA_BODY_FONT;

  const hasMedia = Boolean(imageUrl || videoUrl);

  // ── Scroll geometry ────────────────────────────────────────────────────────
  // The narration sits in a bottom band; the scroll (rollers + seal below the
  // paper) must END above it. Budget that furniture explicitly rather than
  // letting the paper run to the band — the two collided at full height.
  const scrollW = p ? Math.min(width * 0.72, 720) : Math.min(width * 0.42, 760);
  const scrollTopMin = p ? height * 0.09 : height * 0.06;
  const narrationBandH = narration ? (p ? height * 0.26 : height * 0.24) : height * 0.06;
  /** rollers (2×) + seal + their gaps, i.e. everything under the paper. */
  const scrollFurnitureH = p ? 130 : 116;
  const scrollFillH = height - scrollTopMin - narrationBandH - scrollFurnitureH;

  const titleStart = 18;
  // SumiBrushText does not shrink to fit, and the scroll is a NARROW measure, so a
  // long title overflowed the paper and was clipped mid-word. Scale the type down
  // with length — never ABOVE the requested/default size, so the Studio's font-size
  // control still governs short titles.
  const titleBasePx = titleFontSize ?? (p ? 84 : 72);
  const titleLen = (title ?? "").length;
  const titleFit = titleLen <= 18 ? 1 : Math.max(0.5, 1 - (titleLen - 18) * 0.018);
  const titlePx = Math.round(titleBasePx * titleFit);

  /**
   * Per-character stagger for the brush reveal, shared across the per-word
   * instances so they read as ONE continuous stroke. Budgeted from the title's
   * length: at a fixed 3 frames/char a 43-character title needed ~150 frames and
   * was still half-written when the scene ended, so it looked truncated.
   */
  const titleRevealBudget = Math.max(30, Math.min(64, dur * 0.42));
  const titleCharStagger = Math.max(
    0.7,
    Math.min(3, titleRevealBudget / Math.max(1, titleLen)),
  );

  // Paper height = mounted painting + inscription block + padding, capped by the
  // space available. Sized to content so a short title cannot leave a blank sheet.
  const paperPadY = p ? 34 : 30;
  const charsPerLine = Math.max(6, Math.floor((scrollW - (p ? 68 : 60)) / (titlePx * 0.52)));
  const titleLines = Math.max(1, Math.ceil(titleLen / charsPerLine));
  const titleBlockH = titleLines * titlePx * 1.25;

  /** The mounted painting: a tall panel in the upper part of the scroll. */
  const artH = hasMedia
    ? Math.min(
        p ? height * 0.34 : height * 0.36,
        Math.max(0, scrollFillH - titleBlockH - paperPadY * 2 - (p ? 40 : 34)),
      )
    : 0;

  const scrollMaxH = Math.max(
    // Floor at a scroll-like proportion so a short headline still hangs.
    Math.min(scrollFillH, p ? height * 0.34 : height * 0.42),
    Math.min(scrollFillH, artH + titleBlockH + paperPadY * 2 + (p ? 54 : 46)),
  );

  /** Centre the whole scroll (paper + furniture) in the band above the narration. */
  const scrollTop = scrollTopMin + Math.max(0, (scrollFillH - scrollMaxH) / 2);

  // The unroll IS the reveal — the panel's height animates, so the scroll opens.
  const unroll = interpolate(frame, [4, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const scrollH = scrollMaxH * unroll;
  const narrationPx = descriptionFontSize ?? (p ? 43 : 27);

  const narrationOpacity = interpolate(frame, [56, 76], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  /** The painting fades up once the scroll has opened far enough to show it. */
  const artOpacity = interpolate(frame, [16, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const mediaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
    objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
    transform: `scale(${imageZoom ?? 1})`,
    display: "block",
    // A LIGHT hand only. Mounted in the scroll the picture is a first-class
    // element, not a backdrop — the heavy grayscale/brightness/opacity stack that
    // used to sit here is what made it invisible.
    filter: "saturate(0.92)",
  };

  return (
    <SakuraScene
      backdrop="celebration"
      entranceLayout="sakura_intro__v2"
      bgColor={bgColor}
      accentColor={crimson}
      dur={dur}
      petals={p ? 16 : 22}
      petalIntensity={0.8}
      petalSeed={13}
      // Settle, not the base's storm — the calm counterpart.
      petalMode="settle"
      ambient="kirikane"
      chrome={
        <MoonDisc
          cx={p ? width * 0.8 : width * 0.76}
          cy={p ? height * 0.12 : height * 0.16}
          r={p ? 92 : 110}
          color={SAKURA.gold}
          startFrame={6}
          opacity={0.24}
        />
      }
    >
      {/* ── The scroll ── */}
      <div
        style={{
          position: "absolute",
          left: width / 2 - scrollW / 2,
          top: scrollTop,
          width: scrollW,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Top roller bar — the thing the paper hangs from. */}
        <div
          style={{
            width: scrollW + (p ? 36 : 30),
            height: p ? 16 : 14,
            borderRadius: 8,
            background: `linear-gradient(180deg, ${hexToRgba(SAKURA.gold, 0.95)} 0%, ${hexToRgba(
              SAKURA.gold,
              0.55,
            )} 100%)`,
            boxShadow: `0 2px 10px ${hexToRgba(SAKURA.ink, 0.45)}`,
            opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" }),
          }}
        />

        {/* The paper. Its HEIGHT is the animation — the scroll unrolls. */}
        <div
          style={{
            width: scrollW,
            height: scrollH,
            overflow: "hidden",
            background: `linear-gradient(180deg, ${hexToRgba(SAKURA.washi, 0.97)} 0%, ${hexToRgba(
              SAKURA.washi,
              0.9,
            )} 100%)`,
            borderLeft: `1px solid ${hexToRgba(SAKURA.gold, 0.5)}`,
            borderRight: `1px solid ${hexToRgba(SAKURA.gold, 0.5)}`,
            boxShadow: `0 18px 46px ${hexToRgba(SAKURA.ink, 0.55)}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: hasMedia ? (p ? 26 : 22) : 0,
            padding: `${paperPadY}px ${p ? 34 : 30}px`,
          }}
        >
          {/* ── The mounted painting ── */}
          {hasMedia ? (
            <div
              style={{
                width: "100%",
                height: artH,
                flexShrink: 0,
                overflow: "hidden",
                position: "relative",
                // Gold silk mount around the picture, as on a real kakejiku.
                border: `1px solid ${hexToRgba(SAKURA.gold, 0.75)}`,
                boxShadow: `inset 0 0 0 4px ${hexToRgba(SAKURA.washi, 0.85)}, 0 4px 16px ${hexToRgba(
                  SAKURA.ink,
                  0.22,
                )}`,
                opacity: artOpacity,
              }}
            >
              {videoUrl ? (
                <SakuraClip
                  src={videoUrl}
                  imageObjectPosition={imageObjectPosition}
                  imageZoom={imageZoom}
                  muted={videoMuted}
                  volume={videoVolume}
                  durationInFrames={videoDurationInFrames}
                  startInFrames={videoStartInFrames}
                  style={mediaStyle}
                />
              ) : (
                <Img src={imageUrl as string} style={mediaStyle} />
              )}
              {/* Faint washi tint so the photo belongs to the paper it sits on. */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: hexToRgba(SAKURA.washi, 0.1),
                  mixBlendMode: "overlay",
                }}
              />
            </div>
          ) : null}

          {/* Title, brushed horizontally, ONE SumiBrushText PER WORD.
              SumiBrushText emits one span per character, so a single instance lets
              the inline layout break between any two letters — portrait split
              "Hold U / p". (`word-break: keep-all` does not help: it only protects
              CJK.) Laying words out as flex items makes the WORD the unbreakable
              unit, and each word's startFrame is offset by the characters before it
              so the brush still writes continuously left-to-right.
              NOTE: do NOT set writing-mode: vertical-rl here. Tategaki only works
              for CJK — titles are Latin in practice, and vertical-rl stacks Latin
              one letter per line reading bottom-to-top, which rendered as an
              unreadable letter grid (and clipped in portrait). The scroll's
              verticality comes from the panel and rollers, not the type. */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "baseline",
              columnGap: titlePx * 0.28,
              maxWidth: "100%",
            }}
          >
            {(title ?? "").split(/\s+/).filter(Boolean).map((word, wi, words) => {
              const charsBefore = words.slice(0, wi).reduce((n, w) => n + w.length, 0);
              return (
                <SumiBrushText
                  key={wi}
                  text={word}
                  fontSize={titlePx}
                  fontFamily={displayFont}
                  fontWeight={700}
                  color={SAKURA.ink}
                  startFrame={titleStart + charsBefore * titleCharStagger}
                  perChar={titleCharStagger}
                  charDuration={10}
                  seed={17 + wi}
                />
              );
            })}
          </div>
        </div>

        {/* Bottom roller — closes the scroll off once it has unrolled. */}
        <div
          style={{
            width: scrollW + (p ? 36 : 30),
            height: p ? 16 : 14,
            borderRadius: 8,
            background: `linear-gradient(180deg, ${hexToRgba(SAKURA.gold, 0.55)} 0%, ${hexToRgba(
              SAKURA.gold,
              0.95,
            )} 100%)`,
            boxShadow: `0 2px 10px ${hexToRgba(SAKURA.ink, 0.45)}`,
            opacity: unroll,
          }}
        />

        {/* Seal at the foot — the signature on the piece. */}
        <div style={{ marginTop: p ? 18 : 16 }}>
          <HankoSeal
            size={p ? 66 : 58}
            char="桜"
            startFrame={54}
            rotation={-7}
            color={crimson}
          />
        </div>
      </div>

      {/* ── Narration, beneath the scroll ── */}
      {narration ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: p ? height * 0.06 : height * 0.07,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: p ? 14 : 12,
            padding: p ? "0 9%" : "0 16%",
            opacity: narrationOpacity,
          }}
        >
          <PetalDivider
            width={p ? 260 : 320}
            lineColor={hexToRgba(SAKURA.gold, 0.7)}
            flowerColor={petal}
            startFrame={54}
          />
          <div
            style={{
              fontFamily: bodyFont,
              fontSize: narrationPx,
              lineHeight: 1.65,
              color: hexToRgba(ink, 0.9),
              textAlign: "center",
              letterSpacing: "0.04em",
              overflowWrap: "anywhere",
            }}
          >
            {narration}
          </div>
        </div>
      ) : null}
    </SakuraScene>
  );
};
