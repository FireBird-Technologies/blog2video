import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY } from "../constants";

/**
 * SpotlightArtifacts — deterministic, render-safe decorative primitives that
 * individual Spotlight layouts compose on top of SpotlightBackground to fill
 * negative space. Every piece is a pure function of useCurrentFrame() (seeded
 * randomness only — never Math.random at render time), accent-red, high-contrast
 * and kinetic, matching Spotlight's bold social-first aesthetic. The rule: these
 * FRAME the type, they never crowd it — so opacities stay low and they hug edges
 * or sit far behind the words.
 */

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// ─── AccentBars ──────────────────────────────────────────────────────────────
// A small stack of bold red bars that slam in from an edge and settle. The
// signature Spotlight accent — echoes the accentBarWipe transition and the
// stat_stage accent rule. Anchors a corner/edge of the composition.

export const AccentBars: React.FC<{
  accentColor?: string;
  /** Which edge the bars hug + slam from. */
  position?: "top-left" | "bottom-left" | "top-right" | "bottom-right";
  count?: number;
  startFrame?: number;
}> = ({ accentColor = "#EF4444", position = "top-left", count = 3, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const right = position.endsWith("right");
  const bottom = position.startsWith("bottom");

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          [right ? "right" : "left"]: "6%",
          [bottom ? "bottom" : "top"]: "10%",
          display: "flex",
          flexDirection: "column",
          alignItems: right ? "flex-end" : "flex-start",
          gap: 10,
        }}
      >
        {Array.from({ length: count }).map((_, i) => {
          const s = spring({ frame: frame - startFrame - i * 4, fps, config: { damping: 200 } });
          const w = (60 + i * 34) * s;
          return (
            <div
              key={i}
              style={{
                width: w,
                height: 7,
                background: accentColor,
                borderRadius: 1,
                transform: `translateX(${(1 - s) * (right ? 40 : -40)}px)`,
                opacity: 0.9 * s,
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ─── CornerFrame ─────────────────────────────────────────────────────────────
// Sharp modern bracket marks in the corners, drawn-on via stroke-dashoffset
// (Chronicle's OrnamentalCorner pattern, stripped to clean L-brackets). Anchors
// the whole frame as an editorial "viewfinder".

const Bracket: React.FC<{
  corner: "tl" | "tr" | "bl" | "br";
  color: string;
  size: number;
  draw: number;
}> = ({ corner, color, size, draw }) => {
  const tl = corner === "tl";
  const tr = corner === "tr";
  const bl = corner === "bl";
  const len = 64;
  const dash = len * 2;
  // Two strokes meeting at the corner.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      style={{
        position: "absolute",
        [tl || bl ? "left" : "right"]: "5%",
        [tl || tr ? "top" : "bottom"]: "7%",
        transform: `scale(${tl || tr ? 1 : 1}, 1) ${
          tr ? "scaleX(-1)" : bl ? "scaleY(-1)" : corner === "br" ? "scale(-1,-1)" : ""
        }`,
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
  accentColor?: string;
  size?: number;
  startFrame?: number;
}> = ({ accentColor = "#EF4444", size = 80, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame - startFrame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const d = easeOutCubic(draw);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Bracket corner="tl" color={accentColor} size={size} draw={d} />
      <Bracket corner="tr" color={accentColor} size={size} draw={d} />
      <Bracket corner="bl" color={accentColor} size={size} draw={d} />
      <Bracket corner="br" color={accentColor} size={size} draw={d} />
    </AbsoluteFill>
  );
};

// ─── KineticTicker ───────────────────────────────────────────────────────────
// A thin marquee strip of repeated chevrons + a label sliding along an edge.
// Social-first "fast-paced" energy. Deterministic offset from frame.

export const KineticTicker: React.FC<{
  accentColor?: string;
  label?: string;
  edge?: "bottom" | "top";
  speed?: number;
}> = ({ accentColor = "#EF4444", label = "SPOTLIGHT", edge = "bottom", speed = 1 }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const unit = `${label}  ›››  `;
  // Repeat enough copies to cover the canvas plus the full travel of a long
  // scene (~20s) — labels are dynamic (scene titles), so size by unit length
  // (~13px/char at fontSize 22) instead of a fixed count. No modulo: a wrap
  // would visibly jump unless the pattern period divided the span exactly.
  const repeats = Math.max(8, Math.ceil((width + 2600) / (unit.length * 13)));
  const repeated = unit.repeat(repeats);
  const offset = -(frame * speed * 2.2);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          [edge]: "4.5%",
          left: 0,
          transform: `translateX(${offset}px)`,
          whiteSpace: "nowrap",
          fontFamily: SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY,
          fontWeight: 900,
          fontSize: 22,
          letterSpacing: "0.14em",
          color: accentColor,
          opacity: 0.5,
          textTransform: "uppercase",
        }}
      >
        {repeated}
      </div>
    </AbsoluteFill>
  );
};

// ─── StreakField ─────────────────────────────────────────────────────────────
// A sparse field of short diagonal accent streaks that drift + fade. Motion
// energy for word_punch / rapid_points without touching the focal word. Seeded
// so it's identical every render.

export const StreakField: React.FC<{
  accentColor?: string;
  count?: number;
  seed?: number;
  startFrame?: number;
}> = ({ accentColor = "#EF4444", count = 14, seed = 7, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: count }).map((_, i) => {
        const r1 = seededRandom(seed + i * 3.1);
        const r2 = seededRandom(seed + i * 7.7);
        const r3 = seededRandom(seed + i * 13.3);
        const x = r1 * 100;
        const y = r2 * 100;
        const len = 40 + r3 * 90;
        const drift = (local * (0.4 + r2 * 0.8)) % 60;
        // Each streak fades in/out on its own phase so the field shimmers.
        const phase = (local * 0.04 + r1 * Math.PI * 2) % (Math.PI * 2);
        const op = (0.1 + 0.18 * (0.5 + 0.5 * Math.sin(phase)));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: len,
              height: 2,
              background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
              transform: `translate(${drift}px, ${-drift * 0.5}px) rotate(-28deg)`,
              opacity: op,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ─── BigGlyphBackdrop ────────────────────────────────────────────────────────
// An oversized, very-low-opacity glyph (chevron, quote, or a number) sitting far
// behind the focal text for editorial depth. Slow drift + slam-settle scale.

export const BigGlyphBackdrop: React.FC<{
  glyph?: string;
  accentColor?: string;
  /** Tint: "accent" red ghost, or "white" faint white ghost. */
  tint?: "accent" | "white";
  startFrame?: number;
  align?: "center" | "left" | "right";
}> = ({ glyph = "”", accentColor = "#EF4444", tint = "white", startFrame = 0, align = "center" }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 60, stiffness: 90 } });
  const scale = 0.9 + s * 0.1;
  const color = tint === "accent" ? accentColor : "#FFFFFF";
  const op = (tint === "accent" ? 0.07 : 0.05) * s;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: align === "center" ? "center" : align === "left" ? "flex-start" : "flex-end",
        paddingLeft: align === "left" ? "6%" : 0,
        paddingRight: align === "right" ? "6%" : 0,
      }}
    >
      <div
        style={{
          fontFamily: SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY,
          fontWeight: 900,
          fontSize: height * 1.05,
          lineHeight: 1,
          color,
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

// ─── SpotlightBeam ───────────────────────────────────────────────────────────
// THE signature piece: a soft-edged cone of stage light pivoting from the top
// edge. "land" sweeps in and settles on the focal text with a brightness lift,
// "drift" oscillates slowly forever, "converge" crosses two beams over center
// (closer moments). Screen-blended so it reads as light, not a white shape.

const BeamCone: React.FC<{
  /** Pivot point along the top edge, percent of width. */
  pivotX: number;
  rotateDeg: number;
  coneWidth: number;
  coneHeight: number;
  intensity: number;
}> = ({ pivotX, rotateDeg, coneWidth, coneHeight, intensity }) => (
  <div
    style={{
      position: "absolute",
      left: `${pivotX}%`,
      top: "-4%",
      width: coneWidth,
      height: coneHeight,
      marginLeft: -coneWidth / 2,
      transformOrigin: "50% 0%",
      transform: `rotate(${rotateDeg}deg)`,
      clipPath: "polygon(44% 0%, 56% 0%, 100% 100%, 0% 100%)",
      background: `linear-gradient(to bottom, rgba(255,255,255,${0.34 * intensity}), rgba(255,255,255,${0.1 * intensity}) 55%, rgba(255,255,255,0) 88%)`,
      mixBlendMode: "screen",
    }}
  />
);

export const SpotlightBeam: React.FC<{
  mode?: "land" | "drift" | "converge";
  /** Horizontal point (percent of width) the beam aims at / lands on. */
  targetX?: number;
  startFrame?: number;
  intensity?: number;
}> = ({ mode = "land", targetX = 50, startFrame = 0, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const local = Math.max(0, frame - startFrame);
  const coneH = height * 1.25;
  const coneW = Math.min(width, height) * 0.82;

  if (mode === "converge") {
    // Two beams pivot in from the outer top corners and cross over center.
    const t = easeOutCubic(
      interpolate(local, [0, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    );
    const sway = Math.sin(local * 0.03) * 2.5;
    const rotL = interpolate(t, [0, 1], [-44, -10]) + sway;
    const rotR = interpolate(t, [0, 1], [44, 10]) - sway;
    return (
      <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
        <BeamCone pivotX={16} rotateDeg={rotL} coneWidth={coneW} coneHeight={coneH} intensity={intensity * t} />
        <BeamCone pivotX={84} rotateDeg={rotR} coneWidth={coneW} coneHeight={coneH} intensity={intensity * t} />
      </AbsoluteFill>
    );
  }

  // land: sweep in from the side and settle on targetX. drift: slow oscillation.
  const settle = easeOutCubic(
    interpolate(local, [0, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  const sweep = mode === "land" ? interpolate(settle, [0, 1], [-34, 0]) : 0;
  const drift = mode === "drift" ? Math.sin(local * 0.025) * 7 : Math.sin(local * 0.03) * 1.8;
  const rot = sweep + drift;
  // Brightness lift the moment the landing settles.
  const landGlow =
    mode === "land"
      ? interpolate(local, [22, 30, 52], [0, 0.5, 0.22], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 0.18;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <BeamCone
        pivotX={targetX}
        rotateDeg={rot}
        coneWidth={coneW}
        coneHeight={coneH}
        intensity={intensity * (mode === "land" ? settle : 1)}
      />
      {/* Soft pool of light where the beam lands. */}
      <div
        style={{
          position: "absolute",
          left: `${targetX}%`,
          top: "58%",
          width: coneW * 1.15,
          height: height * 0.4,
          marginLeft: -(coneW * 1.15) / 2,
          background: `radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255,255,255,${0.5 * landGlow * intensity}), transparent 70%)`,
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
};

// ─── FlashPop ────────────────────────────────────────────────────────────────
// Paparazzi camera flashes: short seeded white bursts with a 4-point glint that
// pop near the frame edges on a loop. Pure frame math — every render identical.

export const FlashPop: React.FC<{
  count?: number;
  /** Frames between pops per slot. */
  every?: number;
  seed?: number;
  startFrame?: number;
}> = ({ count = 3, every = 72, seed = 5, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const LIFE = 9;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: count }).map((_, i) => {
        const offset = Math.floor(seededRandom(seed + i * 11.3) * every);
        const t = local - offset;
        if (t < 0) return null;
        const phase = t % every;
        if (phase >= LIFE) return null;
        const burst = Math.floor(t / every); // which pop this slot is on
        const rx = seededRandom(seed + i * 31.7 + burst * 97.1);
        const ry = seededRandom(seed + i * 53.9 + burst * 41.3);
        // Hug the edges: map into the outer bands of the frame.
        const x = rx < 0.5 ? 6 + rx * 36 : 76 + (rx - 0.5) * 36;
        const y = 12 + ry * 70;
        const size = 150 + seededRandom(seed + i * 7.7 + burst) * 130;
        const op = interpolate(phase, [0, 1, LIFE], [0, 0.95, 0], { extrapolateRight: "clamp" });
        const scale = 0.55 + (phase / LIFE) * 0.6;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              opacity: op,
              transform: `scale(${scale})`,
              mixBlendMode: "screen",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.25) 30%, transparent 65%)",
              }}
            />
            {/* 4-point glint */}
            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, marginLeft: -1, background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.9), transparent)" }} />
            <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 2, marginTop: -1, background: "linear-gradient(to right, transparent, rgba(255,255,255,0.9), transparent)" }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ─── DiagonalShards ──────────────────────────────────────────────────────────
// Bold red shard bands that slice in across a corner with a spring slam and sit
// as a composition anchor. Much louder than AccentBars — a real set-piece.

export const DiagonalShards: React.FC<{
  accentColor?: string;
  corner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  startFrame?: number;
}> = ({ accentColor = "#EF4444", corner = "top-right", startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flipX = corner.endsWith("left") ? -1 : 1;
  const flipY = corner.startsWith("bottom") ? -1 : 1;
  // Three slanted bands of decreasing presence.
  const bands = [
    { off: 0, w: 70, op: 0.95 },
    { off: 110, w: 38, op: 0.6 },
    { off: 185, w: 18, op: 0.34 },
  ];
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
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
          const s = spring({ frame: frame - startFrame - i * 4, fps, config: { damping: 200 } });
          const slide = (1 - s) * 420;
          return (
            <g key={i} transform={`translate(${slide}, ${-slide})`} opacity={b.op * s}>
              {/* A 45° band slicing across the corner. */}
              <polygon
                points={`${340 - b.off},0 ${340 - b.off + b.w},0 640,${300 + b.off + b.w} 640,${300 + b.off}`}
                fill={accentColor}
              />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ─── TitleEcho ───────────────────────────────────────────────────────────────
// An oversized outline-only echo of the focal word that lags the main word's
// slam by a few frames — kinetic-typography depth behind the hero text.

export const TitleEcho: React.FC<{
  text: string;
  accentColor?: string;
  startFrame?: number;
  /** Echo font size; defaults to a big slab relative to canvas height. */
  fontSize?: number;
}> = ({ text, accentColor = "#EF4444", startFrame = 0, fontSize }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  // Lag the focal word's spring by ~5 frames so it visibly chases.
  const s = spring({ frame: frame - startFrame - 5, fps, config: { damping: 16, stiffness: 160, mass: 1.1 } });
  const scale = 1.45 - s * 0.32;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontFamily: SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY,
          fontWeight: 900,
          fontSize: fontSize ?? height * 0.3,
          lineHeight: 1,
          textTransform: "uppercase",
          letterSpacing: "-0.04em",
          whiteSpace: "nowrap",
          color: "transparent",
          WebkitTextStroke: `2px ${accentColor}`,
          opacity: 0.22 * s,
          transform: `scale(${scale})`,
          userSelect: "none",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

// ─── StarburstBadge ──────────────────────────────────────────────────────────
// A rotating starburst seal stamped into a corner — pops in with a spring, then
// spins slowly forever. Reads like a price-sticker / "NEW!" badge: pure social.

export const StarburstBadge: React.FC<{
  accentColor?: string;
  label?: string;
  corner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  size?: number;
  startFrame?: number;
}> = ({ accentColor = "#EF4444", label = "★", corner = "bottom-right", size = 168, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 12, stiffness: 180 } });
  const rot = (frame - startFrame) * 0.5;
  const right = corner.endsWith("right");
  const bottom = corner.startsWith("bottom");
  // 14-spike starburst polygon, computed deterministically.
  const spikes = 14;
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 50 : 40;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    pts.push(`${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`);
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
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
          <polygon points={pts.join(" ")} fill={accentColor} opacity={0.95} />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY,
            fontWeight: 900,
            fontSize: size * 0.2,
            color: "#FFFFFF",
            textTransform: "uppercase",
            letterSpacing: "0.02em",
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

// ─── PulseRing ───────────────────────────────────────────────────────────────
// A faint accent ring that expands + fades on a deterministic loop, centred. A
// soft "pulse" behind a stat. Subtle — adds life without a focal element.

export const PulseRing: React.FC<{
  accentColor?: string;
  periodFrames?: number;
}> = ({ accentColor = "#EF4444", periodFrames = 90 }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const phase = (frame % periodFrames) / periodFrames; // 0→1
  const e = easeOutCubic(phase);
  const base = width * 0.18;
  const size = base + e * base * 1.6;
  const op = (1 - phase) * 0.16;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `2px solid ${accentColor}`,
          opacity: op,
        }}
      />
    </AbsoluteFill>
  );
};
