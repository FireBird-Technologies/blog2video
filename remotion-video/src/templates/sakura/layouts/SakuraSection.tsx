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
  SoftPetal,
  GrowingSakuraTree,
  hexToRgba,
} from "../sakuraStyle";

export const SakuraSection: React.FC<SceneLayoutProps> = (props) => {
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

  const chapterKanji = (props as any).chapterKanji ?? "";
  const chapterLabel = (props as any).chapterLabel ?? "";
  const headline = (props as any).headline ?? title ?? "";
  const body = (props as any).body ?? narration ?? "";

  const crimson = accentColor || SAKURA.crimson;
  const ink = textColor || SAKURA.ink;

  const titlePx = titleFontSize ?? (p ? 58 : 64);
  const bodyPx = descriptionFontSize ?? (p ? 26 : 22);

  // Left accent bar draws down
  const barGrow = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  // Vertical eyebrow line
  const eyebrowLine = interpolate(frame, [4, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eyebrowOpacity = interpolate(frame, [2, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Headline
  const headlineSpring = spring({ frame: Math.max(0, frame - 6), fps, config: { damping: 22, stiffness: 90 } });
  const headlineOpacity = interpolate(frame, [6, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Underline + petal dot
  const underline = interpolate(frame, [14, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });

  // Body copy
  const bodyReveal = interpolate(frame, [20, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });

  // Image panel slides in
  const panelReveal = interpolate(frame, [8, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  const panelW = p ? width - 160 : 620;
  // Cap the panel to the height actually available inside the scene padding so a
  // SHORTENED scene never overflows / "amplifies" the image past the frame — the
  // panel shrinks with the canvas instead of staying a fixed 700px box.
  const vPad = p ? 130 : 90; // matches the container's top/bottom padding below
  const panelH = Math.min(p ? 620 : 700, height - vPad * 2);

  // Twin windswept cherry trees root in the two bottom corners and grow inward
  // on a slant across the frame.
  const treeGrow = interpolate(frame, [6, dur - 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2.2),
  });

  const textBlock = (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        minWidth: 0,
      }}
    >
      {/* Eyebrow: vertical kanji + descending line + roman label */}
      {(chapterKanji || chapterLabel) && (
        <div style={{ display: "flex", gap: 22, marginBottom: 34, opacity: eyebrowOpacity }}>
          {chapterKanji ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  fontFamily: SAKURA_DISPLAY_FONT,
                  fontSize: p ? 22 : 19,
                  color: crimson,
                  letterSpacing: "0.25em",
                  writingMode: "vertical-rl",
                  textOrientation: "mixed",
                }}
              >
                {chapterKanji}
              </div>
              <div
                style={{
                  width: 1,
                  height: 78 * eyebrowLine,
                  background: `linear-gradient(to bottom, ${crimson}, transparent)`,
                }}
              />
            </div>
          ) : null}
          {chapterLabel ? (
            <div
              style={{
                fontFamily: SAKURA_BODY_FONT,
                fontSize: p ? 19 : 16,
                color: hexToRgba(ink, 0.6),
                letterSpacing: "0.5em",
                textTransform: "uppercase",
                paddingTop: 6,
              }}
            >
              {chapterLabel}
            </div>
          ) : null}
        </div>
      )}

      {/* Headline */}
      <h1
        style={{
          fontFamily: fontFamily ?? SAKURA_DISPLAY_FONT,
          fontWeight: 700,
          fontSize: titlePx,
          color: ink,
          lineHeight: 1.16,
          letterSpacing: "-0.01em",
          margin: "0 0 24px 0",
          opacity: headlineOpacity,
          transform: `translateY(${interpolate(headlineSpring, [0, 1], [22, 0])}px)`,
        }}
      >
        {headline}
      </h1>

      {/* Crimson underline ending in a blossom */}
      <svg width={220} height={24} viewBox="0 0 220 24" style={{ overflow: "visible", marginBottom: 26 }}>
        <line x1={0} y1={12} x2={150 * underline} y2={12} stroke={crimson} strokeWidth={2.5} />
        <SoftPetal cx={168} cy={12} r={10} color={crimson} bloomProgress={underline} />
      </svg>

      {/* Body */}
      <p
        style={{
          fontFamily: SAKURA_BODY_FONT,
          fontSize: bodyPx,
          color: hexToRgba(ink, 0.75),
          lineHeight: 1.8,
          letterSpacing: "0.01em",
          margin: 0,
          maxWidth: p ? undefined : imageUrl ? 620 : 900,
          opacity: bodyReveal,
          transform: `translateY(${(1 - bodyReveal) * 16}px)`,
        }}
      >
        {body}
      </p>
    </div>
  );

  // Feathered edge so the photo dissolves into the washi backdrop instead of
  // sitting in a hard-edged frame — reads as part of the scene, not a paste-in.
  const featherMask =
    "radial-gradient(120% 120% at 50% 45%, #000 55%, rgba(0,0,0,0.55) 78%, transparent 100%)";

  // When the image is smaller than the panel (zoomed out → letterboxed with
  // `contain`) the feather mask + wash would paint a visible box over the empty
  // letterbox area — reading as a placeholder backing behind the image. So only
  // apply the feather mask and the plum wash when the image actually FILLS the
  // panel (`cover`); when it's contained, show just the bare image, no box.
  const imageFills = (imageZoom ?? 1) >= 1;

  // Only render an image panel when a source is actually provided. With no
  // image the text block spans the frame and the growing cherry trees carry the
  // composition — no placeholder box, tree panel or brackets appear.
  const imagePanel = imageUrl ? (
    <div
      style={{
        width: panelW,
        height: panelH,
        maxHeight: "100%",
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
          maskImage: imageFills ? featherMask : undefined,
          WebkitMaskImage: imageFills ? featherMask : undefined,
        }}
      >
        <Img
          src={imageUrl}
          style={{
            width: "100%",
            height: "100%",
            // Zoom-out (imageZoom < 1) keeps the whole image visible instead of
            // cropping — matches the newspaper template's fit handling.
            objectFit: imageFills ? "cover" : "contain",
            objectPosition: imageFills ? (imageObjectPosition ?? "50% 50%") : "center",
            transform: `scale(${imageZoom ?? 1})`,
            transformOrigin: imageFills ? (imageObjectPosition ?? "50% 50%") : "center center",
          }}
        />
      </div>
      {/* Plum→washi wash over the photo so it settles into the palette. Only
          drawn when the image fills the panel — a contained (smaller) image
          shows bare, with no box painted over its empty margins. */}
      {imageFills && (
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
      )}
    </div>
  ) : null;

  return (
    <SakuraScene
      backdrop="ink_corner"
      entranceLayout="sakura_section"
      bgColor={bgColor}
      accentColor={crimson}
      side="left"
      dur={dur}
      petals={p ? 12 : 18}
      petalIntensity={0.6}
      petalSeed={11}
      petalMode="drift"
      petalsBehind
      ambient="mist_gold"
      chrome={
        <>
          {/* Twin windswept shidarezakura root in the two bottom corners and
              grow inward on a slant — the right tree sweeps up-and-left, the
              left tree sweeps up-and-right. Dimmed where the copy sits so the
              text stays legible. */}
          <GrowingSakuraTree
            width={width}
            height={height}
            grow={treeGrow}
            variant="windswept"
            lean="left"
            windStyle="breeze"
            seed={23}
            depth={p ? 8 : 9}
            spreadAngle={p ? 28 : 30}
            originX={p ? width * 0.94 : width * 0.98}
            originY={height * 1.02}
            opacity={p ? 0.18 : 0.2}
            textFadeRect={
              p
                ? { x: width * 0.06, y: height * 0.36, w: width * 0.88, h: height * 0.3 }
                : { x: width * 0.05, y: height * 0.2, w: width * 0.58, h: height * 0.62 }
            }
            textFadeOpacity={0.16}
          />
          <GrowingSakuraTree
            width={width}
            height={height}
            grow={treeGrow}
            variant="windswept"
            lean="right"
            windStyle="breeze"
            seed={47}
            depth={p ? 8 : 9}
            spreadAngle={p ? 28 : 30}
            originX={p ? width * 0.06 : width * 0.02}
            originY={height * 1.02}
            opacity={p ? 0.18 : 0.2}
            textFadeRect={
              p
                ? { x: width * 0.06, y: height * 0.36, w: width * 0.88, h: height * 0.3 }
                : { x: width * 0.05, y: height * 0.2, w: width * 0.58, h: height * 0.62 }
            }
            textFadeOpacity={0.16}
          />
          {/* Left accent band: crimson → deepBlush → transparent */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 10,
              height: `${barGrow * 100}%`,
              background: `linear-gradient(to bottom, ${crimson}, ${SAKURA.deepBlush} 65%, transparent)`,
            }}
          />
          {/* Kamon watermark top-right */}
          <KamonWatermark cx={width - (p ? 110 : 150)} cy={p ? 130 : 140} r={p ? 90 : 110} color={crimson} opacity={0.09} />
          {/* Blossom pair near the kamon */}
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <SoftPetal cx={width - 90} cy={64} r={26} rotation={0} color={SAKURA.blush} opacity={0.5} />
            <SoftPetal cx={width - 46} cy={100} r={17} rotation={30} color={SAKURA.mist} opacity={0.38} />
          </svg>
        </>
      }
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: p ? "column" : "row",
          alignItems: "center",
          gap: p ? 50 : 90,
          padding: p ? "130px 80px" : "90px 120px 90px 110px",
          boxSizing: "border-box",
        }}
      >
        {textBlock}
        {imagePanel}
      </div>
    </SakuraScene>
  );
};
