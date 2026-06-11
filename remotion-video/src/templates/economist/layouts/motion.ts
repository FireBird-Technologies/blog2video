/**
 * Economist motion language — the press-craft animation primitives.
 *
 * Every primitive is a clamped pure function of `frame` (no Remotion, no
 * randomness, no Date) so headless renders match the preview frame-for-frame
 * and the file stays byte-identical across the render + frontend trees.
 *
 * The vocabulary is print/press themed: letterpress stamps, redaction-bar
 * sweeps, rule draws, ink bleeds, press slams — motion a typesetter would
 * recognise, not generic glitz.
 */

export function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

export function easeOutQuint(t: number): number {
  const p = clamp01(t);
  return 1 - Math.pow(1 - p, 5);
}

export function easeOutBack(t: number, s = 1.70158): number {
  const p = clamp01(t);
  const c3 = s + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);
}

/** A 0→1→0 bell over t∈[0,1] — for blur/glow that peaks mid-move. */
export function bellSin(t: number): number {
  return Math.sin(Math.PI * clamp01(t));
}

// ── 1. Letterpress stamp ─────────────────────────────────────────────────────
// An element pressed onto the page: arrives slightly oversized + soft, presses
// just past rest, settles. For kickers, rank numbers, value labels, CTA pills,
// numbered squares.
export function letterpressStamp(
  frame: number,
  delay = 0,
  dur = 14,
  fromScale = 1.16,
): { opacity: number; transform: string; filter: string } {
  const t = clamp01((frame - delay) / dur);
  const opacity = clamp01(t / 0.3);
  // Keyframed scale: fromScale → 0.97 (at 55%) → 1, eased per segment.
  let scale: number;
  if (t < 0.55) {
    scale = fromScale + (0.97 - fromScale) * easeOutQuint(t / 0.55);
  } else {
    scale = 0.97 + 0.03 * easeOutQuint((t - 0.55) / 0.45);
  }
  const blur = 1.5 * (1 - clamp01(t / 0.6));
  return {
    opacity,
    transform: `scale(${scale.toFixed(4)})`,
    filter: blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : "none",
  };
}

// ── 2. Redaction reveal ──────────────────────────────────────────────────────
// An ink/accent bar sweeps left→right; the text appears in its wake — the
// inverse of a censor's redaction. Caller renders the text with `clipPath` and
// an absolutely-positioned bar at `barLeftPct`/`barWidthPct`.
export function redactionReveal(
  frame: number,
  delay = 0,
  dur = 18,
): { clipPath: string; barLeftPct: number; barWidthPct: number; barOpacity: number } {
  const t = clamp01((frame - delay) / dur);
  const swept = easeOutQuint(t) * 100; // % of the container revealed
  const barWidthPct = 12;
  return {
    clipPath: `inset(0 ${(100 - swept).toFixed(2)}% 0 0)`,
    barLeftPct: Math.min(swept, 100 - barWidthPct * 0.2),
    barWidthPct,
    barOpacity: t >= 1 ? 0 : t > 0.85 ? (1 - t) / 0.15 : t <= 0 ? 0 : 1,
  };
}

// ── 3. Rule draw ─────────────────────────────────────────────────────────────
// scaleX draw-on for rules / underlines / accent tabs.
export function ruleDraw(
  frame: number,
  delay = 0,
  dur = 16,
  origin: "left" | "center" | "right" = "left",
): { transform: string; transformOrigin: string } {
  const t = easeOutQuint(clamp01((frame - delay) / dur));
  return {
    transform: `scaleX(${t.toFixed(4)})`,
    transformOrigin: `${origin} center`,
  };
}

// ── 4. Baseline settle ───────────────────────────────────────────────────────
// Headline entrance: rises onto its baseline with a slight overshoot while the
// ink "dries" (blur decays). The stronger sibling of chartHelpers.textRise.
export function baselineSettle(
  frame: number,
  delay = 0,
  rise = 26,
  dur = 18,
): { opacity: number; transform: string; filter: string } {
  const t = clamp01((frame - delay) / dur);
  const opacity = clamp01((frame - delay) / 8);
  const y = (1 - easeOutBack(t)) * rise;
  const blur = 5 * (1 - clamp01(t / 0.7));
  return {
    opacity,
    transform: `translateY(${y.toFixed(2)}px)`,
    filter: blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : "none",
  };
}

