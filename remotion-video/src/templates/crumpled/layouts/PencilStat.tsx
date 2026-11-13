/**
 * Numbers layout — the title in pencil at the top; under it, 1 to 3 stats stacked on
 * the left (each counts up in big pencil numerals with a small accent-pencil circle
 * scribbled tightly round it) and one body text explaining them on the right.
 *
 * Exit (built in, last frames): the page rolls up from its top-right corner, and the roll keeps
 * rolling — without stopping — across the page and off past the bottom-left corner.
 * Entry (built in, first frames): the exact reverse — the roll comes in from the bottom-left and
 * unrolls the page up to the top-right corner.
 */
import React from "react";
import { AbsoluteFill, Easing, continueRender, delayRender, interpolate, useCurrentFrame } from "remotion";
import type { SceneLayoutProps } from "../types";
import { PaperBackdrop } from "../components/PaperBackdrop";
import { FitText } from "../components/FitText";
import { useFitText } from "../components/useFitText";
import { PencilLayer, PencilStroke, scribbleCirclePath } from "../components/Pencil";
import { Written, ease } from "../components/Handwriting";
import { useCrumpledScene, scenePaper } from "../components/sceneKit";
import { getCrumpledTypography } from "../typography";
import { clamp, mix, withOpacity, CRUMPLED_DESK, PAPER_SHADE } from "../crumpledStyle";

