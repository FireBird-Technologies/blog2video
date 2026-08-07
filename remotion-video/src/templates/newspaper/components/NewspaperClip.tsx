import React from "react";
import { Loop, interpolate } from "remotion";
import { SmartVideo } from "../../SmartVideo";
import { useSceneDurationInFrames } from "../../SceneDurationContext";

/**
 * Drop-in video replacement for Newspaper's `<Img>` blocks.
 *
 * Unlike Newscast's ZoomCropVideo — which is a full-bleed background plate and
 * hardcodes `position:absolute; inset:0` — Newspaper's images are IN-FLOW inset
 * panels (a torn-paper cutout, a portrait headshot) carrying the template's
 * newsprint styling: grayscale/sepia/contrast filters, clip-path cutouts and a
 * blur-in. So this component takes the caller's `style` and merges it LAST,
 * letting each layout keep exactly the look it already had.
 *
 * Two deliberate choices, carried over from the verified Newscast component:
 *
 * 1. `SmartVideo`: during a CLI render it uses `OffthreadVideo`, which extracts the
 *    exact frame with ffmpeg rather than driving a real <video> element, so
 *    output frames land on precise timestamps.
 *
 * 2. `playbackRate` is never set. Clips are normalised to CFR 30 fps on ingest
 *    (backend/app/services/stock_footage.py) to match the composition, so
 *    composition frame n maps 1:1 onto source frame n. Any rate change
 *    re-introduces the fractional sampling — i.e. judder — that normalising
 *    exists to remove.
 *
 * Neither video primitive has a `loop` prop, so repetition uses the separate <Loop>
 * component. Without a known clip length we cannot pick a loop point, so the
 * clip plays once rather than cutting at a guessed frame.
 */
export function NewspaperClip({
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
  /** The layout's own styling (newsprint filter, display, etc.) — wins. */
  style?: React.CSSProperties;
}) {
  const sceneDurationInFrames = useSceneDurationInFrames();
  const pos = imageObjectPosition ?? "50% 50%";
  const z = Math.max(0.1, imageZoom ?? 1);
  const isZoomedOut = z < 1;
  const start = Math.max(0, Math.round(startInFrames || 0));

  const video = (
    <SmartVideo
      src={src}
      muted={muted}
      volume={muted ? 0 : Math.max(0, Math.min(1, volume))}
      // Skip the first `start` source frames so the scene shows the chosen
      // portion of a longer clip rather than always the opening seconds.
      trimBefore={start || undefined}
      style={{
        width: "100%",
        height: "100%",
        // Same framing math as the <Img> this replaces, so focus/zoom set in
        // the adjust modal renders identically for a clip and a still.
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

  return loopFrames ? (
    <Loop durationInFrames={loopFrames}>{video}</Loop>
  ) : (
    video
  );
}

/**
 * The template's signature newsprint treatment: a dissolve-in blur plus the
 * grayscale/sepia/contrast grade. Shared by every image AND clip so the two are
 * visually indistinguishable in style — a full-colour video would look pasted
 * onto the vintage paper.
 */
export const NEWSPRINT_FILTER = (frame: number): string =>
  `blur(${interpolate(frame, [0, 20], [10, 0], { extrapolateRight: "clamp" })}px) grayscale(20%) sepia(25%) contrast(120%) brightness(95%)`;
