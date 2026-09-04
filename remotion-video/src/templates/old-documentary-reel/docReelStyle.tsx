/**
 * Shared Old Documentary Reel design system — grayscale found-footage palette,
 * Oswald/Courier Prime type (exactly two font styles, no italics, across
 * every scene), the chipped-edge SVG turbulence mask, sprocket letterboxing,
 * film grain/weave/tracking-roll ambience, and the per-era (newsreel /
 * home_movie / tape_dub) archive treatment. Every docreel layout imports
 * from here.
 *
 * IMPORTANT: this file exists in BOTH trees and must stay byte-identical:
 *   remotion-video/src/templates/old-documentary-reel/docReelStyle.tsx
 *   frontend/src/components/remotion/old-documentary-reel/docReelStyle.tsx
 */
import React, { useId, useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Img,
} from "remotion";
import { DocReelClip } from "./components/DocReelClip";
import "@fontsource/oswald/400.css";
import "@fontsource/oswald/500.css";
import "@fontsource/oswald/700.css";
import "@fontsource/courier-prime/400.css";
import "@fontsource/courier-prime/700.css";

// ─── Palette (single source of truth) ────────────────────────────────────────
// STRICT: only these 3 colors, grayscale only. Everything else is an rgba() of
// one of these three at lower opacity — no warm/sepia tint anywhere.

export const DOCREEL = {
  bg: "#171512", // near-black
  text: "#b6b0a1", // muted gray
  accent: "#f4f0e2", // warm white
};

// STRICT: exactly two font styles across the entire template, no italics —
// DISPLAY (Oswald) for headings/emphasis, MONO (Courier Prime) for
// body/typewriter text. Matches docreel_dossier, the reference layout.
export const DOCREEL_DISPLAY_FONT =
  "'Oswald', 'Arial Narrow', Impact, sans-serif";
export const DOCREEL_MONO_FONT = "'Courier Prime', 'Courier New', monospace";

// ─── Reference era ────────────────────────────────────────────────────────────
// Per-project setting (like an aspect ratio), NOT per-scene. Drives which
// archive-effect skins are active: Newsreel (optical wipes / cue dots),
// Home Movie (Super-8 weave / halation), Tape Dub (VHS tracking / scanlines).

export type DocReelEra = "newsreel" | "home_movie" | "tape_dub";

export const DEFAULT_DOCREEL_ERA: DocReelEra = "tape_dub";

// ─── Global tempo ────────────────────────────────────────────────────────────

/**
 * Master slow-motion factor for archival ambience (weave, grain drift, tracking
 * roll). < 1 slows everything down — old projectors and worn tape decks never
 * run perfectly steady. Raise toward 1 for snappier motion.
 */
export const DOCREEL_TEMPO = 0.85;

export const useDocReelFrame = (): number =>
  Math.round(useCurrentFrame() * DOCREEL_TEMPO);

// ─── Color utilities ─────────────────────────────────────────────────────────

export const hexToRgba = (hex: string, alpha: number): string => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

/** Parse a hex color to an RGB triplet in 0-1, for SVG feColorMatrix channels. */
export const hexToRgbTriplet = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// ─── HSL round-trip (for the legibility guard) ───────────────────────────────
// Ported from sakura/sakuraStyle.tsx, where the same guard is already proven.

export const hexToHsl = (
  hex: string,
): { h: number; s: number; l: number } | null => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || (full.length !== 6 && full.length !== 8)) return null;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue: number;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / d + 2) / 6;
  else hue = ((r - g) / d + 4) / 6;
  return { h: hue, s, l };
};

