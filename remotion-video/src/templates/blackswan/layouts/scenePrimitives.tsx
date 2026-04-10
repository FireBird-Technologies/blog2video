import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

export { NeonWater } from "./neonWater";
export { BlackswanFlock, BlackswanBirdOnPath } from "./birds";

export const mono = "'IBM Plex Mono', monospace";
export const display = "'Syne', sans-serif";

export const Eyebrow: React.FC<{ text: string; fontFamily?: string }> = ({ text, fontFamily }) => (
  <div
    style={{
      fontSize: 9,
      letterSpacing: 5,
      color: "#00AAFF",
      textTransform: "uppercase" as const,
      fontFamily: fontFamily ?? mono,
      opacity: 0.9,
    }}
  >
    {text}
  </div>
);

export const StarField: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <svg
      viewBox="0 0 1000 1000"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      {Array.from({ length: 28 }).map((_, i) => {
        const x = Math.round(12 + (i * 18.7) % 976);
        const y = Math.round(8 + (i * 29.3) % 490);
        const dur = 2.2 + (i % 5) * 0.5;
        const phase = (2 * Math.PI * (t + i * 0.14)) / dur;
        const tw = 0.5 - 0.5 * Math.cos(phase);
        const opacity = 0.72 * tw;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={0.38 + (i % 3) * 0.28}
            fill="#00AAFF"
            opacity={opacity}
          />
        );
      })}
    </svg>
  );
};

/**
 * NeonPanel — frosted border panel matching HTML: border:1px solid #00E5FF14 or 18
 */
export const NeonPanel: React.FC<{ children: React.ReactNode; width?: string }> = ({
  children,
  width = "100%",
}) => (
  <div
    style={{
      width,
      border: "1px solid #00E5FF14",
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