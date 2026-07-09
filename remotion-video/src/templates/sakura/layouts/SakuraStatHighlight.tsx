import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring, Img } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SakuraScene,
  SoftPetal,
  BrushUnderline,
  SakuraBlossomCanopy,
  hexToRgba,
  sakuraRand,
  readableTextColor,
  deriveDarkWash,
} from "../sakuraStyle";

/**
 * Stat scene: the number sits dead-center while a burst of sakura blossoms POPS
 * and sprouts outward from behind it — each flower springs from scale 0 with a
 * staggered delay so they appear to bloom outward in a shockwave. Label +
 * context sit centered beneath.
 */
export const SakuraStatHighlight: React.FC<SceneLayoutProps> = (props) => {
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
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  // Dark backdrop: accent drives the hero number; text drives the context copy,
  // but a near-black text color would vanish on dark, so fall back to light washi.
  const crimson = accentColor || SAKURA.crimson;
  const ink = readableTextColor(textColor, "dark");
  // The image scrim tints from the user's bgColor (same wash the quote/intro
  // use), so changing the background color re-tints the photo vignette instead
  // of it staying fixed-plum.
  const darkWash = deriveDarkWash(bgColor); // { center, edge }

  // Never fall back to prose (e.g. an editor's "Hello World" title) for the big
  // number — the stat scene must always read as a NUMBER. Only accept `title` as
  // the stat if it actually contains a digit; otherwise show a numeric default.
  const rawStat = (props as any).stat;
  const titleHasDigit = typeof title === "string" && /\d/.test(title);
  const stat = rawStat != null && String(rawStat).length > 0
    ? String(rawStat)
    : titleHasDigit
      ? title
      : "100%";
  const statLabel = (props as any).statLabel ?? "";
  const context = (props as any).context ?? narration ?? "";

  const statPx = titleFontSize ?? (p ? 190 : 240);
  const contextPx = descriptionFontSize ?? (p ? 28 : 24);
  // Stat label (gold caps caption under the number) scales off the context/body
  // size so it tracks the display-text slider.
  const statLabelPx = Math.max(16, Math.round(contextPx * 1.0));

  const cx = width / 2;
  const cy = height / 2 - (p ? 40 : 30);

  // ── Reveal choreography ────────────────────────────────────────────────────
  // 1. A tight cluster of blossoms gathers over the center, hiding the number.
  // 2. At BURST they bloom apart outward — slow and graceful — and the number
  //    eases in through the gap they leave behind. The pop of the flowers IS the
  //    reveal, but it should read as an unfolding, not a snap.
  const BURST = 22; // frame the flower ball starts to bloom apart

  // The flower cluster gathers gently, holds, then drifts apart. Softer springs
  // (higher damping, lower stiffness) keep both moves fluid instead of snappy.
  const gather = spring({ frame, fps, config: { damping: 18, stiffness: 70 }, from: 0, to: 1 });
  // `burst` goes 0→1 slowly across a wide window so the flowers float outward
  // rather than being flung. mass>1 + high damping = a slow, settled expansion.
  const burst = spring({
    frame: Math.max(0, frame - BURST),
    fps,
    config: { damping: 20, stiffness: 40, mass: 1.4, overshootClamping: true },
    from: 0,
    to: 1,
  });

  // Number stays hidden behind the cluster, then eases in as the flowers scatter.
  // A well-damped spring (no overshoot kick) so the number settles smoothly.
  const statSpring = spring({
    frame: Math.max(0, frame - BURST),
    fps,
    config: { damping: 16, stiffness: 90, mass: 1 },
    from: 0.7,
    to: 1,
  });
  // one gentle breath of scale after it lands — subtle, not a shockwave kick
  const punch = interpolate(frame, [BURST, BURST + 8, BURST + 20], [1, 1.05, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => t * t * (3 - 2 * t),
  });
  const statScale = statSpring * punch;
  const statOpacity = interpolate(frame, [BURST, BURST + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  const numericValue = parseFloat(stat.replace(/[^0-9.]/g, ""));
  const isNumeric = !isNaN(numericValue) && stat.replace(/[^0-9.]/g, "").length > 0;
  const suffix = isNumeric ? stat.replace(/[0-9.,]/g, "") : "";
  const countProgress = interpolate(frame, [BURST, BURST + 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const displayedStat = isNumeric
    ? Math.round(numericValue * countProgress).toLocaleString() + suffix
    : stat;

  // ── Flower cluster → explosion ─────────────────────────────────────────────
  // Each flower has a "gathered" position (tight over center) and an "exploded"
  // position (flung far out). We lerp gathered→exploded on `burst`.
  const gatherR = p ? 95 : 90;          // radius of the tight cover cluster
  const explodeR1 = p ? 340 : 360;
  const explodeR2 = p ? 500 : 560;
  const explodeR0 = p ? 200 : 200;
  const flowers = React.useMemo(() => {
    const out: Array<{
      ga: number; gr: number; ea: number; er: number;
      r: number; rot: number; color: string; stagger: number; sway: number;
    }> = [];
    const rings = [
      { count: p ? 5 : 6, explodeR: explodeR0, size: 30 },
      { count: p ? 9 : 12, explodeR: explodeR1, size: 26 },
      { count: p ? 12 : 16, explodeR: explodeR2, size: 20 },
    ];
    rings.forEach((ring, ri) => {
      for (let i = 0; i < ring.count; i++) {
        const s = ri * 50 + i * 7.3;
        const a = (i / ring.count) * Math.PI * 2 + ri * 0.4 + sakuraRand(s, 6) * 0.3;
        const jitter = 0.85 + sakuraRand(s, 1) * 0.3;
        out.push({
          // gathered: packed tight near center (small jittered radius)
          ga: a,
          gr: gatherR * (0.15 + sakuraRand(s, 7) * 0.85) * (ri === 0 ? 0.4 : 1),
          // exploded: flung outward along the same angle
          ea: a,
          er: ring.explodeR * jitter,
          r: ring.size * (0.85 + sakuraRand(s, 2) * 0.6),
          rot: sakuraRand(s, 3) * 360,
          color: [SAKURA.blush, SAKURA.deepBlush, SAKURA.mist][i % 3],
          // slight per-flower stagger so the explosion has grit, not a rigid ring
          stagger: sakuraRand(s, 4) * 0.12,
          sway: sakuraRand(s, 5) * Math.PI * 2,
        });
      }
    });
    return out;
  }, [p, gatherR, explodeR0, explodeR1, explodeR2]);

  const labelReveal = interpolate(frame, [BURST + 18, BURST + 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  const contextReveal = interpolate(frame, [BURST + 28, BURST + 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });

  // A dense blossom canopy blooms as a band across the bottom of the frame —
  // boughs draw then blossoms unfurl in a slow, smooth wave, then it sways. The
  // stat number/label/context sit above it in the vertical center.
  const canopyGrow = interpolate(frame, [8, dur - 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    // smootherstep — eased at both ends, no abrupt in/out
    easing: (t) => t * t * t * (t * (t * 6 - 15) + 10),
  });

  // Optional supporting image: a soft CIRCULAR vignette centered behind the
  // number — this scene is centered on a dark spotlight, so a side panel would
  // not fit. The photo emerges from behind the exploding blossoms (keyed to the
  // same `burst` reveal) and sits at reduced opacity so the crimson number stays
  // the hero. Radial feather + a plum scrim keep the digits legible over it.
  const vignetteSize = p ? 420 : 560;
  const vignetteReveal = interpolate(frame, [BURST, BURST + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  const vignetteMask =
    "radial-gradient(circle at 50% 50%, #000 42%, rgba(0,0,0,0.6) 66%, transparent 84%)";
  const imageVignette = imageUrl ? (
    <div
      style={{
        position: "absolute",
        left: cx - vignetteSize / 2,
        top: cy - vignetteSize / 2,
        width: vignetteSize,
        height: vignetteSize,
        pointerEvents: "none",
        opacity: vignetteReveal * 0.42,
        transform: `scale(${interpolate(vignetteReveal, [0, 1], [0.86, 1])})`,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          overflow: "hidden",
          maskImage: vignetteMask,
          WebkitMaskImage: vignetteMask,
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
      {/* Background-tinted scrim over the photo so the number reads cleanly on top. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `radial-gradient(circle at 50% 50%, ${hexToRgba(darkWash.center, 0.55)}, ${hexToRgba(darkWash.center, 0.15)} 70%, transparent)`,
          maskImage: vignetteMask,
          WebkitMaskImage: vignetteMask,
        }}
      />
    </div>
  ) : null;

  return (
    <SakuraScene
      backdrop="spotlight"
      entranceLayout="sakura_stat_highlight"
      bgColor={bgColor}
      accentColor={crimson}
      dur={dur}
      petals={p ? 8 : 12}
      petalIntensity={0.7}
      petalSeed={57}
      animateEntrance={false}
      chrome={
        <>
          {/* Dense blossom canopy blooming as a band across the bottom edge —
              boughs arch across the width, blossoms unfurling in a slow wave. */}
          <SakuraBlossomCanopy
            width={width}
            height={height}
            grow={canopyGrow}
            orientation="bottom"
            windStyle="breeze"
            petalColors={[SAKURA.blush, SAKURA.mist, SAKURA.deepBlush, SAKURA.crimson]}
            opacity={0.85}
            bandHeight={p ? height * 0.3 : height * 0.32}
            textFadeRect={
              p
                ? { x: width * 0.06, y: height * 0.2, w: width * 0.88, h: height * 0.6 }
                : { x: width * 0.14, y: height * 0.22, w: width * 0.72, h: height * 0.56 }
            }
            textFadeOpacity={0.16}
          />
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
          {/* Flower ball gathers over the number, then EXPLODES apart to reveal it */}
          {flowers.map((f, i) => {
            // Appear (scale up) as the cluster gathers over center.
            const appear = interpolate(gather, [0, 0.6], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            // Per-flower explosion progress, staggered slightly for grit.
            const bRaw = Math.max(0, Math.min(1, (burst - f.stagger) / (1 - f.stagger || 1)));
            // Ease-out the flight so flowers decelerate as they drift out — they
            // float apart and settle rather than being flung to a hard stop.
            const b = 1 - Math.pow(1 - bRaw, 2.2);
            // radius + angle lerp: tight cluster → drifted outward
            const radius = f.gr + (f.er - f.gr) * b;
            // gentle perpetual sway, scaled by how far out the flower has drifted
            const drift = Math.sin(frame * 0.03 + f.sway) * 7 * b;
            const fx = cx + Math.cos(f.ga) * radius;
            const fy = cy + Math.sin(f.ga) * radius + drift;
            // Flowers fade as they drift out so they clear the number — a smoother
            // fade curve so they don't blink off all at once.
            const opacity = appear * (1 - Math.pow(b, 1.6) * 0.92);
            // Swell a touch as they open, then ease down as they scatter.
            const scale = appear * (1 + b * 0.35 - Math.pow(b, 2) * 0.55);
            if (opacity <= 0.01) return null;
            return (
              <g
                key={i}
                transform={`translate(${fx}, ${fy}) scale(${scale})`}
                opacity={opacity}
              >
                <SoftPetal cx={0} cy={0} r={f.r} rotation={f.rot + b * 100} color={f.color} />
              </g>
            );
          })}
          </svg>
        </>
      }
    >
      {/* Circular photo vignette behind the number (only when an image is set) */}
      {imageVignette}
      {/* Centered: number in the middle, label + context beneath */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: p ? "150px 80px" : "80px 160px",
        }}
      >
        <div
          style={{
            fontFamily: fontFamily ?? SAKURA_DISPLAY_FONT,
            fontWeight: 700,
            fontSize: statPx,
            color: crimson,
            lineHeight: 0.95,
            letterSpacing: "0.02em",
            textShadow: `0 0 90px ${hexToRgba(crimson, 0.5)}`,
            opacity: statOpacity,
            transform: `scale(${statScale})`,
            marginBottom: p ? 40 : 30,
          }}
        >
          {displayedStat}
        </div>

        <div style={{ marginBottom: 22 }}>
          <BrushUnderline width={p ? 260 : 240} color={SAKURA.gold} startFrame={BURST + 16} durationFrames={18} opacity={0.9} />
        </div>

        {statLabel ? (
          <div
            style={{
              fontFamily: fontFamily ?? SAKURA_BODY_FONT,
              fontSize: statLabelPx,
              color: SAKURA.gold,
              letterSpacing: "0.4em",
              textTransform: "uppercase",
              textIndent: "0.4em",
              opacity: labelReveal,
              transform: `translateY(${(1 - labelReveal) * 12}px)`,
              marginBottom: 20,
            }}
          >
            {statLabel}
          </div>
        ) : null}

        {context ? (
          <div
            style={{
              fontFamily: fontFamily ?? SAKURA_BODY_FONT,
              fontStyle: "italic",
              fontSize: contextPx,
              color: hexToRgba(ink, 0.85),
              lineHeight: 1.65,
              maxWidth: p ? 760 : 820,
              opacity: contextReveal,
              transform: `translateY(${(1 - contextReveal) * 12}px)`,
            }}
          >
            {context}
          </div>
        ) : null}
      </div>
    </SakuraScene>
  );
};
