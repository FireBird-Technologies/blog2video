import { interpolate } from "remotion";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const fract = (value: number) => value - Math.floor(value);

const seededNoise = (index: number, seed: number, x: number, y: number) => {
  const mixed = (index + 1) * 12.9898 + seed * 78.233 + x * 0.151 + y * 0.173;
  return fract(Math.sin(mixed) * 43758.5453);
};

export type MosaicTileEntryPattern = "linear" | "diagonal" | "center" | "scatter";

type TileMotionParams = {
  progress: number;
  index: number;
  total: number;
  x: number;
  y: number;
  intensity?: number;
};

type TileEntryParams = TileMotionParams & {
  pattern?: MosaicTileEntryPattern;
};

type TileExitParams = TileMotionParams & {
  seed?: number;
};

export const getSceneTransition = (
  frame: number,
  durationInFrames: number,
  entryEnd = 18,
  exitLength = 14,
) => {
  const pace = 1.45;
  const easedEntryEnd = Math.max(1, Math.round(entryEnd * pace));
  const easedExitLength = Math.max(1, Math.round(exitLength * pace));
  const entry = interpolate(frame, [0, easedEntryEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitStart = Math.max(0, durationInFrames - easedExitLength);
  const exit = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return {
    entry,
    exit,
    presence: entry * exit,
  };
};

export const getStaggeredReveal = (
  frame: number,
  start: number,
  duration: number,
) =>
  interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const getTileEntryProgress = ({
  progress,
  index,
  total,
  x,
  y,
  intensity = 24,
  pattern = "center",
}: TileEntryParams) => {
  const nx = clamp01(x / 100);
  const ny = clamp01(y / 100);
  const linearOrder = index / Math.max(1, total - 1);
  const diagonalOrder = clamp01(nx * 0.7 + ny * 0.3);
  const dx = nx - 0.5;
  const dy = ny - 0.5;
  const centerOrder = clamp01(Math.sqrt(dx * dx + dy * dy) / 0.71);
  // scatter: fully random per-tile order (seed 42 for entry, distinct from exit seed)
  const scatterOrder = seededNoise(index, 42, x, y);
  const order =
    pattern === "diagonal"
      ? diagonalOrder
      : pattern === "linear"
        ? linearOrder
        : pattern === "scatter"
          ? scatterOrder
          : centerOrder;

  return clamp01((clamp01(progress) - order) * intensity);
};

export const getTileExitBreakProgress = ({
  progress,
  index,
  total,
  x,
  y,
  intensity = 26,
  seed = 17,
}: TileExitParams) => {
  const nx = clamp01(x / 100);
  const ny = clamp01(y / 100);
  const randomOrder = seededNoise(index, seed, x, y);
  const scatterOrder = clamp01(
    randomOrder * 0.72 +
      ((index / Math.max(1, total - 1)) * 0.18 + (nx + ny) * 0.05 + (1 - ny) * 0.05),
  );
  const breakAmount = clamp01((clamp01(progress) - scatterOrder) * intensity);
  return 1 - breakAmount;
};
