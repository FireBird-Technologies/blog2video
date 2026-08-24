/**
 * Custom-template craft kit — motion primitives.
 *
 * Tested, frame-driven helpers so generated scenes get consistent, professional
 * motion instead of improvised spring math. Distilled from newscastLayoutMotion,
 * nightfallLayoutMotion and the easing used across laduc/economist.
 *
 * All animation is driven by the frame argument (Remotion requirement — never
 * time/Date-based) so renders are deterministic.
 */

import { interpolate, spring } from "remotion";

// ─── Easing ───────────────────────────────────────────────────

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

export function easeOutBack(t: number, overshoot = 1.70158): number {
  const c3 = overshoot + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Linear progress [0..1] for a window starting at `start` lasting `dur` frames. */
export function progressAt(frame: number, start: number, dur: number): number {
  if (dur <= 0) return frame >= start ? 1 : 0;
  return clamp01((frame - start) / dur);
}

/**
 * Eased 0→1 progress for stroke-dashoffset "draw-in" effects (SVG path / line
 * draw). Same window math as progressAt, eased with easeOutQuint so the stroke
 * decelerates as it completes. Multiply a dash length by `(1 - drawProgress(...))`
 * for strokeDashoffset.
 */
export function drawProgress(frame: number, start: number, dur: number): number {
  return easeOutQuint(progressAt(frame, start, dur));
}

/**
 * Deterministic pseudo-random in [0..1) from an integer index + salt. Shared by
 * the seeded decor/artifact components so renders never flicker (no Math.random
 * at render time). Same hash used in Decor.tsx.
 */
export function seededRand(i: number, salt = 1): number {
  const v = Math.sin(i * 127.1 * salt + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

// ─── Scene-level enter/exit ───────────────────────────────────

/**
 * Universal scene fade: fades in over the first `inDur` frames and out over the
 * last `outDur` frames. Returns a single opacity that every scene multiplies its
 * root by — the `masterOpacity = enter * exit` pattern used across all templates.
 */
export function masterOpacity(
  frame: number,
  durationInFrames: number,
  inDur = 16,
  outDur = 16,
): number {
  const enter = interpolate(frame, [0, inDur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(
    frame,
    [durationInFrames - outDur, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return enter * exit;
}

// ─── Entrance presets ─────────────────────────────────────────

export interface EntranceStyle {
  opacity: number;
  transform: string;
}

/**
 * Staggered entrance for list items: fade + slide-in, each item delayed by
 * `index * stagger` frames. Direction controls slide axis.
 */
export function staggerEntrance(
  frame: number,
  index: number,
  opts?: {
    start?: number;
    stagger?: number;
    dur?: number;
    distance?: number;
    axis?: "x" | "y";
  },
): EntranceStyle {
  const start = opts?.start ?? 0;
  const stagger = opts?.stagger ?? 8;
  const dur = opts?.dur ?? 18;
  const distance = opts?.distance ?? 28;
  const axis = opts?.axis ?? "y";
  const t = easeOutQuint(progressAt(frame, start + index * stagger, dur));
  const offset = (1 - t) * distance;
  return {
    opacity: t,
    transform: axis === "y" ? `translateY(${offset}px)` : `translateX(${offset}px)`,
  };
}

/**
 * Headline pop: scale overshoot + rise, for titles/key words. Spring-backed so
 * it feels organic; pass `fps` from useVideoConfig().
 */
export function headlinePop(
  frame: number,
  fps: number,
  opts?: { start?: number; damping?: number; stiffness?: number; mass?: number },
): EntranceStyle {
  const start = opts?.start ?? 0;
  const s = spring({
    frame: frame - start,
    fps,
    config: {
      damping: opts?.damping ?? 14,
      stiffness: opts?.stiffness ?? 200,
      mass: opts?.mass ?? 1.05,
    },
  });
  const scale = interpolate(s, [0, 1], [0.86, 1]);
  const y = interpolate(s, [0, 1], [24, 0]);
  return { opacity: clamp01(s * 1.4), transform: `translateY(${y}px) scale(${scale})` };
}

/** Panel rise: gentle slide-up + settle for cards/panels. */
export function panelRise(
  frame: number,
  fps: number,
  opts?: { start?: number },
): EntranceStyle {
  const s = spring({
    frame: frame - (opts?.start ?? 0),
    fps,
    config: { damping: 20, stiffness: 90, mass: 1 },
  });
  return {
    opacity: clamp01(s * 1.3),
    transform: `translateY(${interpolate(s, [0, 1], [36, 0])}px)`,
  };
}

// ─── Number formatting / count-up ─────────────────────────────

export interface ParsedValue {
  prefix: string;
  num: number;
  suffix: string;
  isFloat: boolean;
  decimals: number;
}

/** Parse "$1,234.5%" → {prefix:"$", num:1234.5, suffix:"%", isFloat:true}. */
export function parseValue(raw: string): ParsedValue | null {
  if (raw == null) return null;
  const m = String(raw).match(/^([^0-9.-]*)([+-]?[\d,]*\.?\d+)(.*)$/);
  if (!m) return null;
  const numStr = m[2].replace(/,/g, "");
  const num = parseFloat(numStr);
  if (!isFinite(num)) return null;
  const dotIdx = numStr.indexOf(".");
  const decimals = dotIdx >= 0 ? numStr.length - dotIdx - 1 : 0;
  return { prefix: m[1] ?? "", num, suffix: m[3] ?? "", isFloat: decimals > 0, decimals };
}

/**
 * Animated count-up string for a stat value. Rolls 0 → value over the window,
 * preserving prefix/suffix, decimals and thousands separators. Non-numeric
 * values are returned verbatim once the window starts.
 */
export function countUpString(
  raw: string,
  frame: number,
  opts?: { start?: number; dur?: number },
): string {
  const start = opts?.start ?? 0;
  const dur = opts?.dur ?? 34;
  const parsed = parseValue(raw);
  const t = easeInOutCubic(progressAt(frame, start, dur));
  if (!parsed) return t > 0.5 ? String(raw ?? "") : "";
  const cur = parsed.num * t;
  const body = parsed.isFloat
    ? cur.toFixed(parsed.decimals)
    : Math.round(cur).toLocaleString();
  return `${parsed.prefix}${body}${parsed.suffix}`;
}

// ─── Camera / depth ───────────────────────────────────────────
//
// Generated scenes were strictly flat 2D: the kit had no 3D primitive at all,
// while the hand-built templates (bloomberg, newscast, fj_research) lean on
// perspective and camera moves for much of their polish. These are the same
// techniques, packaged so a generated scene gets them without re-deriving the
// math — and so the perspective values stay in a range that cannot distort text
// or push content out of frame.
//
// All frame-driven, so renders stay deterministic.

export type CameraStyle = {
  /** Apply to the OUTER wrapper — establishes the 3D viewing volume. */
  perspective: string;
  transformStyle: "preserve-3d";
};

export type CameraTransform = {
  transform: string;
  transformStyle: "preserve-3d";
};

/**
 * The 3D stage. Put this on the element that WRAPS the moving layers; children
 * then share one viewing volume, which is what makes their motion read as depth
 * rather than as independent scaling.
 *
 * Larger depth = weaker perspective. 1400-2000 is the usable band: below ~900
 * the distortion becomes obvious on wide text.
 */
export function cameraStage(depth = 1600): CameraStyle {
  return {
    perspective: `${Math.max(900, Math.min(2600, depth))}px`,
    transformStyle: "preserve-3d",
  };
}

/**
 * A slow, continuous camera push with a settling tilt — the move that makes a
 * static composition feel filmed. Runs across the WHOLE scene rather than as an
 * entrance beat, so the shot never freezes.
 *
 * `intensity` 0..1 scales the whole move; keep it low (0.3-0.6) behind text.
 */
export function cameraPush(
  frame: number,
  durationInFrames: number,
  intensity = 0.5,
): CameraTransform {
  const k = clamp01(intensity);
  const span = Math.max(1, durationInFrames);
  const t = clamp01(frame / span);
  // Continuous push, plus a tilt that settles out over the first ~40 frames so
  // the scene arrives with motion and then steadies.
  const scale = 1 + 0.06 * k * t;
  const rotX = interpolate(frame, [0, 40], [2.4 * k, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateZ = 40 * k * t;
  return {
    transform: `scale(${scale.toFixed(4)}) rotateX(${rotX.toFixed(3)}deg) translateZ(${translateZ.toFixed(2)}px)`,
    transformStyle: "preserve-3d",
  };
}

/**
 * A layer that drifts at its own rate inside a cameraStage. Give the backdrop a
 * NEGATIVE depth and the foreground a positive one so they separate — opposing
 * directions at different speeds is what reads as parallax.
 */
export function parallaxLayer(
  frame: number,
  durationInFrames: number,
  depth = 1,
  intensity = 0.5,
): CameraTransform {
  const k = clamp01(intensity);
  const span = Math.max(1, durationInFrames);
  const t = frame / span;
  const x = -26 * depth * k * t;
  const y = -14 * depth * k * t;
  const z = 30 * depth * k;
  return {
    transform: `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px)`,
    transformStyle: "preserve-3d",
  };
}

/**
 * A panel that rises with a forward tilt that settles — the newscast glass-panel
 * move, generalised. Use for cards and surfaces entering the frame.
 */
export function panelTilt(
  frame: number,
  delayFrames = 0,
  intensity = 0.5,
): CameraTransform & { opacity: number } {
  const k = clamp01(intensity);
  const f = frame - delayFrames;
  const y = interpolate(f, [0, 12, 26, 38], [70 * k, -10 * k, 5 * k, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotX = interpolate(f, [0, 14, 30], [13 * k, -2.6 * k, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(f, [0, 10, 24], [1 - 0.06 * k, 1 + 0.02 * k, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(f, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return {
    transform: `translateY(${y.toFixed(2)}px) rotateX(${rotX.toFixed(3)}deg) scale(${scale.toFixed(4)})`,
    transformStyle: "preserve-3d",
    opacity,
  };
}
