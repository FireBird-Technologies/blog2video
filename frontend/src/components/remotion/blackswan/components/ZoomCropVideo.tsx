import React from "react";
import { Loop, OffthreadVideo } from "remotion";
import { useSceneDurationInFrames } from "../../SceneDurationContext";

/**
 * Stock-footage twin of {@link ZoomCropImg} — identical pan/zoom framing so a
 * clip drops into the same box as a still.
 *
 * zoom >= 1  →  object-fit: cover  + scale(z) from the focus point
 * zoom <  1  →  object-fit: contain + scale(z) from center
 *
 * `OffthreadVideo` (not `<Video>`) so the CLI render extracts exact frames with
 * ffmpeg. `playbackRate` is never set — clips are CFR-30 on ingest, so frame n
 * maps 1:1. `trimBefore` skips the first `startInFrames` source frames (the
 * adjust-modal trim); the `<Loop>` period is the trimmed window so it repeats
 * cleanly.
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
