import React from "react";
import { useVideoConfig, interpolate, spring, Img } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SakuraScene,
  useSakuraFrame,
  SAKURA_TEMPO,
  KamonWatermark,
  BrushUnderline,
  GrowingSakuraTree,
  hexToRgba,
} from "../sakuraStyle";

export const SakuraTextNarration: React.FC<SceneLayoutProps> = (props) => {
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

  const eyebrow = (props as any).eyebrow ?? "";
  const headline = (props as any).headline ?? title ?? "";
  const body = (props as any).body ?? narration ?? "";

  const crimson = accentColor || SAKURA.crimson;
  const ink = textColor || SAKURA.ink;

  const titlePx = titleFontSize ?? (p ? 60 : 58);
  const bodyPx = descriptionFontSize ?? (p ? 28 : 24);
  // Eyebrow (gold caps kicker) scales off the body size so it tracks the
  // display-text slider.
  const eyebrowPx = Math.max(14, Math.round(bodyPx * 0.71));

  // Eyebrow — pops in with a tiny bounce
  const eyebrowSpring = spring({ frame, fps, config: { damping: 9, stiffness: 130 }, from: 0, to: 1 });

  // Headline: each WORD zooms in with an overshoot, staggered word by word (cute).
  const words = String(headline).split(/\s+/).filter(Boolean);
  const HEAD_START = 8;
  const HEAD_STEP = 5;
  const wordStyle = (i: number): React.CSSProperties => {
    const pop = spring({
      frame: Math.max(0, frame - (HEAD_START + i * HEAD_STEP)),
      fps,
      config: { damping: 10, stiffness: 130 }, // overshoot = bouncy zoom
      from: 0,
      to: 1,
    });
    return {
      display: "inline-block",
      opacity: Math.min(1, pop * 1.4),
      transform: `scale(${pop})`,
      transformOrigin: "50% 70%",
      marginRight: "0.28em",
    };
  };
  const headEnd = HEAD_START + words.length * HEAD_STEP;
  // gentle continuous breathing zoom on the whole headline after it lands
  const breathe = 1 + Math.sin(Math.max(0, frame - headEnd) * 0.045) * 0.012;

  // Cherry tree grows step-by-step alongside the copy: starts as the headline
  // lands and keeps unfurling slowly across most of the scene — then a gentle sway.
  // `frame` is the tempo-scaled clock (useSakuraFrame, 0.8x) but `dur` is in real
  // frames, so ending the growth at `dur - 24` means grow=1 only lands at real
  // frame ~1.25*(dur-24) — past the scene's exit fade, so the tree never fully
  // bloomed. Convert the end into tempo space and finish ~1s (30 real frames)
  // before the dur-16 exit fade so the tree fully expands with room to settle.
  const treeGrowEnd = Math.round((dur - 46) * SAKURA_TEMPO);
  const treeGrow = interpolate(frame, [HEAD_START, treeGrowEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2.2),
  });

  // Body
  const bodyReveal = interpolate(frame, [headEnd + 2, headEnd + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });

  // Optional supporting image: eases in on a right-side panel (below the copy in
  // portrait). Only rendered when a source is provided — with no image the copy
  // keeps its original full-width, left-anchored composition unchanged.
  const panelReveal = interpolate(frame, [8, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const panelW = p ? width - 160 : 620;
  const panelH = p ? 620 : 700;

  // Feathered edge so the photo dissolves into the washi backdrop instead of
  // sitting in a hard-edged frame — reads as part of the scene, not a paste-in.
  const featherMask =
    "radial-gradient(120% 120% at 50% 45%, #000 55%, rgba(0,0,0,0.55) 78%, transparent 100%)";

  const imagePanel = imageUrl ? (
    <div
      style={{
        width: panelW,
        height: panelH,
        flexShrink: 0,
        position: "relative",
        opacity: panelReveal,
        transform: `translateX(${(1 - panelReveal) * (p ? 0 : 60)}px) translateY(${(1 - panelReveal) * (p ? 40 : 0)}px)`,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          maskImage: featherMask,
          WebkitMaskImage: featherMask,
        }}
      >
        <Img
          src={imageUrl}
          style={{
            width: "100%",
            height: "100%",
            // Zoom-out (imageZoom < 1) keeps the whole image visible instead of
            // cropping — matches the newspaper template's fit handling.
            objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
            objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
            transform: `scale(${imageZoom ?? 1})`,
            transformOrigin: (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
          }}
        />
      </div>
      {/* Plum→washi wash over the photo so it settles into the palette. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `linear-gradient(135deg, ${hexToRgba(SAKURA.plum, 0.18)}, transparent 42%), linear-gradient(0deg, ${hexToRgba(crimson, 0.1)}, transparent 55%)`,
          mixBlendMode: "multiply",
          maskImage: featherMask,
          WebkitMaskImage: featherMask,
        }}
      />
    </div>
  ) : null;

  return (
    <SakuraScene
      backdrop="washi_radial"
      entranceLayout="sakura_text_narration"
      bgColor={bgColor}
      accentColor={crimson}
      side="right"
      dur={dur}
      petals={p ? 9 : 12}
      petalIntensity={0.5}
      petalSeed={77}
      petalMode="drift"
      petalsBehind
      ambient="mist_gold"
      chrome={
        <>
          {/* Cherry tree grows behind the copy — full-scene backdrop motif that
              rises from the bottom-center and spreads its canopy across the
              whole frame, self-dimming where branches pass over the text block. */}
          <GrowingSakuraTree
            width={width}
            height={height}
            grow={treeGrow}
            seed={77}
            depth={p ? 9 : 10}
            spreadAngle={p ? 30 : 34}
            shrink={0.78}
            trunkLen={height * (p ? 0.24 : 0.2)}
            originX={p ? width / 2 : width * 0.52}
            originY={height + height * 0.02}
            opacity={p ? 0.2 : 0.22}
            windStyle="breeze"
            shed
            shedIntensity={0.8}
            textFadeRect={
              // Region the copy occupies (vertically centered block); branches
              // and blossoms fade to ~18% here so text stays legible.
              p
                ? { x: width * 0.06, y: height * 0.34, w: width * 0.88, h: height * 0.32 }
                : { x: width * 0.07, y: height * 0.28, w: width * 0.6, h: height * 0.44 }
            }
            textFadeOpacity={0.18}
          />
          <KamonWatermark
            cx={p ? width / 2 : width * 0.74}
            cy={height / 2}
            r={p ? 420 : 360}
            color={crimson}
            opacity={0.045}
          />
        </>
      }
    >
      {/* Off-center: headline block anchored left, not centered. With a
          supporting image the scene becomes a row (text left / image right; in
          portrait a column with the image below); without one the copy keeps
          its original full-width left-anchored composition. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: imageUrl ? (p ? "column" : "row") : "column",
          alignItems: "center",
          justifyContent: "center",
          gap: imageUrl ? (p ? 50 : 80) : 0,
          padding: imageUrl
            ? p
              ? "130px 80px"
              : "110px 110px"
            : p
              ? "160px 90px"
              : "110px 130px",
          boxSizing: "border-box",
        }}
      >
      <div
        style={{
          flex: imageUrl ? 1 : undefined,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: !imageUrl && p ? "center" : "flex-start",
          justifyContent: "center",
          textAlign: !imageUrl && p ? "center" : "left",
          maxWidth: imageUrl ? undefined : p ? "100%" : "64%",
        }}
      >
        {/* Eyebrow */}
        {eyebrow ? (
          <div
            style={{
              fontFamily: fontFamily ?? SAKURA_BODY_FONT,
              fontSize: eyebrowPx,
              color: SAKURA.gold,
              letterSpacing: "0.55em",
              textTransform: "uppercase",
              textIndent: "0.55em",
              marginBottom: 26,
              opacity: Math.min(1, eyebrowSpring * 1.4),
              transform: `scale(${eyebrowSpring})`,
              transformOrigin: p ? "50% 50%" : "0% 50%",
            }}
          >
            {eyebrow}
          </div>
        ) : null}

        {/* Headline — per-word bouncy zoom-in, then a soft breathing zoom */}
        <h1
          style={{
            fontFamily: fontFamily ?? SAKURA_DISPLAY_FONT,
            fontWeight: 700,
            fontSize: titlePx,
            color: ink,
            lineHeight: 1.2,
            margin: "0 0 26px 0",
            transform: `scale(${breathe})`,
            transformOrigin: p ? "50% 50%" : "0% 50%",
          }}
        >
          {words.map((w, i) => (
            <span key={i} style={wordStyle(i)}>
              {w}
            </span>
          ))}
        </h1>

        {/* Brush underline */}
        <div style={{ marginBottom: 32 }}>
          <BrushUnderline width={p ? 220 : 260} color={crimson} startFrame={headEnd - 4} durationFrames={14} />
        </div>

        {/* Body */}
        <p
          style={{
            fontFamily: fontFamily ?? SAKURA_BODY_FONT,
            fontSize: bodyPx,
            color: hexToRgba(ink, 0.78),
            lineHeight: 1.8,
            letterSpacing: "0.01em",
            maxWidth: p ? 820 : 1000,
            margin: 0,
            opacity: bodyReveal,
            transform: `translateY(${(1 - bodyReveal) * 16}px)`,
          }}
        >
          {body}
        </p>
      </div>
        {imagePanel}
      </div>
    </SakuraScene>
  );
};
