/**
 * Quote layout — a strip torn from another page lies across the sheet with huge
 * pencil quote marks at its corner, the quotation written on it, and the attribution
 * signed underneath. It is all already there: it unrolls with the page.
 *
 * Entry (built in, first frames): the page is rolled open from the left — a paper roll travels right, laying it out.
 * Exit (built in, last frames): the page is rolled closed to the right — a roll starts at the left edge and winds it up.
 */
import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import type { SceneLayoutProps } from "../types";
import { PaperBackdrop } from "../components/PaperBackdrop";
import { FitText } from "../components/FitText";
import { PencilLayer, PencilStroke, quoteMarkPath, underlinePath } from "../components/Pencil";
import { Written, ease } from "../components/Handwriting";
import { useCrumpledScene, scenePaper } from "../components/sceneKit";
import { getCrumpledTypography } from "../typography";
import { mix, rand, withOpacity, clamp, CRUMPLED_DESK, PAPER_SHADE } from "../crumpledStyle";

const tornStripClip = (seed: number) => {
  const steps = 24;
  const top = Array.from({ length: steps + 1 }, (_, i) => `${((i / steps) * 100).toFixed(1)}% ${(rand(seed + i * 1.9) * 5).toFixed(1)}%`);
  const bottom = Array.from({ length: steps + 1 }, (_, i) => `${(100 - (i / steps) * 100).toFixed(1)}% ${(95 + rand(seed + 40 + i * 2.3) * 5).toFixed(1)}%`);
  return `polygon(${[...top, ...bottom].join(", ")})`;
};

// ─── Exit: tear across ─────────────────────────────────────────────

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

/**
 * The page as a scroll with a vertical roll at x = `x`. `keep` says which side of the
 * roll is flat page ("left": the page lies to the left of the roll; "right": to its
 * right); the other side is wound into the roll. `wound` is how much paper (px) is on
 * the roll, which sets its thickness. The roll is a paper tube shaded as a cylinder.
 */
const scroll = (x: number, keep: "left" | "right", wound: number, w: number, h: number, paper: string): Spec => {
  const unit = Math.min(w, h);
  const dia = unit * 0.05 + Math.sqrt(Math.max(0, wound)) * unit * 0.0026;
  const half = dia / 2;
  const clip = keep === "left" ? `inset(0 ${Math.max(0, w - x).toFixed(1)}px 0 0)` : `inset(0 0 0 ${Math.max(0, x).toFixed(1)}px)`;
  const shade = mix(paper, PAPER_SHADE, 0.42);
  const showRoll = x > -dia && x < w + dia;
  return {
    outer: { zIndex: 2 },
    inner: { clipPath: clip },
    midOverlay: showRoll ? (
      <div
        style={{
          position: "absolute",
          left: x - half,
          top: -dia * 0.25,
          width: dia,
          height: h + dia * 0.5,
          borderRadius: `${half}px / ${dia * 0.2}px`,
          background: `linear-gradient(90deg, ${shade} 0%, ${paper} 22%, ${mix(paper, "#ffffff", 0.6)} 42%, ${paper} 64%, ${shade} 100%)`,
          boxShadow: `${keep === "left" ? -1 : 1}px ${(unit * 0.012).toFixed(1)}px ${(unit * 0.022).toFixed(1)}px rgba(0,0,0,0.26), inset 0 0 0 1px ${withOpacity(PAPER_SHADE, 0.25)}`,
        }}
      >
        {/* the outer wrap's edge */}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: keep === "left" ? "30%" : "68%", width: 1.5, background: withOpacity(PAPER_SHADE, 0.3) }} />
      </div>
    ) : null,
  };
};

/** Entry t 0→1: rolled open from the left — the roll travels right, laying the page out behind it. */
const rollOpen = (t: number, w: number, h: number, paper: string): Spec => {
  const unit = Math.min(w, h);
  const x = Easing.out(Easing.cubic)(Math.max(0, Math.min(1, t))) * (w + unit * 0.2);
  return scroll(x, "left", w - x, w, h, paper);
};

/** Exit t 0→1: rolled closed to the right — the roll starts at the left edge and winds the page up as it travels right. */
const rollClosed = (t: number, w: number, h: number, paper: string): Spec => {
  const unit = Math.min(w, h);
  const x = Easing.in(Easing.cubic)(Math.max(0, Math.min(1, t))) * (w + unit * 0.2);
  return scroll(x, "right", x, w, h, paper);
};

/** Nominal entry length; capped at 30% of the scene. */
const ENTRY_FRAMES = 40;

/** Nominal exit length; capped at 35% of the scene. */
const EXIT_FRAMES = 54;

