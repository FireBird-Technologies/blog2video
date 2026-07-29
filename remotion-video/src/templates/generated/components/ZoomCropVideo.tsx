import React from "react";
import { Loop, OffthreadVideo } from "remotion";
import { useSceneDurationInFrames } from "../../SceneDurationContext";

/**
 * Stock-footage twin of the AI-generated scenes' still-image background —
 * identical pan/zoom framing so the scene's shared imageFocusX/Y + imageZoom
 * props behave the same for a clip as for a still.
 *
 * zoom >= 1  →  object-fit: cover  + scale(z) from the focus point (zoom-in, crops edges)
 * zoom <  1  →  object-fit: contain + scale(z) from center (zoom-out, reveals full clip)
 *
 * Two deliberate choices keep playback smooth:
 *
 * 1. `OffthreadVideo` (not `<Video>`): during a CLI render Remotion extracts the
 *    exact frame with ffmpeg rather than driving a real <video> element, so
 *    output frames land on precise timestamps instead of wherever a media
 *    element happened to be.
 *
 * 2. `playbackRate` is never set. Clips are normalised to CFR 30 fps on ingest
 *    (backend/app/services/stock_footage.py) to match the composition's fps, so
 *    composition frame n maps 1:1 onto source frame n. Any rate change would
 *    re-introduce the fractional sampling — i.e. judder — that normalising
 *    exists to remove.
 *
 * `OffthreadVideo` has no `loop` prop, so repetition uses the separate <Loop>
 * component. Without a known clip length we cannot pick a loop point, so the
 * clip plays once rather than cutting at a guessed frame.
 */
export function ZoomCropVideo({
  src,
  imageObjectPosition,
  imageZoom,
  muted = true,
  volume = 0.35,
  durationInFrames,
  startInFrames = 0,
}: {
  src: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  muted?: boolean;
  volume?: number;
  /** Clip length in frames. Omit to play once instead of looping. */
  durationInFrames?: number;
  /** Start offset into the source clip, in frames (the adjust-modal trim). */
  startInFrames?: number;
}) {
  const sceneDurationInFrames = useSceneDurationInFrames();
  const pos = imageObjectPosition ?? "50% 50%";
  const z = Math.max(0.1, imageZoom ?? 1);
  const isZoomedOut = z < 1;
  const start = Math.max(0, Math.round(startInFrames || 0));

  const video = (
    <OffthreadVideo
      src={src}
      muted={muted}
      volume={muted ? 0 : Math.max(0, Math.min(1, volume))}
      // Skip the first `start` source frames so the scene shows the chosen
      // portion of a longer clip rather than always the opening seconds.
      trimBefore={start || undefined}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        objectFit: isZoomedOut ? "contain" : "cover",
        objectPosition: isZoomedOut ? "center" : pos,
        transform: `scale(${z})`,
        transformOrigin: isZoomedOut ? "center center" : pos,
      }}
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

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {loopFrames ? (
        <Loop durationInFrames={loopFrames}>{video}</Loop>
      ) : (
        video
      )}
    </div>
  );
}
