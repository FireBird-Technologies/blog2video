import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig, delayRender, continueRender } from "remotion";
import type { SceneLayoutProps } from "./types";
import {
  MAGAZINE_DISPLAY_FONT,
  MAGAZINE_SERIF_FONT,
  MAGAZINE_SANS_FONT,
} from "../../fonts/magazine-defaults";
import type { MagazineLayoutType, MagazineCameraMove, SceneExitVariant } from "./types";

// ── Single-scene page-mechanics EXIT motion ──────────────────────────────────
// SINGLE SCENE, ALWAYS: only ONE real page (children) is ever mounted/painted, so the
// browser preview never has to rasterise two heavy magazine pages at once — which is
// what made the dual-scene TransitionSeries overlap stutter ([[magazine-preview-paint-cost]]).
// The EXIT plays a real 3D page move over the scene's LAST `frames` (page turns / flips /
// slides / lifts / riffles away), revealing the persistent MAG_BACKDROP desk behind it;
// then the next scene flies in on ITS camera (also single-scene). The scene's ENTRY is
// the camera fly-in (useMagazineCamera). "lift" is the plain fallback.
const smooth = (x: number) => {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c); // smoothstep ease
};
const clampUnit = (x: number) => Math.max(0, Math.min(1, x));

const FLIP_PERSP = 1600; // px
const SHEET_FRONT = "linear-gradient(135deg, #f7f4ec 0%, #ffffff 58%, #efebe2 100%)";
const SHEET_BACK = "linear-gradient(to left, #FDFDFD 0%, #F1F1EF 55%, #E4E3E0 100%)";
const SHEET_EDGE_SHADE =
  "linear-gradient(to right, rgba(0,0,0,0.05) 0%, transparent 16%, transparent 78%, rgba(0,0,0,0.42) 100%)";

/** One flipping paper sheet (single-scene, GPU). `front` is the REAL page for the top
 *  sheet; decorative sheets fall back to paper. The hidden back-face shows a paper
 *  gradient once the sheet passes 90°, so content never mirrors. */
const FlipSheet: React.FC<{
  angle: number; axis: "y" | "x"; origin: string; zIndex: number; lift: number;
  front?: React.ReactNode;
}> = ({ angle, axis, origin, zIndex, lift, front }) => {
  const rot = axis === "y" ? `rotateY(${angle.toFixed(2)}deg)` : `rotateX(${angle.toFixed(2)}deg)`;
  const backRot = axis === "y" ? "rotateY(180deg)" : "rotateX(180deg)";
  const shadow = `0 ${(6 + lift * 34).toFixed(0)}px ${(14 + lift * 48).toFixed(0)}px rgba(0,0,0,${(0.1 + lift * 0.3).toFixed(2)})`;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex, transformStyle: "preserve-3d", transformOrigin: origin, transform: `perspective(${FLIP_PERSP}px) ${rot}` }}>
      <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", overflow: "hidden", background: front ? undefined : SHEET_FRONT, boxShadow: lift > 0.02 ? shadow : undefined }}>
        {front}
        {lift > 0.02 && <div style={{ position: "absolute", inset: 0, background: SHEET_EDGE_SHADE, opacity: lift, pointerEvents: "none" }} />}
      </div>
      <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: backRot, background: SHEET_BACK }} />
    </div>
  );
};

/**
 * SceneExit — a real 3D magazine PAGE MOVE over the scene's last `frames`. SINGLE
 * scene: only the one real page (children) is mounted (riffle adds a few CHEAP blank
 * paper sheets, never a second scene). The move reveals the desk behind, then the next
 * scene flies in on its own camera. One page painted at a time → smooth preview.
 */
