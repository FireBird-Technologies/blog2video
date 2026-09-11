import React from "react";
import { interpolate } from "remotion";
import { SWAN_PM } from "../swanPaths";
import { blackswanNeonPalette } from "../layouts/blackswanAccent";

/**
 * SwanParticles — the swan assembling out of, or coming apart into, motes.
 *
 * Extracted from `dive_insight__v2`'s file-local `SwanDissolve` when that layout
 * was removed, so the effect survives its original home and any blackswan scene
 * can use it. Kept inside `src/templates/blackswan/` on purpose: the backend
 * copies only `src/templates/<id>/` into each per-project render workspace, so a
 * cross-template import compiles in the Player and then breaks the headless
 * render with an unresolved module.
 *
 * ── Coordinate space ────────────────────────────────────────────────────────
 * Points are sampled off `SWAN_PM` and pre-transformed into the SAME 700×480
 * viewBox `Swan.tsx` draws in. A caller therefore only has to mount
 * `<svg viewBox="0 0 700 480">` over its `<Swan>` at matching size and position
 * — the motes land on the outline with no per-scene alignment maths.
 */

/** The swan's own viewBox, matching `Swan.tsx`. */
export const SWAN_VB_W = 700;
export const SWAN_VB_H = 480;

type Pt = readonly [number, number];
type Seg = readonly [Pt, Pt, Pt, Pt];

/**
 * Parse an absolute cubic path (`M`/`C`/`Z`) into segments.
 *
 * Deliberately tolerant: on an unrecognised command it returns what it has
 * rather than throwing, so a future regeneration of `swanPaths.ts` that
 * introduces `L`/`Q` degrades to a sparser swan instead of crashing the render.
 * It degrades SILENTLY, which is the trade — a crash would be louder but would
 * take the whole video down.
 */
function parseCubicPath(d: string): Seg[] {
  const tokens = d.match(/[MCZmcz]|-?[0-9]*\.?[0-9]+(?:e-?[0-9]+)?/g) ?? [];
  const segs: Seg[] = [];
  let cmd = "";
  let buf: number[] = [];
  let cur: Pt = [0, 0];
  let start: Pt = [0, 0];

  for (const tk of tokens) {
    if (/[MCZmcz]/.test(tk)) {
      if (tk === "Z" || tk === "z") {
        // Close with a degenerate segment so the seam gets sampled too.
        segs.push([cur, cur, start, start]);
        cur = start;
      } else if (tk !== "M" && tk !== "C") {
        return segs; // unsupported command — bail with what we have
      }
      cmd = tk;
      buf = [];
      continue;
    }
    buf.push(parseFloat(tk));
    if (cmd === "M" && buf.length === 2) {
      cur = [buf[0], buf[1]];
      start = cur;
      buf = [];
      cmd = "C"; // implicit: numbers following an M repeat as the next command
    } else if (cmd === "C" && buf.length === 6) {
      const p3: Pt = [buf[4], buf[5]];
      segs.push([cur, [buf[0], buf[1]], [buf[2], buf[3]], p3]);
      cur = p3;
      buf = [];
    }
  }
  return segs;
}

