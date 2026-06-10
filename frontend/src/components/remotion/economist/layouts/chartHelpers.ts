/**
 * Economist chart helpers — custom-SVG charting primitives, ported from the
 * proven Bloomberg `TerminalDataViz` helpers and extended for the Economist
 * references (right-side axis with nice ticks that span negatives/zero, grey
 * context series, direct colour-coded end-labels, fractional line draw-on).
 */
import type { EconomistChartTable } from "../types";

const STRICT_NUM_RE =
  /^\s*\(?\s*[+\-]?\$?\s*\d[\d,]*(?:\.\d+)?\s*(?:%|[a-z]{1,12})?\s*\)?\s*$/i;

/** Parse a table cell into a number, tolerating $, %, commas, parens=negative. */
export function toNum(v: string | number | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const raw = (v ?? "").toString().trim();
  if (!raw) return null;
  if (STRICT_NUM_RE.test(raw)) {
    const neg = raw.startsWith("(") && raw.endsWith(")");
    const n = Number(raw.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? (neg ? -Math.abs(n) : n) : null;
  }
  const compact = raw.replace(/[~≈]/g, "").replace(/\+/g, "").replace(/,/g, "").trim();
  const tok = compact.match(/-?\d*\.?\d+/)?.[0];
  if (!tok) return null;
  const n = Number(tok);
  if (!Number.isFinite(n)) return null;
  return raw.startsWith("(") && raw.endsWith(")") ? -Math.abs(n) : n;
}

/** Compact axis-tick formatting (1.2K, 3.4M). Integers stay plain. */
export function fmtTick(v: number): string {
  if (!Number.isFinite(v)) return "";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${trimZero(v / 1_000_000)}M`;
  if (a >= 1_000) return `${trimZero(v / 1_000)}K`;
  return Number.isInteger(v) ? String(v) : trimZero(v);
}

/** Compact value formatting for bar tips / table values. */
export function fmtCompact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000_000) return `${trimZero(v / 1_000_000_000)}B`;
  if (a >= 1_000_000) return `${trimZero(v / 1_000_000)}M`;
  if (a >= 1_000) return `${trimZero(v / 1_000)}K`;
  return trimZero(v);
}

function trimZero(v: number): string {
  const s = v.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** Format a value with its unit, placing currency symbols before the number. */
export function fmtValue(v: number, unit = ""): string {
  const u = unit.trim();
  const base = fmtCompact(v);
  if (u && /^[$£€¥]/.test(u)) return `${u[0]}${base}${u.slice(1)}`;
  return `${base}${u}`;
}

/** Ordinal suffix for a day-of-month (1ST, 2ND, 3RD, 23RD…). */
function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}TH`;
  switch (n % 10) {
    case 1:
      return `${n}ST`;
    case 2:
      return `${n}ND`;
    case 3:
      return `${n}RD`;
    default:
      return `${n}TH`;
  }
}

/**
 * Build a live Economist-style dateline for the week containing `date`
 * (Monday→Sunday), e.g. "MAY 23RD–29TH 2026". When the week straddles two
 * months the month is repeated ("MAY 30TH–JUN 5TH 2026"). Used as the default
 * dateline so section dividers / covers always show the current week.
 */
export function formatEconomistWeek(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // Monday as the start of the week (getDay: 0=Sun..6=Sat).
  const dow = (d.getDay() + 6) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - dow);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);

  const MONTHS = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];
  const m1 = MONTHS[mon.getMonth()];
  const m2 = MONTHS[sun.getMonth()];
  const start = `${m1} ${ordinal(mon.getDate())}`;
  const end =
    mon.getMonth() === sun.getMonth()
      ? ordinal(sun.getDate())
      : `${m2} ${ordinal(sun.getDate())}`;
  return `${start}–${end} ${sun.getFullYear()}`;
}

