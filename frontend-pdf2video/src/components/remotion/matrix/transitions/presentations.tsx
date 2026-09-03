import React from "react";
import { AbsoluteFill } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";
import { MATRIX_DEFAULT_FONT_FAMILY } from "../constants";

/**
 * Matrix custom transition presentations.
 *
 * Every move is a Matrix-branded cut — a rain wall sweeps the frame, a scanline
 * decodes the next scene, a neon whip, a de-rez slice dissolve. Each is a pure
 * function of `presentationProgress` (0→1) and `presentationDirection`, so
 * headless renders match the preview frame-for-frame (no timers, no randomness).
 *
 * Anti-"stuck" rule (the old glitch pool was reverted for freezing): BOTH scenes
 * keep transforming for the entire overlap — nothing ever holds a static frame.
 */

export const MATRIX_ACCENT = "#00FF41";

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const RAIN_CHARS =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789";

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

type Direction = "from-left" | "from-right";

// ─── rainWall ─────────────────────────────────────────────────────────────────
// A wall of bright rain-glyph columns sweeps across the frame; the incoming
// scene is revealed at its trailing edge via clip-path while both scenes drift
// with the sweep, so the cut happens *under* the code, never as a dissolve.

type RainWallProps = { direction?: Direction; color?: string };

// Width of the travelling glyph band, fraction of the canvas.
const RAIN_BAND = 0.34;
const RAIN_COLS = 12;
const RAIN_ROWS = 14;

const RainWallComponent: React.FC<
  TransitionPresentationComponentProps<RainWallProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const direction = passedProps.direction ?? "from-left";
  const color = passedProps.color ?? MATRIX_ACCENT;
  const e = easeInOutCubic(presentationProgress);
  const fromLeft = direction === "from-left";

  const edge = e; // cut position 0→1 across the frame
  const clip =
    presentationDirection === "entering"
      ? fromLeft
        ? `inset(0 ${((1 - edge) * 100).toFixed(2)}% 0 0)`
        : `inset(0 0 0 ${((1 - edge) * 100).toFixed(2)}%)`
      : fromLeft
        ? `inset(0 0 0 ${(edge * 100).toFixed(2)}%)`
        : `inset(0 ${(edge * 100).toFixed(2)}% 0 0)`;

  // Slight drift on both scenes so motion never stops.
  const driftSign = fromLeft ? 1 : -1;
  const drift =
    presentationDirection === "entering"
      ? -driftSign * (1 - e) * 4
      : driftSign * e * 4;

  if (presentationDirection === "exiting") {
    return (
      <AbsoluteFill style={{ clipPath: clip, transform: `translateX(${drift}%)` }}>
        {children}
      </AbsoluteFill>
    );
  }

  // The glyph band rides ahead of the cut edge (leading side), exiting cleanly.
  const bandLead = (fromLeft ? edge : 1 - edge) * (1 + RAIN_BAND) - RAIN_BAND;
  const bandLeftPct = (fromLeft ? bandLead : 1 - bandLead - RAIN_BAND) * 100;
  // Glyphs mutate as the wall travels (quantized progress keeps it deterministic).
  const tick = Math.floor(presentationProgress * 18);

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: clip, transform: `translateX(${drift}%)` }}>
        {children}
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${bandLeftPct}%`,
          width: `${RAIN_BAND * 100}%`,
          display: "flex",
          justifyContent: "space-around",
          pointerEvents: "none",
          background: `linear-gradient(${fromLeft ? "to left" : "to right"}, transparent, rgba(0,0,0,0.82) 35%, rgba(0,0,0,0.82) 65%, transparent)`,
        }}
      >
        {Array.from({ length: RAIN_COLS }).map((_, c) => (
          <div key={c} style={{ display: "flex", flexDirection: "column", justifyContent: "space-around" }}>
            {Array.from({ length: RAIN_ROWS }).map((__, r) => {
              const bright = seededRandom(c * 31 + r * 7 + tick * 13) > 0.78;
              const ch = RAIN_CHARS[Math.floor(seededRandom(c * 97 + r * 17 + tick * 3) * RAIN_CHARS.length)];
              return (
                <span
                  key={r}
                  style={{
                    fontFamily: MATRIX_DEFAULT_FONT_FAMILY,
                    fontSize: 26,
                    lineHeight: 1,
                    color: bright ? "#FFFFFF" : color,
                    opacity: bright ? 1 : 0.55 + seededRandom(c * 11 + r * 3) * 0.4,
                    textShadow: bright ? `0 0 12px ${color}` : `0 0 6px ${color}66`,
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const rainWall = (
  props: RainWallProps = {},
): TransitionPresentation<RainWallProps> => ({
  component: RainWallComponent,
  props,
});

// ─── decodeWipe ───────────────────────────────────────────────────────────────
// A bright scanline travels down the frame: above it the incoming scene is
// already "decoded", below it the outgoing scene still runs. Both scenes breathe
// (gentle counter-zoom) so the pass never feels static.

type DecodeWipeProps = { color?: string };

const DecodeWipeComponent: React.FC<
  TransitionPresentationComponentProps<DecodeWipeProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const color = passedProps.color ?? MATRIX_ACCENT;
  const e = easeInOutCubic(presentationProgress);
  const edge = e; // scanline position 0→1 (top → bottom)

  if (presentationDirection === "exiting") {
    const scale = 1 + 0.025 * e;
    return (
      <AbsoluteFill
        style={{
          clipPath: `inset(${(edge * 100).toFixed(2)}% 0 0 0)`,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </AbsoluteFill>
    );
  }

  const scale = 1.03 - 0.03 * e;
  const lineY = (edge * 100).toFixed(2);
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          clipPath: `inset(0 0 ${((1 - edge) * 100).toFixed(2)}% 0)`,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </AbsoluteFill>
      {/* The scanline + phosphor glow riding the cut. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: `${lineY}%`,
          height: 4,
          marginTop: -2,
          background: color,
          boxShadow: `0 0 20px ${color}, 0 0 48px ${color}88`,
          opacity: Math.sin(presentationProgress * Math.PI) * 0.6 + 0.35,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

export const decodeWipe = (
  props: DecodeWipeProps = {},
): TransitionPresentation<DecodeWipeProps> => ({
  component: DecodeWipeComponent,
  props,
});

// ─── neonWhip ─────────────────────────────────────────────────────────────────
// Fast directional whip: both scenes ride a full-distance slide with a motion
// blur + green phosphor flash peaking at the midpoint, resolving crisp.

type NeonWhipProps = { direction?: Direction; distance?: number; color?: string };

const NeonWhipComponent: React.FC<
  TransitionPresentationComponentProps<NeonWhipProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const direction = passedProps.direction ?? "from-right";
  const distance = passedProps.distance ?? 1920;
  const color = passedProps.color ?? MATRIX_ACCENT;
  const e = easeInOutCubic(presentationProgress);
  const bell = Math.sin(presentationProgress * Math.PI);
  const blur = bell * 16;
  const sign = direction === "from-right" ? 1 : -1;

  const off =
    presentationDirection === "exiting"
      ? -sign * e * distance
      : sign * (1 - e) * distance;

  return (
    <AbsoluteFill style={{ transform: `translateX(${off}px)`, filter: `blur(${blur * 0.5}px)` }}>
      {children}
      {/* Green phosphor streak at peak velocity. */}
      {presentationDirection === "entering" && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(${sign > 0 ? "to left" : "to right"}, ${color}26, transparent 45%)`,
            opacity: bell,
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
};

