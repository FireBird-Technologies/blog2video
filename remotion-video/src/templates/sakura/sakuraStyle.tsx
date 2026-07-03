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
  const frame = useCurrentFrame();
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
  sakura_chapter_transition: "bloom",
  sakura_list_scene: "rise",
  sakura_text_narration: "rise",
  sakura_image_focus: "slide_panel",
  sakura_ending_socials: "slide_panel",
};

export interface EntranceStyle {
  opacity: number;
  transform?: string;
  clipPath?: string;
}

/** Returns the entrance transform/clip for a scene, keyed by its layout type. */
export const useSakuraEntrance = (layout?: string, frames = 16): EntranceStyle => {
  const frame = useCurrentFrame();
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
  const frame = useCurrentFrame();
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

export const PetalRain: React.FC<{
  count?: number;
  intensity?: number;
  seed?: number;
}> = ({ count = 20, intensity = 1, seed = 7 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const params = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const s = seed + i * 31.7;
        const far = i % 5 < 2; // ~40% far layer: smaller, slower, paler
        const r = far ? 6 + sakuraRand(s, 2) * 5 : 9 + sakuraRand(s, 2) * 11;
        return {
          x0: sakuraRand(s, 1) * width,
          y0: sakuraRand(s, 8) * (height + 160),
          vy: (far ? 1.1 : 2.0) + sakuraRand(s, 3) * (far ? 1.0 : 2.2),
          swayAmp: (14 + sakuraRand(s, 4) * 28) * intensity * (far ? 0.6 : 1),
          swayFreq: 0.012 + sakuraRand(s, 5) * 0.02,
          swayFreq2: 0.005 + sakuraRand(s, 12) * 0.008,
          phase: sakuraRand(s, 6) * Math.PI * 2,
          rotSpeed: (sakuraRand(s, 7) - 0.5) * 4,
          rot0: sakuraRand(s, 9) * 360,
          flutterFreq: 0.03 + sakuraRand(s, 10) * 0.05,
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
    [count, seed, width, height, intensity],
  );

  const total = height + 160;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {params.map((p, i) => {
        const y = ((p.y0 + frame * p.vy) % total) - 80;
        const x =
          p.x0 +
          Math.sin(frame * p.swayFreq * Math.PI * 2 + p.phase) * p.swayAmp +
          Math.sin(frame * p.swayFreq2 * Math.PI * 2 + p.phase * 1.7) * p.swayAmp * 0.5;
        const rotation = p.rot0 + frame * p.rotSpeed;
        // Flutter: petals tumble by squashing on one axis
        const flutter = 0.7 + 0.3 * Math.sin(frame * p.flutterFreq * Math.PI * 2 + p.phase);
        const edgeFade = interpolate(
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
              r={p.r}
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
  const frame = useCurrentFrame();
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
  const frame = useCurrentFrame();
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
  const frame = useCurrentFrame();
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

// ─── Backdrop variants (each scene gets distinct background geometry) ─────────

export type SakuraBackdropVariant =
  | "plum_radial" // dark hero radial (intro)
  | "washi_radial" // light editorial radial (text_narration)
  | "vertical_band" // dark + wide crimson→deepBlush vertical band on one side (chapter)
  | "ink_corner" // light + asymmetric ink-wash bleeding from a corner (section / list / two-col)
  | "full_bleed_mat" // light mist mat, minimal chrome (image_focus)
  | "spotlight" // dark + single offset radial spotlight (stat)
  | "celebration"; // dark + faint concentric wash for the ring finale (ending / quote)

export const SAKURA_BACKDROP: Record<string, SakuraBackdropVariant> = {
  sakura_intro: "plum_radial",
  sakura_quote: "celebration",
  sakura_section: "ink_corner",
  sakura_two_column_detail: "washi_radial",
  sakura_stat_highlight: "spotlight",
  sakura_chapter_transition: "vertical_band",
  sakura_list_scene: "ink_corner",
  sakura_text_narration: "washi_radial",
  sakura_image_focus: "full_bleed_mat",
  sakura_ending_socials: "celebration",
};

export const isDarkBackdrop = (v: SakuraBackdropVariant): boolean =>
  v === "plum_radial" ||
  v === "vertical_band" ||
  v === "spotlight" ||
  v === "celebration" ||
  v === "full_bleed_mat";

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
    full_bleed_mat: { cx: "50%", cy: "50%" },
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
  full_bleed_mat: 0,
  spotlight: 0.04,
  celebration: 0.05,
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
  seigaihaColor?: string;
  /** render the petal rain behind the content (keeps text legible on text-heavy scenes) */
  petalsBehind?: boolean;
  /** apply the per-layout entrance to children (default true) */
  animateEntrance?: boolean;
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
  seigaihaColor,
  petalsBehind = false,
  animateEntrance = true,
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
      {chrome}
      {petals > 0 && petalsBehind && (
        <PetalRain count={petals} intensity={petalIntensity} seed={petalSeed} />
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
        <PetalRain count={petals} intensity={petalIntensity} seed={petalSeed} />
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
  const frame = useCurrentFrame();
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
  const frame = useCurrentFrame();
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
