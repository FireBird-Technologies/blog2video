import React from "react";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { SceneLayoutProps } from "./types";
import {
  MAGAZINE_DISPLAY_FONT,
  MAGAZINE_SERIF_FONT,
  MAGAZINE_SANS_FONT,
} from "../../../fonts/magazine-defaults";

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
  const frame = useCurrentFrame();
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
}

// Six visibly-distinct camera angles, cycled per scene so consecutive spreads
// never look like the same shot. All keep a downward-ish tilt (so PageThickness
// reads consistently) but vary direction, steepness and pivot.
const CAMERA_VARIANTS: EditorialCameraOpts[] = [
  // 0 — right, high pivot (the default look)
  { enterRotateX: 20, restRotateX: 9, enterRotateY: -14, restRotateY: -5, transformOrigin: "50% 26%" },
  // 1 — mirrored to the left
  { enterRotateX: 18, restRotateX: 8, enterRotateY: 14, restRotateY: 5, transformOrigin: "50% 26%", oscRotateY: -1.4 },
  // 2 — steep top-down
  { enterRotateX: 26, restRotateX: 13, enterRotateY: -5, restRotateY: -2, transformOrigin: "50% 15%", driftY: -24 },
  // 3 — strong angle from the right corner
  { enterRotateX: 14, restRotateX: 7, enterRotateY: -18, restRotateY: -8, transformOrigin: "32% 30%" },
  // 4 — strong angle from the left corner
  { enterRotateX: 14, restRotateX: 7, enterRotateY: 18, restRotateY: 8, transformOrigin: "68% 30%", oscRotateY: -1.4 },
  // 5 — shallow, wide side-on glide
  { enterRotateX: 12, restRotateX: 6, enterRotateY: -11, restRotateY: -9, transformOrigin: "50% 40%", driftY: -22 },
];

/** Pick a camera variant deterministically from a scene seed (e.g. folio number). */
export const editorialCameraVariant = (seed: number): EditorialCameraOpts => {
  const n = Math.abs(Math.floor(seed)) % CAMERA_VARIANTS.length;
  return CAMERA_VARIANTS[n];
};

export const useEditorialCamera = (o: EditorialCameraOpts = {}): EditorialCamera => {
  const {
    enterRotateX = 20,
    restRotateX = 9,
    enterRotateY = -14,
    restRotateY = -5,
    enterScale = 1.16,
    restScale = 1.0,
    oscRotateX = 2.0,
    oscRotateY = 1.4,
    driftY = -18,
    transformOrigin = "50% 26%",
  } = o;
  const frame = useCurrentFrame();
  const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  // Entrance: a strong swing-in over the first ~22 frames (eased) that settles
  // to a PERSISTENT, clearly-visible resting tilt — the spread is always read as
  // a 3D object held at an angle, never a flat card. A slow oscillation keeps it
  // alive throughout (so it reads even when an incoming transition masks the
  // entrance frames). Newspaper holds ~5°; we hold more so it's unmistakable.
  const enter = easeOutCubic(interpolate(frame, [0, 22], [0, 1], cl));
  const osc = interpolate(frame, [22, 150, 300], [0, 1, 0], cl); // gentle 0→1→0 drift
  const ty = interpolate(frame, [0, 300], [0, driftY], cl);      // slow upward dolly

  const rotateX = interpolate(enter, [0, 1], [enterRotateX, restRotateX]) - osc * oscRotateX;
  const rotateY = interpolate(enter, [0, 1], [enterRotateY, restRotateY]) + osc * oscRotateY;
  const scale = interpolate(enter, [0, 1], [enterScale, restScale]) + interpolate(frame, [22, 150, 300], [0, 0.05, 0.015], cl);

  return {
    transform: `translateY(${ty.toFixed(2)}px) scale(${scale.toFixed(4)}) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`,
    transformOrigin,
  };
};