export const neonWhip = (
  props: NeonWhipProps = {},
): TransitionPresentation<NeonWhipProps> => ({
  component: NeonWhipComponent,
  props,
});

// ─── derez ────────────────────────────────────────────────────────────────────
// The outgoing scene "de-rezzes": it splits into horizontal slices that shear
// apart with increasing offset while continuously receding + dimming; the
// incoming scene zooms in from 1.06 underneath. Constant motion on both sides.

type DerezProps = { color?: string };

const DEREZ_SLICES = 5;

const DerezComponent: React.FC<
  TransitionPresentationComponentProps<DerezProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const e = easeInOutCubic(presentationProgress);

  if (presentationDirection === "entering") {
    const scale = 1.06 - 0.06 * e;
    const opacity = Math.min(1, presentationProgress * 1.8);
    return (
      <AbsoluteFill style={{ transform: `scale(${scale})`, opacity }}>
        {children}
      </AbsoluteFill>
    );
  }

  // Outgoing: sliced copies shear apart horizontally, all receding together.
  const recede = 1 - 0.06 * e;
  const dim = 1 - e;
  return (
    <AbsoluteFill style={{ transform: `scale(${recede})`, opacity: dim }}>
      {Array.from({ length: DEREZ_SLICES }).map((_, i) => {
        const top = (i / DEREZ_SLICES) * 100;
        const bottom = 100 - ((i + 1) / DEREZ_SLICES) * 100;
        const dir = i % 2 === 0 ? 1 : -1;
        const shear = dir * e * (26 + i * 14);
        return (
          <AbsoluteFill
            key={i}
            style={{
              clipPath: `inset(${top.toFixed(2)}% 0 ${bottom.toFixed(2)}% 0)`,
              transform: `translateX(${shear}px)`,
            }}
          >
            {children}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

export const derez = (): TransitionPresentation<DerezProps> => ({
  component: DerezComponent,
  props: {},
});