export const hslToHex = (h: number, s: number, l: number): string => {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

// ─── Theme ───────────────────────────────────────────────────────────────────

/**
 * Every color the template paints, resolved from the user's three colors.
 *
 * The template runs in one of two modes (see makeDocReelTheme):
 *   - untouched palette → DOCREEL_STOCK_THEME, today's exact values verbatim
 *   - any color customized → every slot derived from the user's three
 *
 * Both modes satisfy this same interface, so a call site reads one slot and
 * is correct in both. A region can only fall out of sync with the user's
 * colors by reading something OTHER than a theme slot.
 */
export interface DocReelTheme {
  bg: string;
  text: string;
  accent: string;
  /** Base for shadows/scrims — "the absence of light". */
  shadowBase: string;
  /** The photo-pan check-mark, the template's one non-grayscale accent. */
  mark: string;
  /** RGB triplet (0-1) driving AgedPaperTexture's feColorMatrix. */
  paperTone: [number, number, number];
  line: string;
  lineStrong: string;
  panel: string;
  panelStrong: string;
  shadow: string;
  muted: string;
}

/**
 * Today's palette, verbatim — including the values that are NOT derivable from
 * the three colors (pure-black shadows, the red check-mark, the aged-paper
 * matrix tone). Returned as-is whenever the user has not customized anything,
 * which is what makes the default render bit-for-bit unchanged: on that path
 * no derivation runs at all, so nothing can drift.
 */
const DOCREEL_STOCK_THEME: DocReelTheme = {
  bg: DOCREEL.bg,
  text: DOCREEL.text,
  accent: DOCREEL.accent,
  shadowBase: "#000000",
  mark: "#c1554a",
  paperTone: [0.71, 0.69, 0.63],
  line: hexToRgba(DOCREEL.text, 0.18),
  lineStrong: hexToRgba(DOCREEL.text, 0.34),
  panel: hexToRgba(DOCREEL.text, 0.06),
  panelStrong: hexToRgba(DOCREEL.bg, 0.72),
  shadow: hexToRgba("#000000", 0.6),
  muted: hexToRgba(DOCREEL.text, 0.7),
};

export interface DocReelColorInput {
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
}

const sameColor = (a: string | undefined, b: string): boolean =>
  (a ?? b).toLowerCase() === b.toLowerCase();

/**
 * True when all three colors still equal the template defaults. Note this is a
 * VALUE comparison, not a null check: switching to this template overwrites the
 * project's colors with its preview_colors, so the props always arrive
 * populated and `|| DEFAULT` fallbacks never fire.
 */
export const isDefaultPalette = (c?: DocReelColorInput): boolean =>
  sameColor(c?.bgColor, DOCREEL.bg) &&
  sameColor(c?.textColor, DOCREEL.text) &&
  sameColor(c?.accentColor, DOCREEL.accent);

/**
 * The scene ground is near-black, while the app-wide default text color is
 * #000000 — applied verbatim that would be invisible. Keep the user's hue and
 * saturation but lift lightness to a legible floor, so their choice is still
 * visibly applied rather than silently discarded (which is what made "change
 * the text color" look like a no-op).
 */
const legibleOnDark = (textColor: string | undefined): string => {
  if (!textColor || sameColor(textColor, DOCREEL.text)) return DOCREEL.text;
  const hsl = hexToHsl(textColor);
  if (!hsl) return DOCREEL.text;
  if (hsl.l < 0.55) return hslToHex(hsl.h, hsl.s, 0.7);
  return textColor;
};

/**
 * Resolve the user's three colors into every color the template paints.
 * Untouched → today's exact values. Customized → everything derived, including
 * the areas that were previously hardcoded (shadows, the check-mark, paper
 * grain, film chrome, transitions).
 */
export const makeDocReelTheme = (c?: DocReelColorInput): DocReelTheme => {
  if (isDefaultPalette(c)) return DOCREEL_STOCK_THEME;

  const bg = c?.bgColor || DOCREEL.bg;
  const text = legibleOnDark(c?.textColor);
  const accent = c?.accentColor || DOCREEL.accent;
  return {
    bg,
    text,
    accent,
    shadowBase: bg,
    mark: accent,
    paperTone: hexToRgbTriplet(text),
    line: hexToRgba(text, 0.18),
    lineStrong: hexToRgba(text, 0.34),
    panel: hexToRgba(text, 0.06),
    panelStrong: hexToRgba(bg, 0.72),
    shadow: hexToRgba(bg, 0.6),
    muted: hexToRgba(text, 0.7),
  };
};

const DocReelThemeContext = React.createContext<DocReelTheme>(DOCREEL_STOCK_THEME);

export const DocReelThemeProvider = DocReelThemeContext.Provider;

/** Read the active palette. Falls back to the stock theme outside a provider
 *  (preview thumbnails, Remotion Studio), so nothing renders colorless. */
export const useDocReelTheme = (): DocReelTheme =>
  React.useContext(DocReelThemeContext);

// Deterministic pseudo-random in [0, 1)
export const docReelRand = (seed: number, n: number): number =>
  Math.abs(Math.sin(seed * 127.1 + n * 311.7) * 43758.5453) % 1;

export const isPortraitRatio = (aspectRatio?: string) => aspectRatio === "portrait";

// ─── Scene fade ───────────────────────────────────────────────────────────────

export const useSceneFade = (
  dur: number,
  enterFrames = 10,
  exitFrames = 12,
): number => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, enterFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(frame, [dur - exitFrames, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return enter * exit;
};

// ─── Typewriter reveal ────────────────────────────────────────────────────────

/**
 * Character-by-character typing reveal for DOCREEL_MONO_FONT body text —
 * the "typewriter font" should actually type, not just fade in as a block.
 * Same math as the original docreel_dossier implementation: typing speed
 * scales with length so a longer paragraph still finishes within a
 * reasonable beat, and a blinking cursor renders only while typing is in
 * progress (never after, so a finished paragraph doesn't sit with a
 * permanently blinking underscore).
 *
 * Only for genuine prose/paragraph content — short labels, badges, and
 * repeating small metadata (chapter numbers, frame counters, CTA pills)
 * should keep their existing fade/instant reveal instead; typing those out
 * character-by-character reads as slow and busy rather than dramatic.
 */
/** Pure (non-hook) version for call sites inside a `.map()` loop — e.g. a
 * repeating list of rows, each with its own independent typing start frame —
 * where calling a hook per-item would violate the Rules of Hooks. Takes the
 * already-read `frame` value directly instead of calling useCurrentFrame(). */
/**
 * Global typing-pace multiplier for every typewriter in the template.
 * `typeSpeed` below is FRAMES PER CHARACTER, so a larger factor types
 * SLOWER. Raise this to make text land more deliberately; lower it toward 1
 * to speed the whole template back up. Applies to every scene at once —
 * every layout types through typewriterAt (directly or via
 * useTypewriterReveal), so there is exactly one place to tune this.
 */
export const DOCREEL_TYPE_PACE = 1.6;

/**
 * Frames to leave between the last character landing and the scene cutting —
 * long copy that finishes on the very last frame reads as though it were
 * clipped, so the typing always lands with a beat to spare.
 */
const TYPE_TAIL_FRAMES = 12;

export const typewriterAt = (
  frame: number,
  text: string,
  startFrame = 24,
  /**
   * Scene length in frames. When supplied, the pace is compressed as much as
   * needed for the text to finish typing before the scene ends.
   *
   * Without it the pace is purely per-character, so a long paragraph in a short
   * scene simply runs out of time and the copy is cut off mid-word (the scene
   * ends showing "...questioned for ver_"). The length tiers below already
   * speed long text up, but they cannot know how long the scene actually is —
   * only this deadline can. Omit it and behaviour is exactly as before.
   */
  durationInFrames?: number,
): { visibleText: string; cursor: React.ReactNode } => {
  const chars = text.length;
  const baseSpeed = (chars > 160 ? 0.55 : chars > 90 ? 0.8 : 1.1) * DOCREEL_TYPE_PACE;
  // Frames actually available for typing, once the lead-in and the tail beat
  // are paid for.
  const budget =
    durationInFrames === undefined
      ? undefined
      : Math.max(1, durationInFrames - startFrame - TYPE_TAIL_FRAMES);
  // Compress ONLY when the designed pace would overrun the scene. Copy that
  // already finishes in time keeps its original pace exactly — clamping every
  // scene to "finish exactly at the deadline" would have quietly re-timed every
  // existing short-copy scene in the template, which is a visual change nobody
  // asked for. This only ever speeds text up, never slows it down to fill time.
  const needed = chars * baseSpeed;
  const typeSpeed =
    budget === undefined || chars === 0 || needed <= budget
      ? baseSpeed
      : budget / chars;
  const endFrame = startFrame + chars * typeSpeed;
  const typedChars = Math.floor(
    interpolate(frame, [startFrame, endFrame], [0, chars], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const done = frame > endFrame;
  const visibleText = done ? text : text.slice(0, typedChars);
  const cursor =
    frame >= startFrame && !done ? (
      <span style={{ opacity: frame % 20 < 10 ? 1 : 0 }}>_</span>
    ) : null;
  return { visibleText, cursor };
};

export const useTypewriterReveal = (
  text: string,
  startFrame = 24,
  /** Scene length in frames — see `typewriterAt`. Pass the layout's `dur` so
   *  long copy speeds up enough to finish before the scene cuts. */
  durationInFrames?: number,
): { visibleText: string; cursor: React.ReactNode } => {
  const frame = useCurrentFrame();
  return typewriterAt(frame, text, startFrame, durationInFrames);
};

// ─── Chipped-edge SVG turbulence mask ────────────────────────────────────────

/**
 * A static feTurbulence + feDisplacementMap filter that gives Oswald headers
 * a chipped, worn-emulsion edge — like a title card that's been dupe-generation
 * lossy for forty years. STATIC (no animated baseFrequency), applied once per
 * heading instance. Returns the filter def (mount once) + the filter id to
 * apply via `style={{ filter: `url(#${id})` }}`.
 */
let chipFilterCounter = 0;
export const useChippedEdgeFilter = (scale = 2.2): { id: string; defs: React.ReactNode } => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = `docreel-chip-${uid}`;
  const defs = (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id={id} x="-10%" y="-30%" width="120%" height="160%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.01 0.9"
            numOctaves={2}
            seed={11}
            result="chipNoise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="chipNoise"
            scale={scale}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
  return { id, defs };
};

/** Oswald display heading with the chipped-edge texture baked in. */
export const ChippedHeading: React.FC<{
  children: React.ReactNode;
  fontSize: number;
  color?: string;
  fontWeight?: number;
  letterSpacing?: string;
  style?: React.CSSProperties;
}> = ({ children, fontSize, color, fontWeight = 700, letterSpacing = "0.02em", style }) => {
  const theme = useDocReelTheme();
  const { id, defs } = useChippedEdgeFilter(fontSize * 0.018);
  const headingColor = color ?? theme.accent;
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {defs}
      <div
        style={{
          fontFamily: DOCREEL_DISPLAY_FONT,
          fontWeight,
          fontSize,
          color: headingColor,
          letterSpacing,
          textTransform: "uppercase",
          filter: `url(#${id})`,
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ─── Film grain (emulsion grain texture) ─────────────────────────────────────

/** Static per-mount noise field, animated by cheap frame-indexed offset — cheap paint. */
export const EmulsionGrain: React.FC<{ opacity?: number; intensity?: number }> = ({
  opacity = 0.16,
  intensity = 1,
}) => {
  const frame = useDocReelFrame();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const offsetX = (frame * 13) % 97;
  const offsetY = (frame * 7) % 89;
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: "absolute", inset: 0, opacity, pointerEvents: "none", mixBlendMode: "overlay" }}
    >
      <defs>
        <filter id={`grain-${uid}`}>
          <feTurbulence type="fractalNoise" baseFrequency={0.85 * intensity} numOctaves={2} stitchTiles="stitch" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0" />
        </filter>
      </defs>
      <rect
        x={-offsetX}
        y={-offsetY}
        width="110%"
        height="110%"
        filter={`url(#grain-${uid})`}
      />
    </svg>
  );
};

// ─── Dust & Scratches ─────────────────────────────────────────────────────────

export const DustAndScratches: React.FC<{ opacity?: number; seed?: number }> = ({ opacity = 0.5, seed = 4 }) => {
  const theme = useDocReelTheme();
  const frame = useDocReelFrame();
  const { width, height } = useVideoConfig();
  // Scratches: a handful of thin vertical lines that jump position every ~6 frames
  // (deterministic per-cycle, not continuous drift — reads as reel damage, not rain).
  const cycle = Math.floor(frame / 6);
  const scratches = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const s = seed + i * 19.1 + cycle * 3.3;
        return {
          x: docReelRand(s, 1) * width,
          w: 0.6 + docReelRand(s, 2) * 1.4,
          op: 0.3 + docReelRand(s, 3) * 0.6,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, width, cycle],
  );
  // Dust specks: sparse dots that flicker in/out
  const specks = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const s = seed + i * 7.7;
        return {
          x: docReelRand(s, 1) * width,
          y: docReelRand(s, 2) * height,
          r: 1 + docReelRand(s, 3) * 2.2,
        };
      }),
    [seed, width, height],
  );
  const speckCycle = Math.floor(frame / 4);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0, opacity, pointerEvents: "none" }}>
      {scratches.map((s, i) => (
        <rect key={i} x={s.x} y={0} width={s.w} height={height} fill={theme.accent} opacity={s.op} />
      ))}
      {specks.map((d, i) => {
        const on = docReelRand(seed + i * 3.1, speckCycle) > 0.55;
        if (!on) return null;
        return <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={theme.accent} opacity={0.7} />;
      })}
    </svg>
  );
};

// ─── Sprocket letterboxing ────────────────────────────────────────────────────