/**
 * The physical thickness of the open magazine — a stack of page-edge layers
 * sitting just behind the top sheet (each offset down-right and pushed back in Z)
 * so the tilt of the editorial camera reveals a real block of pages, not a flat
 * sheet. Rendered as a sibling of the sheet inside the preserve-3d camera so its
 * translateZ projects correctly. Geometry mirrors the sheet's inset rect.
 */
export const PageThickness: React.FC<{
  sheetInsetX: string;
  sheetInsetY: string;
  layers?: number;
}> = ({ sheetInsetX, sheetInsetY, layers = 8 }) => (
  <>
    {Array.from({ length: layers }).map((_, i) => {
      const k = layers - i; // back-most layer drawn first, furthest in Z
      const dx = k * 2.4;
      const dy = k * 3.2;
      const tone = 236 - k * 4; // cream → light grey toward the back
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            top: `calc(${sheetInsetY} + ${dy}px)`,
            bottom: `calc(${sheetInsetY} - ${dy}px)`,
            left: `calc(${sheetInsetX} + ${dx}px)`,
            right: `calc(${sheetInsetX} - ${dx}px)`,
            background: `linear-gradient(135deg, rgb(${tone},${tone - 4},${tone - 12}) 0%, #ffffff 60%, rgb(${tone - 8},${tone - 12},${tone - 20}) 100%)`,
            boxShadow: "0 10px 26px rgba(0,0,0,0.18)",
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
  const p = isPortrait(aspectRatio);
  const w = p ? 180 : 260;
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
const SCATTER_SHEETS: Array<{
  rotate: number;
  tx: number; // % of frame width
  ty: number; // % of frame height
  cover: string; // photographic cover wash
  shadow: string;
}> = [
  { rotate: -8.5, tx: -3.2, ty: 2.0, cover: "linear-gradient(155deg, #3a3d44 0%, #565049 46%, #211f1c 100%)", shadow: "0 30px 64px rgba(0,0,0,0.42)" },
  { rotate: 5.5, tx: 3.4, ty: -1.4, cover: "linear-gradient(200deg, #2c2e33 0%, #46423b 50%, #15140f 100%)", shadow: "0 24px 54px rgba(0,0,0,0.38)" },
  { rotate: -2.6, tx: -1.4, ty: 1.6, cover: "linear-gradient(165deg, #44464c 0%, #5e574d 44%, #26241f 100%)", shadow: "0 18px 44px rgba(0,0,0,0.34)" },
];

export const DeskBackdrop: React.FC<{ aspectRatio?: string; accent?: string }> = ({ aspectRatio, accent = MAG_DEFAULTS.accent }) => {
  const p = isPortrait(aspectRatio);
  // Match the page-sheet footprint so the pile reads as magazines of the same size.
  const insetX = p ? "5%" : "3.5%";
  const insetY = p ? "4%" : "6.5%";
  const scale = p ? 0.7 : 1; // portrait has less room, so fan less aggressively
  return (
    <>
      {/* deep neutral surface so the dark covers read, no beige wash */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, #43474c 0%, #2c2e31 58%, #17181a 100%)",
        }}
      />
      {/* faint grain so the surface isn't a flat wash */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "5px 5px",
          opacity: 0.5,
        }}
      />
      {/* the ruffled pile of magazine covers under the spread */}
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
            transform: `translate(${s.tx * scale}%, ${s.ty * scale}%) rotate(${s.rotate * scale}deg)`,
            transformOrigin: "center center",
            boxShadow: s.shadow,
            zIndex: i + 1,
          }}
        >
          {/* soft photographic highlight to suggest a cover image */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(ellipse at 38% 30%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 55%)",
            }}
          />
          {/* TIME-style accent frame ruled around the cover */}
          <div
            style={{
              position: "absolute",
              inset: "3.5%",
              border: `${p ? 4 : 6}px solid ${accent}`,
            }}
          />
          {/* a faint masthead bar at the top, inside the frame */}
          <div
            style={{
              position: "absolute",
              top: "8%",
              left: "12%",
              right: "12%",
              height: p ? 10 : 14,
              background: hexToRgba("#ffffff", 0.78),
              borderRadius: 1,
            }}
          />
        </div>
      ))}
      {/* soft vignette to settle the edges */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 46%, rgba(0,0,0,0.45) 100%)",
          zIndex: 4,
        }}
      />
    </>
  );
};

