/**
 * List layout — the heading, the scene's display text under it, then 3–4 points as
 * torn paper scraps that are all stuck onto the sheet at once, each with a pencil tick. Landscape: a row (or 3 + 2) of scraps;
 * portrait: a staggered vertical stack.
 *
 * Entry (built in, first frames): a crumpled sheet, folded in quarters, unfolds (bottom half, then right half)
 * and is pressed flat.
 * Exit (built in, last frames): the page is roughly crumpled into a ball while being dragged off to the right.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import type { SceneLayoutProps } from "../types";
import { PaperBackdrop } from "../components/PaperBackdrop";
import { FitText } from "../components/FitText";
import { PencilLayer, PencilStroke, tickPath, underlinePath } from "../components/Pencil";
import { Written, ease } from "../components/Handwriting";
import { sentences, useCrumpledScene, scenePaper } from "../components/sceneKit";
import { getCrumpledTypography } from "../typography";
import { mix, rand, withOpacity, clamp, paperPalette, CRUMPLED_DESK, PAPER_SHADE } from "../crumpledStyle";
import { PaperBall, paperBallOutline } from "../components/PaperBall";
import { CrumpleLayer } from "../components/CrumpleLayer";

/** Clip-path for a scrap with a torn bottom edge and slightly ragged sides. */
const scrapClip = (seed: number) => {
  const bottom = Array.from({ length: 13 }, (_, i) => {
    const x = 100 - (i / 12) * 100;
    const y = 93 + rand(seed + i * 2.7) * 7;
    return `${x.toFixed(1)}% ${y.toFixed(1)}%`;
  }).join(", ");
  return `polygon(0% 1%, 30% 0%, 70% 1.5%, 100% 0%, ${bottom}, 0% 96%)`;
};

// ─── Entry / exit ───────────────────────────────────────────────

/**
 * Entry and exit are a "spec" applied to ONE fixed wrapper tree around the scene, so
 * the layout never remounts when they run; idle → every style is empty.
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
  orientation: 0 | 1 | 2 | 3;
  /** The scene backdrop's crease depth (so a paper ball turning into the page matches it). */
  depth?: number;
  paper: string;
  ink: string;
  children: React.ReactNode;
}

const easeInOut = Easing.inOut(Easing.cubic);
const easeOut = Easing.out(Easing.cubic);
const seg = (t: number, a: number, b: number, e = easeInOut) => interpolate(t, [a, b], [0, 1], { ...clamp, easing: e });

/** The scene's backdrop density — the crumple overlay and the ball deepen THESE creases. */
const DENSITY = 9;

/**
 * Entry: a crumpled sheet folded in quarters (the bottom half and the right half
 * tucked under) sits centred on the desk; the bottom half swings down from underneath
 * (it opens vertically), then the right half swings out (horizontally), and the
 * creases are pressed flat into the page.
 *
 * Only the top-left quarter of the real scene shows at first (its clip widens as each
 * fold opens). The flaps are copies of the scene drawn BEHIND it in 3D, rotating out
 * from under the visible part — so while a flap is still folded under, it is hidden.
 */