/** Film-strip sprocket holes running along top+bottom letterbox bars. */
/**
 * Sprocket-hole letterbox bars, top + bottom. The holes scroll continuously
 * (like film feeding through a projector gate) rather than sitting frozen —
 * a real strip is always mid-feed, never at rest. Bottom row scrolls opposite
 * direction from the top for a subtle feed/take-up reel asymmetry.
 */
/**
 * Height of ONE sprocket letterbox bar. Exported because layouts have to
 * reserve this space at the top AND bottom of the frame: the bars are opaque
 * and painted OVER the scene, so anything a layout centres into the full frame
 * height can end up hidden underneath them.
 */
export const SPROCKET_BAR_HEIGHT = 34;

export const SprocketLetterboxing: React.FC<{ barHeight?: number }> = ({ barHeight = SPROCKET_BAR_HEIGHT }) => {
  const theme = useDocReelTheme();
  const frame = useDocReelFrame();
  const { width, height } = useVideoConfig();
  const holeSpacing = 46;
  const holes = Math.ceil(width / holeSpacing) + 3;
  const scrollSpeed = 0.9; // px/frame — slow, steady feed
  const row = (y: number, direction: 1 | -1) => {
    const offset = ((frame * scrollSpeed * direction) % holeSpacing + holeSpacing) % holeSpacing;
    return (
      <>
        <rect x={0} y={y} width={width} height={barHeight} fill={theme.bg} />
        {Array.from({ length: holes }, (_, i) => (
          <rect
            key={i}
            x={i * holeSpacing - offset - holeSpacing + 10}
            y={y + barHeight / 2 - 6}
            width={20}
            height={12}
            rx={3}
            fill={hexToRgba(theme.text, 0.28)}
          />
        ))}
      </>
    );
  };
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {row(0, 1)}
      {row(height - barHeight, -1)}
    </svg>
  );
};

// ─── Single Film Frame ────────────────────────────────────────────────────────

/**
 * A single physical frame of film — one bold bordered cell with heavy solid
 * black rails and large rounded-square sprocket holes down all four edges —
 * that the scene's entire content sits inside, rather than loose filmstrips
 * flying past in the background. Modeled on the classic "film frame" icon:
 * thick solid rails (not thin outlined ones), chunky perforations, a strong
 * rounded outer border. The area outside the frame stays plain scene
 * background, so the whole composition reads as "looking at one frame of a
 * strip of film" instead of a busy multi-strip backdrop. `inset` controls
 * how far the frame sits from the edges of the screen (in px); `children`
 * render clipped to the frame's inner (image) area.
 */
export const SingleFilmFrame: React.FC<{
  inset?: number;
  children?: React.ReactNode;
}> = ({ inset = 28, children }) => {
  const theme = useDocReelTheme();
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  // Thinner rail, smaller and much more tightly packed perforations — a
  // dense uniform row of small rectangular holes, matching a real 35mm
  // perforation strip rather than a few chunky rounded squares.
  const railW = Math.max(30, width * 0.024);
  const outerRadius = 4;
  const holeShort = railW * 0.42;
  const holeLong = railW * 0.62;
  const holeGap = holeLong * 0.75;
  const holeRadius = 2;
  const spacing = holeLong + holeGap;
  const innerLeft = inset + railW;
  const innerTop = inset + railW;
  const innerW = width - inset * 2 - railW * 2;
  const innerH = height - inset * 2 - railW * 2;

  // Continuous feed — the perforations scroll steadily along each rail like
  // film running through a projector, never settling into a static pattern.
  // Oversized counts + a clip path (rather than sizing the array to match
  // the rail exactly) so the scrolling holes never run out mid-rail.
  const scrollSpeed = 1.4;
  const offset = ((frame * scrollSpeed) % spacing + spacing) % spacing;
  const vHoleCount = Math.ceil(innerH / spacing) + 2;
  const vHoleYs = Array.from({ length: vHoleCount }, (_, i) => innerTop - spacing + i * spacing - offset);
  const hHoleCount = Math.ceil(innerW / spacing) + 2;
  const hHoleXs = Array.from({ length: hHoleCount }, (_, i) => innerLeft - spacing + i * spacing - offset);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <clipPath id={`sff-left-${uid}`}>
            <rect x={inset} y={innerTop} width={railW} height={innerH} />
          </clipPath>
          <clipPath id={`sff-right-${uid}`}>
            <rect x={width - inset - railW} y={innerTop} width={railW} height={innerH} />
          </clipPath>
          <clipPath id={`sff-top-${uid}`}>
            <rect x={innerLeft} y={inset} width={innerW} height={railW} />
          </clipPath>
          <clipPath id={`sff-bottom-${uid}`}>
            <rect x={innerLeft} y={height - inset - railW} width={innerW} height={railW} />
          </clipPath>
        </defs>
        {/* Heavy solid outer frame — a thick black rounded rect, not a thin outline */}
        <rect
          x={inset}
          y={inset}
          width={width - inset * 2}
          height={height - inset * 2}
          rx={outerRadius}
          fill={theme.bg}
        />
        {/* Small, densely-packed rectangular sprocket holes through the
            left/right rails, continuously feeding downward — a real 35mm
            perforation strip in motion, not a static decoration. */}
        <g clipPath={`url(#sff-left-${uid})`}>
          {vHoleYs.map((y, i) => (
            <rect key={`vl${i}`} x={inset + (railW - holeShort) / 2} y={y} width={holeShort} height={holeLong} rx={holeRadius} fill={theme.text} opacity={0.94} />
          ))}
        </g>
        <g clipPath={`url(#sff-right-${uid})`}>
          {vHoleYs.map((y, i) => (
            <rect
              key={`vr${i}`}
              x={width - inset - railW + (railW - holeShort) / 2}
              y={y}
              width={holeShort}
              height={holeLong}
              rx={holeRadius}
              fill={theme.text}
              opacity={0.94}
            />
          ))}
        </g>
        {/* Same dense perforation strip through the top/bottom rails,
            feeding rightward in sync with the vertical rails. */}
        <g clipPath={`url(#sff-top-${uid})`}>
          {hHoleXs.map((x, i) => (
            <rect key={`ht${i}`} x={x} y={inset + (railW - holeShort) / 2} width={holeLong} height={holeShort} rx={holeRadius} fill={theme.text} opacity={0.94} />
          ))}
        </g>
        <g clipPath={`url(#sff-bottom-${uid})`}>
          {hHoleXs.map((x, i) => (
            <rect
              key={`hb${i}`}
              x={x}
              y={height - inset - railW + (railW - holeShort) / 2}
              width={holeLong}
              height={holeShort}
              rx={holeRadius}
              fill={theme.text}
              opacity={0.94}
            />
          ))}
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          left: innerLeft,
          top: innerTop,
          width: innerW,
          height: innerH,
          overflow: "hidden",
          pointerEvents: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ─── Filmstrip Three-Cell ──────────────────────────────────────────────────────

/** Static (non-scrolling) row of bold, widely-spaced rounded-square sprocket
 *  holes spanning one edge of the WHOLE strip — matching the reference icon
 *  exactly: a chunky black rail with large square-ish perforations, not a
 *  dense row of small thin rectangles. One row along the outer top edge, one
 *  along the outer bottom edge of the entire 3-cell strip, not per cell. */
const FilmstripStripRail: React.FC<{
  length: number;
  railW: number;
  edge: "top" | "bottom";
}> = ({ length, railW, edge }) => {
  const theme = useDocReelTheme();
  const holeSize = railW * 0.6;
  const spacing = holeSize * 1.7;
  const count = Math.max(1, Math.floor((length + spacing - holeSize) / spacing));
  const totalHolesLength = count * holeSize + (count - 1) * (spacing - holeSize);
  const start = (length - totalHolesLength) / 2;
  const positions = Array.from({ length: count }, (_, i) => start + i * spacing);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, [edge]: 0, height: railW, background: theme.bg, overflow: "hidden", pointerEvents: "none" }}>
      {positions.map((x, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: (railW - holeSize) / 2,
            width: holeSize,
            height: holeSize,
            borderRadius: holeSize * 0.18,
            background: theme.text,
          }}
        />
      ))}
    </div>
  );
};

/**
 * The classic three-frame 35mm filmstrip icon: three rectangular cells in a
 * single strip, with a wider interview frame in the centre, separated by solid dividers,
 * with one static sprocket-hole row along the strip's outer top edge and
 * one along its outer bottom edge (not repeated per cell — matching the
 * reference icon exactly). Landscape lays the three cells out in a row;
 * portrait stacks them in a column instead, since three cells side-by-side
 * would be unusably narrow in a 9:16 frame. Only the middle cell ever holds
 * content — the outer two stay empty, matching the reference image.
 */
