import { useState } from "react";

/**
 * A roster presenter shown as its REAL rendered clip, falling back to the still.
 *
 * A static portrait cannot convey what this feature produces — the lip-sync and
 * head motion are the product. So each preset ships a short muted sample clip
 * (frontend/public/avatars/<id>.mp4, rendered from the same portrait by
 * scratchpad/render_preset_samples.py) and we play it here.
 *
 * Robustness matters more than the video: if a clip is missing or fails to
 * decode, `onError` drops us to the .jpg permanently rather than showing a broken
 * frame. The poster attribute means the still is what paints first regardless, so
 * there is never an empty box while the video loads.
 *
 * `playing` gates decoding: a grid of five simultaneously-decoding videos is real
 * CPU for something the user may only glance at, so callers play on hover or on
 * selection rather than always.
 */
export default function AvatarPresetMedia({
  presetId,
  label,
  /** Custom-portrait URL — no sample clip exists for a user's own photo. */
  srcOverride,
  playing = false,
  className = "",
  style,
}: {
  presetId: string;
  label: string;
  srcOverride?: string | null;
  playing?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [videoFailed, setVideoFailed] = useState(false);

  const still = srcOverride || `/avatars/${presetId}.jpg`;
  // Only the built-in roster has pre-rendered samples; an uploaded photo is a
  // still until the user actually generates a scene with it.
  const clip = srcOverride || videoFailed ? null : `/avatars/${presetId}.mp4`;

  if (!clip) {
    return (
      <img src={still} alt={label} className={className} style={style} />
    );
  }

  return (
    <video
      key={playing ? "on" : "off"}
      src={clip}
      poster={still}
      muted
      loop
      playsInline
      autoPlay={playing}
      // Fetch metadata only until we actually want to play, so a five-tile grid
      // does not pull five clips on mount.
      preload={playing ? "auto" : "none"}
      onError={() => setVideoFailed(true)}
      className={className}
      style={style}
      aria-label={label}
    />
  );
}