/** "2.5M" → {prefix:"", value:2.5, decimals:1, rest:"M"}; non-numeric → null. */
const parseStat = (raw: string) => {
  const m = raw.trim().match(/^([^\d-]*)(-?\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  const value = Number(m[2].replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  const decimals = (m[2].split(".")[1] || "").length;
  return { prefix: m[1], value, decimals, rest: m[3], grouped: m[2].includes(",") };
};

const formatCount = (value: number, decimals: number, grouped: boolean) => {
  const fixed = value.toFixed(decimals);
  if (!grouped) return fixed;
  const [i, d] = fixed.split(".");
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (d ? `.${d}` : "");
};

interface StatItem {
  value: string;
  label: string;
}

/** 1–3 stats: `stats` if given, else the legacy single statValue/statSuffix/descriptor. */
const resolveStats = (props: SceneLayoutProps): StatItem[] => {
  const list = Array.isArray(props.stats)
    ? props.stats
        .map((s) => ({ value: String(s?.value ?? "").trim(), label: String(s?.label ?? "").trim() }))
        .filter((s) => s.value)
        .slice(0, 3)
    : [];
  if (list.length) return list;
  const value = `${String(props.statValue ?? "").trim() || "—"}${(props.statSuffix || "").trim()}`;
  return [{ value, label: (props.descriptor || props.narration || "").trim() }];
};

// ─── Transitions: corner fold + drag ────────────────────────────

/**
 * Entry and exit are a "spec" applied to ONE fixed wrapper tree around the scene, so
 * the layout never remounts when they run; idle → every style is empty.
 */
interface Spec {
  outer?: React.CSSProperties;
  mid?: React.CSSProperties;
  inner?: React.CSSProperties;
  midOverlay?: React.ReactNode;
}

type V = [number, number];
const pts = (list: V[]) => list.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ");
const easeInOut = Easing.inOut(Easing.cubic);
const seg = (t: number, a: number, b: number, e = easeInOut) => interpolate(t, [a, b], [0, 1], { ...clamp, easing: e });

/** Sutherland–Hodgman: keep the part of `poly` where s(p) >= 0 (keep) or <= 0 (!keep). */
const clipHalf = (poly: V[], s: (p: V) => number, keep: boolean): V[] => {
  const inside = (p: V) => (keep ? s(p) >= 0 : s(p) <= 0);
  const out: V[] = [];
  poly.forEach((cur, i) => {
    const prev = poly[(i + poly.length - 1) % poly.length];
    const a = inside(prev);
    const b = inside(cur);
    if (a !== b) {
      const sa = s(prev);
      const sb = s(cur);
      const k = sa / (sa - sb);
      out.push([prev[0] + (cur[0] - prev[0]) * k, prev[1] + (cur[1] - prev[1]) * k]);
    }
    if (b) out.push(cur);
  });
  return out;
};

/**
 * The page rolling up from its top-right corner toward the bottom-left. `d` is how far
 * the roll has travelled along the diagonal (0 = flat page; past the bottom-left
 * corner = the whole page is rolled up and the roll has left the frame). Everything
 * on the corner side of the roll is gone (wound into it); the roll is a paper tube
 * lying across the page, thickening as more paper winds on, shaded like a cylinder.
 */
const rollUp = (d: number, w: number, h: number, paper: string): Spec => {
  const D = Math.hypot(w, h);
  const u: V = [-w / D, h / D]; // top-right → bottom-left
  const v: V = [h / D, w / D]; // along the roll
  const C: V = [w, 0];
  const s = (p: V) => (p[0] - C[0]) * u[0] + (p[1] - C[1]) * u[1] - d; // < 0 on the rolled-up side
  const page: V[] = [[0, 0], [w, 0], [w, h], [0, h]];
  const unit = Math.min(w, h);
  const wound = Math.min(d, D);
  const dia = unit * 0.05 + Math.sqrt(wound) * unit * 0.0024;
  const front = d <= 0.5 ? page : clipHalf(page, s, true);
  // The roll spans the page along the fold line (clamped to where paper was); centred
  // just on the rolled side so it sits on the edge of the flat page.
  const lineCentre: V = [C[0] + u[0] * (d - dia * 0.35), C[1] + u[1] * (d - dia * 0.35)];
  const along = (k: number): V => [lineCentre[0] + v[0] * k, lineCentre[1] + v[1] * k];
  // Half-length of the fold line inside the page at this d (where it crosses the edges).
  const reach = (() => {
    const lim: number[] = [];
    // solve lineCentre + v*k on x = 0, x = w, y = 0, y = h; keep the inner pair
    const ks = [(0 - lineCentre[0]) / v[0], (w - lineCentre[0]) / v[0], (0 - lineCentre[1]) / v[1], (h - lineCentre[1]) / v[1]];
    const lo = Math.max(Math.min(ks[0], ks[1]), Math.min(ks[2], ks[3]));
    const hi = Math.min(Math.max(ks[0], ks[1]), Math.max(ks[2], ks[3]));
    lim.push(lo, hi);
    return lim;
  })();
  const [k0, k1] = reach;
  const hasRoll = d > 0.5 && k1 > k0;
  const half = dia / 2;
  const A = along(k0 - half * 0.2);
  const B = along(k1 + half * 0.2);
  const tube: V[] = [
    [A[0] - u[0] * half, A[1] - u[1] * half],
    [B[0] - u[0] * half, B[1] - u[1] * half],
    [B[0] + u[0] * half, B[1] + u[1] * half],
    [A[0] + u[0] * half, A[1] + u[1] * half],
  ];
  const g0: V = [lineCentre[0] - u[0] * half, lineCentre[1] - u[1] * half];
  const g1: V = [lineCentre[0] + u[0] * half, lineCentre[1] + u[1] * half];
  const shade = mix(paper, PAPER_SHADE, 0.42);
  return {
    outer: { zIndex: 2 },
    inner: d > 0.5 ? (front.length >= 3 ? { clipPath: `polygon(${pts(front)})` } : { clipPath: "polygon(0px 0px, 0px 0px, 0px 0px)" }) : undefined,
    midOverlay: hasRoll ? (
      <svg
        width={w}
        height={h}
        style={{ position: "absolute", inset: 0, overflow: "visible", filter: `drop-shadow(${(-unit * 0.008).toFixed(1)}px ${(unit * 0.014).toFixed(1)}px ${(unit * 0.016).toFixed(1)}px rgba(0,0,0,0.26))` }}
      >
        <defs>
          <linearGradient id="ps-roll" gradientUnits="userSpaceOnUse" x1={g0[0]} y1={g0[1]} x2={g1[0]} y2={g1[1]}>
            <stop offset="0%" stopColor={shade} />
            <stop offset="22%" stopColor={paper} />
            <stop offset="42%" stopColor={mix(paper, "#ffffff", 0.6)} />
            <stop offset="66%" stopColor={paper} />
            <stop offset="100%" stopColor={shade} />
          </linearGradient>
        </defs>
        <polygon points={tube.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} fill="url(#ps-roll)" stroke={withOpacity(PAPER_SHADE, 0.28)} strokeWidth={1.2} strokeLinejoin="round" />
        {/* the outer wrap's edge, running along the roll */}
        <line
          x1={A[0] + u[0] * half * 0.36}
          y1={A[1] + u[1] * half * 0.36}
          x2={B[0] + u[0] * half * 0.36}
          y2={B[1] + u[1] * half * 0.36}
          stroke={withOpacity(PAPER_SHADE, 0.3)}
          strokeWidth={1.4}
        />
      </svg>
    ) : null,
  };
};

/**
 * Exit t 0→1: the page rolls up from the top-right corner and the roll keeps going —
 * it never pauses — across the page and out past the bottom-left corner.
 */
const rollAway = (t: number, w: number, h: number, paper: string) => {
  const D = Math.hypot(w, h);
  const end = D + Math.min(w, h) * 0.3; // past the bottom-left corner, roll and all
  const k = Easing.bezier(0.45, 0, 0.9, 0.85)(Math.max(0, Math.min(1, t))); // gets going, then keeps rolling
  return rollUp(k * end, w, h, paper);
};

/** Nominal transition lengths; capped at 35% / 30% of the scene. */
const EXIT_FRAMES = 38;
const ENTRY_FRAMES = 32;

// ─── One stat ───────────────────────────────────────────────────

const StatCell: React.FC<{
  item: StatItem;
  /** Number cell (the figure is centred in it). */
  x: number;
  y: number;
  w: number;
  h: number;
  targetPx: number;
  count: number;
  numIn: number;
  circleIn: number;
  seed: number;
  accent: string;
  ink: string;
  portrait: boolean;
}> = ({ item, x, y, w, h, targetPx, count, numIn, circleIn, seed, accent, ink, portrait }) => {
  const parsed = parseStat(item.value);
  const finalMain = parsed ? `${parsed.prefix}${formatCount(parsed.value, parsed.decimals, parsed.grouped)}` : item.value;
  const rest = parsed ? parsed.rest.trim() : "";
  const shownMain = parsed ? `${parsed.prefix}${formatCount(parsed.value * count, parsed.decimals, parsed.grouped)}` : item.value;

  // Fit on the FINAL value so the count-up never overflows.
  const fitRef = React.useRef<HTMLDivElement>(null);
  const { px } = useFitText(fitRef, targetPx, portrait ? 64 : 56, [finalMain, rest, targetPx, w, h], h * 0.86, w * 0.84);

  // The figure's own size → a circle drawn tightly round it.
  const boxRef = React.useRef<HTMLSpanElement>(null);
  const [box, setBox] = React.useState<{ w: number; h: number } | null>(null);
  React.useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const handle = delayRender("crumpled-stat-box");
    setBox({ w: el.offsetWidth, h: el.offsetHeight });
    continueRender(handle);
  }, [px, finalMain, rest]);

  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = box ? box.w / 2 + px * 0.22 : 0;
  const ry = box ? box.h / 2 + px * 0.12 : 0;
  const figure = (main: string) => (
    <>
      {main}
      {rest ? <span style={{ fontSize: "0.5em", color: accent, marginLeft: "0.06em" }}>{rest}</span> : null}
    </>
  );
  const textStyle: React.CSSProperties = { fontWeight: 700, lineHeight: 0.95, whiteSpace: "nowrap", color: ink };

  return (
    <>
      <div
        ref={fitRef}
        aria-hidden
        style={{ position: "absolute", visibility: "hidden", width: w * 0.84, textAlign: "center", ...textStyle }}
      >
        {figure(finalMain)}
      </div>
      <span ref={boxRef} aria-hidden style={{ position: "absolute", visibility: "hidden", display: "inline-block", fontSize: px, ...textStyle }}>
        {figure(finalMain)}
      </span>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: w,
          height: h,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: numIn,
          transform: `scale(${0.9 + numIn * 0.1}) rotate(-2deg)`,
        }}
      >
        <div style={{ fontSize: px, textAlign: "center", fontVariantNumeric: "tabular-nums", ...textStyle }}>{figure(shownMain)}</div>
      </div>
      {box ? (
        <PencilLayer>
          <PencilStroke d={scribbleCirclePath(cx, cy, rx, ry, seed)} progress={circleIn} color={accent} width={Math.max(4.5, px * 0.035)} />
        </PencilLayer>
      ) : null}
    </>
  );
};

