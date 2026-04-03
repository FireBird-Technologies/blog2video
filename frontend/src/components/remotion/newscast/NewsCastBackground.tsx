import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";

const DEFAULT_BG = "#060614";

const WORLD_TOPOLOGY_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type PixelDot = {
  x: number;
  y: number;
  phase: number;
  speed: number;
  bias: number;
  radius: number;
};

type PixelConnection = {
  a: number;
  b: number;
};

type PixelParticleSeed = {
  dotIndex: number;
  phase: number;
  vx: number;
  vy: number;
  lift: number;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const fract = (v: number) => v - Math.floor(v);
const noise1 = (v: number) => fract(Math.sin(v * 12.9898 + 78.233) * 43758.5453);

const PIXEL_DOTS: PixelDot[] = (() => {
  const dots: PixelDot[] = [];
  let candidate = 0;
  for (let y = 0.12; y <= 0.86; y += 0.018) {
    for (let x = 0.06; x <= 0.94; x += 0.012) {
      const jitterX = (noise1(candidate * 1.37) - 0.5) * 0.004;
      const jitterY = (noise1(candidate * 2.11) - 0.5) * 0.004;
      const px = x + jitterX;
      const py = y + jitterY;
      candidate += 1;
      if (noise1(candidate * 2.73) < 0.16) continue;
      dots.push({
        x: px,
        y: py,
        phase: noise1(candidate * 3.19) * Math.PI * 2,
        speed: 0.9 + noise1(candidate * 4.03) * 1.25,
        bias: 0.45 + noise1(candidate * 5.21) * 0.55,
        radius: 0.09 + noise1(candidate * 6.7) * 0.17,
      });
    }
  }
  return dots;
})();

const PIXEL_CONNECTIONS: PixelConnection[] = (() => {
  const links: PixelConnection[] = [];
  const degrees = new Array<number>(PIXEL_DOTS.length).fill(0);
  const maxLinks = 540;
  for (let i = 0; i < PIXEL_DOTS.length; i += 1) {
    if (degrees[i] >= 3) continue;
    const a = PIXEL_DOTS[i];
    for (let j = i + 1; j < Math.min(PIXEL_DOTS.length, i + 48); j += 1) {
      if (degrees[i] >= 3 || links.length >= maxLinks) break;
      if (degrees[j] >= 3) continue;
      const b = PIXEL_DOTS[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > 0.0012 || distSq < 0.00009) continue;
      if (noise1(i * 172.1 + j * 19.7) > 0.2) continue;
      links.push({ a: i, b: j });
      degrees[i] += 1;
      degrees[j] += 1;
    }
    if (links.length >= maxLinks) break;
  }
  return links;
})();

const PIXEL_PARTICLE_SEEDS: PixelParticleSeed[] = (() => {
  const seeds: PixelParticleSeed[] = [];
  const anchorIndexes = PIXEL_DOTS.map((_, i) => i).filter((i) => noise1(i * 3.7) > 0.9);
  const sample = anchorIndexes.slice(0, 38);
  sample.forEach((dotIndex, i) => {
    seeds.push({
      dotIndex,
      phase: noise1((i + 1) * 8.3),
      vx: (noise1((i + 1) * 11.1) - 0.5) * 1.5,
      vy: (noise1((i + 1) * 13.9) - 0.5) * 0.7,
      lift: 8 + noise1((i + 1) * 17.5) * 13,
    });
  });
  return seeds;
})();

export const NewsCastBackground: React.FC<{
  /** Modulates pixel-map dot brightness when variant is `pixel_map`. */
  globeOpacity?: number;
  /** `hero` / `default`: 2D starfield fallback. `pixel_map`: world-map motion graphics. */
  variant?: "hero" | "default" | "pixel_map";
  /**
   * When false, the root fill is transparent so a sibling image plate (e.g. `NewsCastLayoutImageBackground`) shows through.
   * Default true: opaque navy base `#060614`.
   */
  solidBackground?: boolean;
  /**
   * Composition timeline frame (e.g. `sequenceStartFrame + useCurrentFrame()`).
   * When set, motion is continuous across all scenes; otherwise uses local `useCurrentFrame()`.
   */
  rotationFrame?: number;
  /** Optional local frame within current scene to drive transition styling. */
  sceneFrame?: number;
  /** Optional scene duration used to derive entry/exit transition windows. */
  sceneDurationInFrames?: number;
  /** Optional scene layout id for per-scene transition profiling. */
  sceneLayoutType?: string;
}> = ({
  globeOpacity = 0.3,
  variant = "default",
  solidBackground = true,
  rotationFrame: rotationFrameProp,
  sceneFrame,
  sceneDurationInFrames,
  sceneLayoutType,
}) => {
  const sequenceFrame = useCurrentFrame();
  const frame = rotationFrameProp ?? sequenceFrame;
  const { fps } = useVideoConfig();

  if (variant === "pixel_map") {
    const tick = frame / fps;
    const localSceneFrame = sceneFrame ?? sequenceFrame;
    const sceneDuration = Math.max(1, sceneDurationInFrames ?? Math.round(fps * 6));
    const entryFrames = Math.max(8, Math.min(Math.round(fps * 0.8), Math.floor(sceneDuration * 0.22)));
    const exitFrames = Math.max(8, Math.min(Math.round(fps * 0.8), Math.floor(sceneDuration * 0.22)));
    const exitStart = Math.max(0, sceneDuration - exitFrames);
    const sceneLastFrame = Math.max(1, sceneDuration - 1);
    const entryProgress = interpolate(localSceneFrame, [0, entryFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const exitProgress = interpolate(localSceneFrame, [exitStart, sceneLastFrame], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const strongZoomLayouts = new Set([
      "segment_break",
      "anchor_narrative",
      "headline_insight",
    ]);
    const mapSlideInLayouts = new Set([
      "side_by_side_brief",
      "split_glass",
      "field_image_focus",
      "glass_image",
      "headline_insight",
      "kinetic_insight",
    ]);
    const strongZoom = sceneLayoutType ? strongZoomLayouts.has(sceneLayoutType) : false;
    const isAsiaFocusLayout = sceneLayoutType === "headline_insight";
    const isMapSlideInLayout = sceneLayoutType
      ? mapSlideInLayouts.has(sceneLayoutType)
      : false;
    const usesDarkeningOpacity = !strongZoom;
    const zoomStart = strongZoom ? 1.48 : 1.24;
    const zoomEnd = 1;
    const zoomReleaseFrames = Math.max(
      Math.round(sceneDuration * (strongZoom ? 0.68 : 0.5)),
      Math.round(fps * (strongZoom ? 2.8 : 1.8)),
    );
    const zoomReleaseProgress = interpolate(localSceneFrame, [0, zoomReleaseFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const asiaZoomStart = 2.4;
    const mapZoomStart = isAsiaFocusLayout ? asiaZoomStart : zoomStart;
    const mapZoom = mapZoomStart - (mapZoomStart - zoomEnd) * zoomReleaseProgress;
    const asiaTranslateXStart = -28;
    const asiaTranslateYStart = -10;
    const mapTranslateX = isAsiaFocusLayout ? asiaTranslateXStart * (1 - zoomReleaseProgress) : 0;
    const mapTranslateY = isAsiaFocusLayout ? asiaTranslateYStart * (1 - zoomReleaseProgress) : 0;
    const mapTransformOrigin = isAsiaFocusLayout ? "62% 44%" : "50% 50%";
    const sceneProgress = interpolate(localSceneFrame, [0, sceneLastFrame], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const briefingSlideProgress = interpolate(localSceneFrame, [0, Math.max(12, entryFrames + 6)], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const briefingSlideX = isMapSlideInLayout ? -140 * (1 - briefingSlideProgress) : 0;
    const mapEntryOpacityStart = usesDarkeningOpacity ? 0.96 : 0.82;
    const mapEntryOpacityGain = usesDarkeningOpacity ? 0.02 : 0.18;
    const mapExitOpacityDrop = usesDarkeningOpacity ? 0.22 : 0.16;
    const progressiveDarkenDrop = usesDarkeningOpacity ? sceneProgress * 0.3 : 0;
    const mapSceneOpacity =
      mapEntryOpacityStart +
      entryProgress * mapEntryOpacityGain -
      progressiveDarkenDrop -
      exitProgress * mapExitOpacityDrop;
    const sceneOpacityEnvelope = usesDarkeningOpacity
      ? clamp01(1 - sceneProgress * 0.28 - exitProgress * 0.1)
      : 1;
    const mapDarkPhaseOpacity = (1 - entryProgress) * 0.2 + exitProgress * 0.24;
    const continentFocus = 0.82 + entryProgress * 0.2 - exitProgress * 0.14;
    const sweep = tick % 1;
    const waveCenterX = 0.52;
    const waveCenterY = 0.46;
    const waveRadius = Math.min(1.25, tick * 0.62);
    const dotStates = React.useMemo(
      () =>
        PIXEL_DOTS.map((dot) => {
          const dx = (dot.x - waveCenterX) * 1.25;
          const dy = dot.y - waveCenterY;
          const dist = Math.hypot(dx, dy);
          const reveal = clamp01((waveRadius - dist + 0.06) / 0.14);
          const edge = clamp01(1 - Math.abs(dist - waveRadius) / 0.05);
          const pulse = 0.78 + 0.22 * Math.sin(tick * dot.speed * 2.7 + dot.phase);
          const brightness = clamp01(reveal * (0.62 + dot.bias * 0.38) * pulse + edge * 0.9);
          return {
            opacity: brightness * (0.16 + globeOpacity * 0.34),
            brightness,
            coreRadius: dot.radius,
          };
        }),
      [globeOpacity, tick, waveRadius],
    );

    const particles = React.useMemo(
      () =>
        PIXEL_PARTICLE_SEEDS.map((seed) => {
          const base = PIXEL_DOTS[seed.dotIndex];
          if (!base) return null;
          const life = (tick * 0.7 + seed.phase) % 1;
          const state = dotStates[seed.dotIndex];
          const activeBoost = clamp01(((state?.brightness ?? 0) - 0.3) / 0.6);
          const alpha = Math.sin(life * Math.PI) * 0.58 * activeBoost;
          if (alpha <= 0.02) return null;
          return {
            x: base.x * 100 + seed.vx * life * 36,
            y: base.y * 100 + seed.vy * life * 18 - life * seed.lift,
            r: 0.18 + activeBoost * 0.26,
            alpha,
          };
        }).filter(Boolean) as Array<{ x: number; y: number; r: number; alpha: number }>,
      [dotStates, tick],
    );

    return (
      <AbsoluteFill style={{ backgroundColor: solidBackground ? DEFAULT_BG : "transparent", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at 50% 45%, #071a30 0%, #040d1a 52%, #020810 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 42%, rgba(30,100,255,0.1) 0%, rgba(0,0,0,0) 62%)",
            opacity: 0.92 * sceneOpacityEnvelope,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            opacity: 0.2 * sceneOpacityEnvelope,
            transform: `translateX(${Math.sin(frame / (fps * 3.5)) * 10}px) translateY(${Math.cos(frame / (fps * 3.3)) * 7}px)`,
          }}
        />
        <ComposableMap
          projection="geoNaturalEarth1"
          projectionConfig={{ scale: 168 }}
          width={1000}
          height={500}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0.58 * mapSceneOpacity * sceneOpacityEnvelope,
            transform: `translate(${mapTranslateX + briefingSlideX}%, ${mapTranslateY}%) scale(${mapZoom})`,
            transformOrigin: mapTransformOrigin,
          }}
        >
          <Geographies geography={WORLD_TOPOLOGY_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={`land-bg-${geo.rsmKey}`}
                  geography={geo}
                  fill={`rgba(198, 215, 230, ${0.09 * continentFocus})`}
                  stroke={`rgba(215, 228, 240, ${0.22 * continentFocus})`}
                  strokeWidth={0.42}
                />
              ))
            }
          </Geographies>
          <defs>
            <clipPath id="newscast-land-clip-frontend">
              <Geographies geography={WORLD_TOPOLOGY_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography key={geo.rsmKey} geography={geo} fill="#fff" stroke="none" />
                  ))
                }
              </Geographies>
            </clipPath>
          </defs>
          <g clipPath="url(#newscast-land-clip-frontend)">
            {PIXEL_DOTS.map((dot, i) => {
              const state = dotStates[i];
              if (!state || state.opacity < 0.02 || i % 2 !== 0) return null;
              const px = dot.x * 1000;
              const py = dot.y * 500;
              const size = 2.1 + state.brightness * 1.8;
              return (
                <rect
                  key={`pixel-cell-${i}`}
                  x={px - size / 2}
                  y={py - size / 2}
                  width={size}
                  height={size}
                  rx={0.35}
                  fill={`rgba(214,226,238,${Math.min(0.42, (0.08 + state.opacity * 0.38) * continentFocus)})`}
                />
              );
            })}

            {PIXEL_CONNECTIONS.map((link, i) => {
              const from = PIXEL_DOTS[link.a];
              const to = PIXEL_DOTS[link.b];
              const lum = Math.min(dotStates[link.a]?.brightness ?? 0, dotStates[link.b]?.brightness ?? 0);
              if (!from || !to || lum < 0.15) return null;
              return (
                <line
                  key={`conn-${link.a}-${link.b}`}
                  x1={from.x * 1000}
                  y1={from.y * 500}
                  x2={to.x * 1000}
                  y2={to.y * 500}
                  stroke={`rgba(156,220,255,${0.08 + lum * 0.22})`}
                  strokeWidth={0.8 + lum * 1.6}
                  strokeLinecap="round"
                  strokeDasharray={i % 3 === 0 ? "5 4.5" : undefined}
                />
              );
            })}

            {PIXEL_DOTS.map((dot, i) => {
              const state = dotStates[i];
              if (!state || state.opacity < 0.012) return null;
              const cx = dot.x * 1000;
              const cy = dot.y * 500;
              const haloOpacity = Math.min(0.52, state.opacity * 0.52);
              const dotScale = 8;
              return (
                <React.Fragment key={`dot-${i}`}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={state.coreRadius * (1.25 + state.brightness * 1.45) * dotScale}
                    fill={`rgba(190,236,255,${haloOpacity})`}
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={state.coreRadius * (0.65 + state.brightness * 0.9) * dotScale}
                    fill={`rgba(248,252,255,${0.2 + state.opacity})`}
                  />
                </React.Fragment>
              );
            })}

            {particles.map((p, i) => (
              <circle
                key={`particle-${i}`}
                cx={p.x * 10}
                cy={p.y * 5}
                r={p.r}
                fill={`rgba(185,235,255,${p.alpha})`}
              />
            ))}
          </g>
          {tick < 2 ? (
            <>
              <circle
                cx={waveCenterX * 1000}
                cy={waveCenterY * 500}
                r={waveRadius * 500}
                fill="none"
                stroke={`rgba(130,210,255,${Math.max(0, 0.48 * (1 - tick / 2))})`}
                strokeWidth={1.2}
              />
              {waveRadius > 0.3 ? (
                <circle
                  cx={waveCenterX * 1000}
                  cy={waveCenterY * 500}
                  r={waveRadius * 425}
                  fill="none"
                  stroke={`rgba(80,160,255,${Math.max(0, 0.2 * (1 - tick / 2))})`}
                  strokeWidth={0.8}
                />
              ) : null}
            </>
          ) : null}
        </ComposableMap>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 52% 48%, rgba(4,10,24,0) 38%, rgba(3,7,18,0.72) 100%)",
            opacity: mapDarkPhaseOpacity * (0.8 + sceneOpacityEnvelope * 0.2),
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${((frame + 50) % 230) / 230 * 100}%`,
            height: 34,
            transform: "translateY(-50%)",
            background:
              "linear-gradient(180deg, rgba(100,200,255,0) 0%, rgba(100,200,255,0.09) 50%, rgba(100,200,255,0) 100%)",
            opacity: 0.6 * sceneOpacityEnvelope,
            mixBlendMode: "screen",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${-30 + sweep * 160}%`,
            width: "20%",
            background:
              "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(190,235,255,0.2) 46%, rgba(255,255,255,0) 100%)",
            transform: "skewX(-16deg)",
            opacity: 0.45 * sceneOpacityEnvelope,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 94% 94% at 50% 50%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.38) 100%)",
          }}
        />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: solidBackground ? DEFAULT_BG : "transparent", overflow: "hidden" }}>
      {/* Starfield + fine grid */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)
          `,
          backgroundSize: 40,
          zIndex: 0,
          opacity: 0.9,
        }}
      />

      {/* Radial vignette */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 90% 90% at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)",
          zIndex: 1,
        }}
      />
    </AbsoluteFill>
  );
};

