/**
 * Shared Sakura design system — palette, washi backgrounds, patterns,
 * soft five-petal blossoms, petal rain, dividers and the petal-gust
 * scene transition. Every sakura layout imports from here.
 *
 * IMPORTANT: this file exists in BOTH trees and must stay byte-identical:
 *   remotion-video/src/templates/sakura/sakuraStyle.tsx
 *   frontend/src/components/remotion/sakura/sakuraStyle.tsx
 */
import React, { useId, useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import "@fontsource/noto-serif-jp/400.css";
import "@fontsource/noto-serif-jp/700.css";
import "@fontsource/shippori-mincho/400.css";
import "@fontsource/shippori-mincho/600.css";

// ─── Palette (single source of truth) ────────────────────────────────────────

export const SAKURA = {
  ink: "#1A0A0F", // sumi ink — near-black with deep red undertone
  washi: "#FDF6F0", // washi paper — warm off-white
  blush: "#F4B8C8", // sakura petal — soft pink
  deepBlush: "#E8739A", // deeper petal / flower center
  crimson: "#C0143C", // Japanese lacquer red — accent
  mist: "#E8D5DF", // pale pink mist
  gold: "#C9A84C", // aged gold for labels
  plum: "#4A1220", // dark wash center
  void: "#080305", // dark wash edge
};

export const SAKURA_DISPLAY_FONT =
  "'Noto Serif JP', 'Hiragino Mincho ProN', Georgia, 'Times New Roman', serif";
export const SAKURA_BODY_FONT =
  "'Shippori Mincho', 'Hiragino Mincho ProN', Georgia, 'Times New Roman', serif";
export const SAKURA_DETAIL_FONT = "'Courier New', monospace";

// ─── Global tempo ────────────────────────────────────────────────────────────

/**
 * Master slow-motion factor for ALL frame-driven Sakura animation. The clock
 * used by scene entrances, blossoms, brush strokes, petal rain, the growing
 * tree and every continuous sway advances at this fraction of real time, so
 * < 1 slows everything down uniformly (0.8 ≈ 25% slower / more natural).
 *
 * Raise toward 1 to speed motion back up; lower for an even more meditative
 * pace. NOTE: this scales *motion*, not scene length — durations still come
 * from the backend. The between-scene transition length is tuned separately
 * via SAKURA_TRANSITION_FRAMES in sakuraTransitions.tsx (kept in step: ~55/0.8).
 */
export const SAKURA_TEMPO = 0.8;

/**
 * Tempo-scaled frame counter. Use INSTEAD of `useCurrentFrame()` for any
 * animation that should obey the global slow-mo — i.e. everything that plays
 * from the scene's start or loops continuously.
 *
 * Do NOT use this where the frame is measured relative to the scene END (e.g.
 * an exit fade keyed off `dur - exitFrames`): those must stay on the real clock
 * or they will never reach their end-of-scene target. `useSceneFade` is the one
 * such case and deliberately keeps `useCurrentFrame()`.
 */
export const useSakuraFrame = (): number =>
  Math.round(useCurrentFrame() * SAKURA_TEMPO);

// ─── Color utilities ─────────────────────────────────────────────────────────

export const hexToRgba = (hex: string, alpha: number): string => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

const hexToHsl = (hex: string): { h: number; s: number; l: number } | null => {
  const h6 = hex.replace("#", "");
  const full = h6.length === 3 ? h6.split("").map((c) => c + c).join("") : h6;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return null;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue = 0;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / d + 2) / 6;
  else hue = ((r - g) / d + 4) / 6;
  return { h: hue * 360, s, l };
};

const hslToHex = (h: number, s: number, l: number): string => {
  const hue = ((h % 360) + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t0: number) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const to255 = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${to255(channel(hue + 1 / 3))}${to255(channel(hue))}${to255(channel(hue - 1 / 3))}`;
};

/**
 * Dark scenes tint from the user's bgColor: keep its hue but render it at
 * plum depth. Near-neutral / default-washi backgrounds reproduce the exact
 * reference plum (#4A1220 → #080305).
 */
export const deriveDarkWash = (bgColor?: string): { center: string; edge: string } => {
  const hsl = bgColor ? hexToHsl(bgColor) : null;
  if (!hsl || hsl.s < 0.25 || hsl.l > 0.9) {
    return { center: SAKURA.plum, edge: SAKURA.void };
  }
  return {
    center: hslToHex(hsl.h, 0.6, 0.17),
    edge: hslToHex(hsl.h, 0.55, 0.025),
  };
};

/** Light scenes: soft washi wash tinted from the user's bgColor. */
export const deriveLightWash = (bgColor?: string): { center: string; edge: string } => {
  const hsl = bgColor ? hexToHsl(bgColor) : null;
  if (!hsl || hsl.s < 0.05) {
    return { center: "#FDE8EF", edge: "#F5E0D8" };
  }
  return {
    center: hslToHex(hsl.h, Math.min(0.85, hsl.s + 0.1), Math.max(0.93, hsl.l)),
    edge: hslToHex(hsl.h - 12, Math.min(0.7, hsl.s), Math.max(0.88, hsl.l - 0.04)),
  };
};

// The template's DEFAULT text color, materialized in SakuraVideoComposition
// (`textColor || SAKURA_DEFAULT_TEXT`). Near-black, tuned for the LIGHT scenes.
// We treat this exact value as "user hasn't customized text" so the dark scenes
// can fall back to washi for it, while still honoring any explicit user color.
export const SAKURA_DEFAULT_TEXT = "#2A0A12";

/**
 * Pick a legible text color for a given backdrop from the user's textColor.
 *
 * On LIGHT scenes we keep the color as-is (dark-on-cream is fine). On DARK scenes
 * (intro / quote / stat / ending) the near-black DEFAULT would be invisible, so:
 *   - the untouched default → fall back to the light `washi` (clean cream look);
 *   - an EXPLICIT user color that reads fine → use it verbatim;
 *   - an EXPLICIT user color too dark for the dark ground → keep the user's HUE
 *     but lift its lightness so the choice is still visibly applied (never
 *     silently discarded — that made "change the text color" look like a no-op).
 *
 * `variant` is the backdrop tone; only "dark" applies the legibility guard.
 */
export const readableTextColor = (
  textColor: string | undefined,
  variant: "dark" | "light",
): string => {
  if (variant === "light") return textColor || SAKURA.ink;
  // Untouched default (or missing) → washi. Compare case-insensitively so an
  // equivalent hex from the picker still counts as "not customized".
  if (!textColor || textColor.toLowerCase() === SAKURA_DEFAULT_TEXT.toLowerCase())
    return SAKURA.washi;
  const hsl = hexToHsl(textColor);
  if (!hsl) return SAKURA.washi;
  // The user explicitly chose this color — always honor it. If it's too dark to
  // read on the dark ground, keep its hue/saturation and raise lightness to a
  // legible floor instead of throwing the choice away.
  if (hsl.l < 0.55) return hslToHex(hsl.h, hsl.s, 0.7);
  return textColor;
};

/**
 * A soft sakura-petal tint DERIVED from the user's accent color: keep the
 * accent's hue but render it at petal lightness. This restores the original
 * intro look (soft blush pink 桜) while staying color-driven — the DEFAULT
 * crimson accent (#C0143C, hue≈346°) lands right on the reference blush
 * (#F4B8C8, hue≈344°), and a custom accent shifts the petal with it. Falls back
 * to the fixed blush when the accent is missing or near-neutral (no usable hue).
 */
export const petalTint = (accentColor?: string): string => {
  const hsl = accentColor ? hexToHsl(accentColor) : null;
  if (!hsl || hsl.s < 0.12) return SAKURA.blush;
  return hslToHex(hsl.h, Math.min(0.75, Math.max(0.55, hsl.s - 0.08)), 0.84);
};

export const isPortraitRatio = (aspectRatio?: string) => aspectRatio === "portrait";

// Deterministic pseudo-random in [0, 1)
export const sakuraRand = (seed: number, n: number): number =>
  Math.abs(Math.sin(seed * 127.1 + n * 311.7) * 43758.5453) % 1;

// ─── Scene fade (stickman pattern: enter × exit master opacity) ──────────────

export const useSceneFade = (
  dur: number,
  enterFrames = 14,
  exitFrames = 16,
): number => {
  // Real clock — the exit keys off `dur - exitFrames`, so it must NOT be
  // tempo-scaled (a scaled frame would never reach the end-of-scene target).
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, enterFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(frame, [dur - exitFrames, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return enter * exit;
};

/** Gentle bloom-in for scene content: scale 1.03 → 1 with a soft fade. */
export const useBloomIn = (frames = 12): { opacity: number; transform: string } => {
  const frame = useSakuraFrame();
  const t = interpolate(frame, [0, frames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (x) => 1 - Math.pow(1 - x, 3),
  });
  return {
    opacity: t,
    transform: `scale(${1.03 - 0.03 * t})`,
  };
};

// ─── Per-scene entrance families (so scenes don't all fade in identically) ────

export type SakuraEntrance =
  | "petal_settle" // scale up + drift down (hero / quote)
  | "rise" // translateY up + fade (text / list)
  | "ink_wash_in" // clip-path inset wipe from an edge (section / two-column)
  | "bloom" // scale-from-center + slight rotate (stat / chapter)
  | "slide_panel"; // translateX wipe (image / ending)

export const SAKURA_ENTRANCE: Record<string, SakuraEntrance> = {
  sakura_intro: "petal_settle",
  sakura_quote: "petal_settle",
  sakura_section: "ink_wash_in",
  sakura_two_column_detail: "ink_wash_in",
  sakura_stat_highlight: "bloom",
  sakura_list_scene: "rise",
  sakura_text_narration: "rise",
  sakura_ending_socials: "slide_panel",
};

export interface EntranceStyle {
  opacity: number;
  transform?: string;
  clipPath?: string;
}

/** Returns the entrance transform/clip for a scene, keyed by its layout type. */
export const useSakuraEntrance = (layout?: string, frames = 40): EntranceStyle => {
  const frame = useSakuraFrame();
  const family = SAKURA_ENTRANCE[layout ?? ""] ?? "rise";
  const t = interpolate(frame, [0, frames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (x) => 1 - Math.pow(1 - x, 3),
  });
  const opacity = interpolate(frame, [0, frames * 0.7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  switch (family) {
    case "petal_settle":
      return { opacity, transform: `scale(${0.9 + 0.1 * t}) translateY(${(1 - t) * -18}px)` };
    case "rise":
      return { opacity, transform: `translateY(${(1 - t) * 42}px)` };
    case "ink_wash_in":
      // wipe reveal from the left
      return { opacity: 1, clipPath: `inset(0 ${(1 - t) * 100}% 0 0)` };
    case "bloom":
      return { opacity, transform: `scale(${0.82 + 0.18 * t}) rotate(${(1 - t) * -4}deg)` };
    case "slide_panel":
      return { opacity, transform: `translateX(${(1 - t) * 70}px)` };
    default:
      return { opacity };
  }
};

// ─── SoftPetal — the five-ellipse sakura blossom ─────────────────────────────

export interface SoftPetalProps {
  cx: number;
  cy: number;
  r: number;
  rotation?: number;
  color?: string;
  opacity?: number;
  centerColor?: string;
  /** 0..1 — when set, petals bloom in sequentially (for BloomIn) */
  bloomProgress?: number;
}

/** Soft five-petal blossom (must be rendered inside an <svg>). */
export const SoftPetal: React.FC<SoftPetalProps> = ({
  cx,
  cy,
  r,
  rotation = 0,
  color = SAKURA.blush,
  opacity = 1,
  centerColor = SAKURA.deepBlush,
  bloomProgress,
}) => {
  const petals = Array.from({ length: 5 }, (_, i) => {
    const a = ((i * 72 - 90) * Math.PI) / 180;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    let petalOpacity = 1;
    let petalScale = 1;
    if (bloomProgress !== undefined) {
      const start = i * 0.14;
      const t = Math.max(0, Math.min(1, (bloomProgress - start) / 0.3));
      petalOpacity = t;
      petalScale = 0.4 + 0.6 * t;
    }
    return (
      <ellipse
        key={i}
        cx={px}
        cy={py}
        rx={r * 0.55 * petalScale}
        ry={r * 0.35 * petalScale}
        transform={`rotate(${i * 72 - 90}, ${px}, ${py})`}
        fill={color}
        opacity={petalOpacity}
      />
    );
  });
  const centerOpacity =
    bloomProgress === undefined ? 1 : Math.max(0, Math.min(1, bloomProgress * 2));
  return (
    <g transform={`translate(${cx}, ${cy}) rotate(${rotation})`} opacity={opacity}>
      {petals}
      <circle cx={0} cy={0} r={r * 0.18} fill={centerColor} opacity={centerOpacity} />
    </g>
  );
};

// ─── WashiBackground ─────────────────────────────────────────────────────────

export const WashiBackground: React.FC<{
  variant: "dark" | "light";
  bgColor?: string;
}> = ({ variant, bgColor }) => {
  const { width, height } = useVideoConfig();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const wash = variant === "dark" ? deriveDarkWash(bgColor) : deriveLightWash(bgColor);
  const fiber =
    variant === "dark" ? "rgba(244,184,200,0.06)" : "rgba(26,10,15,0.035)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", inset: 0 }}
    >
      <defs>
        <radialGradient
          id={`wash-${uid}`}
          cx={variant === "dark" ? "30%" : "70%"}
          cy={variant === "dark" ? "20%" : "80%"}
          r="85%"
        >
          <stop offset="0%" stopColor={wash.center} />
          <stop offset="100%" stopColor={wash.edge} />
        </radialGradient>
        <pattern id={`fiber-${uid}`} x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
          <line x1="0" y1="2.5" x2="5" y2="2.5" stroke={fiber} strokeWidth="0.6" />
        </pattern>
        <linearGradient id={`vig-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="40%" stopColor="black" stopOpacity="0" />
          <stop
            offset="100%"
            stopColor="black"
            stopOpacity={variant === "dark" ? 0.45 : 0.08}
          />
        </linearGradient>
      </defs>
      <rect width={width} height={height} fill={`url(#wash-${uid})`} />
      <rect width={width} height={height} fill={`url(#fiber-${uid})`} />
      <rect width={width} height={height} fill={`url(#vig-${uid})`} />
    </svg>
  );
};

// ─── Seigaiha wave pattern ───────────────────────────────────────────────────

export const Seigaiha: React.FC<{
  opacity?: number;
  color?: string;
  size?: number;
}> = ({ opacity = 0.05, color = SAKURA.blush, size = 80 }) => {
  const { width, height } = useVideoConfig();
  const scales = useMemo(() => {
    const out: Array<{ x: number; y: number }> = [];
    const cols = Math.ceil(width / size) + 2;
    const rows = Math.ceil(height / (size * 0.6)) + 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        out.push({ x: c * size - (r % 2 ? size / 2 : 0), y: r * size * 0.6 });
      }
    }
    return out;
  }, [width, height, size]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", inset: 0, opacity }}
    >
      {scales.map((s, i) => (
        <ellipse
          key={i}
          cx={s.x}
          cy={s.y}
          rx={size * 0.5}
          ry={size * 0.5}
          fill="none"
          stroke={color}
          strokeWidth={1}
        />
      ))}
    </svg>
  );
};