export const TornQuote: React.FC<SceneLayoutProps> = (props) => {
  const { frame: sceneFrame, width, height, portrait, pal, font, pad } = useCrumpledScene(props);
  const total = props.sceneDurationInFrames ?? 300;
  const entryLen = Math.min(ENTRY_FRAMES, Math.floor(total * 0.3));
  const p = portrait;
  // Default sizes — must match backend/templates/crumpled/meta.json; Template Studio rewrites these literals.
  const type = getCrumpledTypography(props, (titleFontSize, descriptionFontSize) => ({
    title: titleFontSize ?? (p ? 96 : 85),
    body: descriptionFontSize ?? (p ? 58 : 52),
  }));
  const seed = props.seed ?? 61;
  const sheet = scenePaper(props, seed, 2);
  const quote = (props.quote || props.narration || "").trim();
  const attribution = (props.attribution || "").trim();
  const clip = useMemo(() => tornStripClip(seed), [seed]);

  const stripW = portrait ? width - 70 : width * 0.84;
  const stripH = portrait ? height * 0.5 : height * 0.56;
  const stripX = (width - stripW) / 2;
  const stripY = portrait ? height * 0.22 : (height - stripH) / 2 - 20;
  const tilt = portrait ? -1.6 : -1.2;

  // The quote card is part of the page: already in place and fully written when the
  // page is unrolled (it arrives with the page, and leaves with it).
  const slide = 1;
  const marksIn = 1;
  const quoteIn = 1;
  const attrIn = 1;

  const innerX = stripX + (portrait ? 70 : 230);
  const innerW = stripW - (portrait ? 140 : 330);
  const innerY = stripY + (portrait ? 150 : 70);
  const innerH = stripH - (portrait ? 210 : 140);
  const markSize = portrait ? 150 : 170;
  const markX = portrait ? stripX + 60 : stripX + 50;
  const markY = portrait ? stripY + 26 : stripY + 50;

  // Primary: quote ← title slider, attribution ← body slider.
  const attrSize = type.body;
  const attrY = stripY + stripH + (portrait ? 60 : 46);

  const content = (
    <AbsoluteFill style={{ fontFamily: font, color: pal.ink, overflow: "hidden" }}>
      <PaperBackdrop paper={pal.paper} ink={pal.ink} seed={sheet.seed} orientation={sheet.orientation} density={8} depth={sheet.depth} />

      <div
        style={{
          position: "absolute",
          left: stripX,
          top: stripY,
          width: stripW,
          height: stripH,
          transform: `translateX(${(1 - slide) * -width * 0.6}px) rotate(${tilt - (1 - slide) * 4}deg)`,
          // Hidden until it starts sliding in (after the page has unrolled).
          opacity: Math.min(1, slide * 4),
          filter: `drop-shadow(0 12px 18px ${withOpacity(pal.ink, 0.22)})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: clip,
            background: `linear-gradient(178deg, ${mix(pal.paper, "#ffffff", 0.7)} 0%, ${mix(pal.paper, "#ffffff", 0.45)} 100%)`,
          }}
        >
          {/* faint lines from the page it was torn out of */}
          <svg width={stripW} height={stripH} style={{ position: "absolute", inset: 0 }}>
            {Array.from({ length: 12 }, (_, i) => (
              <line key={i} x1={0} x2={stripW} y1={40 + i * (stripH / 11)} y2={40 + i * (stripH / 11)} stroke={withOpacity(pal.ink, 0.06)} strokeWidth={1.2} />
            ))}
          </svg>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: innerX,
          top: innerY,
          width: innerW,
          height: innerH,
          display: "flex",
          alignItems: "center",
          transform: `rotate(${tilt}deg)`,
          opacity: slide,
        }}
      >
        <Written progress={quoteIn} mode="block" style={{ width: "100%" }}>
          <FitText
            targetPx={type.title}
            minPx={portrait ? 40 : 34}
            maxHeightPx={innerH}
            maxWidthPx={innerW}
            fitKey={`tq-quote:${quote}:${portrait}`}
            exact={type.titleIsUserSet}
            style={{ fontWeight: 600, lineHeight: 1.12 }}
          >
            {quote}
          </FitText>
        </Written>
      </div>

      {attribution ? (
        <div style={{ position: "absolute", right: portrait ? pad.x : stripX + 60, top: attrY, maxWidth: width * 0.7, textAlign: "right" }}>
          <Written progress={attrIn}>
            <FitText
              targetPx={attrSize}
              minPx={portrait ? 30 : 26}
              maxHeightPx={portrait ? 120 : 90}
              maxWidthPx={width * 0.7}
              fitKey={`tq-attr:${attribution}:${portrait}`}
              exact={type.bodyIsUserSet}
              style={{ fontWeight: 600, color: pal.inkSoft, whiteSpace: "nowrap" }}
            >
              — {attribution}
            </FitText>
          </Written>
        </div>
      ) : null}

      <PencilLayer>
        <g transform={`rotate(${tilt} ${stripX + stripW / 2} ${stripY + stripH / 2})`}>
          <PencilStroke d={quoteMarkPath(markX, markY, markSize)} progress={marksIn} color={pal.accent} width={portrait ? 9 : 10} fill={withOpacity(pal.accent, 0.85)} />
        </g>
        {attribution ? (
          <PencilStroke
            d={underlinePath(width - (portrait ? pad.x : stripX + 60) - Math.min(380, width * 0.3), attrY + attrSize * 1.25, Math.min(380, width * 0.3), seed)}
            progress={1}
            color={pal.ink}
            width={3.5}
            opacity={0.6}
          />
        ) : null}
      </PencilLayer>
    </AbsoluteFill>
  );

  // Exit, in the scene's own last frames (raw frame, so it tracks the real scene end
  // and plays the same in the full video and when the scene is played on its own).
  const rawFrame = useCurrentFrame();
  const exitLen = Math.min(EXIT_FRAMES, Math.floor(total * 0.35));
  const exitT = interpolate(rawFrame, [total - exitLen, total], [0, 1], clamp);
  const entryT = entryLen > 0 ? interpolate(sceneFrame, [0, entryLen], [0, 1], clamp) : 1;
  const spec: Spec = exitT > 0 ? rollClosed(exitT, width, height, pal.paper) : entryT < 1 ? rollOpen(entryT, width, height, pal.paper) : {};

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
