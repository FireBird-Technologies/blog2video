import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { NightfallStarfield, SparkleParticle } from "./NightfallStarfield";
import { frostFocusPull, thunderFlash, glassShatterCrack, fallInDrop } from "./nightfallLayoutMotion";

const TRANS_WINDOW_SEC = 1.3;

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

type NightfallTransitionFamily =
  | "thunder_break"
  | "text_focus"
  | "falling_in"
  | "shooting_star_wipe";

const LAYOUT_FAMILY: Record<string, NightfallTransitionFamily> = {
  cinematic_title: "thunder_break",
  chapter_break: "thunder_break",
  split_glass: "thunder_break",
  glass_narrative: "text_focus",
  kinetic_insight: "text_focus",
  glass_code: "text_focus",
  ending_socials: "text_focus",
  glass_stack: "falling_in",
  glow_metric: "falling_in",
  data_visualization: "falling_in",
  glass_image: "shooting_star_wipe",
};

function resolveFamily(layoutType?: string): NightfallTransitionFamily {
  return LAYOUT_FAMILY[layoutType ?? ""] ?? "text_focus";
}

/** Mulberry32 PRNG for deterministic falling-star particle layouts. */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Radiating ember/spark burst from the lightning-flash center, for thunder_break. */
const SparkShower: React.FC<{ frame: number; transFrames: number; seed: number }> = ({
  frame,
  transFrames,
  seed,
}) => {
  const sparks = useMemo(() => {
    const rand = mulberry32(3000 + seed * 83);
    return Array.from({ length: 8 }, () => ({
      angle: rand() * Math.PI * 2,
      distance: 12 + rand() * 22,
      size: 2 + rand() * 2,
      delay: Math.floor(rand() * 4),
    }));
  }, [seed]);

  return (
    <>
      {sparks.map((s, i) => {
        const local = frame - s.delay;
        const life = Math.min(14, transFrames);
        const progress = interpolate(local, [0, life], [0, 1], clamp);
        const dist = s.distance * progress;
        const x = 50 + Math.cos(s.angle) * dist;
        const y = 30 + Math.sin(s.angle) * dist;
        const opacity = interpolate(local, [0, 2, life * 0.6, life], [0, 1, 0.6, 0], clamp);
        if (opacity <= 0) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: s.size,
              height: s.size,
              borderRadius: "50%",
              background: "#EAF4FF",
              boxShadow: "0 0 8px rgba(170,210,255,0.9)",
              opacity,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
};

/** Slow-drifting frost dust motes for the text_focus rack-focus pull. */
const FrostDust: React.FC<{ frame: number; transFrames: number; seed: number }> = ({
  frame,
  transFrames,
  seed,
}) => {
  const motes = useMemo(() => {
    const rand = mulberry32(7000 + seed * 61);
    return Array.from({ length: 6 }, () => ({
      x: rand() * 100,
      startY: 30 + rand() * 50,
      drift: 6 + rand() * 10,
      size: 1.5 + rand() * 2,
      phase: rand() * Math.PI * 2,
    }));
  }, [seed]);

  return (
    <>
      {motes.map((m, i) => {
        const opacity = interpolate(
          frame,
          [0, transFrames * 0.4, transFrames],
          [0, 0.7, 0],
          clamp,
        );
        if (opacity <= 0) return null;
        const y = m.startY - (frame / transFrames) * m.drift;
        const x = m.x + Math.sin(frame / 8 + m.phase) * 1.5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: m.size,
              height: m.size,
              borderRadius: "50%",
              background: "#D6E8FF",
              boxShadow: "0 0 5px rgba(214,232,255,0.8)",
              opacity,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
};

/** A burst/splurge of sparkle stars scattering outward from a point and fading. */
const StarSplurge: React.FC<{ frame: number; transFrames: number; seed: number }> = ({
  frame,
  transFrames,
  seed,
}) => {
  const burst = useMemo(() => {
    const rand = mulberry32(11000 + seed * 131);
    const originX = 20 + rand() * 60;
    const originY = 15 + rand() * 40;
    const particles = Array.from({ length: 9 }, () => ({
      angle: rand() * Math.PI * 2,
      distance: 14 + rand() * 18,
      size: 4 + rand() * 5,
      delay: Math.floor(rand() * transFrames * 0.25),
    }));
    return { originX, originY, particles };
  }, [seed, transFrames]);

  return (
    <>
      {burst.particles.map((p, i) => {
        const local = frame - p.delay;
        const life = Math.max(8, transFrames - p.delay);
        const progress = interpolate(local, [0, life], [0, 1], clamp);
        const dist = p.distance * progress;
        const x = burst.originX + Math.cos(p.angle) * dist;
        const y = burst.originY + Math.sin(p.angle) * dist;
        const opacity = interpolate(local, [0, life * 0.25, life * 0.7, life], [0, 1, 0.5, 0], clamp);
        if (opacity <= 0) return null;
        return (
          <SparkleParticle
            key={i}
            x={x}
            y={y}
            size={p.size}
            opacity={opacity}
            color="#F2F8FF"
            glow="rgba(180,210,255,0.85)"
            rotate={(local * 8) % 360}
          />
        );
      })}
    </>
  );
};

const FallingStarParticles: React.FC<{ frame: number; transFrames: number; seed: number }> = ({
  frame,
  transFrames,
  seed,
}) => {
  const particles = useMemo(() => {
    const rand = mulberry32(9000 + seed * 71);
    return Array.from({ length: 5 }, () => ({
      x: rand() * 100,
      targetY: 10 + rand() * 70,
      delay: Math.floor(rand() * transFrames * 0.4),
      size: 2 + rand() * 2.5,
    }));
  }, [seed, transFrames]);

  return (
    <>
      {particles.map((p, i) => {
        const local = frame - p.delay;
        const fallDuration = Math.max(6, transFrames - p.delay);
        const y = interpolate(local, [0, fallDuration], [-15, p.targetY], clamp);
        const opacity = interpolate(
          local,
          [0, fallDuration * 0.3, fallDuration * 0.8, fallDuration],
          [0, 0.9, 0.5, 0],
          clamp,
        );
        if (opacity <= 0) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: `${y}%`,
              width: p.size,
              height: p.size * 5,
              borderRadius: p.size,
              background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0))",
              boxShadow: "0 0 6px rgba(255,255,255,0.8)",
              opacity,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
};

export const NightfallSceneTransition: React.FC<{
  durationInFrames: number;
  sceneIndex: number;
  sceneCount?: number;
  layoutType?: string;
  children: React.ReactNode;
}> = ({ durationInFrames, sceneIndex, layoutType, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const family = resolveFamily(layoutType);

  const capHalf = Math.max(1, Math.floor(durationInFrames / 2));
  const transFrames = Math.min(
    Math.round(TRANS_WINDOW_SEC * fps),
    Math.max(10, Math.floor(durationInFrames * 0.3)),
    capHalf,
  );

  const inTransition = frame < transFrames;
  const starBoost = inTransition
    ? interpolate(frame, [0, transFrames], [1, 0], clamp)
    : 0;

  // A few random scenes (in addition to glass_image, which always gets it)
  // get a multi-star shooting shower during their transition.
  const showShootingShower =
    family === "shooting_star_wipe" || mulberry32(20000 + sceneIndex * 211)() < 0.35;

  // Occasionally add a "splurge" of bursting sparkle stars for extra variety.
  const showSplurge = mulberry32(30000 + sceneIndex * 311)() < 0.3;

  // ── text_focus: rack-focus blur + slight zoom-out drift ──
  const { blur: focusBlur, scale: focusScale } = frostFocusPull(frame, transFrames);
  const focusDriftX = interpolate(frame, [0, transFrames], [-20, 0], clamp);

  // ── thunder_break: lightning flash + glass crack + camera shake + scale pop ──
  const thunderFlashOpacity = thunderFlash(frame);
  const crackOpacity = glassShatterCrack(frame, transFrames);
  const thunderScale = interpolate(frame, [0, transFrames], [1.08, 1], clamp);
  const shakeAmp = interpolate(frame, [0, 10, transFrames], [10, 4, 0], clamp);
  const shakeX = Math.sin(frame * 2.6) * shakeAmp;
  const shakeY = Math.cos(frame * 2.1) * shakeAmp * 0.5;

  // ── falling_in: drop from above + radial bloom "enhance" burst on settle ──
  const { translateY: fallY, rotate: fallRotate } = fallInDrop(frame, transFrames);
  const bloomOpacity = interpolate(
    frame,
    [Math.floor(transFrames * 0.4), Math.floor(transFrames * 0.75), transFrames],
    [0, 0.4, 0],
    clamp,
  );
  const bloomScale = interpolate(frame, [0, transFrames], [1.2, 1], clamp);

  // ── shooting_star_wipe: camera pan + zoom for image reveal ──
  const wipeX = interpolate(frame, [0, transFrames], [40, 0], clamp);
  const wipeScale = interpolate(frame, [0, transFrames], [1.04, 1], clamp);

  let transform = "none";
  let filter: string | undefined;

  if (family === "text_focus") {
    transform = `translateX(${focusDriftX}px) scale(${focusScale})`;
    filter = focusBlur > 0.05 ? `blur(${focusBlur}px)` : undefined;
  } else if (family === "thunder_break") {
    transform = `translate(${shakeX}px, ${shakeY}px) scale(${thunderScale})`;
  } else if (family === "falling_in") {
    transform = `translateY(${fallY}px) rotate(${fallRotate}deg)`;
  } else if (family === "shooting_star_wipe") {
    transform = `translateX(${wipeX}px) scale(${wipeScale})`;
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform, filter, transformOrigin: "50% 50%" }}>
        {children}
      </AbsoluteFill>

      {inTransition && (
        <NightfallStarfield
          intensity={0.35}
          boost={starBoost}
          seed={sceneIndex}
          showShootingStars={showShootingShower}
        />
      )}

      {showSplurge && inTransition && (
        <StarSplurge frame={frame} transFrames={transFrames} seed={sceneIndex} />
      )}

      {family === "falling_in" && inTransition && (
        <FallingStarParticles frame={frame} transFrames={transFrames} seed={sceneIndex} />
      )}

      {family === "thunder_break" && inTransition && (
        <SparkShower frame={frame} transFrames={transFrames} seed={sceneIndex} />
      )}

      {family === "text_focus" && inTransition && (
        <FrostDust frame={frame} transFrames={transFrames} seed={sceneIndex} />
      )}

      {family === "thunder_break" && crackOpacity > 0 && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            opacity: crackOpacity,
            pointerEvents: "none",
            backgroundImage:
              "repeating-linear-gradient(115deg, rgba(220,235,255,0.35) 0 1px, rgba(20,30,60,0) 1px 8px), repeating-linear-gradient(25deg, rgba(220,235,255,0.22) 0 1px, rgba(20,30,60,0) 1px 10px)",
            mixBlendMode: "screen",
          }}
        />
      )}

      {family === "thunder_break" && thunderFlashOpacity > 0 && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            opacity: thunderFlashOpacity,
            pointerEvents: "none",
            background:
              "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.9) 0%, rgba(180,220,255,0.45) 35%, rgba(120,170,255,0.18) 60%, rgba(10,10,26,0) 78%)",
            mixBlendMode: "screen",
          }}
        />
      )}

      {family === "falling_in" && bloomOpacity > 0 && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            opacity: bloomOpacity,
            transform: `scale(${bloomScale})`,
            transformOrigin: "50% 35%",
            pointerEvents: "none",
            background:
              "radial-gradient(circle at 50% 35%, rgba(165,210,255,0.5) 0%, rgba(99,102,241,0.24) 30%, rgba(34,211,238,0.12) 55%, rgba(10,10,26,0) 75%)",
            mixBlendMode: "screen",
          }}
        />
      )}
    </AbsoluteFill>
  );
};
