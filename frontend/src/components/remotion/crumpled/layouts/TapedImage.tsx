/**
 * Image-led layout — a large print drops onto the sheet and is taped down; the
 * heading and body are pencilled beside it, with a hand-drawn arrow pointing at the
 * photo and an optional handwritten caption under it.
 *
 * Entry (built in, first frames): a crumpled piece of paper torn on all sides is dragged in from the right, then zoomed
 * into until its torn edges are off-screen; then everything on it
 * (print / sketch box, heading, body, caption, arrow) is drawn at the same time, quickly.
 * Exit (built in, last frames): the page is squeezed straight into a paper ball (no turning while it crumples), which
 * is then tossed off to the left.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import type { SceneLayoutProps } from "../types";
import { PaperBackdrop } from "../components/PaperBackdrop";
import { FitText } from "../components/FitText";
import { PencilLayer, PencilStroke, arrowPaths, underlinePath } from "../components/Pencil";
import { Written, ease } from "../components/Handwriting";
import { TapedPrint } from "../components/PaperPhoto";
import { useCrumpledScene, scenePaper } from "../components/sceneKit";
import { getCrumpledTypography } from "../typography";
import { clamp, mix, rand, withOpacity, paperPalette, CRUMPLED_DESK, PAPER_SHADE } from "../crumpledStyle";
import { CrumpleLayer } from "../components/CrumpleLayer";
import { PaperBall, paperBallOutline } from "../components/PaperBall";

// ─── Exit: crumple ball ─────────────────────────────────────────────

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
  /** The scene backdrop's crease facing (so the placed sheet matches it). */
  orientation?: 0 | 1 | 2 | 3;
  /** The scene backdrop's crease depth (so a paper ball turning into the page matches it). */
  depth?: number;
  children: React.ReactNode;
}

const easeIn = Easing.in(Easing.cubic);
const easeInOut = Easing.inOut(Easing.cubic);
const easeOut = Easing.out(Easing.cubic);
const seg = (t: number, a: number, b: number, e = easeInOut) => interpolate(t, [a, b], [0, 1], { ...clamp, easing: e });
const pts = (list: Array<[number, number]>) => list.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ");

/**
 * The opening in reverse: the page — with the scene on it — crumples back into the
 * same faceted paper ball the video opens with, on a plain desk. The ball is then
 * tossed off to the left in a parabolic arc; once it has left the frame the scene
 * is over, leaving the plain desk.
 */
