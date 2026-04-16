export const MIN_PLAYBACK_SPEED = 0.5;
export const MAX_PLAYBACK_SPEED = 2.5;

export const getPlaybackSpeed = (value: unknown): number => {
  const raw = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(raw)) return 1;
  const rounded = Math.round(raw * 10) / 10;
  return Math.min(MAX_PLAYBACK_SPEED, Math.max(MIN_PLAYBACK_SPEED, rounded));
};

export const getSceneDurationFrames = (
  durationSeconds: number | null | undefined,
  fps: number,
  playbackSpeed: number,
): number => {
  const baseSeconds = Number(durationSeconds) || 5;
  return Math.max(1, Math.round((baseSeconds * fps) / playbackSpeed));
};
