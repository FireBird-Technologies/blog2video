/**
 * Opening — a crumpled paper ball drops onto the desk, bounces twice and settles,
 * then the same sheet uncrumples: it spreads out irregularly, corners and edges
 * pulling free at different moments while its wrinkles relax, until it lies flat
 * across the frame and the title is pencilled onto it.
 * The title, underline and doodles are already written on the paper and open with it.
 *
 * Exit (built in, last frames of the scene): the page tears into three: the side pieces peel away, the middle strip zooms out.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import type { SceneLayoutProps } from "../types";
import { FitText } from "../components/FitText";
import { PencilLayer, PencilStroke, doodleStarPath, underlinePath, arrowPaths } from "../components/Pencil";
import { Written, ease } from "../components/Handwriting";
import { useCrumpledScene } from "../components/sceneKit";
import { PaperBall } from "../components/PaperBall";
import { clamp, mix, withOpacity, rand, CRUMPLED_DESK } from "../crumpledStyle";
import { getCrumpledTypography } from "../typography";

/** Crease depth of the opened page (same as the other scenes' PaperBackdrop). */
const PAPER_DEPTH = 1.15;

// ─── Exit: tear three ─────────────────────────────────────────────

/**
 * The exit is a "spec" applied to ONE fixed wrapper tree around the scene, so the
 * layout never remounts when the exit starts; idle → every style is empty.
 */
interface Spec {
  outer?: React.CSSProperties;
  /** Drawn inside `outer` but BEHIND the scene. */
  behind?: React.ReactNode;
  mid?: React.CSSProperties;
  inner?: React.CSSProperties;
  innerOverlay?: React.ReactNode;
  midOverlay?: React.ReactNode;
  extras?: React.ReactNode;
}

interface Ctx {
  t: number;
  /** Scene clock in seconds (drives the paper's light / drift). */
  seconds: number;
  w: number;
  h: number;
  seed: number;
  paper: string;
  ink: string;
  children: React.ReactNode;
}

const easeIn = Easing.in(Easing.cubic);
const easeInOut = Easing.inOut(Easing.cubic);
const easeOut = Easing.out(Easing.cubic);
const seg = (t: number, a: number, b: number, e = easeInOut) => interpolate(t, [a, b], [0, 1], { ...clamp, easing: e });
const pts = (list: Array<[number, number]>) => list.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ");

/** A jagged line between two points: big wander + small fibre jitter. */
const jaggedLine = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  steps: number,
  amp: number,
  seed: number,
): Array<[number, number]> => {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const u = i / steps;
    const wander = Math.sin(u * Math.PI * 2.3 + seed) * amp * 0.9;
    const fibre = i === 0 || i === steps ? 0 : (rand(seed + i * 3.7) - 0.5) * amp * 1.6;
    const off = wander + fibre;
    return [x0 + dx * u + nx * off, y0 + dy * u + ny * off];
  });
};

/** White, fibrous paper fringe along a torn edge (drawn above the clipped half). */
const TornFringe: React.FC<{ line: Array<[number, number]>; paper: string; width: number; height: number }> = ({
  line,
  paper,
  width,
  height,
}) => {
  const d = line.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <path d={d} fill="none" stroke={mix(paper, "#ffffff", 0.75)} strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke={withOpacity("#000000", 0.08)} strokeWidth={2} strokeLinejoin="round" transform="translate(0 4)" />
    </svg>
  );
};

/** The first `f` (0..1) of a jagged line, ending on an interpolated tip. */
const partialLine = (line: Array<[number, number]>, f: number, fromEnd = false): Array<[number, number]> => {
  const src = fromEnd ? [...line].reverse() : line;
  const pos = Math.max(0, Math.min(1, f)) * (src.length - 1);
  const whole = Math.floor(pos);
  const out = src.slice(0, whole + 1);
  if (whole < src.length - 1) {
    const [ax, ay] = src[whole];
    const [bx, by] = src[whole + 1];
    const u = pos - whole;
    out.push([ax + (bx - ax) * u, ay + (by - ay) * u]);
  }
  return out;
};

