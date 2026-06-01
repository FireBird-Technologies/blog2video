import React from "react";
import { Img, interpolate, useCurrentFrame } from "remotion";

interface EmbossedImageProps {
  src: string;
  objectPosition?: string;
  zoom?: number;
  /** Rotation in degrees applied to the card (daguerreotype pasted feel). */
  rotate?: number;
  /** Scene-frame at which the reveal animation should start. */
  revealStart?: number;
  /** Disable the sepia / reveal animations (full opacity from frame 0). */
  instant?: boolean;
  /** Optional style overrides for the outer card. */
  style?: React.CSSProperties;
  /** Controls how thick the cream paper mat is, in px (default 14). */
  matSize?: number;
  /** Add a faint ink-bordered frame inside the mat. */
  inkFrame?: boolean;
}

/**
 * EmbossedImage — reusable aged-photo card used across Chronicle layouts.
 *
 * Treatment (all always applied):
 *   - Cream paper mat with inner shadow (emboss / pressed-into-page feel)
 *   - Sepia + light grain overlay on the image itself
 *   - Soft worn edges via clip-path
 *   - Subtle ink border inside the mat
 *   - Drop shadow to lift it off the parchment
 *   - Optional radial ink-bleed reveal (0 → 1 over first 20 frames)
 */
export const EmbossedImage: React.FC<EmbossedImageProps> = ({
  src,
  objectPosition,
  zoom,
  rotate = 0,
  revealStart = 0,
  instant = false,
  style,
  matSize = 14,
  inkFrame = true,
}) => {
  const frame = useCurrentFrame();
  const local = frame - revealStart;

  const revealProgress = instant
    ? 1
    : interpolate(local, [0, 20], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const sepiaAmount = instant ? 0.55 : interpolate(revealProgress, [0, 1], [0.85, 0.55]);
  const blurAmount = instant ? 0 : interpolate(revealProgress, [0, 1], [8, 0]);

  // Radial clip-path for "ink spread" reveal: circle grows from center
  const clipRadius = instant ? 120 : interpolate(revealProgress, [0, 1], [0, 120]);

  return (
    <div
      style={{
        background: "#F8EFD6",
        padding: matSize,
        boxShadow:
          "0 14px 38px rgba(40,25,12,0.35), inset 0 0 0 1px rgba(40,25,12,0.15), inset 0 4px 10px rgba(40,25,12,0.15)",
        transform: `rotate(${rotate}deg)`,
        position: "relative",
        ...style,
      }}
    >
      {/* Inner ink frame (thin double-lined) */}
      {inkFrame && (
        <div
          style={{
            position: "absolute",
            inset: matSize - 3,
            border: "1px solid rgba(40,25,12,0.55)",
            outline: "1px solid rgba(40,25,12,0.25)",
            outlineOffset: 3,
            pointerEvents: "none",
            zIndex: 4,
          }}
        />
      )}

      {/* Image with sepia + ink-spread reveal */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          clipPath: `circle(${clipRadius}% at 50% 50%)`,
        }}
      >
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: (zoom ?? 1) < 1 ? "contain" : "cover",
            objectPosition: (zoom ?? 1) < 1 ? "center" : (objectPosition ?? "50% 50%"),
            transform: `scale(${zoom ?? 1})`,
            transformOrigin: (zoom ?? 1) < 1 ? "center center" : (objectPosition ?? "50% 50%"),
            filter: `sepia(${sepiaAmount}) saturate(0.85) contrast(1.05) brightness(0.94) blur(${blurAmount}px)`,
            display: "block",
          }}
        />

        {/* Grain overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(rgba(60,40,20,0.25) 1px, transparent 1px)",
            backgroundSize: "3px 3px",
            mixBlendMode: "multiply",
            opacity: 0.35,
            pointerEvents: "none",
          }}
        />

        {/* Warm vignette inside photo */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at center, transparent 55%, rgba(40,25,12,0.45) 100%)",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
};
