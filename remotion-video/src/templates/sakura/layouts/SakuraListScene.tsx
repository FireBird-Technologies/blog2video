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
  SakuraBlossomCanopy,
  hexToRgba,
} from "../sakuraStyle";

export const SakuraListScene: React.FC<SceneLayoutProps> = (props) => {
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
  const { width, height, fps } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  const headline = (props as any).headline ?? title ?? "";
  const rawItems: string[] = (props as any).items ?? [];
  // When no explicit items are supplied, break the narration into individual
  // sentence-bullets so the scene fills with several points that load in one
  // by one, instead of a single lonely line.
  const narrationBullets = (narration ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const items =
    rawItems.length > 0
      ? rawItems.slice(0, 6)
      : narrationBullets.slice(0, 6);

  const crimson = accentColor || SAKURA.crimson;
  const ink = textColor || SAKURA.ink;

  const titlePx = titleFontSize ?? (p ? 58 : 58);
  // Larger list items so the list reads as the focus of the scene
  const itemPx = descriptionFontSize ?? (p ? 40 : 38);

  // Headline reveal
  const headlineReveal = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  // Per-item stagger — each point pops in fast, one after another, turn by turn.
  // Snappy: bullets start almost immediately and arrive ~8-10 frames apart so
  // the whole list is loaded within the first ~1.5s. Clamp so it still fits the
  // scene when there are many items.
  const startAt = 8;
  const revealWindow = Math.max(1, dur * 0.55 - startAt);
  const STEP = Math.min(
    10,
    Math.max(8, items.length > 1 ? revealWindow / items.length : 9),
  );
  const itemStart = (i: number) => startAt + i * STEP;

  // Girly bouncy pop for the flower bullet: overshoots then settles, so each
  // blossom springs into place with a playful little bounce — snappier config.
  const bulletSpring = (i: number) =>
    spring({
      frame: frame - itemStart(i),
      fps,
      config: { damping: 10, stiffness: 200, mass: 0.6 },
    });
  const bulletProgress = (i: number) =>
    interpolate(frame, [itemStart(i), itemStart(i) + 10], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: (t) => 1 - Math.pow(1 - t, 2),
    });
  // Text springs in just after its flower, sliding + bouncing from the left.
  const textSpring = (i: number) =>
    spring({
      frame: frame - (itemStart(i) + 3),
      fps,
      config: { damping: 13, stiffness: 190, mass: 0.5 },
    });
  const textProgress = (i: number) =>
    interpolate(frame, [itemStart(i) + 3, itemStart(i) + 13], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: (t) => 1 - Math.pow(1 - t, 2),
    });

  // Connector line draws down the bullet column, tracking the item cadence
  const lineProgress = interpolate(
    frame,
    [24, 24 + items.length * STEP],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // A dense blossom canopy blooms as a wall down the empty right side (opposite
  // the left list rail) — boughs draw then blossoms unfurl in a slow, smooth
  // wave across the scene, then it sways.
  const canopyGrow = interpolate(frame, [8, dur - 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    // smootherstep — eased at both ends, no abrupt in/out
    easing: (t) => t * t * t * (t * (t * 6 - 15) + 10),
  });

  const bulletR = p ? 18 : 17;
  // With a short list, breathe out the rows and scale up the type so the column
  // fills the frame instead of clustering at the top-left and reading empty.
  const sparse = items.length <= 2;
  const rowGap = sparse ? (p ? 72 : 66) : p ? 46 : 42;
  const effItemPx = sparse ? Math.round(itemPx * 1.28) : itemPx;

  // Optional supporting image: a feather-masked panel down the RIGHT side (the
  // list keeps the left rail). When present it takes the right side that the
  // blossom canopy otherwise fills, so the canopy is suppressed below. In
  // portrait the panel sits along the bottom. Only rendered when provided.
  const panelReveal = interpolate(frame, [8, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const featherMask =
    "radial-gradient(120% 120% at 50% 45%, #000 55%, rgba(0,0,0,0.55) 78%, transparent 100%)";
  const imagePanel = imageUrl ? (
    <div
      style={{
        position: "absolute",
        right: p ? "50%" : 0,
        bottom: p ? 0 : "auto",
        top: p ? "auto" : 0,
        transform: p ? "translateX(50%)" : "none",
        width: p ? width - 160 : width * 0.36,
        height: p ? height * 0.3 : "100%",
        opacity: panelReveal,
        pointerEvents: "none",
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
            objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
            objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
            transform: `scale(${imageZoom ?? 1})`,
            transformOrigin: (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
          }}
        />
      </div>
      {/* Washi wash so the photo settles into the light backdrop / palette. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(270deg, ${hexToRgba(SAKURA.washi, 0.15)}, transparent 45%), linear-gradient(0deg, ${hexToRgba(crimson, 0.08)}, transparent 55%)`,
          mixBlendMode: "multiply",
          maskImage: featherMask,
          WebkitMaskImage: featherMask,
        }}
      />
    </div>
  ) : null;

  return (
    <SakuraScene
      backdrop="ink_corner"
      entranceLayout="sakura_list_scene"
      bgColor={bgColor}
      accentColor={crimson}
      side="right"
      dur={dur}
      petals={p ? 10 : 14}
      petalIntensity={0.55}
      petalSeed={67}
      petalMode="float"
      petalsBehind
      ambient="mist_gold"
      chrome={
        <>
          {/* Dense blossom canopy standing as a wall down the right edge — the
              same effect as the stat scene, oriented vertically. Suppressed when
              a supporting image occupies the right side so they don't clash. */}
          {!imageUrl && (
            <SakuraBlossomCanopy
              width={width}
              height={height}
              grow={canopyGrow}
              orientation="right"
              windStyle="breeze"
              petalColors={[SAKURA.blush, SAKURA.mist, SAKURA.deepBlush, SAKURA.crimson]}
              opacity={0.85}
              bandHeight={p ? width * 0.4 : width * 0.42}
              textFadeRect={
                p
                  ? { x: width * 0.06, y: height * 0.06, w: width * 0.88, h: height * 0.72 }
                  : { x: width * 0.02, y: height * 0.08, w: width * 0.7, h: height * 0.84 }
              }
              textFadeOpacity={0.16}
            />
          )}
          {/* Image panel (only when provided) — feathered into the right side. */}
          {imagePanel}
          <KamonWatermark
            cx={width - (p ? 110 : 200)}
            cy={height / 2}
            r={p ? 90 : 150}
            color={crimson}
            opacity={0.06}
          />
        </>
      }
    >
      {/* Left rail composition: list occupies the left ~55%, kamon breathes on
          the right. With a supporting image on the right, the rail narrows so
          the list clears the photo (in portrait the image drops to the bottom,
          so the rail keeps full width but leaves bottom room). */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: p
            ? imageUrl
              ? "110px 80px 340px 80px"
              : "120px 80px"
            : "90px 130px",
          maxWidth: p ? "100%" : imageUrl ? "60%" : "72%",
          boxSizing: "border-box",
        }}
      >
        {/* Headline */}
        {headline ? (
          <h1
            style={{
              fontFamily: fontFamily ?? SAKURA_DISPLAY_FONT,
              fontWeight: 700,
              fontSize: titlePx,
              color: ink,
              lineHeight: 1.18,
              margin: `0 0 ${p ? 20 : 16}px 0`,
              opacity: headlineReveal,
              transform: `translateY(${(1 - headlineReveal) * 18}px)`,
            }}
          >
            {headline}
          </h1>
        ) : null}

        {/* Crimson underline */}
        <svg width={170} height={20} viewBox="0 0 170 20" style={{ overflow: "visible", marginBottom: p ? 46 : 40 }}>
          <line x1={0} y1={10} x2={118 * headlineReveal} y2={10} stroke={crimson} strokeWidth={2.5} />
          <SoftPetal cx={136} cy={10} r={9} color={crimson} bloomProgress={headlineReveal} />
        </svg>

        {/* Items with blooming bullet blossoms and connector line */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: rowGap }}>
          {/* Connector line behind bullets */}
          <div
            style={{
              position: "absolute",
              left: bulletR,
              top: bulletR,
              width: 1.5,
              height: `calc(${lineProgress * 100}% - ${bulletR * 2}px)`,
              background: `linear-gradient(to bottom, ${hexToRgba(crimson, 0.45)}, ${hexToRgba(SAKURA.deepBlush, 0.25)})`,
            }}
          />
          {items.map((item, i) => {
            const bp = bulletProgress(i);
            const bs = bulletSpring(i);
            const tp = textProgress(i);
            const ts = textSpring(i);
            // Bouncy overshoot scale (spring passes >1 then settles) + girly twirl.
            const bulletScale = bs;
            const bulletSpin = interpolate(bs, [0, 1], [-120, i * 36], {
              extrapolateRight: "clamp",
            });
            return (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: p ? 30 : 30 }}>
                <svg
                  width={bulletR * 2 + 4}
                  height={bulletR * 2 + 4}
                  viewBox={`0 0 ${bulletR * 2 + 4} ${bulletR * 2 + 4}`}
                  style={{
                    overflow: "visible",
                    flexShrink: 0,
                    marginTop: 2,
                    transform: `scale(${bulletScale})`,
                    transformOrigin: "center",
                  }}
                >
                  <SoftPetal
                    cx={bulletR + 2}
                    cy={bulletR + 2}
                    r={bulletR}
                    rotation={bulletSpin}
                    color={i % 2 === 0 ? SAKURA.deepBlush : SAKURA.blush}
                    centerColor={i % 2 === 0 ? SAKURA.blush : SAKURA.deepBlush}
                    bloomProgress={bp}
                  />
                </svg>
                <div
                  style={{
                    fontFamily: SAKURA_BODY_FONT,
                    fontSize: effItemPx,
                    fontWeight: 500,
                    // Fuller ink so the copy reads confidently instead of pale.
                    color: hexToRgba(ink, 0.95),
                    lineHeight: 1.5,
                    opacity: tp,
                    // Springy slide-in from the left with a soft bounce settle.
                    transform: `translateX(${(1 - ts) * 34}px)`,
                    paddingTop: 2,
                  }}
                >
                  {item}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SakuraScene>
  );
};
