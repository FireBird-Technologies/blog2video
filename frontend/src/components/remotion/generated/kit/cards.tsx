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
import type { StatArrangement } from "./variants";
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

/**
 * Numeral / label size ratios per StatGrid arrangement.
 *
 * These are all relative to `type.numeral` and `type.label`, which derive from
 * `body` and therefore from props.descriptionFontSize — so every stat on the
 * frame follows the editor's body slider. They were 18 separate literals
 * scattered across this file, which made the hierarchy impossible to review or
 * test; the numbers are unchanged, only collected.
 */
const STAT_RATIOS = {
  card: { value: 1, suffix: 0.42 },
  ledger: { value: 0.62, suffix: 0.3 },
  stackedRule: { value: 0.78, suffix: 0.32 },
  heroRail: { value: 1.15, suffix: 0.44, rest: 0.46 },
  quadrant: { value: 0.72, suffix: 0.3 },
  ticker: { value: 0.5, suffix: 0.24, label: 0.9 },
  metricRow: { value: 0.8, suffix: 0.34 },
} as const;

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
  const base = fontSize ?? type.numeral;
  const rendered = countUpString(value, frame, { start, dur });

  // Step the size down for a LONG numeral.
  //
  // `type.numeral` is chosen for a typical 3-4 character stat ("4.8", "150+").
  // A longer one ("$1,284,000" or "3.2M" beside a suffix) rendered at that size
  // overran its cell, and because the value and its suffix sit in one baseline
  // row the glyphs read as a single run with the suffix pushed onto its own
  // line — the reported "3.2M+12" / "%".
  //
  // FitText is the wrong tool here: it fits by WRAPPING, and a numeral is one
  // unbreakable token. This is a deterministic width estimate instead, applied
  // to the count-up's widest frame (`value`, not the current interpolated
  // string) so the size does not jitter as the number animates.
  const longest = Math.max(value.length, rendered.length);
  const scale = longest <= 4 ? 1 : Math.max(0.55, 4 / longest);

  return (
    <span
      style={{
        fontFamily: fonts.heading,
        fontSize: Math.round(base * scale),
        fontWeight: weight,
        color: color ?? palette.text,
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
        ...style,
        // After ...style: a caller may restyle the numeral, but must not be
        // able to reintroduce the overflow this guards against.
        whiteSpace: "nowrap",
        minWidth: 0,
      }}
    >
      {rendered}
    </span>
  );
};

/** The suffix to actually render beside a value.
 *
 * `countUpString` preserves a suffix it parses OUT of the value, so a value of
 * "99.9%" already renders its own "%". Passing `suffix="%"` alongside then drew
 * it twice ("99.9%%"). Returns empty when the value already ends with it.
 */
export function effectiveSuffix(value: string, suffix?: string): string {
  if (!suffix) return "";
  return value.trim().endsWith(suffix.trim()) ? "" : suffix;
}

