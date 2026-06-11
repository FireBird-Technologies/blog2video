import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { MATRIX_DEFAULT_FONT_FAMILY } from "../constants";

/**
 * MatrixArtifacts — deterministic, render-safe decorative primitives that
 * individual Matrix layouts compose on top of MatrixBackground to fill negative
 * space with the template's hacker-terminal world: HUD chrome, decode sweeps,
 * cipher rings, rain bursts, wireframe depth and rare glitch ticks. Every piece
 * is a pure function of useCurrentFrame() (seeded randomness only — never
 * Math.random at render time). The rule: these FRAME the focal text, they never
 * crowd it — low opacities, edge-hugging, far behind the words.
 */

const MATRIX_CHARS =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF<>/\\|+=*";
const HEX_CHARS = "0123456789ABCDEF";

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const charAt = (seed: number, pool: string): string =>
  pool[Math.floor(seededRandom(seed) * pool.length)];

// ─── RainBurst ───────────────────────────────────────────────────────────────
// A localized surge of bright glyph columns that cascades down a band of the
// frame at scene start, then thins out — denser and brighter than the ambient
// MatrixBackground, so the entrance feels like the code "parting" for the scene.

export const RainBurst: React.FC<{
  accentColor?: string;
  /** Horizontal center of the burst band, percent of width. */
  centerX?: number;
  /** Band width, percent of width. */
  widthPct?: number;
  columns?: number;
  startFrame?: number;
  seed?: number;
}> = ({ accentColor = "#00FF41", centerX = 50, widthPct = 70, columns = 16, startFrame = 0, seed = 3 }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0) return null;
  // The whole burst decays over ~3.5s so it reads as an entrance, not wallpaper.
  const decay = interpolate(local, [0, 20, 105], [0, 1, 0.25], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: columns }).map((_, i) => {
        const r1 = seededRandom(seed + i * 5.7);
        const r2 = seededRandom(seed + i * 9.1);
        const r3 = seededRandom(seed + i * 13.7);
        const x = centerX - widthPct / 2 + r1 * widthPct;
        const speed = 9 + r2 * 9;
        const len = 9 + Math.floor(r3 * 8);
        const fontSize = 16 + Math.floor(r2 * 8);
        const colStart = Math.floor(r3 * 14);
        const head = (local - colStart) * speed;
        if (head < 0) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              transform: `translateY(${head - len * fontSize * 1.3}px)`,
              opacity: decay * (0.4 + r1 * 0.4),
            }}
          >
            {Array.from({ length: len }).map((_, j) => {
              const isHead = j === len - 1;
              const fade = isHead ? 1 : Math.max(0, 1 - (len - 1 - j) * 0.12);
              // Glyphs mutate on a slow seeded cycle so the column lives.
              const ch = charAt(seed * 31 + i * 100 + j * 7 + Math.floor(local / 6), MATRIX_CHARS);
              return (
                <span
                  key={j}
                  style={{
                    fontFamily: MATRIX_DEFAULT_FONT_FAMILY,
                    fontSize,
                    lineHeight: 1.25,
                    color: isHead ? "#FFFFFF" : accentColor,
                    opacity: fade,
                    textShadow: isHead ? `0 0 14px ${accentColor}` : fade > 0.6 ? `0 0 8px ${accentColor}` : "none",
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        );
      })}
      {/* Keep the burst inside the canvas height — fade everything near the floor. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: height * 0.18,
          background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.85))",
        }}
      />
    </AbsoluteFill>
  );
};

// ─── DecodeSweep ─────────────────────────────────────────────────────────────
// A bright horizontal scanline travels down the frame once, trailing a brief
// band of hex characters that "decode" and fade behind it. One clean pass.

export const DecodeSweep: React.FC<{
  accentColor?: string;
  startFrame?: number;
  /** Frames the sweep takes to cross the frame. */
  durationFrames?: number;
  seed?: number;
}> = ({ accentColor = "#00FF41", startFrame = 0, durationFrames = 45, seed = 8 }) => {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0 || local > durationFrames + 18) return null;
  const t = easeOutCubic(Math.min(1, local / durationFrames));
  const y = t * height * 1.04;
  const lineOpacity = interpolate(local, [0, 4, durationFrames, durationFrames + 12], [0, 0.8, 0.55, 0], {
    extrapolateRight: "clamp",
  });
  const cols = Math.max(10, Math.floor(width / 60));
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {/* The scanline + phosphor glow. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: y,
          height: 3,
          background: accentColor,
          opacity: lineOpacity,
          boxShadow: `0 0 18px ${accentColor}, 0 0 42px ${accentColor}66`,
        }}
      />
      {/* Decoding hex trail just above the line. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: y - 30,
          display: "flex",
          justifyContent: "space-between",
          padding: "0 2%",
          opacity: lineOpacity * 0.7,
        }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <span
            key={i}
            style={{
              fontFamily: MATRIX_DEFAULT_FONT_FAMILY,
              fontSize: 18,
              color: accentColor,
              opacity: 0.25 + seededRandom(seed + i * 3.3 + Math.floor(local / 3)) * 0.75,
            }}
          >
            {charAt(seed * 17 + i * 11 + Math.floor(local / 2), HEX_CHARS)}
            {charAt(seed * 23 + i * 13 + Math.floor(local / 2), HEX_CHARS)}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ─── TerminalHUD ─────────────────────────────────────────────────────────────
// HUD chrome: a typing status line with a blinking block cursor + a small
// scrolling hex column on the right edge. Edge-hugging "you're inside a
// terminal" dressing that never touches the focal text. (No corner brackets —
// they read as a rectangle frame and were cut.)

export const TerminalHUD: React.FC<{
  accentColor?: string;
  /** Status label typed out at the bottom-left. */
  statusText?: string;
  /** Show the scrolling hex column on the right edge. */
  hexColumn?: boolean;
  startFrame?: number;
  seed?: number;
}> = ({ accentColor = "#00FF41", statusText = "> SIGNAL LOCKED // STREAMING", hexColumn = true, startFrame = 0, seed = 4 }) => {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - startFrame);
  const typed = Math.min(statusText.length, Math.floor(local / 2));
  const cursorOn = Math.floor(local / 8) % 2 === 0;
  const hexRows = 7;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Typing status line, bottom-left. */}
      <div
        style={{
          position: "absolute",
          left: "4.5%",
          bottom: "3%",
          fontFamily: MATRIX_DEFAULT_FONT_FAMILY,
          fontSize: 20,
          letterSpacing: "0.08em",
          color: accentColor,
          opacity: 0.55,
          whiteSpace: "nowrap",
        }}
      >
        {statusText.slice(0, typed)}
        <span style={{ opacity: cursorOn ? 0.9 : 0 }}>▮</span>
      </div>

      {/* Scrolling hex readout, right edge. */}
      {hexColumn && (
        <div
          style={{
            position: "absolute",
            right: "1.6%",
            top: "18%",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            opacity: 0.32,
          }}
        >
          {Array.from({ length: hexRows }).map((_, i) => {
            const row = Math.floor(local / 10) + i;
            return (
              <span
                key={i}
                style={{
                  fontFamily: MATRIX_DEFAULT_FONT_FAMILY,
                  fontSize: 15,
                  color: accentColor,
                }}
              >
                0x
                {Array.from({ length: 4 })
                  .map((__, j) => charAt(seed * 7 + row * 31 + j * 3, HEX_CHARS))
                  .join("")}
              </span>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};

// ─── CipherRing ──────────────────────────────────────────────────────────────
// Two counter-rotating rings of glyphs (SVG textPath) sitting far behind the
// focal number/word — a slow cipher dial. Low opacity; pure depth.

export const CipherRing: React.FC<{
  accentColor?: string;
  /** Outer ring diameter as a fraction of the canvas's smaller side. */
  scale?: number;
  startFrame?: number;
  seed?: number;
}> = ({ accentColor = "#00FF41", scale = 0.72, startFrame = 0, seed = 6 }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const local = frame - startFrame;
  const size = Math.min(width, height) * scale;
  const s = spring({ frame: local, fps, config: { damping: 60, stiffness: 80 } });
  const ringText = (n: number, salt: number) =>
    Array.from({ length: n })
      .map((_, i) => charAt(seed * 13 + salt * 51 + i * 7, MATRIX_CHARS))
      .join(" ");
  return (
    <AbsoluteFill
      style={{ pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        style={{ opacity: 0.2 * s, overflow: "visible" }}
      >
        <defs>
          <path id="cipher-ring-outer" d="M 100,100 m -88,0 a 88,88 0 1,1 176,0 a 88,88 0 1,1 -176,0" />
          <path id="cipher-ring-inner" d="M 100,100 m -64,0 a 64,64 0 1,1 128,0 a 64,64 0 1,1 -128,0" />
        </defs>
        <g style={{ transformOrigin: "100px 100px", transform: `rotate(${local * 0.25}deg)` }}>
          <circle cx={100} cy={100} r={88} fill="none" stroke={accentColor} strokeWidth={0.6} opacity={0.5} />
          <text fill={accentColor} fontSize={9} fontFamily={MATRIX_DEFAULT_FONT_FAMILY} letterSpacing={2}>
            <textPath href="#cipher-ring-outer">{ringText(34, 1)}</textPath>
          </text>
        </g>
        <g style={{ transformOrigin: "100px 100px", transform: `rotate(${-local * 0.4}deg)` }}>
          <circle cx={100} cy={100} r={64} fill="none" stroke={accentColor} strokeWidth={0.6} opacity={0.5} />
          <text fill={accentColor} fontSize={8} fontFamily={MATRIX_DEFAULT_FONT_FAMILY} letterSpacing={2}>
            <textPath href="#cipher-ring-inner">{ringText(26, 2)}</textPath>
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};

// ─── GridTunnel ──────────────────────────────────────────────────────────────
// A faint wireframe floor receding to a vanishing point, drifting slowly toward
// the camera — "inside the construct" depth without touching the focal area.

export const GridTunnel: React.FC<{
  accentColor?: string;
  /** 0-1, overall strength. */
  intensity?: number;
}> = ({ accentColor = "#00FF41", intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const horizon = height * 0.58;
  const rows = 9;
  const cols = 17;
  const drift = (frame * 0.012) % (1 / rows);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: 0.38 * intensity }}>
        {/* Horizon glow */}
        <line x1={0} y1={horizon} x2={width} y2={horizon} stroke={accentColor} strokeWidth={2} opacity={0.85} />
        {/* Receding horizontal lines — spacing eases toward the horizon; drift loops. */}
        {Array.from({ length: rows }).map((_, i) => {
          const t = (i / rows + drift) % 1;
          const y = horizon + Math.pow(t, 2.2) * (height - horizon);
          const op = 0.25 + t * 0.65;
          return <line key={i} x1={0} y1={y} x2={width} y2={y} stroke={accentColor} strokeWidth={1.5} opacity={op} />;
        })}
        {/* Converging verticals */}
        {Array.from({ length: cols }).map((_, i) => {
          const fx = (i / (cols - 1)) * width;
          const vx = width / 2 + (fx - width / 2) * 0.08;
          return (
            <line key={i} x1={fx} y1={height} x2={vx} y2={horizon} stroke={accentColor} strokeWidth={1.5} opacity={0.55} />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ─── CodeFragments ───────────────────────────────────────────────────────────
// Sparse floating readouts — coords, hex words, status tags — that fade in/out
// at seeded edge positions and drift slowly. Fills negative space with "system
// activity" without touching the focal area (kept out of the middle band).

const FRAGMENT_POOL = [
  "0x4F2A", "SYS:OK", "NODE_7", "▸▸▸", "::1337", "TRACE", "0b1011", "PKT_44",
  "AUTH ✓", "GRID-9", "0xFF00", "LINK^", "SEC.04", "RUN //", "[OK]", "≋≋≋",
];

export const CodeFragments: React.FC<{
  accentColor?: string;
  count?: number;
  seed?: number;
  startFrame?: number;
}> = ({ accentColor = "#00FF41", count = 9, seed = 14, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  if (local < 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: count }).map((_, i) => {
        const r1 = seededRandom(seed + i * 7.3);
        const r2 = seededRandom(seed + i * 11.9);
        const r3 = seededRandom(seed + i * 17.1);
        // Keep fragments in the outer bands: x in [2..24]∪[76..98], y spread.
        const x = r1 < 0.5 ? 2 + r1 * 44 : 76 + (r1 - 0.5) * 44;
        const y = 6 + r2 * 86;
        const drift = (local * (0.06 + r3 * 0.1)) % 30;
        // Each fragment breathes on its own phase; text swaps each cycle.
        const period = 110 + Math.floor(r3 * 50);
        const phase = (local + Math.floor(r1 * period)) % period;
        const op = interpolate(phase, [0, 18, period - 24, period], [0, 0.5, 0.5, 0], {
          extrapolateRight: "clamp",
        });
        const cycle = Math.floor((local + Math.floor(r1 * period)) / period);
        const text = FRAGMENT_POOL[Math.floor(seededRandom(seed * 3 + i * 29 + cycle * 13) * FRAGMENT_POOL.length)];
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              transform: `translateY(${-drift}px)`,
              fontFamily: MATRIX_DEFAULT_FONT_FAMILY,
              fontSize: 14 + Math.floor(r2 * 5),
              letterSpacing: "0.1em",
              color: accentColor,
              opacity: op,
              whiteSpace: "nowrap",
            }}
          >
            {text}
          </span>
        );
      })}
    </AbsoluteFill>
  );
};

// ─── ScanlinesOverlay ────────────────────────────────────────────────────────
// CRT texture: fine horizontal scanlines + one brighter line slowly sweeping on
// a loop + a soft phosphor vignette. Screen-blended, very low opacity — pure
// atmosphere over the whole scene.

export const ScanlinesOverlay: React.FC<{
  accentColor?: string;
  /** 0-1, overall strength. */
  intensity?: number;
}> = ({ accentColor = "#00FF41", intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const sweepY = ((frame * 1.6) % (height * 1.3)) - height * 0.15;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, ${accentColor}0D 0px, ${accentColor}0D 1px, transparent 1px, transparent 4px)`,
          mixBlendMode: "screen",
          opacity: 0.7 * intensity,
        }}
      />
      {/* Slow travelling refresh line. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: sweepY,
          height: 90,
          background: `linear-gradient(to bottom, transparent, ${accentColor}14, transparent)`,
          mixBlendMode: "screen",
          opacity: intensity,
        }}
      />
      {/* Phosphor vignette hugging the corners. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 120% 100% at 50% 50%, transparent 62%, ${accentColor}10 100%)`,
          mixBlendMode: "screen",
          opacity: 0.8 * intensity,
        }}
      />
    </AbsoluteFill>
  );
};

// ─── GlitchSlice ─────────────────────────────────────────────────────────────
// Rare, seeded 2-3 frame horizontal slice offsets with a slight RGB split —
// the scene ticks "alive" every couple of seconds without reading as broken.
// Wrap ONLY decorative/regional content, or render standalone as thin glitch
// bands over the background (children optional).

export const GlitchSlice: React.FC<{
  accentColor?: string;
  /** Frames between glitch ticks. */
  every?: number;
  seed?: number;
}> = ({ accentColor = "#00FF41", every = 64, seed = 12 }) => {
  const frame = useCurrentFrame();
  const phase = frame % every;
  const burst = Math.floor(frame / every);
  const active = phase < 3;
  if (!active) return null;
  const bands = 3;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: bands }).map((_, i) => {
        const ry = seededRandom(seed + burst * 17.3 + i * 7.7);
        const rh = seededRandom(seed + burst * 29.1 + i * 3.1);
        const rx = seededRandom(seed + burst * 41.7 + i * 11.3);
        const y = 8 + ry * 80;
        const h = 3 + rh * 14;
        const dx = (rx - 0.5) * 90;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${y}%`,
              height: h,
              transform: `translateX(${dx}px)`,
              background: `linear-gradient(90deg, transparent, ${accentColor}22 20%, ${accentColor}3D 50%, ${accentColor}22 80%, transparent)`,
              boxShadow: `${dx > 0 ? -2 : 2}px 0 0 rgba(255,0,60,0.18)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