export const SceneExit: React.FC<{ variant?: SceneExitVariant; frames?: number; children: React.ReactNode }> = ({
  variant = "lift",
  frames = 48,
  children,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // The page MOVE finishes `hold` frames before the scene ends; those last frames show
  // only the desk — a clear beat so the move completes before the next scene flies in.
  const hold = Math.min(14, Math.max(0, frames - 8));
  const e = smooth(
    interpolate(frame, [durationInFrames - Math.max(1, frames), durationInFrames - hold], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  // RIFFLE — the real page is the top sheet; N blank sheets flip R→L around the left
  // spine in staggered sequence, each revealing the one beneath, finally the desk.
  if (variant === "riffle_left" || variant === "riffle_zoom") {
    const N = 4;
    const total = N + 1;
    const gap = 0.16, fd = 0.4;
    const zoom = variant === "riffle_zoom" ? 1 + 0.5 * e : 1;
    return (
      <AbsoluteFill style={zoom !== 1 ? { transform: `scale(${zoom.toFixed(4)})`, transformOrigin: "50% 50%" } : undefined}>
        {Array.from({ length: total }).map((_, i) => {
          const li = smooth(clampUnit((e - i * gap) / fd));
          return (
            <FlipSheet key={i} angle={-180 * li} axis="y" origin="0% 50%" zIndex={total - i} lift={Math.sin(li * Math.PI)} front={i === 0 ? children : undefined} />
          );
        })}
      </AbsoluteFill>
    );
  }

  // PAGE TURN — one sheet turns around the RIGHT edge (off-screen right → desk).
  if (variant === "page_turn") {
    return <AbsoluteFill><FlipSheet angle={180 * e} axis="y" origin="100% 50%" zIndex={2} lift={Math.sin(e * Math.PI)} front={children} /></AbsoluteFill>;
  }
  // PAGE TURN BACK — one sheet turns around the LEFT edge.
  if (variant === "page_turn_back") {
    return <AbsoluteFill><FlipSheet angle={-180 * e} axis="y" origin="0% 50%" zIndex={2} lift={Math.sin(e * Math.PI)} front={children} /></AbsoluteFill>;
  }
  // FLIP UP / PAGE TURN UP — one sheet flips around the BOTTOM edge (rotateX) → desk.
  if (variant === "flip_up" || variant === "page_turn_up") {
    return <AbsoluteFill><FlipSheet angle={-180 * e} axis="x" origin="50% 100%" zIndex={2} lift={Math.sin(e * Math.PI)} front={children} /></AbsoluteFill>;
  }

  // SLIDE DOWN — the page slides straight down off the bottom, revealing the desk.
  if (variant === "slide_down") {
    const lift = Math.sin(e * Math.PI);
    return <AbsoluteFill style={{ transform: `translateY(${(e * 108).toFixed(2)}%)`, boxShadow: `0 ${(10 + lift * 26).toFixed(0)}px ${(20 + lift * 40).toFixed(0)}px rgba(0,0,0,${(0.12 + lift * 0.22).toFixed(2)})` }}>{children}</AbsoluteFill>;
  }
  // PAGE SLIDE — the page slides off to the LEFT, revealing the desk.
  if (variant === "page_slide") {
    const lift = Math.sin(e * Math.PI);
    return <AbsoluteFill style={{ transform: `translateX(${(-e * 108).toFixed(2)}%)`, boxShadow: `${(-10 - lift * 26).toFixed(0)}px 0 ${(20 + lift * 40).toFixed(0)}px rgba(0,0,0,${(0.12 + lift * 0.22).toFixed(2)})` }}>{children}</AbsoluteFill>;
  }
  // ZOOM DIVE — the page scales up toward the camera and fades onto the desk (no blur).
  if (variant === "zoom_blur") {
    const op = 1 - clampUnit((e - 0.35) / 0.65);
    return <AbsoluteFill style={{ transform: `scale(${(1 + e * 0.6).toFixed(4)})`, transformOrigin: "50% 50%", opacity: op }}>{children}</AbsoluteFill>;
  }

  // SPREAD CLOSE — two cover panels swing shut over the page at the centre spine.
  if (variant === "spread_close") {
    const a = 100 * (1 - e); // ±100° (edge-on, hidden) → 0° (flat, closed)
    const panel = (side: "l" | "r"): React.CSSProperties => ({
      position: "absolute", top: 0, bottom: 0,
      [side === "l" ? "left" : "right"]: 0, width: "50%",
      transformStyle: "preserve-3d",
      transformOrigin: side === "l" ? "100% 50%" : "0% 50%",
      transform: `perspective(${FLIP_PERSP}px) rotateY(${(side === "l" ? -a : a).toFixed(2)}deg)`,
      background: SHEET_FRONT,
      backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
      boxShadow: "0 10px 30px rgba(0,0,0,0.28)",
    });
    return (
      <AbsoluteFill>
        {children}
        <div style={panel("l")}><div style={{ position: "absolute", inset: 0, background: "linear-gradient(to left, rgba(0,0,0,0.18), transparent 32%)" }} /></div>
        <div style={panel("r")}><div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.18), transparent 32%)" }} /></div>
      </AbsoluteFill>
    );
  }

  // CORNER PEEL — the page peels back from the top-right corner, fading to desk.
  if (variant === "corner_peel") {
    const lift = Math.sin(e * Math.PI);
    return (
      <AbsoluteFill>
        <div style={{ position: "absolute", inset: 0, transformOrigin: "100% 0%", transform: `perspective(${FLIP_PERSP}px) rotate3d(-1, 1, 0, ${(95 * e).toFixed(2)}deg)`, opacity: 1 - clampUnit((e - 0.55) / 0.45), boxShadow: `0 ${(6 + lift * 30).toFixed(0)}px ${(14 + lift * 44).toFixed(0)}px rgba(0,0,0,${(0.1 + lift * 0.28).toFixed(2)})` }}>
        {children}
        <div style={{ position: "absolute", inset: 0, background: SHEET_EDGE_SHADE, opacity: lift * 0.8, pointerEvents: "none" }} />
        </div>
      </AbsoluteFill>
    );
  }

  // LIFT (fallback) — plain lift + fade to desk.
  return <AbsoluteFill style={{ opacity: 1 - e, transform: `translateY(${(-4 * e).toFixed(2)}%)` }}>{children}</AbsoluteFill>;
};

// Per-layout signature EXIT move (no two ADJACENT default scenes share one). The
// ENTRY is the camera fly-in. Override per scene via `exitAnim`.
const EXIT_ANIM_BY_LAYOUT: Record<MagazineLayoutType, SceneExitVariant> = {
  magazine_cover: "spread_close",
  editorial_quote: "page_turn",
  by_the_numbers: "riffle_left",
  interview_qa: "corner_peel",
  magazine_data_visualization: "riffle_zoom",
  timeline_journey: "page_turn",
  text_narration: "flip_up",
  ending_socials: "page_turn", // last scene has no exit; harmless default
  magazine_ticker: "riffle_left",
  colorblock: "spread_close",
  feature: "corner_peel",
  comparison: "flip_up",
};
export const exitAnimFor = (layout: MagazineLayoutType): SceneExitVariant =>
  EXIT_ANIM_BY_LAYOUT[layout] ?? "lift";
/** Exit length (frames) = the page move + a short desk-only beat. Riffles need the
 *  most room for their staggered flips. */
export const exitFramesFor = (layout: MagazineLayoutType): number => {
  const v = exitAnimFor(layout);
  if (v === "riffle_left" || v === "riffle_zoom") return 64;
  if (v === "flip_up" || v === "page_turn_up") return 52;
  return 56;
};

/**
 * Shared print-editorial design system for the Magazine template.
 *
 * Each interior scene renders as a white page-sheet resting on a dark, blurred
 * backdrop (an open magazine on a desk): a centre spine, dog-eared page-curl
 * corners and a soft drop shadow. High-contrast Playfair display, a refined
 * Source Serif body, a single red accent. Purely typographic — no photos.
 */

// ── Type ──────────────────────────────────────────────────────────────────
export const MAG_DISPLAY = MAGAZINE_DISPLAY_FONT;
export const MAG_SERIF = MAGAZINE_SERIF_FONT;
export const MAG_SANS = MAGAZINE_SANS_FONT;

// ── Default palette: white paper, near-black ink, editorial red ──────────────
export const MAG_DEFAULTS = { bg: "#FFFFFF", text: "#15110E", accent: "#D71921" };
export const MAG_BACKDROP = "#14120E";

// ── Design canvas ────────────────────────────────────────────────────────────
// The magazine is authored in fixed 1080p pixels. At render time the backend can
// force a smaller output (e.g. 1280×720 via --width/--height), which would
// otherwise shrink the percentage-based page bands while the fixed-px copy stays
// the same size → clipping + non-deterministic auto-fit. To stay resolution
// independent we render every scene on a fixed design canvas (1920×1080 /
// 1080×1920) and uniformly scale it to the real output. `MagDimsContext` carries
// the design size so layout/transition math reads the canvas — not the (smaller)
// composition — while `useMagDims` falls back to the live composition when no
// provider is present (e.g. isolated stories/tests).
export type MagDims = { width: number; height: number };
export const MagDimsContext = React.createContext<MagDims | null>(null);
export const useMagDims = (): MagDims => {
  const ctx = React.useContext(MagDimsContext);
  const { width, height } = useVideoConfig();
  return ctx ?? { width, height };
};

// ── Animation tempo ──────────────────────────────────────────────────────────
// A single global slow-motion factor for the whole Magazine template. Every
// reveal, headline tip, body-copy write-on, count-up, page-settle and camera
// breath reads its frame through `useMagFrame()`, so raising this number slows
// ALL magazine motion proportionally without having to re-tune each layout.
// >1 = slower; 1 = original speed.
export const MAG_TEMPO = 1.35;

/** The template clock, slowed by {@link MAG_TEMPO}. Use everywhere a magazine
 *  animation would otherwise call Remotion's `useCurrentFrame()` so the whole
 *  template slows in lock-step. Returns a (fractional) frame — interpolate and
 *  Math.floor both handle the fraction fine. */
export const useMagFrame = (): number => useCurrentFrame() / MAG_TEMPO;

export interface MagColors {
  bg: string;
  text: string;
  accent: string;
}

export const resolveMagColors = (props: SceneLayoutProps): MagColors => ({
  bg: props.bgColor || MAG_DEFAULTS.bg,
  text: props.textColor || MAG_DEFAULTS.text,
  accent: props.accentColor || MAG_DEFAULTS.accent,
});

export const isPortrait = (aspectRatio?: string) => aspectRatio === "portrait";

// Content padding inside the sheet, as a fraction of the frame.
export const PAD = { landscape: 0.075, portrait: 0.07 };
export const padPct = (ar?: string) => `${(isPortrait(ar) ? PAD.portrait : PAD.landscape) * 100}%`;
export const marginPct = padPct; // backwards-compatible alias

// ── Centre gutter (binding valley) ───────────────────────────────────────────
// Width of the spine/gutter in frame px. This is the single source of truth used
// by both the drawn spine (MagazineGutter) and the fold-safe layout helpers, so
// text on the two open pages is always kept clear of the binding — no copy ever
// lands on the hinge.
export const GUTTER_W = { landscape: 200, portrait: 140 };
export const gutterPx = (ar?: string) => (isPortrait(ar) ? GUTTER_W.portrait : GUTTER_W.landscape);

// rgba from a #rgb / #rrggbb hex.
export const hexToRgba = (hex: string, a: number): string => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) return `rgba(0,0,0,${a})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// ── Reveal helpers ───────────────────────────────────────────────────────────
export const useReveal = (start = 0, len = 14) => {
  const frame = useMagFrame();
  return interpolate(frame, [start, start + len], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

export const folioNumber = (n?: number) => {
  const v = typeof n === "number" && n > 0 ? n : 1;
  return v < 10 ? `0${v}` : String(v);
};

// ── 3D editorial camera ──────────────────────────────────────────────────────
// A dramatic, clearly-readable 3D camera move applied to each scene: the open
// spread swings in from a steep tilt, settles, then keeps a slow cinematic dolly
// so it never freezes dead-flat. Newspaper-inspired but tuned for the magazine's
// "open spread on a desk" — paired with PageThickness it reveals real page depth.
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

export interface EditorialCamera {
  transform: string;
  transformOrigin: string;
}

export interface EditorialCameraOpts {
  enterRotateX?: number;
  restRotateX?: number;
  enterRotateY?: number;
  restRotateY?: number;
  enterScale?: number;
  restScale?: number;
  oscRotateX?: number;
  oscRotateY?: number;
  driftY?: number;
  transformOrigin?: string;
  /** Length of the swing-in entrance (frames). Longer for the establishing shot. */
  enterFrames?: number;
}

// Six visibly-distinct camera angles, cycled per scene so consecutive spreads
// never look like the same shot. All keep a downward-ish tilt (so PageThickness
// reads consistently) but vary direction, steepness and pivot.
// All variants now read as a magazine lying flat on a table, seen from above:
// a strong downward tilt (high restRotateX) with only a slight side roll
// (small restRotateY), so the open spread sits on the surface rather than being
// held up edge-on. They still differ in steepness, roll direction and pivot so
// no two adjacent spreads are shot identically.
const CAMERA_VARIANTS: EditorialCameraOpts[] = [
  // 0 — looking down, the default top-down rest
  { enterRotateX: 26, restRotateX: 17, enterRotateY: -7, restRotateY: -3, transformOrigin: "50% 30%", oscRotateX: 1.4, oscRotateY: 0.9 },
  // 1 — mirrored slight roll to the left
  { enterRotateX: 25, restRotateX: 16, enterRotateY: 7, restRotateY: 3, transformOrigin: "50% 30%", oscRotateX: 1.4, oscRotateY: -0.9 },
  // 2 — steepest, almost straight overhead
  { enterRotateX: 30, restRotateX: 20, enterRotateY: -3, restRotateY: -1, transformOrigin: "50% 22%", driftY: -16, oscRotateX: 1.2, oscRotateY: 0.7 },
  // 3 — looking down from the upper-right, slight corner pivot
  { enterRotateX: 24, restRotateX: 15, enterRotateY: -9, restRotateY: -4, transformOrigin: "40% 32%", oscRotateX: 1.5, oscRotateY: 1.0 },
  // 4 — looking down from the upper-left
  { enterRotateX: 24, restRotateX: 15, enterRotateY: 9, restRotateY: 4, transformOrigin: "60% 32%", oscRotateX: 1.5, oscRotateY: -1.0 },
  // 5 — shallower, gentle glide
  { enterRotateX: 22, restRotateX: 14, enterRotateY: -5, restRotateY: -2, transformOrigin: "50% 38%", driftY: -14, oscRotateX: 1.2, oscRotateY: 0.8 },
];

/** Pick a camera variant deterministically from a scene seed (e.g. folio number). */
export const editorialCameraVariant = (seed: number): EditorialCameraOpts => {
  const n = Math.abs(Math.floor(seed)) % CAMERA_VARIANTS.length;
  return CAMERA_VARIANTS[n];
};

export const useEditorialCamera = (o: EditorialCameraOpts = {}): EditorialCamera => {
  const {
    enterRotateX = 26,
    restRotateX = 17,
    enterRotateY = -7,
    restRotateY = -3,
    enterScale = 1.16,
    restScale = 1.0,
    oscRotateX = 1.4,
    oscRotateY = 0.9,
    driftY = -16,
    transformOrigin = "50% 30%",
    enterFrames = 22,
  } = o;
  const frame = useMagFrame();
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  // Entrance: a strong swing-in over the first ~22 frames (eased) that settles
  // to a PERSISTENT, clearly-visible resting tilt — the spread is always read as
  // a 3D object held at an angle, never a flat card. A slow oscillation keeps it
  // alive throughout (so it reads even when an incoming transition masks the
  // entrance frames). Newspaper holds ~5°; we hold more so it's unmistakable.
  const enter = easeOutCubic(interpolate(frame, [0, enterFrames], [0, 1], cl));
  const osc = interpolate(frame, [enterFrames, 150, 300], [0, 1, 0], cl); // gentle 0→1→0 drift
  const ty = interpolate(frame, [0, 300], [0, driftY], cl);      // slow upward dolly

  const rotateX = interpolate(enter, [0, 1], [enterRotateX, restRotateX]) - osc * oscRotateX;
  const rotateY = interpolate(enter, [0, 1], [enterRotateY, restRotateY]) + osc * oscRotateY;
  // Settle from the entrance scale, then hold a slow, sustained dolly-in across
  // the whole scene so the camera always reads as gently leaning in to focus on
  // the page (rather than a one-off breath that settles dead-still).
  const push = interpolate(frame, [enterFrames, 420], [0, 0.04], cl);
  const scale = interpolate(enter, [0, 1], [enterScale, restScale]) + push;

  return {
    transform: `translateY(${ty.toFixed(2)}px) scale(${scale.toFixed(4)}) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`,
    transformOrigin,
  };
};

// ── Establishing "world" camera ───────────────────────────────────────────────
// A one-time cinematic fly-in for the opening scene: the entire world (desk +
// open spread) starts far and high — small and softly out of focus, with the
// desk visible all around it — then dollies in and racks sharp, as if a camera
// swept across the room and settled onto the magazine lying on the table. Pure
// 2D scale/translate plus a blur filter, so it wraps the existing perspective
// scene without disturbing its inner 3D. When inactive it returns identity
// values, so every other scene is left exactly as before.
export interface WorldCamera {
  transform: string;
  transformOrigin: string;
  filter: string;
}

export const useWorldCamera = (active: boolean, dur = 42): WorldCamera => {
  const frame = useMagFrame();
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  if (!active) {
    return { transform: "none", transformOrigin: "50% 50%", filter: "none" };
  }
  const t = easeOutCubic(interpolate(frame, [0, dur], [0, 1], cl));
  const scale = interpolate(t, [0, 1], [0.6, 1]); // far → full frame (dolly in)
  const ty = interpolate(t, [0, 1], [-70, 0]);    // start high (camera looks down) → settle
  // No blur: large-area filter:blur is the single biggest paint cost and makes
  // frozen frames read as a washed-out blur. Scale + translate carry the dolly.
  return {
    transform: `translateY(${ty.toFixed(1)}px) scale(${scale.toFixed(4)})`,
    transformOrigin: "50% 50%",
    filter: "none",
  };
};

// ── Cinematic camera engine ───────────────────────────────────────────────────
// A library of named camera "moves" that drive all three 3D layers of a spread
// at once: the 2D world wrap (dolly / crane / motion-blur), the perspective
// context (FOV for the dolly-zoom + an animated vanishing point) and the
// preserve-3d stage (tilt / orbit / roll of the open spread). Every move is
// frame-driven and deterministic — reusing easeOutCubic + clamped interpolate —
// so it renders identically in headless Chromium. The grammar mirrors real
// cinematography: crane, dolly-in/out, orbit/arc, dolly-zoom (Hitchcock),
// whip-pan, god's-eye flat-lay, Dutch roll and a low-angle hero.
export interface MagazineCameraState {
  /** 2D wrap around the whole desk+spread — dolly/crane translate, scale, blur. */
  world: { transform: string; transformOrigin: string; filter: string };
  /** Perspective distance (px) of the stage context — animated for the dolly-zoom. */
  perspective: number;
  /** Animated vanishing point — drives the multiplane parallax. */
  perspectiveOrigin: string;
  /** The preserve-3d open spread — tilt/orbit/roll/scale. */
  stage: { transform: string; transformOrigin: string };
  /** Current stage yaw, exposed so the gloss can rake with the camera. */
  rotateY: number;
  /** Counter-shift (px) the desk planes apply for a multiplane parallax read. */
  deskParallax: { x: number; y: number };
  /** Settle progress 0→1 after the entrance: the page flattens to a head-on pose
   *  and grows to full-bleed (drives the sheet inset + desk fade). Always 0 on the
   *  establishing/cover scene, which keeps its desk look. */
  fill: number;
}

export interface MagazineCameraOpts {
  /** First scene — a longer, steeper establishing entrance. */
  establishing?: boolean;
  /** Per-scene seed (folio) so adjacent scenes on the same move differ slightly. */
  seed?: number;
  /** transform-origin the punch-in dollies toward (e.g. a stat). */
  focal?: string;
}

/** Frame by which an interior (non-establishing) scene has finished settling to a
 *  flat, full-bleed page. Mirrors the `useMagazineCamera` settle window below
 *  (enterFrames 34 + settleStart lead 6 + settleEnd dur 48 = 88); keep the two in
 *  step. Layouts use this to time in-page effects that should only start once the
 *  page has squared up (e.g. EditorialQuote's LeftEdgeFold). */
export const INTERIOR_FILL_END_FRAME = Math.round(88 * MAG_TEMPO);

export const useMagazineCamera = (
  move: MagazineCameraMove,
  opts: MagazineCameraOpts = {},
): MagazineCameraState => {
  const { establishing = false, seed = 1, focal } = opts;
  const frame = useMagFrame();
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  // "pinned" — a fully static, head-on, full-bleed page with no frame-driven
  // motion at all (no entrance, breath, drift or zoom). Used where the copy must
  // sit dead still (e.g. the Interview Q&A reading spread).
  if (move === "pinned") {
    return {
      world: { transform: "translate(0px, 0px) scale(1)", transformOrigin: "50% 50%", filter: "none" },
      perspective: 2000,
      perspectiveOrigin: "50% 50%",
      stage: { transform: "translate(0px, 0px) scale(1) rotateX(0deg) rotateY(0deg) rotateZ(0deg)", transformOrigin: "50% 50%" },
      rotateY: 0,
      deskParallax: { x: 0, y: 0 },
      fill: 1,
    };
  }

  // Per-seed micro-variation so two adjacent scenes on the same move never read
  // as the exact same shot.
  const jitter = (Math.abs(Math.floor(seed)) % 5) - 2; // -2..2
  const restRX = 6;
  const restRY = -3 + jitter * 0.8;

  // Shared "alive" layers laid under every move so nothing ever freezes flat.
  // A smooth cosine breath (0 at 0, 1 at 150, 0 at 300, 1 at 450 …): C∞-continuous
  // so there's no velocity kink at the turnaround and it never clamps dead — the
  // triangle-wave version it replaced jerked at frame 150 and froze after 300.
  const osc = 0.5 - 0.5 * Math.cos((frame * Math.PI) / 150);
  const breatheRX = -osc * 1.3;
  const breatheRY = osc * 0.8;
  const push = interpolate(frame, [38, 672], [0, 0.04], cl); // slow sustained dolly-in

  // Quick fly-in so each scene reads as "coming into view from a distinct camera",
  // then settles and FREEZES fast. On a CPU (no GPU) every animated frame re-rasterizes
  // the whole page in software, so the entrance is kept short and the page goes fully
  // static ~1s in (see settleStart/settleEnd) — a frozen page is painted once and reused.
  // The establishing cover keeps its longer crane.
  const enterFrames = establishing ? 72 : 26;
  const e = easeOutCubic(interpolate(frame, [0, enterFrames], [0, 1], cl));

  // Defaults = the calm "breathe" baseline (matches the original editorial cam).
  let wScale = 1, wTX = 0, wTY = 0;
  let persp = 2000;
  let pOX = 50, pOY = 42;
  let rx = interpolate(e, [0, 1], [12, restRX]);
  let ry = interpolate(e, [0, 1], [-7 + jitter, restRY]);
  let rz = 0;
  let sScale = interpolate(e, [0, 1], [1.04, 1]);
  let sTX = 0;
  let sTY = interpolate(frame, [0, 480], [0, -14], cl);
  let originStr = "50% 30%";
  let ownsScale = false;

  // Each move enters from a DRAMATICALLY distinct camera pose and resolves into
  // focus (bold magnitudes — single page, GPU transforms, paint-safe under
  // lightChrome). The shared `fill` settle then squares the page up to read.
  switch (move) {
    case "crane_down": {
      // Way up high + far + small → cranes down and dollies onto the spread.
      wScale = interpolate(e, [0, 1], [0.5, 1]);
      wTY = interpolate(e, [0, 1], [-150, 0]);
      rx = interpolate(e, [0, 1], [22, restRX + 2]);
      ry = interpolate(e, [0, 1], [6, restRY]);
      sScale = interpolate(e, [0, 1], [1.06, 1]);
      pOY = interpolate(e, [0, 1], [8, 42]);
      break;
    }
    case "punch_in": {
      // Deep dolly from far back → punches into the focal point (a chart figure).
      originStr = focal ?? "50% 58%";
      wScale = interpolate(frame, [0, enterFrames, 560], [0.5, 1, 1.08], cl);
      rx = interpolate(e, [0, 1], [16, 9]);
      ry = interpolate(e, [0, 1], [-7 + jitter, restRY]);
      sScale = interpolate(e, [0, 1], [1.06, 1]);
      ownsScale = true;
      break;
    }
    case "dolly_out": {
      // Starts hard in your face → pulls way back to reveal the whole spread + desk.
      wScale = interpolate(frame, [0, enterFrames + 30], [1.35, 1], cl);
      rx = interpolate(e, [0, 1], [13, restRX + 1]);
      sScale = interpolate(e, [0, 1], [1.05, 1]);
      ownsScale = true;
      break;
    }
    case "dolly_zoom": {
      // Hitchcock vertigo: widen the FOV while counter-scaling so the sheet holds
      // its size and the desk behind rushes.
      persp = interpolate(frame, [0, 380], [950, 2900], cl);
      wScale = interpolate(frame, [0, 380], [1.08, 0.96], cl);
      rx = interpolate(e, [0, 1], [14, restRX]);
      ry = interpolate(e, [0, 1], [-7 + jitter, restRY]);
      ownsScale = true;
      break;
    }
    case "orbit_sweep": {
      // Bold arc across the spread — vanishing point tracks the other way.
      const arc = interpolate(frame, [0, 420], [22, -8], cl);
      ry = interpolate(e, [0, 1], [-75 + jitter, restRY]) + (arc - 7);
      rx = interpolate(e, [0, 1], [16, restRX]);
      pOX = interpolate(frame, [0, 420], [66, 38], cl);
      persp = 1500;
      break;
    }
    case "tracking_pan": {
      // Big lateral glide along the table edge → tracks in to face.
      wTX = interpolate(frame, [0, enterFrames + 40], [240, -10], cl);
      pOX = interpolate(frame, [0, enterFrames + 40], [36, 56], cl);
      ry = interpolate(e, [0, 1], [30 + jitter, restRY]);
      rx = interpolate(e, [0, 1], [14, restRX]);
      break;
    }
    case "whip_settle": {
      // Hard lateral whip-in that snaps into the rest pose.
      const we = easeOutCubic(interpolate(frame, [0, 26], [0, 1], cl));
      ry = interpolate(we, [0, 1], [44, restRY]);
      sTX = interpolate(we, [0, 1], [190, 0]);
      rx = interpolate(we, [0, 1], [16, restRX]);
      break;
    }
    case "gods_eye": {
      // Steep near-overhead flat-lay → tilts down to a readable angle.
      originStr = "50% 22%";
      rx = interpolate(e, [0, 1], [40, 8]);
      ry = interpolate(e, [0, 1], [0, restRY * 0.5]);
      sScale = interpolate(e, [0, 1], [1.05, 1.0]);
      ownsScale = true;
      break;
    }
    case "dutch_roll": {
      // Enters hard-rolled (Dutch angle) → levels out (tension between two columns).
      rz = interpolate(e, [0, 1], [22 + jitter, 0]);
      rx = interpolate(e, [0, 1], [14, restRX]);
      ry = interpolate(e, [0, 1], [15, restRY]);
      break;
    }
    case "low_hero": {
      // Low + close hero push: fills the frame, rises into a shallow tilt.
      rx = interpolate(e, [0, 1], [-12, 7]);
      sScale = interpolate(e, [0, 1], [1.0, 1.0]);
      wScale = interpolate(e, [0, 1], [1.25, 1]);
      wTY = interpolate(e, [0, 1], [60, 0]);
      ry = interpolate(e, [0, 1], [-6 + jitter, restRY]);
      ownsScale = true;
      break;
    }
    case "book_open": {
      // Big spread swing open around the vertical centre binding → settles flat.
      originStr = "50% 50%";
      pOX = 50;
      pOY = interpolate(e, [0, 1], [52, 42]);
      persp = 1400;
      ry = interpolate(e, [0, 1], [-85 + jitter, restRY]);
      rx = interpolate(e, [0, 1], [12, restRX]);
      sScale = interpolate(e, [0, 1], [0.88, 1]);
      break;
    }
    case "read_lift": {
      // Camera low, looking up → the page rises into the reader's eyeline.
      wTY = interpolate(e, [0, 1], [160, 0]);
      wScale = interpolate(e, [0, 1], [1.25, 1]);
      rx = interpolate(e, [0, 1], [-16, restRX]);
      ry = interpolate(e, [0, 1], [8 + jitter, restRY]);
      sScale = interpolate(e, [0, 1], [1.04, 1]);
      ownsScale = true;
      break;
    }
    case "settle_read": {
      // Strong off-angle yaw + slight roll → levels into a comfortable reading pose.
      ry = interpolate(e, [0, 1], [-28 + jitter, restRY]);
      rz = interpolate(e, [0, 1], [-8, 0]);
      rx = interpolate(e, [0, 1], [14, restRX]);
      pOX = interpolate(e, [0, 1], [58, 50]);
      sScale = interpolate(e, [0, 1], [1.04, 1]);
      break;
    }
    case "breathe":
    default:
      break;
  }

  const finalRX = rx + breatheRX;
  const finalRY = ry + breatheRY;
  const finalScale = sScale + (ownsScale ? 0 : push);

  // Desk planes counter-shift opposite the spread yaw/pitch → multiplane parallax.
  const deskPx = (finalRY - restRY) * 1.4;
  const deskPy = (finalRX - restRX) * 0.5;

  // Settle to flat + full-bleed: once the entrance has played, blend every animated
  // output toward a head-on, centered, identity pose so the page squares up and
  // (via `fill`, in MagazinePage) grows to cover the whole screen. The cover keeps
  // its desk look, so this never runs on the establishing scene.
  // Freeze FAST: settle begins as soon as the (short) entrance ends and completes ~24
  // frames later, so the page is fully static ~1s in. After that, every camera output
  // below is constant, so software (CPU) compositing repaints the page once and reuses
  // the raster for the rest of the scene — no mid-scene re-rasterization jank.
  const settleStart = enterFrames;
  const settleEnd = settleStart + 24;
  const fill = establishing
    ? 0
    : easeOutCubic(interpolate(frame, [settleStart, settleEnd], [0, 1], cl));
  const k = 1 - fill;

  const bRX = finalRX * k;
  const bRY = finalRY * k;
  const bRZ = rz * k;
  const bStageScale = finalScale * k + fill;   // → 1
  const bSTX = sTX * k;
  const bSTY = sTY * k;
  const bWScale = wScale * k + fill;           // → 1
  const bWTX = wTX * k;
  const bWTY = wTY * k;

  // Perspective + perspective-origin must freeze too. Some moves animate pOX/pOY/persp
  // by raw `frame` (e.g. orbit_sweep's pOX over [0,420]), which would keep the perspective
  // origin drifting — and the page repainting — long after the stage transform settled.
  // Blend them toward their rest defaults by the SAME k so at fill=1 the ENTIRE camera
  // output is constant frame-to-frame.
  const restPOX = 50, restPOY = 42, restPersp = 2000;
  const bPOX = pOX * k + restPOX * fill;
  const bPOY = pOY * k + restPOY * fill;
  const bPersp = persp * k + restPersp * fill;

  return {
    world: {
      transform: `translate(${bWTX.toFixed(1)}px, ${bWTY.toFixed(1)}px) scale(${bWScale.toFixed(4)})`,
      transformOrigin: "50% 50%",
      filter: "none", // no large-area blur — it's the biggest paint cost / wash source
    },
    perspective: bPersp,
    perspectiveOrigin: `${bPOX.toFixed(1)}% ${bPOY.toFixed(1)}%`,
    stage: {
      transform: `translate(${bSTX.toFixed(1)}px, ${bSTY.toFixed(1)}px) scale(${bStageScale.toFixed(4)}) rotateX(${bRX.toFixed(2)}deg) rotateY(${bRY.toFixed(2)}deg) rotateZ(${bRZ.toFixed(2)}deg)`,
      transformOrigin: originStr,
    },
    rotateY: bRY,
    deskParallax: { x: deskPx, y: deskPy },
    fill,
  };
};

// Each layout flies in from a DISTINCT bold camera (no repeats) and resolves into
// focus. All pages run lightChrome so the moving cam stays paint-light (no jitter).
const CAMERA_SIGNATURES: Record<MagazineLayoutType, MagazineCameraMove[]> = {
  magazine_cover: ["crane_down"], // way up high + far → cranes down onto the cover
  editorial_quote: ["read_lift"], // camera low, looking up → the pull-quote rises to eyeline
  by_the_numbers: ["whip_settle"], // hard lateral whip-in → snaps to rest
  interview_qa: ["settle_read"], // strong off-angle yaw → levels into the reading pose
  magazine_data_visualization: ["pinned"], // static full-bleed — CPU rasterizes once, no per-frame repaint
  timeline_journey: ["book_open"], // big spread swing open around the binding
  text_narration: ["gods_eye"], // steep near-overhead → tilts down to readable
  ending_socials: ["dolly_out"], // starts in your face → pulls way back to reveal
  magazine_ticker: ["tracking_pan"], // big lateral glide along the ledger/table edge
  colorblock: ["pinned"], // static head-on hold — orbit_sweep's big 3D arc jerked on CPU
  feature: ["pinned"], // static full-bleed read — CPU rasterizes once, no per-frame repaint
  comparison: ["dutch_roll"], // enters hard-rolled (Dutch) → levels out
};

/** The default cinematic move for a scene, varied by its folio so repeats of a
 *  layout never reuse the same shot back-to-back. */
export const signatureMoveFor = (layout: MagazineLayoutType, seed: number): MagazineCameraMove => {
  const pool = CAMERA_SIGNATURES[layout] ?? ["orbit_sweep"];
  return pool[Math.abs(Math.floor(seed)) % pool.length];
};


/**
 * The physical thickness of the open magazine — a stack of page-edge layers
 * sitting just behind the top sheet (each offset down-right and pushed back in Z)
 * so the tilt of the editorial camera reveals a real block of pages, not a flat
 * sheet. Rendered as a sibling of the sheet inside the preserve-3d camera so its
 * translateZ projects correctly. Geometry mirrors the sheet's inset rect.
 */
// Small deterministic offsets (px) giving the page stack a gently ruffled edge.
const PAGE_RUFFLE = [0, 1.4, -1.0, 0.8, -1.6, 0.4, 1.1, -0.6];

export const PageThickness: React.FC<{
  sheetInsetX: string;
  sheetInsetY: string;
  layers?: number;
}> = ({ sheetInsetX, sheetInsetY, layers = 3 }) => (
  <>
    {Array.from({ length: layers }).map((_, i) => {
      const k = layers - i; // back-most layer drawn first, furthest in Z
      // Slight per-layer jitter so the stacked edges look ruffled/hand-stacked
      // rather than a perfect machined block.
      const jx = PAGE_RUFFLE[k % PAGE_RUFFLE.length];
      const jy = PAGE_RUFFLE[(k + 3) % PAGE_RUFFLE.length];
      const dx = k * 2.4 + jx;
      const dy = k * 3.2 + jy;
      const tone = 238 - k * 4; // warm cream → soft tan toward the back
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            top: `calc(${sheetInsetY} + ${dy}px)`,
            bottom: `calc(${sheetInsetY} - ${dy}px)`,
            left: `calc(${sheetInsetX} + ${dx}px)`,
            right: `calc(${sheetInsetX} - ${dx}px)`,
            background: `linear-gradient(135deg, rgb(${tone},${tone - 7},${tone - 20}) 0%, #fffdf8 58%, rgb(${tone - 10},${tone - 16},${tone - 30}) 100%)`,
            // Only the back-most layer carries a shadow — one shadow instead of N.
            boxShadow: i === 0 ? "0 8px 18px rgba(0,0,0,0.2)" : undefined,
            transform: `translateZ(${(-k * 6).toFixed(0)}px)`,
            zIndex: i + 1,
          }}
        />
      );
    })}
  </>
);