/**
 * Torn by hand, in three. The left tear runs down from the top edge and the piece
 * it frees is folded over and pulled DOWN with it (you see the back of the paper);
 * the right tear runs up from the bottom and its piece is folded and pulled UP.
 * While the tears run, the middle strip fades out, timed so it is gone just as both
 * tears are through and the side pieces have been peeled away — leaving the desk.
 *
 * The middle strip (between the two tear lines) is one copy and fades; the side
 * parts not yet torn away stay fully opaque, one copy each.
 */
const tearThree = ({ t, w, h, seed, paper, ink, children }: Ctx): Spec => {
  const amp = Math.min(w, h) * 0.016;
  const lineL = jaggedLine(w * (0.32 + rand(seed + 21) * 0.04), 0, w * (0.35 - rand(seed + 22) * 0.04), h, 40, amp, seed + 23);
  const lineR = jaggedLine(w * (0.65 + rand(seed + 24) * 0.04), 0, w * (0.68 - rand(seed + 25) * 0.04), h, 40, amp, seed + 26);

  // 1. The tears run (and the freed pieces peel with them).
  const frontL = seg(t, 0, 0.82, easeInOut);
  const frontR = seg(t, 0.08, 0.9, easeInOut);
  const tornL = partialLine(lineL, frontL); // top → tear tip
  const tornR = partialLine(lineR, frontR, true); // bottom → tear tip
  const hL = frontL > 0 ? tornL[tornL.length - 1][1] : 0; // left fold line
  const hR = frontR > 0 ? tornR[tornR.length - 1][1] : h; // right fold line
  // 2. Meanwhile the middle strip fades out (drifting a touch toward the viewer),
  //    finishing exactly as the second tear does.
  const move = seg(t, 0.04, 0.9, easeInOut);
  const midX = (lineL[0][0] + lineL[lineL.length - 1][0] + lineR[0][0] + lineR[lineR.length - 1][0]) / 4;

  // The middle strip between the two full tear lines (it never peels).
  const middle: Array<[number, number]> = [...lineL, ...[...lineR].reverse()];
  // The side parts not torn away yet: from the tear tip along the rest of its line.
  const rest = (line: Array<[number, number]>, f: number, fromEnd: boolean): Array<[number, number]> => {
    const src = fromEnd ? [...line].reverse() : line;
    const whole = Math.floor(Math.max(0, Math.min(1, f)) * (src.length - 1));
    const tip = partialLine(line, f, fromEnd);
    return [tip[tip.length - 1], ...src.slice(whole + 1)];
  };
  const restL = rest(lineL, frontL, false); // tip → bottom
  const restR = rest(lineR, frontR, true); // tip → top
  const sideL: Array<[number, number]> = [[0, hL], ...restL, [0, h]];
  const sideR: Array<[number, number]> = [[w, hR], [w, 0], ...[...restR].reverse()];

  // Each peeled piece, folded over its fold line (mirrored, slightly foreshortened).
  const fold = (f: number) => 0.4 + 0.55 * Math.min(1, f * 4);
  const kL = fold(frontL);
  const kR = fold(frontR);
  const flapL: Array<[number, number]> = [[0, 0], ...tornL, [0, hL]].map(([x, y]) => [x, hL + (hL - y) * kL]);
  const flapR: Array<[number, number]> = [[w, h], ...tornR, [w, hR]].map(([x, y]) => [x, hR - (y - hR) * kR]);
  const edgeL = tornL.map(([x, y]) => [x, hL + (hL - y) * kL] as [number, number]);
  const edgeR = tornR.map(([x, y]) => [x, hR - (y - hR) * kR] as [number, number]);
  const svgPts = (list: Array<[number, number]>) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const back = mix(paper, ink, 0.06);
  const backFar = mix(paper, ink, 0.16);
  const gid = `t3-${seed}`;
  const flaps =
    frontL > 0 || frontR > 0 ? (
      <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible", filter: "drop-shadow(0 10px 14px rgba(0,0,0,0.22))" }}>
        <defs>
          <linearGradient id={`${gid}-l`} gradientUnits="userSpaceOnUse" x1="0" y1={hL} x2="0" y2={hL + hL * kL}>
            <stop offset="0%" stopColor={mix(back, "#ffffff", 0.35)} />
            <stop offset="100%" stopColor={backFar} />
          </linearGradient>
          <linearGradient id={`${gid}-r`} gradientUnits="userSpaceOnUse" x1="0" y1={hR} x2="0" y2={hR - (h - hR) * kR}>
            <stop offset="0%" stopColor={mix(back, "#ffffff", 0.35)} />
            <stop offset="100%" stopColor={backFar} />
          </linearGradient>
        </defs>
        {frontL > 0 ? (
          <g>
            <polygon points={svgPts(flapL)} fill={`url(#${gid}-l)`} />
            <polyline points={svgPts(edgeL)} fill="none" stroke={mix(paper, "#ffffff", 0.75)} strokeWidth={7} strokeLinejoin="round" />
            {/* the fold: a soft highlight where the paper turns over */}
            <line x1={0} y1={hL} x2={tornL[tornL.length - 1][0]} y2={hL} stroke="#ffffff" strokeWidth={3} opacity={0.8} />
          </g>
        ) : null}
        {frontR > 0 ? (
          <g>
            <polygon points={svgPts(flapR)} fill={`url(#${gid}-r)`} />
            <polyline points={svgPts(edgeR)} fill="none" stroke={mix(paper, "#ffffff", 0.75)} strokeWidth={7} strokeLinejoin="round" />
            <line x1={tornR[tornR.length - 1][0]} y1={hR} x2={w} y2={hR} stroke="#ffffff" strokeWidth={3} opacity={0.8} />
          </g>
        ) : null}
      </svg>
    ) : null;

  return {
    outer: { zIndex: 2 },
    mid: move > 0 ? { transform: `scale(${1 + move * 0.08})`, transformOrigin: `${midX.toFixed(1)}px ${h / 2}px`, opacity: 1 - move } : undefined,
    inner: { clipPath: `polygon(${pts(middle)})` },
    midOverlay: (
      <>
        {frontL > 0 ? <TornFringe line={tornL} paper={paper} width={w} height={h} /> : null}
        {frontR > 0 ? <TornFringe line={tornR} paper={paper} width={w} height={h} /> : null}
      </>
    ),
    extras: (
      <>
        {frontL < 1 ? <AbsoluteFill style={{ clipPath: `polygon(${pts(sideL)})` }}>{children}</AbsoluteFill> : null}
        {frontR < 1 ? <AbsoluteFill style={{ clipPath: `polygon(${pts(sideR)})` }}>{children}</AbsoluteFill> : null}
        {flaps}
      </>
    ),
  };
};

