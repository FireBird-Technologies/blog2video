/**
 * Main narration layout — a plain crumpled sheet of paper: a pencilled heading with
 * an underline, and the body written in line by line. An optional photo is taped beside (landscape) or below (portrait) the text.
 *
 * Entry (built in, first frames): a slightly-unfolded crumpled sheet opens out to fill the frame.
 * Exit (built in, last frames): the page is torn across the middle by two rolls — the top piece rolls up from the left
 * edge toward the right, the bottom piece from the right edge toward the left.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import type { SceneLayoutProps } from "../types";
import { PaperBackdrop } from "../components/PaperBackdrop";
import { FitText } from "../components/FitText";
import { PencilLayer, PencilStroke, underlinePath } from "../components/Pencil";
import { Written, ease } from "../components/Handwriting";
import { TapedPrint } from "../components/PaperPhoto";
import { useCrumpledScene, scenePaper } from "../components/sceneKit";
import { getCrumpledTypography } from "../typography";
import { withOpacity, clamp, mix, rand, paperPalette, CRUMPLED_DESK, PAPER_SHADE } from "../crumpledStyle";
import { PaperBall, paperBallOutline } from "../components/PaperBall";
import { CrumpleLayer } from "../components/CrumpleLayer";

// ─── Exit: tear & roll ─────────────────────────────────────────────

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
  /** The scene backdrop's crease facing (so the opening sheet matches it). */
  orientation?: 0 | 1 | 2 | 3;
  /** The scene backdrop's crease depth (so a paper ball turning into the page matches it). */
  depth?: number;
  children: React.ReactNode;
}

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


/**
 * Exit: the page is torn across the middle by two rolls travelling in opposite
 * directions. The TOP piece rolls up into a tube that starts at the left edge and
 * travels right; the BOTTOM piece rolls up into a tube that starts at the right edge
 * and travels left. The tear only exists where a roll has already passed, so the
 * page rips as the rolls go, until both pieces are rolled off and the desk shows.
 */
const tearRoll = ({ t, w, h, seed, paper, children }: Ctx): Spec => {
  const steps = 44;
  const yLeft = h * (0.46 + rand(seed + 5) * 0.08);
  const yRight = h * (0.54 - rand(seed + 6) * 0.08);
  const line = jaggedLine(0, yLeft, w, yRight, steps, Math.min(w, h) * 0.016, seed + 11);
  const yAt = (x: number) => {
    const u = Math.max(0, Math.min(steps, (x / w) * steps));
    const i = Math.min(steps - 1, Math.floor(u));
    return line[i][1] + (line[i + 1][1] - line[i][1]) * (u - i);
  };

  // Roll diameter grows with the paper wound onto it.
  const unit = Math.min(w, h);
  const dia = (wound: number) => unit * 0.04 + Math.sqrt(Math.max(0, wound)) * unit * 0.0016;
  const dMax = dia(w);
  const run = w + dMax;
  const fTop = seg(t, 0, 0.9, easeInOut) * run; // top roll front: left → right
  const fBot = w - seg(t, 0.1, 1, easeInOut) * run; // bottom roll front: right → left
  const dTop = dia(fTop);
  const dBot = dia(w - fBot);

  // Regions: intact band (both pieces still there), top-only (x > fTop & x > fBot),
  // bottom-only (x < fBot & x < fTop).
  const hi = Math.max(fTop, fBot);
  const lo = Math.min(fTop, fBot);
  const band = fTop < fBot ? `polygon(${pts([[fTop, -2], [fBot, -2], [fBot, h + 2], [fTop, h + 2]])})` : "polygon(0px 0px, 0px 0px, 0px 0px)";
  const topLine = line.filter(([x]) => x > hi);
  const botLine = line.filter(([x]) => x < lo);
  const topOnly = hi < w ? `polygon(${pts([[hi, -2], [w + 2, -2], ...[...topLine].reverse(), [hi, yAt(hi)]])})` : null;
  const botOnly = lo > 0 ? `polygon(${pts([[-2, yLeft], ...botLine, [lo, yAt(lo)], [lo, h + 2], [-2, h + 2]])})` : null;
  const fringeLine = (l: Array<[number, number]>, x0: number) => (l.length ? [[x0, yAt(x0)] as [number, number], ...l] : l);

  const shade = mix(paper, PAPER_SHADE, 0.45);
  const light = mix(paper, "#ffffff", 0.6);
  const roll = (cx: number, d: number, y0: number, y1: number, key: string) => (
    <div
      key={key}
      style={{
        position: "absolute",
        left: cx - d / 2,
        top: y0,
        width: d,
        height: Math.max(0, y1 - y0),
        borderRadius: `${d / 2}px / ${d * 0.22}px`,
        background: `linear-gradient(90deg, ${shade} 0%, ${paper} 22%, ${light} 42%, ${paper} 64%, ${shade} 100%)`,
        boxShadow: `0 ${unit * 0.012}px ${unit * 0.022}px rgba(0,0,0,0.26), inset 0 0 0 1px ${withOpacity(PAPER_SHADE, 0.25)}`,
      }}
    >
      {/* the outer wrap's edge */}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: "68%", width: 1.5, background: withOpacity(PAPER_SHADE, 0.28) }} />
    </div>
  );

  return {
    outer: { zIndex: 2 },
    inner: { clipPath: band },
    extras: (
      <>
        {topOnly ? (
          <AbsoluteFill>
            <AbsoluteFill style={{ clipPath: topOnly }}>{children}</AbsoluteFill>
            <TornFringe line={fringeLine(topLine, hi)} paper={paper} width={w} height={h} />
          </AbsoluteFill>
        ) : null}
        {botOnly ? (
          <AbsoluteFill>
            <AbsoluteFill style={{ clipPath: botOnly }}>{children}</AbsoluteFill>
            <TornFringe line={[...fringeLine([...botLine].reverse(), lo)].reverse()} paper={paper} width={w} height={h} />
          </AbsoluteFill>
        ) : null}
        {fBot > -dBot ? roll(fBot, dBot, yAt(fBot) - dBot * 0.15, h + dBot, "rb") : null}
        {fTop < w + dTop ? roll(fTop, dTop, -dTop, yAt(fTop) + dTop * 0.15, "rt") : null}
      </>
    ),
  };
};