/** Standard Bernstein evaluation of one cubic. */
function cubicAt(s: Seg, u: number): Pt {
  const v = 1 - u;
  const [p0, c1, c2, p3] = s;
  return [
    v * v * v * p0[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * p3[0],
    v * v * v * p0[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * p3[1],
  ];
}

/**
 * Arclength-uniform samples along the swan outline, already transformed into
 * the 700×480 viewBox.
 *
 * `Swan.tsx` draws the body inside `<g transform="translate(12,10) scale(0.614)">`
 * with the path itself at `translate(588,218)`, so a raw point (x,y) lands at
 * `X = 12 + 0.614*(x+588)`, `Y = 10 + 0.614*(y+218)`.
 *
 * Sanity check (verified at design time): the resulting bbox is
 * X 199.7..534.8, Y 143.9..355.8 — that Y max sits 1.2 units above the swan's
 * designed waterline of 357, which is how we know the transform is right.
 */
function sampleSwanOutline(n: number): Pt[] {
  const segs = parseCubicPath(SWAN_PM);
  if (segs.length === 0) return [];

  const lens: number[] = [];
  const offs: number[] = [];
  let total = 0;
  for (const s of segs) {
    let prev = cubicAt(s, 0);
    let len = 0;
    for (let k = 1; k <= 16; k++) {
      const cp = cubicAt(s, k / 16);
      len += Math.hypot(cp[0] - prev[0], cp[1] - prev[1]);
      prev = cp;
    }
    offs.push(total);
    lens.push(len);
    total += len;
  }
  if (total <= 0) return [];

  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const target = (total * i) / n;
    let si = segs.length - 1;
    for (let j = 0; j < segs.length; j++) {
      if (target <= offs[j] + lens[j]) {
        si = j;
        break;
      }
    }
    const u = lens[si] > 0 ? (target - offs[si]) / lens[si] : 0;
    const [x, y] = cubicAt(segs[si], Math.max(0, Math.min(1, u)));
    out.push([12 + 0.614 * (x + 588), 10 + 0.614 * (y + 218)]);
  }
  return out;
}

/**
 * 180 samples ≈ one every 18 units along a ~3312-unit outline, which keeps the
 * neck and beak — the most identity-bearing features — reading as a continuous
 * line of glitter rather than a dotted one. `StarField` runs 252 particles, so
 * this stays inside a proven bound.
 */
const PARTICLE_COUNT = 180;
const SWAN_PTS: Pt[] = sampleSwanOutline(PARTICLE_COUNT);
const SWAN_X_MIN = SWAN_PTS.length ? Math.min(...SWAN_PTS.map((q) => q[0])) : 0;
const SWAN_X_MAX = SWAN_PTS.length ? Math.max(...SWAN_PTS.map((q) => q[0])) : 1;

/** Two-arg channel PRNG: each property draws its own channel, so adding one
 *  doesn't reshuffle the others. Copied from the sakura template. */
function chanRand(seed: number, n: number): number {
  return Math.abs(Math.sin(seed * 127.1 + n * 311.7) * 43758.5453) % 1;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * The swan coming apart, or coming together.
 *
 * Ordered, not random: release sweeps along the body, and freed particles drift
 * up-left on a CURVE (the buoyancy term is separate from the radial distance).
 * Straight radial rays from one origin read as an explosion; a sequenced sweep
 * with rising, swaying motes reads as disintegration.
 *
 * `assemble` is the SAME maths run backwards rather than a second effect: the
 * progress term is inverted and the sweep runs front→rear, so the motes converge
 * along the mirror of the path they would have left by. Keeping one body of
 * geometry is what makes the two ends of a scene look like one idea.
 */
export const SwanParticles: React.FC<{
  /** 0→1 progress through the effect. */
  dz: number;
  pal: ReturnType<typeof blackswanNeonPalette>;
  mode?: "assemble" | "dissolve";
  /**
   * Suffix for the internal blur filter's id. SVG filter ids are
   * document-global, so two scenes mounted in the same Player collide unless
   * each passes its own.
   */
  uid?: string;
}> = ({ dz, pal, mode = "dissolve", uid = "swanparts" }) => {
  if (dz <= 0) return null;
  const span = Math.max(1, SWAN_X_MAX - SWAN_X_MIN);
  const filterId = `bsw-fpart-${uid}`;
  const assembling = mode === "assemble";

  return (
    <>
      <defs>
        <filter id={filterId} x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.2" />
        </filter>
      </defs>
      <g style={{ mixBlendMode: "screen" }}>
        {SWAN_PTS.map((pt, i) => {
          const [px, py] = pt;
          const r0 = chanRand(i, 0);
          const r1 = chanRand(i, 1);
          const r2 = chanRand(i, 2);
          const r3 = chanRand(i, 3);

          // ── One clock, played forwards or backwards ────────────────────
          // `p` is the position on the DISSOLVE timeline. Assembling simply
          // plays that timeline in reverse, so every derived quantity —
          // position, opacity, size, sway — reverses together.
          //
          // Inverting them separately does not work, and was the original bug
          // here: driving opacity from the un-inverted progress while position
          // ran backwards meant an assembling mote reached the outline exactly
          // as its opacity returned to zero, so the bird formed and instantly
          // vanished. A reverse has to be one inversion at the top, not two
          // halfway down.
          const p = assembling ? 1 - clamp01(dz) : clamp01(dz);

          // Rear-first sweep: 0 at the tail, 1 at the beak (the swan faces
          // right). Unchanged between modes — reversing the clock already makes
          // the assemble land front-first, which is the true mirror.
          const rx = (px - SWAN_X_MIN) / span;
          const release = clamp01(rx * 0.55 + r0 * 0.18);
          const life = Math.max(0.18, 1 - release);
          const q = clamp01((p - release) / life);
          if (q <= 0) return null;

          // Hold at full strength once settled rather than fading back out: on
          // the dissolve the tail of this ramp is the mote disappearing, and
          // played backwards it is the mote arriving and staying lit until the
          // solid bird takes over.
          const opacity = assembling
            ? interpolate(q, [0, 0.12, 1], [0, 1, 1], { extrapolateRight: "clamp" })
            : interpolate(q, [0, 0.12, 0.6, 1], [0, 1, 0.65, 0], { extrapolateRight: "clamp" });
          if (opacity < 0.02) return null;

          // Up-left cluster with spread.
          const ang = Math.PI * (1.05 + r1 * 0.55);
          const ease = 1 - Math.pow(1 - q, 3);
          const dist = (26 + r2 * 54) * ease;
          // Dual-frequency sway so 180 motes don't move in lockstep.
          const sway = 5 * Math.sin(q * 6.1 + r3 * 6.28) + 2.5 * Math.sin(q * 11.3 + r1 * 6.28);
          const x = px + Math.cos(ang) * dist + sway;
          // Buoyancy is SEPARATE from `dist` so the drift curves upward.
          const y = py + Math.sin(ang) * dist - 14 * q * q;
          const size = (0.9 + r2 * 1.6) * (1 - 0.35 * q);

          return (
            <React.Fragment key={i}>
              <circle cx={x} cy={y} r={size * 2.6} fill={pal.core} opacity={opacity * 0.3} filter={`url(#${filterId})`} />
              <circle cx={x} cy={y} r={size} fill={pal.bright} opacity={opacity} />
            </React.Fragment>
          );
        })}
      </g>
    </>
  );
};