// ─── Asanoha (hemp-leaf) lattice pattern ─────────────────────────────────────

/**
 * The asanoha (麻の葉, "hemp leaf") star lattice — one of the oldest Japanese
 * geometric motifs, a hexagon subdivided into six radiating isoceles triangles
 * that tile into interlocking six-pointed stars. Drawn as thin straight lines
 * only (no fills), so it reads as a faint woven ground behind content and costs
 * almost nothing to paint. Same signature/placement as `Seigaiha` so scenes can
 * swap one geometric ground for another.
 */
export const Asanoha: React.FC<{
  opacity?: number;
  color?: string;
  /** side length of the tiling hexagon; larger = coarser lattice */
  size?: number;
}> = ({ opacity = 0.05, color = SAKURA.blush, size = 96 }) => {
  const { width, height } = useVideoConfig();

  // One asanoha unit = a hexagon (6 outer vertices) with spokes to the center
  // and to each edge midpoint, giving the interlocking-star look. We tile the
  // hexagon centers on a staggered grid (flat-top hex packing).
  const lines = useMemo(() => {
    const R = size; // hex circumradius
    const dx = R * 1.5; // horizontal spacing of hex centers
    const dy = R * Math.sqrt(3); // vertical spacing
    const out: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

    // Outer vertices of a pointy-top hexagon around a center.
    const vert = (cx: number, cy: number, k: number) => {
      const a = (Math.PI / 3) * k - Math.PI / 2;
      return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
    };

    const cols = Math.ceil(width / dx) + 2;
    const rows = Math.ceil(height / dy) + 2;
    for (let c = -1; c < cols; c++) {
      for (let rIdx = -1; rIdx < rows; rIdx++) {
        const cx = c * dx;
        const cy = rIdx * dy + (c % 2 ? dy / 2 : 0);
        const v = Array.from({ length: 6 }, (_, k) => vert(cx, cy, k));
        // Classic asanoha unit: the hexagon's six edges + a spoke from the
        // center to each vertex. Those six spokes divide the hexagon into six
        // isoceles triangles; where neighbouring hexagons meet, the spokes line
        // up into the interlocking six-point stars. (No extra struts — they read
        // as noise rather than the crisp hemp-leaf lattice.)
        for (let k = 0; k < 6; k++) {
          const a = v[k];
          const b = v[(k + 1) % 6];
          out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
          out.push({ x1: cx, y1: cy, x2: a.x, y2: a.y });
        }
      }
    }
    return out;
  }, [width, height, size]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", inset: 0, opacity, pointerEvents: "none" }}
    >
      {lines.map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke={color}
          strokeWidth={0.9}
        />
      ))}
    </svg>
  );
};

// ─── Kamon crest watermark ───────────────────────────────────────────────────

export const KamonWatermark: React.FC<{
  cx: number;
  cy: number;
  r: number;
  color?: string;
  opacity?: number;
  /** slow ambient rotation, deg per frame */
  spin?: number;
}> = ({ cx, cy, r, color = SAKURA.gold, opacity = 0.07, spin = 0.03 }) => {
  const frame = useSakuraFrame();
  const pad = r * 0.3;
  const box = (r + pad) * 2;
  return (
    <svg
      width={box}
      height={box}
      viewBox={`${-r - pad} ${-r - pad} ${box} ${box}`}
      style={{
        position: "absolute",
        left: cx - r - pad,
        top: cy - r - pad,
        opacity,
      }}
    >
      <g transform={`rotate(${frame * spin})`}>
        <circle cx={0} cy={0} r={r} stroke={color} strokeWidth={2} fill="none" />
        <circle cx={0} cy={0} r={r * 0.85} stroke={color} strokeWidth={0.8} fill="none" />
        {[0, 120, 240].map((deg) => {
          const a = ((deg - 90) * Math.PI) / 180;
          return (
            <SoftPetal
              key={deg}
              cx={Math.cos(a) * r * 0.45}
              cy={Math.sin(a) * r * 0.45}
              r={r * 0.2}
              rotation={deg}
              color={color}
              centerColor={color}
            />
          );
        })}
      </g>
    </svg>
  );
};

// ─── Corner blossom clusters ─────────────────────────────────────────────────

type Corner = "tl" | "tr" | "bl" | "br";

const CLUSTER: Array<{ dx: number; dy: number; r: number; rot: number; c: 0 | 1 | 2; op: number }> = [
  { dx: 60, dy: 62, r: 30, rot: 15, c: 0, op: 0.75 },
  { dx: 108, dy: 28, r: 20, rot: -20, c: 1, op: 0.55 },
  { dx: 28, dy: 118, r: 19, rot: 45, c: 2, op: 0.5 },
];
const SINGLE: Array<{ dx: number; dy: number; r: number; rot: number; c: 0 | 1 | 2; op: number }> = [
  { dx: 80, dy: 60, r: 22, rot: 10, c: 1, op: 0.4 },
];

export const CornerBlossoms: React.FC<{
  heavy?: Corner[];
  light?: Corner[];
  scale?: number;
}> = ({ heavy = ["tl", "br"], light = ["tr", "bl"], scale = 1 }) => {
  const { width, height } = useVideoConfig();
  const colors = [SAKURA.blush, SAKURA.mist, SAKURA.deepBlush];

  const place = (corner: Corner, dx: number, dy: number) => {
    const x = corner === "tl" || corner === "bl" ? dx : width - dx;
    const y = corner === "tl" || corner === "tr" ? dy : height - dy;
    return { x, y };
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {heavy.map((corner) =>
        CLUSTER.map((f, i) => {
          const { x, y } = place(corner, f.dx * scale, f.dy * scale);
          return (
            <SoftPetal
              key={`${corner}-${i}`}
              cx={x}
              cy={y}
              r={f.r * scale}
              rotation={f.rot}
              color={colors[f.c]}
              opacity={f.op}
            />
          );
        }),
      )}
      {light.map((corner) =>
        SINGLE.map((f, i) => {
          const { x, y } = place(corner, f.dx * scale, f.dy * scale);
          return (
            <SoftPetal
              key={`${corner}-s-${i}`}
              cx={x}
              cy={y}
              r={f.r * scale}
              rotation={f.rot}
              color={colors[f.c]}
              opacity={f.op}
            />
          );
        }),
      )}
    </svg>
  );
};

// ─── PetalRain — continuous, recycled, deterministic ─────────────────────────

/**
 * Petal-field motion mode — shifts per-petal params + the motion math so each
 * scene's petals read differently:
 *  - `drift`  : the original gentle fall.
 *  - `storm`  : fast, dense, steeply-angled hanafubuki blizzard.
 *  - `float`  : near-weightless petals that hover and bob in place.
 *  - `vortex` : petals swirl around the frame center instead of falling.
 *  - `settle` : petals fall then slow near the floor and accumulate.
 */
export type PetalMode = "drift" | "storm" | "float" | "vortex" | "settle";

export const PetalRain: React.FC<{
  count?: number;
  intensity?: number;
  seed?: number;
  mode?: PetalMode;
  /** multiplies every petal's radius — render two layers at different scale for
   *  parallax depth (e.g. 1.4 near / 0.6 far). Default 1 = unchanged. */
  scale?: number;
}> = ({ count = 20, intensity = 1, seed = 7, mode = "drift", scale = 1 }) => {
  const frame = useSakuraFrame();
  const { width, height } = useVideoConfig();

  const params = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const s = seed + i * 31.7;
        const far = i % 5 < 2; // ~40% far layer: smaller, slower, paler
        const r = far ? 6 + sakuraRand(s, 2) * 5 : 9 + sakuraRand(s, 2) * 11;
        // Mode tweaks fall speed + sway envelope.
        const vyMul = mode === "storm" ? 2.4 : mode === "settle" ? 1.2 : 1;
        const swayMul = mode === "storm" ? 1.6 : mode === "float" ? 1.5 : 1;
        return {
          x0: sakuraRand(s, 1) * width,
          y0: sakuraRand(s, 8) * (height + 160),
          vy: ((far ? 0.4 : 0.7) + sakuraRand(s, 3) * (far ? 0.35 : 0.8)) * vyMul,
          swayAmp: (14 + sakuraRand(s, 4) * 28) * intensity * (far ? 0.6 : 1) * swayMul,
          swayFreq: 0.007 + sakuraRand(s, 5) * 0.012,
          swayFreq2: 0.003 + sakuraRand(s, 12) * 0.005,
          phase: sakuraRand(s, 6) * Math.PI * 2,
          rotSpeed: (sakuraRand(s, 7) - 0.5) * 2.4 * (mode === "storm" ? 1.8 : 1),
          rot0: sakuraRand(s, 9) * 360,
          flutterFreq: 0.018 + sakuraRand(s, 10) * 0.03,
          // vortex: each petal orbits at its own radius/angular speed.
          orbR: (0.12 + sakuraRand(s, 14) * 0.42) * Math.min(width, height),
          orbA0: sakuraRand(s, 15) * Math.PI * 2,
          orbSpd: (0.006 + sakuraRand(s, 16) * 0.01) * (sakuraRand(s, 17) > 0.5 ? 1 : -1),
          // float: gentle vertical bob instead of falling.
          bobAmp: 12 + sakuraRand(s, 18) * 26,
          bobFreq: 0.01 + sakuraRand(s, 19) * 0.014,
          r,
          far,
          color: far
            ? SAKURA.mist
            : sakuraRand(s, 11) > 0.5
              ? SAKURA.blush
              : SAKURA.mist,
          baseOp: far ? 0.3 + sakuraRand(s, 13) * 0.2 : 0.5 + sakuraRand(s, 13) * 0.4,
        };
      }),
    [count, seed, width, height, intensity, mode],
  );

  const total = height + 160;
  const cx = width / 2;
  const cy = height / 2;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {params.map((p, i) => {
        let x: number;
        let y: number;

        if (mode === "vortex") {
          // Orbit the frame center; radius breathes slightly so it's not a rigid ring.
          const a = p.orbA0 + frame * p.orbSpd;
          const rr = p.orbR * (0.9 + 0.1 * Math.sin(frame * 0.02 + p.phase));
          x = cx + Math.cos(a) * rr;
          y = cy + Math.sin(a) * rr * 0.72; // slightly flattened ellipse
        } else if (mode === "float") {
          // Hover: drift sideways + bob vertically, no net fall.
          x =
            p.x0 +
            Math.sin(frame * p.swayFreq * Math.PI * 2 + p.phase) * p.swayAmp +
            Math.sin(frame * p.swayFreq2 * Math.PI * 2 + p.phase * 1.7) * p.swayAmp * 0.5;
          y =
            ((p.y0 + frame * p.vy * 0.12) % total) -
            80 +
            Math.sin(frame * p.bobFreq * Math.PI * 2 + p.phase) * p.bobAmp;
        } else {
          // drift / storm / settle: fall with sway. `settle` decelerates near the
          // floor so petals pile up in the bottom band.
          let fallY = (p.y0 + frame * p.vy) % total;
          if (mode === "settle") {
            const floor = height * 0.72;
            if (fallY > floor) {
              // ease the remaining travel so motion slows toward the bottom
              const past = (fallY - floor) / (total - floor);
              fallY = floor + (total - floor) * (1 - Math.pow(1 - past, 2.5)) * 0.5;
            }
          }
          y = fallY - 80;
          x =
            p.x0 +
            Math.sin(frame * p.swayFreq * Math.PI * 2 + p.phase) * p.swayAmp +
            Math.sin(frame * p.swayFreq2 * Math.PI * 2 + p.phase * 1.7) * p.swayAmp * 0.5;
        }

        const rotation = p.rot0 + frame * p.rotSpeed;
        // Flutter: petals tumble by squashing on one axis
        const flutter = 0.7 + 0.3 * Math.sin(frame * p.flutterFreq * Math.PI * 2 + p.phase);
        const edgeFade =
          mode === "vortex" || mode === "float"
            ? 1 // these modes stay on-screen, no fall-through fade
            : interpolate(
                y,
                [-20, 40, height - 40, height + 20],
                [0, 1, 1, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );
        const opacity = p.baseOp * edgeFade;
        if (opacity < 0.02) return null;
        return (
          <g
            key={i}
            transform={`translate(${x}, ${y}) rotate(${rotation}) scale(1, ${flutter})`}
            opacity={opacity}
          >
            <SoftPetal
              cx={0}
              cy={0}
              r={p.r * scale}
              color={p.color}
              centerColor={p.far ? p.color : SAKURA.deepBlush}
            />
          </g>
        );
      })}
    </svg>
  );
};

// ─── Brush stroke + dividers ─────────────────────────────────────────────────

/** Single calligraphic underline that draws itself in. */
export const BrushUnderline: React.FC<{
  width: number;
  color?: string;
  strokeWidth?: number;
  startFrame?: number;
  durationFrames?: number;
  opacity?: number;
}> = ({
  width: w,
  color = SAKURA.crimson,
  strokeWidth = 3,
  startFrame = 0,
  durationFrames = 18,
  opacity = 1,
}) => {
  const frame = useSakuraFrame();
  const progress = interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  });
  const len = w * 1.05;
  return (
    <svg width={w} height={14} viewBox={`0 0 ${w} 14`} style={{ overflow: "visible", display: "block" }}>
      <path
        d={`M 0 7 Q ${w * 0.25} 3 ${w * 0.5} 7 Q ${w * 0.75} 11 ${w} 7`}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - progress)}
        opacity={opacity}
      />
    </svg>
  );
};

/** Two asymmetric brush lines sweeping outward from the center (intro device). */
export const SplitBrushLines: React.FC<{
  width: number;
  color?: string;
  startFrame?: number;
  durationFrames?: number;
}> = ({ width: w, color = SAKURA.crimson, startFrame = 0, durationFrames = 18 }) => {
  const frame = useSakuraFrame();
  const progress = interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const half = w / 2;
  const len = half * 1.02;
  return (
    <svg width={w} height={12} viewBox={`0 0 ${w} 12`} style={{ overflow: "visible", display: "block" }}>
      <path
        d={`M ${half} 6 Q ${half * 0.5} 3 0 6`}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - progress)}
        opacity={0.8}
      />
      <path
        d={`M ${half} 6 Q ${half * 1.5} 9 ${w} 6`}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - progress)}
        opacity={0.6}
      />
    </svg>
  );
};

/**
 * Sumi-e brush text: the string is "written in" one glyph at a time like ink
 * calligraphy on washi. Each glyph is revealed by an animated clip-path that
 * opens left→right with a jagged brush leading edge, and the whole word sits
 * under ONE static feTurbulence/feDisplacementMap filter so the ink reads as if
 * it soaked into the paper. A faint larger "wet" copy blooms behind fresh
 * strokes then settles.
 *
 * Cheap on purpose (preview paint budget): reveal is clip-path + opacity only
 * — no per-glyph blur/box-shadow — and exactly one filter instance is applied
 * to the whole container, never per glyph. All motion is on `useSakuraFrame()`
 * and all jitter is deterministic via `sakuraRand`, so preview == render.
 */