// ── Small atoms ──────────────────────────────────────────────────────────────

export const Kicker: React.FC<{
  children: React.ReactNode;
  color: string;
  size?: number;
  style?: React.CSSProperties;
}> = ({ children, color, size = 15, style }) => (
  <div
    style={{
      fontFamily: MAG_SANS,
      fontWeight: 600,
      fontSize: size,
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      color,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Rule: React.FC<{
  color: string;
  progress?: number;
  thickness?: number;
  width?: number | string;
  opacity?: number;
  style?: React.CSSProperties;
}> = ({ color, progress = 1, thickness = 1, width = "100%", opacity = 1, style }) => (
  <div
    style={{
      width,
      height: thickness,
      background: color,
      opacity,
      transformOrigin: "left center",
      transform: `scaleX(${progress})`,
      ...style,
    }}
  />
);

/**
 * The centre spine — the binding valley between the two open pages. Soft
 * symmetric shadow with a crease and page-edge sheen.
 */
export const MagazineGutter: React.FC<{
  color: string;
  sheen: string;
  aspectRatio?: string;
  opacity?: number;
}> = ({ color, sheen, aspectRatio, opacity = 1 }) => {
  const w = gutterPx(aspectRatio);
  return (
    <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: w, transform: "translateX(-50%)", zIndex: 6, opacity, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(90deg, ${hexToRgba(color, 0)} 0%, ${hexToRgba(color, 0.05)} 30%, ${hexToRgba(color, 0.14)} 47%, ${hexToRgba(color, 0.2)} 50%, ${hexToRgba(color, 0.14)} 53%, ${hexToRgba(color, 0.05)} 70%, ${hexToRgba(color, 0)} 100%)`,
        }}
      />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: "calc(50% - 6px)", width: 2, background: hexToRgba(sheen, 0.5) }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: "calc(50% + 4px)", width: 2, background: hexToRgba(sheen, 0.5) }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 2, transform: "translateX(-50%)", background: hexToRgba(color, 0.32) }} />
    </div>
  );
};

/** Backwards-compatible no-op spine (replaced by the centre gutter). */
export const MagazineSpine: React.FC<{ color: string; aspectRatio?: string; opacity?: number }> = () => null;

// ── Fold-safe layout ──────────────────────────────────────────────────────────
/**
 * Constrains its content to a single open page (left or right of the binding),
 * keeping a half-gutter clear of the centre so copy never lands on the hinge.
 * Used by text scenes that read as one editorial column on a spread.
 */
export const PageHalf: React.FC<{
  side: "left" | "right";
  aspectRatio?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ side, aspectRatio, style, children }) => {
  const half = gutterPx(aspectRatio) / 2;
  return (
    <div
      style={{
        width: `calc(50% - ${half}px)`,
        marginLeft: side === "right" ? "auto" : undefined,
        marginRight: side === "left" ? "auto" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * Editorial marginalia that fills an otherwise-blank leaf of an open spread so
 * the page reads as an intentional composition rather than a half-empty sheet:
 * an oversized faint folio numeral (or display glyph), a section label running
 * up the outer edge, a hairline keyline toward the binding, an optional pulled
 * standfirst, a faint halftone field and a closing dingbat. Pure CSS so it stays
 * cheap to paint in headless Chromium.
 */
export const EditorialAside: React.FC<{
  colors: MagColors;
  /** Oversized faint figure (e.g. the folio) shown behind the furniture. */
  numeral?: string;
  /** Oversized display glyph (e.g. a quotation mark) — overrides `numeral`. */
  glyph?: string;
  /** Tracked label running vertically up the outer edge. */
  label?: string;
  /** Optional pulled standfirst / attribution echo. */
  note?: string;
  /** Which side of the spread this leaf sits on (the outer edge). */
  edge?: "left" | "right";
  style?: React.CSSProperties;
}> = ({ colors, numeral, glyph, label, note, edge = "left", style }) => {
  const { text, accent } = colors;
  const fieldO = useReveal(6, 16);
  const markO = useReveal(8, 18);
  const labelO = useReveal(12, 14);
  const noteO = useReveal(20, 18);
  const ruleP = useReveal(10, 16);
  const inner = edge === "left" ? "right" : "left";
  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden", opacity: fieldO, ...style }}>
      <Halftone color={text} opacity={0.05 * fieldO} gap={9} />

      {/* Hairline keyline up the inner edge (toward the binding). */}
      <div
        style={{
          position: "absolute",
          top: "6%",
          bottom: "6%",
          [inner]: 0,
          width: 1,
          background: hexToRgba(text, 0.16),
          transformOrigin: "top",
          transform: `scaleY(${ruleP})`,
        }}
      />

      {/* Oversized faint mark — a display glyph or the folio numeral. */}
      {(glyph || numeral) && (
        <div
          style={{
            position: "absolute",
            top: glyph ? "-3%" : "10%",
            [edge]: "4%",
            fontFamily: MAG_DISPLAY,
            fontWeight: 900,
            fontSize: glyph ? 420 : 300,
            lineHeight: glyph ? 1 : 0.8,
            letterSpacing: "-0.04em",
            color: glyph ? accent : text,
            opacity: (glyph ? 0.1 : 0.07) * markO,
            pointerEvents: "none",
          }}
        >
          {glyph ?? numeral}
        </div>
      )}

      {/* Section label running up the outer edge. */}
      {label && (
        <div
          style={{
            position: "absolute",
            [edge]: "5%",
            bottom: "15%",
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontFamily: MAG_SANS,
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: hexToRgba(text, 0.55),
            opacity: labelO,
          }}
        >
          {label}
        </div>
      )}

      {/* Optional pulled standfirst / attribution echo near the lower inner edge. */}
      {note && (
        <div
          style={{
            position: "absolute",
            [edge]: "26%",
            [inner]: "10%",
            bottom: "16%",
            opacity: noteO,
          }}
        >
          <Rule color={accent} progress={ruleP} thickness={2} width={64} style={{ marginBottom: 16 }} />
          <p
            style={{
              fontFamily: MAG_SERIF,
              fontStyle: "italic",
              fontSize: 23,
              lineHeight: 1.5,
              color: hexToRgba(text, 0.7),
              margin: 0,
            }}
          >
            <Typewriter text={note} start={24} cpf={1.4} caretColor={accent} />
          </p>
        </div>
      )}

      <DingbatRule
        color={hexToRgba(text, 0.4)}
        width={140}
        opacity={labelO}
        style={{ position: "absolute", [inner]: "10%", bottom: "8%" }}
      />
    </div>
  );
};

/**
 * Lays a main editorial column on one leaf of an open spread and a secondary
 * "aside" (marginalia / furniture) on the other, separated by the binding gutter
 * so neither lands on the hinge. In portrait the spread reads as one page, so the
 * aside is dropped and the main column fills the leaf.
 */
export const MagazineSpread: React.FC<{
  aspectRatio?: string;
  /** Which leaf the main column sits on. */
  mainSide?: "left" | "right";
  aside?: React.ReactNode;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ aspectRatio, mainSide = "left", aside, style, children }) => {
  const p = isPortrait(aspectRatio);
  if (p) return <div style={{ height: "100%", ...style }}>{children}</div>;
  const half = gutterPx(aspectRatio) / 2;
  const main = (
    <div style={{ width: `calc(50% - ${half}px)`, height: "100%" }}>{children}</div>
  );
  const side = (
    <div style={{ width: `calc(50% - ${half}px)`, height: "100%" }}>{aside}</div>
  );
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "row", justifyContent: "space-between", ...style }}>
      {mainSide === "left" ? (
        <>
          {main}
          {side}
        </>
      ) : (
        <>
          {side}
          {main}
        </>
      )}
    </div>
  );
};

// ── 3D motion toolkit ─────────────────────────────────────────────────────────
// A small set of deterministic, frame-driven helpers that give the print layouts
// a premium 3D feel: kinetic typography, parallax depth, a travelling specular
// sweep, focus-pull and ink-bleed reveals. All are pure CSS, render-safe in
// headless Chromium, and tuned subtle enough to stay editorial rather than gaudy.

/** A gentle continuous drift, layered per "depth" so foreground copy floats over
 *  the page as the editorial camera breathes (true parallax read). */
export const useParallax = (depth = 1, opts?: { x?: number; y?: number }): string => {
  const frame = useMagFrame();
  const sway = Math.sin(frame * 0.02);
  const bob = Math.sin(frame * 0.015 + 1.1);
  const ax = opts?.x ?? 1;
  const ay = opts?.y ?? 0.55;
  return `translate(${(sway * depth * ax).toFixed(2)}px, ${(bob * depth * ay).toFixed(2)}px)`;
};

/** Camera depth-of-field: content fades in (blur removed — too costly to paint). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const useFocusPull = (start = 0, len = 12, _maxBlur = 9): { opacity: number; filter: string } => {
  const frame = useMagFrame();
  const t = interpolate(frame, [start, start + len], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { opacity: t, filter: "none" };
};

/** Ink-bleed reveal — copy settles into the paper (rise + wipe; blur removed). */
export const useInkReveal = (
  start = 0,
  len = 18,
): { opacity: number; filter: string; clipPath: string; transform: string } => {
  const frame = useMagFrame();
  const t = interpolate(frame, [start, start + len], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const e = 1 - Math.pow(1 - t, 3);
  return {
    opacity: t,
    filter: "none",
    clipPath: `inset(0 0 ${((1 - e) * 7).toFixed(1)}% 0)`,
    transform: `translateY(${((1 - e) * 9).toFixed(1)}px)`,
  };
};

/**
 * Kinetic headline — splits text into words, each tipping up from a flat,
 * receded pose into place with a faux-extrusion shadow. Renders inline word
 * spans (no wrapper) so callers keep their own <h1> font styling; 3D is applied
 * per-word via the perspective() transform function (no preserve-3d ancestor
 * required, so it survives the sheet's overflow:hidden).
 */
export const KineticWords: React.FC<{
  text: string;
  start?: number;
  stagger?: number;
  dur?: number;
  italicizeLast?: boolean;
  depth?: boolean;
  /** Kept for source compatibility; per-word focus blur was removed for perf. */
  focus?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
}> = ({ text, start = 6, stagger = 3, dur = 16, italicizeLast = false, depth: _depth = true }) => {
  const frame = useMagFrame();
  const words = (text ?? "").split(" ").filter(Boolean);
  return (
    <>
      {words.map((w, i) => {
        const s = start + i * stagger;
        const t = interpolate(frame, [s, s + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const e = 1 - Math.pow(1 - t, 3);
        const lift = 1 - e;
        // 2D-only reveal: a staggered translateY rise + fade. The per-word
        // perspective()/rotateX/translateZ (a nested 3D context PER WORD) and the
        // animated per-word textShadow were dropped — 8–10 nested 3D contexts +
        // animated shadows per headline are brutal to rasterize without a GPU. The
        // settled headline looks identical; only the entrance is now a clean 2D rise.
        const ty = lift * 22;
        const isLast = italicizeLast && i === words.length - 1;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              whiteSpace: "pre",
              transformOrigin: "50% 100%",
              opacity: t,
              transform: `translateY(${ty.toFixed(1)}px)`,
              fontStyle: isLast ? "italic" : undefined,
              fontWeight: isLast ? 700 : undefined,
            }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </>
  );
};

/**
 * Typewriter reveal — short text types in character-by-character with an optional
 * blinking caret at the writing head.
 * For SHORT strings only (labels, attributions, pull-quotes): a per-frame slice
 * reflows, which is cheap on a short line but not on a justified paragraph — use
 * `WrittenText` for body copy. Render-safe in headless Chromium.
 */
export const Typewriter: React.FC<{
  text: string;
  start?: number;
  /** Characters revealed per frame. */
  cpf?: number;
  caret?: boolean;
  caretColor?: string;
  style?: React.CSSProperties;
}> = ({ text, start = 6, cpf = 1.6, caret = true, caretColor, style }) => {
  const frame = useMagFrame();
  const total = text?.length ?? 0;
  const end = start + total / cpf;
  const shown = Math.floor(
    interpolate(frame, [start, end], [0, total], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  const typing = frame >= start && frame < end;
  // The caret holds for a short beat after the last character lands, then leaves.
  const caretVisible = caret && frame >= start && frame < end + 18;
  const blinkOn = Math.floor(frame / 14) % 2 === 0;
  return (
    <span style={style}>
      {text.slice(0, shown)}
      {caretVisible && (
        <span
          aria-hidden
          style={{
            opacity: typing ? 1 : blinkOn ? 1 : 0,
            color: caretColor,
            fontWeight: 400,
            marginLeft: "0.04em",
          }}
        >
          |
        </span>
      )}
    </span>
  );
};

/**
 * Word-by-word "written" reveal — words ink in left-to-right in sequence,
 * reading as a sentence being written. Opacity-only on plain INLINE spans, so the
 * paragraph is laid out once (final positions from frame 0) and never reflows —
 * safe inside justified columns and `::first-letter` drop caps (transforms /
 * inline-block would break justification), and cheap to paint. Renders inline word
 * spans (no wrapper) so callers keep their own paragraph font / justify styling.
 */
export const WrittenText: React.FC<{
  text: string;
  start?: number;
  /** Words revealed per frame (0.5 ≈ a word every 2 frames). */
  wordsPerFrame?: number;
  /** Per-word fade length in frames. */
  dur?: number;
  /**
   * Reveal words in groups of this size (default 1 = one span per word).
   * Use a larger value (e.g. 4) for long body copy inside multicolumn layouts
   * to cut the number of simultaneously-animating opacity spans and avoid
   * per-frame layout thrash in headless Chromium during MP4 export.
   */
  groupSize?: number;
}> = ({ text, start = 8, wordsPerFrame = 0.5, dur = 8, groupSize = 1 }) => {
  const frame = useMagFrame();
  const words = (text ?? "").split(" ");
  const gs = Math.max(1, groupSize);
  const chunks: { text: string; s: number }[] = [];
  for (let i = 0; i < words.length; i += gs) {
    const slice = words.slice(i, i + gs);
    chunks.push({ text: slice.join(" "), s: start + i / wordsPerFrame });
  }
  return (
    <>
      {chunks.map((c, ci) => {
        const t = interpolate(frame, [c.s, c.s + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const isLast = ci === chunks.length - 1;
        return (
          <span key={ci} style={{ opacity: t }}>
            {c.text}
            {!isLast ? " " : ""}
          </span>
        );
      })}
    </>
  );
};

/**
 * Measure-and-shrink font fitter. Renders body copy at `targetPx`, then — if the
 * content overflows its (height-constrained) box — steps the font size down until
 * it fits or hits `minPx`. Real DOM measurement, not a character-count guess, so
 * it copes with any headline length, deck, key-points band, aspect ratio or
 * user-chosen size: whatever the actual leftover height is, the body is sized to
 * sit inside it instead of clipping at the bottom.
 *
 * Render-safe: the first measurement pass is gated with delayRender/continueRender
 * so Remotion's headless capture waits for the size to settle, making the rendered
 * MP4 match the live Player. Because `WrittenText` only animates opacity (never
 * layout), the measured height is identical on every frame, so the fitted size is
 * stable across the whole scene.
 *
 * `ref` must point at the height-constrained body element (the one with the column
 * CSS); `deps` should include everything that changes the copy or the available
 * height (the body text, the target size, the aspect ratio).
 */
export const useFitText = (
  ref: React.RefObject<HTMLElement>,
  targetPx: number,
  minPx: number,
  columnCount: number,
  deps: React.DependencyList,
): number => {
  const [px, setPx] = React.useState(targetPx);
  // One delayRender handle per fit cycle so headless render blocks until we've
  // converged on a non-overflowing size.
  const handleRef = React.useRef<number | null>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Hide the copy until the fit is resolved so the preview never paints it at the
    // estimated size and then reflows to the measured size (the visible "shift" on
    // scene load). We reveal it at the final size at the end of measure().
    el.style.visibility = "hidden";

    if (handleRef.current === null) handleRef.current = delayRender("magazine-fit-text");
    let cancelled = false;
    const release = () => {
      if (handleRef.current !== null) {
        continueRender(handleRef.current);
        handleRef.current = null;
      }
    };

    const measure = () => {
      if (cancelled || !el.isConnected) {
        release();
        return;
      }

      // A CSS multicolumn box with a fixed height + `column-fill:balance` never
      // reports overflow: the browser packs the copy into the box's column grid
      // and simply drops (clips) whatever doesn't fit — scrollHeight/scrollWidth
      // stay equal to client size, so an overflow probe on the box is blind.
      //
      // Instead we measure the copy's *natural* single-column height: collapse the
      // box to one column at the real per-column width with height:auto, read the
      // full unconstrained text height, then the copy fits when that height
      // (spread across `columnCount` columns) is within the available band height.
      // A true fit test, so the type shrinks only as much as the actual geometry
      // (headline length, deck, key-points band, aspect ratio, chosen size) needs.
      const avail = el.clientHeight; // fixed band height the copy must fit within
      const cols = Math.max(1, columnCount);
      // Per-column content width: inner width minus the gaps, divided by cols.
      const style = window.getComputedStyle(el);
      const gap = parseFloat(style.columnGap || "0") || 0;
      const perColWidth = (el.clientWidth - gap * (cols - 1)) / cols;

      // Stash every inline prop we override so we can restore it after measuring.
      // `flex` matters: the body is a `flex:1` child of a fixed-height column, so
      // the flex algorithm pins its height — `height:auto` alone is ignored and
      // the probe would read the (clipped) band height instead of the true copy
      // height. We force `flex:none` + `position:absolute` so the element sizes
      // purely to its content during the probe, off the normal flow.
      const saved = {
        columnCount: el.style.columnCount,
        columnWidth: el.style.columnWidth,
        columnFill: el.style.columnFill,
        width: el.style.width,
        height: el.style.height,
        maxHeight: el.style.maxHeight,
        minHeight: el.style.minHeight,
        overflow: el.style.overflow,
        flex: el.style.flex,
        position: el.style.position,
        visibility: el.style.visibility,
        fontSize: el.style.fontSize,
      };

      const naturalHeight = (size: number): number => {
        el.style.position = "absolute";
        el.style.visibility = "hidden";
        el.style.flex = "none";
        el.style.columnCount = "1";
        el.style.columnWidth = "auto";
        el.style.columnFill = "auto";
        el.style.width = `${perColWidth}px`;
        el.style.height = "auto";
        el.style.maxHeight = "none";
        el.style.minHeight = "0";
        el.style.overflow = "visible";
        el.style.fontSize = `${size}px`;
        const h = el.scrollHeight;
        // Restore the live column layout before the next probe / final paint.
        el.style.columnCount = saved.columnCount;
        el.style.columnWidth = saved.columnWidth;
        el.style.columnFill = saved.columnFill;
        el.style.width = saved.width;
        el.style.height = saved.height;
        el.style.maxHeight = saved.maxHeight;
        el.style.minHeight = saved.minHeight;
        el.style.overflow = saved.overflow;
        el.style.flex = saved.flex;
        el.style.position = saved.position;
        el.style.visibility = saved.visibility;
        return h;
      };

      // +2px tolerance for sub-pixel rounding; band holds `avail * cols` of copy.
      const capacity = avail * cols + 2;
      let next = targetPx;
      if (naturalHeight(targetPx) > capacity) {
        let size = targetPx;
        while (size > minPx && naturalHeight(size) > capacity) size -= 1;
        next = Math.max(minPx, size);
      }
      el.style.fontSize = `${next}px`;
      el.style.visibility = "visible"; // reveal at the final, fitted size — no reflow shift
      setPx(next);
      // Defer continueRender until after the browser has painted the new font
      // size. setPx triggers a React re-render but continueRender would fire
      // synchronously before React commits — the headless capturer would then
      // grab the frame at the old estimated size. rAF fires after the paint so
      // the captured frame always shows the fitted size.
      requestAnimationFrame(() => release());
    };

    // Try to measure synchronously — if the element has real dimensions (i.e.
    // the custom fonts are already loaded, as is always the case in the Player
    // after the first scene), reveal immediately at frame 0 so the content is
    // visible from the first paint and there is no mid-entrance pop-in. Only
    // fall back to the async fonts.ready path if the element has zero height
    // (unmeasurable = fonts not yet loaded), which happens on very first load or
    // in headless render before fonts are ready.
    const el2 = ref.current;
    const fontsObj = (document as Document & { fonts?: FontFaceSet }).fonts;
    const canMeasureNow = el2 && el2.clientHeight > 0;
    if (canMeasureNow) {
      measure();
    } else if (fontsObj?.ready) {
      fontsObj.ready.then(() => {
        if (!cancelled) measure();
      });
    } else {
      measure();
    }

    return () => {
      cancelled = true;
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return px;
};

/** Printed-sheen highlight — removed for performance. A full-screen animated
 *  gradient with mixBlendMode:soft-light forced an offscreen recomposite every
 *  frame; it's now a no-op (kept so callers/props stay source-compatible). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const PageGloss: React.FC<{ period?: number; strength?: number; rakeFromY?: number }> = () => null;

/**
 * Pop-off-the-page — lifts a hero element forward in Z so it floats above the
 * sheet as the camera moves (the classic print-ad 3D trick). Self-contained
 * `perspective()` so it survives the sheet's overflow:hidden without needing a
 * preserve-3d ancestor; a soft drop-shadow grows with the lift so it reads as
 * physically raised off the page.
 */
export const popTransform = (depth: number, lift: number): string =>
  `perspective(1200px) translateZ(${(depth * lift).toFixed(1)}px)`;

export const PopLayer: React.FC<{
  depth?: number;
  start?: number;
  len?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ depth = 48, start = 6, len = 16, style, children }) => {
  const frame = useMagFrame();
  const t = interpolate(frame, [start, start + len], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lift = 1 - Math.pow(1 - t, 3);
  return (
    <div
      style={{
        display: "inline-block",
        transformOrigin: "50% 50%",
        // No continuous bob and a static box-shadow instead of an animated
        // drop-shadow filter (drop-shadow re-rasterises the element every frame).
        transform: popTransform(depth, lift),
        boxShadow: lift > 0.01 ? "0 14px 26px rgba(0,0,0,0.18)" : undefined,
        willChange: lift > 0.01 && lift < 0.999 ? "transform" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Dust motes — removed for performance (6 per-frame animated radial-gradient
 *  nodes for almost no visible payoff). No-op, kept source-compatible. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const DustMotes: React.FC<{ tint?: string }> = () => null;

/**
 * The surface the open spread rests on — a warm, softly-lit desk with a few
 * loose off-white sheets scattered and peeking out from behind the main page,
 * as if the magazine were just set down on a table. Replaces the old solid
 * dark backdrop. Purely CSS, deterministic across frames.
 */
// A loose pile of magazines under the open spread. Each sheet shares roughly
// the spread's footprint but is rotated and nudged around the centre, so the
// pile fans out in a deliberate, ruffled way (not random overlapping squares).
// Each reads as a real cover: a moody photographic wash with a TIME-style
// accent frame ruled around it. Back → front: rotation eases toward level.
// One or two loose magazines peeking from under the open spread — re-skinned to
// read as real magazines resting on the table: a dark photographic wash, a thin
// accent rule (not a loud frame) and a soft drop shadow. Kept subtle so the
// table, not the props, carries the scene.
// A single loose magazine peeking from behind the spread — trimmed from two
// (each carried a large box-shadow + 3 child nodes that rendered every frame).
const SCATTER_SHEETS: Array<{
  rotate: number;
  tx: number; // % of frame width
  ty: number; // % of frame height
  cover: string; // photographic cover wash
}> = [
  { rotate: -7.0, tx: -3.0, ty: 2.4, cover: "linear-gradient(155deg, #3a332b 0%, #4a4036 46%, #1c1712 100%)" },
];

export const DeskBackdrop: React.FC<{ aspectRatio?: string; accent?: string; parallaxX?: number; parallaxY?: number }> = ({ aspectRatio, accent = MAG_DEFAULTS.accent, parallaxX = 0, parallaxY = 0 }) => {
  const p = isPortrait(aspectRatio);
  // Match the page-sheet footprint so the pile reads as magazines of the same size.
  const insetX = p ? "5%" : "3.5%";
  const insetY = p ? "4%" : "6.5%";
  const scale = p ? 0.7 : 1; // portrait has less room, so fan less aggressively
  return (
    <>
      {/* Warm dark table surface WITH the lamp-glow + vignette baked into a single
          gradient stack. Collapsed from 5 stacked full-frame gradient layers (table,
          texture, lamp, contact-shadow, vignette) to ONE — the desk only shows during
          the brief entrance now, and software compositing pays per layer per frame. */}
      <AbsoluteFill
        style={{
          background: [
            "radial-gradient(ellipse 70% 60% at 54% 26%, rgba(255,243,224,0.16) 0%, rgba(255,236,205,0.05) 38%, rgba(255,230,195,0) 64%)",
            "radial-gradient(ellipse at 54% 30%, rgba(0,0,0,0) 44%, rgba(8,5,2,0.55) 100%)",
            "radial-gradient(ellipse at 50% 34%, #3a322a 0%, #2a2420 42%, #19140f 78%, #100c08 100%)",
          ].join(", "),
        }}
      />
      {/* One loose magazine peeking from behind the spread — a single flat cover wash,
          no per-cover highlight/rule/masthead child nodes (they painted every frame). */}
      {SCATTER_SHEETS.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: insetY,
            bottom: insetY,
            left: insetX,
            right: insetX,
            background: s.cover,
            borderRadius: 3,
            overflow: "hidden",
            transform: `translate(${s.tx * scale}%, ${s.ty * scale}%) translate(${(parallaxX * 0.6).toFixed(2)}px, ${(parallaxY * 0.6).toFixed(2)}px) translateZ(-90px) rotate(${s.rotate * scale}deg)`,
            transformOrigin: "center center",
            zIndex: i + 1,
            border: `${p ? 2 : 2.5}px solid ${hexToRgba(accent, 0.45)}`,
          }}
        />
      ))}
      {/* Soft contact shadow grounding the spread (pre-feathered gradient, no blur). */}
      <div
        style={{
          position: "absolute",
          top: `calc(${insetY} - 1%)`,
          bottom: `calc(${insetY} - 7%)`,
          left: `calc(${insetX} - 2%)`,
          right: `calc(${insetX} - 6%)`,
          background: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.32) 45%, rgba(0,0,0,0) 72%)",
          transform: `translateY(2.4%) translate(${(parallaxX * 0.3).toFixed(2)}px, ${(parallaxY * 0.3).toFixed(2)}px) translateZ(-30px)`,
          zIndex: 3,
        }}
      />
    </>
  );
};

/** A dog-eared page-curl in a bottom corner of the sheet. When `textureSrc` is
 *  given, the folded flap (the back of the lifted page) carries a faint, mirrored
 *  slice of the print texture so the corner shows ghost print/show-through instead
 *  of reading as a bare white wedge. */
const PageCurl: React.FC<{ corner: "bl" | "br"; size: number; accent?: string; textureSrc?: string }> = ({ corner, size, accent, textureSrc }) => {
  const br = corner === "br";
  const clip = br ? "polygon(100% 0, 0 100%, 100% 100%)" : "polygon(0 0, 0 100%, 100% 100%)";
  return (
    <div style={{ position: "absolute", bottom: 0, [br ? "right" : "left"]: 0, width: size, height: size, zIndex: 8, pointerEvents: "none" }}>
      {/* shadow the lifted corner casts onto the page */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at ${br ? "top left" : "top right"}, rgba(0,0,0,0.3), transparent 70%)`,
        }}
      />
      {/* the folded flap (back of the page) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: br
            ? "linear-gradient(135deg, #cbc7bd 0%, #ece9e2 48%, #ffffff 100%)"
            : "linear-gradient(225deg, #cbc7bd 0%, #ece9e2 48%, #ffffff 100%)",
          clipPath: clip,
          boxShadow: br ? "-3px -3px 8px rgba(0,0,0,0.16)" : "3px -3px 8px rgba(0,0,0,0.16)",
        }}
      />
      {/* show-through: a faint, mirrored slice of the print texture on the flap so
          the back of the lifted page isn't bare white. Mirrored on X (the corner
          we'd see if the sheet folded toward us is its reverse) and clipped to the
          flap triangle; blended low so the paper highlight still reads. */}
      {textureSrc ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: clip,
            backgroundImage: `url(${staticFile(textureSrc)})`,
            backgroundSize: "cover",
            backgroundPosition: br ? "right bottom" : "left bottom",
            transform: "scaleX(-1)",
            opacity: 0.16,
            mixBlendMode: "multiply",
          }}
        />
      ) : null}
      {br && accent ? (
        <div style={{ position: "absolute", bottom: size * 0.16, right: size * 0.16, width: 8, height: 8, borderRadius: "50%", background: accent }} />
      ) : null}
    </div>
  );
};

