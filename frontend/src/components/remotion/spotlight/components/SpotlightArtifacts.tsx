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
  const repeated = unit.repeat(24);
  // Loop the slide over the width of one tile-ish span; deterministic.
  const span = 520;
  const offset = -((frame * speed * 2.2) % span);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          [edge]: "4.5%",
          left: 0,
          width: width + span,
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