// ─── Entry: a crumpled sheet opens out ─────────────────────────

/**
 * Entry: a loosely crumpled sheet — already slightly unfolded — sits at the centre
 * of the plain desk and simply opens out (no tumbling, no travel) until it lies flat
 * and fills the background; the scene (clipped to the sheet's silhouette) fades
 * onto it as it lands.
 */
const riseUp = ({ t, w, h, seed, paper, ink, seconds, orientation, depth }: Ctx): Spec => {
  const open = interpolate(t, [0, 1], [0.14, 1], { ...clamp, easing: easeInOut });
  const r = Math.min(w, h) * 0.2;
  const cx = w / 2;
  const cy = h / 2;
  const rotation = 0;
  const outline = paperBallOutline(open, cx, cy, r, rotation, w, h, seconds, seed);
  const land = seg(t, 0.68, 1, easeInOut);
  const sh = 1 - land;
  // Real crumpled-paper detail over the ball's big facets: a dense web of wrinkles and
  // creases, shading that darkens toward the crushed rim, a soft highlight — all
  // relaxing away as the sheet is smoothed flat into the page.
  const wrinkle = 1 - seg(t, 0.5, 1, easeInOut);
  const D = Math.hypot(w, h);
  const half = r * (1 - open) + D * 0.6 * open; // rough current half-size of the sheet
  return {
    behind: (
      <>
        <AbsoluteFill style={{ background: CRUMPLED_DESK }} />
        <AbsoluteFill
          style={{
            opacity: Math.min(1, t * 10),
            filter: `drop-shadow(0 ${(sh * 18).toFixed(1)}px ${(sh * 24).toFixed(1)}px rgba(0,0,0,${(sh * 0.22).toFixed(3)}))`,
          }}
        >
          <PaperBall open={open} cx={cx} cy={cy} r={r} rotation={rotation} palette={paperPalette({ bgColor: paper, textColor: ink })} seed={seed} density={9} depth={depth ?? 1} orientation={orientation} />
          {wrinkle > 0.001 ? (
            <AbsoluteFill style={{ clipPath: outline }}>
              <CrumpleLayer seed={seed} orientation={orientation ?? 0} paper={paper} amount={wrinkle * 0.45} density={9} />
              <AbsoluteFill
                style={{
                  opacity: wrinkle,
                  background: `radial-gradient(ellipse ${(half * 1.1).toFixed(0)}px ${(half * 0.75).toFixed(0)}px at ${cx - half * 0.15}px ${cy - half * 0.2}px, ${withOpacity("#ffffff", 0.3)} 0%, transparent 55%, ${withOpacity(PAPER_SHADE, 0.06)} 85%, ${withOpacity(PAPER_SHADE, 0.12)} 100%)`,
                }}
              />
            </AbsoluteFill>
          ) : null}
        </AbsoluteFill>
      </>
    ),
    mid: { clipPath: outline, opacity: land },
  };
};

/** Nominal entry length; capped at 30% of the scene. */
const ENTRY_FRAMES = 40;

/** Nominal exit length; capped at 35% of the scene. */
const EXIT_FRAMES = 46;

