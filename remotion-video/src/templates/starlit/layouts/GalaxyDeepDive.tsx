import React, {useId, useMemo} from "react";
import {AbsoluteFill, Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {SpaceBackdrop} from "../components/SpaceBackdrop";
import {FitText} from "../components/FitText";
import type {SceneLayoutProps} from "../types";
import {getStarlitFontFamily, getStarlitTypography} from "../typography";
import { mixTheme, withOpacity } from "../components/themeColor";

const clamp = {extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const};
const clean = (value?: string) => (value || "").replace(/\s+/g, " ").trim();
const seeded = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = Easing.inOut(Easing.cubic);
/** The seven branch-star shades (and the centre star) are all derived from the scene's accent, text and background
 * colours: the accent itself, lighter tints toward the text colour and deeper shades toward the background. */
const branchShades = (accent: string, text: string, bg: string) => [
  accent,
  mixTheme(accent, text, .22),
  mixTheme(accent, bg, .25),
  mixTheme(accent, text, .45),
  mixTheme(accent, bg, .4),
  mixTheme(accent, text, .65),
  mixTheme(accent, text, .1),
];

const wrap = (value: string, max: number, maxLines = 3) => {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    if (line && `${line} ${word}`.length > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  });
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/[\s.,;:]*$/, "") + "...";
    return kept;
  }
  return lines;
};

// Three drifting star layers, as in the Notestack Mind Constellation explorer.
const LAYERS = [
  {n: 90, parallax: .012, r: [.35, .8], op: .45},
  {n: 50, parallax: .035, r: [.6, 1.3], op: .7},
  {n: 16, parallax: .085, r: [1.2, 2.2], op: .95},
];

/** The four Notestack map shapes. The shape is chosen in the editor (`mapStyle`); it is never random. */
export const DEEP_DIVE_STYLES = ["orbit", "spiral", "figure", "cluster"] as const;
const SHAPE_SEED = 7; // fixed, so a given scene always draws the same map
type MapStyle = (typeof DEEP_DIVE_STYLES)[number];
type P = {x: number; y: number};
type Kid = {label: string; text: string};
type Branch = {label: string; explanation: string; kids: Kid[]; start: number; p: P; index: number};
type Edge = {a: P; b: P; to: number; faint?: boolean};

const brief = (value: string, max = 90) => {
  const v = clean(value);
  if (v.length <= max) return v;
  return v.slice(0, max).replace(/\s+\S*$/, "").replace(/[\s.,;:]+$/, "") + "…";
};