const crumpleBall = ({ t, w, h, seed, paper, ink, seconds, orientation, depth, children }: Ctx): Spec => {
  const crumple = seg(t, 0, 0.45, easeInOut);
  const open = 1 - crumple;
  const r = Math.min(w, h) * 0.13;
  // A quick squash as it balls up, then the throw: up and over to the left, falling off-frame.
  const squash = Math.sin(seg(t, 0.42, 0.52) * Math.PI) * 0.14;
  const u = seg(t, 0.52, 0.86, Easing.linear);
  const arc = h * 0.32;
  const cx = w / 2 - u * (w / 2 + r * 2.6);
  const cy = h / 2 - 4 * arc * u * (1 - u) + u * u * h * 0.35;
  // Squeezed straight in: no turning while it crumples; the ball only spins once thrown.
  const rotation = -u * 600;
  const outline = paperBallOutline(open, cx, cy, r, rotation, w, h, seconds, seed);
  // The scene shrinks toward the ball as the paper gathers, fading into its creases.
  const k = 1 - crumple * (1 - (2.2 * r) / Math.min(w, h));
  const fade = 1 - seg(t, 0.06, 0.42);
  // Plain desk under the crumpling page; it stays once the ball is gone.
  const desk = 1;
  return {
    outer: { zIndex: 2 },
    behind: (
      <>
        <AbsoluteFill style={{ background: CRUMPLED_DESK, opacity: desk }} />
        {u < 1 ? (
          <AbsoluteFill style={{ filter: `drop-shadow(0 ${12 + crumple * 10}px ${18 + crumple * 10}px rgba(0,0,0,${0.12 + crumple * 0.14}))` }}>
            <PaperBall
              open={open}
              cx={cx}
              cy={cy}
              r={r}
              rotation={rotation}
              scaleX={1 + squash * 0.8}
              scaleY={1 - squash}
              palette={paperPalette({ bgColor: paper, textColor: ink })}
              seed={seed}
              density={8}
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

// ─── Entry: a torn sheet dragged in from the right ─────────────

/** Frames for the sheet to be dragged into place, then for everything to be drawn. */
const PLACE_FRAMES = 48;
const DRAW_FRAMES = 22;

/** Hand drag: picks up speed, then slows as it is pulled into place. */
const dragEase = Easing.bezier(0.45, 0, 0.2, 1);

/**
 * Entry: a crumpled piece of paper, torn on ALL four sides, is dragged in from the
 * right at a smaller size (the whole ragged sheet visible on the desk), settles, and
 * then the camera zooms in until every torn edge is just off-screen — ending exactly
 * on the scene's page at identity, with the extra crumples pressed out, before the
 * drawing starts.
 *
 * The sheet is the page [0,w]×[0,h] plus a torn margin around it: paper drawn only
 * in the margin (an even-odd ring with the frame as the hole), so the scene content
 * itself is never clipped or scaled at rest.
 */
const placeSheet = ({ t, w, h, seed, paper, orientation = 0 }: Ctx): Spec => {
  const amp = Math.min(w, h) * 0.022;
  const m = amp * 2.8;
  // Torn outline around the extended sheet, walked clockwise; each point has an inward normal.
  type P = { x: number; y: number; nx: number; ny: number };
  const side = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, n: number, sd: number): P[] =>
    Array.from({ length: n }, (_, i) => {
      const u = i / n;
      const wander = Math.sin(u * Math.PI * 2.4 + sd) * amp * 0.75 + Math.sin(u * Math.PI * 6.7 + sd * 2) * amp * 0.3;
      const fibre = (rand(sd + 40 + i * 3.1) - 0.5) * amp * 1.0;
      const off = wander + fibre; // + = inward
      return { x: x0 + (x1 - x0) * u + nx * off, y: y0 + (y1 - y0) * u + ny * off, nx, ny };
    });
  const L = -m;
  const T = -m;
  const R = w + m;
  const B = h + m;
  const nH = 48;
  const nV = Math.max(16, Math.round((nH * h) / w));
  const ring: P[] = [
    ...side(L, T, R, T, 0, 1, nH, seed + 1),
    ...side(R, T, R, B, -1, 0, nV, seed + 2),
    ...side(R, B, L, B, 0, -1, nH, seed + 3),
    ...side(L, B, L, T, 1, 0, nV, seed + 4),
  ];
  const edge = ring.map((q) => [q.x, q.y] as [number, number]);
  // The top surface layer tears a little further in: between the two, the white fibre band.
  const layer = ring.map((q, i) => {
    const d = amp * (0.15 + rand(seed + 90 + i * 1.7) * 0.45);
    return [q.x + q.nx * d, q.y + q.ny * d] as [number, number];
  });
  const closed = (l: Array<[number, number]>) => l.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") + " Z";
  const hole = `M0 0 L0 ${h} L${w} ${h} L${w} 0 Z`;
  const fibres = ring
    .filter((_, i) => i % 2 === 0)
    .map((q, i) => {
      const len = amp * (0.12 + rand(seed + 300 + i) * 0.35);
      const a = (rand(seed + 400 + i) - 0.5) * 1.6;
      // outward, with a little sideways scatter
      const ox = -q.nx * Math.cos(a) - q.ny * Math.sin(a);
      const oy = -q.ny * Math.cos(a) + q.nx * Math.sin(a);
      return `M${q.x.toFixed(1)} ${q.y.toFixed(1)} l${(ox * len).toFixed(1)} ${(oy * len).toFixed(1)}`;
    })
    .join(" ");

  // Motion: drag in small → settle → zoom in to the page.
  const drag = dragEase(seg(t, 0, 0.55, Easing.linear));
  const k = 1 - drag;
  const wobble = Math.sin(seg(t, 0.5, 0.64, Easing.linear) * Math.PI) * 0.7;
  const zoom = seg(t, 0.62, 1, easeInOut);
  const small = 0.78;
  const scale = small + (1 - small) * zoom + k * 0.03;
  const rot = (k * 6 - wobble) * (1 - zoom);
  const crumple = 1 - seg(t, 0.66, 1, easeInOut);
  const sh = 1 - zoom;
  // Stretch the crumple overlay over the whole extended sheet, clipped to its torn surface.
  const sx = (w + 2 * m) / w;
  const sy = (h + 2 * m) / h;
  return {
    mid: {
      transform: `translate(${(k * w * 1.05).toFixed(1)}px, ${(k * h * 0.05).toFixed(1)}px) rotate(${rot.toFixed(3)}deg) scale(${scale.toFixed(4)})`,
      transformOrigin: "50% 50%",
      filter: sh > 0.002 ? `drop-shadow(${(-4 - k * 10).toFixed(1)}px ${(6 + k * 14).toFixed(1)}px ${(10 + k * 16).toFixed(1)}px rgba(0,0,0,${((0.16 + k * 0.12) * sh).toFixed(3)}))` : undefined,
    },
    midOverlay: (
      <>
        <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {/* the torn margin: fibre band, then the paper's surface (ring with the page as the hole) */}
          <path d={`${closed(edge)} ${hole}`} fillRule="evenodd" fill={mix(paper, "#ffffff", 0.82)} />
          {/* matches the page's own edge tone (its vignette darkens the rim) so no seam shows at the frame line */}
          <path d={`${closed(layer)} ${hole}`} fillRule="evenodd" fill={mix(paper, PAPER_SHADE, 0.06)} />
        </svg>
        <AbsoluteFill style={{ clipPath: `polygon(${pts(layer)})` }}>
          <AbsoluteFill style={{ transform: `scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`, transformOrigin: "50% 50%" }}>
            <CrumpleLayer seed={seed} orientation={orientation} paper={paper} amount={crumple} />
          </AbsoluteFill>
        </AbsoluteFill>
        <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <path d={closed(layer)} fill="none" stroke={withOpacity(PAPER_SHADE, 0.22)} strokeWidth={1.4} strokeLinejoin="round" />
          <path d={fibres} fill="none" stroke={withOpacity("#ffffff", 0.95)} strokeWidth={1.3} strokeLinecap="round" />
          <path d={closed(edge)} fill="none" stroke={withOpacity(PAPER_SHADE, 0.18)} strokeWidth={1} strokeLinejoin="round" />
        </svg>
      </>
    ),
  };
};

/** Nominal exit length; capped at 35% of the scene. */
const EXIT_FRAMES = 72;

export const TapedImage: React.FC<SceneLayoutProps> = (props) => {
  const { frame, width, height, fps, portrait, pal, font, pad } = useCrumpledScene(props);
  const p = portrait;
  // Default sizes — must match backend/templates/crumpled/meta.json; Template Studio rewrites these literals.
  const type = getCrumpledTypography(props, (titleFontSize, descriptionFontSize) => ({
    title: titleFontSize ?? (p ? 121 : 103),
    body: descriptionFontSize ?? (p ? 78 : 64),
  }));
  const seed = props.seed ?? 23;
  const sheet = scenePaper(props, seed, 2);
  const heading = (props.heading || props.title || "").trim();
  const body = (props.body || props.narration || "").trim();
  const caption = (props.imageCaption || "").trim();
  const hasMedia = Boolean(props.imageUrl || props.videoUrl);

  // Geometry: landscape = print left, copy right; portrait = print top, copy below.
  const gap = portrait ? 90 : 110;
  const photoW = portrait ? width - pad.x * 2 - 20 : width * 0.47;
  const photoH = portrait ? height * 0.33 : height - pad.top - pad.bottom - (caption ? 70 : 10);
  const photoX = portrait ? pad.x + 10 : pad.x;
  const photoY = portrait ? pad.top + 20 : pad.top;
  const textX = portrait ? pad.x : photoX + photoW + gap;
  const textY = portrait ? photoY + photoH + (caption ? 150 : 100) : pad.top + height * 0.08;
  const textW = portrait ? width - pad.x * 2 : width - textX - pad.x;
  const textH = portrait ? height - textY - pad.bottom : height - textY - pad.bottom;

  // The sheet is laid down blank; then everything is drawn at once, quickly.
  const place = interpolate(frame, [0, PLACE_FRAMES], [0, 1], clamp);
  const d0 = PLACE_FRAMES;
  const d1 = PLACE_FRAMES + DRAW_FRAMES;
  const drop = ease(frame, d0, d1, Easing.out(Easing.back(1.25)));
  const headIn = ease(frame, d0, d1, Easing.inOut(Easing.quad));
  const bodyIn = ease(frame, d0, d1, Easing.linear);
  const arrowIn = ease(frame, d0, d1 - 5);
  const arrowHeadIn = ease(frame, d1 - 6, d1);
  const capIn = ease(frame, d0, d1);

  const headMaxH = textH * 0.36;
  const arrow = portrait
    ? arrowPaths(width - pad.x - 40, textY - 20, width - pad.x - 110, photoY + photoH - 20, -0.3, seed)
    : arrowPaths(textX + 200, pad.top + 6, photoX + photoW - 26, pad.top + 92, 0.35, seed);

  // No-image layout: title (left / top) → arrow → explanation (right / below).
  const nm = (() => {
    if (portrait) {
      const titleX = pad.x;
      const titleY = pad.top + 20;
      const titleW = width - pad.x * 2;
      const titleH = height * 0.3;
      const bodyY = titleY + titleH + height * 0.1;
      return {
        titleX,
        titleY,
        titleW,
        titleH,
        underW: Math.min(titleW * 0.6, 520),
        bodyX: pad.x + 40,
        bodyY,
        bodyW: width - pad.x * 2 - 40,
        bodyH: height - bodyY - pad.bottom,
        arrow: arrowPaths(pad.x + titleW * 0.45, titleY + titleH + 10, pad.x + titleW * 0.3, bodyY - 24, 0.4, seed),
      };
    }
    const titleX = pad.x;
    const titleW = width * 0.38;
    const titleH = height * 0.5;
    const titleY = (height - titleH) / 2 - 20;
    const bodyX = titleX + titleW + width * 0.13;
    const bodyY = pad.top + 30;
    return {
      titleX,
      titleY,
      titleW,
      titleH,
      underW: Math.min(titleW * 0.75, 560),
      bodyX,
      bodyY,
      bodyW: width - bodyX - pad.x,
      bodyH: height - bodyY - pad.bottom - 30,
      // From just past the underline's end, arcing over to the start of the explanation.
      arrow: arrowPaths(titleX + Math.min(titleW * 0.75, 560) + 40, height / 2 + 40, bodyX - 30, height / 2 - 30, -0.35, seed),
    };
  })();

  const content = (
    <AbsoluteFill style={{ fontFamily: font, color: pal.ink, overflow: "hidden" }}>
      <PaperBackdrop paper={pal.paper} ink={pal.ink} seed={sheet.seed} orientation={sheet.orientation} density={8} depth={sheet.depth} />

      <div
        style={{
          position: "absolute",
          left: photoX,
          top: photoY,
          opacity: Math.min(1, drop * 1.6),
          transform: `translateY(${(1 - drop) * -60}px) scale(${1.12 - drop * 0.12}) rotate(${(1 - drop) * 6}deg)`,
          transformOrigin: "50% 0%",
        }}
      >
        {hasMedia ? (
          <TapedPrint scene={props} palette={pal} width={photoW} height={photoH} tilt={portrait ? -1.2 : -2.4} border={portrait ? 16 : 18} />
        ) : null}
      </div>

      {caption && hasMedia ? (
        <div style={{ position: "absolute", left: photoX, top: photoY + photoH + (portrait ? 34 : 22), width: photoW, textAlign: "center" }}>
          <Written progress={capIn}>
            <FitText
              targetPx={type.bodyRelative(portrait ? 40 : 32)}
              minPx={portrait ? 28 : 24}
              maxHeightPx={portrait ? 90 : 60}
              maxWidthPx={photoW}
              fitKey={`ti-cap:${caption}:${portrait}`}
              exact={false}
              style={{ fontWeight: 500, color: pal.inkSoft, lineHeight: 1.1 }}
            >
              {caption}
            </FitText>
          </Written>
        </div>
      ) : null}

      {hasMedia ? (
      <div style={{ position: "absolute", left: textX, top: textY, width: textW, display: "flex", flexDirection: "column" }}>
        <Written progress={headIn}>
          <FitText
            targetPx={type.title}
            minPx={portrait ? 44 : 38}
            maxHeightPx={headMaxH}
            maxWidthPx={textW}
            fitKey={`ti-head:${heading}:${portrait}`}
            exact={type.titleIsUserSet}
            style={{ fontWeight: 700, lineHeight: 1.02 }}
          >
            {heading}
          </FitText>
        </Written>
        <div style={{ height: portrait ? 40 : 34 }} />
        <Written progress={bodyIn} mode="block">
          <FitText
            targetPx={type.body}
            minPx={portrait ? 32 : 28}
            maxHeightPx={Math.max(120, textH - headMaxH - 40)}
            maxWidthPx={textW}
            fitKey={`ti-body:${body}:${portrait}`}
            exact={type.bodyIsUserSet}
            style={{ fontWeight: 500, lineHeight: 1.3, color: pal.inkSoft }}
          >
            {body}
          </FitText>
        </Written>
      </div>
      ) : (
        <>
          {/* No image: the title on the left, underlined in the accent pencil … */}
          <div
            style={{
              position: "absolute",
              left: nm.titleX,
              top: nm.titleY,
              width: nm.titleW,
              height: nm.titleH,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <Written progress={headIn}>
              <FitText
                targetPx={type.title * 1.15}
                minPx={portrait ? 48 : 44}
                maxHeightPx={nm.titleH - 60}
                maxWidthPx={nm.titleW}
                fitKey={`ti-nm-head:${heading}:${portrait}`}
                exact={type.titleIsUserSet}
                style={{ fontWeight: 700, lineHeight: 1.02 }}
              >
                {heading}
              </FitText>
            </Written>
            <PencilLayer width={nm.underW} height={30} style={{ marginTop: 14, marginLeft: -6 }}>
              <PencilStroke d={underlinePath(2, 12, nm.underW - 24, seed)} progress={headIn} color={pal.accent} width={5} />
            </PencilLayer>
          </div>
          {/* … and the explanation on the right, with an arrow from the title to it. */}
          <div
            style={{
              position: "absolute",
              left: nm.bodyX,
              top: nm.bodyY,
              width: nm.bodyW,
              height: nm.bodyH,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <Written progress={bodyIn} mode="block">
              <FitText
                targetPx={type.body}
                minPx={portrait ? 32 : 28}
                maxHeightPx={nm.bodyH}
                maxWidthPx={nm.bodyW}
                fitKey={`ti-nm-body:${body}:${portrait}`}
                exact={type.bodyIsUserSet}
                style={{ fontWeight: 500, lineHeight: 1.3, color: pal.inkSoft }}
              >
                {body}
              </FitText>
            </Written>
          </div>
          <PencilLayer>
            <PencilStroke d={nm.arrow.shaft} progress={arrowIn} color={pal.accent} width={4.5} double={false} />
            <PencilStroke d={nm.arrow.head} progress={arrowHeadIn} color={pal.accent} width={4.5} double={false} />
          </PencilLayer>
        </>
      )}

      {hasMedia ? (
        <PencilLayer>
          <PencilStroke d={arrow.shaft} progress={arrowIn} color={pal.accent} width={4.5} double={false} />
          <PencilStroke d={arrow.head} progress={arrowHeadIn} color={pal.accent} width={4.5} double={false} />
        </PencilLayer>
      ) : null}
    </AbsoluteFill>
  );

  // Exit, in the scene's own last frames (raw frame, so it tracks the real scene end
  // and plays the same in the full video and when the scene is played on its own).
  const rawFrame = useCurrentFrame();
  const total = props.sceneDurationInFrames ?? 300;
  const exitLen = Math.min(EXIT_FRAMES, Math.floor(total * 0.35));
  const exitT = interpolate(rawFrame, [total - exitLen, total], [0, 1], clamp);
  const ctx: Ctx = { t: exitT, seconds: rawFrame / fps, w: width, h: height, seed: sheet.seed, orientation: sheet.orientation, depth: sheet.depth,
    paper: pal.paper, ink: pal.ink, children: content };
  const spec: Spec = exitT > 0 ? crumpleBall(ctx) : place < 1 ? placeSheet({ ...ctx, t: place }) : {};

  return (
    <AbsoluteFill style={{ background: exitT > 0 || place < 1 ? CRUMPLED_DESK : undefined }}>
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