export const SumiBrushText: React.FC<{
  text: string;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: number;
  color?: string;
  startFrame?: number;
  perChar?: number;
  charDuration?: number;
  seed?: number;
  bleedScale?: number;
  wetShadow?: boolean;
  maxTotalFrames?: number;
  letterSpacing?: string;
  lineHeight?: number;
  style?: React.CSSProperties;
}> = ({
  text,
  fontSize,
  fontFamily = SAKURA_DISPLAY_FONT,
  fontWeight = 700,
  color = SAKURA.ink,
  startFrame = 0,
  perChar = 3,
  charDuration = 7,
  seed = 61,
  bleedScale = 3.5,
  wetShadow = true,
  maxTotalFrames = 999,
  letterSpacing = "0.1em",
  lineHeight = 1.25,
  style,
}) => {
  const frame = useSakuraFrame();
  const uid = useId().replace(/:/g, "");
  const filterId = `sumiBleed-${uid}`;

  const glyphs = Array.from(text);
  const n = glyphs.length;
  if (n === 0) return null;

  // Auto-compress the stagger so a long quote never overruns the budget.
  const k = Math.min(perChar, (maxTotalFrames - charDuration) / Math.max(1, n - 1));
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  const container: React.CSSProperties = {
    fontFamily,
    fontWeight,
    fontSize,
    color,
    letterSpacing,
    lineHeight,
    // ONE displacement filter over the whole word — the wet-ink edge.
    filter: `url(#${filterId})`,
    ...style,
  };

  const renderGlyph = (g: string, i: number, wet: boolean) => {
    // Whitespace keeps its width but is never clipped/filtered (no wiped-space flicker).
    if (g === " " || g === "　") {
      return (
        <span key={i} style={{ display: "inline-block", whiteSpace: "pre" }}>
          {g}
        </span>
      );
    }
    const t = clamp01((frame - (startFrame + i * k)) / charDuration);
    const reveal = 1 - Math.pow(1 - t, 2); // ease-out
    // Jagged brush tip: 4 vertical samples along the reveal edge, jittered.
    const edgeAmp = 14;
    const e = (kk: number) =>
      reveal >= 1
        ? 100
        : Math.max(
            0,
            Math.min(100, reveal * 100 + (sakuraRand(seed, i * 7 + kk) - 0.5) * edgeAmp),
          );
    const clip =
      reveal >= 1
        ? "none"
        : `polygon(0% 0%, ${e(0)}% 0%, ${e(1)}% 33%, ${e(2)}% 66%, ${e(3)}% 100%, 0% 100%)`;
    const wetOp = wet ? 1 - clamp01((reveal - 0.4) / 0.6) : 1;
    return (
      <span
        key={i}
        style={{
          display: "inline-block",
          opacity: wet ? 0.5 * wetOp : reveal,
          clipPath: clip,
          WebkitClipPath: clip,
          ...(wet
            ? { transform: "scale(1.08)", transformOrigin: "center" }
            : null),
        }}
      >
        {g}
      </span>
    );
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
        <defs>
          <filter id={filterId} x="-15%" y="-15%" width="130%" height="130%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.02"
              numOctaves={2}
              seed={7}
              result="w"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="w"
              scale={bleedScale}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
      {wetShadow ? (
        <div style={{ ...container, position: "absolute", inset: 0, pointerEvents: "none" }} aria-hidden>
          {glyphs.map((g, i) => renderGlyph(g, i, true))}
        </div>
      ) : null}
      <div style={container}>{glyphs.map((g, i) => renderGlyph(g, i, false))}</div>
    </div>
  );
};

/** line — blossom — line divider that draws outward while the flower blooms. */
export const PetalDivider: React.FC<{
  width: number;
  lineColor?: string;
  flowerColor?: string;
  flowerR?: number;
  startFrame?: number;
  durationFrames?: number;
}> = ({
  width: w,
  lineColor = SAKURA.deepBlush,
  flowerColor = SAKURA.deepBlush,
  flowerR = 11,
  startFrame = 0,
  durationFrames = 16,
}) => {
  const frame = useSakuraFrame();
  const progress = interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  const gap = flowerR * 2.6;
  const lineLen = (w - gap) / 2;
  const h = flowerR * 2 + 8;
  const cy = h / 2;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible", display: "block" }}>
      <line
        x1={lineLen}
        y1={cy}
        x2={lineLen - lineLen * progress}
        y2={cy}
        stroke={lineColor}
        strokeWidth={1.2}
        opacity={0.7}
      />
      <line
        x1={w - lineLen}
        y1={cy}
        x2={w - lineLen + lineLen * progress}
        y2={cy}
        stroke={lineColor}
        strokeWidth={1.2}
        opacity={0.7}
      />
      <SoftPetal cx={w / 2} cy={cy} r={flowerR} color={flowerColor} bloomProgress={progress} />
    </svg>
  );
};

/**
 * Oversized Japanese quotation brackets 「 」 framing a quote block. The opening
 * 「 hangs top-left, the closing 」 bottom-right; each L-stroke draws itself on
 * via stroke-dashoffset (same device as BrushUnderline). Kept low-opacity so it
 * reads as an editorial framing mark, not a literal bracket around the words.
 */
export const KagiKakko: React.FC<{
  width: number;
  height: number;
  /** side length of each bracket's arms */
  size?: number;
  progress?: number;
  color?: string;
  thickness?: number;
  opacity?: number;
}> = ({
  width: w,
  height: h,
  size = 120,
  progress = 1,
  color = SAKURA.deepBlush,
  thickness = 6,
  opacity = 0.24,
}) => {
  const s = size;
  const inset = s * 0.5;
  // Opening 「 : horizontal arm going right, then vertical arm going down.
  const open = `M ${inset} ${inset} L ${inset + s} ${inset} M ${inset} ${inset} L ${inset} ${inset + s}`;
  // Closing 」 : horizontal arm going left, then vertical arm going up.
  const close = `M ${w - inset} ${h - inset} L ${w - inset - s} ${h - inset} M ${w - inset} ${h - inset} L ${w - inset} ${h - inset - s}`;
  const len = s * 1.05;
  const dash = { strokeDasharray: len, strokeDashoffset: len * (1 - progress) };
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
    >
      <path d={open} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round" opacity={opacity} {...dash} />
      <path d={close} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round" opacity={opacity} {...dash} />
    </svg>
  );
};

/**
 * A thin gold hairline with a couple of gentle "kintsugi crack" jogs that draws
 * itself L→R. Gold-on-cream is the expensive signal; use it as the hero accent
 * line beneath a quote or number.
 */
export const KintsugiLine: React.FC<{
  width: number;
  progress?: number;
  color?: string;
  opacity?: number;
  strokeWidth?: number;
}> = ({ width: w, progress = 1, color = SAKURA.gold, opacity = 0.9, strokeWidth = 1.6 }) => {
  const h = 12;
  const cy = h / 2;
  // Irregular polyline — mostly flat with two small vein jogs, like a gold seam.
  const d = `M 0 ${cy} L ${w * 0.28} ${cy} L ${w * 0.36} ${cy - 3} L ${w * 0.5} ${cy + 2} L ${w * 0.64} ${cy - 2} L ${w * 0.72} ${cy + 3} L ${w} ${cy}`;
  const len = w * 1.1;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible", display: "block" }}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - progress)}
        opacity={opacity}
        style={{ filter: `drop-shadow(0 0 3px ${hexToRgba(color, 0.5)})` }}
      />
    </svg>
  );
};

/**
 * A vermillion hanko seal that "presses down" — scale 1.18→1 + fade on a spring
 * keyed to startFrame, like a real ink stamp landing. A slightly rough double
 * ring + a centered character. Acts as a signature / full-stop.
 */
export const HankoSeal: React.FC<{
  size?: number;
  char?: string;
  startFrame?: number;
  rotation?: number;
  color?: string;
}> = ({ size = 82, char = "桜", startFrame = 0, rotation = -6, color = SAKURA.crimson }) => {
  const frame = useSakuraFrame();
  const { fps } = useVideoConfig();
  const press = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 14, stiffness: 140, mass: 0.8 },
    from: 0,
    to: 1,
  });
  const scale = 1.18 - 0.18 * press;
  const opacity = interpolate(press, [0, 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const s = size;
  const c = s / 2;
  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      style={{ display: "block", overflow: "visible", opacity, transform: `rotate(${rotation}deg) scale(${scale})` }}
    >
      {/* rough outer ring (two slightly offset strokes read as pressed ink) */}
      <circle cx={c} cy={c} r={c - 3} fill="none" stroke={color} strokeWidth={s * 0.055} opacity={0.92} />
      <circle cx={c + 0.6} cy={c - 0.4} r={c - 3.4} fill="none" stroke={color} strokeWidth={s * 0.03} opacity={0.4} />
      <text
        x={c}
        y={c}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={SAKURA_DISPLAY_FONT}
        fontWeight={700}
        fontSize={s * 0.5}
        fill={color}
      >
        {char}
      </text>
    </svg>
  );
};

// ─── Backdrop variants (each scene gets distinct background geometry) ─────────

export type SakuraBackdropVariant =
  | "plum_radial" // dark hero radial (intro)
  | "washi_radial" // light editorial radial (text_narration)
  | "vertical_band" // dark + wide crimson→deepBlush vertical band on one side (chapter)
  | "ink_corner" // light + asymmetric ink-wash bleeding from a corner (section / list / two-col)
  | "spotlight" // dark + single offset radial spotlight (stat)
  | "celebration"; // dark + faint concentric wash for the ring finale (ending / quote)

export const SAKURA_BACKDROP: Record<string, SakuraBackdropVariant> = {
  sakura_intro: "plum_radial",
  sakura_quote: "celebration",
  sakura_section: "ink_corner",
  sakura_two_column_detail: "washi_radial",
  sakura_stat_highlight: "spotlight",
  sakura_list_scene: "ink_corner",
  sakura_text_narration: "washi_radial",
  sakura_ending_socials: "celebration",
};

export const isDarkBackdrop = (v: SakuraBackdropVariant): boolean =>
  v === "plum_radial" ||
  v === "vertical_band" ||
  v === "spotlight" ||
  v === "celebration";

/**
 * Renders a backdrop whose geometry is distinct per variant: different gradient
 * origin, seigaiha placement, kamon position, and accent geometry — so no two
 * scenes share the same chrome. Uses only static gradients + the existing SVG
 * pattern primitives (cheap to paint).
 */
export const SakuraBackdrop: React.FC<{
  variant: SakuraBackdropVariant;
  bgColor?: string;
  accentColor?: string;
  /** which side the asymmetric elements favor; alternate per scene index */
  side?: "left" | "right";
}> = ({ variant, bgColor, accentColor, side = "left" }) => {
  const { width, height } = useVideoConfig();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const dark = isDarkBackdrop(variant);
  const crimson = accentColor || SAKURA.crimson;
  const wash = dark ? deriveDarkWash(bgColor) : deriveLightWash(bgColor);
  const leftSide = side === "left";

  // Per-variant radial origin
  const origin: Record<SakuraBackdropVariant, { cx: string; cy: string }> = {
    plum_radial: { cx: "30%", cy: "20%" },
    washi_radial: { cx: "70%", cy: "80%" },
    vertical_band: { cx: "50%", cy: "40%" },
    ink_corner: { cx: leftSide ? "18%" : "82%", cy: "24%" },
    spotlight: { cx: leftSide ? "32%" : "68%", cy: "42%" },
    celebration: { cx: "50%", cy: "50%" },
  };
  const o = origin[variant];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", inset: 0 }}
    >
      <defs>
        <radialGradient id={`bd-${uid}`} cx={o.cx} cy={o.cy} r="90%">
          <stop offset="0%" stopColor={wash.center} />
          <stop offset="100%" stopColor={wash.edge} />
        </radialGradient>
        <pattern id={`bdf-${uid}`} x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
          <line x1="0" y1="2.5" x2="5" y2="2.5" stroke={dark ? "rgba(244,184,200,0.06)" : "rgba(26,10,15,0.035)"} strokeWidth="0.6" />
        </pattern>
        <linearGradient id={`bdv-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="40%" stopColor="black" stopOpacity="0" />
          <stop offset="100%" stopColor="black" stopOpacity={dark ? 0.45 : 0.08} />
        </linearGradient>
        {variant === "ink_corner" && (
          <radialGradient id={`bdink-${uid}`} cx={leftSide ? "12%" : "88%"} cy="14%" r="55%">
            <stop offset="0%" stopColor={hexToRgba(crimson, 0.14)} />
            <stop offset="55%" stopColor={hexToRgba(SAKURA.deepBlush, 0.05)} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        )}
        {variant === "spotlight" && (
          <radialGradient id={`bdspot-${uid}`} cx={leftSide ? "32%" : "68%"} cy="42%" r="46%">
            <stop offset="0%" stopColor={hexToRgba(SAKURA.blush, 0.14)} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        )}
      </defs>

      <rect width={width} height={height} fill={`url(#bd-${uid})`} />
      <rect width={width} height={height} fill={`url(#bdf-${uid})`} />

      {/* Vertical accent band (chapter) */}
      {variant === "vertical_band" && (
        <rect
          x={leftSide ? 0 : width - width * 0.16}
          y={0}
          width={width * 0.16}
          height={height}
          fill={`url(#bd-${uid})`}
          opacity={0}
        />
      )}
      {variant === "vertical_band" && (
        <>
          <defs>
            <linearGradient id={`bdband-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={crimson} />
              <stop offset="70%" stopColor={SAKURA.deepBlush} />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <rect x={leftSide ? 0 : width - 14} y={0} width={14} height={height} fill={`url(#bdband-${uid})`} opacity={0.9} />
        </>
      )}

      {/* Ink corner wash */}
      {variant === "ink_corner" && (
        <rect width={width} height={height} fill={`url(#bdink-${uid})`} />
      )}

      {/* Spotlight */}
      {variant === "spotlight" && (
        <rect width={width} height={height} fill={`url(#bdspot-${uid})`} />
      )}

      <rect width={width} height={height} fill={`url(#bdv-${uid})`} />
    </svg>
  );
};

/** Per-variant seigaiha config: {opacity, placement}. */
const SEIGAIHA_FOR: Record<SakuraBackdropVariant, number> = {
  plum_radial: 0.05,
  washi_radial: 0.04,
  vertical_band: 0.06,
  ink_corner: 0.035,
  spotlight: 0.04,
  celebration: 0.05,
};

// ─── KasumiBands — drifting Yamato-e mist / cloud bands ──────────────────────

/**
 * Horizontal "kasumi" mist bands — the stacked-lozenge cloud edge seen on
 * Yamato-e folding screens — that drift slowly sideways. Bands are confined to
 * the top and bottom ~26% of the frame and feather to transparent toward the
 * center, so the text mid-band stays calm. Each band is one closed path (a
 * scalloped inner edge + a straight edge hugging the nearest frame edge) filled
 * with a fading gradient — no solid rectangle, no blur filters. Render
 * full-frame behind the chrome; pointerEvents are off.
 */
export const KasumiBands: React.FC<{
  /** drift direction bias; left → bands drift right */
  side?: "left" | "right";
  color?: string;
  /** wrapper opacity */
  opacity?: number;
  bandCount?: number;
}> = ({ side = "left", color = SAKURA.mist, opacity = 0.1, bandCount = 5 }) => {
  const { width: W, height: H } = useVideoConfig();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const frame = useSakuraFrame();
  const u = W * 0.14; // scallop unit cell → also the seamless drift period
  const driftSign = side === "left" ? 1 : -1;

  const topCount = Math.ceil(bandCount / 2);
  const bands = useMemo(() => {
    const out: Array<{
      d: string;
      gradId: string;
      speed: number;
      dir: number;
      edgeY: number;
    }> = [];
    for (let i = 0; i < bandCount; i++) {
      const isTop = i < topCount;
      const dir = isTop ? -1 : 1; // scallop points into the frame
      const edgeY = isTop ? 0 : H; // straight edge hugs the nearest frame edge
      // baseline Y spread across the band's zone
      const zoneIdx = isTop ? i : i - topCount;
      const zoneN = isTop ? topCount : bandCount - topCount;
      const t = zoneN <= 1 ? 0.5 : zoneIdx / (zoneN - 1);
      const baseY = isTop
        ? H * 0.02 + t * (H * 0.24)
        : H * 0.74 + t * (H * 0.24);
      const amp = H * 0.018 * (1 + 0.4 * sakuraRand(41, i));
      let d = `M ${-0.2 * W} ${baseY}`;
      const cells = Math.ceil((1.4 * W) / u) + 1;
      for (let k = 0; k < cells; k++) {
        const x0 = -0.2 * W + k * u;
        const xm = x0 + u * 0.5;
        const x1 = x0 + u;
        const crown = amp * (k % 2 === 0 ? 1 : 0.6);
        d += ` Q ${xm} ${baseY + dir * crown} ${x1} ${baseY}`;
      }
      d += ` L ${1.2 * W} ${edgeY} L ${-0.2 * W} ${edgeY} Z`;
      out.push({
        d,
        gradId: `kasumi-${uid}-${i}`,
        speed: 0.08 + 0.05 * sakuraRand(41, i + 100),
        dir,
        edgeY,
      });
    }
    return out;
  }, [W, H, u, bandCount, topCount, uid]);

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity }}
    >
      <defs>
        {bands.map((b) => (
          // Densest at the frame edge, fading to transparent toward the scallop
          <linearGradient
            key={b.gradId}
            id={b.gradId}
            x1="0"
            y1={b.dir < 0 ? "1" : "0"}
            x2="0"
            y2={b.dir < 0 ? "0" : "1"}
          >
            <stop offset="0%" stopColor={hexToRgba(color, 0.85)} />
            <stop offset="70%" stopColor={hexToRgba(color, 0.35)} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        ))}
      </defs>
      {bands.map((b, i) => (
        <g key={i} transform={`translate(${driftSign * ((frame * b.speed) % u)}, 0)`}>
          <path d={b.d} fill={`url(#${b.gradId})`} />
        </g>
      ))}
    </svg>
  );
};