/** Place the branch stars for a style around the centre (all in the 1920x1080 / 1080x1920 canvas). */
const layoutBranches = (style: MapStyle, n: number, seed: number, c: P, rx: number, ry: number, portrait = false): {pts: P[]; edges: [number, number][]; ring: boolean} => {
  const r = (k: number) => seeded(seed * 7.13 + k);
  const gap = Math.min(300, (Math.min(rx, ry) * 2.1) / Math.sqrt(Math.max(n, 1)));
  let pts: P[] = [];
  if (style === "orbit") {
    const start = -Math.PI / 2 + (r(1) - .5) * .25;
    pts = Array.from({length: n}, (_, i) => {
      const a = start + (2 * Math.PI * i) / n;
      return {x: c.x + Math.cos(a) * rx, y: c.y + Math.sin(a) * ry};
    });
    return {pts, edges: pts.map((_, i) => [-1, i] as [number, number]), ring: true};
  }
  if (style === "spiral") {
    const start = -Math.PI / 2;
    pts = Array.from({length: n}, (_, i) => {
      const a = start + i * .95;
      const frac = n > 1 ? .5 + (.5 * i) / (n - 1) : .8;
      return {x: c.x + Math.cos(a) * rx * frac, y: c.y + Math.sin(a) * ry * frac};
    });
  } else if (style === "figure") {
    const sweep = pts.length;
    const raw = Array.from({length: n}, (_, i) => {
      const t = n > 1 ? -1.1 + (2.2 * i) / (n - 1) : 0;
      const rad = .85 + r(10 + i) * .45;
      return {x: Math.sin(t) * rad, y: -Math.cos(t) * rad + .55};
    });
    const mx = raw.reduce((m, q) => m + q.x, 0) / n;
    const my = raw.reduce((m, q) => m + q.y, 0) / n;
    const rot = r(2) * Math.PI * 2;
    const turned = raw.map((q) => ({x: (q.x - mx) * Math.cos(rot) - (q.y - my) * Math.sin(rot), y: (q.x - mx) * Math.sin(rot) + (q.y - my) * Math.cos(rot)}));
    const ex = Math.max(.001, ...turned.map((q) => Math.abs(q.x)));
    const ey = Math.max(.001, ...turned.map((q) => Math.abs(q.y)));
    pts = turned.map((q) => ({x: c.x + (q.x / ex) * rx, y: c.y + (q.y / ey) * ry}));
    void sweep;
  } else {
    for (let i = 0; i < n; i++) {
      let best: P = {x: c.x + rx, y: c.y};
      for (let t = 0; t < 300; t++) {
        const a = r(100 + i * 300 + t) * Math.PI * 2;
        const d = Math.sqrt(r(101 + i * 300 + t));
        const q = {x: c.x + Math.cos(a) * d * rx, y: c.y + Math.sin(a) * d * ry};
        best = q;
        if (Math.hypot(q.x - c.x, q.y - c.y) >= Math.min(rx, ry) * (portrait ? .7 : .55) && pts.every((o) => Math.hypot(o.x - q.x, o.y - q.y) >= gap * .9)) break;
      }
      pts.push(best);
    }
  }
  // push apart anything too close, and keep clear of the centre
  for (let it = 0; it < 160; it++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < gap) {
          const push = (gap - d) / 2;
          pts[i] = {x: pts[i].x - (dx / d) * push, y: pts[i].y - (dy / d) * push};
          pts[j] = {x: pts[j].x + (dx / d) * push, y: pts[j].y + (dy / d) * push};
        }
      }
    }
    pts = pts.map((q) => {
      const dx = q.x - c.x, dy = q.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      const min = Math.min(rx, ry) * (portrait ? .66 : .5);
      return d < min ? {x: c.x + (dx / d) * min, y: c.y + (dy / d) * min} : q;
    });
  }
  const near = pts.map((q, i) => ({i, d: Math.hypot(q.x - c.x, q.y - c.y)})).sort((a, b) => a.d - b.d);
  const edges: [number, number][] = [];
  if (style === "spiral") {
    if (n > 0) edges.push([-1, 0]);
    for (let i = 1; i < n; i++) edges.push([i - 1, i]);
  } else if (style === "figure") {
    for (let i = 1; i < n; i++) edges.push([i - 1, i]);
    near.slice(0, 2).forEach((q) => edges.push([-1, q.i]));
    near.slice(2).forEach((q) => edges.push([-2, q.i])); // faint spokes keep the figure tied to the centre
  } else {
    // cluster: a minimum spanning tree over the centre and every branch (Prim)
    const inTree: number[] = [-1];
    const rest = pts.map((_, i) => i);
    const at = (i: number) => (i === -1 ? c : pts[i]);
    while (rest.length) {
      let best: {from: number; to: number; d: number} | null = null;
      for (const q of rest) for (const f of inTree) {
        const d = Math.hypot(at(q).x - at(f).x, at(q).y - at(f).y);
        if (!best || d < best.d) best = {from: f, to: q, d};
      }
      edges.push([best!.from, best!.to]);
      inTree.push(best!.to);
      rest.splice(rest.indexOf(best!.to), 1);
    }
  }
  return {pts, edges, ring: false};
};

/** Mind constellation: the whole map first, then a zoom into the centre theme, then one branch with a brief
 * explanation and its reference image. Each video gets a different map shape (orbit, figure, cluster). */
