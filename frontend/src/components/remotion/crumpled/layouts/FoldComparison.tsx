/**
 * Two-sided layout — two taped sticky notes side by side (stacked in portrait), each
 * with a pencilled label and its text, and a scribbled "vs" between them.
 *
 * Entry (built in, first frames): the whole page arrives folded in half and swings open along the crease.
 *
 * Exit (built in, last frames of the scene): the page folds in half and the scene ends on the folded sheet.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import type { SceneLayoutProps } from "../types";
import { PaperBackdrop } from "../components/PaperBackdrop";
import { FitText } from "../components/FitText";
import { PencilLayer, PencilStroke, scribbleCirclePath, underlinePath } from "../components/Pencil";
import { Written, ease } from "../components/Handwriting";
import { sentences, useCrumpledScene, scenePaper } from "../components/sceneKit";
import { getCrumpledTypography } from "../typography";
import { mix, withOpacity, clamp, rand, CRUMPLED_DESK } from "../crumpledStyle";

// ─── Exit: fold away ─────────────────────────────────────────────

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

/**
 * A sheet folding in half along its vertical centre line, then dropping away.
 * `p` = 0 → flat and in place, `p` = 1 → folded and gone (fold_away, on the
 * outgoing scene).
 */
const foldSheet = (p: number, { w, h, seed, paper, ink, children }: Ctx, zIndex: number): Spec => {
  // The right half swings over the left and the scene ends on the folded sheet
  // (it does not drop away).
  const fold = seg(p, 0, 1, easeInOut);
  const away = 0;
  const shade = Math.sin(fold * Math.PI); // darkest while the flap stands upright
  const back = mix(paper, ink, 0.07);
  const dir = rand(seed) > 0.5 ? 1 : -1;
  return {
    outer: {
      zIndex,
      // A little fade-out as the fold finishes.
      opacity: 1 - seg(p, 0.72, 1, Easing.in(Easing.quad)),
      perspective: Math.max(w, h) * 1.6,
      transform: `translate(${dir * away * w * 0.3}px, ${away * h * 0.85}px) scale(${1 - away * 0.55}) rotate(${dir * away * 14}deg)`,
      transformOrigin: "50% 50%",
      filter: `drop-shadow(0 ${14 + away * 30}px ${22 + away * 16}px rgba(0,0,0,${0.22 * (1 - away * 0.4)}))`,
    },
    inner: { clipPath: "inset(0 50% 0 0)" },
    innerOverlay: <AbsoluteFill style={{ background: `linear-gradient(90deg, transparent 70%, ${withOpacity(ink, 0.18 * shade)} 100%)` }} />,
    extras: (
      <div
        style={{
          position: "absolute",
          left: w / 2,
          top: 0,
          width: w / 2,
          height: h,
          transformStyle: "preserve-3d",
          transformOrigin: "0% 50%",
          transform: `rotateY(${-fold * 180}deg)`,
        }}
      >
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
          <div style={{ position: "absolute", left: -w / 2, top: 0, width: w, height: h }}>{children}</div>
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${withOpacity(ink, 0.32 * shade)} 0%, ${withOpacity(ink, 0.08 * shade)} 60%, transparent 100%)` }} />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(270deg, ${back} 0%, ${mix(back, "#ffffff", 0.35)} 55%, ${mix(back, ink, 0.12)} 100%)`,
            transform: "rotateY(180deg)",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        />
      </div>
    ),
  };
};

/** Nominal exit length; capped at 35% of the scene. */
const EXIT_FRAMES = 40;

/** Nominal entry length; capped at 30% of the scene. */
const ENTRY_FRAMES = 40;

/** Clip-path for a sticky note with a torn bottom edge (as in the Sticky List scene). */
const noteClip = (seed: number) => {
  const bottom = Array.from({ length: 15 }, (_, i) => {
    const x = 100 - (i / 14) * 100;
    const y = 94 + rand(seed + i * 2.7) * 6;
    return `${x.toFixed(1)}% ${y.toFixed(1)}%`;
  }).join(", ");
  return `polygon(0% 1%, 30% 0%, 70% 1.5%, 100% 0%, ${bottom}, 0% 96%)`;
};