// ─── KirikaneDrift — cut-gold-leaf fleck drift ───────────────────────────────

/**
 * A sparse scatter of tiny gold flecks (kirikane = cut gold leaf) that drift on
 * slow layered sines and twinkle in and out, evoking a gold-leaf byobu screen.
 * Flecks near the vertical center are dimmed so text stays clean. Deterministic
 * via sakuraRand; ~count small rects, so paint cost is trivial. Render
 * full-frame behind the chrome; pointerEvents are off.
 */
export const KirikaneDrift: React.FC<{
  count?: number;
  color?: string;
  seed?: number;
  /** wrapper opacity; per-fleck alpha does the real dimming */
  opacity?: number;
}> = ({ count = 22, color = SAKURA.gold, seed = 53, opacity = 1 }) => {
  const { width: W, height: H } = useVideoConfig();
  const frame = useSakuraFrame();

  const flecks = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const s = seed + i * 17.3;
      const y0 = sakuraRand(s, 2) * H;
      const midDist = Math.abs(y0 - H / 2) / (H / 2); // 0 center … 1 edge
      return {
        x0: sakuraRand(s, 1) * W,
        y0,
        size: 3 + sakuraRand(s, 3) * 5,
        kind: sakuraRand(s, 4), // <0.5 diamond, else sliver
        rot0: sakuraRand(s, 5) * 360,
        driftAmpX: 6 + sakuraRand(s, 6) * 10,
        driftAmpY: 4 + sakuraRand(s, 7) * 8,
        driftFreqX: 0.006 + sakuraRand(s, 8) * 0.008,
        driftFreqY: 0.005 + sakuraRand(s, 9) * 0.007,
        twFreq: 0.02 + sakuraRand(s, 10) * 0.03,
        phase: sakuraRand(s, 11) * Math.PI * 2,
        baseOp: 0.1 + sakuraRand(s, 12) * 0.12,
        edgeBias: 0.25 + 0.75 * midDist, // dim center flecks to ~25%
      };
    });
  }, [count, seed, W, H]);

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity }}
    >
      {flecks.map((f, i) => {
        const x = f.x0 + Math.sin(frame * f.driftFreqX * 2 * Math.PI + f.phase) * f.driftAmpX;
        const y = f.y0 + Math.sin(frame * f.driftFreqY * 2 * Math.PI + f.phase * 1.3) * f.driftAmpY;
        const twinkle = 0.45 + 0.55 * Math.sin(frame * f.twFreq * 2 * Math.PI + f.phase);
        const op = f.baseOp * Math.max(0, twinkle) * f.edgeBias;
        if (op < 0.02) return null;
        const rot = f.rot0 + frame * 0.3;
        return (
          <g key={i} transform={`translate(${x}, ${y}) rotate(${rot})`} opacity={op}>
            {f.kind < 0.5 ? (
              <rect x={-f.size / 2} y={-f.size / 2} width={f.size} height={f.size} fill={color} />
            ) : (
              <rect x={-f.size / 2} y={-f.size * 0.18} width={f.size} height={f.size * 0.35} fill={color} />
            )}
          </g>
        );
      })}
    </svg>
  );
};

// ─── KomorebiLight — 木漏れ日, dappled sunlight through the canopy ─────────────

/**
 * "Komorebi" (木漏れ日) — soft pools of warm light that drift through the frame
 * as if sunlight were filtering down through the blossom canopy, crossed by a
 * couple of faint diagonal god-rays. Warm gold/blush on a light washi ground;
 * paler and cooler on a dark ground. Purely additive atmosphere — render
 * full-frame behind the chrome; pointerEvents are off.
 *
 * Deterministic (uses `sakuraRand`, never `Math.random`) and driven by
 * `useSakuraFrame()` so preview and render match frame-for-frame, and cheap to
 * paint: a handful of radial-gradient ellipses + thin gradient ray wedges, no
 * blur filters. Pools that stray into `textFadeRect` are feathered down so
 * overlaid text stays legible (same idiom as SakuraBlossomCanopy).
 */
export const KomorebiLight: React.FC<{
  /** tints warmth/alpha for the ground it sits on */
  variant?: "light" | "dark";
  /** number of drifting light pools */
  count?: number;
  seed?: number;
  /** wrapper opacity; per-pool alpha does the real dimming */
  opacity?: number;
  /** diagonal god-rays raking across the frame */
  rays?: number;
  /** region (canvas coords) where pools should dim for legible text */
  textFadeRect?: { x: number; y: number; w: number; h: number };
  /** opacity multiplier at the center of textFadeRect (feathered to edges) */
  textFadeOpacity?: number;
}> = ({
  variant = "light",
  count = 11,
  seed = 30,
  opacity = 1,
  rays = 2,
  textFadeRect,
  textFadeOpacity = 0.3,
}) => {
  const { width: W, height: H } = useVideoConfig();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const frame = useSakuraFrame();
  const dark = variant === "dark";

  // Warm-light rgb pairs the pools/rays alternate between. Dark grounds get a
  // paler, cooler mix at lower alpha so the light reads as moonlit dapple.
  const warmA = dark ? "232,213,223" : "201,168,76"; // mist / gold
  const warmB = dark ? "201,168,76" : "244,184,200"; // gold / blush
  const poolAlpha = dark ? 0.07 : 0.12;
  const rayAlpha = dark ? 0.06 : 0.1;

  const pools = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const s = seed + i * 5.3;
        return {
          bx: sakuraRand(s, 1) * W,
          by: sakuraRand(s, 2) * H,
          r: 26 + sakuraRand(s, 3) * 46,
          ax: 14 + sakuraRand(s, 4) * 26,
          ay: 10 + sakuraRand(s, 5) * 20,
          fx: 0.004 + sakuraRand(s, 6) * 0.006,
          fy: 0.003 + sakuraRand(s, 7) * 0.005,
          phase: sakuraRand(s, 8) * Math.PI * 2,
          twFreq: 0.01 + sakuraRand(s, 9) * 0.02,
          baseOp: poolAlpha + sakuraRand(s, 10) * poolAlpha,
          warm: sakuraRand(s, 11) > 0.5 ? warmA : warmB,
        };
      }),
    [count, seed, W, H, poolAlpha, warmA, warmB],
  );

  const rayDefs = useMemo(
    () =>
      Array.from({ length: rays }, (_, i) => ({
        s: 11 + i * 7,
        cx: W * (0.28 + i * 0.4),
        rw: W * 0.18,
      })),
    [rays, W],
  );

  // Feathered dimming inside the text region (same idiom as SakuraBlossomCanopy).
  const fadeAt = (px: number, py: number): number => {
    if (!textFadeRect) return 1;
    const { x, y, w: rw, h: rh } = textFadeRect;
    const feather = 0.22;
    const nx = Math.abs((px - (x + rw / 2)) / (rw / 2));
    const ny = Math.abs((py - (y + rh / 2)) / (rh / 2));
    const inside = Math.max(nx, ny);
    if (inside >= 1) return 1;
    const edge = Math.max(0, Math.min(1, (inside - (1 - feather)) / feather));
    return textFadeOpacity + (1 - textFadeOpacity) * edge;
  };

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity }}
    >
      <defs>
        {pools.map((p, i) => (
          <radialGradient key={`kg-${i}`} id={`komo-${uid}-${i}`}>
            <stop offset="0%" stopColor={`rgba(${p.warm},1)`} />
            <stop offset="100%" stopColor={`rgba(${p.warm},0)`} />
          </radialGradient>
        ))}
        {rayDefs.map((r, i) => (
          <linearGradient key={`kr-${i}`} id={`komoray-${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`rgba(${warmA},${rayAlpha})`} />
            <stop offset="60%" stopColor={`rgba(${warmB},${rayAlpha * 0.5})`} />
            <stop offset="100%" stopColor={`rgba(${warmB},0)`} />
          </linearGradient>
        ))}
      </defs>

      {/* Diagonal god-rays raking down through the canopy. */}
      {rayDefs.map((r, i) => {
        const sway = Math.sin(frame * 0.006 + i) * 0.06;
        const ang = ((-0.5 + sway) * 180) / Math.PI;
        const rw = r.rw;
        return (
          <g key={`ray-${i}`} transform={`translate(${r.cx}, ${-H * 0.1}) rotate(${ang})`}>
            <polygon
              points={`${-rw * 0.3},0 ${rw * 0.3},0 ${rw},${H * 1.4} ${-rw},${H * 1.4}`}
              fill={`url(#komoray-${uid}-${i})`}
            />
          </g>
        );
      })}

      {/* Drifting dappled light pools. */}
      {pools.map((p, i) => {
        const x = p.bx + Math.sin(frame * p.fx * 2 * Math.PI + p.phase) * p.ax;
        const y = p.by + Math.cos(frame * p.fy * 2 * Math.PI + p.phase * 1.3) * p.ay;
        const tw = 0.5 + 0.5 * Math.sin(frame * p.twFreq * 2 * Math.PI + p.phase);
        const op = p.baseOp * tw * fadeAt(x, y);
        if (op < 0.01) return null;
        return (
          <ellipse
            key={`pool-${i}`}
            cx={x}
            cy={y}
            rx={p.r}
            ry={p.r * 0.82}
            fill={`url(#komo-${uid}-${i})`}
            opacity={op}
          />
        );
      })}
    </svg>
  );
};

// ─── MoonDisc — a low tsukimi harvest moon ───────────────────────────────────

/**
 * A large pale-gold `tsuki` (moon) disc for the tsukimi moon-viewing motif. Sits
 * low and faint behind a quote; the drifting `KasumiBands` mist (via the scene's
 * `ambient="kasumi"`) reads as clouds crossing it. Rises + fades into place from
 * `startFrame`. Pure static radial gradients + two faint "mare" blotches so it's
 * not a flat logo disc (wabi-sabi) — no blur filters, cheap to paint. All motion
 * is on `useSakuraFrame()` so preview == render. Render inside the `chrome` slot.
 */
