import React from "react";
import { Loop } from "remotion";
import { SmartVideo } from "../../SmartVideo";
import { useSceneDurationInFrames } from "../../SceneDurationContext";

/**
 * Stock-footage twin of {@link AnimatedImage} — a drop-in swap at the same
 * call sites (HeroImage, ImageCaption), taking the same `style` object so the
 * surrounding zoom/position/animation math in each layout is reused unchanged.
 *
 * Two deliberate choices keep playback smooth:
 *
 * 1. `SmartVideo`: uses `OffthreadVideo` during a CLI render, so Remotion
 *    extracts the exact frame with ffmpeg and output frames land on precise
 *    timestamps; and a plain `<Video>` in the Player, which plays continuously
 *    instead of freezing the timeline on a per-frame seek.
 *
 * 2. `playbackRate` is never set. Clips are normalised to CFR 30 fps on ingest
 *    (backend/app/services/stock_footage.py) to match the composition's fps, so
 *    composition frame n maps 1:1 onto source frame n. Any rate change would
 *    re-introduce the fractional sampling — i.e. judder — that normalising
 *    exists to remove.
 *
 * Neither video primitive has a `loop` prop, so repetition uses the separate <Loop>
 * component. Without a known clip length we cannot pick a loop point, so the
 * clip plays once rather than cutting at a guessed frame.
 */
export const AnimatedVideo: React.FC<{
  src: string;
  style?: React.CSSProperties;
  muted?: boolean;
  volume?: number;
  /** Clip length in frames. Omit to play once instead of looping. */
  durationInFrames?: number;
  /** Start offset into the source clip, in frames (the adjust-modal trim). */
  startInFrames?: number;
}> = ({ src, style, muted = true, volume = 0.35, durationInFrames, startInFrames = 0 }) => {
  const sceneDurationInFrames = useSceneDurationInFrames();
  const start = Math.max(0, Math.round(startInFrames || 0));

  const video = (
    <SmartVideo
      src={src}
      muted={muted}
      volume={muted ? 0 : Math.max(0, Math.min(1, volume))}
      // Skip the first `start` source frames so the scene shows the chosen
      // portion of a longer clip rather than always the opening seconds.
      trimBefore={start || undefined}
      style={style}
    />
  );

  // Loop the scene's trimmed window: [start, start + sceneDur), capped by clip end.
  const loopFrames = (() => {
    const clipLen = durationInFrames && durationInFrames > 0 ? Math.round(durationInFrames) : 0;
    if (clipLen <= 0) return undefined;
    const maxWindow = Math.max(1, clipLen - start);
    if (sceneDurationInFrames && sceneDurationInFrames > 0) {
      return Math.max(1, Math.min(Math.round(sceneDurationInFrames), maxWindow));
    }
    return maxWindow;
  })();

  return loopFrames ? <Loop durationInFrames={loopFrames}>{video}</Loop> : video;
};
