/**
 * The paper every scene's background (and the opened sheet of the opening) is made
 * of — the original Crumpled Paper look: a sheet with a few large, softly creased
 * facets (a jittered triangle mesh), lit by a slowly orbiting light, with faint
 * crease lines along some facet diagonals.
 *
 * Deterministic for a given size / seed / density. Plain SVG, no filters.
 *
 * Mirror byte-identical in both trees (remotion-video + frontend).
 */
import React from "react";
import { mix, rand } from "../crumpledStyle";
export type Vec3 = [number, number, number];

/** Slowly orbiting light — creases shimmer as the sheet "breathes". */
export const paperLightAt = (seconds: number): Vec3 => {
  // Sweeps further and a little faster, so the creases visibly catch and lose the light.
  const la = 0.9 + Math.sin(seconds * 0.7) * 0.85 + Math.sin(seconds * 0.27 + 1.3) * 0.25;
  const l: Vec3 = [Math.cos(la) * 0.55, -Math.sin(la) * 0.45 - 0.2, 0.75];
  const len = Math.hypot(...l);
  return [l[0] / len, l[1] / len, l[2] / len];
};

/** The sheet's gentle drift: translate(x, y) scale(s) rotate(r deg) about the frame centre. */
export const paperDriftAt = (seconds: number) => ({
  // The paper itself shifts and breathes on the desk (text and notes on top stay put).
  x: Math.sin(seconds * 0.9) * 14 + Math.sin(seconds * 0.37 + 1.1) * 6,
  y: Math.cos(seconds * 0.7) * 10 + Math.sin(seconds * 0.29 + 0.4) * 4,
  // Overscan (≥ 1.045) keeps the sheet's edges off-screen at the largest shift/tilt.
  s: 1.06 + Math.sin(seconds * 0.6) * 0.015,
  r: Math.sin(seconds * 0.5) * 0.7 + Math.sin(seconds * 0.21 + 2.0) * 0.2,
});

/** Where a point of the undrifted sheet lands once the drift is applied (matches the CSS transform). */
export const applyPaperDrift = (x: number, y: number, width: number, height: number, drift: ReturnType<typeof paperDriftAt>): [number, number] => {
  const cx = width / 2;
  const cy = height / 2;
  const t = (drift.r * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return [cx + drift.x + drift.s * (dx * Math.cos(t) - dy * Math.sin(t)), cy + drift.y + drift.s * (dx * Math.sin(t) + dy * Math.cos(t))];
};

/** Overlay (colour + alpha) for one facet of the background paper. */
export const paperFacetShade = (
  n: Vec3,
  light: Vec3,
  depth: number,
  paper: string,
  ink: string,
): { color: string; alpha: number } => {
  const dot = n[0] * light[0] + n[1] * light[1] + n[2] * light[2];
  const delta = (dot - light[2]) * 1.5 * depth;
  return delta >= 0
    ? { color: "#ffffff", alpha: Math.min(0.32, delta * 0.7) }
    : { color: mix(paper, ink, 0.85), alpha: Math.min(0.085, -delta * 0.2) };
};


export interface PaperSurface {
  pts: Vec3[];
  tris: Array<[number, number, number]>;
  /** Faint crease lines along some facet diagonals: [a, b] vertex pairs. */
  creases: Array<[number, number]>;
}

export const buildPaperSurface = (width: number, height: number, seed: number, density: number): PaperSurface => {
  const cols = Math.max(4, Math.round((width / 1920) * density));
  const rows = Math.max(4, Math.round((height / 1080) * density * 0.62));
  const cw = width / cols;
  const ch = height / rows;
  // Vertices: interior points jitter in x/y; every vertex gets a pseudo height (z).
  const pts: Vec3[] = [];
  const id = (r: number, c: number) => r * (cols + 1) + c;
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const edgeX = c === 0 || c === cols;
      const edgeY = r === 0 || r === rows;
      const jx = edgeX ? 0 : (rand(seed + r * 31.7 + c * 7.3) - 0.5) * cw * 0.8;
      const jy = edgeY ? 0 : (rand(seed + r * 13.1 + c * 17.9) - 0.5) * ch * 0.8;
      const z = (rand(seed * 1.7 + r * 5.9 + c * 11.3) - 0.5) * Math.min(cw, ch) * 0.75;
      pts.push([c * cw + jx, r * ch + jy, z]);
    }
  }
  const tris: PaperSurface["tris"] = [];
  const creases: PaperSurface["creases"] = [];
  let cell = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = id(r, c);
      const b = id(r, c + 1);
      const d = id(r + 1, c);
      const e = id(r + 1, c + 1);
      const flip = rand(seed + r * 3.3 + c * 9.1) > 0.5;
      if (flip) tris.push([a, b, e], [a, e, d]);
      else tris.push([a, b, d], [b, e, d]);
      // The diagonal of some cells reads as a crease line.
      if (rand(seed + cell * 4.7) > 0.45) creases.push(flip ? [a, e] : [b, d]);
      cell++;
    }
  }
  return { pts, tris, creases };
};

const minus = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const normalOf = (a: Vec3, b: Vec3, c: Vec3): Vec3 => {
  const u = minus(b, a);
  const w = minus(c, a);
  let n: Vec3 = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  if (n[2] < 0) n = [-n[0], -n[1], -n[2]];
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / len, n[1] / len, n[2] / len];
};

/** Normals are fixed per surface — compute once and reuse every frame. */
export const surfaceNormals = (s: PaperSurface): Vec3[] => s.tris.map(([a, b, c]) => normalOf(s.pts[a], s.pts[b], s.pts[c]));

/** The paper's facets + faint crease lines, as SVG elements (no <svg> wrapper). */
export const PaperCreases: React.FC<{
  surface: PaperSurface;
  normals: Vec3[];
  light: Vec3;
  paper: string;
  ink: string;
  depth: number;
}> = ({ surface, normals, light, paper, ink, depth }) => {
  const shadowInk = mix(paper, ink, 0.85);
  const p = surface.pts;
  return (
    <g>
      {surface.tris.map((t, i) => {
        const { color, alpha } = paperFacetShade(normals[i], light, depth, paper, ink);
        const points = t.map((v) => `${p[v][0].toFixed(1)},${p[v][1].toFixed(1)}`).join(" ");
        return <polygon key={i} points={points} fill={color} opacity={alpha} />;
      })}
      <g stroke={shadowInk} strokeWidth={1.1} strokeLinecap="round" fill="none" opacity={0.09 * depth}>
        {surface.creases.map(([a, b], i) => (
          <path key={i} d={`M${p[a][0].toFixed(1)} ${p[a][1].toFixed(1)} L${p[b][0].toFixed(1)} ${p[b][1].toFixed(1)}`} />
        ))}
      </g>
    </g>
  );
};
