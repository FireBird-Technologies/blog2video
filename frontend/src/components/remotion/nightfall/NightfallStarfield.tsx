import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

/** Deterministic PRNG so star layouts are stable across server/browser renders. */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_STARS = 60;
const SHOWER_COUNT = 2;

/** 8-point sparkle/star shape via clip-path — used for shooting-star heads and bursts. */
export const SPARKLE_CLIP_PATH =
  "polygon(50% 0%, 63% 37%, 100% 50%, 63% 63%, 50% 100%, 37% 63%, 0% 50%, 37% 37%)";

/** A small sparkle/star-shaped glowing particle (CSS clip-path, not SVG path data). */
export const SparkleParticle: React.FC<{
  x: number;
  y: number;
  size: number;
  opacity: number;
  color?: string;
  glow?: string;
  rotate?: number;
}> = ({ x, y, size, opacity, color = "#FFFFFF", glow = "rgba(255,255,255,0.85)", rotate = 0 }) => (
  <div
    style={{
      position: "absolute",
      left: `${x}%`,
      top: `${y}%`,
      width: size,
      height: size,
      transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
      background: color,
      clipPath: SPARKLE_CLIP_PATH,
      opacity,
      filter: `drop-shadow(0 0 ${Math.max(2, size * 0.6)}px ${glow})`,
      pointerEvents: "none",
    }}
  />
);

interface NightfallStarfieldProps {
  /** 0-1, controls star count and base brightness. */
  intensity?: number;
  /** 0-1, boosts shooting-star frequency/brightness — used during transitions. */
  boost?: number;
  /** Per-scene offset so each scene's sky differs but stays deterministic. */
  seed?: number;
  /** Whether shooting-star showers can fire at all — kept off for most scenes/transitions. */
  showShootingStars?: boolean;
}

