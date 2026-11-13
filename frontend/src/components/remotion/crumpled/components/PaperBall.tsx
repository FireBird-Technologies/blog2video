/**
 * The crumpled paper of the opening — ONE object from start to finish.
 *
 * Crumpled, it is a small faceted 3D mesh: a jagged silhouette (sheet corners and
 * torn tabs poking out), three inner rings lifted onto a sphere and pushed in/out
 * by crumple noise, crisp sheet edges and crease lines. Opening (`open` 0 → 1),
 * every vertex travels from its place on the ball to its place on a full-frame
 * sheet — the rim leading, the middle following — while the crumples flatten into
 * gentle creases, so the ball itself unfolds into the page. When open it IS the
 * scene's background: same subtle facet shading, orbiting light, drift, paper
 * grain and vignette as <PaperBackdrop>. Facets are depth-sorted while opening and
 * flipped facets show the back of the paper.
 *
 * Plain SVG polygons — the only filters are the static grain layers.
 *
 * Mirror byte-identical in both trees (remotion-video + frontend).
 */
import React, { useId, useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { mix, rand, withOpacity, type PaperPalette, PAPER_SHADE } from "../crumpledStyle";
import { PaperCreases, applyPaperDrift, buildPaperSurface, paperDriftAt, paperLightAt, surfaceNormals } from "./paperSurface";

type V3 = [number, number, number];

interface Mesh {
  verts: V3[];
  /** Ring fraction per vertex (1 = rim, 0 = centre). */
  ring: number[];
  /** Crumple noise per vertex — becomes the opened sheet's gentle crease height. */
  crease: number[];
  /** Flat direction jitter per vertex (unit-free), so opened creases aren't radial. */
  jitter: Array<[number, number]>;
  outline: number[];
  tris: Array<[number, number, number]>;
  edges: Array<[number, number, number, number]>;
  /** Layered sheet edges: polylines of vertex indices from the rim inward. */
  sheetEdges: number[][];
}

const RINGS: Array<{ n: number; r: number }> = [
  { n: 30, r: 1 },
  { n: 16, r: 0.66 },
  { n: 8, r: 0.35 },
];

const buildMesh = (seed: number): Mesh => {
  const verts: V3[] = [];
  const ring: number[] = [];
  const crease: number[] = [];
  const jitter: Array<[number, number]> = [];
  const ringIdx: number[][] = [];
  RINGS.forEach(({ n, r }, ri) => {
    const ids: number[] = [];
    const phase = rand(seed + ri * 13.1) * Math.PI;
    for (let i = 0; i < n; i++) {
      const a = phase + (i / n) * Math.PI * 2 + (rand(seed + ri * 31 + i * 2.3) - 0.5) * (Math.PI / n) * (ri === 0 ? 1.1 : 1.8);
      let rr = r * (ri === 0 ? 0.88 + rand(seed + ri * 17 + i * 5.1) * 0.12 : 0.78 + rand(seed + ri * 17 + i * 5.1) * 0.42);
      if (ri === 0) {
        // Sheet corners and torn tabs poking out; the odd tucked-in notch.
        const k = rand(seed + 200 + i * 3.3);
        if (k > 0.74) rr += 0.12 + rand(seed + 300 + i) * 0.14;
        else if (k < 0.18) rr -= 0.08;
      }
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      const d = Math.min(0.98, Math.hypot(x, y) / 1.18);
      const bulge = Math.sqrt(1 - d * d) * 0.95;
      const crumple = (rand(seed + 500 + ri * 41 + i * 7.7) - 0.5) * (ri === 0 ? 0.25 : 0.6);
      ids.push(verts.length);
      verts.push([x, y, bulge + crumple]);
      ring.push(r);
      crease.push(rand(seed + 800 + ri * 23 + i * 3.9) - 0.5);
      jitter.push(ri === 0 ? [0, 0] : [(rand(seed + 1900 + ri * 7 + i * 1.7) - 0.5) * 0.18, (rand(seed + 2000 + ri * 7 + i * 2.9) - 0.5) * 0.18]);
    }
    ringIdx.push(ids);
  });
  const apex = verts.length;
  verts.push([(rand(seed + 900) - 0.5) * 0.16, (rand(seed + 901) - 0.5) * 0.16, 0.95 + (rand(seed + 902) - 0.5) * 0.3]);
  ring.push(0);
  crease.push(rand(seed + 903) - 0.5);
  jitter.push([(rand(seed + 904) - 0.5) * 0.1, (rand(seed + 905) - 0.5) * 0.1]);

  const angle = (i: number) => Math.atan2(verts[i][1], verts[i][0]);
  const tris: Mesh["tris"] = [];
  // Stitch an outer ring A to an inner ring B, walking both by angle.
  const stitch = (A: number[], B: number[]) => {
    const a0 = angle(A[0]);
    const rel = (i: number) => {
      let v = angle(i) - a0;
      while (v < 0) v += Math.PI * 2;
      while (v >= Math.PI * 2) v -= Math.PI * 2;
      return v;
    };
    const sortedB = [...B].sort((p, q) => rel(p) - rel(q));
    const Bseq = [sortedB[sortedB.length - 1], ...sortedB];
    const bAt = (k: number) => (k === 0 ? rel(Bseq[0]) - Math.PI * 2 : rel(Bseq[k]));
    const Aseq = [...A].sort((p, q) => rel(p) - rel(q));
    const aAt = (k: number) => (k >= Aseq.length ? Math.PI * 2 : rel(Aseq[k]));
    let i = 0;
    let j = 0;
    while (i < Aseq.length || j < Bseq.length - 1) {
      const nextA = i < Aseq.length ? aAt(i + 1) : Infinity;
      const nextB = j < Bseq.length - 1 ? bAt(j + 1) : Infinity;
      if (nextA <= nextB) {
        tris.push([Aseq[i], Aseq[(i + 1) % Aseq.length], Bseq[j]]);
        i++;
      } else {
        tris.push([Aseq[i % Aseq.length], Bseq[j + 1], Bseq[j]]);
        j++;
      }
    }
  };
  stitch(ringIdx[0], ringIdx[1]);
  stitch(ringIdx[1], ringIdx[2]);
  const inner = [...ringIdx[2]].sort((p, q) => angle(p) - angle(q));
  inner.forEach((v, i) => tris.push([v, inner[(i + 1) % inner.length], apex]));

  const edgeMap = new Map<string, number[]>();
  tris.forEach((t, fi) => {
    for (let e = 0; e < 3; e++) {
      const a = t[e];
      const b = t[(e + 1) % 3];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      const list = edgeMap.get(key) ?? [];
      list.push(fi);
      edgeMap.set(key, list);
    }
  });
  const edges: Mesh["edges"] = [];
  edgeMap.forEach((faces, key) => {
    if (faces.length === 2) {
      const [a, b] = key.split("-").map(Number);
      edges.push([a, b, faces[0], faces[1]]);
    }
  });

  // Layered sheet edges: start at a rim vertex, wander inward through the rings.
  const outline = [...ringIdx[0]].sort((p, q) => angle(p) - angle(q));
  const mid = [...ringIdx[1]].sort((p, q) => angle(p) - angle(q));
  const nearestBy = (from: number, pool: number[], bias: number) =>
    pool.reduce((best, v) => {
      const d = Math.abs(Math.atan2(Math.sin(angle(v) - angle(from) - bias), Math.cos(angle(v) - angle(from) - bias)));
      const bd = Math.abs(Math.atan2(Math.sin(angle(best) - angle(from) - bias), Math.cos(angle(best) - angle(from) - bias)));
      return d < bd ? v : best;
    }, pool[0]);
  const sheetEdges: number[][] = Array.from({ length: 4 }, (_, k) => {
    const start = outline[Math.floor(rand(seed + 1500 + k * 7.1) * outline.length)];
    const bias = (rand(seed + 1600 + k * 3.7) - 0.5) * 1.2;
    const m = nearestBy(start, mid, bias);
    const path = [start, m];
    if (rand(seed + 1700 + k) > 0.45) path.push(nearestBy(m, inner, bias * 0.6));
    return path;
  });

  return { verts, ring, crease, jitter, outline, tris, edges, sheetEdges };
};

const minus = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalOf = (a: V3, b: V3, c: V3): V3 => {
  const u = minus(b, a);
  const v = minus(c, a);
  let n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  if (n[2] < 0) n = [-n[0], -n[1], -n[2]];
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / len, n[1] / len, n[2] / len];
};

