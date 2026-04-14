import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { blackswanNeonPalette, rgbaFromHex } from "./blackswanAccent";

export { NeonWater } from "./neonWater";
export { BlackswanFlock, BlackswanBirdOnPath, BlackswanArcBirdPass } from "./birds";
export { blackswanNeonPalette, rgbaFromHex, parseHex, mixRgb, toHex } from "./blackswanAccent";

export const mono = "'IBM Plex Mono', monospace";
export const display = "'Syne', sans-serif";

/** Legacy rgba fill helper (e.g. one-off labels). Titles use hollow `neonTitleTubeStyle` instead. */
export const NEON_TITLE_FILL_OPACITY = 0.2;

/** #rgb / #rrggbb → rgba(..., alpha). Other values returned unchanged. */
export function neonTitleFillColor(hexColor: string, alpha = NEON_TITLE_FILL_OPACITY): string {
  const raw = hexColor.trim().replace(/^#/, "");
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (raw.length === 6) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return hexColor;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return hexColor;
}

/** Multi-layer bloom: tight layers read as inner rim + stronger outward halo. */
export function neonTitleTextShadow(accentColor: string): string {
  const a = accentColor;
  return [
    `0 0 1px ${a}`,
    `0 0 2px ${a}`,
    `0 0 3px ${a}FA`,
    `0 0 5px ${a}EE`,
    `0 0 9px ${a}`,
    `0 0 14px ${a}F2`,
    `0 0 22px ${a}DD`,
    `0 0 34px ${a}BB`,
    `0 0 50px ${a}99`,
    `0 0 70px ${a}77`,
    `0 0 96px ${a}55`,
  ].join(", ");
}

export type NeonTitleTubeStyle = Pick<
  React.CSSProperties,
  "color" | "WebkitTextFillColor" | "WebkitTextStroke" | "paintOrder" | "textShadow" | "letterSpacing"
>;

/** True neon-tube look: fill matches the scene background so the letter interior looks empty,
 *  but with controlled transparency so the stroke glow bleeds inward (inner tube). Lower alpha
 *  = a bit more inward glow vs letter body. Pass bgColor to match a non-black background. */
export function neonTitleTubeStyle(accentColor: string, opts?: { bgColor?: string }): NeonTitleTubeStyle {
  const bg = opts?.bgColor ?? "#000000";
  // More transparent than before so the thick stroke’s light reads slightly farther inward
  const fill = neonTitleFillColor(bg, 0.64);
  return {
    color: bg,
    WebkitTextFillColor: fill,
    WebkitTextStroke: `5.5px ${accentColor}`,
    paintOrder: "stroke fill",
    textShadow: neonTitleTextShadow(accentColor),
    letterSpacing: "0.12em",
  };
}

export const Eyebrow: React.FC<{ text: string; fontFamily?: string; accentColor?: string }> = ({
  text,
  fontFamily,
  accentColor = "#00E5FF",
}) => {
  const pal = useMemo(() => blackswanNeonPalette(accentColor), [accentColor]);
  return (
    <div
      style={{
        fontSize: 9,
        letterSpacing: 5,
        color: pal.mid,
        textTransform: "uppercase" as const,
        fontFamily: fontFamily ?? mono,
        opacity: 0.9,
      }}
    >
      {text}
    </div>
  );
};

export const StarField: React.FC<{ accentColor?: string }> = ({ accentColor = "#00E5FF" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const pal = useMemo(() => blackswanNeonPalette(accentColor), [accentColor]);

  const REGULAR_COUNT = 200;
  const BRIGHT_COUNT  = 52;

  return (
    <svg
      viewBox="0 0 1780 1000"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        {/* Soft corona — used on all regular stars */}
        <filter id="sf-corona" x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Bigger bloom — for bright accent stars */}
        <filter id="sf-bloom" x="-400%" y="-400%" width="900%" height="900%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Large halo — for biggest accent stars */}
        <filter id="sf-halo" x="-600%" y="-600%" width="1300%" height="1300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Regular twinkle stars — uniform full-screen scatter ── */}
      {Array.from({ length: REGULAR_COUNT }).map((_, i) => {
        // Halton-like low-discrepancy sequence: coprime multipliers ensure
        // even coverage across the full 1000×1000 canvas with no clustering.
        // x uses base ~990/2.618 ≈ 378, y uses base ~990/1.618 ≈ 612
        const x = Math.round(8  + (i * 673 + 53)  % 1764);
        const y = Math.round(8  + (i * 612 + 137) % 984);
        const dur   = 1.6 + (i % 9) * 0.38;
        const phase = (2 * Math.PI * (t + i * 0.19)) / dur;
        const tw    = 0.5 - 0.5 * Math.cos(phase);
        const r       = i % 11 === 0 ? 2.2 : i % 4 === 0 ? 1.4 : 0.85;
        const peakOp  = i % 11 === 0 ? 0.95 : i % 4 === 0 ? 0.85 : 0.70;
        const opacity = peakOp * tw;
        const color   = i % 6 === 0 ? pal.core : i % 3 === 0 ? pal.bright : pal.mid;
        return (
          <circle
            key={`r-${i}`}
            cx={x} cy={y} r={r}
            fill={color}
            opacity={opacity}
            filter="url(#sf-corona)"
          />
        );
      })}

      {/* ── Bright accent stars — uniform scatter, stronger glow ── */}
      {Array.from({ length: BRIGHT_COUNT }).map((_, i) => {
        // Different coprime offsets so bright stars don't overlap regular ones
        const x = Math.round(12 + (i * 971 + 211) % 1756);
        const y = Math.round(12 + (i * 379 + 307) % 976);
        const dur   = 2.4 + (i % 5) * 0.55;
        const phase = (2 * Math.PI * (t + i * 0.27 + 1.1)) / dur;
        const raw   = 0.5 - 0.5 * Math.cos(phase);
        const tw    = raw * raw;
        const r     = i % 7 === 0 ? 3.0 : i % 3 === 0 ? 2.2 : 1.6;
        const peak  = i % 7 === 0 ? 1.0 : 0.92;
        const opacity = 0.08 + peak * tw;
        const filter  = i % 7 === 0 ? "url(#sf-halo)" : "url(#sf-bloom)";
        return (
          <circle
            key={`b-${i}`}
            cx={x} cy={y} r={r}
            fill={pal.core}
            opacity={opacity}
            filter={filter}
          />
        );
      })}
    </svg>
  );
};

/**
 * NeonPanel — frosted border panel matching HTML: border:1px solid #00E5FF14 or 18
 */
export const NeonPanel: React.FC<{ children: React.ReactNode; width?: string; accentColor?: string }> = ({
  children,
  width = "100%",
  accentColor = "#00E5FF",
}) => (
  <div
    style={{
      width,
      border: `1px solid ${rgbaFromHex(accentColor, 0.08)}`,
      background: "transparent",
      padding: "12px 14px",
    }}
  >
    {children}
  </div>
);

/* ── Derivation helpers (unchanged contract) ─────────────────────────────── */

export const deriveItems = (narration: string, count = 4): string[] => {
  const parts = narration
    .split(/[.;•\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return [];
  return parts.slice(0, count).map((s) => s.replace(/\s+/g, " "));
};

export const derivePhrases = (narration: string, count = 4): string[] => {
  const fromComma = narration
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
  if (fromComma.length >= 2) return fromComma.slice(0, count);
  return deriveItems(narration, count);
};

export const deriveMetrics = (
  narration: string,
): Array<{ value: string; label: string; suffix?: string }> => {
  const matches = narration.match(/(\d+(?:\.\d+)?)(%|x|k|m|K|M|\+)?/g) ?? [];
  if (matches.length === 0) return [];
  return matches.slice(0, 3).map((m, i) => {
    const raw = m.trim();
    const value = raw.replace(/[%xkKmM+]/g, "");
    const suffix = raw.slice(value.length) || undefined;
    return { value, suffix, label: `Metric ${i + 1}` };
  });
};

export const deriveRows = (
  narration: string,
): Array<{ label: string; value: string }> => {
  const metrics = deriveMetrics(narration);
  if (metrics.length > 0) {
    return metrics.map((m) => ({ label: m.label, value: m.value }));
  }
  return [
    { label: "A", value: "20" },
    { label: "B", value: "35" },
    { label: "C", value: "28" },
  ];
};