export const MoonDisc: React.FC<{
  cx: number;
  cy: number;
  r: number;
  color?: string;
  startFrame?: number;
  opacity?: number;
}> = ({ cx, cy, r, color = SAKURA.gold, startFrame = 0, opacity = 0.55 }) => {
  const frame = useSakuraFrame();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const t = interpolate(frame, [startFrame, startFrame + 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (x) => 1 - Math.pow(1 - x, 3),
  });
  const rise = (1 - t) * r * 0.22; // rises up into place
  const box = r * 3; // room for the halo
  return (
    <svg
      width={box}
      height={box}
      viewBox={`${-box / 2} ${-box / 2} ${box} ${box}`}
      style={{
        position: "absolute",
        left: cx - box / 2,
        top: cy - box / 2 + rise,
        opacity: opacity * t,
        pointerEvents: "none",
      }}
    >
      <defs>
        <radialGradient id={`moon-${uid}`} cx="42%" cy="40%" r="60%">
          <stop offset="0%" stopColor={hexToRgba(color, 0.95)} />
          <stop offset="70%" stopColor={hexToRgba(color, 0.7)} />
          <stop offset="100%" stopColor={hexToRgba(color, 0.28)} />
        </radialGradient>
        <radialGradient id={`moonhalo-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor={hexToRgba(color, 0.18)} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      {/* soft halo */}
      <circle cx={0} cy={0} r={r * 1.4} fill={`url(#moonhalo-${uid})`} />
      {/* the disc */}
      <circle cx={0} cy={0} r={r} fill={`url(#moon-${uid})`} />
      {/* faint mare blotches — slightly cooler, low alpha */}
      <ellipse cx={-r * 0.22} cy={-r * 0.1} rx={r * 0.26} ry={r * 0.2} fill={hexToRgba(color, 0.12)} />
      <ellipse cx={r * 0.28} cy={r * 0.24} rx={r * 0.18} ry={r * 0.22} fill={hexToRgba(color, 0.1)} />
      {/* crisp rim */}
      <circle cx={0} cy={0} r={r} fill="none" stroke={hexToRgba(color, 0.4)} strokeWidth={1} />
    </svg>
  );
};

// ─── TanzakuPanel — a hanging poem-card / kakejiku scroll mount ───────────────

/**
 * A tall narrow washi panel that frames a quote like a mounted tanzaku poetry
 * card / kakejiku hanging scroll. A faint geometric ground (`Asanoha`, clipped to
 * the panel) reads as the woven mounting silk; thin gold `KintsugiLine` rails top
 * and bottom are the scroll's mounting bars. `progress` (0→1) "unrolls" the panel
 * from the top via a clip-path so it appears before the calligraphy is brushed in.
 * Render in the `chrome` slot BEHIND the quote column. Static fills only — cheap.
 */
export const TanzakuPanel: React.FC<{
  cx: number;
  cy: number;
  width: number;
  height: number;
  progress?: number;
  color?: string;
  railColor?: string;
}> = ({ cx, cy, width: w, height: h, progress = 1, color = SAKURA.washi, railColor = SAKURA.gold }) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const x = cx - w / 2;
  const y = cy - h / 2;
  // Unroll from the top: reveal the top `progress` fraction of the panel height.
  const clip = `inset(0 0 ${(1 - progress) * 100}% 0)`;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        clipPath: clip,
        WebkitClipPath: clip,
        pointerEvents: "none",
      }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <clipPath id={`tanz-${uid}`}>
            <rect x={0} y={0} width={w} height={h} />
          </clipPath>
        </defs>
        {/* washi panel + thin gold side borders */}
        <rect x={0} y={0} width={w} height={h} fill={hexToRgba(color, 0.06)} stroke={hexToRgba(railColor, 0.35)} strokeWidth={1} />
        {/* woven-silk ground: an asanoha lattice clipped to the panel */}
        <g clipPath={`url(#tanz-${uid})`} opacity={0.06}>
          {(() => {
            const R = 42;
            const dx = R * 1.5;
            const dy = R * Math.sqrt(3);
            const vert = (vx: number, vy: number, k: number) => {
              const a = (Math.PI / 3) * k - Math.PI / 2;
              return { x: vx + Math.cos(a) * R, y: vy + Math.sin(a) * R };
            };
            const lines: React.ReactNode[] = [];
            const cols = Math.ceil(w / dx) + 2;
            const rows = Math.ceil(h / dy) + 2;
            for (let c = -1; c < cols; c++) {
              for (let ri = -1; ri < rows; ri++) {
                const px = c * dx;
                const py = ri * dy + (c % 2 ? dy / 2 : 0);
                const v = Array.from({ length: 6 }, (_, k) => vert(px, py, k));
                for (let k = 0; k < 6; k++) {
                  const a = v[k];
                  const b = v[(k + 1) % 6];
                  lines.push(<line key={`${c}-${ri}-e${k}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={railColor} strokeWidth={0.8} />);
                  lines.push(<line key={`${c}-${ri}-s${k}`} x1={px} y1={py} x2={a.x} y2={a.y} stroke={railColor} strokeWidth={0.8} />);
                }
              }
            }
            return lines;
          })()}
        </g>
      </svg>
      {/* Gold mounting rails top + bottom (the scroll's jiku bars), drawn L→R. */}
      <div style={{ position: "absolute", top: -2, left: w * 0.06, width: w * 0.88 }}>
        <KintsugiLine width={w * 0.88} progress={progress} color={railColor} opacity={0.9} strokeWidth={1.6} />
      </div>
      <div style={{ position: "absolute", bottom: -2, left: w * 0.06, width: w * 0.88 }}>
        <KintsugiLine width={w * 0.88} progress={progress} color={railColor} opacity={0.9} strokeWidth={1.6} />
      </div>
    </div>
  );
};

// ─── SakuraScene — shared scene shell (now variant + entrance driven) ─────────

export const SakuraScene: React.FC<{
  /** background geometry variant — keyed per layout via SAKURA_BACKDROP */
  backdrop: SakuraBackdropVariant;
  /** layout key, drives the entrance family */
  entranceLayout?: string;
  bgColor?: string;
  accentColor?: string;
  /** asymmetric side; pass alternating per scene index for variety */
  side?: "left" | "right";
  dur: number;
  petals?: number;
  petalIntensity?: number;
  petalSeed?: number;
  /** petal-field motion mode — keep distinct per scene for variety */
  petalMode?: PetalMode;
  seigaihaColor?: string;
  /** render the petal rain behind the content (keeps text legible on text-heavy scenes) */
  petalsBehind?: boolean;
  /** apply the per-layout entrance to children (default true) */
  animateEntrance?: boolean;
  /** ambient atmosphere painted between the seigaiha wash and the chrome; default off.
   *  "mist_gold" = kasumi mist bands + kirikane gold flecks; "komorebi" = dappled
   *  sunlight pools + faint god-rays (木漏れ日). */
  ambient?: "mist_gold" | "kasumi" | "kirikane" | "komorebi";
  /** chrome that should NOT receive the entrance transform (kamon, corner petals) */
  chrome?: React.ReactNode;
  children: React.ReactNode;
}> = ({
  backdrop,
  entranceLayout,
  bgColor,
  accentColor,
  side = "left",
  dur,
  petals = 18,
  petalIntensity = 1,
  petalSeed = 7,
  petalMode = "drift",
  seigaihaColor,
  petalsBehind = false,
  animateEntrance = true,
  ambient,
  chrome,
  children,
}) => {
  const masterOpacity = useSceneFade(dur);
  const entrance = useSakuraEntrance(entranceLayout);
  const dark = isDarkBackdrop(backdrop);
  const seig = SEIGAIHA_FOR[backdrop];
  const patternColor = seigaihaColor ?? (dark ? SAKURA.blush : SAKURA.mist);

  return (
    <AbsoluteFill style={{ opacity: masterOpacity, backgroundColor: dark ? SAKURA.void : SAKURA.washi }}>
      <SakuraBackdrop variant={backdrop} bgColor={bgColor} accentColor={accentColor} side={side} />
      {seig > 0 && <Seigaiha opacity={seig} color={patternColor} />}
      {ambient && (
        <>
          {(ambient === "mist_gold" || ambient === "kasumi") && (
            <KasumiBands side={side} color={SAKURA.mist} opacity={dark ? 0.1 : 0.08} />
          )}
          {(ambient === "mist_gold" || ambient === "kirikane") && (
            <KirikaneDrift count={22} seed={53} />
          )}
          {ambient === "komorebi" && (
            <KomorebiLight variant={dark ? "dark" : "light"} />
          )}
        </>
      )}
      {chrome}
      {petals > 0 && petalsBehind && (
        <PetalRain count={petals} intensity={petalIntensity} seed={petalSeed} mode={petalMode} />
      )}
      <AbsoluteFill
        style={
          animateEntrance
            ? { opacity: entrance.opacity, transform: entrance.transform, clipPath: entrance.clipPath }
            : undefined
        }
      >
        {children}
      </AbsoluteFill>
      {petals > 0 && !petalsBehind && (
        <PetalRain count={petals} intensity={petalIntensity} seed={petalSeed} mode={petalMode} />
      )}
    </AbsoluteFill>
  );
};

// ─── Corner brackets (photo frame accents) ───────────────────────────────────

export const CornerBrackets: React.FC<{
  size?: number;
  strokeWidth?: number;
  topColor?: string;
  bottomColor?: string;
  startFrame?: number;
  durationFrames?: number;
  inset?: number;
}> = ({
  size = 38,
  strokeWidth = 3,
  topColor = SAKURA.crimson,
  bottomColor = SAKURA.deepBlush,
  startFrame = 6,
  durationFrames = 14,
  inset = -10,
}) => {
  const frame = useSakuraFrame();
  const progress = interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  const len = size * progress;
  const common: React.CSSProperties = { position: "absolute", overflow: "visible" };
  return (
    <>
      <svg width={size} height={size} style={{ ...common, top: inset, left: inset }}>
        <path
          d={`M 0 ${len} L 0 0 L ${len} 0`}
          stroke={topColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
      </svg>
      <svg width={size} height={size} style={{ ...common, bottom: inset, right: inset }}>
        <path
          d={`M ${size} ${size - len} L ${size} ${size} L ${size - len} ${size}`}
          stroke={bottomColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
      </svg>
    </>
  );
};

// ─── Procedural sakura tree (no-image fallback panel) ────────────────────────

const TREE_CLUSTERS: Array<[number, number, number]> = [
  [116, 244, 28], [150, 208, 20], [86, 212, 18],
  [330, 222, 26], [294, 192, 20], [358, 195, 17],
  [222, 268, 26], [192, 250, 18], [252, 252, 20],
  [196, 148, 24], [234, 134, 21], [160, 166, 18],
  [262, 160, 17], [208, 116, 22],
];

export const SakuraTreePanel: React.FC<{
  width: number;
  height: number;
}> = ({ width: w, height: h }) => {
  const frame = useSakuraFrame();
  // Gentle breathing on the blossom canopy
  const pulse = 1 + Math.sin(frame * 0.04) * 0.012;
  const sx = w / 450;
  const sy = h / 570;
  const colors = [SAKURA.blush, SAKURA.mist, SAKURA.deepBlush];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <rect width={w} height={h} fill={SAKURA.mist} />
      {/* Trunk */}
      <path
        d={`M ${217 * sx} ${568 * sy} Q ${222 * sx} ${460 * sy} ${226 * sx} ${410 * sy} Q ${230 * sx} ${460 * sy} ${234 * sx} ${568 * sy}`}
        fill={SAKURA.ink}
        opacity={0.45}
      />
      {/* Branches */}
      <path
        d={`M ${221 * sx} ${468 * sy} Q ${160 * sx} ${418 * sy} ${120 * sx} ${375 * sy}`}
        stroke={SAKURA.ink}
        strokeWidth={7 * sx}
        fill="none"
        strokeLinecap="round"
        opacity={0.38}
      />
      <path
        d={`M ${227 * sx} ${442 * sy} Q ${288 * sx} ${388 * sy} ${330 * sx} ${352 * sy}`}
        stroke={SAKURA.ink}
        strokeWidth={6 * sx}
        fill="none"
        strokeLinecap="round"
        opacity={0.38}
      />
      {/* Blossom clusters */}
      <g transform={`translate(${(w / 2) * (1 - pulse)}, ${(h * 0.4) * (1 - pulse)}) scale(${pulse})`}>
        {TREE_CLUSTERS.map(([x, y, r], i) => (
          <SoftPetal
            key={i}
            cx={x * sx}
            cy={(y + 120) * sy}
            r={r * Math.min(sx, sy)}
            rotation={i * 23}
            color={colors[i % 3]}
            opacity={0.88}
          />
        ))}
      </g>
    </svg>
  );
};

// ─── GrowingSakuraTree — recursive fractal tree that grows branch-by-branch ───

interface TreeBranch {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  len: number;
  depth: number;
  strokeW: number;
  /** blossoms carried by this branch — a cluster near the tip. `dx`/`dy` offset
   *  each flower off the twig endpoint so a branch can bear several. */
  blossoms?: { r: number; rot: number; ci: number; dx: number; dy: number }[];
}

/**
 * A cherry tree that GROWS: the trunk draws first, then branches unfurl
 * outward level-by-level to the tips, with sakura blossoms popping in at the
 * twigs once they arrive. Fully deterministic + frame-driven (uses sakuraRand,
 * never Math.random) so every render of a given frame is identical.
 *
 * Drive `grow` (0..1) from the scene's frame. Render inside normal flow — this
 * component IS its own <svg>. Petal fall is left to the scene's PetalRain.
 */
/**
 * Tree silhouette variants — each reshapes where the tree roots and which way
 * it grows, so the same recursion reads as a completely different tree.
 *  - `upright`   : roots bottom-center, grows up (the original).
 *  - `hanging`   : weeping shidarezakura — roots at the TOP, branches droop down.
 *  - `bonsai`    : short thick trunk, wide gnarled asymmetric canopy.
 *  - `windswept` : whole canopy swept toward one side, rooted at a bottom corner.
 *  - `canopy`    : roots ABOVE the frame, only the lower canopy hangs into view.
 *  - `sideways`  : roots at one side edge (default right), grows HORIZONTALLY
 *                  across the frame, the canopy fanning out as it advances.
 */
export type TreeVariant = "upright" | "hanging" | "bonsai" | "windswept" | "canopy" | "sideways";

/** Sway idiom once the tree has grown. */
export type TreeWind = "calm" | "breeze" | "gust";

export const GrowingSakuraTree: React.FC<{
  width: number;
  height: number;
  /** 0..1 master growth progress, driven by the scene */
  grow: number;
  depth?: number;
  /** base trunk length in px (defaults to ~34% of height) */
  trunkLen?: number;
  /** base branch spread half-angle, degrees */
  spreadAngle?: number;
  /** length ratio per level */
  shrink?: number;
  seed?: number;
  branchColor?: string;
  petalColors?: string[];
  /** how full the canopy blooms. 1 = one blossom per outermost tip (default).
   *  >1 fans blossoms onto near-tip branches too and scatters several per twig
   *  so the crown reads lush instead of bare. */
  blossomDensity?: number;
  /** trunk base; defaults to bottom-center of the canvas */
  originX?: number;
  originY?: number;
  opacity?: number;
  /** silhouette shape — see TreeVariant */
  variant?: TreeVariant;
  /** which way a windswept/leaning tree bends; also flips bonsai/windswept root corner */
  lean?: "left" | "right";
  /** sway idiom once grown */
  windStyle?: TreeWind;
  /** shed petals: once bloomed, individual petals occasionally release from the
   *  canopy tips and flutter down, riding the same wind as the tree. Off by default. */
  shed?: boolean;
  /** scales how many petals are aloft at once (default 1). ~6*shedIntensity petals. */
  shedIntensity?: number;
  /** region (in canvas coords) where branches/blossoms should dim for legible text */
  textFadeRect?: { x: number; y: number; w: number; h: number };
  /** opacity multiplier applied at the center of textFadeRect (feathered to edges) */
  textFadeOpacity?: number;
  /** scene duration in real frames. When set, the wind sway eases back to rest
   *  over the last ~20 frames so the tree isn't snapped away mid-swing at the cut. */
  dur?: number;
}> = ({
  width: w,
  height: h,
  grow,
  depth = 9,
  trunkLen,
  spreadAngle = 26,
  shrink = 0.76,
  seed = 42,
  branchColor = SAKURA.ink,
  petalColors = [SAKURA.blush, SAKURA.mist, SAKURA.deepBlush],
  blossomDensity = 1,
  originX,
  originY,
  opacity = 1,
  variant = "upright",
  lean = "right",
  windStyle = "calm",
  shed = false,
  shedIntensity = 1,
  textFadeRect,
  textFadeOpacity = 0.2,
  dur,
}) => {
  const frame = useSakuraFrame();
  const leanSign = lean === "left" ? -1 : 1;

  // Per-variant geometry: root position, base growth angle, trunk length, and a
  // constant lean added to every branch. Callers can still override via props.
  const geom = ((): {
    ox: number;
    oy: number;
    startAngle: number;
    baseLen: number;
    shrink: number;
    branchLean: number;
  } => {
    const defShrink = shrink;
    switch (variant) {
      case "hanging":
        // Weeping tree: roots high, grows DOWN, tighter shrink so tips droop.
        return {
          ox: originX ?? w / 2,
          oy: originY ?? h * 0.06,
          startAngle: 180,
          baseLen: trunkLen ?? h * 0.26,
          shrink: Math.min(0.86, defShrink + 0.06),
          branchLean: 0,
        };
      case "bonsai":
        // Short, thick, gnarled — swept to one side, rooted low on that side.
        return {
          ox: originX ?? w * (lean === "left" ? 0.36 : 0.64),
          oy: originY ?? h,
          startAngle: leanSign * 8,
          baseLen: trunkLen ?? h * 0.2,
          shrink: defShrink,
          branchLean: leanSign * 5,
        };
      case "windswept":
        // Whole canopy blown to one side, rooted at the opposite bottom corner.
        return {
          ox: originX ?? w * (lean === "left" ? 0.82 : 0.18),
          oy: originY ?? h,
          startAngle: leanSign * 18,
          baseLen: trunkLen ?? h * 0.3,
          shrink: defShrink,
          branchLean: leanSign * 9,
        };
      case "canopy":
        // Roots above the top edge; only the lower canopy hangs into frame.
        return {
          ox: originX ?? w / 2,
          oy: originY ?? -h * 0.14,
          startAngle: 180,
          baseLen: trunkLen ?? h * 0.3,
          shrink: defShrink,
          branchLean: 0,
        };
      case "sideways":
        // Roots at a side edge (right by default) and grows HORIZONTALLY across
        // the frame; the canopy fans out vertically as branches advance inward.
        // startAngle 270 → grows left, 90 → grows right (sin(a) drives x).
        return {
          ox: originX ?? (lean === "right" ? 0 : w),
          oy: originY ?? h / 2,
          startAngle: lean === "right" ? 90 : 270,
          baseLen: trunkLen ?? w * 0.34,
          shrink: defShrink,
          branchLean: 0,
        };
      case "upright":
      default:
        return {
          ox: originX ?? w / 2,
          oy: originY ?? h,
          startAngle: 0,
          baseLen: trunkLen ?? h * 0.34,
          shrink: defShrink,
          branchLean: 0,
        };
    }
  })();

  const ox = geom.ox;
  const oy = geom.oy;
  const baseLen = geom.baseLen;
  const treeShrink = geom.shrink;
  const branchLean = geom.branchLean;
  const startAngle = geom.startAngle;
  const maxDepth = depth;

  // Build the whole branch list once — deterministic, so it's a pure fn of shape props.
  const branches = useMemo<TreeBranch[]>(() => {
    const out: TreeBranch[] = [];
    let rc = 0; // running counter → unique deterministic-random draws
    const rnd = () => sakuraRand(seed, rc++);

    const grow1 = (
      x: number,
      y: number,
      angleDeg: number,
      len: number,
      d: number,
    ) => {
      const a = (angleDeg * Math.PI) / 180;
      const x2 = x + Math.sin(a) * len;
      const y2 = y - Math.cos(a) * len;
      const strokeW = Math.max(1, (maxDepth - d + 1) * 1.6);
      const isTip = d >= maxDepth - 1;
      // Blossom clusters. At density 1 (default) only the outermost tip gets a
      // single flower — identical to the original. Higher density lets near-tip
      // branches bloom too and scatters several jittered flowers per twig so the
      // canopy reads full rather than a bare winter branch.
      const nearTip = d >= maxDepth - 2;
      const blooms: { r: number; rot: number; ci: number; dx: number; dy: number }[] = [];
      if (blossomDensity <= 1) {
        if (isTip) {
          blooms.push({ r: 6 + rnd() * 7, rot: rnd() * 360, ci: Math.floor(rnd() * petalColors.length), dx: 0, dy: 0 });
        }
      } else if (isTip || nearTip) {
        // 1 flower on near-tip branches, more toward the outermost tips.
        const base = isTip ? blossomDensity : Math.max(1, blossomDensity - 2);
        const n = Math.max(1, Math.round(base * (0.6 + rnd() * 0.8)));
        for (let k = 0; k < n; k++) {
          const spread = 10 + rnd() * 14; // px scatter along/around the twig
          blooms.push({
            r: 5 + rnd() * 8,
            rot: rnd() * 360,
            ci: Math.floor(rnd() * petalColors.length),
            dx: (rnd() - 0.5) * 2 * spread,
            dy: (rnd() - 0.5) * 2 * spread,
          });
        }
      }
      out.push({
        x1: x,
        y1: y,
        x2,
        y2,
        len,
        depth: d,
        strokeW,
        blossoms: blooms.length ? blooms : undefined,
      });
      if (d >= maxDepth || len < 6) return;
      // per-branch jitter → natural, asymmetric growth. `branchLean` adds a
      // constant directional bias so windswept/bonsai canopies sweep one way.
      const jL = spreadAngle * (0.75 + rnd() * 0.5);
      const jR = spreadAngle * (0.75 + rnd() * 0.5);
      const lenL = len * treeShrink * (0.85 + rnd() * 0.3);
      const lenR = len * treeShrink * (0.85 + rnd() * 0.3);
      grow1(x2, y2, angleDeg - jL + branchLean, lenL, d + 1);
      grow1(x2, y2, angleDeg + jR + branchLean, lenR, d + 1);
      // occasional third middle branch deeper in → fuller canopy
      if (d >= 2 && rnd() > 0.55) {
        grow1(x2, y2, angleDeg + (rnd() - 0.5) * spreadAngle + branchLean, len * treeShrink * 0.82, d + 1);
      }
    };

    grow1(ox, oy, startAngle, baseLen, 0);
    return out;
  }, [ox, oy, baseLen, maxDepth, spreadAngle, treeShrink, branchLean, startAngle, seed, petalColors, blossomDensity]);

  // Shed petals: a small fixed pool of petals that release from canopy tips and
  // flutter down. Each is a pure fn of `seed` (via sakuraRand) + `frame`, so it's
  // fully deterministic. Anchored to real tip coordinates so petals fall from the
  // actual branches; rendered inside the sway group so they ride the same wind.
  const shedders = useMemo(() => {
    if (!shed) return [];
    // Canopy tips only — the outer two depth levels bear the blossoms.
    const tips = branches.filter((b) => b.depth >= maxDepth - 2);
    if (!tips.length) return [];
    const count = Math.max(1, Math.round(6 * shedIntensity));
    return Array.from({ length: count }, (_, i) => {
      const rs = (n: number) => sakuraRand(seed + 991, i * 13 + n); // per-petal stream
      const tip = tips[Math.floor(rs(0) * tips.length) % tips.length];
      return {
        // origin near a tip, with a little scatter like the blossom clusters
        ox0: tip.x2 + (rs(1) - 0.5) * 22,
        oy0: tip.y2 + (rs(2) - 0.5) * 22,
        // long, staggered cycle so releases are occasional, not a stream
        cycle: 320 + Math.floor(rs(3) * 260),
        birth: Math.floor(rs(4) * 520),
        fallDur: 150 + Math.floor(rs(5) * 130),
        fallDist: h * (0.42 + rs(6) * 0.3),
        drift: h * (0.02 + rs(7) * 0.03), // sideways flutter amplitude
        swayFreq: 0.045 + rs(8) * 0.04,
        phase: rs(9) * Math.PI * 2,
        rotSpeed: (rs(10) - 0.5) * 6, // deg/frame tumble
        r: 5 + rs(11) * 4,
        ci: Math.floor(rs(12) * petalColors.length),
      };
    });
  }, [shed, shedIntensity, branches, maxDepth, seed, petalColors, h]);

  // Growth window per depth: each level starts after the previous, unfolding tips last.
  const slice = 1 / (maxDepth + 1);
  const drawDur = slice * 1.9; // levels overlap slightly so growth reads continuously
  const segT = (d: number) => {
    const t = (grow - d * slice) / drawDur;
    return Math.max(0, Math.min(1, t));
  };
  // Gentle canopy breathing once grown (same idiom as SakuraTreePanel).
  // Layered sines per windStyle → tips read as swaying more than the trunk.
  const settle = Math.max(0, Math.min(1, (grow - 0.85) / 0.15));
  const sway = ((): number => {
    switch (windStyle) {
      case "breeze":
        // Two summed sines at different freq/amp → looser, wandering drift.
        return (
          (Math.sin(frame * 0.03) * 0.9 + Math.sin(frame * 0.017 + 1.3) * 0.6) *
          settle
        );
      case "gust":
        // Slow base sway whose amplitude swells periodically → lean-and-recover.
        return (
          Math.sin(frame * 0.022) *
          (1.1 + Math.max(0, Math.sin(frame * 0.006)) * 1.8) *
          settle
        );
      case "calm":
      default:
        return Math.sin(frame * 0.035) * 0.7 * settle;
    }
  })();
  // Ease the wind sway back to rest before the scene is cut, so the tree isn't
  // snapped away mid-swing (that abrupt stop reads as a jerk). Real clock — an
  // end-keyed ramp must not be tempo-scaled or it never reaches 0 at `dur`.
  const realFrame = useCurrentFrame();
  const SWAY_SETTLE = 20; // frames over which the sway eases to rest
  const swaySettleOut =
    dur != null
      ? interpolate(realFrame, [dur - SWAY_SETTLE, dur], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: (t) => t * t, // ease-out so the last bit of motion is gentle
        })
      : 1;

  // Fade branches/blossoms toward `textFadeOpacity` where they cross the text
  // block, with feathered edges so they ease into the dimmed region.
  const fadeAt = (px: number, py: number): number => {
    if (!textFadeRect) return 1;
    const { x, y, w: rw, h: rh } = textFadeRect;
    const feather = 0.22; // fraction of half-size over which it eases in
    const nx = Math.abs((px - (x + rw / 2)) / (rw / 2)); // 0 center → 1 edge
    const ny = Math.abs((py - (y + rh / 2)) / (rh / 2));
    const inside = Math.max(nx, ny);
    if (inside >= 1) return 1; // outside rect → full opacity
    // 0 at center, 1 at the edge band → lerp from textFadeOpacity up to 1
    const edge = Math.max(0, Math.min(1, (inside - (1 - feather)) / feather));
    return textFadeOpacity + (1 - textFadeOpacity) * edge;
  };

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ display: "block", overflow: "visible", opacity, pointerEvents: "none" }}
    >
      <g transform={`rotate(${sway * swaySettleOut}, ${ox}, ${oy})`}>
        {branches.map((b, i) => {
          const t = segT(b.depth);
          if (t <= 0) return null;
          const depthOp = 0.5 + 0.5 * Math.min(1, (maxDepth - b.depth + 3) / maxDepth);
          const fade = fadeAt((b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2);
          return (
            <line
              key={i}
              x1={b.x1}
              y1={b.y1}
              x2={b.x2}
              y2={b.y2}
              stroke={branchColor}
              strokeWidth={b.strokeW}
              strokeLinecap="round"
              strokeDasharray={b.len}
              strokeDashoffset={b.len * (1 - t)}
              opacity={depthOp * fade}
            />
          );
        })}
        {branches.map((b, i) => {
          if (!b.blossoms) return null;
          // Blossoms bloom only after their twig has finished drawing.
          const t = segT(b.depth);
          const bloom = Math.max(0, Math.min(1, (t - 0.6) / 0.4));
          if (bloom <= 0) return null;
          return b.blossoms.map((bl, k) => {
            const cx = b.x2 + bl.dx;
            const cy = b.y2 + bl.dy;
            const fade = fadeAt(cx, cy);
            return (
              <g key={`bl-${i}-${k}`} opacity={fade}>
                <SoftPetal
                  cx={cx}
                  cy={cy}
                  r={bl.r}
                  rotation={bl.rot}
                  color={petalColors[bl.ci]}
                  centerColor={SAKURA.deepBlush}
                  bloomProgress={bloom}
                />
              </g>
            );
          });
        })}
        {/* Shed petals — only once the canopy has bloomed (settle > 0). Each falls
            along a staggered cycle so releases stay occasional; petals flutter
            sideways as they drop and fade in on release / out near the ground. */}
        {settle > 0 &&
          shedders.map((s, i) => {
            const local = ((frame - s.birth) % s.cycle + s.cycle) % s.cycle;
            const t = local / s.fallDur;
            if (t <= 0 || t >= 1) return null; // resting between releases
            const cx = s.ox0 + Math.sin(frame * s.swayFreq + s.phase) * s.drift;
            const cy = s.oy0 + t * s.fallDist;
            const fadeIn = Math.min(1, t / 0.12);
            const fadeOut = Math.min(1, (1 - t) / 0.2);
            const op = fadeIn * fadeOut * settle * fadeAt(cx, cy);
            if (op <= 0.01) return null;
            return (
              <g key={`shed-${i}`} opacity={op}>
                <SoftPetal
                  cx={cx}
                  cy={cy}
                  r={s.r}
                  rotation={frame * s.rotSpeed + s.phase * 57}
                  color={petalColors[s.ci]}
                  centerColor={SAKURA.deepBlush}
                />
              </g>
            );
          })}
      </g>
    </svg>
  );
};

// ─── SakuraBlossomCanopy — a dense horizontal-bough canopy across the bottom ──

/**
 * A dense, wall-to-wall canopy of cherry blossoms that fills the bottom section
 * of the frame — packed blossoms riding along HORIZONTAL arching boughs that
 * sweep laterally across the width, exactly like a row of sakura trees seen head
 * on (cf. the temple-hillside shot). Blossoms overlap edge-to-edge so no gaps
 * show; the dark boughs arc through them for structure.
 *
 * Construction: a few gently-arcing horizontal boughs are laid across the width
 * at stacked heights; blossoms are seeded thickly ALONG each bough plus a dense
 * jittered fill between them, so the band reads as a solid blossom wall with
 * branches woven through. It blooms in on `grow` (boughs draw, blossoms unfurl in
 * a left→right / bottom-up wave), then breathes with a gentle wind sway.
 *
 * Deterministic (uses `sakuraRand`, never `Math.random`) so preview and render
 * match frame-for-frame. Render as a full-frame overlay; it positions itself.
 */
export const SakuraBlossomCanopy: React.FC<{
  width: number;
  height: number;
  /** 0..1 master bloom progress, driven by the scene */
  grow: number;
  /** which edge the canopy grows from: a bottom band (default) or a right-side wall */
  orientation?: "bottom" | "right";
  /** thickness of the canopy band — of height for "bottom" (default ~34% of h),
   *  of width for "right" (default ~34% of w) */
  bandHeight?: number;
  seed?: number;
  petalColors?: string[];
  /** dark arching boughs */
  branchColor?: string;
  opacity?: number;
  /** sway idiom once bloomed */
  windStyle?: TreeWind;
  /** region (canvas coords) where blossoms should dim for legible text */
  textFadeRect?: { x: number; y: number; w: number; h: number };
  /** opacity multiplier applied at the center of textFadeRect (feathered to edges) */
  textFadeOpacity?: number;
}> = ({
  width: w,
  height: h,
  grow,
  orientation = "bottom",
  bandHeight,
  seed = 91,
  petalColors = [SAKURA.blush, SAKURA.mist, SAKURA.deepBlush],
  branchColor = SAKURA.ink,
  opacity = 0.7,
  windStyle = "breeze",
  textFadeRect,
  textFadeOpacity = 0.2,
}) => {
  const frame = useSakuraFrame();
  const vertical = orientation === "right";
  // "bottom": band is a horizontal strip `band` px tall along the bottom.
  // "right":  band is a vertical strip `band` px wide along the right edge.
  const band = bandHeight ?? (vertical ? w * 0.34 : h * 0.34);
  const top = h - band; // (bottom mode) y where the band begins → fills to h
  const left = w - band; // (right mode)  x where the band begins → fills to w

  // ── Horizontal arching boughs sweeping across the width ─────────────────────
  // Each bough is a shallow quadratic arc spanning (past) the full width at a
  // stacked height, drawn thick→thin. Blossoms are seeded densely along them.
  type Bough = {
    d: string; len: number; strokeW: number; stagger: number;
    // sampled points along the arc, for seeding blossoms
    pts: Array<{ x: number; y: number }>;
    // canvas anchor of the bough's mid-span, used for text-fade dimming
    fx: number; fy: number;
  };
  const boughs = useMemo<Bough[]>(() => {
    const out: Bough[] = [];
    const count = 5;
    for (let i = 0; i < count; i++) {
      const s = 400 + i * 13.3;
      // t: 0 = front (on the visible edge) → 1 = back (marching into the band)
      const t = i / (count - 1);
      // arc: sag or lift by a fraction of band, and a slight overall tilt
      const sag = (sakuraRand(s, 1) - 0.5) * band * 0.55;
      const tilt = (sakuraRand(s, 2) - 0.5) * band * 0.3;
      const jitter = (sakuraRand(s, 3) - 0.5);

      let d: string, x1: number, y1: number, x2: number, y2: number;
      let cxp: number, cyp: number, fx: number, fy: number;
      if (vertical) {
        // Vertical bough: arcs top→bottom (past the edges), stacked in x from
        // the right edge (front) marching left into the band (back).
        const x0 = w - 20 + t * (left - w + 20) - t * 10;
        x1 = x0 + tilt; x2 = x0 - tilt;
        y1 = -h * 0.08; y2 = h * 1.08;
        cxp = x0 + sag;
        cyp = h * 0.5 + jitter * h * 0.2;
        d = `M ${x1} ${y1} Q ${cxp} ${cyp} ${x2} ${y2}`;
        fx = x0; fy = h / 2;
      } else {
        // Horizontal bough: arcs left→right, stacked in y from the bottom edge
        // (front) marching up toward `top` (back).
        const y0 = h - 20 + t * (top - h + 20) - t * 10;
        y1 = y0 + tilt; y2 = y0 - tilt;
        x1 = -w * 0.08; x2 = w * 1.08;
        cxp = w * 0.5 + jitter * w * 0.2;
        cyp = y0 + sag;
        d = `M ${x1} ${y1} Q ${cxp} ${cyp} ${x2} ${y2}`;
        fx = w / 2; fy = y0;
      }
      // sample the quadratic Bézier for blossom seeding
      const pts: Array<{ x: number; y: number }> = [];
      const samples = 46;
      for (let j = 0; j <= samples; j++) {
        const u = j / samples;
        const mx = (1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * cxp + u * u * x2;
        const my = (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * cyp + u * u * y2;
        pts.push({ x: mx, y: my });
      }
      out.push({
        d,
        len: Math.hypot(x2 - x1, y2 - y1) + Math.abs(sag) * 1.5,
        strokeW: 3 + (1 - t) * 6, // front boughs thicker
        stagger: t * 0.25 + sakuraRand(s, 4) * 0.1,
        pts,
        fx,
        fy,
      });
    }
    return out;
  }, [w, h, band, vertical, top, left]);

  // ── Blossoms: dense fill grid + a thick ribbon riding each bough ────────────
  type Blossom = { x: number; y: number; r: number; rot: number; color: string; stagger: number; sway: number; depth: number };
  const blossoms = useMemo<Blossom[]>(() => {
    const out: Blossom[] = [];
    let rc = 0;

    // (a) Dense jittered fill so blossoms touch edge-to-edge across the band.
    // `cols` runs ALONG the band (across the width for bottom, down the height for
    // right); `rows` stacks THROUGH the band's thickness from front → back.
    const alongLen = vertical ? h : w;
    const cols = Math.max(30, Math.round(alongLen / 42)); // much denser → wall-to-wall
    const rows = 9;
    const colStep = alongLen / cols;
    const rowStep = band / (rows - 3); // extra rows sink past the visible edge
    for (let row = 0; row < rows; row++) {
      const front = row / (rows - 1); // 0 back → 1 front
      for (let col = 0; col <= cols; col++) {
        const s = row * 149 + col * 7.9 + seed;
        const aJit = (sakuraRand(s, 1) - 0.5) * colStep * 1.5;
        const tJit = (sakuraRand(s, 2) - 0.5) * rowStep * 1.3;
        // position ALONG the band, and THROUGH its thickness
        const along = col * colStep + (row % 2 ? colStep * 0.5 : 0) + aJit;
        const through = row * rowStep + tJit;
        // map (along, through) → canvas (x, y) per orientation
        const x = vertical ? left + through : along;
        const y = vertical ? along : top + through;
        const r = (9 + front * 12) * (0.75 + sakuraRand(s, 3) * 0.6);
        const ci = front > 0.55
          ? (sakuraRand(s, 4) > 0.45 ? 2 : 0)
          : (sakuraRand(s, 4) > 0.4 ? 1 : 0);
        out.push({
          x, y, r,
          rot: sakuraRand(s, 5) * 360,
          color: petalColors[ci] ?? petalColors[0],
          stagger: (1 - front) * 0.35 + (along / alongLen) * 0.18 + sakuraRand(s, 6) * 0.1,
          sway: sakuraRand(s, 7) * Math.PI * 2,
          depth: front,
        });
      }
    }

    // (b) A thick clustered ribbon of blossoms hugging each bough → the branch
    //     reads as a flowering limb, blossoms mounded above/along it.
    boughs.forEach((bough, bi) => {
      bough.pts.forEach((pt, pi) => {
        const clusters = 3;
        for (let c = 0; c < clusters; c++) {
          const s = 700 + bi * 61 + pi * 5.7 + c * 2.3;
          // scatter across the limb, and mound toward the frame interior
          // (above the limb for a bottom band; left of it for a right wall)
          const scatter = (sakuraRand(s, 1) - 0.5) * 34;
          const mound = -sakuraRand(s, 2) * 26;
          const front = 1 - bi / Math.max(1, boughs.length - 1);
          const r = (10 + front * 11) * (0.7 + sakuraRand(s, 3) * 0.7);
          const ci = sakuraRand(s, 4) > 0.4 ? (front > 0.5 ? 2 : 1) : 0;
          const x = pt.x + (vertical ? mound : scatter);
          const y = pt.y + (vertical ? scatter : mound) + (sakuraRand(s, 5) - 0.5) * 10;
          const along = vertical ? y : x;
          const alongLen = vertical ? h : w;
          out.push({
            x, y, r,
            rot: sakuraRand(s, 6) * 360,
            color: petalColors[ci] ?? petalColors[0],
            stagger: bough.stagger + (along / alongLen) * 0.18 + sakuraRand(s, 7) * 0.08,
            sway: sakuraRand(s, 8) * Math.PI * 2,
            depth: front,
          });
        }
      });
    });

    // draw far/back (low depth) first, near/front last → front mounds on top
    out.sort((a, b) => a.depth - b.depth);
    return out;
  }, [w, h, band, seed, petalColors, boughs, vertical, top, left]);

  // ── Grow-in scheduling ──────────────────────────────────────────────────────
  // Boughs extend SLOWLY: drawn over a wide window (÷0.75) so they creep across
  // the frame rather than snapping in, easing out as each limb finishes.
  const boughProgress = (stagger: number) => {
    const t = Math.max(0, Math.min(1, (grow - stagger * 0.2) / 0.75));
    return 1 - Math.pow(1 - t, 2); // ease-out → decelerates as it reaches the end
  };
  const bloomProgress = (stagger: number) =>
    Math.max(0, Math.min(1, (grow - 0.12 - stagger * 0.55) / 0.4));

  // ── Wind sway once bloomed (same idiom as GrowingSakuraTree) ────────────────
  const settle = Math.max(0, Math.min(1, (grow - 0.85) / 0.15));
  const sway = ((): number => {
    switch (windStyle) {
      case "breeze":
        return (Math.sin(frame * 0.03) * 0.9 + Math.sin(frame * 0.017 + 1.3) * 0.6) * settle;
      case "gust":
        return Math.sin(frame * 0.022) * (1.1 + Math.max(0, Math.sin(frame * 0.006)) * 1.8) * settle;
      case "calm":
      default:
        return Math.sin(frame * 0.035) * 0.7 * settle;
    }
  })();

  // Dim blossoms/boughs that stray into the text region, feathered at the edges.
  const fadeAt = (px: number, py: number): number => {
    if (!textFadeRect) return 1;
    const { x, y, w: rw, h: rh } = textFadeRect;
    const feather = 0.22;
    const nx = Math.abs((px - (x + rw / 2)) / (rw / 2));
    const ny = Math.abs((py - (y + rh / 2)) / (rh / 2));
    const inside = Math.max(nx, ny);
    if (inside >= 1) return 1;
    const edge = Math.max(0, Math.min(1, (inside - (1 - feather)) / feather));
    return textFadeOpacity + (1 - textFadeOpacity) * edge;
  };

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ position: "absolute", inset: 0, overflow: "visible", opacity, pointerEvents: "none" }}
    >
      {/* Whole canopy sways from the anchored edge (bottom-center for a bottom
          band, right-center for a right wall) so the free inner edge moves most. */}
      <g transform={`rotate(${sway}, ${vertical ? w : w / 2}, ${vertical ? h / 2 : h})`}>
        {/* Arching boughs drawing in along the band */}
        {boughs.map((bough, i) => {
          const p = boughProgress(bough.stagger);
          if (p <= 0) return null;
          const fade = fadeAt(bough.fx, bough.fy);
          return (
            <path
              key={`bo-${i}`}
              d={bough.d}
              fill="none"
              stroke={branchColor}
              strokeWidth={bough.strokeW}
              strokeLinecap="round"
              strokeDasharray={bough.len}
              strokeDashoffset={bough.len * (1 - p)}
              opacity={0.3 * fade}
            />
          );
        })}
        {/* Wall-to-wall blossoms, front mounding on top */}
        {blossoms.map((b, i) => {
          const bloom = bloomProgress(b.stagger);
          if (bloom <= 0) return null;
          const fade = fadeAt(b.x, b.y);
          // gentle perpetual jostle once bloomed
          const jx = Math.sin(frame * 0.03 + b.sway) * 2 * settle;
          const jy = Math.cos(frame * 0.024 + b.sway) * 1.5 * settle;
          return (
            <g key={`bl-${i}`} opacity={fade} transform={`translate(${jx}, ${jy})`}>
              <SoftPetal
                cx={b.x}
                cy={b.y}
                r={b.r}
                rotation={b.rot}
                color={b.color}
                centerColor={SAKURA.deepBlush}
                bloomProgress={bloom}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
};

// ─── InkBranch — sumi-e / kacho-e sparse ink bough with blossoms ─────────────

/**
 * A single elegant ink-brush cherry bough (sumi-e / kacho-e "flower & bird"
 * style) — one tapered main stroke with a few branchlets, a *sparse* handful of
 * SoftPetal blossoms, and a couple of gold kirikane flecks at the tips. This is
 * the refined, restrained replacement for the big cartoonish LargeBlossom: it
 * carries the frame through negative space, not mass.
 *
 * The whole bough is authored in a local ~100×100 space then placed via
 * translate/rotate/scale, so callers position it in frame pixels. `grow` (0..1)
 * paints the branch on (stroke dash) and blooms the blossoms in sequentially;
 * omit for a fully-drawn static bough. Render inside an <svg> OR standalone —
 * it renders its own <svg> so it can be dropped straight into `chrome`.
 */
export const InkBranch: React.FC<{
  /** frame-space anchor (the branch base) */
  x: number;
  y: number;
  /** overall size in px (the local 100-unit space maps to this) */
  scale?: number;
  rotation?: number;
  /** 0..1 draw-on + bloom-in progress; omit for static */
  grow?: number;
  /** flip horizontally so the bough can face either way */
  flip?: boolean;
  branchColor?: string;
  blossomColor?: string;
  blossomCenter?: string;
  goldColor?: string;
  opacity?: number;
}> = ({
  x,
  y,
  scale = 300,
  rotation = 0,
  grow = 1,
  flip = false,
  branchColor = SAKURA.ink,
  blossomColor = SAKURA.blush,
  blossomCenter = SAKURA.deepBlush,
  goldColor = SAKURA.gold,
  opacity = 1,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  // Local coordinate space: base at (50,100), branch sweeps up-and-right.
  // Two brush strokes (main bough + one offshoot) as tapered Béziers.
  const mainStroke = "M 50 100 C 46 74, 40 52, 52 32 C 60 18, 74 12, 86 8";
  const offStroke = "M 55 62 C 62 58, 72 56, 82 48";
  const off2Stroke = "M 48 44 C 40 40, 30 40, 20 34";

  // Blossom + bud positions along the strokes (local space). Delicate: many
  // SMALL blossoms clustered near the branch tips (like a real cherry bough),
  // not a few big ones — the whole point of the refined kacho-e look.
  const blossoms: Array<{
    x: number;
    y: number;
    r: number;
    order: number;
    bud?: boolean;
  }> = [
    // main-stroke tip cluster
    { x: 86, y: 8, r: 5, order: 0 },
    { x: 90, y: 13, r: 3.6, order: 0 },
    { x: 80, y: 6, r: 4, order: 1 },
    { x: 83, y: 14, r: 2.8, order: 1, bud: true },
    // upper offshoot tip
    { x: 82, y: 48, r: 4.4, order: 2 },
    { x: 87, y: 45, r: 3, order: 2 },
    { x: 78, y: 51, r: 2.6, order: 3, bud: true },
    // left offshoot tip
    { x: 20, y: 34, r: 4.6, order: 2 },
    { x: 24, y: 30, r: 3.2, order: 3 },
    { x: 17, y: 38, r: 2.4, order: 3, bud: true },
    // a couple along the main bough
    { x: 60, y: 26, r: 3.4, order: 4 },
    { x: 52, y: 38, r: 2.6, order: 4, bud: true },
  ];
  // Gold kirikane flecks at a couple of tips.
  const flecks = [
    { x: 92, y: 9, s: 2.6 },
    { x: 15, y: 33, s: 2.2 },
    { x: 85, y: 44, s: 2 },
  ];

  // Draw-on: reveal the strokes by dash-offset, then bloom blossoms in sequence.
  const strokeDraw = Math.max(0, Math.min(1, grow / 0.55)); // strokes finish by ~55%
  const dash = 220;

  return (
    <svg
      width={scale}
      height={scale}
      viewBox="0 0 100 100"
      style={{
        position: "absolute",
        left: x - scale / 2,
        top: y - scale / 2,
        overflow: "visible",
        opacity,
        pointerEvents: "none",
        transform: `rotate(${rotation}deg)${flip ? " scaleX(-1)" : ""}`,
        transformOrigin: "center",
      }}
    >
      {[mainStroke, offStroke, off2Stroke].map((d, i) => (
        <path
          key={`s-${uid}-${i}`}
          d={d}
          fill="none"
          stroke={branchColor}
          strokeWidth={i === 0 ? 2.6 : 1.6}
          strokeLinecap="round"
          strokeDasharray={dash}
          strokeDashoffset={dash * (1 - strokeDraw)}
          opacity={0.9}
        />
      ))}
      {blossoms.map((b, i) => {
        // each blossom blooms after the strokes, lightly staggered by order so
        // every blossom is fully open by grow=1.
        const start = 0.5 + b.order * 0.07;
        const bp = Math.max(0, Math.min(1, (grow - start) / 0.24));
        if (bp <= 0) return null;
        // Buds: a small closed blossom — a tight two-tone circle, not open petals.
        if (b.bud) {
          const rr = b.r * (0.5 + 0.5 * bp);
          return (
            <g key={`b-${uid}-${i}`} opacity={bp}>
              <circle cx={b.x} cy={b.y} r={rr} fill={blossomColor} />
              <circle cx={b.x} cy={b.y} r={rr * 0.5} fill={blossomCenter} />
            </g>
          );
        }
        return (
          <SoftPetal
            key={`b-${uid}-${i}`}
            cx={b.x}
            cy={b.y}
            r={b.r}
            color={blossomColor}
            centerColor={blossomCenter}
            bloomProgress={bp}
          />
        );
      })}
      {flecks.map((f, i) => {
        const fp = Math.max(0, Math.min(1, (grow - 0.8) / 0.2));
        if (fp <= 0) return null;
        return (
          <rect
            key={`f-${uid}-${i}`}
            x={f.x - (f.s / 2) * fp}
            y={f.y - (f.s / 2) * fp}
            width={f.s * fp}
            height={f.s * fp}
            transform={`rotate(45, ${f.x}, ${f.y})`}
            fill={goldColor}
            opacity={0.9 * fp}
          />
        );
      })}
    </svg>
  );
};

// ─── SakuraVineFrame — a flowering vine that grows around a rectangle's edge ──

/**
 * A cherry-blossom vine that GROWS around the perimeter of a rectangle,
 * hugging (and covering) its border like a real climbing vine. Designed to be
 * overlaid on a panel/table: give it the panel's pixel width/height and it
 * traces a gently-wavy stroke around all four edges, starting at the top-left
 * corner and travelling clockwise, with leaves and SoftPetal blossoms unfurling
 * along the vine *behind* the advancing tip.
 *
 * Draw-on uses the same stroke-dashoffset device as BrushUnderline / InkBranch,
 * so preview == render and it costs almost nothing to paint. All jitter is
 * deterministic via `sakuraRand`. Render standalone (it emits its own <svg>) —
 * position it absolutely over the panel with matching inset.
 *
 * `grow` (0..1) drives the whole reveal: the vine draws on while blossoms bloom
 * in its wake; omit for a fully-grown static frame.
 */
export const SakuraVineFrame: React.FC<{
  /** panel size in px — the vine runs along this rectangle's edge */
  width: number;
  height: number;
  /** 0..1 draw-on + bloom-in progress; omit for a fully-grown vine */
  grow?: number;
  vineColor?: string;
  leafColor?: string;
  blossomColor?: string;
  blossomCenter?: string;
  /** overall thickness of the vine stroke */
  thickness?: number;
  /** base blossom radius (scaled per-flower); leaves scale from this too */
  blossomR?: number;
  /** how many blossom clusters ride the whole perimeter */
  blossomCount?: number;
  seed?: number;
  opacity?: number;
}> = ({
  width: w,
  height: h,
  grow = 1,
  vineColor = "#5C7248",
  leafColor = "#6E8B4E",
  blossomColor = SAKURA.blush,
  blossomCenter = SAKURA.deepBlush,
  thickness = 3,
  blossomR = 13,
  blossomCount = 14,
  seed = 41,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  // Small overhang so the vine sits ON the border and covers it. Blossoms/leaves
  // now spill INWARD (over the table surface), so only a hair of outer room is
  // needed for the stroke's round caps and a blossom straddling the line.
  const pad = blossomR * 0.65;
  const vw = w + pad * 2;
  const vh = h + pad * 2;
  // Corner radius the vine rounds at each turn.
  const cr = Math.min(28, w * 0.12, h * 0.12);

  // Perimeter path (clockwise from top-left, rounded corners) authored in the
  // padded viewbox where the panel border sits at inset `pad`.
  const x0 = pad;
  const y0 = pad;
  const x1 = pad + w;
  const y1 = pad + h;
  const perimeter = [
    `M ${x0 + cr} ${y0}`,
    `L ${x1 - cr} ${y0}`,
    `Q ${x1} ${y0} ${x1} ${y0 + cr}`,
    `L ${x1} ${y1 - cr}`,
    `Q ${x1} ${y1} ${x1 - cr} ${y1}`,
    `L ${x0 + cr} ${y1}`,
    `Q ${x0} ${y1} ${x0} ${y1 - cr}`,
    `L ${x0} ${y0 + cr}`,
    `Q ${x0} ${y0} ${x0 + cr} ${y0}`,
    "Z",
  ].join(" ");

  // Total perimeter length (straight runs + four quarter-circle corners) — used
  // to place ornaments by fractional arc position and to key the dash reveal.
  const straight = 2 * (w - 2 * cr) + 2 * (h - 2 * cr);
  const corners = 2 * Math.PI * cr; // four quarter arcs = one full circle
  const perim = straight + corners;

  // Map an arc fraction t (0..1, clockwise from top-left) to an (x,y) point +
  // outward normal, so leaves/blossoms sit just outside the border line.
  const pointAt = (t: number): { x: number; y: number; nx: number; ny: number } => {
    const d = ((t % 1) + 1) % 1 * perim; // distance travelled
    const topLen = w - 2 * cr;
    const sideLen = h - 2 * cr;
    const q = corners / 4; // one corner arc length
    let acc = 0;
    // top edge (L→R), normal points up
    if (d < acc + topLen) return { x: x0 + cr + (d - acc), y: y0, nx: 0, ny: -1 };
    acc += topLen;
    if (d < acc + q) { const a = (d - acc) / q * (Math.PI / 2); return { x: x1 - cr + Math.sin(a) * cr, y: y0 + cr - Math.cos(a) * cr, nx: Math.sin(a), ny: -Math.cos(a) }; }
    acc += q;
    // right edge (T→B), normal points right
    if (d < acc + sideLen) return { x: x1, y: y0 + cr + (d - acc), nx: 1, ny: 0 };
    acc += sideLen;
    if (d < acc + q) { const a = (d - acc) / q * (Math.PI / 2); return { x: x1 - cr + Math.cos(a) * cr, y: y1 - cr + Math.sin(a) * cr, nx: Math.cos(a), ny: Math.sin(a) }; }
    acc += q;
    // bottom edge (R→L), normal points down
    if (d < acc + topLen) return { x: x1 - cr - (d - acc), y: y1, nx: 0, ny: 1 };
    acc += topLen;
    if (d < acc + q) { const a = (d - acc) / q * (Math.PI / 2); return { x: x0 + cr - Math.sin(a) * cr, y: y1 - cr + Math.cos(a) * cr, nx: -Math.sin(a), ny: Math.cos(a) }; }
    acc += q;
    // left edge (B→T), normal points left
    if (d < acc + sideLen) return { x: x0, y: y1 - cr - (d - acc), nx: -1, ny: 0 };
    acc += sideLen;
    const a = (d - acc) / q * (Math.PI / 2); // last corner back to start
    return { x: x0 + cr - Math.cos(a) * cr, y: y0 + cr - Math.sin(a) * cr, nx: -Math.cos(a), ny: -Math.sin(a) };
  };

  // Ornaments distributed around the perimeter. `t` is the vine-tip fraction it
  // rides at, so it only appears once the growing vine has passed it. A mix of
  // open blossoms, small buds and leaves for a natural climbing look.
  const ornaments = useMemo(() => {
    const out: Array<{ t: number; r: number; kind: "flower" | "bud" | "leaf"; rot: number; off: number }> = [];
    const n = Math.max(4, blossomCount);
    for (let i = 0; i < n; i++) {
      const jitter = (sakuraRand(seed, i * 3 + 1) - 0.5) * (0.6 / n);
      const t = i / n + jitter;
      const rr = blossomR * (0.6 + sakuraRand(seed, i * 3 + 2) * 0.7);
      const roll = sakuraRand(seed, i * 3 + 3);
      // Vine reads as densely COVERED IN FLOWERS: open blossoms dominate, with
      // only an occasional bud and a rare leaf tucked between them.
      const kind = roll < 0.86 ? "flower" : roll < 0.95 ? "bud" : "leaf";
      out.push({
        t,
        r: kind === "leaf" ? rr * 0.9 : rr,
        kind,
        rot: sakuraRand(seed, i * 3 + 5) * 360,
        // push the ornament INWARD off the vine line so it lies over the table
        // surface (not floating out into the background around the panel).
        off: blossomR * (0.15 + sakuraRand(seed, i * 3 + 4) * 0.55),
      });
    }
    return out;
  }, [blossomCount, blossomR, seed]);

  // The vine tip has travelled `grow` of the perimeter; ornaments bloom in the
  // wake once the tip is a little past them.
  const dash = perim;
  return (
    <svg
      width={vw}
      height={vh}
      viewBox={`0 0 ${vw} ${vh}`}
      style={{ position: "absolute", left: -pad, top: -pad, overflow: "visible", pointerEvents: "none" }}
    >
      {/* soft shadow of the vine so it reads as sitting on top of the edge */}
      <path
        d={perimeter}
        fill="none"
        stroke={hexToRgba(SAKURA.ink, 0.16)}
        strokeWidth={thickness + 1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash}
        strokeDashoffset={dash * (1 - grow)}
        transform={`translate(0.8 1.2)`}
      />
      {/* the vine itself */}
      <path
        d={perimeter}
        fill="none"
        stroke={vineColor}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash}
        strokeDashoffset={dash * (1 - grow)}
      />
      {ornaments.map((o, i) => {
        // bloom starts just after the tip passes this ornament's position
        const bp = Math.max(0, Math.min(1, (grow - o.t - 0.015) / 0.09));
        if (bp <= 0) return null;
        const pt = pointAt(o.t);
        // inward normal = negated outward normal, so ornaments sit over the table
        const inx = -pt.nx;
        const iny = -pt.ny;
        const cx = pt.x + inx * o.off;
        const cy = pt.y + iny * o.off;
        if (o.kind === "leaf") {
          // a small teardrop leaf that scales/tilts open pointing inward over the table
          const ang = (Math.atan2(iny, inx) * 180) / Math.PI;
          const lr = o.r * (0.4 + 0.6 * bp);
          return (
            <g key={`v-${uid}-${i}`} transform={`translate(${cx} ${cy}) rotate(${ang})`} opacity={bp}>
              <path
                d={`M 0 0 Q ${lr} ${-lr * 0.5} ${lr * 1.6} 0 Q ${lr} ${lr * 0.5} 0 0 Z`}
                fill={leafColor}
              />
              <line x1={0} y1={0} x2={lr * 1.4} y2={0} stroke={hexToRgba(SAKURA.ink, 0.25)} strokeWidth={0.6} />
            </g>
          );
        }
        if (o.kind === "bud") {
          const rr = o.r * 0.5 * (0.5 + 0.5 * bp);
          return (
            <g key={`v-${uid}-${i}`} opacity={bp}>
              <circle cx={cx} cy={cy} r={rr} fill={blossomColor} />
              <circle cx={cx} cy={cy} r={rr * 0.5} fill={blossomCenter} />
            </g>
          );
        }
        return (
          <SoftPetal
            key={`v-${uid}-${i}`}
            cx={cx}
            cy={cy}
            r={o.r * 0.68}
            rotation={o.rot}
            color={blossomColor}
            centerColor={blossomCenter}
            bloomProgress={bp}
          />
        );
      })}
    </svg>
  );
};

// ─── LargeBlossom — a big, detailed 5-petal sakura flower (notched petals) ────

/**
 * A large decorative sakura flower with layered, notched petals + stamen dots —
 * for use as a hero motif behind titles. Render inside an <svg>. `progress`
 * (0..1) makes it bloom open; omit for a static flower.
 */
export const LargeBlossom: React.FC<{
  cx: number;
  cy: number;
  r: number;
  rotation?: number;
  color?: string;
  innerColor?: string;
  opacity?: number;
  progress?: number;
}> = ({
  cx,
  cy,
  r,
  rotation = 0,
  color = SAKURA.blush,
  innerColor = SAKURA.deepBlush,
  opacity = 1,
  progress = 1,
}) => {
  // One notched sakura petal pointing up, centered at origin, tip at -r.
  const petalPath = `
    M 0 ${-r}
    C ${r * 0.14} ${-r * 0.95}, ${r * 0.34} ${-r * 0.72}, ${r * 0.34} ${-r * 0.42}
    C ${r * 0.34} ${-r * 0.16}, ${r * 0.16} ${-r * 0.04}, ${r * 0.08} ${-r * 0.06}
    L 0 ${-r * 0.14}
    L ${-r * 0.08} ${-r * 0.06}
    C ${-r * 0.16} ${-r * 0.04}, ${-r * 0.34} ${-r * 0.16}, ${-r * 0.34} ${-r * 0.42}
    C ${-r * 0.34} ${-r * 0.72}, ${-r * 0.14} ${-r * 0.95}, 0 ${-r}
    Z`;
  const bloom = 0.5 + 0.5 * progress;
  const stamen = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return { x: Math.cos(a) * r * 0.16, y: Math.sin(a) * r * 0.16 };
  });
  return (
    <g transform={`translate(${cx},${cy}) rotate(${rotation}) scale(${bloom})`} opacity={opacity * progress}>
      {[0, 72, 144, 216, 288].map((deg) => (
        <path
          key={deg}
          d={petalPath}
          transform={`rotate(${deg})`}
          fill={color}
          stroke={hexToRgba(innerColor, 0.35)}
          strokeWidth={r * 0.01}
        />
      ))}
      {/* stamen ring + center */}
      {stamen.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={r * 0.03} fill={SAKURA.gold} />
      ))}
      <circle r={r * 0.12} fill={innerColor} />
    </g>
  );
};
