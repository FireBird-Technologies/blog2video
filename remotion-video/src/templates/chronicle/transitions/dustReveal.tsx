import React from "react";
import { AbsoluteFill } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

/**
 * dustReveal — the outgoing scene disintegrates into golden book-dust that
 * blows off to the right, revealing the new scene underneath.
 *
 * Trick: we layer many tinted copies of the outgoing scene with a horizontal
 * translate that grows with progress, plus a strong opacity falloff and a
 * slight blur — the eye reads it as the page crumbling into motes of light.
 *
 * Whimsical, "old magic" feel. Good for hero/quote scene transitions.
 */

type DustRevealProps = Record<string, unknown>;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const DustRevealComponent: React.FC<
  TransitionPresentationComponentProps<DustRevealProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const raw = presentationProgress;
  const p = easeInOutCubic(raw);

  if (presentationDirection === "entering") {
    // Incoming fades up smoothly. Eased so it feels gentle while the old
    // page is still dusting away.
    return <AbsoluteFill style={{ opacity: p }}>{children}</AbsoluteFill>;
  }

  // Outgoing — layered "shards" drifting apart. Eased motion so it doesn't
  // jolt into the dust effect.
  const opacity = Math.max(0, 1 - p * 1.3);
  const baseShift = p * 28;
  const blurPx = p * 4;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          opacity: opacity * 0.6,
          transform: `translateX(${baseShift}%)`,
          filter: `blur(${blurPx}px) sepia(0.3)`,
        }}
      >
        {children}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          opacity: opacity * 0.4,
          transform: `translateX(${baseShift * 1.6}%)`,
          filter: `blur(${blurPx * 1.5}px) sepia(0.5)`,
        }}
      >
        {children}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          opacity: opacity,
          filter: `blur(${blurPx * 0.4}px)`,
          maskImage: `linear-gradient(to right,
            black ${Math.max(0, 100 - p * 120)}%,
            transparent 100%)`,
          WebkitMaskImage: `linear-gradient(to right,
            black ${Math.max(0, 100 - p * 120)}%,
            transparent 100%)`,
        }}
      >
        {children}
      </AbsoluteFill>

      {/* Golden dust motes streaming off to the right at the dissolution edge */}
      <DustParticles progress={p} />
    </AbsoluteFill>
  );
};

const PARTICLES = Array.from({ length: 28 }).map((_, i) => {
  const rng = (seed: number) => {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    y: rng(i + 1) * 100,
    size: 3 + rng(i + 17) * 6,
    speed: 0.8 + rng(i + 31) * 1.2,
    drift: (rng(i + 47) - 0.5) * 18,
    phase: rng(i + 53) * Math.PI * 2,
    delay: rng(i + 71) * 0.4,
  };
});

const DustParticles: React.FC<{ progress: number }> = ({ progress }) => {
  return (
    <>
      {PARTICLES.map((m, i) => {
        const t = Math.max(0, progress - m.delay);
        if (t === 0) return null;
        // Particle leading edge starts at the dissolution boundary and streams
        // off to the right.
        const edgeX = Math.max(0, 100 - progress * 130);
        const x = edgeX + t * 80 * m.speed;
        const yJitter = Math.sin(t * 8 + m.phase) * m.drift;
        const y = m.y + yJitter;
        const opacity = Math.max(0, 1 - t * 1.8);
        if (x > 110) return null;
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
              background: "rgba(255,210,140,0.95)",
              boxShadow: `0 0 ${m.size * 2}px rgba(255,180,90,0.8)`,
              opacity,
              filter: "blur(0.5px)",
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
};

export const dustReveal = (): TransitionPresentation<DustRevealProps> => ({
  component: DustRevealComponent,
  props: {},
});