/** Twinkling starfield + occasional multi-star shooting showers, rendered as a procedural overlay. */
export const NightfallStarfield: React.FC<NightfallStarfieldProps> = ({
  intensity = 0.35,
  boost = 0,
  seed = 0,
  showShootingStars = true,
}) => {
  const frame = useCurrentFrame();

  const stars = useMemo(() => {
    const rand = mulberry32(1000 + seed * 97);
    const count = Math.round(MAX_STARS * Math.max(0.2, intensity));
    return Array.from({ length: count }, (_, i) => ({
      x: rand() * 100,
      y: rand() * 70,
      size: 1 + rand() * 2.2,
      period: 60 + rand() * 120,
      phase: rand() * Math.PI * 2,
      baseOpacity: 0.25 + rand() * 0.55,
      sparkle: i % 6 === 0,
      rotate: rand() * 90,
    }));
  }, [intensity, seed]);

  // Multi-star "showers": 2-3 stars travel together, slowly, from a random
  // direction (including straight top-to-bottom) — direction/origin/timing
  // vary per scene via the seed.
  const showers = useMemo(() => {
    if (!showShootingStars) return [];
    const rand = mulberry32(5000 + seed * 53);
    return Array.from({ length: SHOWER_COUNT }, (_, showerIdx) => {
      const angle = 12 + rand() * 156; // mostly downward: down-right -> down -> down-left
      const clusterSize = 2 + Math.floor(rand() * 2); // 2-3 stars together
      const clusterSpread = 4 + rand() * 4;
      const length = 14 + rand() * 10;
      const durationFrames = Math.round(28 + rand() * 16); // slow drift
      const period = Math.round(220 + rand() * 160);
      const offset = Math.round(rand() * period) + showerIdx * 113;
      const originX = rand() * 70 + 10;
      const originY = rand() * 30;
      return {
        angle,
        clusterSize,
        clusterSpread,
        length,
        durationFrames,
        period,
        offset,
        originX,
        originY,
      };
    });
  }, [seed, showShootingStars]);

  const brightness = Math.min(1, intensity + boost * 0.5);

  const activeShootingStars: {
    key: string;
    tailX: number;
    tailY: number;
    headX: number;
    headY: number;
    size: number;
    fade: number;
  }[] = [];

  showers.forEach((shower, showerIdx) => {
    const t = (frame + shower.offset) % shower.period;
    if (t > shower.durationFrames) return;

    const cycleIndex = Math.floor((frame + shower.offset) / shower.period);
    const fireRoll = mulberry32(cycleIndex * 7919 + showerIdx * 104729 + Math.round(seed * 1000) + 1)();
    const fireThreshold = boost > 0 ? 0.55 + boost * 0.4 : 0.35;
    if (fireRoll > fireThreshold) return;

    const progress = t / shower.durationFrames;
    const rad = (shower.angle * Math.PI) / 180;
    const dx = Math.cos(rad) * shower.length;
    const dy = Math.sin(rad) * shower.length;
    const perpRad = rad + Math.PI / 2;
    const perpX = Math.cos(perpRad);
    const perpY = Math.sin(perpRad);
    const fade = Math.sin(progress * Math.PI);

    for (let m = 0; m < shower.clusterSize; m++) {
      const memberDelay = m * 3;
      const localT = t - memberDelay;
      if (localT < 0 || localT > shower.durationFrames) continue;
      const memberProgress = localT / shower.durationFrames;
      const spreadOffset = (m - (shower.clusterSize - 1) / 2) * shower.clusterSpread;
      const baseX = shower.originX + perpX * spreadOffset;
      const baseY = shower.originY + perpY * spreadOffset;
      const memberLength = shower.length * (0.85 + m * 0.1);
      const memberDx = Math.cos(rad) * memberLength;
      const memberDy = Math.sin(rad) * memberLength;
      const headX = baseX + memberDx * memberProgress;
      const headY = baseY + memberDy * memberProgress;
      const tailX = headX - memberDx * 0.4;
      const tailY = headY - memberDy * 0.4;
      const memberFade = Math.sin(memberProgress * Math.PI);
      activeShootingStars.push({
        key: `shower-${showerIdx}-${cycleIndex}-${m}`,
        tailX,
        tailY,
        headX,
        headY,
        size: 2.2 + m * 0.4,
        fade: memberFade * (0.6 + boost * 0.4) * fade,
      });
    }
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        {stars.map((s, i) => {
          if (s.sparkle) return null;
          const twinkle = 0.5 + 0.5 * Math.sin((frame / s.period) * Math.PI * 2 + s.phase);
          const opacity = s.baseOpacity * (0.4 + 0.6 * twinkle) * brightness;
          return (
            <circle
              key={i}
              cx={`${s.x}%`}
              cy={`${s.y}%`}
              r={s.size}
              fill="#FFFFFF"
              opacity={opacity}
              style={s.size > 2.5 ? { filter: "blur(0.5px)" } : undefined}
            />
          );
        })}
        {activeShootingStars.map((star) => (
          <defs key={`def-${star.key}`}>
            <linearGradient
              id={`nightfall-${star.key}`}
              gradientUnits="userSpaceOnUse"
              x1={`${star.tailX}%`}
              y1={`${star.tailY}%`}
              x2={`${star.headX}%`}
              y2={`${star.headY}%`}
            >
              <stop offset="0%" stopColor="#A5C9FF" stopOpacity="0" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.9" />
            </linearGradient>
          </defs>
        ))}
        {activeShootingStars.map((star) => (
          <line
            key={star.key}
            x1={`${star.tailX}%`}
            y1={`${star.tailY}%`}
            x2={`${star.headX}%`}
            y2={`${star.headY}%`}
            stroke={`url(#nightfall-${star.key})`}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={star.fade}
          />
        ))}
      </svg>
      {stars.map((s, i) => {
        if (!s.sparkle) return null;
        const twinkle = 0.5 + 0.5 * Math.sin((frame / s.period) * Math.PI * 2 + s.phase);
        const opacity = s.baseOpacity * (0.4 + 0.6 * twinkle) * brightness;
        return (
          <SparkleParticle
            key={i}
            x={s.x}
            y={s.y}
            size={s.size * 2.4}
            opacity={opacity}
            rotate={s.rotate}
          />
        );
      })}
      {activeShootingStars.map((star) => (
        <SparkleParticle
          key={`head-${star.key}`}
          x={star.headX}
          y={star.headY}
          size={star.size * 2.6}
          opacity={star.fade}
          rotate={(frame * 6) % 360}
        />
      ))}
    </AbsoluteFill>
  );
};
