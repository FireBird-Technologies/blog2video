import React, { useId, useMemo } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SWAN_PM, SWAN_PW1, SWAN_PW2 } from "../swanPaths";
import { blackswanNeonPalette } from "../layouts/blackswanAccent";

const PL = 18000;

/**
 * ── Trimming the two rules at the swan's base ────────────────────────────
 * `SWAN_PM` carries two long, flat runs along the very bottom of the traced
 * shape — a pair of horizontal rules flanking the bird, left over from the
 * HTML reference this path was extracted from.
 *
 * They are only removed for callers that pass `trimBaseRules` — currently just
 * `droplet_intro__v2`, where the swan rides an open water surface and the rules
 * read as stray lines lying under it. Everywhere else the shape is unchanged:
 * six other layouts have always drawn those rules, and quietly dropping them
 * from all of them is a much bigger edit than the one being asked for.
 *
 * Removed HERE and not in `swanPaths.ts`, for two reasons:
 *   - that file is auto-generated and marked "do not hand-edit"; a hand edit
 *     would be silently undone the next time it is regenerated.
 *   - `SwanParticles` imports `SWAN_PM` raw and resamples it for its assemble /
 *     dissolve motes, and its `parseCubicPath` only understands `M`/`C`/`Z`. The
 *     bridges below are `L` commands, which that parser would skip — mangling
 *     the outline it traces. Keeping the trim local to this component leaves
 *     those particles reading exactly the path they always have.
 *
 * The runs are identified by GEOMETRY, not by hardcoded indices: any cubic
 * lying wholly below `BASE_Y` is dropped. Indices would rot the moment the
 * path is regenerated with a different segment count, whereas "the flat bits
 * along the bottom" stays true. At the time of writing this removes 30 of 236
 * segments, leaving the body bbox at x −233..99, y 0..342 (from −285..272,
 * 0..345) — i.e. only the outboard rules go.
 *
 * The excisions leave gaps of ~6.6 and ~3.6 units, closed with a straight
 * bridge. Both are well under a pixel once the 0.614 scale is applied.
 */
const BASE_Y = 330;

function trimSwanBaseRules(d: string): string {
  const toks = d.match(/[MCZmcz]|-?[0-9]*\.?[0-9]+(?:e-?[0-9]+)?/g);
  if (!toks) return d;

  type Cubic = { from: [number, number]; c1: [number, number]; c2: [number, number]; to: [number, number] };
  const segs: Cubic[] = [];
  let start: [number, number] | null = null;
  let cur: [number, number] = [0, 0];
  let cmd = "";
  let i = 0;

  while (i < toks.length) {
    const tk = toks[i];
    if (/^[MCZmcz]$/.test(tk)) {
      cmd = tk.toUpperCase();
      i += 1;
      continue;
    }
    if (cmd === "M") {
      cur = [Number(toks[i]), Number(toks[i + 1])];
      start = cur;
      i += 2;
      // SVG treats coordinates following an M as implicit L; this path only
      // ever has one M followed by cubics, so switching to C is correct here.
      cmd = "C";
      continue;
    }
    if (cmd === "C") {
      const c1: [number, number] = [Number(toks[i]), Number(toks[i + 1])];
      const c2: [number, number] = [Number(toks[i + 2]), Number(toks[i + 3])];
      const to: [number, number] = [Number(toks[i + 4]), Number(toks[i + 5])];
      segs.push({ from: cur, c1, c2, to });
      cur = to;
      i += 6;
      continue;
    }
    break; // Z
  }

  if (!start || segs.length === 0) return d;

  // A segment is part of a base rule when the whole cubic — endpoints AND
  // control points — sits below BASE_Y. Requiring all four keeps the strokes
  // that merely dip toward the base on their way somewhere else.
  const isBaseRule = (s: Cubic) =>
    Math.min(s.from[1], s.c1[1], s.c2[1], s.to[1]) > BASE_Y;

  const kept = segs.filter((s) => !isBaseRule(s));
  if (kept.length === segs.length) return d;

  const n = (v: number) => Number(v.toFixed(4));
  let out = `M${n(start[0])} ${n(start[1])}`;
  let pen = start;
  for (const s of kept) {
    // Bridge the hole left where a run was cut out.
    if (Math.hypot(s.from[0] - pen[0], s.from[1] - pen[1]) > 0.01) {
      out += ` L${n(s.from[0])} ${n(s.from[1])}`;
    }
    out += ` C${n(s.c1[0])} ${n(s.c1[1])} ${n(s.c2[0])} ${n(s.c2[1])} ${n(s.to[0])} ${n(s.to[1])}`;
    pen = s.to;
  }
  return `${out} Z`;
}