/**
 * A gentle, static vertical page-curl running down the LEFT edge of a sheet — the
 * left edge reads as softly rolled/folded toward the viewer (a thin lit lip with a
 * soft crease shadow on the page beside it). Pure-CSS (two gradient strips), so
 * it's cheap to paint. Sits at the true left edge of the sheet; fade it in via
 * `opacity` once the page has zoomed in so the final framed look simply carries a
 * slightly curled left edge.
 */
export const LeftEdgeFold: React.FC<{
  width?: number;
  accent?: string;
  opacity?: number;
}> = ({ width = 54, accent, opacity = 1 }) => (
  <div style={{ position: "absolute", top: "3%", bottom: "3%", left: 0, width, zIndex: 9, pointerEvents: "none", opacity }}>
    {/* the gently curled paper lip: dark underside → highlight crest → crease valley */}
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(to right, #c2bdae 0%, #e4dfd2 24%, #fffdf8 48%, #ece6d9 74%, #cfc9bb 100%)",
        borderTopLeftRadius: 5,
        borderBottomLeftRadius: 5,
      }}
    />
    {/* soft crease shadow the curl casts onto the flat page just to its right */}
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: width,
        width: 22,
        background: "linear-gradient(to right, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0.04) 55%, transparent 100%)",
      }}
    />
    {/* thin accent rule down the crease */}
    {accent ? (
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 2, background: accent, opacity: 0.55 }} />
    ) : null}
  </div>
);

