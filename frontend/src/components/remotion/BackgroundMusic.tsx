import { Audio, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/** Minimal per-scene shape needed for volume automation. */
interface SceneVol {
  durationSeconds?: number | null;
  bgmVolume?: number | null;
}

interface BackgroundMusicProps {
  src: string;
  /** Project-level default volume (0..1). Used when a scene has no override. */
  volume?: number;
  /**
   * Optional per-scene volume automation. When provided, the single looping
   * track changes volume as the playhead moves across scenes — a scene's own
   * `bgmVolume` (0..1) overrides the project default for that scene's span.
   * Volume glides smoothly (~0.3s) across scene boundaries instead of snapping.
   * The composition runs at speed 1.0, so frames = durationSeconds * fps.
   */
  scenes?: SceneVol[];
}

export const BackgroundMusic: React.FC<BackgroundMusicProps> = ({
  src,
  volume = 0.10,
  scenes,
}) => {
  // IMPORTANT: use the absolute composition frame. We must NOT pass a function
  // to <Audio volume>, because with `loop` Remotion calls that function with a
  // frame relative to each loop iteration — which would replay the per-scene
  // volume pattern on every loop. Computing a plain number from useCurrentFrame
  // keeps the volume tied to absolute video time.
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const fadeInFrames = fps;
  const fadeOutFrames = fps * 2;

  // Resolve the per-scene volume for the current absolute frame, gliding across
  // scene boundaries so the volume eases between scenes instead of snapping.
  let base = volume;
  if (scenes && scenes.length > 0) {
    const spans: { start: number; end: number; vol: number }[] = [];
    let acc = 0;
    for (const s of scenes) {
      const dur = Math.max(1, Math.round((Number(s.durationSeconds) || 5) * fps));
      const v =
        s.bgmVolume === null || s.bgmVolume === undefined ? volume : s.bgmVolume;
      spans.push({ start: acc, end: acc + dur, vol: v });
      acc += dur;
    }
    const ramp = Math.max(1, Math.round(fps * 0.3)); // ~0.3s glide
    base = spans[spans.length - 1].vol; // past the final boundary
    for (let i = 0; i < spans.length; i++) {
      const sp = spans[i];
      if (frame < sp.end) {
        const next = spans[i + 1];
        const rampStart = sp.end - Math.min(ramp, Math.round((sp.end - sp.start) / 2));
        if (next && frame > rampStart) {
          const t = Math.max(0, Math.min(1, (frame - rampStart) / (sp.end - rampStart)));
          base = sp.vol + (next.vol - sp.vol) * t;
        } else {
          base = sp.vol;
        }
        break;
      }
    }
  }

  const fadeIn = interpolate(frame, [0, fadeInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - fadeOutFrames, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const currentVolume = base * fadeIn * fadeOut;

  return <Audio loop src={src} volume={currentVolume} />;
};
