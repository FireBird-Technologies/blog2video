/**
 * Closing — a pencilled thank-you note: brand name, the closing line, website
 * links in sketched boxes, and social icons in doodled circles. In the final
 * stretch the page folds into a paper airplane and is thrown off (built in, below).
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneLayoutProps } from "../types";
import { PaperBackdrop, PaperGrainContext } from "../components/PaperBackdrop";
import { FitText } from "../components/FitText";
import { PencilLayer, PencilStroke, doodleStarPath, scribbleCirclePath, sketchBoxPath, underlinePath } from "../components/Pencil";
import { Written, ease } from "../components/Handwriting";
import { useCrumpledScene, scenePaper } from "../components/sceneKit";
import { getCrumpledTypography } from "../typography";
import { resolveEnabledSocials, SOCIAL_ICONS } from "../../SocialIcons";
import { clamp, mix, withOpacity, CRUMPLED_DESK } from "../crumpledStyle";

const readable = (value?: string) =>
  (value || "").trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
const isEnabled = (value: boolean | string | undefined) =>
  value === undefined || value === true || String(value).toLowerCase() === "true";

// ─── Exit: paper airplane ─────────────────────────────────────────────────────

/**
 * The exit: the page — with the scene on it — folds into a paper airplane and is thrown.
 *
 * Worked in a canonical frame: the long axis `u` runs to the nose (u = L), the short
 * axis `v` across it (centre line v = c = S/2). Landscape: nose points right;
 * portrait: nose points up.
 *
 *   (all of 1–2 happen together as ONE fold)
 *   1. both corners fold to the centre line and, overlapping,
 *      both new edges fold to the centre again → a flat dart;
 *   2. in 3D the dart folds in half along the centre line (the keel) while the wings
 *      fold back out along creases running from the nose to the tail, and the plane
 *      rolls to a three-quarter view: two long wings meeting at the keel;
 *   3. the plane zooms out WHILE it folds;
 *   4. a small wind-up, then it is thrown nose-first off screen.
 *
 * Every fold is a 2D fold: a piece of paper is scaled by cos(angle) along the normal
 * of its crease (a reflection once complete), so it foreshortens toward the crease,
 * shows the scene while its front faces you and the plain back of the paper once it
 * has turned over (folded flaps stay plain, so no stray scraps of the scene). Pieces are clipped in the
 * unfolded page's coordinates and carry the chain of folds that move them.
 *
 */
type Pt = [number, number];
/** CSS matrix(a, b, c, d, e, f): x' = a·x + c·y + e, y' = b·x + d·y + f. */
type M = [number, number, number, number, number, number];