/** Body outline with the two stray base rules removed. Computed once. */
const SWAN_BODY = trimSwanBaseRules(SWAN_PM);

/** 11s neon flicker cycle (matches former `bsw-flicker` keyframes). */
function flickerMul(t: number, flickerDelay: number, animate: boolean): number {
  if (!animate || t < flickerDelay) return 1;
  const u = (((t - flickerDelay) % 11) + 11) % 11;
  const frac = u / 11;
  if (frac < 0.88) return 1;
  if (frac < 0.89) return interpolate(frac, [0.88, 0.89], [1, 0.18]);
  if (frac < 0.905) return interpolate(frac, [0.89, 0.905], [0.18, 1]);
  if (frac < 0.92) return interpolate(frac, [0.905, 0.92], [1, 0.48]);
  if (frac < 0.93) return interpolate(frac, [0.92, 0.93], [0.48, 1]);
  return 1;
}

export type SwanProps = {
  /** Pixel width; height follows 700×480 viewBox aspect. */
  size?: number;
  /** Overall group opacity (HTML often passes op). */
  opacity?: number;
  /** Draw-on + flicker (frame-synced). */
  animate?: boolean;
  /** HTML: water reflections + horizon lines */
  water?: boolean;
  /** HTML: vertical flip reflection under swan */
  reflection?: boolean;
  /** Stable id prefix for filters when multiple swans mount */
  uid?: string;
  /** Theme accent — body, water ripples, and horizon lines derive from this */
  accentColor?: string;
  /**
   * Drop the two flat rules along the base of the traced outline (see
   * `trimSwanBaseRules`).
   *
   * OFF by default, deliberately. The rules are part of the shape every other
   * blackswan scene has always drawn, and removing them everywhere changes six
   * other layouts. Only `droplet_intro__v2` opts in, where the swan sits on an
   * open water surface and the rules read as stray lines under the bird.
   */
  trimBaseRules?: boolean;
};

/**
 * Swan — traced PM path, two neon layers + optional PW reflections.
 * Matches reference `swan(w, { refl, water, op, uid })`.
 */
