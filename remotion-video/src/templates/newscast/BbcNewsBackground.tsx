import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

const BBC_RED = "#E60000";

/**
 * BBC-TV inspired background (clean, no newspaper texture).
 * Used by `newscast` layouts only.
 */
export const BbcNewsBackground: React.FC<{
  mode?: "none" | "breaking";
}> = ({ mode = "none" }) => {
  const frame = useCurrentFrame();

  // Subtle deterministic "TV graphics" motion (no translation jitter).
  const scanOpacity = Math.max(0.10, Math.min(0.26, 0.16 + 0.06 * Math.sin(frame * 0.08)));
  const vignetteOpacity = Math.max(0.35, Math.min(0.70, 0.52 + 0.12 * Math.sin(frame * 0.06 + 1)));
  const stripOpacity =
    mode === "breaking" ? Math.max(0.62, Math.min(1, 0.86 + 0.12 * Math.sin(frame * 0.07))) : 0.0;

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, backgroundColor: "#FFFFFF" }} />

      {/* Scanlines */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 1px, rgba(255,255,255,0) 2px)",
          opacity: scanOpacity,
          pointerEvents: "none",
          mixBlendMode: "multiply",
        }}
      />

      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.08) 100%)",
          opacity: vignetteOpacity,
          pointerEvents: "none",
        }}
      />

      {mode === "breaking" && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 74,
            background: `linear-gradient(135deg, ${BBC_RED} 0%, ${BBC_RED}E6 50%, ${BBC_RED}99 100%)`,
            opacity: stripOpacity,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