const ID: M = [1, 0, 0, 1, 0, 0];
/** A ∘ B (B applied first). */
const compose = (A: M, B: M): M => [
  A[0] * B[0] + A[2] * B[1],
  A[1] * B[0] + A[3] * B[1],
  A[0] * B[2] + A[2] * B[3],
  A[1] * B[2] + A[3] * B[3],
  A[0] * B[4] + A[2] * B[5] + A[4],
  A[1] * B[4] + A[3] * B[5] + A[5],
];
/** Scale by k along the normal of the crease P→Q, keeping the crease fixed. */
const foldM = (P: Pt, Q: Pt, k: number): M => {
  const dx = Q[0] - P[0];
  const dy = Q[1] - P[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const s = k - 1;
  const a = 1 + s * nx * nx;
  const b = s * nx * ny;
  const d = 1 + s * ny * ny;
  return [a, b, b, d, P[0] - (a * P[0] + b * P[1]), P[1] - (b * P[0] + d * P[1])];
};
const css = (m: M) => `matrix(${m.map((x) => x.toFixed(4)).join(", ")})`;
const poly = (pts: Pt[]) => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const phase = (p: number, a: number, b: number) => inOut(seg(p, a, b));

type Fold = { m: M; k: number; p: number };

const AirplaneFold: React.FC<{
  /** 0 → flat page, 1 → plane thrown out of frame. */
  progress: number;
  paper: string;
  ink: string;
  children: React.ReactNode;
}> = ({ progress: p, paper, ink, children }) => {
  const { width: w, height: h } = useVideoConfig();

  if (p <= 0) {
    // Untouched page: the scene, rendered once, in the same tree slot it keeps while folding.
    return (
      <AbsoluteFill>
        <AbsoluteFill>{children}</AbsoluteFill>
      </AbsoluteFill>
    );
  }

  const landscape = w >= h;
  const L = landscape ? w : h;
  const S = landscape ? h : w;
  const c = S / 2;
  const t = Math.SQRT2 - 1; // tan 22.5°: the second folds bisect the 45° nose
  const q = Math.max(0, L - c / t); // where the second creases meet the long edges
  /** Canonical (u, v) → screen (x, y). */
  const at = (u: number, v: number): Pt => (landscape ? [u, v] : [v, L - u]);
  const pts = (uv: Pt[]) => uv.map(([u, v]) => at(u, v));
  const mirror = (uv: Pt[]): Pt[] => uv.map(([u, v]) => [u, S - v]);

  // Phase progress.
  // ONE fold: the corner folds, the edge folds and the 3D keel/wing fold all run
  // together in a single overlapping motion, with the zoom-out alongside.
  // One overall ease drives the whole fold — it starts moving at once and only slows
  // as the plane settles; the steps overlap with gentle curves inside it, so the
  // motion never stalls between them.
  const fold = 1 - Math.pow(1 - seg(p, 0, 0.54), 2);
  const smooth = (a: number, b: number) => {
    const x = seg(fold, a, b);
    return x * x * (3 - 2 * x);
  };
  const p1 = smooth(0, 0.62);
  const p2 = p1;
  const p3 = smooth(0.12, 0.8);
  const p4 = p3;
  const f3d = smooth(0.24, 1); // keel + wings + three-quarter view
  const zoom = fold;
  const throwT = seg(p, 0.5, 1); // the wind-up starts as the plane settles — no hold

  const N = at(L, c);
  const F1: Fold = { m: foldM(at(L - c, 0), N, Math.cos(Math.PI * p1)), k: Math.cos(Math.PI * p1), p: p1 };
  const F2: Fold = { m: foldM(at(L - c, S), N, Math.cos(Math.PI * p2)), k: Math.cos(Math.PI * p2), p: p2 };
  const F3: Fold = { m: foldM(at(q, 0), N, Math.cos(Math.PI * p3)), k: Math.cos(Math.PI * p3), p: p3 };
  const F4: Fold = { m: foldM(at(q, S), N, Math.cos(Math.PI * p4)), k: Math.cos(Math.PI * p4), p: p4 };

  // Pieces of the unfolded page (canonical coords).
  const main: Pt[] = [[0, 0], [q, 0], [L, c], [q, S], [0, S]];
  const P3: Pt[] = [[q, 0], [L - c, 0], [L, c]]; // moved by the second top fold only
  const R1a: Pt[] = [[L - c, 0], [L - t * c, 0], [L, c]]; // first flap, part caught by the second fold
  const R1b: Pt[] = [[L - t * c, 0], [L, 0], [L, c]]; // first flap, part left inside
  const back = mix(paper, ink, 0.07);
  const backFill = `linear-gradient(135deg, ${mix(back, "#ffffff", 0.35)} 0%, ${back} 55%, ${mix(back, ink, 0.1)} 100%)`;

  const piece = (key: string, uv: Pt[], chain: Fold[]) => {
    const moved = chain.filter((f) => f.p > 0);
    const m = moved.reduce<M>((acc, f) => compose(f.m, acc), ID);
    // Shows the scene until it first turns over; folded flaps show the plain back.
    const front = moved.every((f) => f.k >= 0);
    const shade = Math.min(0.32, moved.reduce((s, f) => s + 0.26 * Math.sin(Math.PI * f.p), 0));
    const clip = poly(pts(uv));
    const lifted = moved.length > 0;
    return (
      <AbsoluteFill
        key={key}
        style={{
          transform: lifted ? css(m) : undefined,
          transformOrigin: "0 0",
          filter: lifted ? "drop-shadow(0 2px 4px rgba(0,0,0,0.16))" : undefined,
        }}
      >
        {front ? (
          <AbsoluteFill style={{ clipPath: clip }}>{children}</AbsoluteFill>
        ) : (
          <AbsoluteFill style={{ clipPath: clip, background: backFill }} />
        )}
        {shade > 0.002 ? <AbsoluteFill style={{ clipPath: clip, background: withOpacity(ink, shade) }} /> : null}
      </AbsoluteFill>
    );
  };

  // Each second fold carries its stack; once it turns over the stack order flips.
  const group = (key: string, pageUV: Pt[], flapUV: Pt[], first: Fold, second: Fold) => {
    const pg = piece(`${key}-page`, pageUV, [second]);
    const fl = piece(`${key}-flap`, flapUV, [first, second]);
    return second.k >= 0 ? [pg, fl] : [fl, pg];
  };

  const dart = (
    <>
      {piece("main", main, [])}
      {piece("r1b", R1b, [F1])}
      {piece("r2b", mirror(R1b), [F2])}
      {group("top", P3, R1a, F1, F3)}
      {group("bottom", mirror(P3), mirror(R1a), F2, F4)}
    </>
  );
  // Only the pieces on one side of the centre line — each wing draws just its own.
  const dartSide = (sd: -1 | 1) =>
    sd < 0 ? (
      <>
        {piece("main", main, [])}
        {piece("r1b", R1b, [F1])}
        {group("top", P3, R1a, F1, F3)}
      </>
    ) : (
      <>
        {piece("main", main, [])}
        {piece("r2b", mirror(R1b), [F2])}
        {group("bottom", mirror(P3), mirror(R1a), F2, F4)}
      </>
    );

  // ─── 3D finish: keel + wings, like a real dart plane ───
  // Each half of the dart splits along a wing crease (nose → a point on the tail):
  // the strip next to the centre line becomes the keel, the rest the wing. The keel
  // halves fold up toward the viewer about the centre line (fold in half), each wing
  // folds back out about its crease (ending with a slight upward dihedral), and the
  // plane rolls to a three-quarter view. The 3D maths is done here and each flat
  // panel is drawn with its orthographic 2D projection, back to front — so it does
  // not depend on the browser's 3D compositing.
  // As it folds, the dart is shaped into a slim plane: the wing crease moves out to
  // the long edge (wing ≈ 9× longer than its tail width) and the leading edge runs
  // straight from the nose to a small kink near the tail. Matching vertices → plain lerp.
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  // The plane's shape stops short of fully closed: the wings stay fairly wide and
  // the keel shows as a strip between them (the view, light and shadow still finish).
  const shapeT = 0.88 * f3d;
  const cw = lerp(c * 0.58, Math.min(c * 0.7, L / 9), shapeT); // wing crease at the tail, from the long edge
  const kinkU = lerp(q, L * 0.11, shapeT); // where the leading edge meets the long edge
  const unit = (A: Pt, B: Pt): Pt => {
    const ex = B[0] - A[0];
    const ey = B[1] - A[1];
    const l = Math.hypot(ex, ey) || 1;
    return [ex / l, ey / l];
  };
  type V3 = [number, number, number];
  type A3 = { m: [V3, V3, V3]; t: V3 }; // p' = m·p + t (rows of m)
  /** Rotation by `deg` about the in-plane axis through A with direction k (z toward the viewer). */
  const rot = (A: Pt, k: Pt, deg: number): A3 => {
    const r = (deg * Math.PI) / 180;
    const C = Math.cos(r);
    const Sn = Math.sin(r);
    const [kx, ky] = k;
    const m: [V3, V3, V3] = [
      [C + kx * kx * (1 - C), kx * ky * (1 - C), ky * Sn],
      [ky * kx * (1 - C), C + ky * ky * (1 - C), -kx * Sn],
      [-ky * Sn, kx * Sn, C],
    ];
    const t: V3 = [
      A[0] - (m[0][0] * A[0] + m[0][1] * A[1]),
      A[1] - (m[1][0] * A[0] + m[1][1] * A[1]),
      -(m[2][0] * A[0] + m[2][1] * A[1]),
    ];
    return { m, t };
  };
  /** X ∘ Y (Y applied first). */
  const then = (X: A3, Y: A3): A3 => {
    const m = [0, 1, 2].map((i) => [0, 1, 2].map((j) => X.m[i][0] * Y.m[0][j] + X.m[i][1] * Y.m[1][j] + X.m[i][2] * Y.m[2][j])) as [V3, V3, V3];
    const t = [0, 1, 2].map((i) => X.m[i][0] * Y.t[0] + X.m[i][1] * Y.t[1] + X.m[i][2] * Y.t[2] + X.t[i]) as V3;
    return { m, t };
  };
  const keelAxis = unit(at(0, c), N);
  const K = 90 * shapeT;
  const W = 76 * shapeT; // net 14° dihedral: wings almost flat, a shallow V
  const centre = at(L / 2, c);
  // Three-quarter view: roll about the long axis so the lower wing comes toward you
  // and the upper one recedes, and pitch the nose away from the camera.
  const viewT = then(rot(centre, [-keelAxis[1], keelAxis[0]], 22 * f3d), rot(centre, keelAxis, -25 * f3d));
  type Panel = { key: string; uv: Pt[]; T: A3; z: number; facing: number; keel: boolean; sd: -1 | 1 };
  type Edge = { a: Pt; b: Pt; T: A3 };
  const creases: Edge[] = [];
  const rims: Edge[] = [];
  const panels: Panel[] = [];
  for (const sd of [-1, 1] as const) {
    const m = (uv: Pt[]): Pt[] => (sd < 0 ? uv : mirror(uv));
    const [creaseTail, creaseNose] = m([[0, cw], [L, c]]).map(([u, v]) => at(u, v));
    const keelT = rot(at(0, c), keelAxis, sd * K); // fold in half: toward the viewer
    const wingT = then(keelT, rot(creaseTail, unit(creaseTail, creaseNose), -sd * W)); // wings back out
    const add = (key: string, uv: Pt[], local: A3, keel: boolean) => {
      const T = then(viewT, local);
      const P = pts(uv);
      const cx = P.reduce((acc, q2) => acc + q2[0], 0) / P.length;
      const cy = P.reduce((acc, q2) => acc + q2[1], 0) / P.length;
      panels.push({ key, uv, T, z: T.m[2][0] * cx + T.m[2][1] * cy + T.t[2], facing: T.m[2][2], keel, sd });
    };
    add(`keel${sd}`, m([[L, c], [0, cw], [0, c]]), keelT, true);
    const wing = m([[0, 0], [kinkU, 0], [L, c], [0, cw]]);
    add(`wing${sd}`, wing, wingT, false);
    const [tip, kink, , root] = wing.map(([u, v]) => at(u, v));
    creases.push({ a: root, b: N, T: then(viewT, wingT) });
    rims.push({ a: root, b: tip, T: then(viewT, wingT) }, { a: tip, b: kink, T: then(viewT, wingT) });
  }
  panels.sort((A, B) => A.z - B.z); // far first
  // Perspective: each flat panel gets a projective matrix3d (camera on the axis
  // through the plane's centre at distance D), so near parts are larger than far ones.
  const D = Math.max(w, h) * 1.25;
  const persp = (T: A3): string => {
    const row = (i: number): [number, number, number, number] => [T.m[i][0], T.m[i][1], T.m[i][2], T.t[i]];
    const [X, Y, Z] = [row(0), row(1), row(2)];
    const r0 = X.map((x, j) => x - (centre[0] / D) * Z[j]);
    const r1 = Y.map((y, j) => y - (centre[1] / D) * Z[j]);
    const r3 = Z.map((z, j) => (j === 3 ? 1 : 0) - z / D);
    const cols = [0, 1, 2, 3].flatMap((j) => [r0[j], r1[j], Z[j], r3[j]]);
    return `matrix3d(${cols.map((x) => x.toFixed(6)).join(", ")})`;
  };
  /** Screen position of flat point P under T, with the same perspective as `persp`. */
  const project = (T: A3, P: Pt): Pt => {
    const X = T.m[0][0] * P[0] + T.m[0][1] * P[1] + T.t[0];
    const Y = T.m[1][0] * P[0] + T.m[1][1] * P[1] + T.t[1];
    const Z = T.m[2][0] * P[0] + T.m[2][1] * P[1] + T.t[2];
    const k = D / (D - Z);
    return [centre[0] + (X - centre[0]) * k, centre[1] + (Y - centre[1]) * k];
  };
  // Light from in front and across the wings (toward the near wing), so one wing is
  // lit and the other falls into shade; each face is lit by its real angle to it.
  const light: V3 = landscape ? [0.12, 0.52, 0.85] : [0.52, -0.12, 0.85];
  const drawPanel = ({ key, uv, T, facing, keel, sd }: Panel) => {
    const clip = poly(pts(uv));
    const front = facing > 0 && !keel; // the keel folds out of sight: plain paper, no scene copy
    const sgn = facing >= 0 ? 1 : -1; // the side you are looking at
    const lit = sgn * (T.m[0][2] * light[0] + T.m[1][2] * light[1] + T.m[2][2] * light[2]);
    // Soft, like white paper under a broad light: at most ~12% shade on a wing.
    const shade = f3d * Math.min(0.12, Math.max(0, 0.18 - lit * 0.2)) + (keel ? 0.1 * f3d : 0);
    const glow = f3d * Math.max(0, lit - 0.8) * 0.8;
    return (
      <AbsoluteFill key={key} style={{ transform: persp(T), transformOrigin: "0 0 0" }}>
        <AbsoluteFill style={{ clipPath: clip, background: front ? undefined : backFill }}>
          {front ? dartSide(sd) : null}
          {shade > 0.002 ? <AbsoluteFill style={{ background: withOpacity(ink, shade) }} /> : null}
          {glow > 0.002 ? <AbsoluteFill style={{ background: withOpacity("#ffffff", glow) }} /> : null}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  };
  // A soft shadow cast on the desk, falling away from the plane as it lifts.
  const drawShadow = ({ key, uv, T }: Panel) => (
    <AbsoluteFill
      key={`sh-${key}`}
      style={{
        transform: `matrix(${[T.m[0][0], T.m[1][0], T.m[0][1], T.m[1][1], T.t[0], T.t[1]].map((x) => x.toFixed(4)).join(", ")})`,
        transformOrigin: "0 0",
      }}
    >
      <AbsoluteFill style={{ clipPath: poly(pts(uv)), background: ink }} />
    </AbsoluteFill>
  );

  // Zoom out, wind up, throw along the nose with a little lift.
  const nose: Pt = landscape ? [1, 0] : [0, -1];
  const lift: Pt = landscape ? [0, -1] : [1, 0];
  const windup = Math.sin(Math.PI * seg(throwT, 0, 0.25)) * L * 0.05;
  const fly = Math.pow(seg(throwT, 0.12, 0.95), 1.35);
  const along = -windup + fly * Math.max(w, h) * 1.5;
  const up = Math.sin((Math.PI / 2) * fly) * S * 0.22;
  // The slim plane sits low and back in the frame; re-centre it as it forms (landscape).
  const dx = nose[0] * along + lift[0] * up + (landscape ? L * 0.04 * f3d : 0);
  const dy = nose[1] * along + lift[1] * up - (landscape ? S * 0.12 * f3d : 0);
  const tilt = (landscape ? -1 : 1) * (f3d * 3 + fly * 8 - windup / L * 40); // nearly level, like a resting plane
  const scale = (1 - 0.32 * zoom) * (1 - 0.35 * fly);
  const desk = CRUMPLED_DESK;

  return (
    // Many copies of the scene are drawn while it folds: skip the paper's noise grain.
    <PaperGrainContext.Provider value={false}>
    <AbsoluteFill style={{ background: desk }}>
      <AbsoluteFill
        style={{
          transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${tilt.toFixed(2)}deg) scale(${scale.toFixed(4)})`,
          transformOrigin: "50% 50%",
          filter: `drop-shadow(0 ${(12 + 26 * zoom).toFixed(1)}px ${(20 + 18 * zoom).toFixed(1)}px rgba(0,0,0,${(0.24 * (1 - f3d)).toFixed(3)}))`,
        }}
      >
        {f3d > 0 ? (
          <>
            {/* Shadow on the desk: a wide soft one and a tight contact one under the keel. */}
            {[
              { off: 0.2, blur: 34, alpha: 0.24 },
              { off: 0.1, blur: 9, alpha: 0.3 },
            ].map(({ off, blur, alpha }, i) => (
              <AbsoluteFill
                key={`shadow-${i}`}
                style={{
                  transform: `translate(${(S * off * 0.25 * f3d + fly * S * 0.12).toFixed(1)}px, ${(S * off * f3d + fly * S * 0.32).toFixed(1)}px) scale(${(0.97 - 0.05 * fly).toFixed(3)})`,
                  transformOrigin: "50% 50%",
                  opacity: alpha * f3d * (1 - 0.7 * fly),
                  filter: `blur(${(blur * (0.6 + 0.4 * f3d) + 30 * fly).toFixed(1)}px)`,
                }}
              >
                {panels.map(drawShadow)}
              </AbsoluteFill>
            ))}
            <AbsoluteFill>{panels.map(drawPanel)}</AbsoluteFill>
            {/* Paper thickness along the tail edges and wing tips, and the centre crease. */}
            <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible", opacity: f3d }}>
              {rims.map(({ a, b, T }, i) => {
                const [p0, p1] = [project(T, a), project(T, b)];
                return (
                  <line key={`rim-${i}`} x1={p0[0]} y1={p0[1] + 2.5} x2={p1[0]} y2={p1[1] + 2.5} stroke={mix(paper, ink, 0.28)} strokeWidth={3} strokeLinecap="round" opacity={0.75} />
                );
              })}
              {creases.map(({ a, b, T }, i) => {
                const [p0, p1] = [project(T, a), project(T, b)];
                return (
                  <g key={`crease-${i}`}>
                    <line x1={p0[0]} y1={p0[1]} x2={p1[0]} y2={p1[1]} stroke={mix(ink, "#7f8aa3", 0.5)} strokeWidth={3} strokeLinecap="round" opacity={0.45} />
                    <line x1={p0[0]} y1={p0[1] + 2} x2={p1[0]} y2={p1[1] + 2} stroke="#ffffff" strokeWidth={1.2} strokeLinecap="round" opacity={0.7} />
                  </g>
                );
              })}
            </svg>
          </>
        ) : (
          <AbsoluteFill>{dart}</AbsoluteFill>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
    </PaperGrainContext.Provider>
  );
};

export const EndingSocials: React.FC<SceneLayoutProps> = (props) => {
  const { frame, width, height, fps, portrait, pal, font, pad } = useCrumpledScene(props);
  const p = portrait;
  // Default sizes — must match backend/templates/crumpled/meta.json; Template Studio rewrites these literals.
  const type = getCrumpledTypography(props, (titleFontSize, descriptionFontSize) => ({
    title: titleFontSize ?? (p ? 110 : 94),
    body: descriptionFontSize ?? (p ? 67 : 55),
  }));
  const rawFrame = useCurrentFrame();
  const seed = props.seed ?? 42;
  const sheet = scenePaper(props, seed, 0);
  const brand = (props.brandName || "").trim();
  const tagline = (props.tagline || props.title || props.narration || "").trim();

  const ctas = (props.ctas?.length
    ? props.ctas
    : [{ ctaButtonText: props.ctaButtonText, websiteLink: props.websiteLink, showWebsiteButton: props.showWebsiteButton }])
    .filter((c) => isEnabled(c.showWebsiteButton) && Boolean(c.websiteLink?.trim()))
    .slice(0, 3)
    .map((c) => ({ dest: readable(c.websiteLink), label: (c.ctaButtonText || "").trim() }));
  const socials = resolveEnabledSocials(props.socials).map(({ key, item }) => ({
    key: String(key),
    Icon: SOCIAL_ICONS[key],
    label: String(item.label || item.text || item.url || key).trim(),
  }));

  const brandIn = ease(frame, 0, 22);
  const tagIn = ease(frame, 12, 60, Easing.inOut(Easing.quad));
  const ctaIn = ease(frame, 56, 84);
  const socialsIn = ease(frame, 76, 130, Easing.linear);
  const doodles = ease(frame, 60, 100);

  const contentW = width - pad.x * 2;
  // Primary: tagline ← title slider, CTA link ← body slider. Brand + socials are secondary.
  const brandSize = type.bodyRelative(portrait ? 46 : 40);
  const tagSize = type.title;
  const ctaSize = type.body;
  const ctaLabelSize = ctaSize * 0.7;
  const socialSize = type.bodyRelative(portrait ? 34 : 30);

  const tagTop = portrait ? height * 0.17 : height * 0.13;
  const tagH = portrait ? height * 0.26 : height * 0.3;
  const ctaTop = tagTop + tagH + (portrait ? 70 : 50);
  const ctaBoxW = Math.min(contentW * (portrait ? 0.9 : 0.5), portrait ? 860 : 820);
  const ctaBoxH = ctaSize * 1.6 + (ctas.some((c) => c.label) ? ctaLabelSize * 1.4 : 0);
  const ctaGap = 34;
  const ctaBlockH = ctas.length ? ctas.length * ctaBoxH + (ctas.length - 1) * ctaGap : 0;

  const shell = portrait ? 104 : 92;
  const perRow = portrait ? Math.min(socials.length, 4) : Math.min(socials.length, 7);
  const rowsS = perRow ? Math.ceil(socials.length / perRow) : 0;
  const slotW = portrait ? contentW / Math.max(1, perRow) : Math.min(230, contentW / Math.max(1, perRow));
  const socialsTop = Math.min(ctaTop + ctaBlockH + (ctas.length ? (portrait ? 90 : 60) : 0), height - pad.bottom - rowsS * (shell + socialSize * 2.2));

  // In the final stretch the page folds into a paper airplane, zooms out and is
  // thrown (raw frame, so it tracks the real scene end).
  const total = props.sceneDurationInFrames ?? 300;
  const planeLen = Math.round(Math.min(fps * 2, total * 0.55)); // the last 2 seconds
  const plane = interpolate(rawFrame, [total - planeLen, total - 2], [0, 1], clamp);

  return (
    <AirplaneFold progress={plane} paper={pal.paper} ink={pal.ink}>
    <AbsoluteFill style={{ fontFamily: font, color: pal.ink, overflow: "hidden" }}>
      <PaperBackdrop paper={pal.paper} ink={pal.ink} seed={sheet.seed} orientation={sheet.orientation} density={9} depth={sheet.depth} />

      {brand ? (
        <div style={{ position: "absolute", left: pad.x, top: pad.top, width: contentW, textAlign: "center", opacity: brandIn }}>
          <FitText
            targetPx={brandSize}
            minPx={portrait ? 28 : 24}
            maxHeightPx={brandSize * 1.4}
            maxWidthPx={contentW}
            fitKey={`es-brand:${brand}:${portrait}`}
            exact={false}
            style={{ fontWeight: 700, letterSpacing: "0.06em", color: pal.accent, whiteSpace: "nowrap" }}
          >
            {brand}
          </FitText>
        </div>
      ) : null}

      {tagline ? (
        <div style={{ position: "absolute", left: pad.x, top: tagTop, width: contentW, height: tagH, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <Written progress={tagIn} style={{ width: "100%" }}>
            <FitText
              targetPx={tagSize}
              minPx={portrait ? 48 : 40}
              maxHeightPx={tagH}
              maxWidthPx={contentW * (portrait ? 1 : 0.82)}
              fitKey={`es-tag:${tagline}:${portrait}`}
              exact={type.titleIsUserSet}
              style={{ fontWeight: 700, lineHeight: 1.02, margin: "0 auto" }}
            >
              {tagline}
            </FitText>
          </Written>
        </div>
      ) : null}

      {ctas.map((c, i) => {
        const x = (width - ctaBoxW) / 2;
        const y = ctaTop + i * (ctaBoxH + ctaGap);
        const on = interpolate(ctaIn, [i * 0.15, Math.min(1, i * 0.15 + 0.6)], [0, 1], clamp);
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: ctaBoxW, height: ctaBoxH, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: on, background: withOpacity(mix(pal.paper, "#ffffff", 0.6), 0.85) }}>
            <FitText targetPx={ctaSize} minPx={portrait ? 30 : 26} maxHeightPx={ctaSize * 1.3} maxWidthPx={ctaBoxW - 60} fitKey={`es-cta:${c.dest}:${portrait}`} exact={type.bodyIsUserSet} style={{ fontWeight: 700, whiteSpace: "nowrap", textAlign: "center" }}>
              → {c.dest}
            </FitText>
            {c.label ? (
              <FitText targetPx={ctaLabelSize} minPx={22} maxHeightPx={ctaLabelSize * 1.3} maxWidthPx={ctaBoxW - 60} fitKey={`es-ctal:${c.label}:${portrait}`} exact={false} style={{ fontWeight: 500, color: pal.inkSoft, whiteSpace: "nowrap", textAlign: "center" }}>
                {c.label}
              </FitText>
            ) : null}
          </div>
        );
      })}

      {socials.map(({ key, Icon, label }, i) => {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        const inRow = Math.min(perRow, socials.length - row * perRow);
        const x = width / 2 - (inRow * slotW) / 2 + (col + 0.5) * slotW;
        const y = socialsTop + row * (shell + socialSize * 2.4);
        const on = interpolate(socialsIn, [i * 0.08, Math.min(1, i * 0.08 + 0.4)], [0, 1], clamp);
        return (
          <div key={key} style={{ position: "absolute", left: x - slotW / 2, top: y, width: slotW, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity: on, transform: `translateY(${(1 - on) * 14}px)` }}>
            <div style={{ width: shell, height: shell, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {Icon ? <Icon size={shell * 0.56} /> : null}
            </div>
            <FitText targetPx={socialSize} minPx={20} maxHeightPx={socialSize * 1.3} maxWidthPx={slotW - 12} fitKey={`es-soc:${label}:${portrait}:${perRow}`} exact={false} style={{ fontWeight: 600, whiteSpace: "nowrap", textAlign: "center", color: pal.inkSoft }}>
              {label}
            </FitText>
          </div>
        );
      })}

      <PencilLayer>
        {tagline ? (
          <PencilStroke d={underlinePath(width / 2 - Math.min(300, contentW * 0.25), tagTop + tagH * 0.5 + Math.min(tagH, tagSize * 2.1) * 0.5 + 18, Math.min(600, contentW * 0.5), seed)} progress={ease(frame, 54, 76)} color={pal.accent} width={6} />
        ) : null}
        {ctas.map((_, i) => {
          const x = (width - ctaBoxW) / 2;
          const y = ctaTop + i * (ctaBoxH + ctaGap);
          return <PencilStroke key={i} d={sketchBoxPath(x, y, ctaBoxW, ctaBoxH, seed + i * 5)} progress={interpolate(ctaIn, [i * 0.15, Math.min(1, i * 0.15 + 0.6)], [0, 1], clamp)} color={pal.ink} width={3.5} />;
        })}
        {socials.map((s, i) => {
          const row = Math.floor(i / perRow);
          const col = i % perRow;
          const inRow = Math.min(perRow, socials.length - row * perRow);
          const x = width / 2 - (inRow * slotW) / 2 + (col + 0.5) * slotW;
          const y = socialsTop + row * (shell + socialSize * 2.4) + shell / 2;
          return <PencilStroke key={s.key} d={scribbleCirclePath(x, y, shell * 0.52, shell * 0.5, seed + i * 3)} progress={interpolate(socialsIn, [i * 0.08 + 0.05, Math.min(1, i * 0.08 + 0.45)], [0, 1], clamp)} color={pal.ink} width={3} opacity={0.7} />;
        })}
        <PencilStroke d={doodleStarPath(pad.x + 40, tagTop + 30, portrait ? 30 : 28, seed)} progress={doodles} color={pal.accent} width={3.5} opacity={0.8} />
        <PencilStroke d={doodleStarPath(width - pad.x - 40, tagTop + tagH - 30, portrait ? 24 : 22, seed + 3)} progress={doodles} color={pal.ink} width={3} opacity={0.6} />
      </PencilLayer>

    </AbsoluteFill>
    </AirplaneFold>
  );
};
