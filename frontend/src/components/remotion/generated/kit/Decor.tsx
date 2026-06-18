/**
 * Custom-template craft kit — Decor.
 *
 * OPTIONAL restrained background decoration keyed to the brand's decor system.
 * One component, several systems, so generated scenes can add subtle brand
 * atmosphere without hand-rolling SVG. Generalized from the backdrops across
 * nightfall (starfield/glow), bloomberg (grid) and chronicle (accent rules).
 *
 * Deterministic (seeded) so it never flickers across frames.
 */

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useKit } from "./context";
import { withAlpha } from "./theme";

export type DecorSystem =
  | "none"
  | "dots"
  | "grid"
  | "orbs"
  | "starfield"
  | "rules"
  | "vignette"
  // v3 signature systems — give each brand a distinct atmosphere, not a recolor.
  | "hairlines" // editorial: evenly-spaced thin rules
  | "mesh" // tech/SaaS: soft blurred colour mesh
  | "ticker" // fintech: baseline tick marks
  | "concentric" // editorial/luxury: concentric rings
  | "wash"; // luxury/lifestyle: large soft diagonal accent wash

export interface DecorProps {
  system?: DecorSystem;
  /** 0..1 — overall strength. */
  intensity?: number;
  color?: string;
}

function seeded(i: number, salt = 1): number {
  const v = Math.sin(i * 127.1 * salt + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

export const Decor: React.FC<DecorProps> = ({ system = "none", intensity = 0.5, color }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const { palette } = useKit();
  const c = color ?? palette.accent;
  const k = Math.max(0, Math.min(1, intensity));
  if (system === "none" || k <= 0) return null;

  if (system === "vignette") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(circle at 50% 45%, transparent 45%, ${withAlpha(palette.bg, 0.5 * k)} 100%)`,
        }}
      />
    );
  }

  if (system === "dots" || system === "grid") {
    const gap = 46;
    const dot = withAlpha(palette.text, 0.06 * (0.6 + k));
    const bg =
      system === "dots"
        ? `radial-gradient(${dot} 1.5px, transparent 1.6px)`
        : `linear-gradient(${dot} 1px, transparent 1px), linear-gradient(90deg, ${dot} 1px, transparent 1px)`;
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: bg,
          backgroundSize: `${gap}px ${gap}px`,
          maskImage: "radial-gradient(circle at 50% 50%, black 30%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 30%, transparent 85%)",
        }}
      />
    );
  }

  if (system === "rules") {
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "18%", left: 0, right: 0, height: 1, background: withAlpha(c, 0.18 * k) }} />
        <div style={{ position: "absolute", bottom: "18%", left: 0, right: 0, height: 1, background: withAlpha(c, 0.18 * k) }} />
      </div>
    );
  }

  if (system === "hairlines") {
    // Editorial: a stack of evenly-spaced thin rules — quiet, structured.
    const lines = 7;
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "8%",
              right: "8%",
              top: `${(100 / (lines + 1)) * (i + 1)}%`,
              height: 1,
              background: withAlpha(palette.text, 0.07 * (0.6 + k)),
            }}
          />
        ))}
      </div>
    );
  }

  if (system === "ticker") {
    // Fintech: a baseline of tick marks — terminal/market feel. Static (no
    // per-frame motion) to avoid headless-render flicker.
    const ticks = 48;
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: "12%", height: 1, background: withAlpha(c, 0.22 * k) }} />
        {Array.from({ length: ticks }).map((_, i) => {
          const tall = i % 6 === 0;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                bottom: "12%",
                left: `${(100 / ticks) * i}%`,
                width: 1,
                height: tall ? 14 : 7,
                background: withAlpha(c, (tall ? 0.3 : 0.16) * k),
              }}
            />
          );
        })}
      </div>
    );
  }

  if (system === "wash") {
    // Luxury/lifestyle: a large soft diagonal accent wash.
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `linear-gradient(125deg, ${withAlpha(c, 0.14 * k)} 0%, transparent 42%, transparent 60%, ${withAlpha(c, 0.08 * k)} 100%)`,
        }}
      />
    );
  }

  // SVG-based: orbs / starfield / mesh / concentric
  return (
    <svg
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {system === "orbs" &&
        Array.from({ length: 3 }).map((_, i) => {
          const cx = seeded(i, 2) * width;
          const cy = seeded(i, 5) * height;
          const r = (180 + seeded(i, 7) * 220) * (0.7 + k);
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill={withAlpha(c, 0.07 * k)} />
          );
        })}
      {system === "starfield" &&
        Array.from({ length: Math.round(80 * (0.5 + k)) }).map((_, i) => {
          const x = seeded(i, 1) * width;
          const y = seeded(i, 3) * height;
          const r = 0.6 + seeded(i, 9) * 1.4;
          const period = 2 + seeded(i, 11) * 3;
          const twinkle =
            0.4 + 0.4 * Math.sin((frame / fps) * ((2 * Math.PI) / period) + seeded(i, 13) * 6);
          return (
            <circle key={i} cx={x} cy={y} r={r} fill={withAlpha(palette.text, twinkle * k)} />
          );
        })}
      {system === "mesh" && (
        <g>
          <defs>
            <radialGradient id="kit-mesh-a" cx="22%" cy="28%" r="55%">
              <stop offset="0%" stopColor={withAlpha(c, 0.16 * k)} />
              <stop offset="100%" stopColor={withAlpha(c, 0)} />
            </radialGradient>
            <radialGradient id="kit-mesh-b" cx="80%" cy="72%" r="55%">
              <stop offset="0%" stopColor={withAlpha(palette.text, 0.1 * k)} />
              <stop offset="100%" stopColor={withAlpha(palette.text, 0)} />
            </radialGradient>
          </defs>
          <rect x={0} y={0} width={width} height={height} fill="url(#kit-mesh-a)" />
          <rect x={0} y={0} width={width} height={height} fill="url(#kit-mesh-b)" />
        </g>
      )}
      {system === "concentric" &&
        Array.from({ length: 5 }).map((_, i) => {
          const r = (Math.min(width, height) * 0.12) * (i + 1);
          return (
            <circle
              key={i}
              cx={width / 2}
              cy={height * 0.5}
              r={r}
              fill="none"
              stroke={withAlpha(c, 0.1 * k)}
              strokeWidth={1}
            />
          );
        })}
    </svg>
  );
};