/** Nominal exit length; capped at 35% of the scene. */
const EXIT_SECONDS = 1.5; // the tear runs in the scene's last 1.5 seconds

export const PaperHero: React.FC<SceneLayoutProps> = (props) => {
  const { frame, width, height, fps, portrait, pal, font, pad } = useCrumpledScene(props);
  const p = portrait;
  // Default sizes — must match backend/templates/crumpled/meta.json; Template Studio rewrites these literals.
  const type = getCrumpledTypography(props, (titleFontSize, descriptionFontSize) => ({
    title: titleFontSize ?? (p ? 133 : 124),
    body: descriptionFontSize ?? (p ? 86 : 79),
  }));
  const seed = props.seed ?? 42;
  const title = props.title || "";
  const subtitle = (props.subtitle || "").trim();
  const desk = CRUMPLED_DESK;
  const hw = width / 2;

  // ── 1. drop + bounce (0–35), settle (35–46) ──
  const r = Math.min(width, height) * 0.13;
  const floorY = height * 0.56; // ball centre at rest
  const y0 = -r * 1.6;
  const H1 = r * 1.1;
  const H2 = r * 0.35;
  const ballY =
    frame < 16
      ? y0 + (floorY - y0) * Math.pow(Math.max(0, frame) / 16, 2)
      : frame < 28
        ? floorY - H1 * 4 * ((frame - 16) / 12) * (1 - (frame - 16) / 12)
        : frame < 35
          ? floorY - H2 * 4 * ((frame - 28) / 7) * (1 - (frame - 28) / 7)
          : floorY;
  const ballX = interpolate(frame, [0, 35], [width * 0.46, hw], { ...clamp, easing: Easing.out(Easing.quad) });
  // Squash on each impact (anchored at the contact point), stretch while falling.
  const impacts: Array<[number, number]> = [[16, 0.22], [28, 0.12], [35, 0.06]];
  const squash = impacts.reduce((k, [at, amt]) => Math.max(k, amt * Math.max(0, 1 - Math.abs(frame - at) / 3.5)), 0);
  const stretch = frame < 16 ? 0.1 * (Math.max(0, frame) / 16) : 0;
  const settleD = frame - 35;
  const rock = settleD > 0 ? 4 * Math.sin(settleD * 0.9) * Math.exp(-settleD / 4) : 0;
  const ballRot = interpolate(frame, [0, 16, 28, 35], [-160, -40, -12, 0], clamp) + rock;
  const airborne = Math.max(0, floorY - ballY);
  const shadowK = 1 - Math.min(0.75, airborne / (r * 3));

  // ── 2. open (46–102): the ball itself unfolds into the page ──
  // Its rim pulls outward first and the middle follows; the crumples flatten into
  // the faint creases of the opened sheet, which stays as this scene's background.
  const openP = ease(frame, 46, 102, Easing.inOut(Easing.cubic));
  const ballOut = 1 - interpolate(openP, [0, 0.35], [0, 1], clamp); // floor shadow fades as it spreads

  // ── text ──
  // Already written on the paper: no write-on. The words ride the opening sheet —
  // small and near the ball while it is crumpled, spreading out to full size with
  // the page, and showing through once the paper is open enough to read.
  const titleIn = 1;
  const underline = 1;
  const subIn = 1;
  const doodles = 1;
  const textK = openP;
  const textOpacity = interpolate(openP, [0.45, 0.82], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const textScale = 0.3 + 0.7 * textK;
  const textShiftX = (ballX - hw) * (1 - textK);
  const textShiftY = (floorY - height / 2) * (1 - textK);
  const textTilt = (1 - textK) * -4;

  const boxW = width - pad.x * 2 - (portrait ? 0 : width * 0.12);
  const titleSize = type.title;
  const subSize = type.body;
  const titleMaxH = portrait ? height * 0.34 : height * 0.36;
  const centerY = portrait ? height * 0.44 : height * 0.47;
  const lineW = Math.min(boxW * 0.62, portrait ? 640 : 820);

  const content = (
    <AbsoluteFill style={{ background: desk, fontFamily: font, color: pal.ink, overflow: "hidden" }}>
      {/* Floor shadow of the ball — tighter and darker as it lands. */}
      {frame < 80 ? (
        <div
          style={{
            position: "absolute",
            left: ballX - r * shadowK,
            top: floorY + r * 0.86,
            width: r * 2 * shadowK,
            height: r * 0.42 * shadowK,
            borderRadius: "50%",
            background: withOpacity(pal.ink, 0.26 * shadowK * ballOut),
            filter: "blur(10px)",
          }}
        />
      ) : null}

      {/* The paper itself: ONE crumpled sheet that drops, bounces, then opens out
          into the page — no second sheet, no swap. */}
      <PaperBall
        open={openP}
        cx={ballX}
        cy={ballY}
        r={r}
        rotation={ballRot}
        scaleX={1 - stretch * 0.5 + squash * 0.8}
        scaleY={1 + stretch - squash}
        palette={pal}
        seed={seed}
        depth={PAPER_DEPTH}
        density={10}
      />

      <AbsoluteFill
        style={{
          opacity: textOpacity,
          transform: `translate(${textShiftX}px, ${textShiftY}px) scale(${textScale}) rotate(${textTilt}deg)`,
          transformOrigin: "50% 50%",
          visibility: textOpacity > 0 ? "visible" : "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: (width - boxW) / 2,
            top: centerY - titleMaxH * 0.5,
            width: boxW,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <Written progress={titleIn} style={{ width: "100%" }}>
            <FitText
              targetPx={titleSize}
              minPx={portrait ? 56 : 48}
              maxHeightPx={titleMaxH}
              maxWidthPx={boxW}
              fitKey={`hero-title:${title}:${portrait}`}
              exact={type.titleIsUserSet}
              style={{ fontWeight: 700, lineHeight: 1.0, letterSpacing: "-0.01em", color: pal.ink }}
            >
              {title}
            </FitText>
          </Written>
          <PencilLayer width={lineW} height={34} style={{ marginTop: portrait ? 18 : 12 }}>
            <PencilStroke d={underlinePath(4, 14, lineW - 30, seed)} progress={underline} color={pal.accent} width={portrait ? 7 : 6} />
          </PencilLayer>
          {subtitle ? (
            <Written progress={subIn} style={{ width: "100%", marginTop: portrait ? 44 : 30 }}>
              <FitText
                targetPx={subSize}
                minPx={portrait ? 32 : 28}
                maxHeightPx={portrait ? height * 0.16 : height * 0.17}
                maxWidthPx={boxW * (portrait ? 1 : 0.86)}
                fitKey={`hero-sub:${subtitle}:${portrait}`}
                exact={type.bodyIsUserSet}
                style={{ fontWeight: 500, lineHeight: 1.15, color: pal.inkSoft, margin: "0 auto" }}
              >
                {subtitle}
              </FitText>
            </Written>
          ) : null}
        </div>

        <PencilLayer>
          <PencilStroke d={doodleStarPath(width * (portrait ? 0.14 : 0.1), height * (portrait ? 0.16 : 0.2), portrait ? 34 : 30, seed)} progress={doodles} color={pal.ink} width={3} opacity={0.7} />
          <PencilStroke d={doodleStarPath(width * (portrait ? 0.86 : 0.9), height * (portrait ? 0.8 : 0.78), portrait ? 26 : 22, seed + 4)} progress={doodles} color={pal.accent} width={3} opacity={0.75} />
          {(() => {
            const a = portrait
              ? arrowPaths(width * 0.8, height * 0.15, width * 0.68, height * 0.22, 0.35, seed)
              : arrowPaths(width * 0.86, height * 0.2, width * 0.79, height * 0.3, 0.35, seed);
            return (
              <>
                <PencilStroke d={a.shaft} progress={doodles} color={pal.ink} width={3} opacity={0.6} double={false} />
                <PencilStroke d={a.head} progress={1} color={pal.ink} width={3} opacity={0.6} double={false} />
              </>
            );
          })()}
        </PencilLayer>
      </AbsoluteFill>
    </AbsoluteFill>
  );

  // Exit, in the scene's own last frames (raw frame, so it tracks the real scene end
  // and plays the same in the full video and when the scene is played on its own).
  const rawFrame = useCurrentFrame();
  const total = props.sceneDurationInFrames ?? 300;
  const exitLen = Math.min(Math.round(EXIT_SECONDS * fps), Math.floor(total * 0.35));
  const exitT = interpolate(rawFrame, [total - exitLen, total], [0, 1], clamp);
  const ctx: Ctx = { t: exitT, seconds: rawFrame / fps, w: width, h: height, seed, paper: pal.paper, ink: pal.ink, children: content };
  const spec: Spec = exitT > 0 ? tearThree(ctx) : {};

  return (
    <AbsoluteFill style={{ background: exitT > 0 ? CRUMPLED_DESK : undefined }}>
      <AbsoluteFill style={spec.outer}>
        {spec.behind ?? null}
        <AbsoluteFill style={spec.mid}>
          <AbsoluteFill style={spec.inner}>
            {content}
            {spec.innerOverlay ?? null}
          </AbsoluteFill>
          {spec.midOverlay ?? null}
        </AbsoluteFill>
        {spec.extras ?? null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