/** Point on a rectangle's perimeter in the direction of (x, y). */
const toRect = (x: number, y: number, halfW: number, halfH: number): [number, number] => {
  const a = Math.atan2(y, x);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const t = Math.min(halfW / Math.max(1e-6, Math.abs(c)), halfH / Math.max(1e-6, Math.abs(s)));
  return [c * t, s * t];
};

/** Peak lead of the rim over the middle (mid-opening). */
const LEAD = 0.3;

const meshCache = new Map<number, Mesh>();
const meshFor = (seed: number) => {
  let m = meshCache.get(seed);
  if (!m) {
    m = buildMesh(seed);
    meshCache.set(seed, m);
  }
  return m;
};

/** Every vertex of the paper at opening progress `o` (0 = ball, 1 = flat page). */
const ballPoints = (
  mesh: Mesh,
  o: number,
  cx: number,
  cy: number,
  r: number,
  rotation: number,
  width: number,
  height: number,
  drift: ReturnType<typeof paperDriftAt>,
): V3[] => {
  const t = (rotation * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  // The opened sheet overshoots the frame so its rim (and corners) sit off-screen.
  const halfW = (width / 2) * 1.2;
  const halfH = (height / 2) * 1.2;
  const creasePx = Math.min(width, height) * 0.1;
  return mesh.verts.map(([x, y, z], k) => {
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    const ballX = cx + rx * r;
    const ballY = cy + ry * r;
    // Flat target: same direction, at this ring's share of the sheet (+ a little jitter).
    const frac = mesh.ring[k];
    const [ex, ey] = toRect(x, y, halfW, halfH);
    const [jx, jy] = mesh.jitter[k];
    const [fx, fy] = applyPaperDrift(width / 2 + ex * frac + jx * width, height / 2 + ey * frac + jy * height, width, height, drift);
    // The rim leads, the middle follows; zero offset at both ends.
    const p = Math.max(0, Math.min(1, o + LEAD * (frac - 0.5) * 2 * 4 * o * (1 - o)));
    const zBall = z * r * 1.1;
    const zFlat = mesh.crease[k] * creasePx;
    return [ballX + (fx - ballX) * p, ballY + (fy - ballY) * p, zBall * Math.pow(1 - p, 2) + zFlat * p];
  });
};

/**
 * The paper's silhouette at opening progress `open`, as a CSS `polygon(...)` —
 * lets a transition clip a scene to the exact shape of the crumpling sheet.
 */
export const paperBallOutline = (
  open: number,
  cx: number,
  cy: number,
  r: number,
  rotation: number,
  width: number,
  height: number,
  seconds: number,
  seed = 42,
): string => {
  const mesh = meshFor(seed);
  const pts = ballPoints(mesh, Math.max(0, Math.min(1, open)), cx, cy, r, rotation, width, height, paperDriftAt(seconds));
  return `polygon(${mesh.outline.map((i) => `${pts[i][0].toFixed(1)}px ${pts[i][1].toFixed(1)}px`).join(", ")})`;
};

export const PaperBall: React.FC<{
  /** 0 = crumpled ball, 1 = opened flat across the frame (the scene background). */
  open?: number;
  cx: number;
  cy: number;
  r: number;
  /** In-plane tumble of the ball, degrees. */
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  palette: PaperPalette;
  seed?: number;
  /** Crease depth / density of the opened sheet (same as the other scenes' PaperBackdrop). */
  depth?: number;
  density?: number;
  /** Crease-pattern facing, as PaperBackdrop's `orientation` — pass the scene's so the opened sheet IS its backdrop. */
  orientation?: 0 | 1 | 2 | 3;
}> = ({ open = 0, cx, cy, r, rotation = 0, scaleX = 1, scaleY = 1, palette, seed = 42, depth = 1.15, density = 10, orientation = 0 }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const uid = useId().replace(/:/g, "");
  const mesh = meshFor(seed);
  const { surface, surfNormals } = useMemo(() => {
    const s = buildPaperSurface(width, height, seed, density);
    return { surface: s, surfNormals: surfaceNormals(s) };
  }, [width, height, seed, density]);
  const o = Math.max(0, Math.min(1, open));
  const seconds = frame / fps;
  const light = paperLightAt(seconds);
  const drift = paperDriftAt(seconds);

  const pts = ballPoints(mesh, o, cx, cy, r, rotation, width, height, drift);

  const normals = mesh.tris.map(([a, b, c]) => normalOf(pts[a], pts[b], pts[c]));
  const order = mesh.tris
    .map((tri, i) => ({ i, z: (pts[tri[0]][2] + pts[tri[1]][2] + pts[tri[2]][2]) / 3 }))
    .sort((a, b) => a.z - b.z);
  const signedArea = (tri: number[]) => {
    const [a, b, c] = tri.map((i) => pts[i]);
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  };

  // Crumpled shading eases into the background's exact facet shading as it lands.
  const land = Math.max(0, Math.min(1, (o - 0.5) / 0.5));
  const landK = land * land * (3 - 2 * land);
  const shadowFill = mix(palette.paper, PAPER_SHADE, 0.5);
  const backFill = mix(palette.paper, PAPER_SHADE, 0.1);
  const fmt = (ids: number[]) => ids.map((i) => `${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}`).join(" ");
  const line = (ids: number[]) => ids.map((i, k) => `${k === 0 ? "M" : "L"}${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`).join(" ");
  const outline = fmt(mesh.outline);
  const lw = Math.max(0.8, r * 0.012) * (1 + o);

  return (
    <svg
      width={width}
      height={height}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "visible",
        transformOrigin: `${cx}px ${cy + r}px`,
        transform: `scale(${scaleX}, ${scaleY})`,
      }}
    >
      <defs>
        <clipPath id={`${uid}-clip`}>
          <polygon points={outline} />
        </clipPath>
        <radialGradient id={`${uid}-ao`} gradientUnits="userSpaceOnUse" cx={cx - r * 0.25} cy={cy - r * 0.3} r={r * 1.5}>
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.3} />
          <stop offset="55%" stopColor={PAPER_SHADE} stopOpacity={0} />
          <stop offset="100%" stopColor={PAPER_SHADE} stopOpacity={0.28} />
        </radialGradient>
        <filter id={`${uid}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.05" />
        </filter>
        <filter id={`${uid}-fibre`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.06" numOctaves="3" seed={seed + 3} />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.25" />
        </filter>
        <radialGradient id={`${uid}-vig`} cx="50%" cy="48%" r="75%">
          <stop offset="55%" stopColor={mix(palette.paper, PAPER_SHADE, 0.85)} stopOpacity="0" />
          <stop offset="100%" stopColor={mix(palette.paper, PAPER_SHADE, 0.85)} stopOpacity="0.16" />
        </radialGradient>
      </defs>

      <polygon points={outline} fill={palette.paper} />
      <g clipPath={`url(#${uid}-clip)`}>
        {order.map(({ i }) => {
          const n = normals[i];
          const base = signedArea(mesh.tris[i]) < 0 ? backFill : palette.paper;
          const delta = dot(n, light) - light[2];
          const crumple = delta > 0 ? mix(base, "#ffffff", Math.min(0.75, delta * 2)) : mix(base, shadowFill, Math.min(0.55, -delta * 1.2));
          // The ball's coarse facets relax to plain paper; the page's own crumpled
          // surface (drawn over them below) takes over the creasing.
          const fill = landK <= 0 ? crumple : landK >= 1 ? base : mix(crumple, base, landK);
          return <polygon key={i} points={fmt(mesh.tris[i])} fill={fill} stroke={fill} strokeWidth={0.8} strokeLinejoin="round" />;
        })}

        {/* The ball's crisp creases — they relax away as it opens. */}
        {mesh.edges.map(([a, b, f1, f2], i) => {
          const c = dot(normals[f1], normals[f2]);
          const sharp = Math.min(1, Math.max(0, (0.93 - c) * 2.6));
          const tb = mesh.tris[f2].find((v) => v !== a && v !== b)!;
          const valley = dot(normals[f1], minus(pts[tb], pts[a])) > 0;
          const d = line([a, b]);
          if (valley) {
            const alpha = 0.32 * sharp * (1 - landK);
            return alpha > 0.004 ? <path key={i} d={d} stroke={withOpacity(PAPER_SHADE, alpha)} strokeWidth={lw * 1.1} strokeLinecap="round" /> : null;
          }
          const alpha = 0.55 * sharp * (1 - landK);
          return alpha > 0.004 ? <path key={i} d={d} stroke={withOpacity("#ffffff", alpha)} strokeWidth={lw * 1.3} strokeLinecap="round" /> : null;
        })}

        {/* The opened page's crumpled surface — the same paper's creases — growing in as
            the coarse ball facets relax. Drawn in the page's drifting frame. */}
        {o > 0.3 ? (
          <g
            opacity={Math.min(1, (o - 0.3) / 0.55)}
            transform={`translate(${width / 2 + drift.x} ${height / 2 + drift.y}) rotate(${drift.r}) scale(${drift.s}) translate(${-width / 2} ${-height / 2})`}
          >
            <g transform={orientation ? `translate(${width / 2} ${height / 2}) scale(${orientation & 1 ? -1 : 1} ${orientation & 2 ? -1 : 1}) translate(${-width / 2} ${-height / 2})` : undefined}>
              <PaperCreases surface={surface} normals={surfNormals} light={light} paper={palette.paper} ink={PAPER_SHADE} depth={depth} />
            </g>
          </g>
        ) : null}

        {/* Layered sheet edges folding over the ball — they smooth out as it opens. */}
        {o < 0.6
          ? mesh.sheetEdges.map((ids, i) => (
              <g key={`se${i}`} opacity={1 - o / 0.6}>
                <path d={line(ids)} stroke={withOpacity(PAPER_SHADE, 0.24)} strokeWidth={lw * 1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" transform={`translate(${lw} ${lw * 1.2})`} />
                <path d={line(ids)} stroke={withOpacity("#ffffff", 0.85)} strokeWidth={lw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            ))
          : null}

        {/* Rounding of the ball — gone once it has opened. */}
        {o < 0.12 ? <rect x={0} y={0} width={width} height={height} fill={`url(#${uid}-ao)`} opacity={1 - o / 0.12} /> : null}

        {/* The page's tooth, fibres and vignette arrive as it opens. */}
        {o > 0.05 ? (
          <g opacity={Math.min(1, (o - 0.05) / 0.6)}>
            <rect width={width} height={height} filter={`url(#${uid}-grain)`} opacity={0.07} />
            <rect width={width} height={height} filter={`url(#${uid}-fibre)`} opacity={0.05} />
            <rect width={width} height={height} fill={`url(#${uid}-vig)`} />
          </g>
        ) : null}
      </g>

      {/* The sheet's own edge. */}
      <polygon points={outline} fill="none" stroke={withOpacity(PAPER_SHADE, 0.36)} strokeWidth={lw} strokeLinejoin="round" />
    </svg>
  );
};
