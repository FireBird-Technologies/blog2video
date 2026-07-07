import React from "react";
import { useVideoConfig, interpolate, spring, Img } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SakuraScene,
  useSakuraFrame,
  KamonWatermark,
  CornerBlossoms,
  SplitBrushLines,
  PetalDivider,
  hexToRgba,
  readableTextColor,
  petalTint,
} from "../sakuraStyle";

export const SakuraIntro: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    imageUrl,
    imageObjectPosition,
    imageZoom,
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
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  // User's three colors drive the scene. This is a DARK backdrop: accent drives
  // the brush marks, and text drives the body — but a near-black text color
  // would vanish on dark, so readableTextColor falls back to light washi.
  const crimson = accentColor || SAKURA.crimson;
  const ink = readableTextColor(textColor, "dark");
  // The 桜 kanji renders in a soft petal-pink DERIVED from the accent (default
  // crimson → the reference blush), so the original pink+gold intro look is
  // preserved while custom accent colors still shift the petal tint.
  const petal = petalTint(accentColor);

  const kanjiTitle = (props as any).kanjiTitle ?? title ?? "桜";
  const romanTitle = (props as any).romanTitle ?? "";
  const tagline = (props as any).tagline ?? narration ?? "";
  const author = (props as any).author ?? "";

  const titlePx = titleFontSize ?? (p ? 92 : 132);
  const taglinePx = descriptionFontSize ?? (p ? 52 : 67);
  // Roman title scales with the kanji title so they grow/shrink together.
  const romanPx = Math.max(14, Math.round(titlePx * 0.19));

  // Kanji blooms in
  const kanjiSpring = spring({ frame, fps, config: { damping: 18, stiffness: 60 } });
  const kanjiScale = interpolate(kanjiSpring, [0, 1], [0.6, 1]);
  const kanjiOpacity = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Gold roman title
  const romanReveal = interpolate(frame, [14, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });

  // Tagline
  const taglineReveal = interpolate(frame, [32, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });

  // Author byline
  const authorReveal = interpolate(frame, [50, 66], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cx = width / 2;
  const cy = height / 2;

  // Optional hero background image — sits full-bleed BEHIND everything (kamon
  // rings, petals, title), blended into the dark plum scene so it reads as
  // atmosphere, not a foreground photo. A slow settle from a hair larger keeps
  // it feeling alive under the title; a crimson `color` blend tints it toward
  // the palette accent, and a plum→void radial vignette + top/bottom scrims
  // keep the centered wordmark legible.
  const bgReveal = interpolate(frame, [0, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  const heroBg = imageUrl ? (
    <>
      <Img
        src={imageUrl}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
          objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
          transform: `scale(${(imageZoom ?? 1) * interpolate(bgReveal, [0, 1], [1.06, 1])})`,
          transformOrigin: (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
          // Dim + desaturate so it recedes into the dark washi atmosphere.
          opacity: bgReveal * 0.3,
          filter: "grayscale(35%) brightness(0.8)",
          pointerEvents: "none",
        }}
      />
      {/* Accent tint: the palette's main color washed over the photo. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: crimson,
          mixBlendMode: "color",
          opacity: bgReveal * 0.4,
          pointerEvents: "none",
        }}
      />
      {/* Plum→void vignette + accent multiply so the image settles into the
          scene and the centered title always stays readable over it. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(120% 120% at 50% 50%, transparent 0%, ${hexToRgba(SAKURA.plum, 0.5)} 55%, ${hexToRgba(SAKURA.void, 0.86)} 100%), linear-gradient(0deg, ${hexToRgba(SAKURA.void, 0.7)}, transparent 30%, transparent 70%, ${hexToRgba(SAKURA.void, 0.7)})`,
          pointerEvents: "none",
        }}
      />
    </>
  ) : null;

  return (
    <SakuraScene
      backdrop="plum_radial"
      entranceLayout="sakura_intro"
      bgColor={bgColor}
      accentColor={crimson}
      dur={dur}
      petals={p ? 24 : 35}
      petalIntensity={1.4}
      petalSeed={42}
      petalMode="storm"
      chrome={
        <>
          {/* Hero background image (only when provided) — painted first so it
              sits behind the kamon rings, petals and title. */}
          {heroBg}
          {/* Twin kamon watermark rings */}
          <KamonWatermark cx={cx} cy={cy} r={p ? 380 : 260} color={SAKURA.gold} opacity={0.07} />
          <KamonWatermark cx={cx} cy={cy} r={p ? 280 : 190} color={SAKURA.blush} opacity={0.05} spin={-0.02} />
          <CornerBlossoms scale={p ? 0.9 : 1} />
        </>
      }
    >
      {/* Centered title stack */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: p ? "140px 70px" : "80px 160px",
        }}
      >
        {/* Kanji title */}
        <div
          style={{
            fontFamily: SAKURA_DISPLAY_FONT,
            fontWeight: 700,
            fontSize: titlePx,
            color: petal,
            lineHeight: 1.05,
            letterSpacing: "0.05em",
            textShadow: `0 0 80px ${hexToRgba(petal, 0.4)}, 0 4px 32px ${hexToRgba(crimson, 0.3)}`,
            transform: `scale(${kanjiScale})`,
            opacity: kanjiOpacity,
            marginBottom: 18,
          }}
        >
          {kanjiTitle}
        </div>

        {/* Split crimson brush lines */}
        <div style={{ marginBottom: 22 }}>
          <SplitBrushLines width={p ? 420 : 520} color={crimson} startFrame={10} durationFrames={20} />
        </div>

        {/* Gold letter-spaced roman title — the palette's fixed metallic label
            color (also used by the kamon rings above), restoring the original
            gold "SAKURA" wordmark under the pink kanji. */}
        {romanTitle ? (
          <div
            style={{
              fontFamily: fontFamily ?? SAKURA_BODY_FONT,
              fontSize: romanPx,
              color: SAKURA.gold,
              letterSpacing: "0.75em",
              textTransform: "uppercase",
              textIndent: "0.75em",
              opacity: romanReveal,
              transform: `translateY(${(1 - romanReveal) * 16}px)`,
              marginBottom: 26,
            }}
          >
            {romanTitle}
          </div>
        ) : null}

        {/* line — blossom — line divider */}
        <div style={{ marginBottom: 26 }}>
          <PetalDivider width={p ? 320 : 380} lineColor={crimson} flowerColor={crimson} startFrame={24} durationFrames={14} />
        </div>

        {/* Italic tagline */}
        {tagline ? (
          <div
            style={{
              fontFamily: SAKURA_BODY_FONT,
              fontStyle: "italic",
              fontSize: taglinePx,
              color: ink,
              letterSpacing: "0.14em",
              lineHeight: 1.5,
              maxWidth: p ? 820 : 1000,
              opacity: taglineReveal * 0.92,
              transform: `translateY(${(1 - taglineReveal) * 14}px)`,
            }}
          >
            {tagline}
          </div>
        ) : null}

        {/* Faint author byline */}
        {author ? (
          <div
            style={{
              fontFamily: SAKURA_BODY_FONT,
              fontSize: p ? 18 : 15,
              color: hexToRgba(ink, 0.32),
              letterSpacing: "0.6em",
              textTransform: "uppercase",
              textIndent: "0.6em",
              marginTop: 44,
              opacity: authorReveal,
            }}
          >
            {author}
          </div>
        ) : null}
      </div>
    </SakuraScene>
  );
};
