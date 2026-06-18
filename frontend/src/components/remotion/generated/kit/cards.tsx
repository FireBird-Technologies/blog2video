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

/** Brand-aware card surface. variant chooses the treatment. */
export function cardStyle(
  palette: KitPalette,
  variant: "panel" | "glass" | "outline" = "panel",
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