export const Swan: React.FC<SwanProps> = ({
  size = 220,
  opacity = 1,
  animate = true,
  water = true,
  reflection = true,
  uid: uidProp,
  accentColor = "#00E5FF",
  trimBaseRules = false,
}) => {
  // Both variants are precomputed at module load, so this is a pick, not work.
  const bodyPath = trimBaseRules ? SWAN_BODY : SWAN_PM;
  const reactId = useId().replace(/:/g, "");
  const uid = uidProp ?? reactId;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const pal = useMemo(() => blackswanNeonPalette(accentColor), [accentColor]);
  const { bright: innerStroke, vivid: waterFine, light: horizonFine, deep: horizonDeep, abyss: reflectionStroke } = pal;

  const w = size;
  const h = Math.round((w * 480) / 700);

  const drawDur = 2.9;
  const flickerDelay = 3.2;
  const drawProgress = animate
    ? interpolate(t, [0, drawDur], [0, 1], {
        easing: Easing.bezier(0.26, 0, 0.04, 1),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  const bodyDashOff = PL * (1 - drawProgress);
  const flick = flickerMul(t, flickerDelay, animate);

  const waterDashOff = bodyDashOff;

  const lineDraw = (base: number, len: number) =>
    animate
      ? len *
        (1 -
          interpolate(t, [base, base + 1.4], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.quad),
          }))
      : 0;

  const reflCycle = Math.max(0, t - 3);
  const reflGroupOp =
    0.08 + 0.08 * (0.5 - 0.5 * Math.cos((2 * Math.PI * reflCycle) / 5));

  return (
    <svg width={w} height={h} viewBox="0 0 700 480" fill="none" style={{ opacity, overflow: "visible", display: "block" }}>
      <defs>
        <filter id={`bswan-fg-${uid}`} x="-55%" y="-55%" width="210%" height="210%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`bswan-fc-${uid}`} x="-4%" y="-4%" width="108%" height="108%">
          <feGaussianBlur stdDeviation="0.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`bswan-fr-${uid}`} x="-18%" y="-18%" width="136%" height="136%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
        <filter id={`bswan-fwl-${uid}`} x="-5%" y="-900%" width="110%" height="1900%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
        </filter>
        <filter id={`bswan-fcore-${uid}`} x="-4%" y="-400%" width="108%" height="900%">
          <feGaussianBlur stdDeviation="0.8" />
        </filter>
        <clipPath id={`bswan-cp-${uid}`}>
          <rect width="700" height="480" />
        </clipPath>
      </defs>

      <g clipPath={`url(#bswan-cp-${uid})`}>
        <g transform="translate(12,10) scale(0.614)">
          <path
            d={bodyPath}
            transform="translate(588,218)"
            stroke={accentColor}
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter={`url(#bswan-fg-${uid})`}
            strokeDasharray={PL}
            strokeDashoffset={bodyDashOff}
            opacity={0.54 * flick}
          />
          <path
            d={bodyPath}
            transform="translate(588,218)"
            stroke={innerStroke}
            strokeWidth={0.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter={`url(#bswan-fc-${uid})`}
            strokeDasharray={PL}
            strokeDashoffset={bodyDashOff}
            opacity={0.66 * flick}
          />

          {water ? (
            <>
              <path
                d={SWAN_PW1}
                transform="translate(428,444)"
                stroke={accentColor}
                strokeWidth={2.8}
                strokeLinecap="round"
                fill="none"
                filter={`url(#bswan-fg-${uid})`}
                strokeDasharray={PL}
                strokeDashoffset={waterDashOff}
              />
              <path
                d={SWAN_PW1}
                transform="translate(428,444)"
                stroke={waterFine}
                strokeWidth={0.55}
                strokeLinecap="round"
                fill="none"
                filter={`url(#bswan-fc-${uid})`}
                strokeDasharray={PL}
                strokeDashoffset={waterDashOff}
              />
              <path
                d={SWAN_PW2}
                transform="translate(678,490)"
                stroke={accentColor}
                strokeWidth={2}
                strokeLinecap="round"
                fill="none"
                filter={`url(#bswan-fg-${uid})`}
                strokeDasharray={PL}
                strokeDashoffset={waterDashOff}
              />
            </>
          ) : null}
        </g>

        {water ? (
          <>
            <line
              x1={10}
              y1={357}
              x2={690}
              y2={357}
              stroke={accentColor}
              strokeWidth={5.5}
              filter={`url(#bswan-fwl-${uid})`}
              opacity={0.32}
              strokeDasharray="1200 1200"
              strokeDashoffset={lineDraw(0.1, 1200)}
            />
            <line
              x1={10}
              y1={357}
              x2={690}
              y2={357}
              stroke={horizonFine}
              strokeWidth={0.52}
              strokeDasharray="1200 1200"
              strokeDashoffset={lineDraw(0.15, 1200)}
            />
            <line
              x1={44}
              y1={367}
              x2={656}
              y2={367}
              stroke={horizonDeep}
              strokeWidth={3}
              filter={`url(#bswan-fwl-${uid})`}
              opacity={0.14}
              strokeDasharray="1060 1060"
              strokeDashoffset={lineDraw(0.22, 1060)}
            />
          </>
        ) : null}

        {reflection ? (
          <g transform="translate(0,714) scale(1,-1)" opacity={reflGroupOp}>
            <g transform="translate(12,10) scale(0.614)">
              <path
                d={bodyPath}
                transform="translate(588,218)"
                stroke={reflectionStroke}
                strokeWidth={0.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                filter={`url(#bswan-fr-${uid})`}
                opacity={0.1}
              />
            </g>
          </g>
        ) : null}
      </g>
    </svg>
  );
};