export const GalaxyDeepDive: React.FC<SceneLayoutProps> = (props) => {
  const thTxt = props.textColor || "#ffffff"; const thBg = props.bgColor || "#000000"; const thAcc = props.accentColor || "#217cff"; const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const uid = useId().replace(/:/g, "");
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const portrait = props.aspectRatio === "portrait" || height > width;
  const W = portrait ? 1080 : 1920;
  const H = portrait ? 1920 : 1080;
  const seconds = frame / fps;
  const font = getStarlitFontFamily(props);
  const type = getStarlitTypography(props, portrait);
  const duration = Math.max(120, props.sceneDurationInFrames ?? 240);
  // Unhurried build (x1.4 of the original brisk timings), eased back toward 1 on short scenes so the branch still lands before the scene ends.
  const pace = Math.min(1.4, Math.max(1, (duration - 45) / 78));
  const heading = clean(props.heading || props.title);
  const accent = props.accentColor || "#217cff";
  const text = props.textColor || "#ffffff";
  const seed = props.seed ?? 42; // backdrop stars only
  const mapStyle: MapStyle = (DEEP_DIVE_STYLES as readonly string[]).includes(String(props.mapStyle)) ? (props.mapStyle as MapStyle) : "figure";

  const SHADES = branchShades(thAcc, thTxt, thBg);
  const CORE = thPale;
  const accentOf = (branch: number) => (branch < 0 ? CORE : SHADES[branch % SHADES.length]);
  const R0 = portrait ? 40 : 36;
  const R1 = portrait ? 22 : 20;
  const FS0 = type.titleIsUserSet ? type.title : type.titleRelative(portrait ? 36 : 30);
  const FS1 = type.bodyIsUserSet ? type.body : type.bodyRelative(portrait ? 38 : 32);

  const c: P = {x: W / 2, y: H / 2};
  const {branches, edges, ring, rx, ry} = useMemo(() => {
    const supplied = (props.nodes || []).filter((node) => clean(node.label));
    const items = supplied.length
      ? supplied.slice(0, 8).map((node) => ({
          label: clean(node.label),
          explanation: brief(node.value || node.sublabel || ""),
          kids: (node.children || []).map((k): Kid => typeof k === "string" ? {label: clean(k), text: ""} : {label: clean(k?.label), text: brief(clean(k?.text), portrait ? 150 : 90)}).filter((k) => k.label).slice(0, 3),
        }))
      : (props.items?.length ? props.items : []).slice(0, 8).map((label) => ({label: clean(label), explanation: "", kids: [] as Kid[]})).filter((it) => it.label);
    const rx = portrait ? 440 : 700;
    const ry = portrait ? 780 : 390;
    const laid = layoutBranches(mapStyle, items.length, SHAPE_SEED, c, rx, ry, portrait);
    const mx = portrait ? 150 : 190, top = portrait ? 150 : 120, bottom = portrait ? 230 : 190;
    laid.pts = laid.pts.map((q) => ({x: Math.max(mx, Math.min(W - mx, q.x)), y: Math.max(top, Math.min(H - bottom, q.y))}));
    const list: Branch[] = items.map((it, i) => ({...it, index: i, p: laid.pts[i], start: Math.round((8 + i * 3) * pace)}));
    const links: Edge[] = laid.edges.map(([a, b]) => ({a: a === -1 || a === -2 ? c : laid.pts[a], b: laid.pts[b], to: b, faint: a === -2}));
    return {branches: list, edges: links, ring: laid.ring, rx, ry};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.items, props.nodes, mapStyle, portrait, pace]);

  // The one branch we dive into: the first with an explanation, else the first.
  const firstWith = (test: (b: Branch) => boolean) => branches.findIndex(test);
  const focusIdx = Math.max(0, firstWith((b) => b.kids.length > 0) >= 0 ? firstWith((b) => b.kids.length > 0) : firstWith((b) => Boolean(b.explanation)));
  const fb = branches[focusIdx] ?? {label: "", explanation: "", kids: [], start: 0, p: c, index: 0}; // no branches supplied: the centre theme only
  const hasImage = false; // images are no longer attached to the zoomed branch
  const side = fb.p.x >= c.x ? 1 : -1;
  const CARD_W = portrait ? 420 : 380;
  const IMG_H = portrait ? 236 : 210;
  const cardX = portrait ? fb.p.x - CARD_W / 2 : side > 0 ? fb.p.x + 150 : fb.p.x - 150 - CARD_W;
  const cardY = portrait ? fb.p.y + 175 : fb.p.y - (hasImage ? 150 : 40);
  const textY = cardY + (hasImage ? IMG_H + 18 : 0);
  // The zoomed branch fans out into 2-3 child stars, each with a short title and text.
  const kids = fb.kids;
  const kidW = portrait ? 400 : 330;
  const kidR = R1 * .72;
  const away = Math.atan2(fb.p.y - c.y, fb.p.x - c.x);
  const dirY = fb.p.y >= c.y ? 1 : -1;
  const kidPts: P[] = kids.map((_, j) => {
    if (portrait) return {x: fb.p.x + (kids.length === 1 ? 0 : j % 2 === 0 ? -130 : 130), y: fb.p.y + dirY * (230 + j * 300)};
    const spread = kids.length === 1 ? 0 : kids.length === 2 ? 1.15 : 1.0;
    const a = away + (j - (kids.length - 1) / 2) * spread;
    return {x: fb.p.x + Math.cos(a) * 360, y: fb.p.y + Math.sin(a) * 290};
  });
  const groupPts = [fb.p, ...kidPts];
  const gx = groupPts.reduce((m, q) => m + q.x, 0) / groupPts.length;
  const gy = groupPts.reduce((m, q) => m + q.y, 0) / groupPts.length;

  // Timeline: overview (still) -> zoom to the centre theme -> fly to one branch -> its explanation.
  const D = duration;
  // Fixed, brisk timings (frames at 30fps) so it feels quick at any scene length.
  const tOver = Math.round(30 * pace);                      // the map is built almost at once
  const tRoot = tOver + Math.round(17 * pace);              // zoom in on the centre theme
  const tBranch0 = tRoot + Math.round(10 * pace);
  const tBranch = tBranch0 + Math.round(21 * pace);         // fly to the one branch
  const tOut0 = Math.min(tBranch + Math.round(52 * pace), Math.round(D * .6)); // a ~1.7s look at the explanation, then pull back // brief look at the explanation, then pull back
  const tOut1 = Math.min(D - 18, tOut0 + 27);
  const camOverview = {x: c.x, y: c.y, s: 1};
  const camRoot = {x: c.x, y: c.y, s: portrait ? 2.0 : 1.9};
  const camBranch = kids.length > 0
    ? (portrait ? {x: gx, y: gy + dirY * 20, s: 1.12} : {x: gx, y: gy + 40, s: 1.28})
    : portrait
      ? {x: fb.p.x, y: fb.p.y + 250, s: 1.85}
      : {x: fb.p.x + side * 250, y: fb.p.y + 8, s: 2.1};
  const toRoot = smooth(interpolate(frame, [tOver, tRoot], [0, 1], clamp));
  const toBranch = smooth(interpolate(frame, [tBranch0, tBranch], [0, 1], clamp));
  const zoomOut = 0; // it stays on the branch: no zoom back out
  const inward = {
    x: lerp(lerp(camOverview.x, camRoot.x, toRoot), camBranch.x, toBranch),
    y: lerp(lerp(camOverview.y, camRoot.y, toRoot), camBranch.y, toBranch),
    s: lerp(lerp(camOverview.s, camRoot.s, toRoot), camBranch.s, toBranch),
  };
  const cam = {x: lerp(inward.x, camOverview.x, zoomOut), y: lerp(inward.y, camOverview.y, zoomOut), s: lerp(inward.s, camOverview.s, zoomOut)};
  const camTransform = `translate(${c.x - cam.x * cam.s} ${c.y - cam.y * cam.s}) scale(${cam.s})`;
  const zoomed = interpolate(frame, [tOver, tRoot], [0, 1], clamp) * (1 - zoomOut); // 0 = whole map, 1 = zoomed in
  const diveAmt = toBranch * (1 - zoomOut);
  const reveal = interpolate(frame, [tBranch - 6, tBranch + 22], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)}) * (1 - zoomOut);
  const imageIn = interpolate(frame, [tBranch + 6, tBranch + 34], [0, 1], clamp) * (1 - zoomOut);

  const exit = interpolate(frame, [Math.max(0, D - 14), D], [1, 0], clamp);
  const worldOpacity = interpolate(frame, [0, 14], [0, 1], clamp) * exit;

  const stars = useMemo(() => LAYERS.map((layer, li) => Array.from({length: layer.n}, (_, i) => {
    const k = li * 1000 + i;
    return {x: seeded(k + 1) * (W + 160) - 80, y: seeded(k + 501) * (H + 160) - 80, r: layer.r[0] + seeded(k + 901) * (layer.r[1] - layer.r[0]), d: seeded(k + 1301) * 6, blue: seeded(k + 77) > .7};
  })), [W, H]);

  const star = (key: string, x: number, y: number, r: number, color: string, start: number, label: string, fs: number, weight: number, spacing: string | undefined, dim: number, root = false) => {
    const pop = spring({frame: Math.max(0, frame - start), fps, config: {damping: 16, stiffness: 118 / pace}});
    const op = dim * Math.min(1, pop * 1.4);
    const spike = r * (root ? 4.6 : 3.2);
    const lines = wrap(root ? label.toUpperCase() : label, root ? (portrait ? 17 : 22) : portrait ? 13 : 14, 3);
    const pulse = root ? 1 + .06 * (1 - Math.cos((seconds / 5) * Math.PI * 2)) : 1;
    return <g key={key} transform={`translate(${x} ${y}) scale(${Math.max(.001, pop)})`} opacity={op}>
      <circle r={r * (root ? 4 : 3.4) * pulse} fill={`url(#mm-g${root ? SHADES.length : SHADES.indexOf(color)}-${uid})`} opacity=".8" />
      <path d={`M${-spike} 0H${spike}M0 ${-spike}V${spike}`} fill="none" stroke={thTxt} strokeWidth=".9" strokeOpacity=".38" />
      {root ? <>
        <circle r={r * 1.75} fill="none" stroke={thPale} strokeOpacity=".5" strokeWidth="1" strokeDasharray="2 6" transform={`rotate(${(seconds / 90) * 360})`} />
        <circle r={r * 2.4} fill="none" stroke={thPale} strokeOpacity=".2" strokeWidth="1" />
        <circle r={r} fill={`url(#mm-core-${uid})`} />
        <circle r={r * .38} fill={thTxt} />
      </> : <>
        <circle r={r} fill={color} stroke={thTxt} strokeOpacity=".7" strokeWidth="1.5" />
        <circle r={r * .42} fill={thTxt} />
      </>}
      <text textAnchor="middle" fontSize={fs} y={r * 1.35 + fs * 1.15} fill={thTxt} fontFamily={font} fontWeight={weight} letterSpacing={spacing}
        paintOrder="stroke" stroke={thBg} strokeWidth=".22em" strokeLinejoin="round" opacity={Math.min(1, pop) * (root ? 1 - diveAmt : 1)}>
        {lines.map((line, i) => <tspan key={i} x={0} dy={i === 0 ? 0 : fs * 1.14}>{line}</tspan>)}
      </text>
    </g>;
  };

  if (!heading && branches.length === 0) return <AbsoluteFill style={{background: thBg}} />; // no content: render empty

  return <AbsoluteFill style={{background: thBg, overflow: "hidden", fontFamily: font}}>
    <SpaceBackdrop seed={seed} density={portrait ? 120 : 140} brightness={.72} accentColor={accent} backgroundColor={thBg} textColor={text} />
    <div style={{position: "absolute", width: W, height: H, transform: `scale(${width / W}, ${height / H})`, transformOrigin: "top left", overflow: "hidden", opacity: exit}}>
      <div style={{position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 50%, ${withOpacity(accent, .09)} 0%, ${withOpacity(accent, .03)} 25%, transparent 63%)`}} />

      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: "absolute", inset: 0}}>
        <defs>
          <radialGradient id={`mm-core-${uid}`}>
            <stop offset="0%" stopColor={thTxt} />
            <stop offset="30%" stopColor={thPale} />
            <stop offset="65%" stopColor={thMid} stopOpacity=".9" />
            <stop offset="100%" stopColor={thAcc} stopOpacity="0" />
          </radialGradient>
          {[...SHADES, CORE].map((col, i) => <radialGradient key={i} id={`mm-g${i}-${uid}`}>
            <stop offset="0%" stopColor={col} stopOpacity=".95" />
            <stop offset="30%" stopColor={col} stopOpacity=".4" />
            <stop offset="100%" stopColor={col} stopOpacity="0" />
          </radialGradient>)}
        </defs>
        {stars.map((layerStars, li) => {
          const dx = -(cam.x - c.x) * cam.s * LAYERS[li].parallax;
          const dy = -(cam.y - c.y) * cam.s * LAYERS[li].parallax;
          return <g key={li} transform={`translate(${dx} ${dy})`} opacity={worldOpacity}>
            {layerStars.map((st, i) => {
              const twinkle = i % 5 === 0 ? 1 - .73 * Math.pow(Math.sin(((seconds + st.d) / 4) * Math.PI), 2) : 1;
              return <circle key={i} cx={st.x} cy={st.y} r={st.r} fill={st.blue ? thMid : thTxt} opacity={LAYERS[li].op * twinkle * (li === 0 ? .55 : 1)} />;
            })}
          </g>;
        })}
        <g opacity={worldOpacity} transform={camTransform}>
          <circle cx={c.x} cy={c.y} r={Math.max(rx, ry) * 1.25} fill={`url(#mm-g${SHADES.length}-${uid})`} opacity=".2" />
          {ring ? <ellipse cx={c.x} cy={c.y} rx={rx} ry={ry} fill="none" stroke={thMid} strokeOpacity={.28 * (1 - zoomed * .7)} strokeWidth="1.2" /> : null}
          {edges.map((e, idx) => {
            const isFocus = e.to === focusIdx;
            const draw = interpolate(frame, [branches[e.to].start - 12, branches[e.to].start + 8], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
            const opacity = (isFocus ? .9 : lerp(.55, .1, zoomed)) * (e.faint ? .45 : 1);
            const flowing = isFocus && diveAmt > .6;
            return <line key={idx} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y} stroke={accentOf(e.to)} strokeWidth="1.1" strokeLinecap="round" opacity={opacity}
              {...(flowing && draw >= .99 ? {strokeDasharray: "3 8", strokeDashoffset: -(seconds / 1.6) * 22} : {pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - draw})} />;
          })}
          {/* the reference image and text attach to the one branch we dive into */}
          {reveal > 0 && !portrait ? <line x1={fb.p.x + side * R1 * 1.6} y1={fb.p.y} x2={side > 0 ? cardX : cardX + CARD_W} y2={hasImage ? cardY + IMG_H / 2 : textY + 24} stroke={accentOf(focusIdx)} strokeWidth="1.2" strokeOpacity={.7 * reveal} />
            : null}
          {kids.map((k, j) => {
            const kStart = tBranch + 2 + Math.round(j * 11 * pace);
            const dr = interpolate(frame, [kStart - 6, kStart + 12], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
            return <line key={`kl${j}`} x1={fb.p.x} y1={fb.p.y} x2={fb.p.x + (kidPts[j].x - fb.p.x) * dr} y2={fb.p.y + (kidPts[j].y - fb.p.y) * dr} stroke={accentOf(focusIdx)} strokeWidth="1.4" strokeLinecap="round" opacity=".85" />;
          })}
          {kids.map((k, j) => star(`k${j}`, kidPts[j].x, kidPts[j].y, kidR, accentOf(focusIdx), tBranch + 2 + j * 11, "", FS1, 600, undefined, 1))}
          {branches.map((b) => star(`b${b.index}`, b.p.x, b.p.y, R1, accentOf(b.index), b.start, b.label, FS1, 600, undefined, b.index === focusIdx ? 1 : lerp(1, .22, zoomed) * (1 - .8 * diveAmt)))}
          {star("root", c.x, c.y, R0, CORE, 1, heading, FS0 * .82, 700, ".14em", 1, true)}
        </g>
      </svg>

      {/* HTML in world space, so the photo loads reliably and text is crisp at any zoom */}
      <div style={{position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0", transform: `translate(${c.x - cam.x * cam.s}px, ${c.y - cam.y * cam.s}px) scale(${cam.s})`, pointerEvents: "none", opacity: exit}}>
        {hasImage ? <div style={{position: "absolute", left: cardX, top: cardY, width: CARD_W, height: IMG_H, borderRadius: 14, overflow: "hidden", border: `1px solid ${accentOf(focusIdx)}`, boxShadow: `0 0 26px ${withOpacity(accentOf(focusIdx), .33)}`, opacity: imageIn, transform: `translateY(${(1 - imageIn) * 10}px)`}}>
          <Img src={props.imageUrl!} style={{width: "100%", height: "100%", objectFit: "cover", objectPosition: props.imageObjectPosition || "50% 50%"}} />
        </div> : null}
        {kids.map((k, j) => {
          const kStart = tBranch + 2 + Math.round(j * 11 * pace);
          const kin = interpolate(frame, [kStart + 4, kStart + 24], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
          return <div key={`kt${j}`} style={{position: "absolute", left: kidPts[j].x - kidW / 2, top: kidPts[j].y + kidR * 1.6 + 14, width: kidW, textAlign: "center", opacity: kin, transform: `translateY(${(1 - kin) * 10}px)`}}>
            <FitText targetPx={type.bodyIsUserSet ? type.body : type.bodyRelative(portrait ? 36 : 30)} minPx={16} maxHeightPx={portrait ? 92 : 76} maxWidthPx={kidW} fitKey={`galaxy-kid-label:${k.label}:${portrait}`} exact={type.bodyIsUserSet} style={{color: thTxt, fontWeight: 600, lineHeight: 1.12, letterSpacing: "-.01em", textShadow: `0 2px 14px ${thBg}, 0 0 3px ${thBg}`}}>{k.label}</FitText>
            {k.text ? <FitText targetPx={type.bodyIsUserSet ? type.body : type.bodyRelative(portrait ? 19 : 21)} minPx={13} maxHeightPx={portrait ? 124 : 96} maxWidthPx={kidW} fitKey={`galaxy-kid-copy:${k.text}:${portrait}`} exact={type.bodyIsUserSet} style={{color: withOpacity(thTxt,.84), fontWeight: 400, lineHeight: 1.34, marginTop: 10, textShadow: `0 2px 14px ${thBg}, 0 0 3px ${thBg}`}}>{k.text}</FitText> : null}
          </div>;
        })}
        {kids.length === 0 && fb.explanation ? <div style={{position: "absolute", left: cardX, top: textY, width: CARD_W, opacity: reveal, transform: `translateY(${(1 - reveal) * 10}px)`}}>
          <FitText targetPx={type.bodyIsUserSet ? type.body : type.bodyRelative(portrait ? 26 : 22)} minPx={14} maxHeightPx={portrait ? 180 : 126} maxWidthPx={CARD_W} fitKey={`galaxy-explanation:${fb.explanation}:${portrait}`} exact={type.bodyIsUserSet} style={{color: withOpacity(thTxt,.84), fontWeight: 400, lineHeight: 1.38, textShadow: `0 1px 12px ${thBg}`}}>{fb.explanation}</FitText>
        </div> : null}
      </div>
    </div>
  </AbsoluteFill>;
};
