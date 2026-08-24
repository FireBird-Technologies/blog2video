/**
 * Custom-template craft kit — cards, stats & numbers.
 *
 * OPTIONAL building blocks. Generated scenes use these when the content fits
 * (e.g. a scene whose narration carries metrics) — they are never mandatory.
 *
 * Generalized from chronicle/LedgerStats, bloomberg/TerminalMetric and
 * nightfall/GlowMetric: count-up numerals, highlighted primary stat, uppercase
 * small-caps labels, staggered metric tiles, brand-aware card surfaces.
 */

import React from "react";
import { useCurrentFrame } from "remotion";
import { useKit } from "./context";
import { withAlpha, type KitPalette } from "./theme";
import { countUpString, staggerEntrance } from "./motion";

export interface StatItem {
  value: string;
  label: string;
  suffix?: string;
}

/**
 * Brand-aware card surface. `variant` chooses the treatment — it maps directly
 * to the brand signature's `surfaceStyle` so a fintech (glass), an editorial
 * (flat-hairline) and a luxury brand (embossed) get visibly different panels.
 */
export type SurfaceVariant =
  | "panel"
  | "glass"
  | "outline"
  | "flat-hairline"
  | "embossed"
  | "soft"
  | "flat"
  // P1 additions. `inkwell` in particular replaces something the scene prompt
  // used to describe only in prose — an inverted dark panel — which every scene
  // then hand-rolled slightly differently.
  | "paper" // editorial: warm stock with a faint inner shadow
  | "inkwell" // inverted dark panel for per-scene contrast
  | "tape" // scrapbook/lifestyle: offset shadow, slight rotation
  | "ledger" // finance/data: ruled lines
  | "chip" // compact pill with an accent edge
  | "cutout"; // bold: hard offset shadow, no blur

export function cardStyle(
  palette: KitPalette,
  variant: SurfaceVariant = "panel",
  radius = 18,
): React.CSSProperties {
  if (variant === "glass") {
    return {
      background: withAlpha(palette.isDark ? "#FFFFFF" : "#000000", 0.06),
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      border: `1px solid ${withAlpha(palette.text, 0.12)}`,
      borderRadius: radius,
      boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
    };
  }
  if (variant === "outline") {
    return {
      background: "transparent",
      border: `1.5px solid ${palette.border}`,
      borderRadius: radius,
    };
  }
  if (variant === "flat-hairline" || variant === "flat") {
    // Editorial: no fill, a single hairline edge, sharp corners.
    return {
      background: "transparent",
      border: `1px solid ${withAlpha(palette.text, 0.16)}`,
      borderRadius: variant === "flat" ? 4 : 0,
    };
  }
  if (variant === "embossed") {
    // Luxury: soft raised surface with a top sheen + low shadow.
    return {
      background: palette.panel,
      border: `1px solid ${withAlpha(palette.text, 0.1)}`,
      borderRadius: radius,
      boxShadow: `inset 0 1px 0 ${withAlpha("#FFFFFF", palette.isDark ? 0.08 : 0.5)}, 0 10px 30px rgba(0,0,0,0.18)`,
    };
  }
  if (variant === "soft") {
    // Lifestyle: pillowy rounded surface, gentle shadow, no hard border.
    return {
      background: palette.panel,
      border: "none",
      borderRadius: Math.max(radius, 24),
      boxShadow: "0 12px 34px rgba(0,0,0,0.12)",
    };
  }
  if (variant === "paper") {
    // Editorial: warm off-white stock, squared corners, faint inner shadow so
    // it reads as a physical page rather than a UI card.
    return {
      background: palette.isDark ? palette.panel : withAlpha("#FFFDF7", 0.96),
      border: `1px solid ${withAlpha(palette.text, 0.12)}`,
      borderRadius: 2,
      boxShadow: `inset 0 0 40px ${withAlpha(palette.text, 0.05)}`,
    };
  }
  if (variant === "inkwell") {
    // Inverted panel: the per-scene contrast move the prompt used to describe in
    // prose. Always a SOLID fill, so it stays valid even for brands restricted
    // to solid backgrounds.
    return {
      background: palette.isDark ? withAlpha("#000000", 0.55) : palette.text,
      border: `1px solid ${withAlpha(palette.accent, 0.35)}`,
      borderRadius: radius,
      color: palette.isDark ? palette.text : palette.bg,
    };
  }
  if (variant === "tape") {
    // Scrapbook: hard offset shadow + a fixed micro-rotation (deterministic —
    // never Math.random, which would flicker between frames).
    return {
      background: palette.panel,
      border: `1px solid ${withAlpha(palette.text, 0.1)}`,
      borderRadius: 3,
      boxShadow: `6px 6px 0 ${withAlpha(palette.text, 0.12)}`,
      transform: "rotate(-0.7deg)",
    };
  }
  if (variant === "ledger") {
    // Finance: ruled horizontal lines behind the content.
    return {
      background: `repeating-linear-gradient(${palette.panel}, ${palette.panel} 34px, ${withAlpha(palette.text, 0.07)} 34px, ${withAlpha(palette.text, 0.07)} 35px)`,
      border: `1px solid ${palette.border}`,
      borderRadius: 4,
    };
  }
  if (variant === "chip") {
    // Compact pill with a leading accent edge.
    return {
      background: withAlpha(palette.accent, 0.1),
      border: `1px solid ${withAlpha(palette.accent, 0.4)}`,
      borderLeft: `3px solid ${palette.accent}`,
      borderRadius: 999,
    };
  }
  if (variant === "cutout") {
    // Bold/editorial: knockout with a hard, unblurred offset.
    return {
      background: palette.bg,
      border: `2px solid ${palette.text}`,
      borderRadius: 0,
      boxShadow: `8px 8px 0 ${palette.accent}`,
    };
  }
  return {
    background: palette.panel,
    border: `1px solid ${palette.border}`,
    borderRadius: radius,
  };
}

