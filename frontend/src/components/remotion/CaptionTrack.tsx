import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CAPTION_FONT_FAMILY } from "../../fonts/captionFont";

export type CaptionPosition = "top_center" | "bottom_center";

interface CaptionTrackProps {
  /** Full text for this scene (the scene's spoken narration). */
  text: string;
  position?: CaptionPosition | string;
  aspectRatio?: string; // "landscape" | "portrait"
  /** Ignored — captions always render in Inter. */
  fontFamily?: string;
  /** Max words shown per caption chunk. */
  maxWordsPerChunk?: number;
  /**
   * Length of the spoken audio for this scene, in frames. Captions are spread
   * across ONLY this window so they track the voiceover and don't drift into the
   * silent tail (scene duration includes ~1s pad + extra hold). When omitted or
   * <= 0, falls back to the full scene window.
   */
  speechDurationFrames?: number;
}

/**
 * Renders the scene's narration as on-screen captions, split into short phrases
 * shown sequentially across the spoken portion of the scene. Designed to live
 * INSIDE a scene <Sequence>, so frame 0 is the scene (and voiceover) start.
 *
 * There are no real per-word timestamps, so each chunk is allotted time
 * proportional to its CHARACTER length (a better proxy for speech duration than
 * word count) across the speech window.
 */
export const CaptionTrack: React.FC<CaptionTrackProps> = ({
  text,
  position = "bottom_center",
  aspectRatio = "landscape",
  maxWordsPerChunk = 8,
  speechDurationFrames,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait" || height > width;

  const chunks = React.useMemo(
    () => splitIntoCaptionChunks(text, maxWordsPerChunk),
    [text, maxWordsPerChunk],
  );

  if (chunks.length === 0 || durationInFrames <= 0) return null;

  // Window the captions run across: the speech length when known, else the full
  // scene. Clamp to the scene window so we never exceed the Sequence.
  const window =
    speechDurationFrames && speechDurationFrames > 0
      ? Math.min(speechDurationFrames, durationInFrames)
      : durationInFrames;

  // Allocate time to each chunk proportional to its character length — closer to
  // actual speaking time than word count (short function words read fast).
  const weights = chunks.map((c) => Math.max(1, c.replace(/\s+/g, " ").trim().length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let acc = 0;
  const ranges = chunks.map((chunk, i) => {
    const start = Math.round((acc / totalWeight) * window);
    acc += weights[i]!;
    const end =
      i === chunks.length - 1
        ? window
        : Math.round((acc / totalWeight) * window);
    return { chunk, start, end: Math.max(start + 1, end) };
  });

  // Show the chunk for the current frame. Before the first / after the last
  // chunk's window (the silent tail) show nothing rather than letting the last
  // caption linger over silence.
  const active = ranges.find((r) => frame >= r.start && frame < r.end);
  if (!active) return null;

  const opacity = captionChunkOpacity(frame, active.start, active.end);

  // Responsive font sizing, mirroring LogoOverlay's landscape/portrait split.
  const fontSize = isPortrait ? Math.round(width * 0.036) : Math.round(width * 0.020);

  const verticalStyle: React.CSSProperties =
    position === "top_center" ? { top: "6%" } : { bottom: "8%" };

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        ...verticalStyle,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 30,
      }}
    >
      <span
        style={{
          opacity,
          maxWidth: "80%",
          textAlign: "center",
          color: "#FFFFFF",
          fontFamily: CAPTION_FONT_FAMILY,
          fontSize,
          fontWeight: 600,
          lineHeight: 1.25,
          // Plain text + drop-shadow (no background bar) for legibility on any scene.
          textShadow:
            "0 2px 6px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.9), 0 1px 1px rgba(0,0,0,0.95)",
          whiteSpace: "pre-wrap",
        }}
      >
        {active.chunk}
      </span>
    </div>
  );
};

const CAPTION_FADE_FRAMES = 4;

/** Fade opacity for one caption chunk; input range stays strictly increasing. */
function captionChunkOpacity(frame: number, start: number, end: number): number {
  const span = end - start;
  if (span <= 1) return 1;

  const fade = Math.min(CAPTION_FADE_FRAMES, Math.floor((span - 1) / 2));
  if (fade <= 0 || span <= 2 * fade) {
    const mid = start + span / 2;
    return interpolate(
      frame,
      [start, mid, end],
      [0, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
  }

  return interpolate(
    frame,
    [start, start + fade, end - fade, end],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
}

/**
 * Split narration into readable caption chunks: break on sentence/clause
 * punctuation first, then hard-wrap any run longer than `maxWords`.
 */
export function splitIntoCaptionChunks(text: string, maxWords = 8): string[] {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];

  // Split on sentence/clause boundaries while keeping it simple and robust.
  const segments = clean
    .split(/(?<=[.!?,;:—])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const seg of segments) {
    const words = seg.split(/\s+/);
    if (words.length <= maxWords) {
      chunks.push(seg);
      continue;
    }
    for (let i = 0; i < words.length; i += maxWords) {
      chunks.push(words.slice(i, i + maxWords).join(" "));
    }
  }
  return chunks;
}