export const FilmstripThreeCell: React.FC<{
  inset?: number;
  portrait?: boolean;
  children?: React.ReactNode;
}> = ({ inset = 28, portrait = false, children }) => {
  const theme = useDocReelTheme();
  const { width, height } = useVideoConfig();
  const outerW = width - inset * 2;
  const outerH = height - inset * 2;
  const railW = Math.max(16, (portrait ? outerW : outerH) * 0.05);
  // A real, visually substantial divider — sized off the strip's own main
  // axis, not off the thin sprocket rail, so "wider" actually reads as
  // wider rather than a barely-there bump.
  const dividerW = Math.max(24, (portrait ? outerH : outerW) * 0.05);
  // The sprocket rail always runs the strip's full width — it sits along the
  // outer top/bottom edge of the whole 3-cell strip, whether the cells
  // themselves are arranged in a row (landscape) or a column (portrait).
  const railLength = outerW;

  const Cell: React.FC<{ isMiddle: boolean }> = ({ isMiddle }) => (
    <div
      style={{
        position: "relative",
        // Give the interview frame more negative-film area than the two
        // surrounding blank frames. This makes the dark quote panel read as
        // the broad centre of a strip rather than a narrow third column.
        flex: isMiddle ? (portrait ? 3.2 : 2.2) : 1,
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* Every cell starts as a blank exposed frame — a flat neutral gray,
          NOT derived from theme.text (whose hex has a warm/tan undertone
          that shows through at any opacity) — with the middle cell's real
          content painted over it once bound. */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, background: "#8a8a86" }} />
      {isMiddle ? (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          {children}
        </div>
      ) : null}
    </div>
  );

  const dividerStyle: React.CSSProperties = portrait
    ? { height: dividerW, background: theme.bg, flexShrink: 0 }
    : { width: dividerW, background: theme.bg, flexShrink: 0 };

  return (
    <div
      style={{
        position: "absolute",
        left: inset,
        top: inset,
        width: outerW,
        height: outerH,
        background: theme.bg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <FilmstripStripRail length={railLength} railW={railW} edge="top" />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: railW,
          bottom: railW,
          minHeight: 0,
          display: "flex",
          flexDirection: portrait ? "column" : "row",
        }}
      >
        <Cell isMiddle={false} />
        <div style={dividerStyle} />
        <Cell isMiddle />
        <div style={dividerStyle} />
        <Cell isMiddle={false} />
      </div>
      <FilmstripStripRail length={railLength} railW={railW} edge="bottom" />
    </div>
  );
};

// ─── Halation Vignette ────────────────────────────────────────────────────────

export const HalationVignette: React.FC<{ intensity?: number }> = ({ intensity = 1 }) => {
  const theme = useDocReelTheme();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <defs>
        <radialGradient id={`hal-${uid}`} cx="50%" cy="46%" r="72%">
          <stop offset="0%" stopColor={theme.accent} stopOpacity={0} />
          <stop offset="62%" stopColor={theme.accent} stopOpacity={0} />
          <stop offset="100%" stopColor={theme.bg} stopOpacity={0.55 * intensity} />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill={`url(#hal-${uid})`} />
    </svg>
  );
};

// ─── Low-Res Scanline ─────────────────────────────────────────────────────────

export const LowResScanline: React.FC<{ opacity?: number }> = ({ opacity = 0.14 }) => {
  const theme = useDocReelTheme();
  const { width, height } = useVideoConfig();
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0, opacity, pointerEvents: "none" }}>
      {Array.from({ length: Math.ceil(height / 3) }, (_, i) => (
        <rect key={i} x={0} y={i * 3} width={width} height={1} fill={theme.shadowBase} opacity={0.5} />
      ))}
    </svg>
  );
};

// ─── Light Leak ───────────────────────────────────────────────────────────────

export const LightLeak: React.FC<{ startFrame?: number; opacity?: number }> = ({ startFrame = 0, opacity = 0.4 }) => {
  const theme = useDocReelTheme();
  const frame = useDocReelFrame();
  const t = interpolate(frame, [startFrame, startFrame + 20, startFrame + 40], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background: `linear-gradient(115deg, transparent 40%, ${hexToRgba(theme.accent, 0.5)} 68%, transparent 90%)`,
        opacity: t * opacity,
      }}
    />
  );
};

// ─── Film Weave (per-frame jitter, Home Movie era) ───────────────────────────

export const useFilmWeave = (era: DocReelEra, amount = 1): { x: number; y: number; rotate: number } => {
  const frame = useDocReelFrame();
  if (era !== "home_movie") return { x: 0, y: 0, rotate: 0 };
  const x = (docReelRand(frame, 1) - 0.5) * 3.2 * amount;
  const y = (docReelRand(frame, 2) - 0.5) * 2.6 * amount;
  const rotate = (docReelRand(frame, 3) - 0.5) * 0.25 * amount;
  return { x, y, rotate };
};

// ─── Tracking Roll (VHS band jitter, Tape Dub era) ───────────────────────────

export const TrackingRoll: React.FC<{ era: DocReelEra }> = ({ era }) => {
  const theme = useDocReelTheme();
  const frame = useDocReelFrame();
  const { width, height } = useVideoConfig();
  if (era !== "tape_dub") return null;
  // A band that occasionally rolls through, with horizontal tearing.
  const cycle = frame % 210;
  const active = cycle < 14;
  if (!active) return null;
  const bandY = interpolate(cycle, [0, 14], [0, height], { extrapolateRight: "clamp" });
  const tear = (docReelRand(frame, 5) - 0.5) * 18;
  return (
    <div
      style={{
        position: "absolute",
        left: tear,
        right: -tear,
        top: bandY - 22,
        height: 44,
        pointerEvents: "none",
        background: `linear-gradient(180deg, transparent, ${hexToRgba(theme.text, 0.3)}, transparent)`,
        filter: "blur(1px)",
      }}
    />
  );
};

// ─── Projector Reel ───────────────────────────────────────────────────────────

/**
 * A metal take-up reel with spokes, a hub, and a projector light beam —
 * matching the reference projector photograph. Spins continuously (never
 * frozen). Used as end-card imagery on the Reel-Out scene and by the
 * Reel-Change Cue archive effect.
 */
export const ProjectorReel: React.FC<{
  size?: number;
  opacity?: number;
  color?: string;
  spokes?: number;
  /** degrees/frame — real film reels turn slowly and steadily */
  spinSpeed?: number;
  /** paints the light-beam cone below the reel, like a running projector */
  beam?: boolean;
}> = ({ size = 220, opacity = 0.9, color, spokes = 6, spinSpeed = 0.6, beam = true }) => {
  const theme = useDocReelTheme();
  const reelColor = color ?? theme.text;
  const frame = useDocReelFrame();
  const rotation = (frame * spinSpeed) % 360;
  const r = size / 2;
  const hubR = size * 0.09;
  const rimR = size * 0.46;
  const spokeW = size * 0.045;

  return (
    <svg width={size} height={size * (beam ? 1.6 : 1)} viewBox={`0 0 ${size} ${size * (beam ? 1.6 : 1)}`} style={{ overflow: "visible" }}>
      {beam && (
        <polygon
          points={`${r - size * 0.04},${size * 0.92} ${r + size * 0.04},${size * 0.92} ${r + size * 0.62},${size * 1.55} ${r - size * 0.62},${size * 1.55}`}
          fill={hexToRgba(theme.accent, 0.14)}
        />
      )}
      <g transform={`translate(${r}, ${r}) rotate(${rotation})`}>
        {/* Outer rim */}
        <circle cx={0} cy={0} r={rimR} fill="none" stroke={reelColor} strokeWidth={size * 0.02} opacity={opacity * 0.8} />
        {/* Spokes with elliptical cutouts (matches the reference reel's open web) */}
        {Array.from({ length: spokes }, (_, i) => {
          const a = (360 / spokes) * i;
          return (
            <g key={i} transform={`rotate(${a})`}>
              <rect x={-spokeW / 2} y={-rimR} width={spokeW} height={rimR - hubR * 1.4} fill={reelColor} opacity={opacity * 0.7} />
              <ellipse cx={0} cy={-(hubR * 1.4 + (rimR - hubR * 1.4) / 2)} rx={rimR * 0.16} ry={rimR * 0.22} fill="none" stroke={reelColor} strokeWidth={size * 0.012} opacity={opacity * 0.35} />
            </g>
          );
        })}
        {/* Hub */}
        <circle cx={0} cy={0} r={hubR} fill={reelColor} opacity={opacity} />
        <circle cx={0} cy={0} r={hubR * 0.35} fill={theme.bg} />
      </g>
    </svg>
  );
};

// ─── Spiraling Filmstrip backdrop ────────────────────────────────────────────

/** Builds the spine of a single filmstrip that spirals from the bottom-right
 *  corner up to the top-left, unwinding as it travels — the spiral tightens
 *  near the bottom-right start and opens out toward the top-left end, like
 *  film physically uncoiling across the whole frame rather than a neat
 *  logo-sized spiral in one spot. */
