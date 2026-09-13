import React from "react";
import { useVideoConfig, interpolate, spring, Img } from "remotion";
import { SceneLayoutProps } from "../types";
import { SakuraClip } from "../components/SakuraClip";
import { useFitText } from "../components/useFitText";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SAKURA_TEMPO,
  SakuraScene,
  useSakuraFrame,
  KamonWatermark,
  PetalDivider,
  GrowingSakuraTree,
  hexToRgba,
  readableTextColor,
  petalTint,
  deriveDarkWash,
} from "../sakuraStyle";

/**
 * "Blooming Tree" — a visual variant of sakura_intro. Same props and prop
 * meanings as SakuraIntro (kanjiTitle/romanTitle/tagline/author, plus the
 * common title/narration/image fallbacks); this is a different composition,
 * not different content. Instead of the base's twin kamon watermark rings,
 * a large procedural cherry tree (GrowingSakuraTree) grows up behind the
 * centered kanji title — full canopy spreading wide as the title blooms
 * among the branches, dimmed directly behind the copy so it stays legible.
 */
export const SakuraIntroBloomingTree: React.FC<SceneLayoutProps> = (props) => {
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
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  const crimson = accentColor || SAKURA.crimson;
  const ink = readableTextColor(textColor, "dark");
  const petal = petalTint(accentColor);
  const darkWash = deriveDarkWash(bgColor);

  const kanjiTitle = (props as any).kanjiTitle ?? title ?? "桜";
  const romanTitle = (props as any).romanTitle ?? "";
  const tagline = (props as any).tagline ?? narration ?? "";
  const author = (props as any).author ?? "";

  const titleTargetPx = titleFontSize ?? (p ? 92 : 132);
  const taglineTargetPx = descriptionFontSize ?? (p ? 52 : 67);
  const titleRef = React.useRef<HTMLDivElement>(null);
  const taglineRef = React.useRef<HTMLDivElement>(null);
  const { px: titlePx } = useFitText(
    titleRef,
    titleTargetPx,
    Math.max(28, Math.round(titleTargetPx * 0.52)),
    [kanjiTitle, titleTargetPx, p, height],
    Math.round(height * (p ? 0.24 : 0.3)),
  );
  const { px: taglinePx } = useFitText(
    taglineRef,
    taglineTargetPx,
    Math.max(20, Math.round(taglineTargetPx * 0.5)),
    [tagline, taglineTargetPx, titlePx, p, height],
    Math.round(height * (p ? 0.38 : 0.5)),
  );
  const romanPx = Math.max(14, Math.round(titlePx * 0.19));
  const authorPx = Math.max(12, Math.round(taglinePx * 0.28));

  // Kanji blooms in
  const kanjiSpring = spring({ frame, fps, config: { damping: 18, stiffness: 60 } });
  const kanjiScale = interpolate(kanjiSpring, [0, 1], [0.6, 1]);
  const kanjiOpacity = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const romanReveal = interpolate(frame, [14, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  const taglineReveal = interpolate(frame, [32, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  const authorReveal = interpolate(frame, [50, 66], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cx = width / 2;
  const cy = height / 2;

  // Tree grows across most of the scene — same slow-unfurl idiom as
  // SakuraTextNarration/SakuraSection's no-image tree fallback, ending well
  // before the exit fade so it fully blooms with room to settle.
  const treeGrowEnd = Math.round((dur - 46) * SAKURA_TEMPO);
  const treeGrow = interpolate(frame, [4, treeGrowEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2.2),
  });

  // Optional hero background image — same treatment as the base intro: dim,
  // desaturated, sits behind the tree so it reads as atmosphere.
  const bgReveal = interpolate(frame, [0, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  const heroVisualStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
    objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
    transform: `scale(${(imageZoom ?? 1) * interpolate(bgReveal, [0, 1], [1.06, 1])})`,
    transformOrigin: (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
    opacity: bgReveal * 0.3,
    filter: "grayscale(35%) brightness(0.8)",
    pointerEvents: "none",
  };
  const heroBg = (imageUrl || videoUrl) ? (
    <>
      {videoUrl ? (
        <SakuraClip
          src={videoUrl}
          imageObjectPosition={imageObjectPosition}
          imageZoom={imageZoom}
          muted={videoMuted ?? true}
          volume={videoVolume ?? 0.35}
          durationInFrames={videoDurationInFrames}
          startInFrames={videoStartInFrames}
          style={heroVisualStyle}
        />
      ) : (
        <Img src={imageUrl!} style={heroVisualStyle} />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: darkWash.center,
          mixBlendMode: "color",
          opacity: bgReveal * 0.4,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(120% 120% at 50% 50%, transparent 0%, ${hexToRgba(darkWash.center, 0.5)} 55%, ${hexToRgba(darkWash.edge, 0.86)} 100%), linear-gradient(0deg, ${hexToRgba(darkWash.edge, 0.7)}, transparent 30%, transparent 70%, ${hexToRgba(darkWash.edge, 0.7)})`,
          pointerEvents: "none",
        }}
      />
    </>
  ) : null;

  return (
    <SakuraScene
      backdrop="plum_radial"
      entranceLayout="sakura_intro__v2"
      bgColor={bgColor}
      accentColor={crimson}
      dur={dur}
      petals={p ? 24 : 35}
      petalIntensity={1.2}
      petalSeed={23}
      petalMode="drift"
      chrome={
        <>
          {heroBg}
          <GrowingSakuraTree
            width={width}
            height={height}
            grow={treeGrow}
            seed={23}
            variant="upright"
            depth={p ? 9 : 10}
            spreadAngle={p ? 32 : 36}
            shrink={0.78}
            blossomDensity={2.2}
            opacity={p ? 0.55 : 0.6}
            windStyle="breeze"
            shed
            shedIntensity={0.8}
            dur={dur}
            textFadeRect={
              // Region the centered title/tagline stack occupies — branches
              // and blossoms dim here so the copy stays legible over the
              // canopy rather than fighting it.
              p
                ? { x: width * 0.08, y: height * 0.28, w: width * 0.84, h: height * 0.42 }
                : { x: width * 0.16, y: height * 0.24, w: width * 0.68, h: height * 0.46 }
            }
            textFadeOpacity={0.15}
          />
          <KamonWatermark cx={cx} cy={cy} r={p ? 380 : 260} color={SAKURA.gold} opacity={0.05} />
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
          ref={titleRef}
          style={{
            fontFamily: fontFamily ?? SAKURA_DISPLAY_FONT,
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

        {/* Brush-drawn divider (petal-tipped, matching the tree motif) */}
        <div style={{ marginBottom: 22 }}>
          <PetalDivider width={p ? 320 : 380} lineColor={crimson} flowerColor={crimson} startFrame={10} durationFrames={16} />
        </div>

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

        {tagline ? (
          <div
            ref={taglineRef}
            style={{
              fontFamily: fontFamily ?? SAKURA_BODY_FONT,
              fontStyle: "italic",
              fontSize: taglinePx,
              color: ink,
              letterSpacing: "0.14em",
              lineHeight: 1.5,
              maxWidth: p ? 820 : 1000,
              overflowWrap: "anywhere",
              opacity: taglineReveal * 0.92,
              transform: `translateY(${(1 - taglineReveal) * 14}px)`,
            }}
          >
            {tagline}
          </div>
        ) : null}

        {author ? (
          <div
            style={{
              fontFamily: fontFamily ?? SAKURA_BODY_FONT,
              fontSize: authorPx,
              color: hexToRgba(ink, 0.32),
              letterSpacing: "0.6em",
              textTransform: "uppercase",
              textIndent: "0.6em",
              marginTop: 44,
              maxWidth: p ? "86%" : "72%",
              overflowWrap: "anywhere",
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