// ── Cinematic intro ──────────────────────────────────────────────────────────

/**
 * The opening beat: the camera starts far + high over a dark room and cranes
 * down to point at a closed magazine resting on the table, then the cover-open
 * transition carries us into the first spread. Reuses the same desk + 3D stage +
 * `crane_down` camera as the interior pages so it reads as one continuous shot.
 */
export const MagazineTableIntro: React.FC<{
  title?: string;
  issue?: string;
  colors: MagColors;
  fontFamily?: string;
  aspectRatio?: string;
  seed?: number;
}> = ({ title, issue, colors, fontFamily, aspectRatio, seed = 1 }) => {
  const { bg, text, accent } = colors;
  const p = isPortrait(aspectRatio);
  const frame = useMagFrame();
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  const cam = useMagazineCamera("crane_down", { establishing: true, seed });

  // Comes into focus on entry — a brief rack-focus (blur → sharp) plus a gentle
  // fade as the camera cranes onto the table. Transient + single-scene, so the
  // blur is cheap (unlike the continuous every-scene blurs removed elsewhere).
  const entryBlur = interpolate(frame, [0, 24], [12, 0], cl);
  const entryFade = interpolate(frame, [0, 12], [0, 1], cl);

  // Masthead + cover lines rack in just as the camera settles onto the table.
  const mastReveal = useReveal(16, 16);
  const lineReveal = useReveal(26, 16);

  const sheetInsetX = p ? "5%" : "3.5%";
  const sheetInsetY = p ? "4%" : "6.5%";
  const curl = p ? 64 : 78;

  return (
    <AbsoluteFill style={{ fontFamily: fontFamily ?? MAG_SERIF, opacity: entryFade }}>
      {/* Dark room behind, so the crane-in reveals a dark surround. */}
      <AbsoluteFill style={{ background: MAG_BACKDROP }} />

      {/* World camera — flies the whole desk in from far and racks into focus. */}
      <AbsoluteFill
        style={{
          transform: cam.world.transform,
          transformOrigin: cam.world.transformOrigin,
          filter: entryBlur > 0.1 ? `blur(${entryBlur.toFixed(2)}px)` : cam.world.filter,
        }}
      >
        <AbsoluteFill
          style={{
            perspective: `${cam.perspective}px`,
            perspectiveOrigin: cam.perspectiveOrigin,
          }}
        >
          {/* The table, lamp glow and scattered covers. */}
          <DeskBackdrop aspectRatio={aspectRatio} accent={accent} parallaxX={cam.deskParallax.x} parallaxY={cam.deskParallax.y} />

          {/* 3D stage — tilts the closed magazine with the camera. */}
          <AbsoluteFill
            style={{
              transformStyle: "preserve-3d",
              transform: cam.stage.transform,
              transformOrigin: cam.stage.transformOrigin,
              // Promote the moving page to its own cached GPU layer so the
              // per-frame camera transform is a texture-move, not a full repaint
              // of the shadowed/gradient/text page — but ONLY while the camera is
              // moving. Once a scene settles (cam.fill → 1) the stage transform is
              // static, so an always-on willChange pins a full-frame GPU layer for
              // the whole multi-second hold for nothing. In All-Scenes a transition
              // overlaps two MagazinePages; pinning both blew the live-preview VRAM
              // budget and thrashed the entire compositor (whole-page jitter that
              // never recovers). Toggling once (on→off at settle) frees the layer
              // during holds with no per-frame thrash. Establishing scenes keep
              // fill=0 so they stay promoted (they never stop moving). backface-
              // hidden stays so the 3D subtree can't flatten and flash the backdrop.
              willChange: cam.fill < 0.999 ? "transform" : undefined,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              zIndex: 5,
            }}
          >
            {/* The block of pages under the closed cover. */}
            <PageThickness sheetInsetX={sheetInsetX} sheetInsetY={sheetInsetY} />

            {/* The closed front cover. */}
            <div
              style={{
                position: "absolute",
                top: sheetInsetY,
                bottom: sheetInsetY,
                left: sheetInsetX,
                right: sheetInsetX,
                background: bg,
                // Single modest shadow: an 80px-blur shadow repainted every frame
                // under the moving 3D stage was a top per-frame paint cost.
                boxShadow: "0 10px 28px rgba(0,0,0,0.34)",
                overflow: "hidden",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                zIndex: 5,
              }}
            >
              {/* faint printed ghost so the cover reads as real paper */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url(${staticFile("magazine-blur-bg.svg")})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  opacity: 0.1,
                  pointerEvents: "none",
                }}
              />

              {/* Masthead */}
              <div
                style={{
                  position: "absolute",
                  top: p ? "7%" : "8%",
                  left: p ? "8%" : "6%",
                  right: p ? "8%" : "6%",
                  opacity: mastReveal,
                  zIndex: 10,
                }}
              >
                <div
                  style={{
                    fontFamily: MAG_DISPLAY,
                    fontWeight: 800,
                    fontSize: p ? "12vw" : "8.2vw",
                    lineHeight: 0.92,
                    letterSpacing: "-0.02em",
                    color: text,
                    textTransform: "uppercase",
                  }}
                >
                  {title || "The Feature"}
                </div>
                <div style={{ marginTop: p ? 14 : 18 }}>
                  <Rule color={accent} progress={mastReveal} opacity={0.9} thickness={p ? 4 : 5} />
                </div>
              </div>

              {/* Cover line */}
              <div
                style={{
                  position: "absolute",
                  left: p ? "8%" : "6%",
                  bottom: p ? "12%" : "13%",
                  right: p ? "30%" : "26%",
                  opacity: lineReveal,
                  zIndex: 10,
                  fontFamily: MAG_SERIF,
                  fontStyle: "italic",
                  fontSize: p ? "4.4vw" : "2.7vw",
                  lineHeight: 1.1,
                  color: hexToRgba(text, 0.82),
                }}
              >
                {issue ? issue : "The Issue"}
              </div>

              {/* Newsstand barcode */}
              <div style={{ position: "absolute", right: p ? "8%" : "6%", bottom: p ? "8%" : "9%", opacity: lineReveal, zIndex: 10 }}>
                <Barcode color={text} width={p ? 120 : 116} />
              </div>


              {/* dog-eared corners — flap carries the cover's ghost print */}
              <PageCurl corner="bl" size={curl} textureSrc="magazine-blur-bg.svg" />
              <PageCurl corner="br" size={curl} accent={accent} textureSrc="magazine-blur-bg.svg" />
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Page chrome ──────────────────────────────────────────────────────────────

interface MagazinePageProps {
  colors: MagColors;
  section?: string;
  issue?: string;
  page?: string;
  aspectRatio?: string;
  fontFamily?: string;
  /** kept for source compatibility; the sheet always draws its own edge */
  keyline?: boolean;
  /** suppress the centre spine/gutter — used when a full-width photo sits centred on the page */
  hideGutter?: boolean;
  /** render as ONE page filling the frame (like the cover): no centre gutter, no
   *  page-thickness book block, and a larger sheet — so content reads as a single
   *  page and never lands on a hinge. */
  singlePage?: boolean;
  opacity?: number;
  /** Play the one-time establishing fly-in (defaults to true on the first scene). */
  establishingShot?: boolean;
  /** Cinematic camera move for this spread (the composition supplies a default). */
  cameraMove?: MagazineCameraMove;
  /** When > 0, render a gentle curl down the sheet's left edge at this opacity
   *  (used by EditorialQuote, faded in after the page zooms in). */
  leftEdgeFoldOpacity?: number;
  /** Suppress the faint printed-page ghost texture — for single-page layouts that
   *  want a clean sheet (e.g. TimelineJourney) instead of bleed-through columns. */
  hidePrintTexture?: boolean;
  /** Override the full-bleed print-texture SVG painted on the sheet (defaults to
   *  `magazine-blur-bg.svg`). Lets a layout substitute its own printed spread
   *  edge-to-edge behind the live content (e.g. EditorialQuote). */
  printTextureSrc?: string;
  /** Opacity of the full-bleed print-texture layer (defaults to 0.12). */
  printTextureOpacity?: number;
  /** Newspaper-style "light chrome": drop the per-frame-expensive page furniture
   *  (PageThickness stack + dog-ear PageCurls) and don't toggle the stage's
   *  willChange. For pages that run a moving camera, so the spread stays paint-light
   *  enough to re-rasterise smoothly every frame (mirrors the newspaper template). */
  lightChrome?: boolean;
  /** Optional full-bleed photo embedded INTO the page sheet — sits above the
   *  print texture but below the live content, with a paper scrim so overlaid
   *  text/graphics stay readable (e.g. TimelineJourney's background). */
  backgroundImageSrc?: string;
  backgroundImageObjectPosition?: string;
  backgroundImageZoom?: number;
  backgroundImageOpacity?: number;
  contentStyle?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * An open-spread page resting on a dark, blurred backdrop. A centred white
 * sheet with a drop shadow, a running head (page • section) over a hairline,
 * the centre spine, dog-eared corners, and the live content area below.
 */
export const MagazinePage: React.FC<MagazinePageProps> = ({
  colors,
  section,
  issue,
  page,
  aspectRatio,
  fontFamily,
  hideGutter = false,
  singlePage = false,
  opacity = 1,
  establishingShot,
  cameraMove,
  leftEdgeFoldOpacity = 0,
  hidePrintTexture = false,
  printTextureSrc = "magazine-blur-bg.svg",
  printTextureOpacity = 0.12,
  lightChrome = false,
  backgroundImageSrc,
  backgroundImageObjectPosition = "50% 50%",
  backgroundImageZoom = 1,
  backgroundImageOpacity = 0.3,
  contentStyle,
  children,
}) => {
  const { bg, text, accent } = colors;
  const p = isPortrait(aspectRatio);
  // A single page fills the frame as one leaf: never draw the binding/gutter.
  const noGutter = hideGutter || singlePage;
  const frame = useMagFrame();

  const headOpacity = useReveal(0, 12);
  const ruleProgress = useReveal(3, 16);
  // The opening scene flies in from far and racks into focus; default to the
  // first folio when the prop isn't threaded through.
  const establishing = establishingShot ?? page === "01";
  // Vary the 3D camera angle per scene (seeded by the folio) so no two adjacent
  // spreads are shot from the same angle. On the establishing scene the page
  // starts steeply overhead and levels out over a longer entrance, in step with
  // the world fly-in.
  const seed = parseInt(String(page ?? "1").replace(/\D/g, ""), 10) || 1;
  // The first scene always cranes in from far onto the desk; every other scene
  // plays its per-layout signature move (or an explicit override).
  const move: MagazineCameraMove = establishing ? "crane_down" : (cameraMove ?? "breathe");
  const cam = useMagazineCamera(move, { establishing, seed });
  // Per-scene settle: content fades in immediately at the start of the scene's
  // sequence — which (inside a TransitionSeries) is frame 0 of the *incoming*
  // transition. It must reach full opacity well before any transition completes
  // (all transitions are ≥49 frames) so the page is never blank over the dark
  // backdrop at the moment the transition hands off. Finishing the fade this
  // early also means it's done before the camera settle begins (~frame 40 in
  // MAG_TEMPO frames), so the settle never races a fade-in (the old jitter).
  // The continuous parallax drift was removed — the camera breathe alone carries
  // the depth read without re-transforming the content every frame.
  const contentFade = establishing
    ? 1
    : interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Sheet geometry (% of frame). A single page fills more of the frame so it
  // reads as one full page (like the cover) rather than a spread on the desk.
  // As the camera settles (cam.fill 0→1) the sheet grows to full-bleed (inset → 0)
  // so the flat page covers the entire screen; PageThickness keeps the base inset
  // so the book block stays put and is simply hidden behind the full sheet.
  const baseInsetX = singlePage ? (p ? 3.5 : 2.2) : p ? 5 : 3.5;
  const baseInsetY = singlePage ? (p ? 3 : 3.5) : p ? 4 : 6.5;
  const sheetBaseInsetX = `${baseInsetX}%`;
  const sheetBaseInsetY = `${baseInsetY}%`;
  const sheetInsetX = `${(baseInsetX * (1 - cam.fill)).toFixed(2)}%`;
  const sheetInsetY = `${(baseInsetY * (1 - cam.fill)).toFixed(2)}%`;
  const padX = p ? "7%" : "6%";
  const curl = p ? 64 : 78;

  return (
    <AbsoluteFill
      style={{
        fontFamily: fontFamily ?? MAG_SERIF,
        opacity,
      }}
    >
      {/* Dark room behind, so any move that scales/translates the world reveals a
          dark surround rather than empty page edges. */}
      <AbsoluteFill style={{ background: MAG_BACKDROP }} />

      {/* World camera — flies the whole scene (desk + spread) in from far and
          racks it into focus on the establishing scene; identity otherwise. The
          2D transform + blur wraps the perspective scene without disturbing its
          inner 3D. */}
      <AbsoluteFill
        style={{
          transform: cam.world.transform,
          transformOrigin: cam.world.transformOrigin,
          filter: cam.world.filter,
        }}
      >
        <AbsoluteFill
          style={{
            perspective: `${cam.perspective}px`,
            perspectiveOrigin: cam.perspectiveOrigin,
          }}
        >
          {/* Desk surface with loose magazine covers behind the spread. UNMOUNTED
              (not just opacity:0) once the page settles to full-bleed — keeping its
              8 gradients + scattered sheets in the tree during the static hold made
              software (CPU) compositing repaint them every frame for nothing. Now it
              only exists during the brief entrance, then is removed entirely. */}
          {cam.fill < 0.999 && (
            <AbsoluteFill style={{ opacity: 1 - cam.fill }}>
              <DeskBackdrop aspectRatio={aspectRatio} accent={accent} parallaxX={cam.deskParallax.x} parallaxY={cam.deskParallax.y} />
            </AbsoluteFill>
          )}

          {/* 3D editorial camera — the cinematic move tilts/orbits/rolls the
              spread + page-thickness block */}
          <AbsoluteFill
            style={{
              transformStyle: "preserve-3d",
              transform: cam.stage.transform,
              transformOrigin: cam.stage.transformOrigin,
              // Promote the moving page to its own cached GPU layer so the
              // per-frame camera transform is a texture-move, not a full repaint
              // of the shadowed/gradient/text page — but ONLY while the camera is
              // moving. Once a scene settles (cam.fill → 1) the stage transform is
              // static, so an always-on willChange pins a full-frame GPU layer for
              // the whole multi-second hold for nothing. In All-Scenes a transition
              // overlaps two MagazinePages; pinning both blew the live-preview VRAM
              // budget and thrashed the entire compositor (whole-page jitter that
              // never recovers). Toggling once (on→off at settle) frees the layer
              // during holds with no per-frame thrash. Establishing scenes keep
              // fill=0 so they stay promoted (they never stop moving). backface-
              // hidden stays so the 3D subtree can't flatten and flash the backdrop.
              willChange: lightChrome ? undefined : cam.fill < 0.999 ? "transform" : undefined,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              zIndex: 5,
            }}
          >
            {/* The physical block of pages under the open spread — only on the
                establishing (cover) scene now. It sits inside the 3D context, so on a
                CPU it was repainting on every interior page for the whole hold. Gated
                to `establishing` so interior pages stay flat/cheap (singlePage and
                lightChrome already excluded it). */}
            {establishing && !singlePage && !lightChrome && <PageThickness sheetInsetX={sheetBaseInsetX} sheetInsetY={sheetBaseInsetY} />}

      {/* The page sheet */}
      <div
        style={{
          position: "absolute",
          top: sheetInsetY,
          bottom: sheetInsetY,
          left: sheetInsetX,
          right: sheetInsetX,
          background: bg,
          // Tight, small-blur shadow: large-radius blur is one of the most expensive
          // software-raster paints, and this sheet is repainted under the 3D stage. A
          // ≤8px blur still reads as a page edge but costs a fraction to paint on CPU.
          boxShadow: "0 4px 8px rgba(0,0,0,0.30)",
          overflow: "hidden",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          zIndex: 5,
        }}
      >
        {/* Printed-page layer — a faint, blurred ghost of the magazine spread
            on the sheet itself, giving each page a real "printed" texture
            beneath the live content. Suppressed for clean single-page layouts. */}
        {!hidePrintTexture && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${staticFile(printTextureSrc)})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              // blur filter removed — the SVG is already a soft texture
              opacity: printTextureOpacity,
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Embedded full-bleed background photo — on the sheet, above the printed
            texture but below the live content, with a paper scrim so the line,
            dots and copy keep full contrast on top (e.g. TimelineJourney). */}
        {backgroundImageSrc && (
          <div style={{ position: "absolute", inset: 0, zIndex: 1, overflow: "hidden", pointerEvents: "none" }}>
            <Img
              src={backgroundImageSrc}
              style={{
                width: "100%",
                height: "100%",
                objectFit: backgroundImageZoom < 1 ? "contain" : "cover",
                objectPosition: backgroundImageZoom < 1 ? "center" : backgroundImageObjectPosition,
                transform: `scale(${backgroundImageZoom})`,
                transformOrigin: backgroundImageZoom < 1 ? "center center" : backgroundImageObjectPosition,
                opacity: backgroundImageOpacity,
                // filter removed — a CSS filter on a full-bleed image forces an
                // offscreen pass each composite (costly without a GPU). The slight
                // saturate/contrast grade isn't worth the per-composite cost.
                display: "block",
              }}
            />
            <div style={{ position: "absolute", inset: 0, background: hexToRgba(bg, 0.4) }} />
          </div>
        )}

        {/* centre spine — only on landscape spreads; portrait reads as a single
            page (no binding), so copy never sits on a fold there either */}
        {!noGutter && !p && <MagazineGutter color={text} sheen={bg} aspectRatio={aspectRatio} opacity={headOpacity} />}

        {/* Running head */}
        <div style={{ position: "absolute", top: p ? "4.5%" : "5%", left: padX, right: padX, opacity: headOpacity, zIndex: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ fontFamily: MAG_SANS, fontWeight: 700, fontSize: 14, letterSpacing: "0.04em", color: text }}>
              {page ?? "01"}
            </span>
            <span style={{ fontFamily: MAG_SANS, fontWeight: 700, fontSize: 13, letterSpacing: "0.26em", textTransform: "uppercase", color: hexToRgba(text, 0.62) }}>
              {issue ?? section ?? ""}
            </span>
          </div>
          <Rule color={text} progress={ruleProgress} opacity={0.4} thickness={2} />
        </div>

        {/* Live content area */}
        <div
          style={{
            position: "absolute",
            top: p ? "13%" : "15%",
            left: padX,
            right: padX,
            bottom: p ? "8%" : "9%",
            zIndex: 5,
            opacity: contentFade,
            ...contentStyle,
          }}
        >
          {children}
        </div>


        {/* Dog-eared corners — flap carries the page's print texture as show-through
            (unless this layout hides the texture for a clean sheet). */}
        {!lightChrome && <PageCurl corner="bl" size={curl} textureSrc={hidePrintTexture ? undefined : printTextureSrc} />}
        {!lightChrome && <PageCurl corner="br" size={curl} accent={accent} textureSrc={hidePrintTexture ? undefined : printTextureSrc} />}

        {/* Optional gentle curl down the left edge (e.g. EditorialQuote). */}
        {leftEdgeFoldOpacity > 0 && <LeftEdgeFold accent={accent} opacity={leftEdgeFoldOpacity} />}
        </div>
          </AbsoluteFill>
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Magazine ornaments ───────────────────────────────────────────────────────
// Small, themeable bits of newsstand "furniture" sprinkled across layouts to
// give the template a richer print-magazine feel. Every atom is driven by the
// passed colour so it respects theme overrides.

// Deterministic bar widths so a barcode renders identically every frame.
const BARCODE_BARS = [3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 1, 1, 3, 1, 2, 1, 2, 1, 1, 3, 1, 1, 2, 1, 3, 1, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1];

/** A print barcode — the classic newsstand corner mark. */
export const Barcode: React.FC<{
  color: string;
  width?: number;
  height?: number;
  opacity?: number;
  label?: string;
  style?: React.CSSProperties;
}> = ({ color, width = 116, height = 38, opacity = 1, label, style }) => {
  const total = BARCODE_BARS.reduce((a, b) => a + b, 0);
  let x = 0;
  return (
    <div style={{ width, opacity, ...style }}>
      <svg viewBox={`0 0 ${total} 20`} width={width} height={height} preserveAspectRatio="none" style={{ display: "block" }}>
        {BARCODE_BARS.map((w, i) => {
          const rect = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={20} fill={color} /> : null;
          x += w;
          return rect;
        })}
      </svg>
      {label ? (
        <div style={{ fontFamily: MAG_SANS, fontWeight: 600, fontSize: 9, letterSpacing: "0.18em", color, marginTop: 3, textAlign: "center" }}>
          {label}
        </div>
      ) : null}
    </div>
  );
};

/** Registration / crop ticks at the four corners of the parent box. */
export const CropMarks: React.FC<{
  color: string;
  inset?: number;
  length?: number;
  thickness?: number;
  opacity?: number;
}> = ({ color, inset = 14, length = 18, thickness = 1.5, opacity = 0.5 }) => {
  const corners: Array<[string, string]> = [
    ["top", "left"],
    ["top", "right"],
    ["bottom", "left"],
    ["bottom", "right"],
  ];
  return (
    <>
      {corners.map(([v, h], i) => (
        <div key={i} style={{ position: "absolute", [v]: inset, [h]: inset, width: length, height: length, opacity, pointerEvents: "none" } as React.CSSProperties}>
          <div style={{ position: "absolute", [v]: 0, [h]: 0, width: length, height: thickness, background: color } as React.CSSProperties} />
          <div style={{ position: "absolute", [v]: 0, [h]: 0, width: thickness, height: length, background: color } as React.CSSProperties} />
        </div>
      ))}
    </>
  );
};

/** A faint halftone dot field — sits behind panels for print texture. */
export const Halftone: React.FC<{
  color: string;
  opacity?: number;
  dot?: number;
  gap?: number;
  style?: React.CSSProperties;
}> = ({ color, opacity = 0.06, dot = 1.5, gap = 7, style }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      opacity,
      backgroundImage: `radial-gradient(${color} ${dot}px, transparent ${dot}px)`,
      backgroundSize: `${gap}px ${gap}px`,
      pointerEvents: "none",
      ...style,
    }}
  />
);

/** An oversized serif open-quotation watermark. */
export const QuoteGlyph: React.FC<{
  color: string;
  size?: number;
  opacity?: number;
  style?: React.CSSProperties;
}> = ({ color, size = 220, opacity = 0.12, style }) => (
  <div
    style={{
      fontFamily: MAG_DISPLAY,
      fontWeight: 900,
      fontSize: size,
      lineHeight: 0.7,
      color,
      opacity,
      userSelect: "none",
      pointerEvents: "none",
      ...style,
    }}
  >
    &ldquo;
  </div>
);

/**
 * An editorial framed photo plate — a full-colour image set in a thin ink keyline
 * over a cream mat, with a soft drop shadow and a faint print wash, so a
 * photograph reads as a plate tipped onto the printed page rather than a flat web
 * image. Used by Feature and TextNarration; the image framing honours the scene's
 * focus point + zoom (`objectPosition`/`zoom`). Renders nothing without a `src`,
 * so the surrounding layout simply reflows when a scene has no image.
 */
export const MagPlate: React.FC<{
  src?: string;
  colors: MagColors;
  objectPosition?: string;
  zoom?: number;
  opacity?: number;
  rotate?: number;
  caption?: string;
  style?: React.CSSProperties;
}> = ({ src, colors, objectPosition = "50% 50%", zoom = 1, opacity = 1, rotate = 0, caption, style }) => {
  if (!src) return null;
  const { bg, text } = colors;
  const z = zoom ?? 1;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        opacity,
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        ...style,
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          background: bg,
          padding: 8,
          border: `1px solid ${hexToRgba(text, 0.85)}`,
          boxShadow: "0 4px 10px rgba(0,0,0,0.22)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
          <Img
            src={src}
            style={{
              width: "100%",
              height: "100%",
              objectFit: z < 1 ? "contain" : "cover",
              objectPosition: z < 1 ? "center" : objectPosition,
              transform: `scale(${z})`,
              transformOrigin: z < 1 ? "center center" : objectPosition,
              display: "block",
            }}
          />
          {/* faint paper tint so the photo sits into the printed page */}
          <div style={{ position: "absolute", inset: 0, background: hexToRgba(bg, 0.06), pointerEvents: "none" }} />
        </div>
      </div>
      {caption && (
        <div
          style={{
            fontFamily: MAG_SERIF,
            fontStyle: "italic",
            fontSize: 13,
            lineHeight: 1.3,
            color: hexToRgba(text, 0.6),
            marginTop: 8,
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
};

/** A centred rule broken by a star/asterisk dingbat — a section break. */
export const DingbatRule: React.FC<{
  color: string;
  width?: number | string;
  glyph?: string;
  opacity?: number;
  style?: React.CSSProperties;
}> = ({ color, width = 180, glyph = "✦", opacity = 1, style }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, width, opacity, ...style }}>
    <div style={{ flex: 1, height: 1, background: color }} />
    <span style={{ fontSize: 12, color, lineHeight: 1 }}>{glyph}</span>
    <div style={{ flex: 1, height: 1, background: color }} />
  </div>
);

/** A "Continued on p. XX" jump line. */
export const JumpLine: React.FC<{
  color: string;
  page?: string | number;
  style?: React.CSSProperties;
}> = ({ color, page, style }) => (
  <div
    style={{
      fontFamily: MAG_SANS,
      fontWeight: 600,
      fontSize: 11,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color,
      ...style,
    }}
  >
    {`Continued on p. ${typeof page === "number" ? folioNumber(page) : page ?? "—"} ▸`}
  </div>
);