/**
 * Entry: the WHOLE page (background and all) arrives folded in half — the right half
 * (bottom half in portrait) folded over the front — centred on the desk, and swings
 * open toward the viewer along the crease. The flap is a copy of the scene in 3D,
 * showing the paper's back while it is still folded over.
 */
const unfoldPage = (t: number, w: number, h: number, portrait: boolean, paper: string, ink: string, children: React.ReactNode): Spec => {
  const appear = seg(t, 0, 0.15, easeOut);
  const open = seg(t, 0.12, 0.9);
  const crease = Math.sin(open * Math.PI);
  const persp = Math.max(w, h) * 1.4;
  const k = 1 - open;
  const shadeDir = portrait ? "180deg" : "90deg";
  return {
    outer: {
      zIndex: 2,
      opacity: appear,
      transform: portrait ? `translateY(${((k * h) / 4).toFixed(1)}px) scale(${(1 + (1 - appear) * 0.06).toFixed(4)})` : `translateX(${((k * w) / 4).toFixed(1)}px) scale(${(1 + (1 - appear) * 0.06).toFixed(4)})`,
      transformOrigin: "50% 50%",
      filter: k > 0.002 ? `drop-shadow(0 ${(8 + k * 14).toFixed(1)}px ${(12 + k * 16).toFixed(1)}px rgba(0,0,0,${(0.12 + k * 0.14).toFixed(3)}))` : undefined,
    },
    // The flap is folded OVER the front: it starts lying on the visible half showing the
    // paper's back, and swings open toward the viewer.
    extras:
      open < 1 ? (
        <AbsoluteFill style={{ perspective: persp, perspectiveOrigin: `${w / 2}px ${h / 2}px` }}>
          <div
            style={{
              position: "absolute",
              left: portrait ? 0 : w / 2,
              top: portrait ? h / 2 : 0,
              width: portrait ? w : w / 2,
              height: portrait ? h / 2 : h,
              transformStyle: "preserve-3d",
              transformOrigin: portrait ? "50% 0%" : "0% 50%",
              transform: portrait ? `rotateX(${(k * 180).toFixed(2)}deg)` : `rotateY(${(-k * 180).toFixed(2)}deg)`,
            }}
          >
            {/* front: this half of the scene */}
            <div style={{ position: "absolute", inset: 0, overflow: "hidden", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
              <div style={{ position: "absolute", left: portrait ? 0 : -w / 2, top: portrait ? -h / 2 : 0, width: w, height: h }}>{children}</div>
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${shadeDir}, ${withOpacity(ink, 0.3 * crease)} 0%, transparent 65%)` }} />
            </div>
            {/* back of the paper */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(${portrait ? "0deg" : "270deg"}, ${mix(paper, ink, 0.1)} 0%, ${mix(paper, "#ffffff", 0.3)} 55%, ${mix(paper, ink, 0.05)} 100%)`,
                transform: portrait ? "rotateX(180deg)" : "rotateY(180deg)",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            />
          </div>
        </AbsoluteFill>
      ) : null,
    mid: open < 1 ? { clipPath: portrait ? `inset(0 0 ${h / 2}px 0)` : `inset(0 ${w / 2}px 0 0)` } : undefined,
    innerOverlay:
      open < 1 ? (
        <AbsoluteFill
          style={{
            background: portrait
              ? `linear-gradient(0deg, ${withOpacity(ink, 0.16 * crease)} 0%, transparent 18%)`
              : `linear-gradient(270deg, ${withOpacity(ink, 0.16 * crease)} 0%, transparent 18%)`,
            clipPath: portrait ? `inset(0 0 ${h / 2}px 0)` : `inset(0 ${w / 2}px 0 0)`,
          }}
        />
      ) : null,
  };
};

export const FoldComparison: React.FC<SceneLayoutProps> = (props) => {
  const { frame: sceneFrame, width, height, fps, portrait, pal, font, pad } = useCrumpledScene(props);
  const total = props.sceneDurationInFrames ?? 300;
  const entryLen = Math.min(ENTRY_FRAMES, Math.floor(total * 0.3));
  // Heading, notes and writing start as the page finishes unfolding.
  const frame = sceneFrame - Math.round(entryLen * 0.85);
  const p = portrait;
  // Default sizes — must match backend/templates/crumpled/meta.json; Template Studio rewrites these literals.
  const type = getCrumpledTypography(props, (titleFontSize, descriptionFontSize) => ({
    title: titleFontSize ?? (p ? 120 : 108),
    body: descriptionFontSize ?? (p ? 60 : 54),
  }));
  const seed = props.seed ?? 71;
  const sheet = scenePaper(props, seed, 1);
  const heading = (props.heading || props.title || "").trim();
  const fallback = sentences(props.narration, 4);
  const half = Math.ceil(fallback.length / 2);
  const leftLabel = (props.leftLabel || "").trim();
  const rightLabel = (props.rightLabel || "").trim();
  const leftText = (props.leftText || fallback.slice(0, half).join(" ")).trim();
  const rightText = (props.rightText || fallback.slice(half).join(" ")).trim();

  const headIn = ease(frame, 0, 26, Easing.inOut(Easing.quad));
  // Both sticky notes are stuck down together, then written on.
  const drop = ease(frame, 8, 26, Easing.out(Easing.back(1.5)));
  const leftIn = ease(frame, 24, 70, Easing.linear);
  const rightIn = ease(frame, 30, 76, Easing.linear);
  const vsIn = ease(frame, 26, 46);

  const headH = portrait ? height * 0.11 : height * 0.14;
  const boardTop = pad.top + headH + (portrait ? 50 : 36);
  const boardX = pad.x - (portrait ? 20 : 30);
  const boardW = width - boardX * 2;
  const boardH = height - boardTop - pad.bottom + (portrait ? 40 : 30);
  // Panel geometry (panel A = left/top, panel B = right/bottom).
  const pw = portrait ? boardW : boardW / 2;
  const ph = portrait ? boardH / 2 : boardH;
  const bX = portrait ? boardX : boardX + pw;
  const bY = portrait ? boardTop + ph : boardTop;
  // Sticky notes sit inside each half, with a gap round the "vs".
  const noteGap = portrait ? 70 : 90;
  const noteW = portrait ? boardW * 0.92 : pw - noteGap / 2;
  const noteH = portrait ? ph - noteGap / 2 : boardH * 0.94;
  // Primary: heading ← title slider, panel texts ← body slider. Panel labels are secondary.
  const labelSize = type.titleRelative(portrait ? 64 : 58);
  const textSize = type.body;
  const innerPadX = portrait ? 50 : 64;
  const innerPadY = portrait ? 40 : 56;

  const panelContent = (label: string, text: string, progress: number, key: string, accent: boolean) => (
    <div style={{ position: "absolute", inset: 0, padding: `${innerPadY}px ${innerPadX}px`, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
      {label ? (
        <Written progress={Math.min(1, progress * 2.2)}>
          <FitText
            targetPx={labelSize}
            minPx={portrait ? 38 : 32}
            maxHeightPx={noteH * 0.26}
            maxWidthPx={noteW - innerPadX * 2}
            fitKey={`fc-label-${key}:${label}:${portrait}`}
            exact={false}
            style={{ fontWeight: 700, lineHeight: 1.02, color: accent ? pal.accent : pal.ink }}
          >
            {label}
          </FitText>
        </Written>
      ) : null}
      <div style={{ height: label ? (portrait ? 22 : 30) : 0 }} />
      <Written progress={progress} mode="block">
        <FitText
          targetPx={textSize}
          minPx={portrait ? 30 : 26}
          maxHeightPx={noteH - innerPadY * 2 - 30 - (label ? noteH * 0.26 + 30 : 0)}
          maxWidthPx={noteW - innerPadX * 2}
          fitKey={`fc-text-${key}:${text}:${portrait}`}
          exact={type.bodyIsUserSet}
          style={{ fontWeight: 500, lineHeight: 1.28, color: pal.inkSoft }}
        >
          {text}
        </FitText>
      </Written>
    </div>
  );

  const content = (
    <AbsoluteFill style={{ fontFamily: font, color: pal.ink, overflow: "hidden" }}>
      <PaperBackdrop paper={pal.paper} ink={pal.ink} seed={sheet.seed} orientation={sheet.orientation} density={8} depth={sheet.depth} />

      <div style={{ position: "absolute", left: pad.x, top: pad.top, width: width - pad.x * 2 }}>
        <Written progress={headIn}>
          <FitText
            targetPx={type.title}
            minPx={portrait ? 44 : 38}
            maxHeightPx={headH}
            maxWidthPx={width - pad.x * 2}
            fitKey={`fc-head:${heading}:${portrait}`}
            exact={type.titleIsUserSet}
            style={{ fontWeight: 700, lineHeight: 1.02, textAlign: portrait ? "left" : "center" }}
          >
            {heading}
          </FitText>
        </Written>
      </div>

      {/* Two sticky notes, taped down side by side (stacked in portrait). */}
      {[
        { key: "a", label: leftLabel, text: leftText, prog: leftIn, accent: false, tone: pal.scrap, tilt: portrait ? -1.2 : -2 },
        { key: "b", label: rightLabel, text: rightText, prog: rightIn, accent: true, tone: mix(pal.paper, "#ffffff", 0.55), tilt: portrait ? 1.2 : 2 },
      ].map((nt, i) => {
        const x = portrait ? boardX + (boardW - noteW) / 2 : i === 0 ? boardX : boardX + boardW - noteW;
        const y = portrait ? (i === 0 ? boardTop : boardTop + boardH - noteH) : boardTop + (boardH - noteH) / 2;
        return (
          <div
            key={nt.key}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: noteW,
              height: noteH,
              opacity: Math.min(1, drop * 2),
              transform: `translateY(${(1 - drop) * -60}px) rotate(${nt.tilt + (1 - drop) * (i === 0 ? -6 : 6)}deg) scale(${1.06 - drop * 0.06})`,
              filter: `drop-shadow(0 ${8 + drop * 6}px 12px ${withOpacity(pal.ink, 0.2)})`,
            }}
          >
            <div style={{ position: "absolute", inset: 0, background: nt.tone, clipPath: noteClip(seed + i * 13) }}>
              {panelContent(nt.label, nt.text, nt.prog, nt.key, nt.accent)}
            </div>
            {/* masking tape across the top */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: -18,
                width: Math.min(170, noteW * 0.3),
                height: 38,
                transform: `translateX(-50%) rotate(${(rand(seed + i * 3) - 0.5) * 10}deg)`,
                background: pal.tape,
              }}
            />
          </div>
        );
      })}

      <PencilLayer>
        <PencilStroke
          d={underlinePath(portrait ? pad.x : width / 2 - Math.min(260, width * 0.15), pad.top + Math.min(headH, type.title * 1.2) + 4, Math.min(520, width * 0.3), seed)}
          progress={ease(frame, 22, 42)}
          color={pal.accent}
          width={5}
        />
        {(() => {
          const cx = width / 2;
          const cy = portrait ? boardTop + boardH / 2 : boardTop + boardH / 2;
          const r = portrait ? 58 : 62;
          return (
            <g opacity={drop}>
              <circle cx={cx} cy={cy} r={r} fill={pal.paper} />
              <PencilStroke d={scribbleCirclePath(cx, cy, r, r * 0.92, seed)} progress={vsIn} color={pal.ink} width={4} />
              <text x={cx} y={cy + r * 0.28} textAnchor="middle" fontFamily={font} fontWeight={700} fontSize={r * 0.82} fill={pal.accent} opacity={vsIn}>
                vs
              </text>
            </g>
          );
        })()}
      </PencilLayer>
    </AbsoluteFill>
  );

  // Exit, in the scene's own last frames (raw frame, so it tracks the real scene end
  // and plays the same in the full video and when the scene is played on its own).
  const rawFrame = useCurrentFrame();
  const exitLen = Math.min(EXIT_FRAMES, Math.floor(total * 0.35));
  const exitT = interpolate(rawFrame, [total - exitLen, total], [0, 1], clamp);
  const ctx: Ctx = { t: exitT, seconds: rawFrame / fps, w: width, h: height, seed, paper: pal.paper, ink: pal.ink, children: content };
  const entryT = entryLen > 0 ? interpolate(sceneFrame, [0, entryLen], [0, 1], clamp) : 1;
  const spec: Spec = exitT > 0 ? foldSheet(exitT, ctx, 2) : entryT < 1 ? unfoldPage(entryT, width, height, portrait, pal.paper, pal.ink, content) : {};

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
