import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * GlowSweep — a soft white-ish glow that travels once across the frame over
 * a scene's duration. Distinct from DarkBackground's indigo/cyan blobs,
 * which slowly wobble in place on a repeating 10s cycle; this is a single
 * continuous diagonal pass (eased in/out), reading as ambient light moving
 * across the glass/instrument surfaces already in a layout. Opt-in per
 * layout — not part of the shared DarkBackground used by every scene.
 */
export const GlowSweep: React.FC<{ seedOffset?: number }> = ({ seedOffset = 0 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => t * t * (3 - 2 * t),
  });

  const startX = -10 + (seedOffset % 2) * 20;
  const startY = 15 + (seedOffset % 3) * 10;
  const endX = 110 - (seedOffset % 2) * 20;
  const endY = 75 - (seedOffset % 3) * 10;

  const x = startX + (endX - startX) * progress;
  const y = startY + (endY - startY) * progress;

  const edgeFade = interpolate(progress, [0, 0.12, 0.88, 1], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        backgroundImage: `radial-gradient(ellipse 55% 40% at ${x}% ${y}%, rgba(255, 255, 255, 0.10) 0%, rgba(255, 255, 255, 0.04) 40%, transparent 70%)`,
        opacity: edgeFade,
        mixBlendMode: "screen",
      }}
    />
  );
};
