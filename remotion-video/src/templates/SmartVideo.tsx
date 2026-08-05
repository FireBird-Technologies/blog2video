import React from "react";
import { OffthreadVideo, Video, useRemotionEnvironment } from "remotion";

/**
 * Renders a stock clip with the right video primitive for the current Remotion
 * environment. Drop-in replacement for `<OffthreadVideo>` at every clip call
 * site — same props, same layout behaviour.
 *
 * Why this exists
 * ---------------
 * `OffthreadVideo` is correct for a CLI render: Remotion extracts the exact
 * frame with ffmpeg, so output frames land on precise timestamps instead of
 * wherever a media element happened to be. That accuracy is the whole reason
 * the clip components chose it.
 *
 * But in the interactive Player there is no ffmpeg. `OffthreadVideo` falls back
 * to seeking a hidden <video> element and holding a `delayRender()` until the
 * requested timestamp decodes — and a held `delayRender()` freezes the Player's
 * whole timeline. The result is playback that runs smoothly, then stalls the
 * moment it reaches a clip, and stalls again at every <Loop> boundary because
 * the loop restart forces a backwards seek.
 *
 * `<Video>` drives a real media element that plays continuously, which is
 * exactly what preview wants and exactly what a frame-accurate render does not.
 * So: pick per environment rather than compromising on one.
 *
 * `playbackRate` is deliberately never set here, matching the call sites. Clips
 * are normalised to CFR 30 fps on ingest (backend/app/services/stock_footage.py)
 * to match the composition fps, so composition frame n maps 1:1 onto source
 * frame n. A rate change would re-introduce the fractional sampling — judder —
 * that normalising exists to remove.
 */
export const SmartVideo: React.FC<{
  src: string;
  style?: React.CSSProperties;
  muted?: boolean;
  volume?: number;
  /** Start offset into the source clip, in frames (the adjust-modal trim). */
  trimBefore?: number;
  // Remaining props are forwarded untouched. This matters because
  // compileComponent.ts substitutes SmartVideo for OffthreadVideo inside
  // JIT-compiled crafted/custom template bundles, whose source lives in R2 and
  // may pass props this component does not name explicitly.
  [key: string]: unknown;
}> = ({ src, style, muted, volume, trimBefore, ...rest }) => {
  const { isRendering } = useRemotionEnvironment();

  if (isRendering) {
    return (
      <OffthreadVideo
        src={src}
        muted={muted}
        volume={volume}
        trimBefore={trimBefore}
        style={style}
        {...rest}
      />
    );
  }

  return (
    <Video
      src={src}
      muted={muted}
      volume={volume}
      trimBefore={trimBefore}
      style={style}
      {...rest}
      // Preview-only resilience: if a clip does run dry despite the preload in
      // VideoPreview, let it catch up silently instead of halting the timeline.
      pauseWhenBuffering={false}
      // A clip failing to load must never hard-fail the preview; <Video> would
      // otherwise cancelRender() on error.
      onError={() => {}}
      // Autoplay restrictions are not an error worth surfacing in preview.
      onAutoPlayError={null}
    />
  );
};