const unfold = ({ t, w, h, seed, orientation, paper, children }: Ctx): Spec => {
  const appear = seg(t, 0, 0.12, easeOut);
  const b = seg(t, 0.1, 0.45); // bottom half first (opens vertically) …
  const a = seg(t, 0.45, 0.82); // … then the right half (opens horizontally)
  const crumple = 1 - seg(t, 0.62, 1);
  const persp = Math.max(w, h) * 1.4;
  const clip = b < 1 ? `inset(0 ${w / 2}px ${h / 2}px 0)` : a < 1 ? `inset(0 ${w / 2}px 0 0)` : undefined;
  const lift = (1 - a) * 0.04 + (1 - appear) * 0.08;
  const sh = 1 - a;
  const flapShade = (k: number) => Math.sin(Math.max(0, Math.min(1, k)) * Math.PI) * 0.35;
  const creased = (
    <>
      <CrumpleLayer seed={seed} orientation={orientation} paper={paper} amount={crumple} density={DENSITY} />
      <svg width={w} height={h} style={{ position: "absolute", inset: 0, opacity: crumple }}>
        <line x1={w / 2} y1={0} x2={w / 2} y2={h} stroke={withOpacity(PAPER_SHADE, 0.35)} strokeWidth={2} />
        <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke={withOpacity(PAPER_SHADE, 0.35)} strokeWidth={2} />
      </svg>
    </>
  );
  // A flap = the scene (plus the crumples) cropped to its region, hinged on the fold line.
  const flap = (key: string, left: number, top: number, fw: number, fh: number, origin: string, transform: string, shade: number, dir: string) => (
    <AbsoluteFill key={key} style={{ perspective: persp, perspectiveOrigin: `${w / 2}px ${h / 2}px` }}>
      <div style={{ position: "absolute", left, top, width: fw, height: fh, overflow: "hidden", transformOrigin: origin, transform }}>
        <div style={{ position: "absolute", left: -left, top: -top, width: w, height: h }}>
          {children}
          {creased}
        </div>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${dir}, ${withOpacity("#000000", shade)} 0%, transparent 70%)` }} />
      </div>
    </AbsoluteFill>
  );
  return {
    outer: {
      zIndex: 2,
      opacity: appear,
      transform: `translate(${((1 - a) * w) / 4}px, ${((1 - b) * h) / 4}px) scale(${(1 + lift).toFixed(4)})`,
      transformOrigin: `${(w / 4) * (1 + a)}px ${(h / 4) * (1 + b)}px`,
      filter: sh > 0.002 ? `drop-shadow(0 ${(6 + sh * 14).toFixed(1)}px ${(10 + sh * 16).toFixed(1)}px rgba(0,0,0,${(0.12 + sh * 0.14).toFixed(3)}))` : undefined,
    },
    behind: (
      <>
        {b < 1 ? flap("bl", 0, h / 2, w / 2, h / 2, "50% 0%", `rotateX(${(-(1 - b) * 180).toFixed(2)}deg)`, flapShade(1 - b), "180deg") : null}
        {a < 1 && b >= 1 ? flap("r", w / 2, 0, w / 2, h, "0% 50%", `rotateY(${((1 - a) * 180).toFixed(2)}deg)`, flapShade(1 - a), "90deg") : null}
      </>
    ),
    mid: clip ? { clipPath: clip } : undefined,
    innerOverlay: crumple > 0.001 ? creased : null,
  };
};

/**
 * Exit: the page is crumpled hard into a ball while it is dragged off to the right,
 * rolling as it goes, until it has left the frame and only the desk remains. Smooth
 * motion throughout — no shake.
 */
const crumpleDrag = ({ t, w, h, seed, orientation, depth, paper, ink, seconds, children }: Ctx): Spec => {
  const r = Math.min(w, h) * 0.13;
  const crumple = seg(t, 0, 0.55, Easing.bezier(0.3, 0.1, 0.5, 1));
  const open = 1 - crumple;
  // One smooth squash as it balls up (no jitter), then it rolls away to the right.
  const squash = Math.sin(seg(t, 0.45, 0.62) * Math.PI) * 0.12;
  const drag = seg(t, 0.18, 1, Easing.in(Easing.quad));
  const travel = drag * (w / 2 + r * 3);
  const cx = w / 2 + travel;
  const cy = h / 2 + drag * h * 0.06;
  // Crumpled straight in (no turning); the ball only starts rolling once it is balled up.
  const balledAt = seg(0.55, 0.18, 1, Easing.in(Easing.quad)) * (w / 2 + r * 3);
  const rotation = ((Math.max(0, travel - balledAt) / r) * 180) / Math.PI;
  const sx = 1 + squash * 0.8;
  const sy = 1 - squash;
  const outline = paperBallOutline(open, cx, cy, r, rotation, w, h, seconds, seed);
  const k = 1 - crumple * (1 - (2.2 * r) / Math.min(w, h));
  const fade = 1 - seg(t, 0.04, 0.4);
  return {
    outer: { zIndex: 2 },
    behind: (
      <>
        <AbsoluteFill style={{ background: CRUMPLED_DESK }} />
        {cx - r * 2 < w ? (
          <AbsoluteFill style={{ filter: `drop-shadow(0 ${(12 + crumple * 10).toFixed(1)}px ${(18 + crumple * 10).toFixed(1)}px rgba(0,0,0,${(0.12 + crumple * 0.14).toFixed(3)}))` }}>
            <PaperBall
              open={open}
              cx={cx}
              cy={cy}
              r={r}
              rotation={rotation}
              scaleX={sx}
              scaleY={sy}
              palette={paperPalette({ bgColor: paper, textColor: ink })}
              seed={seed}
              density={DENSITY}
              depth={depth ?? 1}
              orientation={orientation}
            />
          </AbsoluteFill>
        ) : null}
      </>
    ),
    mid: { clipPath: outline, opacity: fade },
    inner: {
      transform: `translate(${(cx - w / 2).toFixed(1)}px, ${(cy - h / 2).toFixed(1)}px) scale(${k.toFixed(4)})`,
      transformOrigin: "50% 50%",
    },
  };
};

/** Nominal entry length; capped at 30% of the scene. */
const ENTRY_FRAMES = 48;

/** Nominal exit length; capped at 35% of the scene. */
const EXIT_FRAMES = 54;

export const StickyList: React.FC<SceneLayoutProps> = (props) => {
  const { frame: sceneFrame, width, height, fps, portrait, pal, font, pad } = useCrumpledScene(props);
  const total = props.sceneDurationInFrames ?? 300;
  const entryLen = Math.min(ENTRY_FRAMES, Math.floor(total * 0.3));
  // Heading, scraps and ticks start as the sheet finishes unfolding.
  const frame = sceneFrame - Math.round(entryLen * 0.85);
  const p = portrait;
  // Default sizes — must match backend/templates/crumpled/meta.json; Template Studio rewrites these literals.
  const type = getCrumpledTypography(props, (titleFontSize, descriptionFontSize) => ({
    title: titleFontSize ?? (p ? 123 : 97),
    body: descriptionFontSize ?? (p ? 66 : 53),
  }));
  const seed = props.seed ?? 53;
  const sheet = scenePaper(props, seed, 0);
  const heading = (props.heading || props.title || "").trim();
  // 3 to 4 scraps: the given items, topped up from the narration's sentences if short.
  const raw = (props.items || []).map((s) => String(s).trim()).filter(Boolean);
  const items = [...raw];
  const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  for (const extra of sentences(props.narration, 6)) {
    if (items.length >= 3) break;
    if (!items.some((it) => norm(it) === norm(extra))) items.push(extra);
  }
  items.splice(4);
  const n = Math.max(1, items.length);
  // The scene's display text, written under the heading (as in the other scenes).
  const body = (props.body || props.narration || "").trim();

  const headIn = ease(frame, 0, 28, Easing.inOut(Easing.quad));
  const bodyIn = ease(frame, 14, 44, Easing.linear);
  const headH = portrait ? height * 0.11 : height * 0.14;
  const underY = pad.top + Math.min(headH, type.title * 1.2) + 6;
  const bodyTop = underY + (portrait ? 44 : 36);
  const bodyH = body ? (portrait ? height * 0.12 : height * 0.13) : 0;
  const areaTop = (body ? bodyTop + bodyH : pad.top + headH) + (portrait ? 50 : 34);
  const areaH = height - areaTop - pad.bottom;
  const areaW = width - pad.x * 2;

  // Grid
  const cols = portrait ? 1 : n <= 4 ? n : 3;
  const rows = Math.ceil(n / cols);
  const gapX = portrait ? 0 : 46;
  const gapY = portrait ? 34 : 46;
  const cardW = portrait ? areaW * 0.9 : (areaW - gapX * (cols - 1)) / cols;
  const cardH = Math.min(portrait ? 260 : 420, (areaH - gapY * (rows - 1)) / rows);
  const gridH = rows * cardH + (rows - 1) * gapY;
  const gridTop = areaTop + Math.max(0, (areaH - gridH) / 2);

  // Primary: heading ← title slider, every item ← body slider.
  const itemSize = type.body;

  const cards = items.map((text, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inRow = Math.min(cols, n - r * cols);
    const rowOffset = portrait ? 0 : ((cols - inRow) * (cardW + gapX)) / 2;
    const x = pad.x + (portrait ? (i % 2 === 0 ? 0 : areaW - cardW) : rowOffset + c * (cardW + gapX));
    const y = gridTop + r * (cardH + gapY);
    const tilt = (rand(seed + i * 5.1) - 0.5) * (portrait ? 3 : 5);
    const start = 30; // every scrap is stuck down at the same moment
    return { text, i, x, y, tilt, start };
  });

  const content = (
    <AbsoluteFill style={{ fontFamily: font, color: pal.ink, overflow: "hidden" }}>
      <PaperBackdrop paper={pal.paper} ink={pal.ink} seed={sheet.seed} orientation={sheet.orientation} density={9} depth={sheet.depth} />

      <div style={{ position: "absolute", left: pad.x, top: pad.top, width: areaW }}>
        <Written progress={headIn}>
          <FitText
            targetPx={type.title}
            minPx={portrait ? 44 : 38}
            maxHeightPx={headH}
            maxWidthPx={areaW}
            fitKey={`sl-head:${heading}:${portrait}`}
            exact={type.titleIsUserSet}
            style={{ fontWeight: 700, lineHeight: 1.02 }}
          >
            {heading}
          </FitText>
        </Written>
      </div>

      {body ? (
        <div style={{ position: "absolute", left: pad.x, top: bodyTop, width: areaW, height: bodyH }}>
          <Written progress={bodyIn} mode="block">
            <FitText
              targetPx={type.bodyRelative(portrait ? 54 : 46)}
              minPx={portrait ? 26 : 22}
              maxHeightPx={bodyH}
              maxWidthPx={areaW}
              fitKey={`sl-body:${body}:${portrait}`}
              exact={false}
              style={{ fontWeight: 500, lineHeight: 1.25, color: pal.inkSoft }}
            >
              {body}
            </FitText>
          </Written>
        </div>
      ) : null}

      {cards.map(({ text, i, x, y, tilt, start }) => {
        const drop = ease(frame, start, start + 18, Easing.out(Easing.back(1.6)));
        const tone = i % 2 === 0 ? pal.scrap : mix(pal.paper, "#ffffff", 0.55);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: cardW,
              height: cardH,
              opacity: Math.min(1, drop * 2),
              transform: `translateY(${(1 - drop) * -70}px) rotate(${tilt + (1 - drop) * 8}deg) scale(${1.08 - drop * 0.08})`,
              filter: `drop-shadow(0 ${8 + drop * 6}px 12px ${withOpacity(pal.ink, 0.2)})`,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: tone,
                clipPath: scrapClip(seed + i * 13),
                padding: portrait ? "26px 36px 34px 104px" : "30px 34px 40px 96px",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
              }}
            >
              <FitText
                targetPx={itemSize}
                minPx={portrait ? 30 : 26}
                maxHeightPx={cardH - (portrait ? 60 : 70)}
                maxWidthPx={cardW - (portrait ? 140 : 130)}
                fitKey={`sl-item:${text}:${portrait}:${n}`}
                exact={type.bodyIsUserSet}
                style={{ fontWeight: 600, lineHeight: 1.18 }}
              >
                {text}
              </FitText>
            </div>
            {/* A strip of masking tape at the top of every scrap. */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: -16,
                width: Math.min(150, cardW * 0.34),
                height: 36,
                transform: `translateX(-50%) rotate(${(rand(seed + i) - 0.5) * 10}deg)`,
                background: pal.tape,
              }}
            />
          </div>
        );
      })}

      <PencilLayer>
        <PencilStroke d={underlinePath(pad.x - 4, underY, Math.min(areaW * 0.4, 520), seed)} progress={ease(frame, 24, 44)} color={pal.accent} width={5} />
        {cards.map(({ i, x, y, tilt, start }) => {
          const s = portrait ? 54 : 50;
          const tx = x + (portrait ? 30 : 28);
          const ty = y + cardH / 2 + s * 0.45;
          return (
            <g key={i} transform={`rotate(${tilt} ${x + cardW / 2} ${y + cardH / 2})`}>
              <PencilStroke d={tickPath(tx, ty, s)} progress={ease(frame, start + 20, start + 32)} color={pal.accent} width={6} />
            </g>
          );
        })}
      </PencilLayer>
    </AbsoluteFill>
  );

  // Exit, in the scene's own last frames (raw frame, so it tracks the real scene end
  // and plays the same in the full video and when the scene is played on its own).
  const rawFrame = useCurrentFrame();
  const exitLen = Math.min(EXIT_FRAMES, Math.floor(total * 0.35));
  const exitT = interpolate(rawFrame, [total - exitLen, total], [0, 1], clamp);
  const entryT = entryLen > 0 ? interpolate(sceneFrame, [0, entryLen], [0, 1], clamp) : 1;
  const ctx: Ctx = {
    t: exitT,
    seconds: rawFrame / fps,
    w: width,
    h: height,
    seed: sheet.seed,
    orientation: sheet.orientation,
    depth: sheet.depth,
    paper: pal.paper,
    ink: pal.ink,
    children: content,
  };
  const spec: Spec = exitT > 0 ? crumpleDrag(ctx) : entryT < 1 ? unfold({ ...ctx, t: entryT }) : {};

  return (
    <AbsoluteFill style={{ background: exitT > 0 || entryT < 1 ? CRUMPLED_DESK : undefined }}>
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