/** Animated count-up numeral with prefix/suffix/decimals preserved. */
export const CountUpValue: React.FC<{
  value: string;
  start?: number;
  dur?: number;
  color?: string;
  fontSize?: number;
  weight?: number;
  style?: React.CSSProperties;
}> = ({ value, start = 8, dur = 34, color, fontSize, weight = 800, style }) => {
  const frame = useCurrentFrame();
  const { palette, type, fonts } = useKit();
  return (
    <span
      style={{
        fontFamily: fonts.heading,
        fontSize: fontSize ?? type.numeral,
        fontWeight: weight,
        color: color ?? palette.text,
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
        ...style,
      }}
    >
      {countUpString(value, frame, { start, dur })}
    </span>
  );
};

const Label: React.FC<{ text: string; size?: number; color?: string }> = ({
  text,
  size,
  color,
}) => {
  const { palette, type, fonts } = useKit();
  return (
    <div
      style={{
        fontFamily: fonts.body,
        fontSize: size ?? type.label,
        color: color ?? palette.muted,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        lineHeight: 1.25,
      }}
    >
      {text}
    </div>
  );
};

/**
 * Single stat card — big count-up numeral, grow-in underline, small-caps label.
 * `primary` highlights it in the accent color.
 */
export const StatCard: React.FC<{
  item: StatItem;
  index?: number;
  primary?: boolean;
  start?: number;
}> = ({ item, index = 0, primary = false, start = 0 }) => {
  const frame = useCurrentFrame();
  const { palette, type } = useKit();
  const enter = staggerEntrance(frame, index, { start, stagger: 10 });
  const numColor = primary ? palette.accent : palette.text;

  return (
    <div
      style={{
        ...cardStyle(palette, "panel"),
        borderTop: `3px solid ${primary ? palette.accent : palette.border}`,
        padding: "28px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        flex: 1,
        minWidth: 200,
        opacity: enter.opacity,
        transform: enter.transform,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <CountUpValue value={item.value} start={start + index * 10 + 4} color={numColor} />
        {item.suffix && (
          <span
            style={{
              fontSize: type.numeral * 0.42,
              fontWeight: 700,
              color: palette.muted,
            }}
          >
            {item.suffix}
          </span>
        )}
      </div>
      <Label text={item.label} />
    </div>
  );
};

/** Row/grid of stat cards. First item is treated as primary by default. */
export const StatGrid: React.FC<{
  items: StatItem[];
  start?: number;
  highlightFirst?: boolean;
}> = ({ items, start = 0, highlightFirst = true }) => {
  const { isPortrait } = useKit();
  const cells = (items ?? []).slice(0, isPortrait ? 4 : 5);
  if (!cells.length) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: isPortrait ? "column" : "row",
        gap: isPortrait ? 20 : 28,
        alignItems: "stretch",
        justifyContent: "center",
        width: "100%",
      }}
    >
      {cells.map((it, i) => (
        <StatCard key={i} item={it} index={i} primary={highlightFirst && i === 0} start={start} />
      ))}
    </div>
  );
};

/** Compact inline metric row (value + label stacked, no card chrome). */
export const MetricRow: React.FC<{ items: StatItem[]; start?: number }> = ({
  items,
  start = 0,
}) => {
  const frame = useCurrentFrame();
  const { palette, type, fonts } = useKit();
  const cells = (items ?? []).slice(0, 4);
  if (!cells.length) return null;
  return (
    <div style={{ display: "flex", gap: 48, flexWrap: "wrap", justifyContent: "center" }}>
      {cells.map((it, i) => {
        const enter = staggerEntrance(frame, i, { start, stagger: 8 });
        return (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              opacity: enter.opacity,
              transform: enter.transform,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
              <CountUpValue
                value={it.value}
                start={start + i * 8 + 4}
                color={i === 0 ? palette.accent : palette.text}
                fontSize={type.numeral * 0.8}
              />
              {it.suffix && (
                <span style={{ fontSize: type.numeral * 0.34, color: palette.muted, fontWeight: 700 }}>
                  {it.suffix}
                </span>
              )}
            </div>
            <div
              style={{
                fontFamily: fonts.body,
                fontSize: type.label,
                color: palette.muted,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {it.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