/** A dog-eared page-curl in a bottom corner of the sheet. */
const PageCurl: React.FC<{ corner: "bl" | "br"; size: number; accent?: string }> = ({ corner, size, accent }) => {
  const br = corner === "br";
  return (
    <div style={{ position: "absolute", bottom: 0, [br ? "right" : "left"]: 0, width: size, height: size, zIndex: 8, pointerEvents: "none" }}>
      {/* shadow the lifted corner casts onto the page */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at ${br ? "top left" : "top right"}, rgba(0,0,0,0.22), transparent 68%)`,
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
          clipPath: br ? "polygon(100% 0, 0 100%, 100% 100%)" : "polygon(0 0, 0 100%, 100% 100%)",
          boxShadow: br ? "-3px -3px 8px rgba(0,0,0,0.16)" : "3px -3px 8px rgba(0,0,0,0.16)",
        }}
      />
      {br && accent ? (
        <div style={{ position: "absolute", bottom: size * 0.16, right: size * 0.16, width: 8, height: 8, borderRadius: "50%", background: accent }} />
      ) : null}
    </div>
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
  opacity?: number;
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
  opacity = 1,
  contentStyle,
  children,
}) => {
  const { bg, text, accent } = colors;
  const p = isPortrait(aspectRatio);

  const headOpacity = useReveal(0, 12);
  const ruleProgress = useReveal(3, 16);
  // Vary the 3D camera angle per scene (seeded by the folio) so no two adjacent
  // spreads are shot from the same angle.
  const seed = parseInt(String(page ?? "1").replace(/\D/g, ""), 10) || 1;
  const camera = useEditorialCamera(editorialCameraVariant(seed));

  // Sheet geometry (% of frame)
  const sheetInsetX = p ? "5%" : "3.5%";
  const sheetInsetY = p ? "4%" : "6.5%";
  const padX = p ? "7%" : "6%";
  const curl = p ? 64 : 78;

  return (
    <AbsoluteFill
      style={{
        fontFamily: fontFamily ?? MAG_SERIF,
        opacity,
        perspective: "1800px",
        perspectiveOrigin: "50% 34%",
      }}
    >
      {/* Desk surface with loose magazine covers scattered behind the spread (static ground) */}
      <DeskBackdrop aspectRatio={aspectRatio} accent={accent} />

      {/* 3D editorial camera — swings/drifts the spread + page-thickness block */}
      <AbsoluteFill
        style={{
          transformStyle: "preserve-3d",
          transform: camera.transform,
          transformOrigin: camera.transformOrigin,
          zIndex: 5,
        }}
      >
        {/* The physical block of pages under the open spread */}
        <PageThickness sheetInsetX={sheetInsetX} sheetInsetY={sheetInsetY} />

      {/* The page sheet */}
      <div
        style={{
          position: "absolute",
          top: sheetInsetY,
          bottom: sheetInsetY,
          left: sheetInsetX,
          right: sheetInsetX,
          background: bg,
          boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 8px 22px rgba(0,0,0,0.30)",
          overflow: "hidden",
          zIndex: 5,
        }}
      >
        {/* Printed-page layer — a faint, blurred ghost of the magazine spread
            on the sheet itself, giving each page a real "printed" texture
            beneath the live content. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${staticFile("magazine-blur-bg.svg")})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(3px) saturate(0.9)",
            opacity: 0.16,
            zIndex: 0,
            pointerEvents: "none",
          }}
        />

        {/* centre spine */}
        {!hideGutter && <MagazineGutter color={text} sheen={bg} aspectRatio={aspectRatio} opacity={headOpacity} />}

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
            ...contentStyle,
          }}
        >
          {children}
        </div>

        {/* Dog-eared corners */}
        <PageCurl corner="bl" size={curl} />
        <PageCurl corner="br" size={curl} accent={accent} />
        </div>
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