// ─── Layout ─────────────────────────────────────────────────────

export const PencilStat: React.FC<SceneLayoutProps> = (props) => {
  const { frame: sceneFrame, width, height, portrait, pal, font, pad } = useCrumpledScene(props);
  const p = portrait;
  // Default sizes — must match backend/templates/crumpled/meta.json; Template Studio rewrites these literals.
  const type = getCrumpledTypography(props, (titleFontSize, descriptionFontSize) => ({
    title: titleFontSize ?? (p ? 102 : 85),
    body: descriptionFontSize ?? (p ? 69 : 66),
  }));
  const seed = props.seed ?? 31;
  const sheet = scenePaper(props, seed, 3);
  const stats = resolveStats(props);
  const n = stats.length;
  const heading = (props.title || "").trim();
  // One body text for all the stats, shown on the right (falls back to the stat labels, then the narration).
  const labels = stats.map((s) => s.label).filter(Boolean);
  const body = (props.body || (Array.isArray(props.stats) && labels.length ? labels.join(" · ") : "") || props.descriptor || props.narration || "").trim();

  const total = props.sceneDurationInFrames ?? 300;
  const entryLen = Math.min(ENTRY_FRAMES, Math.floor(total * 0.3));
  // Content animations start as the sheet finishes unfolding.
  const frame = sceneFrame - Math.round(entryLen * 0.85);

  const headIn = ease(frame, 0, 22, Easing.inOut(Easing.quad));
  const numIn = ease(frame, 8, 20);
  const count = interpolate(frame, [10, 50], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const circleIn = ease(frame, 44, 70, Easing.inOut(Easing.quad));
  const bodyIn = ease(frame, 30, 80, Easing.linear);

  // Title band, then the stats area under it.
  const headH = portrait ? height * 0.16 : height * 0.2;
  const areaTop = pad.top + headH + (portrait ? 50 : 30);
  const areaBottom = height - pad.bottom;
  const areaH = areaBottom - areaTop;
  const areaX = pad.x;
  const areaW = width - pad.x * 2;

  // Left column: the stats stacked, one per row (number circled). Right column: the body text.
  const colGap = portrait ? 40 : 80;
  const statsW = areaW * (portrait ? 0.46 : 0.4);
  const rowGap = portrait ? 40 : 30;
  const rowH = (areaH - rowGap * (n - 1)) / n;
  const bodyX = areaX + statsW + colGap;
  const bodyW = areaX + areaW - bodyX;

  // The numerals scale with the Title Size setting (these are their sizes at the default title size).
  const numTarget = type.titleRelative(n === 1 ? 230 : n === 2 ? 180 : 140);

  const content = (
    <AbsoluteFill style={{ fontFamily: font, color: pal.ink, overflow: "hidden" }}>
      <PaperBackdrop paper={pal.paper} ink={pal.ink} seed={sheet.seed} orientation={sheet.orientation} density={9} depth={sheet.depth} />

      {heading ? (
        <div style={{ position: "absolute", left: pad.x, top: pad.top, width: width - pad.x * 2, height: headH, display: "flex", alignItems: "center" }}>
          <Written progress={headIn}>
            <FitText
              targetPx={type.title}
              minPx={portrait ? 44 : 38}
              maxHeightPx={headH}
              maxWidthPx={width - pad.x * 2}
              fitKey={`ps-head:${heading}:${portrait}`}
              exact={type.titleIsUserSet}
              style={{ fontWeight: 700, lineHeight: 1.02 }}
            >
              {heading}
            </FitText>
          </Written>
        </div>
      ) : null}

      {stats.map((item, i) => (
        <StatCell
          key={i}
          item={item}
          x={areaX}
          y={areaTop + i * (rowH + rowGap)}
          w={statsW}
          h={rowH}
          targetPx={numTarget}
          count={count}
          numIn={numIn}
          circleIn={circleIn}
          seed={sheet.seed + i * 7}
          accent={pal.accent}
          ink={pal.ink}
          portrait={portrait}
        />
      ))}

      {body ? (
        <div style={{ position: "absolute", left: bodyX, top: areaTop, width: bodyW, height: areaH, display: "flex", alignItems: "center" }}>
          <Written progress={bodyIn} mode="block" style={{ width: "100%" }}>
            <FitText
              targetPx={type.body}
              minPx={portrait ? 30 : 26}
              maxHeightPx={areaH * 0.92}
              maxWidthPx={bodyW}
              fitKey={`ps-body:${body}:${portrait}:${n}`}
              exact={type.bodyIsUserSet}
              style={{ fontWeight: 600, lineHeight: 1.28, color: pal.inkSoft }}
            >
              {body}
            </FitText>
          </Written>
        </div>
      ) : null}
    </AbsoluteFill>
  );

  // Transitions on the scene's raw frames (so they track the real scene start / end).
  const rawFrame = useCurrentFrame();
  const exitLen = Math.min(EXIT_FRAMES, Math.floor(total * 0.35));
  const exitT = interpolate(rawFrame, [total - exitLen, total], [0, 1], clamp);
  const entryT = entryLen > 0 ? interpolate(sceneFrame, [0, entryLen], [0, 1], clamp) : 1;
  // Entry = the exit played backwards: the roll comes in from the bottom-left and unrolls the page up to the top-right corner.
  const spec: Spec = exitT > 0 ? rollAway(exitT, width, height, pal.paper) : entryT < 1 ? rollAway(1 - entryT, width, height, pal.paper) : {};

  return (
    <AbsoluteFill style={{ background: exitT > 0 || entryT < 1 ? CRUMPLED_DESK : undefined }}>
      <AbsoluteFill style={spec.outer}>
        <AbsoluteFill style={spec.mid}>
          <AbsoluteFill style={spec.inner}>{content}</AbsoluteFill>
          {spec.midOverlay ?? null}
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