const Label: React.FC<{
  text: string;
  size?: number;
  color?: string;
  /** `label` is a small-caps tag; `prop` is supporting body copy. */
  tier?: "label" | "prop";
}> = ({ text, size, color, tier = "label" }) => {
  const { palette, type, fonts } = useKit();
  return (
    <div
      style={{
        fontFamily: fonts.body,
        fontSize: size ?? (tier === "prop" ? type.prop : type.label),
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
  const { palette, type, variant } = useKit();
  const enter = staggerEntrance(frame, index, { start, stagger: 10 });
  const numColor = primary ? palette.accentText : palette.text;

  return (
    <div
      style={{
        // The surface comes from the template's variant (which the blueprint
        // seeds from `surface_default`) rather than a hardcoded "panel". The
        // blueprint has always chosen a surface per layout and passed it in the
        // prompt; the card then ignored it and rendered a panel regardless.
        ...cardStyle(palette, (variant.surface as SurfaceVariant) ?? "panel"),
        borderTop: `3px solid ${primary ? palette.accent : palette.border}`,
        padding: "28px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        // `flex: 1` with `minWidth: 200` was the real overflow: five cards plus
        // their gaps demand 1112px, so the row's justifyContent:"center" never
        // engaged and the cards spilled past the frame instead. Sizing to
        // content means two cards are genuinely narrower and sit centred, while
        // five wrap to a centred second row.
        flex: "0 1 auto",
        minWidth: 0,
        maxWidth: 380,
        opacity: enter.opacity,
        transform: enter.transform,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, minWidth: 0, flexWrap: "nowrap" }}>
        <CountUpValue value={item.value} start={start + index * 10 + 4} color={numColor} />
        {effectiveSuffix(item.value, item.suffix) && (
          <span
            style={{
              fontSize: type.numeral * STAT_RATIOS.card.suffix,
              fontWeight: 700,
              color: palette.muted,
            }}
          >
            {effectiveSuffix(item.value, item.suffix)}
          </span>
        )}
      </div>
      <Label text={item.label} />
    </div>
  );
};

/**
 * A set of stats. First item is treated as primary by default.
 *
 * The ARRANGEMENT comes from the template's variant, not from the caller, so
 * two brands showing three numbers do not get the same row of the same cards.
 * That sameness was the most legible reason generated templates read as
 * templated: the kit had 21 decor systems and 25 signature artifacts, and
 * exactly one way to show a statistic.
 *
 * Each arrangement composes the SAME tested primitives (StatCard, CountUpValue,
 * Label, cardStyle) at different parameters — the pattern SignatureArtifact
 * uses, and for the same reason: visible variety with no new render risk.
 */
export const StatGrid: React.FC<{
  items: StatItem[];
  start?: number;
  highlightFirst?: boolean;
  /** Override the template's variant. Rarely needed — the point is that the
   *  arrangement is a property of the TEMPLATE, not of the call site. */
  arrangement?: StatArrangement;
}> = ({ items, start = 0, highlightFirst = true, arrangement }) => {
  const frame = useCurrentFrame();
  const { isPortrait, palette, type, fonts, variant } = useKit();
  const mode = arrangement ?? variant.stats;
  // Portrait is much narrower, so the wide arrangements would either overflow
  // or shrink past legibility. They fall back to their nearest vertical form.
  const effective: StatArrangement = isPortrait
    ? mode === "ticker" || mode === "quadrant"
      ? "stacked-rule"
      : mode === "row"
        ? "row"
        : mode
    : mode;

  const cells = (items ?? []).slice(0, isPortrait ? 4 : 5);
  if (!cells.length) return null;

  // ── ledger: label left, value right, hairline between. Reads as a statement
  // of account rather than a dashboard.
  if (effective === "ledger") {
    // Centred column with a max width: a two-row ledger used to sit at the
    // top-left of whatever box it was given, with a bare band beneath it.
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: "100%",
          maxWidth: "min(100%, 1100px)",
          margin: "0 auto",
        }}
      >
        {cells.map((it, i) => {
          const enter = staggerEntrance(frame, i, { start, stagger: 9 });
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 24,
                minWidth: 0,
                padding: isPortrait ? "14px 0" : "18px 0",
                borderBottom: `1px solid ${palette.border}`,
                opacity: enter.opacity,
                transform: enter.transform,
              }}
            >
              <Label text={it.label} />
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, minWidth: 0, flexWrap: "nowrap" }}>
                <CountUpValue
                  value={it.value}
                  start={start + i * 9 + 4}
                  color={highlightFirst && i === 0 ? palette.accentText : palette.text}
                  fontSize={type.numeral * STAT_RATIOS.ledger.value}
                />
                {effectiveSuffix(it.value, it.suffix) && (
                  <span
                    style={{
                      fontSize: type.numeral * STAT_RATIOS.ledger.suffix,
                      fontWeight: 700,
                      color: palette.muted,
                    }}
                  >
                    {effectiveSuffix(it.value, it.suffix)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── stacked-rule: full-width rows split by hairlines, no card chrome.
  if (effective === "stacked-rule") {
    // Centred column with a max width: a two-row ledger used to sit at the
    // top-left of whatever box it was given, with a bare band beneath it.
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: "100%",
          maxWidth: "min(100%, 1100px)",
          margin: "0 auto",
        }}
      >
        {cells.map((it, i) => {
          const enter = staggerEntrance(frame, i, { start, stagger: 9 });
          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: isPortrait ? "12px 0" : "16px 0",
                borderTop: i === 0 ? "none" : `1px solid ${palette.border}`,
                opacity: enter.opacity,
                transform: enter.transform,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, minWidth: 0, flexWrap: "nowrap" }}>
                <CountUpValue
                  value={it.value}
                  start={start + i * 9 + 4}
                  color={highlightFirst && i === 0 ? palette.accentText : palette.text}
                  fontSize={type.numeral * STAT_RATIOS.stackedRule.value}
                />
                {effectiveSuffix(it.value, it.suffix) && (
                  <span
                    style={{ fontSize: type.numeral * STAT_RATIOS.stackedRule.suffix, fontWeight: 700, color: palette.muted }}
                  >
                    {effectiveSuffix(it.value, it.suffix)}
                  </span>
                )}
              </div>
              <Label text={it.label} />
            </div>
          );
        })}
      </div>
    );
  }

  // ── hero-rail: one oversized primary, the rest in a thin rail beside it.
  if (effective === "hero-rail" && cells.length > 1) {
    const [hero, ...rest] = cells;
    const heroEnter = staggerEntrance(frame, 0, { start, stagger: 9 });
    return (
      <div
        style={{
          display: "flex",
          flexDirection: isPortrait ? "column" : "row",
          gap: isPortrait ? 22 : 44,
          alignItems: isPortrait ? "stretch" : "center",
          width: "100%",
        }}
      >
        <div
          style={{
            flex: isPortrait ? "none" : 1.6,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            opacity: heroEnter.opacity,
            transform: heroEnter.transform,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0, flexWrap: "nowrap" }}>
            <CountUpValue
              value={hero.value}
              start={start + 4}
              color={palette.accentText}
              fontSize={type.numeral * STAT_RATIOS.heroRail.value}
            />
            {effectiveSuffix(hero.value, hero.suffix) && (
              <span
                style={{ fontSize: type.numeral * STAT_RATIOS.heroRail.suffix, fontWeight: 700, color: palette.muted }}
              >
                {effectiveSuffix(hero.value, hero.suffix)}
              </span>
            )}
          </div>
          <Label text={hero.label} />
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            borderLeft: isPortrait ? "none" : `1px solid ${palette.border}`,
            borderTop: isPortrait ? `1px solid ${palette.border}` : "none",
            paddingLeft: isPortrait ? 0 : 28,
            paddingTop: isPortrait ? 18 : 0,
          }}
        >
          {rest.map((it, i) => {
            const enter = staggerEntrance(frame, i + 1, { start, stagger: 9 });
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 16,
                  minWidth: 0,
                  opacity: enter.opacity,
                  transform: enter.transform,
                }}
              >
                <Label text={it.label} />
                <CountUpValue
                  value={it.value}
                  start={start + (i + 1) * 9 + 4}
                  color={palette.text}
                  fontSize={type.numeral * STAT_RATIOS.heroRail.rest}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── quadrant: an even block, every stat equal weight.
  if (effective === "quadrant") {
    const quad = cells.slice(0, 4);
    // A 2x2 grid holding 3 items left a ragged empty cell in the corner. Below
    // 3 the grid collapses to a single centred column; at exactly 3 the last
    // item spans the full width so the block stays symmetrical about its
    // centre line instead of hanging off to one side.
    const singleCol = quad.length <= 2;
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: singleCol ? "1fr" : "1fr 1fr",
          gap: 0,
          width: "100%",
          justifyItems: "center",
        }}
      >
        {quad.map((it, i) => {
          const enter = staggerEntrance(frame, i, { start, stagger: 8 });
          const spans = quad.length === 3 && i === 2;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "26px 20px",
                width: "100%",
                ...(spans ? { gridColumn: "1 / -1" } : null),
                borderLeft:
                  !singleCol && !spans && i % 2 === 1
                    ? `1px solid ${palette.border}`
                    : "none",
                borderTop:
                  (singleCol ? i > 0 : i > 1)
                    ? `1px solid ${palette.border}`
                    : "none",
                opacity: enter.opacity,
                transform: enter.transform,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, minWidth: 0, flexWrap: "nowrap" }}>
                <CountUpValue
                  value={it.value}
                  start={start + i * 8 + 4}
                  color={highlightFirst && i === 0 ? palette.accentText : palette.text}
                  fontSize={type.numeral * STAT_RATIOS.quadrant.value}
                />
                {effectiveSuffix(it.value, it.suffix) && (
                  <span
                    style={{ fontSize: type.numeral * STAT_RATIOS.quadrant.suffix, fontWeight: 700, color: palette.muted }}
                  >
                    {effectiveSuffix(it.value, it.suffix)}
                  </span>
                )}
              </div>
              <Label text={it.label} />
            </div>
          );
        })}
      </div>
    );
  }

  // ── ticker: a dense inline strip, values divided by hairlines.
  if (effective === "ticker") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
          width: "100%",
          borderTop: `1px solid ${palette.border}`,
          borderBottom: `1px solid ${palette.border}`,
        }}
      >
        {cells.map((it, i) => {
          const enter = staggerEntrance(frame, i, { start, stagger: 7 });
          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: "16px 12px",
                borderLeft: i === 0 ? "none" : `1px solid ${palette.border}`,
                minWidth: 0,
                opacity: enter.opacity,
                transform: enter.transform,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 3, minWidth: 0, flexWrap: "nowrap" }}>
                <CountUpValue
                  value={it.value}
                  start={start + i * 7 + 4}
                  color={highlightFirst && i === 0 ? palette.accentText : palette.text}
                  fontSize={type.numeral * STAT_RATIOS.ticker.value}
                />
                {effectiveSuffix(it.value, it.suffix) && (
                  <span
                    style={{ fontSize: type.numeral * STAT_RATIOS.ticker.suffix, fontWeight: 700, color: palette.muted }}
                  >
                    {effectiveSuffix(it.value, it.suffix)}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontFamily: fonts.body,
                  fontSize: type.label * STAT_RATIOS.ticker.label,
                  color: palette.muted,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  textAlign: "center",
                  minWidth: 0,
                  overflowWrap: "break-word",
                }}
              >
                {it.label}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── row (default): the historical arrangement, now wrapping.
  return (
    <div
      style={{
        display: "flex",
        flexDirection: isPortrait ? "column" : "row",
        gap: isPortrait ? 20 : 28,
        alignItems: isPortrait ? "center" : "stretch",
        justifyContent: "center",
        // Five cards no longer overflow — they wrap to a centred second row.
        flexWrap: "wrap",
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
            <div style={{ display: "flex", alignItems: "baseline", gap: 3, minWidth: 0, flexWrap: "nowrap" }}>
              <CountUpValue
                value={it.value}
                start={start + i * 8 + 4}
                color={i === 0 ? palette.accent : palette.text}
                fontSize={type.numeral * STAT_RATIOS.metricRow.value}
              />
              {effectiveSuffix(it.value, it.suffix) && (
                <span style={{ fontSize: type.numeral * STAT_RATIOS.metricRow.suffix, color: palette.muted, fontWeight: 700 }}>
                  {effectiveSuffix(it.value, it.suffix)}
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