export function easeInOutCubic(t: number): number {
  const p = Math.max(0, Math.min(1, t));
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * A reusable editorial text-entrance: fade in + rise with a gentle ease-out-back
 * overshoot, so headings/labels "settle" into place rather than just fading.
 * Pure function of `frame` (no Remotion import) so it stays identical across the
 * render + preview trees. `delay` staggers it; `rise` is the start offset in px.
 */
export function textRise(
  frame: number,
  delay = 0,
  rise = 22,
  dur = 20,
): { opacity: number; transform: string } {
  const t = clamp((frame - delay) / dur, 0, 1);
  const opacity = t;
  // easeOutBack — slight overshoot past the target then settle.
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const eased = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  const y = (1 - eased) * rise;
  return { opacity, transform: `translateY(${y.toFixed(2)}px)` };
}

export interface ParsedSeries {
  label: string;
  /** Values aligned to `labels`; missing cells are NaN (gaps in the line). */
  values: number[];
}

export interface ParsedChart {
  labels: string[];
  series: ParsedSeries[];
}

/**
 * Parse a chartTable into x-labels (first column) + numeric series (remaining
 * columns). Auto-detects a header row when headers are absent/synthetic.
 * Unlike the Bloomberg port this keeps ALL series (Economist charts highlight
 * a few and grey the rest) and keeps NaN gaps so partial rows still plot.
 */
export function parseChartTable(tbl: EconomistChartTable | undefined): ParsedChart {
  const empty: ParsedChart = { labels: [], series: [] };
  if (!tbl) return empty;

  let rows = (tbl.rows ?? []).filter((r) => Array.isArray(r) && r.length >= 2);
  let headers = (tbl.headers ?? []).map((h) => String(h ?? "").trim());
  if (rows.length < 1) return empty;

  const synth = headers.length > 0 && headers.every((h) => /^col_\d+$/i.test(h));
  if ((headers.length === 0 || synth) && rows.length > 0) {
    const candidate = (rows[0] ?? []).map((c) => String(c ?? "").trim());
    const nonEmpty = candidate.filter(Boolean);
    const numericCount = nonEmpty.filter((c) => toNum(c) !== null).length;
    if (nonEmpty.length >= 2 && numericCount <= Math.floor(nonEmpty.length / 3)) {
      headers = candidate;
      rows = rows.slice(1);
    }
  }
  if (rows.length < 1) return empty;

  const colCount = Math.max(...rows.map((r) => r.length));
  const labels: string[] = [];
  const numCols: number[][] = Array.from({ length: colCount - 1 }, () => []);

  for (const row of rows) {
    labels.push(String(row[0] ?? "").trim() || `${labels.length + 1}`);
    for (let c = 1; c < colCount; c++) {
      const n = toNum((row[c] as string | number | undefined) ?? "");
      numCols[c - 1].push(n === null ? NaN : n);
    }
  }

  const series: ParsedSeries[] = numCols
    .map((values, i) => ({ label: headers[i + 1] || `Series ${i + 1}`, values }))
    .filter((s) => s.values.some((v) => Number.isFinite(v)));

  return { labels, series };
}

/** The min/max finite value across a set of series. */
export function extentY(series: ParsedSeries[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const s of series) {
    for (const v of s.values) {
      if (!Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  return { min, max };
}

function niceNum(range: number, round: boolean): number {
  const exp = Math.floor(Math.log10(range || 1));
  const frac = (range || 1) / Math.pow(10, exp);
  let nice: number;
  if (round) {
    if (frac < 1.5) nice = 1;
    else if (frac < 3) nice = 2;
    else if (frac < 7) nice = 5;
    else nice = 10;
  } else {
    if (frac <= 1) nice = 1;
    else if (frac <= 2) nice = 2;
    else if (frac <= 5) nice = 5;
    else nice = 10;
  }
  return nice * Math.pow(10, exp);
}

export interface NiceScale {
  niceMin: number;
  niceMax: number;
  ticks: number[];
  step: number;
}

/**
 * "Nice" axis bounds + ticks (1/2/5 × 10ⁿ), spanning negatives and zero. When
 * `includeZero` the domain is extended to include 0 so the emphasised zero line
 * sits on a real gridline (as in the reference emotion chart).
 */
export function niceTicks(
  rawMin: number,
  rawMax: number,
  maxTicks = 6,
  includeZero = true,
): NiceScale {
  let min = rawMin;
  let max = rawMax;
  if (includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (min === max) {
    max = min + 1;
  }
  const range = niceNum(max - min, false);
  const step = niceNum(range / Math.max(1, maxTicks - 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = niceMin; t <= niceMax + step * 0.5; t += step) {
    // Guard against floating-point drift producing -0 or 1e-15.
    ticks.push(Math.abs(t) < step * 1e-6 ? 0 : Number(t.toFixed(6)));
  }
  return { niceMin, niceMax, ticks, step };
}

/** A linear scale mapping a domain to a pixel range. */
export function scaleLinear(
  d0: number,
  d1: number,
  r0: number,
  r1: number,
): (v: number) => number {
  const dd = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / dd) * (r1 - r0);
}

export interface Pt {
  x: number;
  y: number;
  /** True when the underlying value was missing (skip drawing through it). */
  gap?: boolean;
}

/**
 * Build an SVG path for a polyline revealed left→right by `reveal` (0..1).
 * Future points beyond the reveal frontier are dropped, and the final partial
 * segment is interpolated so the line head moves smoothly. Gaps (NaN values)
 * break the path into separate sub-paths.
 */
export function buildLinePath(points: Pt[], reveal: number): string {
  const pts = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (pts.length === 0) return "";
  const n = pts.length;
  const frontier = clamp(reveal, 0, 1) * (n - 1); // fractional index
  let d = "";
  let penDown = false;

  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (i <= frontier) {
      if (p.gap) {
        penDown = false;
        continue;
      }
      d += `${penDown ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)} `;
      penDown = true;
    } else {
      // First point beyond the frontier: draw a partial segment to the head.
      const prev = pts[i - 1];
      if (prev && !prev.gap && !p.gap && penDown) {
        const frac = frontier - (i - 1);
        const hx = prev.x + (p.x - prev.x) * frac;
        const hy = prev.y + (p.y - prev.y) * frac;
        d += `L${hx.toFixed(2)},${hy.toFixed(2)} `;
      }
      break;
    }
  }
  return d.trim();
}

/**
 * Closed area path under a polyline at the same reveal frontier as
 * `buildLinePath` — a fill sweep that advances with the line draw. Gaps break
 * the area into separate closed regions, each dropped to `baselineY`.
 */
export function buildAreaPath(points: Pt[], reveal: number, baselineY: number): string {
  const pts = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (pts.length === 0) return "";
  const n = pts.length;
  const frontier = clamp(reveal, 0, 1) * (n - 1);
  let d = "";
  let runStartX: number | null = null;
  let lastX = 0;

  const closeRun = () => {
    if (runStartX !== null) {
      d += `L${lastX.toFixed(2)},${baselineY.toFixed(2)} L${runStartX.toFixed(2)},${baselineY.toFixed(2)} Z `;
      runStartX = null;
    }
  };

  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (i <= frontier) {
      if (p.gap) {
        closeRun();
        continue;
      }
      if (runStartX === null) {
        runStartX = p.x;
        d += `M${p.x.toFixed(2)},${p.y.toFixed(2)} `;
      } else {
        d += `L${p.x.toFixed(2)},${p.y.toFixed(2)} `;
      }
      lastX = p.x;
    } else {
      const prev = pts[i - 1];
      if (prev && !prev.gap && !p.gap && runStartX !== null) {
        const frac = frontier - (i - 1);
        const hx = prev.x + (p.x - prev.x) * frac;
        const hy = prev.y + (p.y - prev.y) * frac;
        d += `L${hx.toFixed(2)},${hy.toFixed(2)} `;
        lastX = hx;
      }
      break;
    }
  }
  closeRun();
  return d.trim();
}

/** The point on a polyline at reveal fraction (for a moving head dot). */
export function pointAtReveal(points: Pt[], reveal: number): Pt | null {
  const pts = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (pts.length === 0) return null;
  const n = pts.length;
  const frontier = clamp(reveal, 0, 1) * (n - 1);
  const i = Math.floor(frontier);
  if (i >= n - 1) return pts[n - 1];
  const frac = frontier - i;
  const a = pts[i];
  const b = pts[i + 1];
  return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
}
