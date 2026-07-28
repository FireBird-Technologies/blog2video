import React from "react";
import { Loop, OffthreadVideo } from "remotion";
import { useSceneDurationInFrames } from "../../SceneDurationContext";

/**
 * Drop-in video replacement for whiteboard's `<Img>` blocks (stock footage).
 *
 * Each whiteboard image layout owns its own wrapper styling — Ken Burns motion,
 * glow overlays, rounded inset cards, full-bleed hero. So this component takes
 * the caller's `style` and merges it LAST, letting a clip inherit exactly the
 * look the still had.
 *
 * Two deliberate choices, carried over from the verified Newspaper/Newscast
 * components:
 *  1. `OffthreadVideo` (not `<Video>`): during a CLI render Remotion extracts the
 *     exact frame with ffmpeg, so output frames land on precise timestamps.
 *  2. `playbackRate` is never set. Clips are normalised to CFR 30 on ingest
 *     (backend/app/services/stock_footage.py), so composition frame n maps 1:1
 *     onto source frame n; any rate change re-introduces judder.
 *
 * `trimBefore` skips the first `startInFrames` source frames (the adjust-modal
 * trim); the `<Loop>` period is the trimmed window so it repeats cleanly.
 */
export function WhiteboardClip({
  src,
  imageObjectPosition,
  imageZoom,
  muted = true,
  volume = 0.35,
  durationInFrames,
  startInFrames = 0,
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
  /** The layout's own styling (overlays, borders, Ken Burns transform) — wins. */
  style?: React.CSSProperties;
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
        width: "100%",
        height: "100%",
        // Same framing math as the <Img> this replaces, so focus/zoom set in the
        // adjust modal renders identically for a clip and a still.
        objectFit: isZoomedOut ? "contain" : "cover",
        objectPosition: isZoomedOut ? "center" : pos,
        transform: `scale(${z})`,
        transformOrigin: isZoomedOut ? "center center" : pos,
        display: "block",
        ...style,
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

  // layout="none": <Loop> renders a <Sequence>, which defaults to an AbsoluteFill
  // wrapper. That wrapper contributes no intrinsic height, so in a flex/auto-height
  // caller (e.g. GlowMetric's image section) a height:100% clip collapses to 0 and
  // renders invisibly. "none" drops the wrapper so the video flows exactly like the
  // <Img> it replaces and sizes to its container the same way.
  return loopFrames ? (
    <Loop durationInFrames={loopFrames} layout="none">{video}</Loop>
  ) : (
    video
  );
}