export const SketchNarration: React.FC<SceneLayoutProps> = (props) => {
  const { frame: sceneFrame, width, height, fps, portrait, pal, font, pad } = useCrumpledScene(props);
  const p = portrait;
  const total = props.sceneDurationInFrames ?? 300;
  const entryLen = Math.min(ENTRY_FRAMES, Math.floor(total * 0.3));
  // Content animations start once the sheet has landed (a little before, as it fades on).
  const frame = sceneFrame - Math.round(entryLen * 0.75);
  // Default sizes — must match backend/templates/crumpled/meta.json; Template Studio rewrites these literals.
  const type = getCrumpledTypography(props, (titleFontSize, descriptionFontSize) => ({
    title: titleFontSize ?? (p ? 117 : 131),
    body: descriptionFontSize ?? (p ? 70 : 67),
  }));
  const seed = props.seed ?? 17;
  const sheet = scenePaper(props, seed, 1);
  const heading = (props.heading || props.title || "").trim();
  const body = (props.body || props.narration || "").trim();
  const hasMedia = Boolean(props.imageUrl || props.videoUrl);

  const rule = portrait ? 74 : 62;
  const marginX = portrait ? 70 : 110;
  const left = marginX + (portrait ? 46 : 60);
  const right = pad.x;
  const top = pad.top;

  const photoW = portrait ? width - left - right : width * 0.33;
  const photoH = portrait ? height * 0.27 : height * 0.56;
  const textW = portrait || !hasMedia ? width - left - right : width - left - right - photoW - 90;

  const headIn = ease(frame, 8, 40, Easing.inOut(Easing.quad));
  const underline = ease(frame, 34, 54);
  const bodyIn = ease(frame, 40, 100, Easing.linear);
  const photoIn = ease(frame, 20, 46, Easing.out(Easing.back(1.4)));
  const marginIn = ease(frame, 0, 22);

  const headSize = type.title;
  const bodySize = type.body;
  const headMaxH = portrait ? height * 0.17 : height * 0.22;
  const bodyMaxH = portrait
    ? height - top - pad.bottom - headMaxH - (hasMedia ? photoH + 120 : 40)
    : height - top - pad.bottom - headMaxH - 50;

  const content = (
    <AbsoluteFill style={{ fontFamily: font, color: pal.ink, overflow: "hidden" }}>
      {/* Plain paper — no ruled lines or margin. */}
      <PaperBackdrop paper={pal.paper} ink={pal.ink} seed={sheet.seed} orientation={sheet.orientation} density={9} depth={sheet.depth} />

      <div
        style={{
          position: "absolute",
          left,
          top,
          width: textW,
          height: (portrait && hasMedia ? height - top - pad.bottom - photoH - 80 : height - top - pad.bottom),
          display: "flex",
          flexDirection: "column",
          justifyContent: portrait && hasMedia ? "flex-start" : "center",
        }}
      >
        <Written progress={headIn}>
          <FitText
            targetPx={headSize}
            minPx={portrait ? 44 : 38}
            maxHeightPx={headMaxH}
            maxWidthPx={textW}
            fitKey={`sn-head:${heading}:${portrait}:${hasMedia}`}
            exact={type.titleIsUserSet}
            style={{ fontWeight: 700, lineHeight: 1.02 }}
          >
            {heading}
          </FitText>
        </Written>
        <PencilLayer width={Math.min(textW * 0.55, 560)} height={30} style={{ marginTop: portrait ? 14 : 10, marginLeft: -6 }}>
          <PencilStroke d={underlinePath(2, 12, Math.min(textW * 0.55, 560) - 24, seed)} progress={underline} color={pal.accent} width={5} />
        </PencilLayer>
        <div style={{ height: portrait ? 34 : 26 }} />
        <Written progress={bodyIn} mode="block">
          <FitText
            targetPx={bodySize}
            minPx={portrait ? 32 : 28}
            maxHeightPx={Math.max(120, bodyMaxH)}
            maxWidthPx={textW}
            fitKey={`sn-body:${body}:${portrait}:${hasMedia}`}
            exact={type.bodyIsUserSet}
            style={{ fontWeight: 500, lineHeight: 1.32, color: pal.inkSoft }}
          >
            {body}
          </FitText>
        </Written>
      </div>


      {hasMedia ? (
        <div
          style={{
            position: "absolute",
            left: portrait ? left : width - right - photoW,
            top: portrait ? height - pad.bottom - photoH : (height - photoH) / 2 + 10,
            opacity: Math.min(1, photoIn * 1.4),
            transform: `translateY(${(1 - photoIn) * -40}px) scale(${0.92 + photoIn * 0.08})`,
          }}
        >
          <TapedPrint scene={props} palette={pal} width={photoW} height={photoH} tilt={portrait ? -1.5 : 2.5} />
        </div>
      ) : null}
    </AbsoluteFill>
  );

  // Exit, in the scene's own last frames (raw frame, so it tracks the real scene end
  // and plays the same in the full video and when the scene is played on its own).
  const rawFrame = useCurrentFrame();
  const exitLen = Math.min(EXIT_FRAMES, Math.floor(total * 0.35));
  const exitT = interpolate(rawFrame, [total - exitLen, total], [0, 1], clamp);
  const ctx: Ctx = { t: exitT, seconds: rawFrame / fps, w: width, h: height, seed: sheet.seed, orientation: sheet.orientation, depth: sheet.depth,
    paper: pal.paper, ink: pal.ink, children: content };
  const entryT = entryLen > 0 ? interpolate(sceneFrame, [0, entryLen], [0, 1], clamp) : 1;
  const spec: Spec = exitT > 0 ? tearRoll(ctx) : entryT < 1 ? riseUp({ ...ctx, t: entryT }) : {};

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