// ── 5. Ink bleed ─────────────────────────────────────────────────────────────
// A drop of ink blooming into the paper: grows from small + soft past rest,
// settles crisp. For the giant quote mark and drop caps.
export function inkBleed(
  frame: number,
  delay = 0,
  dur = 22,
): { opacity: number; transform: string; filter: string } {
  const t = clamp01((frame - delay) / dur);
  const opacity = clamp01((frame - delay) / 6);
  // Keyframed scale 0.62 → 1.06 (at 70%) → 1.
  let scale: number;
  if (t < 0.7) {
    scale = 0.62 + (1.06 - 0.62) * easeOutQuint(t / 0.7);
  } else {
    scale = 1.06 - 0.06 * easeOutQuint((t - 0.7) / 0.3);
  }
  const blur = 9 * (1 - clamp01(t / 0.75));
  return {
    opacity,
    transform: `scale(${scale.toFixed(4)})`,
    filter: blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : "none",
  };
}

// ── 6. Press slam ────────────────────────────────────────────────────────────
// A headline slammed down by the press: oversized and loose, compressing to
// rest. Returns raw numbers — the caller maps `spacingT` (1→0) onto its own
// letter-spacing range.
export function pressSlam(
  frame: number,
  delay = 0,
  dur = 20,
): { opacity: number; scale: number; spacingT: number; filter: string } {
  const t = clamp01((frame - delay) / dur);
  const eased = easeOutQuint(t);
  const blur = 4 * (1 - clamp01(t / 0.7));
  return {
    opacity: clamp01((frame - delay) / 6),
    scale: 1.45 - 0.45 * eased,
    spacingT: 1 - eased,
    filter: blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : "none",
  };
}

// ── 7. Slide from edge ───────────────────────────────────────────────────────
// Row/column entrance from a horizontal offset. dist > 0 slides in from the
// right, dist < 0 from the left.
export function slideFrom(
  frame: number,
  delay: number,
  dist: number,
  dur = 16,
): { opacity: number; transform: string } {
  const t = clamp01((frame - delay) / dur);
  const x = (1 - easeOutQuint(t)) * dist;
  return {
    opacity: clamp01(t / 0.5),
    transform: `translateX(${x.toFixed(2)}px)`,
  };
}

// ── 8. Count-up value ────────────────────────────────────────────────────────
// Animate the numeric part of a formatted figure ("$1.9trn", "78%", "1,204")
// from 0 to its target, preserving prefix/suffix and decimal places.
export function countUpValue(
  raw: string | number | undefined,
  frame: number,
  start: number,
  dur = 22,
): string {
  const str = String(raw ?? "").trim();
  if (!str) return "";
  const m = str.match(/-?[\d,]+(?:\.\d+)?/);
  if (!m || m.index === undefined) return str;
  const prefix = str.slice(0, m.index);
  const suffix = str.slice(m.index + m[0].length);
  const target = Number(m[0].replace(/,/g, ""));
  if (!Number.isFinite(target)) return str;
  const decimals = (m[0].split(".")[1] ?? "").length;
  const t = easeOutQuint(clamp01((frame - start) / dur));
  const v = target * t;
  const formatted = v.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${prefix}${formatted}${suffix}`;
}

// ── 9. Panel squeeze ─────────────────────────────────────────────────────────
// Gentle end-of-scene squeeze: 1 → toScale with easeInOutCubic. Used to make
// room for the post-animation takeaway panel without re-laying-out the chart.
export function panelSqueeze(
  frame: number,
  delay: number,
  toScale: number,
  dur = 18,
): number {
  const t = clamp01((frame - delay) / dur);
  const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  return 1 + (toScale - 1) * e;
}

// ── 10. Living-chrome helpers ────────────────────────────────────────────────
/** A slow deterministic orbit for ambient drift (light gradients etc.). */
export function microDrift(
  frame: number,
  periodFrames = 420,
  ampPx = 6,
): { x: number; y: number } {
  const a = (frame / periodFrames) * Math.PI * 2;
  return { x: Math.sin(a) * ampPx, y: Math.cos(a * 0.7) * ampPx * 0.6 };
}

/** A continuous 0..1 sine pulse for dots / folios. */
export function pulse(frame: number, period = 48): number {
  return 0.5 + 0.5 * Math.sin((frame / period) * Math.PI * 2);
}
