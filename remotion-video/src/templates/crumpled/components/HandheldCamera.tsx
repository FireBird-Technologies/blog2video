/**
 * Handheld camera over the whole Crumpled video — as if the paper on the desk were being
 * filmed with a phone: the frame gently sways, tilts and breathes, with a faint hand
 * tremor, and the daylight on the paper shifts a little. Wraps every scene, so paper,
 * writing, notes and charts all move together; overlays rendered outside it (logo,
 * captions, avatar) stay steady.
 *
 * Driven by the composition's GLOBAL frame, so the motion is continuous across scene
 * cuts. Deterministic sums of sines with incommensurate frequencies (never visibly loops).
 *
 * Mirror byte-identical in both trees (remotion-video + frontend).
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

/** Smooth pseudo-noise in about [-1, 1]: a few sines at unrelated frequencies (Hz) and phases. */
const wobble = (t: number, parts: Array<[number, number, number]>) =>
  parts.reduce((sum, [hz, amp, phase]) => sum + Math.sin(t * hz * Math.PI * 2 + phase) * amp, 0);

export const HandheldCamera: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const k = Math.min(width, height) / 1080;

  // Slow sway of the hand + a faint faster tremor.
  const x = (wobble(t, [[0.17, 0.62, 0.4], [0.29, 0.38, 2.1]]) * 8 + wobble(t, [[1.31, 0.6, 0.9], [1.73, 0.4, 3.3]]) * 1) * k;
  const y = (wobble(t, [[0.13, 0.55, 1.7], [0.23, 0.45, 0.2]]) * 6 + wobble(t, [[1.12, 0.6, 2.6], [1.57, 0.4, 0.7]]) * 1) * k;
  const rot = wobble(t, [[0.11, 0.6, 0.9], [0.19, 0.4, 2.8]]) * 0.4;
  // Overscan so the edges never show, breathing slightly in and out.
  const scale = 1.045 + wobble(t, [[0.07, 0.7, 0.3], [0.12, 0.3, 1.9]]) * 0.008;

  // Daylight on the paper drifting across and gently changing in strength.
  const lx = 50 + wobble(t, [[0.05, 0.7, 1.2], [0.09, 0.3, 0.1]]) * 22;
  const ly = 38 + wobble(t, [[0.06, 0.6, 2.4], [0.1, 0.4, 0.8]]) * 14;
  const light = 0.05 + wobble(t, [[0.21, 0.6, 0.5], [0.37, 0.4, 1.6]]) * 0.02;

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${rot.toFixed(3)}deg) scale(${scale.toFixed(4)})`,
          transformOrigin: "50% 50%",
        }}
      >
        {children}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: `radial-gradient(ellipse 70% 60% at ${lx.toFixed(1)}% ${ly.toFixed(1)}%, rgba(255,255,255,${(light * 2).toFixed(3)}) 0%, rgba(255,255,255,0) 60%, rgba(40,32,24,${light.toFixed(3)}) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
