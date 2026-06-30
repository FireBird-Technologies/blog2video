/**
 * Custom-template craft kit — signature artifacts.
 *
 * Higher-tier, render-safe decorative primitives that give a brand its recurring
 * visual fingerprint, ported (and generalized to the kit palette) from the
 * spotlight/chronicle/nightfall template work. Every piece is a pure function of
 * useCurrentFrame() with seeded randomness only — NEVER Math.random at render
 * time — so headless renders never flicker. They FRAME the type, they never
 * crowd it: opacities stay low and they hug edges or sit far behind the words.
 *
 * All colour/typography comes from useKit() so each artifact is automatically
 * on-brand. The `SignatureArtifact` dispatcher maps the brand's signature
 * `artifactMotion` word (sweep / streak / draw-in / tick / drift / bloom /
 * float / slam / pulse / build / rule-slide) to the right component, so the
 * generated scene can drop ONE element and get the brand's distinct motif.
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { useKit } from "./context";
import { withAlpha } from "./theme";
import { clamp01, drawProgress, easeOutQuint, seededRand } from "./motion";

// ─── CornerFrame ──────────────────────────────────────────────────────────────
// Editorial "viewfinder" L-brackets in the corners, drawn on via stroke-dashoffset.
// Signature motion: "draw-in".

const Bracket: React.FC<{
  corner: "tl" | "tr" | "bl" | "br";
  color: string;
  size: number;
  draw: number;
}> = ({ corner, color, size, draw }) => {
  const tl = corner === "tl";
  const tr = corner === "tr";
  const bl = corner === "bl";
  const dash = 80;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      style={{
        position: "absolute",
        [tl || bl ? "left" : "right"]: "5%",
        [tl || tr ? "top" : "bottom"]: "7%",
        transform: `${tr ? "scaleX(-1)" : bl ? "scaleY(-1)" : corner === "br" ? "scale(-1,-1)" : ""}`,
      }}
    >
      <path
        d="M 4 40 L 4 4 L 40 4"
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="square"
        strokeDasharray={dash}
        strokeDashoffset={dash * (1 - draw)}
        opacity={0.85}
      />
    </svg>
  );
};

export const CornerFrame: React.FC<{
  color?: string;
  size?: number;
  start?: number;
  intensity?: number;
}> = ({ color, size = 80, start = 0, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { palette } = useKit();
  const c = color ?? palette.accent;
  const d = drawProgress(frame, start, 18);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: clamp01(intensity) }}>
      <Bracket corner="tl" color={c} size={size} draw={d} />
      <Bracket corner="tr" color={c} size={size} draw={d} />
      <Bracket corner="bl" color={c} size={size} draw={d} />
      <Bracket corner="br" color={c} size={size} draw={d} />
    </AbsoluteFill>
  );
};

// ─── StreakField ──────────────────────────────────────────────────────────────
// A sparse field of short diagonal accent streaks that drift + shimmer. Motion
// energy behind focal text without touching it. Seeded → identical every render.
// Signature motion: "streak" / "drift" / "float".

export const StreakField: React.FC<{
  color?: string;
  count?: number;
  seed?: number;
  start?: number;
  intensity?: number;
}> = ({ color, count = 14, seed = 7, start = 0, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { palette } = useKit();
  const c = color ?? palette.accent;
  const local = frame - start;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden", opacity: clamp01(intensity) }}>
      {Array.from({ length: count }).map((_, i) => {
        const r1 = seededRand(seed + i, 3.1);
        const r2 = seededRand(seed + i, 7.7);
        const r3 = seededRand(seed + i, 13.3);
        const x = r1 * 100;
        const y = r2 * 100;
        const len = 60 + r3 * 120;
        const drift = (local * (0.4 + r2 * 0.8)) % 60;
        const phase = (local * 0.04 + r1 * Math.PI * 2) % (Math.PI * 2);
        // Brighter + thicker than the original so the motif actually reads on a
        // dark background even at echo intensities (~0.3–0.4).
        const op = 0.22 + 0.34 * (0.5 + 0.5 * Math.sin(phase));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: len,
              height: 3,
              background: `linear-gradient(90deg, transparent, ${c}, transparent)`,
              transform: `translate(${drift}px, ${-drift * 0.5}px) rotate(-28deg)`,
              opacity: op,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ─── KineticTicker ────────────────────────────────────────────────────────────
// A thin marquee strip of a repeated label sliding along an edge. Continuous
// deterministic offset (no modulo wrap → no visible jump). Signature motion:
// "tick" / "sweep" / "build".

export const KineticTicker: React.FC<{
  label?: string;
  color?: string;
  edge?: "bottom" | "top";
  speed?: number;
  intensity?: number;
}> = ({ label = "•", color, edge = "bottom", speed = 1, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const { palette, fonts } = useKit();
  const c = color ?? palette.accent;
  const unit = `${label}  ›››  `;
  const repeats = Math.max(8, Math.ceil((width + 2600) / (unit.length * 13)));
  const repeated = unit.repeat(repeats);
  const offset = -(frame * speed * 2.2);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden", opacity: clamp01(intensity) }}>
      <div
        style={{
          position: "absolute",
          [edge]: "4.5%",
          left: 0,
          transform: `translateX(${offset}px)`,
          whiteSpace: "nowrap",
          fontFamily: fonts.heading || "inherit",
          fontWeight: 800,
          fontSize: 22,
          letterSpacing: "0.14em",
          color: c,
          opacity: 0.5,
          textTransform: "uppercase",
        }}
      >
        {repeated}
      </div>
    </AbsoluteFill>
  );
};

// ─── BigGlyphBackdrop ─────────────────────────────────────────────────────────
// An oversized, very-low-opacity glyph far behind the focal text for editorial
// depth. Slow slam-settle scale. Signature motion: "bloom" / "slam" / "drift".

export const BigGlyphBackdrop: React.FC<{
  glyph?: string;
  color?: string;
  tint?: "accent" | "text";
  start?: number;
  align?: "center" | "left" | "right";
  intensity?: number;
}> = ({ glyph = "“", color, tint = "text", start = 0, align = "center", intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const { palette, fonts } = useKit();
  const s = spring({ frame: frame - start, fps, config: { damping: 60, stiffness: 90 } });
  const scale = 0.9 + s * 0.1;
  const c = color ?? (tint === "accent" ? palette.accent : palette.text);
  // A touch stronger so the ghost glyph actually reads as a backdrop, not nothing.
  const op = (tint === "accent" ? 0.14 : 0.09) * s * clamp01(intensity);
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: align === "center" ? "center" : align === "left" ? "flex-start" : "flex-end",
        paddingLeft: align === "left" ? "6%" : 0,
        paddingRight: align === "right" ? "6%" : 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontFamily: fonts.heading || "inherit",
          fontWeight: 900,
          fontSize: height * 1.05,
          lineHeight: 1,
          color: c,
          opacity: op,
          transform: `scale(${scale})`,
          userSelect: "none",
        }}
      >
        {glyph}
      </div>
    </AbsoluteFill>
  );
};

// ─── PulseRing ────────────────────────────────────────────────────────────────
// A faint accent ring that expands + fades on a deterministic loop, centred. A
// soft "pulse" behind a stat or focal block. Signature motion: "pulse".

export const PulseRing: React.FC<{
  color?: string;
  periodFrames?: number;
  intensity?: number;
}> = ({ color, periodFrames = 90, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const { palette } = useKit();
  const c = color ?? palette.accent;
  const phase = (frame % periodFrames) / periodFrames; // 0→1
  const e = easeOutQuint(phase);
  const base = width * 0.18;
  const size = base + e * base * 1.6;
  const op = (1 - phase) * 0.16 * clamp01(intensity);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: size, height: size, borderRadius: "50%", border: `2px solid ${c}`, opacity: op }} />
    </AbsoluteFill>
  );
};

// ─── AccentSweep ──────────────────────────────────────────────────────────────
// A soft band of accent light that sweeps across once and settles. The "sweep"
// / "rule-slide" signature beat — a clean directional reveal of the backdrop.

export const AccentSweep: React.FC<{
  color?: string;
  start?: number;
  dur?: number;
  intensity?: number;
}> = ({ color, start = 0, dur = 28, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const { palette } = useKit();
  const c = color ?? palette.accent;
  const t = drawProgress(frame, start, dur);
  const x = interpolate(t, [0, 1], [-40, 140]); // % of width
  const bandW = width * 0.45;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden", opacity: clamp01(intensity) }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${x}%`,
          width: bandW,
          marginLeft: -bandW / 2,
          background: `linear-gradient(90deg, transparent, ${withAlpha(c, 0.14)}, transparent)`,
          transform: "skewX(-12deg)",
        }}
      />
    </AbsoluteFill>
  );
};

// ─── DiagonalShards ───────────────────────────────────────────────────────────
// Bold accent shard bands that slice in across a corner with a spring slam — a
// real set-piece anchor (louder than a streak field). Signature motion: "shards"
// / "slam". Ported from spotlight, palette-driven.

export const DiagonalShards: React.FC<{
  color?: string;
  corner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  start?: number;
  intensity?: number;
}> = ({ color, corner = "top-right", start = 0, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette } = useKit();
  const c = color ?? palette.accent;
  const flipX = corner.endsWith("left") ? -1 : 1;
  const flipY = corner.startsWith("bottom") ? -1 : 1;
  const bands = [
    { off: 0, w: 70, op: 0.95 },
    { off: 110, w: 38, op: 0.6 },
    { off: 185, w: 18, op: 0.34 },
  ];
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden", opacity: clamp01(intensity) }}>
      <svg
        width={640}
        height={640}
        viewBox="0 0 640 640"
        style={{
          position: "absolute",
          [flipX === 1 ? "right" : "left"]: 0,
          [flipY === 1 ? "top" : "bottom"]: 0,
          transform: `scale(${flipX}, ${flipY})`,
        }}
      >
        {bands.map((b, i) => {
          const s = spring({ frame: frame - start - i * 4, fps, config: { damping: 200 } });
          const slide = (1 - s) * 420;
          return (
            <g key={i} transform={`translate(${slide}, ${-slide})`} opacity={b.op * s}>
              <polygon
                points={`${340 - b.off},0 ${340 - b.off + b.w},0 640,${300 + b.off + b.w} 640,${300 + b.off}`}
                fill={c}
              />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ─── HalftoneField ────────────────────────────────────────────────────────────
// A poster-style halftone dot gradient hugging one corner — the classic editorial
// pop-art texture, masked so it stays in a corner and never crosses the focal
// text. Slowly breathes. Signature motion: "halftone" / "build". CSS-tiled (no
// per-dot DOM), deterministic.

export const HalftoneField: React.FC<{
  color?: string;
  corner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  pitch?: number;
  intensity?: number;
}> = ({ color, corner = "bottom-right", pitch = 22, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { palette } = useKit();
  const dot = color ?? palette.accent;
  const right = corner.endsWith("right");
  const bottom = corner.startsWith("bottom");
  const breathe = 1 + Math.sin(frame * 0.03) * 0.05;
  const size = pitch * breathe;
  const maskY = `linear-gradient(${bottom ? "to top" : "to bottom"}, black 0%, transparent 55%)`;
  const maskX = `linear-gradient(${right ? "to left" : "to right"}, black 0%, transparent 60%)`;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${dot} ${1.6 * breathe}px, transparent ${1.8 * breathe}px)`,
          backgroundSize: `${size}px ${size}px`,
          backgroundPosition: `${right ? "right" : "left"} ${bottom ? "bottom" : "top"}`,
          opacity: 0.4 * clamp01(intensity),
          WebkitMaskImage: `${maskY}, ${maskX}`,
          WebkitMaskComposite: "source-in",
          maskImage: `${maskY}, ${maskX}`,
          maskComposite: "intersect",
        }}
      />
    </AbsoluteFill>
  );
};

// ─── StarburstBadge ───────────────────────────────────────────────────────────
// A rotating starburst seal stamped into a corner — springs in, then spins slowly
// forever. Reads like a "NEW!" sticker: bold/social. Signature motion: "spin" /
// "stamp". Deterministic polygon.

export const StarburstBadge: React.FC<{
  color?: string;
  label?: string;
  corner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  size?: number;
  start?: number;
  intensity?: number;
}> = ({ color, label = "★", corner = "bottom-right", size = 168, start = 0, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette, fonts } = useKit();
  const c = color ?? palette.accent;
  const s = spring({ frame: frame - start, fps, config: { damping: 12, stiffness: 180 } });
  const rot = (frame - start) * 0.5;
  const right = corner.endsWith("right");
  const bottom = corner.startsWith("bottom");
  const spikes = 14;
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 50 : 40;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    pts.push(`${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`);
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: clamp01(intensity) }}>
      <div
        style={{
          position: "absolute",
          [right ? "right" : "left"]: "5%",
          [bottom ? "bottom" : "top"]: "7%",
          width: size,
          height: size,
          transform: `scale(${s})`,
        }}
      >
        <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, transform: `rotate(${rot}deg)` }}>
          <polygon points={pts.join(" ")} fill={c} opacity={0.95} />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: fonts.heading || "inherit",
            fontWeight: 900,
            fontSize: size * 0.2,
            color: palette.bg,
            textTransform: "uppercase",
            textAlign: "center",
            lineHeight: 1.05,
            padding: size * 0.16,
          }}
        >
          {label}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── LightDust ────────────────────────────────────────────────────────────────
// Slow floating motes drifting upward — fine specks for cinematic depth. Seeded,
// frame-driven, very low opacity. Signature motion: "dust" / "float" / "drift".

export const LightDust: React.FC<{
  color?: string;
  count?: number;
  seed?: number;
  intensity?: number;
}> = ({ color, count = 26, seed = 3, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { palette } = useKit();
  const c = color ?? palette.text;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden", opacity: clamp01(intensity) }}>
      {Array.from({ length: count }).map((_, i) => {
        const r1 = seededRand(seed + i, 3.7);
        const r2 = seededRand(seed + i, 8.1);
        const r3 = seededRand(seed + i, 12.9);
        const x = r1 * 100;
        const speed = 0.05 + r2 * 0.12;
        const sz = 1.5 + r3 * 2.5;
        const yBase = 100 - ((frame * speed + r2 * 100) % 110);
        const sway = Math.sin(frame * 0.02 + r1 * Math.PI * 2) * 1.5;
        const tw = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(frame * 0.05 + r3 * Math.PI * 2));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x + sway}%`,
              top: `${yBase}%`,
              width: sz,
              height: sz,
              borderRadius: "50%",
              background: c,
              opacity: tw,
              boxShadow: `0 0 ${sz * 2}px ${c}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ─── OrbitRings ───────────────────────────────────────────────────────────────
// Concentric rings that draw in then rotate slowly — a calm, premium/editorial
// motif. Signature motion: "orbit" / "draw-in". Deterministic.

export const OrbitRings: React.FC<{
  color?: string;
  count?: number;
  start?: number;
  intensity?: number;
}> = ({ color, count = 4, start = 0, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { palette } = useKit();
  const c = color ?? palette.accent;
  const cx = width / 2;
  const cy = height * 0.5;
  const draw = drawProgress(frame, start, 30);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden", opacity: clamp01(intensity) }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: count }).map((_, i) => {
          const r = Math.min(width, height) * 0.12 * (i + 1);
          const circ = 2 * Math.PI * r;
          const localDraw = drawProgress(frame, start + i * 4, 26);
          const spin = (frame - start) * (0.05 + i * 0.015);
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={withAlpha(c, 0.12 * draw)}
              strokeWidth={1}
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - localDraw)}
              transform={`rotate(${spin} ${cx} ${cy})`}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ─── SignatureArtifact ────────────────────────────────────────────────────────
// Dispatcher: pick the right artifact for a brand's signature.artifactMotion.
// Generated scenes drop <SignatureArtifact motion={props.artifactMotion} /> and
// get the brand's distinct recurring motif with one element.

export type ArtifactMotion =
  | "sweep"
  | "streak"
  | "draw-in"
  | "tick"
  | "drift"
  | "bloom"
  | "float"
  | "slam"
  | "pulse"
  | "build"
  | "rule-slide"
  // widened pool (ported from built-in templates)
  | "shards"
  | "halftone"
  | "spin"
  | "stamp"
  | "dust"
  | "orbit";

export const SignatureArtifact: React.FC<{
  motion?: ArtifactMotion | string;
  start?: number;
  intensity?: number;
  /** Optional glyph for bloom/slam backdrops, label for tick/build tickers & badges. */
  glyph?: string;
  label?: string;
}> = ({ motion = "drift", start = 0, intensity = 1, glyph, label }) => {
  switch (motion) {
    case "draw-in":
    case "rule-slide":
      return <CornerFrame start={start} intensity={intensity} />;
    case "tick":
    case "build":
      // KineticTicker is a continuous marquee — no start frame.
      return <KineticTicker label={label ?? "•"} intensity={intensity} />;
    case "shards":
      return <DiagonalShards start={start} intensity={intensity} />;
    case "halftone":
      return <HalftoneField intensity={intensity} />;
    case "spin":
    case "stamp":
      return <StarburstBadge label={label ?? "★"} start={start} intensity={intensity} />;
    case "dust":
      return <LightDust intensity={intensity} />;
    case "orbit":
      return <OrbitRings start={start} intensity={intensity} />;
    case "sweep":
      return <AccentSweep start={start} intensity={intensity} />;
    case "bloom":
    case "slam":
      return <BigGlyphBackdrop glyph={glyph ?? "“"} tint="accent" start={start} intensity={intensity} />;
    case "pulse":
      return <PulseRing intensity={intensity} />;
    case "streak":
    case "float":
    case "drift":
    default:
      return <StreakField start={start} intensity={intensity} />;
  }
};
