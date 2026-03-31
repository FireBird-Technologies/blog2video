import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const BBC_RED = "#E60000";

export function useBbcGhostTransition() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const enterOp = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitOp = interpolate(frame, [durationInFrames - 18, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glitch = interpolate(frame, [4, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Remove translation jitter entirely; keep only opacity/ghost timing.
  const jitterX = 0;
  const jitterY = 0;
  const shadowOffset = 1 + glitch * 1.1; // tiny animated depth (no translation)

  return {
    contentOpacity: enterOp * exitOp,
    jitterX,
    jitterY,
    shadowOffset,
    shadowColor: BBC_RED,
    glitchAmount: glitch,
  };
}