export const buildSpiralSpine = (frameW: number, frameH: number, turns: number, segments: number) => {
  const cx = frameW * 1.02;
  const cy = frameH * 1.04;
  const maxR = Math.hypot(frameW, frameH) * 1.05;
  const pts: { x: number; y: number; angle: number }[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // ease-out growth: radius opens up faster as it travels outward, so the
    // strip reads as unwinding rather than a uniform Archimedean coil.
    const r = maxR * Math.pow(t, 0.82);
    const angle = Math.PI * 1.25 + t * turns * Math.PI * 2;
    pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), angle });
  }
  return pts;
};

/** The unspooled filmstrip itself — a continuous ribbon (not a thin line)
 *  following the spiral spine, with sprocket holes and frame dividers along
 *  its length, constantly animating: the whole strip creeps along its own
 *  path frame over frame so it always reads as still unwinding, never static.
 *
 *  `turns`/`bandScale`/`speed` are exposed so a layout can dial the coil
 *  tighter or looser without forking the component — DocreelTitleCard uses
 *  the defaults, DocreelEssayCaptions runs a slower, wider-banded variant so
 *  the strip reads as slow atmosphere behind a growing stack of text. */
export const SpiralingFilmstrip: React.FC<{
  seed: number;
  opacity: number;
  turns?: number;
  bandScale?: number;
  speed?: number;
}> = ({ seed, opacity, turns = 2.6, bandScale = 0.075, speed = 0.09 }) => {
  const theme = useDocReelTheme();
  const { width, height } = useVideoConfig();
  const t = useDocReelFrame();
  const segments = 140;
  const spine = buildSpiralSpine(width, height, turns, segments);
  const bandH = Math.min(width, height) * bandScale;

  // Continuous creep along the spine, looping seamlessly: an index offset
  // into the point list, wrapping around, so the strip never stops moving.
  const cycleLen = segments;
  const cycleOffset = (t * speed + docReelRand(seed, 1) * cycleLen) % cycleLen;

  const sampleAt = (idx: number) => {
    const wrapped = ((idx % cycleLen) + cycleLen) % cycleLen;
    const lo = Math.floor(wrapped);
    const hi = (lo + 1) % (segments + 1);
    const frac = wrapped - lo;
    const a = spine[lo] ?? spine[0];
    const b = spine[hi] ?? spine[segments];
    return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac, angle: a.angle + (b.angle - a.angle) * frac };
  };

  // Build the ribbon's two long edges by offsetting perpendicular to the
  // spine's local tangent at each sampled point along the visible stretch.
  const visibleLen = segments * 0.9;
  const sampleCount = 90;
  const topEdge: string[] = [];
  const bottomEdge: string[] = [];
  const holes: { x: number; y: number; edge: "a" | "b" }[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    const s = i / sampleCount;
    const p = sampleAt(cycleOffset + s * visibleLen);
    const pAhead = sampleAt(cycleOffset + s * visibleLen + 0.6);
    const dx = pAhead.x - p.x;
    const dy = pAhead.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (bandH / 2);
    const ny = (dx / len) * (bandH / 2);
    topEdge.push(`${p.x + nx},${p.y + ny}`);
    bottomEdge.push(`${p.x - nx},${p.y - ny}`);
    if (i % 4 === 0) {
      holes.push({ x: p.x + nx * 0.72, y: p.y + ny * 0.72, edge: "a" });
      holes.push({ x: p.x - nx * 0.72, y: p.y - ny * 0.72, edge: "b" });
    }
  }
  const ribbonPath = `M ${topEdge.join(" L ")} L ${bottomEdge.slice().reverse().join(" L ")} Z`;
  const dividerEvery = 6;

  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
      <path d={ribbonPath} fill={hexToRgba(theme.shadowBase, 0.5 * opacity)} stroke={hexToRgba(theme.accent, 0.9 * opacity)} strokeWidth={2.5} />
      {topEdge.map((_, i) =>
        i % dividerEvery === 0 && i < topEdge.length - 1 ? (
          <line
            key={`div${i}`}
            x1={topEdge[i].split(",")[0]}
            y1={topEdge[i].split(",")[1]}
            x2={bottomEdge[topEdge.length - 1 - i].split(",")[0]}
            y2={bottomEdge[topEdge.length - 1 - i].split(",")[1]}
            stroke={hexToRgba(theme.accent, 0.6 * opacity)}
            strokeWidth={1.8}
          />
        ) : null,
      )}
      {holes.map((h, i) => (
        <rect
          key={`hole${i}`}
          x={h.x - bandH * 0.07}
          y={h.y - bandH * 0.1}
          width={bandH * 0.14}
          height={bandH * 0.2}
          rx={bandH * 0.03}
          fill={hexToRgba(theme.bg, 1)}
          stroke={hexToRgba(theme.accent, 0.85 * opacity)}
          strokeWidth={1.4}
          opacity={opacity}
        />
      ))}
    </svg>
  );
};

/** A single filmstrip that spirals continuously from the bottom-right corner
 *  up to the top-left across the whole frame — a layout's own backdrop
 *  texture, present with or without a bound photo. Stays subtle under a
 *  real photo, becomes the dominant visual when there isn't one. */
export const DriftingFilmstripBackdrop: React.FC<{
  seed: number;
  dim?: number;
  turns?: number;
  bandScale?: number;
  speed?: number;
}> = ({ seed, dim = 1, turns, bandScale, speed }) => {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <SpiralingFilmstrip
        seed={seed}
        opacity={Math.min(1, 0.32 * dim)}
        turns={turns}
        bandScale={bandScale}
        speed={speed}
      />
    </div>
  );
};

// ─── Helical Filmstrip (3D corkscrew) ────────────────────────────────────────

/**
 * A filmstrip coiling around a vertical axis in real 3D — a corkscrew, not
 * the flat snail-shell spiral SpiralingFilmstrip draws. The ribbon wraps the
 * axis so you see the FRONT of the strip on the near side of each loop and
 * the BACK on the far side, tightening as it climbs and opening into a wide
 * loop at the base, like film unspooling off a reel and falling.
 *
 * Built by projecting a parametric helix through a manual perspective divide
 * rather than CSS `preserve-3d`: the ribbon has to be depth-SORTED (far
 * segments painted before near ones) for the corkscrew to read correctly
 * where the coil crosses itself, and CSS 3D can't z-sort SVG children.
 * Everything stays inside the 3-color palette — depth is carried by opacity
 * and fill, never by a new hue.
 */
