import React from "react";
import { Loop } from "remotion";
import { SmartVideo } from "../../SmartVideo";
import { useSceneDurationInFrames } from "../../SceneDurationContext";

/**
 * Drop-in video replacement for docreel's <Img> blocks (stock footage), ported
 * from Sakura's SakuraClip. Grayscale/contrast/brightness archive treatment is
 * applied by the CALLER's style prop (merged last), so a clip inherits exactly
 * the look the still had.
 *
 *  1. `SmartVideo`: during a CLI render it uses `OffthreadVideo`, which extracts
 *     the exact frame with ffmpeg, so output frames land on precise timestamps.
 *  2. `playbackRate` is never set. Clips are normalised to CFR 30 on ingest
 *     (backend/app/services/stock_footage.py), so composition frame n maps 1:1
 *     onto source frame n; any rate change re-introduces judder.
 */
export function DocReelClip({
  src,
  imageObjectPosition,
  imageZoom,
  muted = true,
  volume = 0.35,
  durationInFrames,
  startInFrames = 0,
  zoomedOut,
  style,
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
  /**
   * Overrides the `imageZoom < 1` framing decision. A caller that animates the
   * zoom (Ken Burns) must decide "contained vs cover" from the USER's own zoom,
   * not the animated product — otherwise a 0.95 zoom flips from contain to
   * cover partway through the scene as the drift pushes it past 1.
   */
  zoomedOut?: boolean;
  /** The layout's own styling (overlays, borders, archive filter) — wins. */
  style?: React.CSSProperties;
}) {
  const sceneDurationInFrames = useSceneDurationInFrames();
  const pos = imageObjectPosition ?? "50% 50%";
  const z = Math.max(0.1, imageZoom ?? 1);
  const isZoomedOut = zoomedOut ?? z < 1;
  const start = Math.max(0, Math.round(startInFrames || 0));

  const video = (
    <SmartVideo
      src={src}
      muted={muted}
      volume={muted ? 0 : Math.max(0, Math.min(1, volume))}
      trimBefore={start || undefined}
      style={{
        width: "100%",
        height: "100%",
        objectFit: isZoomedOut ? "contain" : "cover",
        objectPosition: isZoomedOut ? "center" : pos,
        transform: `scale(${z})`,
        transformOrigin: isZoomedOut ? "center center" : pos,
        display: "block",
        ...style,
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

  return loopFrames ? (
    <Loop durationInFrames={loopFrames}>{video}</Loop>
  ) : (
    video
  );
}
