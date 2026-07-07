import { interpolate } from "remotion";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

/** Rack-focus reveal: scene starts soft + slightly zoomed, then snaps into focus. */
export function frostFocusPull(frame: number, transFrames: number) {
  const blur = interpolate(frame, [0, transFrames], [10, 0], clamp);
  const scale = interpolate(frame, [0, transFrames], [1.05, 1], clamp);
  return { blur, scale };
}

/** Double-strike lightning flash envelope (0-1 opacity). */
export function thunderFlash(frame: number) {
  const primary = interpolate(frame, [0, 3, 9], [0, 0.85, 0], clamp);
  const secondary = interpolate(frame, [10, 13, 22], [0, 0.45, 0], clamp);
  return Math.max(primary, secondary);
}

/** Glass-crack overlay strength, fades out across the transition window. */
export function glassShatterCrack(frame: number, transFrames: number) {
  const strength = interpolate(
    frame,
    [0, transFrames * 0.4, transFrames],
    [0.5, 0.22, 0],
    clamp,
  );
  return Math.max(0, strength * (0.7 + 0.3 * Math.abs(Math.sin(frame * 1.7))));
}

/** Falling-in entrance: drops from above with a brief overshoot/settle. */
export function fallInDrop(frame: number, transFrames: number) {
  const translateY = interpolate(
    frame,
    [0, transFrames * 0.6, transFrames * 0.85, transFrames],
    [-160, 16, -6, 0],
    clamp,
  );
  const rotate = interpolate(frame, [0, transFrames], [-6, 0], clamp);
  return { translateY, rotate };
}
