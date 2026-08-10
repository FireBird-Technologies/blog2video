/**
 * Custom-template craft kit — KenBurnsImage.
 *
 * Image treatment with a slow Ken Burns push + reveal, honoring the user's
 * focus (imageObjectPosition) and zoom (imageZoom) controls. Optional gradient
 * scrim for text legibility. Generalized from chronicle EmbossedImage and
 * bloomberg ZoomCropImg.
 *
 * NOTE: deliberately does NOT set data-content-img — it owns its own animated
 * transform; the user's zoom is folded into the animation instead of being
 * overridden by the global focus/zoom CSS in GeneratedVideo.
 */

import React from "react";
import { Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useKit } from "./context";
import { withAlpha } from "./theme";

export interface KenBurnsImageProps {
  src: string;
  objectPosition?: string;
  /** Base zoom from user controls (default 1). Ken Burns adds on top. */
  zoom?: number;
  /** Gradient scrim for overlaying text. */
  scrim?: "none" | "bottom" | "full" | "left";
  /** Reveal style. */
  reveal?: "fade" | "wipe-up" | "none";
  start?: number;
  radius?: number;
  /** Push direction/strength of the Ken Burns move. */
  drift?: number;
  style?: React.CSSProperties;
}

export const KenBurnsImage: React.FC<KenBurnsImageProps> = ({
  src,
  objectPosition = "50% 50%",
  zoom = 1,
  scrim = "none",
  reveal = "fade",
  start = 0,
  radius = 0,
  drift = 0.06,
  style,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { palette } = useKit();
  if (!src || typeof src !== "string") return null;

  const base = Math.max(0.1, zoom);
  // Slow continuous push across the whole scene.
  const kb = interpolate(frame, [0, durationInFrames], [base, base + drift], {
    extrapolateRight: "clamp",
  });
  const revealOp =
    reveal === "none"
      ? 1
      : interpolate(frame, [start, start + 18], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const clipInset =
    reveal === "wipe-up"
      ? interpolate(frame, [start, start + 22], [100, 0], {
          extrapolateRight: "clamp",
          extrapolateLeft: "clamp",
        })
      : 0;

  const scrimCss =
    scrim === "bottom"
      ? `linear-gradient(to top, ${withAlpha(palette.bg, 0.92)} 0%, transparent 60%)`
      : scrim === "left"
        ? `linear-gradient(to right, ${withAlpha(palette.bg, 0.92)} 0%, transparent 60%)`
        : scrim === "full"
          ? `radial-gradient(circle at center, transparent 30%, ${withAlpha(palette.bg, 0.55)} 100%)`
          : undefined;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius: radius,
        opacity: revealOp,
        clipPath: clipInset ? `inset(${clipInset}% 0 0 0)` : undefined,
        ...style,
      }}
    >
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition,
          transform: `scale(${kb})`,
          transformOrigin: objectPosition,
        }}
      />
      {scrimCss && (
        <div style={{ position: "absolute", inset: 0, background: scrimCss, pointerEvents: "none" }} />
      )}
    </div>
  );
};