export const HelicalFilmstrip: React.FC<{
  seed: number;
  opacity: number;
  /** Number of complete turns around the axis. */
  turns?: number;
  /** Ribbon width as a fraction of the smaller frame dimension. */
  bandScale?: number;
  /** Radians/frame the whole coil rotates — the unspooling drift. */
  speed?: number;
  /** Horizontal center as a fraction of frame width (0-1). */
  centerX?: number;
  /** How much wider the bottom loop is than the top, 1 = a straight cylinder. */
  flare?: number;
}> = ({
  seed,
  opacity,
  turns = 2.4,
  bandScale = 0.115,
  speed = 0.012,
  centerX = 0.5,
  flare = 2.3,
}) => {
  const theme = useDocReelTheme();
  const { width, height } = useVideoConfig();
  const frame = useDocReelFrame();

  const segments = 132;
  const bandH = Math.min(width, height) * bandScale;
  const cx = width * centerX;
  // Vertical span: starts above the frame and runs past the bottom so the
  // coil is always mid-motion rather than visibly starting/ending on screen.
  const topY = -height * 0.12;
  const botY = height * 1.1;
  // Perspective: distance from the virtual camera to the helix axis. Larger
  // radii push segments toward the viewer, so near-side loops render wider
  // than far-side ones — the depth cue that makes it read as a corkscrew.
  const camZ = Math.max(width, height) * 1.5;
  const baseR = Math.min(width, height) * 0.19;
  const phase = frame * speed + docReelRand(seed, 1) * Math.PI * 2;

  // Sample the helix once, projecting each point to 2D and keeping its depth
  // so quads can be sorted back-to-front before painting.
  const pts = Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments;
    const theta = phase + t * turns * Math.PI * 2;
    // Radius flares toward the bottom — a loose loop at the base tightening
    // as the strip climbs, matching how film piles up as it unspools.
    const r = baseR * (1 + (flare - 1) * Math.pow(t, 1.7));
    const y = topY + (botY - topY) * t;
    const z = Math.cos(theta) * r;
    const scale = camZ / (camZ + z);
    return {
      x: cx + Math.sin(theta) * r * scale,
      y: y * scale + height * 0.5 * (1 - scale),
      z,
      scale,
      // Front of the ribbon faces the camera on the near half of each turn.
      front: z < 0,
    };
  });

  // Real 35mm stock is a light image area flanked by two darker perforated
  // rails. RAIL_FRAC is how much of the ribbon's half-width each rail eats —
  // the sprocket run is the single most recognisable thing about film, so it
  // gets real width rather than a token line of dots.
  const RAIL_FRAC = 0.26;

  // Build one quad per segment, offsetting perpendicular to the projected
  // tangent so the ribbon keeps a consistent visual width along its length.
  // Each segment carries the full cross-section: outer edge → rail inner
  // edge → image area → opposite rail, so rails and image can paint
  // separately and the strip reads as layered stock, not a flat band.
  const quads = pts.slice(0, -1).map((p, i) => {
    const q = pts[i + 1];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    // Unit perpendicular, then scaled by perspective so far parts of the coil
    // are genuinely narrower on screen.
    const ux = -dy / len;
    const uy = dx / len;
    const hp = (bandH / 2) * p.scale;
    const hq = (bandH / 2) * q.scale;
    // Full-width edges
    const pOut = { x: p.x + ux * hp, y: p.y + uy * hp };
    const pIn = { x: p.x - ux * hp, y: p.y - uy * hp };
    const qOut = { x: q.x + ux * hq, y: q.y + uy * hq };
    const qIn = { x: q.x - ux * hq, y: q.y - uy * hq };
    // Rail inner boundaries — where the perforated strips stop and the
    // image area begins.
    const railP = hp * (1 - RAIL_FRAC * 2);
    const railQ = hq * (1 - RAIL_FRAC * 2);
    const pOutR = { x: p.x + ux * railP, y: p.y + uy * railP };
    const pInR = { x: p.x - ux * railP, y: p.y - uy * railP };
    const qOutR = { x: q.x + ux * railQ, y: q.y + uy * railQ };
    const qInR = { x: q.x - ux * railQ, y: q.y - uy * railQ };
    const quad = (a: typeof pOut, b: typeof pOut, c: typeof pOut, d: typeof pOut) =>
      `M ${a.x},${a.y} L ${b.x},${b.y} L ${c.x},${c.y} L ${d.x},${d.y} Z`;
    // Hole centers sit midway across each rail.
    const holeOff = hp * (1 - RAIL_FRAC);
    return {
      i,
      z: (p.z + q.z) / 2,
      front: p.front,
      scale: p.scale,
      // Whole ribbon silhouette, for the outline.
      path: quad(pOut, qOut, qIn, pIn),
      // The lighter exposed image area between the two rails.
      imagePath: quad(pOutR, qOutR, qInR, pInR),
      // The two darker perforated rails.
      railAPath: quad(pOut, qOut, qOutR, pOutR),
      railBPath: quad(pIn, qIn, qInR, pInR),
      holeA: { x: p.x + ux * holeOff, y: p.y + uy * holeOff },
      holeB: { x: p.x - ux * holeOff, y: p.y - uy * holeOff },
      // Angle of the ribbon along its length, so holes/dividers sit square
      // to the strip instead of axis-aligned.
      angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      // Frame divider spans only the image area, not across the rails.
      divider: `M ${pOutR.x},${pOutR.y} L ${pInR.x},${pInR.y}`,
    };
  });

  // Painter's algorithm: furthest (largest z) first, so near loops overlap
  // far ones where the coil crosses itself.
  const sorted = [...quads].sort((a, b) => b.z - a.z);
  // Perforations run wider-than-tall (across the strip), densely, on EVERY
  // segment — a continuous run of holes down both rails is what makes stock
  // read as film rather than a plain ribbon.
  const holeW = bandH * 0.16;
  const holeH = bandH * 0.1;

  return (
    <svg
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
    >
      {sorted.map((q) => {
        // The back of the strip is darker and flatter — you're seeing the
        // unexposed base side through the coil, not the image side.
        const railAlpha = (q.front ? 0.92 : 0.5) * opacity;
        const imageAlpha = (q.front ? 0.4 : 0.2) * opacity;
        const edgeAlpha = (q.front ? 0.95 : 0.45) * opacity;
        return (
          <g key={q.i}>
            {/* Lighter exposed image area down the middle of the strip. */}
            <path
              d={q.imagePath}
              fill={hexToRgba(theme.text, imageAlpha)}
              stroke="none"
            />
            {/* The two dark perforated rails flanking it. */}
            <path d={q.railAPath} fill={hexToRgba(theme.bg, railAlpha)} stroke="none" />
            <path d={q.railBPath} fill={hexToRgba(theme.bg, railAlpha)} stroke="none" />
            {/* Frame divider across the image area only, every few segments. */}
            {q.i % 5 === 0 && (
              <path
                d={q.divider}
                stroke={hexToRgba(theme.bg, edgeAlpha * 0.8)}
                strokeWidth={2.2 * q.scale}
                fill="none"
              />
            )}
            {/* Outline last so it sits over the fills. */}
            <path
              d={q.path}
              fill="none"
              stroke={hexToRgba(theme.accent, edgeAlpha)}
              strokeWidth={1.5 * q.scale}
            />
            {/* Dense sprocket run — every segment, both rails, rotated to
                sit square to the strip as it twists. */}
            {[q.holeA, q.holeB].map((h, hi) => (
              <rect
                key={hi}
                x={h.x - (holeW * q.scale) / 2}
                y={h.y - (holeH * q.scale) / 2}
                width={holeW * q.scale}
                height={holeH * q.scale}
                rx={holeH * q.scale * 0.28}
                transform={`rotate(${q.angle} ${h.x} ${h.y})`}
                fill={hexToRgba(theme.accent, opacity * (q.front ? 0.85 : 0.4))}
                stroke="none"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
};

/** Full-frame backdrop wrapper for HelicalFilmstrip — mirrors
 *  DriftingFilmstripBackdrop's role/API so a layout can swap one coil style
 *  for the other without changing how it's mounted. */
export const HelicalFilmstripBackdrop: React.FC<{
  seed: number;
  dim?: number;
  turns?: number;
  bandScale?: number;
  speed?: number;
  centerX?: number;
  flare?: number;
}> = ({ seed, dim = 1, turns, bandScale, speed, centerX, flare }) => {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <HelicalFilmstrip
        seed={seed}
        opacity={Math.min(1, 0.32 * dim)}
        turns={turns}
        bandScale={bandScale}
        speed={speed}
        centerX={centerX}
        flare={flare}
      />
    </div>
  );
};

// ─── Depth Filmstrip Field (defocused strips receding into depth) ────────────

/**
 * Straight strips of film flying past the camera at different depths — the
 * near one sharp, the ones behind it progressively defocused, with soft
 * bokeh highlights and a backlight bloom behind the whole field. A cinematic
 * depth-of-field composition rather than a single readable object.
 *
 * Deliberately NOT a spiral: the flat snail-shell coil belongs to
 * DocreelTitleCard and the vertical corkscrew to DocreelEssayCaptions, so
 * this uses straight diagonal bands to stay visually distinct from both.
 *
 * Blur is applied once per depth LAYER (a single feGaussianBlur on a wrapping
 * <g>) rather than per strip, so the browser rasterises three blurs instead
 * of one per band — this is the expensive part of the scene, and grouping is
 * what keeps it affordable.
 *
 * Strictly palette-only: depth reads through blur, scale and alpha, never a
 * warm/amber tint, per the template's 3-color rule.
 */
export const DepthFilmstripField: React.FC<{
  seed: number;
  opacity: number;
  /** Strips per depth layer — total drawn is roughly 3x this. */
  strips?: number;
  /** Drift rate across the frame, in px/frame at the near plane. */
  speed?: number;
  /** Number of defocused light orbs scattered through the far/mid planes. */
  bokeh?: number;
  /** Vertical bias of the field, 0-1 — 0.4 keeps weight in the upper frame. */
  centerY?: number;
}> = ({ seed, opacity, strips = 3, speed = 0.35, bokeh = 7, centerY = 0.4 }) => {
  const theme = useDocReelTheme();
  const { width, height } = useVideoConfig();
  const frame = useDocReelFrame();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  // Far → near. Each plane gets its own blur, scale, speed multiplier and
  // alpha, which together are what sell the depth.
  const planes = [
    { key: "far", blur: 6, bandScale: 0.055, alpha: 0.4, speedMul: 0.45, tilt: -18 },
    { key: "mid", blur: 3, bandScale: 0.085, alpha: 0.7, speedMul: 0.75, tilt: -25 },
    // Softly defocused rather than razor-sharp — even the nearest plane sits
    // slightly off the focal plane, so the whole field reads as background
    // atmosphere behind the talking head instead of competing with it.
    { key: "near", blur: 1.6, bandScale: 0.135, alpha: 1, speedMul: 1.15, tilt: -31 },
  ];

  const RAIL_FRAC = 0.26;

  /** One straight strip: dark perforated rails flanking a lighter image
   *  area, matching the cross-section HelicalFilmstrip established. Drawn
   *  horizontally about the origin, then rotated/translated into place. */
  const strip = (
    planeKey: string,
    idx: number,
    bandH: number,
    alpha: number,
    tilt: number,
    drift: number,
    /** 0..1 position of this strip's lane down the frame. */
    lane: number,
  ) => {
    const r = (n: number) => docReelRand(seed + idx * 31.7, n);
    // Deterministically spread lanes over the FULL frame height rather than
    // clustering randomly: `lane` walks 0..1 across every strip in the field
    // so the top, middle and bottom thirds each get covered, with a small
    // random nudge so the result doesn't look mechanically striped.
    const laneY = height * (0.08 + lane * 0.84 + (r(1) - 0.5) * 0.12);
    // Long enough to cross the whole frame and still overhang both edges
    // after the tilt shortens its horizontal reach — a strip that stops
    // inside the frame reads as a floating object rather than film running
    // through the shot. cos(tilt) recovers the width the rotation eats.
    const tiltRad = (Math.abs(tilt) * Math.PI) / 180;
    const reach = width / Math.max(0.35, Math.cos(tiltRad));
    const len = reach * (1.5 + r(2) * 0.5);
    // Wrap seamlessly: the strip travels one full span then repeats, so it
    // never visibly enters or leaves. Span tracks length so the loop point
    // stays off-screen no matter how long the strip is.
    const span = len + width;
    // Centered on the frame, so a strip sits ACROSS the scene rather than
    // hanging off one edge; drift then slides it along its own axis.
    const x0 = width * 0.5 - len * 0.5 + (((drift + r(3) * span) % span) - span * 0.5) * 0.35;
    const half = bandH / 2;
    const rail = half * (1 - RAIL_FRAC * 2);
    const holeW = bandH * 0.15;
    const holeH = bandH * 0.095;
    const frames = Math.max(3, Math.round(len / (bandH * 1.3)));
    const holes = Math.max(4, Math.round(len / (bandH * 0.4)));

    return (
      <g
        key={`${planeKey}-${idx}`}
        // Rotate about the strip's MIDPOINT, not its left end: pivoting at
        // the end swings a long tilted strip's far side hundreds of px off
        // frame, which is what previously stranded them all in one corner.
        transform={`translate(${x0} ${laneY}) rotate(${tilt} ${len / 2} 0)`}
        // Plane depth-alpha AND the field's overall opacity both apply here,
        // at the group level — the fills below stay near-opaque so the strip
        // keeps its internal contrast (dark stock, bright holes) at every
        // dim level, instead of the whole thing washing out uniformly.
        opacity={alpha * opacity}
      >
        {/* The strip body: near-opaque dark stock. It reads because it's a
            SILHOUETTE against the bright bloom behind it — the same way film
            held up to a light source reads. Painting it faintly, or in bg
            against a bg-colored scene, makes it vanish entirely. */}
        <rect x={0} y={-half} width={len} height={bandH} fill={hexToRgba(theme.bg, 0.97)} />
        {/* Exposed frames — slightly lifted off the stock so the image area
            is distinguishable from the rails without going bright. */}
        <rect x={0} y={-rail} width={len} height={rail * 2} fill={hexToRgba(theme.text, 0.16)} />
        {/* Frame dividers across the image area only */}
        {Array.from({ length: frames }, (_, f) => (
          <rect
            key={f}
            x={(f * len) / frames}
            y={-rail}
            width={Math.max(2, bandH * 0.028)}
            height={rail * 2}
            fill={hexToRgba(theme.bg, 0.95)}
          />
        ))}
        {/* Sprocket holes are PUNCHED THROUGH the stock — they're bright
            because the backlight shines through them. This is the single
            most recognisable feature of film, so they get full accent, not
            a faded tint. */}
        {Array.from({ length: holes }, (_, h) => {
          const hx = (h * len) / holes + bandH * 0.12;
          return (
            <React.Fragment key={h}>
              <rect
                x={hx}
                y={-half + (half - rail) * 0.5 - holeH / 2}
                width={holeW}
                height={holeH}
                rx={holeH * 0.28}
                fill={hexToRgba(theme.accent, 0.92)}
              />
              <rect
                x={hx}
                y={half - (half - rail) * 0.5 - holeH / 2}
                width={holeW}
                height={holeH}
                rx={holeH * 0.28}
                fill={hexToRgba(theme.accent, 0.92)}
              />
            </React.Fragment>
          );
        })}
        {/* Lit long edges — light catching the edge of the stock. */}
        <rect x={0} y={-half} width={len} height={Math.max(1.5, bandH * 0.025)} fill={hexToRgba(theme.accent, 0.55)} />
        <rect x={0} y={half - Math.max(1.5, bandH * 0.025)} width={len} height={Math.max(1.5, bandH * 0.025)} fill={hexToRgba(theme.accent, 0.55)} />
      </g>
    );
  };

  return (
    <svg
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}
    >
      <defs>
        {planes.map((pl) =>
          pl.blur > 0 ? (
            <filter key={pl.key} id={`dff-${uid}-${pl.key}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={pl.blur} />
            </filter>
          ) : null,
        )}
        <radialGradient id={`dff-orb-${uid}`}>
          <stop offset="0%" stopColor={theme.accent} stopOpacity={0.55} />
          <stop offset="55%" stopColor={theme.accent} stopOpacity={0.22} />
          <stop offset="100%" stopColor={theme.accent} stopOpacity={0} />
        </radialGradient>
        {/* Backlight falloff — brightest at its core, gone by the edges, so
            the bloom reads as a light source rather than a flat grey wash. */}
        <radialGradient id={`dff-bloom-${uid}`}>
          <stop offset="0%" stopColor={theme.accent} stopOpacity={0.42} />
          <stop offset="45%" stopColor={theme.accent} stopOpacity={0.2} />
          <stop offset="100%" stopColor={theme.accent} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Backlight bloom behind everything — warm-WHITE (palette accent), not
          an amber tint, matching the light-table glow in DocreelContactSheet.
          This is what the strips are silhouetted AGAINST: without real light
          here, dark stock on a dark scene is invisible. Deliberately not
          scaled down by `opacity` as hard as the strips are, since dimming
          the light source defeats the whole silhouette effect. */}
      <ellipse
        cx={width * 0.44}
        cy={height * centerY}
        rx={width * 0.66}
        ry={height * 0.54}
        fill={`url(#dff-bloom-${uid})`}
        opacity={Math.min(1, opacity * 2.6)}
      />

      {/* Defocused highlights, drifting slowly upward through the field. */}
      <g filter={`url(#dff-${uid}-far)`}>
        {Array.from({ length: bokeh }, (_, i) => {
          const r = (n: number) => docReelRand(seed + i * 17.3, n);
          const orbR = Math.min(width, height) * (0.025 + r(1) * 0.055);
          const bx = width * r(2);
          // Slow upward drift, wrapping so orbs never pop out of existence.
          const by = ((height * r(3) - frame * 0.22) % (height * 1.2) + height * 1.2) % (height * 1.2);
          return (
            <circle
              key={i}
              cx={bx}
              cy={by}
              r={orbR}
              fill={`url(#dff-orb-${uid})`}
              opacity={(0.35 + r(4) * 0.4) * opacity}
            />
          );
        })}
      </g>

      {/* Depth planes, far to near. Lanes are assigned across ALL planes
          interleaved (plane 0 takes lanes 0,3,6…, plane 1 takes 1,4,7… and
          so on) so the three depths tile the full frame height together
          instead of each plane stacking in the same band. */}
      {planes.map((pl, pi) => {
        const drift = frame * speed * pl.speedMul;
        const bandH = Math.min(width, height) * pl.bandScale;
        const totalLanes = strips * planes.length;
        const content = Array.from({ length: strips }, (_, i) => {
          const laneIndex = i * planes.length + pi;
          const lane = totalLanes <= 1 ? 0.5 : laneIndex / (totalLanes - 1);
          return strip(
            pl.key,
            pi * 10 + i,
            bandH,
            pl.alpha,
            pl.tilt + (docReelRand(seed + i, pi) - 0.5) * 10,
            drift,
            lane,
          );
        });
        return pl.blur > 0 ? (
          <g key={pl.key} filter={`url(#dff-${uid}-${pl.key})`}>
            {content}
          </g>
        ) : (
          <g key={pl.key}>{content}</g>
        );
      })}
    </svg>
  );
};

/** Full-frame wrapper for DepthFilmstripField — same role/API shape as
 *  DriftingFilmstripBackdrop and HelicalFilmstripBackdrop so a layout mounts
 *  any of the three identically. */
export const DepthFilmstripBackdrop: React.FC<{
  seed: number;
  dim?: number;
  strips?: number;
  speed?: number;
  bokeh?: number;
  centerY?: number;
}> = ({ seed, dim = 1, strips, speed, bokeh, centerY }) => {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <DepthFilmstripField
        seed={seed}
        // Higher base than the coil backdrops' 0.32: those are line-art over
        // a visible scene, whereas these strips are silhouettes that only
        // read if both they and their backlight are genuinely present.
        opacity={Math.min(1, 0.62 * dim)}
        strips={strips}
        speed={speed}
        bokeh={bokeh}
        centerY={centerY}
      />
    </div>
  );
};

// ─── Reel-Change Cue ──────────────────────────────────────────────────────────

/**
 * Archive effect: the projectionist's reel-change mark — a brief top-right
 * "cue dot" flash (the classic dot that flags an approaching reel changeover
 * in a projected print), paired with a fast ProjectorReel wobble + a single
 * frame-white flash. Meant to be dropped near a scene's tail so it reads as
 * the moment the projector clatters onto reel two.
 */
export const ReelChangeCue: React.FC<{ triggerFrame: number }> = ({ triggerFrame }) => {
  const theme = useDocReelTheme();
  const frame = useDocReelFrame();
  const { width, height } = useVideoConfig();
  const t = frame - triggerFrame;
  if (t < -6 || t > 26) return null;

  const dotOpacity = interpolate(t, [-6, -2, 0, 4], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const flash = interpolate(t, [0, 2, 6], [0, 0.55, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wobble = Math.sin(Math.max(0, t) * 1.4) * interpolate(t, [0, 8, 20], [1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      {/* Cue dot, top-right corner — the projectionist's changeover mark */}
      <div
        style={{
          position: "absolute",
          top: 30,
          right: 30,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: theme.accent,
          opacity: dotOpacity,
          pointerEvents: "none",
        }}
      />
      {/* Single-frame white flash across the whole frame */}
      <div style={{ position: "absolute", inset: 0, background: theme.accent, opacity: flash, pointerEvents: "none", mixBlendMode: "screen" }} />
      {/* Fast reel wobble, corner-anchored */}
      {t >= 0 && (
        <div style={{ position: "absolute", bottom: 20, right: 20, transform: `rotate(${wobble * 6}deg)`, pointerEvents: "none" }}>
          <ProjectorReel size={70} opacity={0.5} spinSpeed={4} beam={false} />
        </div>
      )}
    </>
  );
};

// ─── Textures (max 2 per template): Aged Paper + Dust & Scratches ────────────
// The other 4 (Halation Vignette, Low-Res Scanline, Light Leak) exist as
// effect-driven overlays above, not base textures, so the "max 2" rule holds
// at the template level.

export const AgedPaperTexture: React.FC<{ opacity?: number }> = ({ opacity = 0.5 }) => {
  const theme = useDocReelTheme();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity, pointerEvents: "none", mixBlendMode: "multiply" }}>
      <defs>
        <filter id={`paper-${uid}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves={3} seed={22} result="n" />
          <feColorMatrix
            in="n"
            type="matrix"
            values={`0 0 0 0 ${theme.paperTone[0]}  0 0 0 0 ${theme.paperTone[1]}  0 0 0 0 ${theme.paperTone[2]}  0 0 0 0.6 0`}
          />
        </filter>
      </defs>
      <rect width="100%" height="100%" filter={`url(#paper-${uid})`} />
    </svg>
  );
};

// ─── Era label helper ─────────────────────────────────────────────────────────

export const ERA_LABEL: Record<DocReelEra, string> = {
  newsreel: "NEWSREEL",
  home_movie: "HOME MOVIE",
  tape_dub: "TAPE DUB",
};

// ─── ArchiveImageBackdrop — the one place the old-fashioned photo look lives ──

/**
 * Renders whatever image/video the user attached (imageUrl/videoUrl +
 * imageZoom/imageObjectPosition, same props every docreel layout already
 * destructures) with the archive treatment baked in automatically:
 * grayscale + boosted contrast + dropped brightness, plus a slow Ken Burns
 * creep so nothing sits frozen. A layout never needs to hand-roll this — drop
 * <ArchiveImageBackdrop {...props} /> in and any photo the user uploads or any
 * stock clip they attach comes out looking like it belongs on the reel.
 *
 * `dim` lets text-forward scenes (statistic, dossier, reel-out) use a photo as
 * a faint backdrop behind content rather than the hero visual.
 */
export const ArchiveImageBackdrop: React.FC<{
  imageUrl?: string;
  videoUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  videoMuted?: boolean;
  videoVolume?: number;
  videoDurationInFrames?: number;
  videoStartInFrames?: number;
  dur: number;
  /** 0-1 opacity ceiling — use < 1 to keep a photo as a faint backdrop behind text. */
  dim?: number;
  /** Ken Burns creep amount; 0 disables the slow zoom drift. */
  kenBurns?: number;
}> = ({
  imageUrl,
  videoUrl,
  imageObjectPosition,
  imageZoom,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  dur,
  dim = 1,
  kenBurns = 0.12,
}) => {
  const frame = useCurrentFrame();
  if (!imageUrl && !videoUrl) return null;

  const reveal = interpolate(frame, [0, 24], [0, dim], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const creep = kenBurns > 0 ? interpolate(frame, [0, dur], [1, 1 + kenBurns]) : 1;

  // Framing contract, matching DocReelClip and the newspaper template: when the
  // user zooms OUT (< 1) the whole image is inside the box, so nothing is being
  // cropped and a focus point is meaningless — show it contained and centred.
  // When zoomed in, `transformOrigin` must match `objectPosition` or the scale
  // pivots from the box centre and drifts away from the point the user picked.
  //
  // The Ken Burns creep multiplies the user's zoom for the visual drift, but the
  // < 1 decision is made on the user's own value: a 0.9 zoom must stay
  // "contained" for the whole scene rather than flipping to "cover" partway
  // through as the creep pushes the product past 1.
  const userZoom = Math.max(0.1, imageZoom ?? 1);
  const isZoomedOut = userZoom < 1;
  const pos = imageObjectPosition ?? "50% 50%";

  // Everything EXCEPT the framing properties. DocReelClip merges `style` last,
  // so anything framing-related here would override the identical logic it
  // already applies internally — the two must not both try to own it.
  const treatment: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    filter: "grayscale(1) contrast(1.15) brightness(.82)",
    opacity: reveal,
  };

  return videoUrl ? (
    <DocReelClip
      src={videoUrl}
      imageObjectPosition={imageObjectPosition}
      imageZoom={userZoom * creep}
      zoomedOut={isZoomedOut}
      muted={videoMuted ?? true}
      volume={videoVolume ?? 0.35}
      durationInFrames={videoDurationInFrames}
      startInFrames={videoStartInFrames}
      style={treatment}
    />
  ) : (
    <Img
      src={imageUrl!}
      style={{
        ...treatment,
        objectFit: isZoomedOut ? "contain" : "cover",
        objectPosition: isZoomedOut ? "center" : pos,
        transform: `scale(${userZoom * creep})`,
        transformOrigin: isZoomedOut ? "center center" : pos,
      }}
    />
  );
};

// ─── DocReelScene — shared scene wrapper ─────────────────────────────────────

export const DocReelScene: React.FC<{
  bgColor?: string;
  dur: number;
  era?: DocReelEra;
  /** paints Aged Paper / Dust & Scratches (capped to 2 total, chosen per layout) */
  textures?: Array<"aged_paper" | "dust_scratches">;
  sprockets?: boolean;
  vignette?: boolean;
  chrome?: React.ReactNode;
  children: React.ReactNode;
}> = ({
  bgColor,
  dur,
  era = DEFAULT_DOCREEL_ERA,
  textures = ["dust_scratches"],
  sprockets = false,
  vignette = true,
  chrome,
  children,
}) => {
  const theme = useDocReelTheme();
  const masterOpacity = useSceneFade(dur);
  const weave = useFilmWeave(era);
  const bg = bgColor || theme.bg;

  return (
    <AbsoluteFill style={{ opacity: masterOpacity, backgroundColor: bg }}>
      <AbsoluteFill
        style={{
          transform: `translate(${weave.x}px, ${weave.y}px) rotate(${weave.rotate}deg)`,
        }}
      >
        {chrome}
        {children}
        {textures.includes("aged_paper") && <AgedPaperTexture opacity={0.35} />}
        {textures.includes("dust_scratches") && <DustAndScratches opacity={0.45} />}
        <EmulsionGrain opacity={0.14} />
        {era === "tape_dub" && <LowResScanline opacity={0.1} />}
        {vignette && <HalationVignette intensity={era === "home_movie" ? 1.2 : 0.8} />}
      </AbsoluteFill>
      <TrackingRoll era={era} />
      {sprockets && <SprocketLetterboxing />}
    </AbsoluteFill>
  );
};
