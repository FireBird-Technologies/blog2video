import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS, CHROME_INSET } from "../constants";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../../fonts/economist-defaults";
import { TrendGlyph } from "../components/EconomistOrnaments";
import { OdometerNumber } from "../components/OdometerNumber";
import { textRise } from "./chartHelpers";
import { letterpressStamp, ruleDraw, slideFrom } from "./motion";

/**
 * KeyIndicators — a "by the numbers" KPI panel. 2–4 large serif figures, each
 * with a thin red underline, an uppercase sans label, and an optional trend
 * (▲ blue / ▼ red). Cells reveal with a staggered rise; each figure's digits
 * roll into place like a mechanical odometer.
 */
export const KeyIndicators: React.FC<EconomistLayoutProps> = ({
  title,
  narration,
  indicators = [],
  accentColor = ECONOMIST_COLORS.accent,
  textColor = ECONOMIST_COLORS.ink,
  titleFontSize,
  aspectRatio = "landscape",
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";

  const topInset = (isPortrait ? CHROME_INSET.topPortrait : CHROME_INSET.top) + 24;
  const botInset = (isPortrait ? CHROME_INSET.bottomPortrait : CHROME_INSET.bottom) + 22;
  const pad = isPortrait ? { x: 70, t: topInset, b: botInset } : { x: 120, t: topInset, b: botInset };
  const titleSize = (titleFontSize ?? (isPortrait ? 60 : 56)) as number;

  const n = Math.max(1, indicators.length);
  const cols = isPortrait ? Math.min(2, n) : Math.min(4, n);
  // Length-aware value size so long figures ("$1.9trn", "+5.4%") don't overflow
  // their column. Size to the longest value across the row, not just the count.
  // Fewer columns get bigger figures so a 2-KPI row still fills the wide band.
  const longestVal = indicators.reduce((m, it) => Math.max(m, String(it.value ?? "").length), 1);
  const baseValueSize = isPortrait ? 116 : Math.min(150, 158 - cols * 8);
  const valueSize = Math.round(baseValueSize * Math.min(1, 6 / longestVal));
  // Wider gaps when there are few columns so the row breathes across the frame.
  const columnGap = isPortrait ? (cols <= 1 ? 0 : 48) : cols <= 2 ? 96 : 56;

  return (
    <AbsoluteFill style={{ padding: `${pad.t}px ${pad.x}px ${pad.b}px`, display: "flex", flexDirection: "column" }}>
      {/* Header — tab, title and subtitle rise in with a stagger. */}
      <div style={{ marginTop: isPortrait ? 60 : 0 }}>
        <div style={{ width: 34, height: 6, background: accentColor, marginBottom: 16, ...textRise(frame, 0, 14) }} />
        <div style={{ fontFamily: ECONOMIST_SERIF_FONT, fontWeight: 900, fontSize: titleSize, lineHeight: 1.04, color: textColor, letterSpacing: -titleSize * 0.012, ...textRise(frame, 4) }}>
          {title}
        </div>
        {narration && (
          <div style={{ fontFamily: ECONOMIST_SANS_FONT, fontSize: Math.round(titleSize * 0.42), color: ECONOMIST_COLORS.muted, marginTop: 8, ...textRise(frame, 12) }}>
            {narration}
          </div>
        )}
      </div>

      {/* KPI grid — fills the band below the header and centres a short row. */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          columnGap,
          rowGap: isPortrait ? 120 : 56,
          alignContent: "center",
          marginTop: 24,
        }}
      >
        {indicators.map((it, i) => {
          const s = 14 + i * 8;
          const op = interpolate(frame, [s, s + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const ty = interpolate(frame, [s, s + 16], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const d = (it.delta ?? "").trim();
          const up = d.startsWith("+");
          const down = d.startsWith("-") || d.startsWith("−");
          const deltaColor = up ? ECONOMIST_COLORS.blue : down ? accentColor : ECONOMIST_COLORS.muted;
          const cmpVal = (it.compareValue ?? "").trim();
          const cmpLab = (it.compareLabel ?? "vs").trim() || "vs";
          const trendDir: "up" | "down" | "flat" = up ? "up" : down ? "down" : "flat";
          const labelStamp = letterpressStamp(frame, s + 12, 12);
          const deltaSlide = slideFrom(frame, s + 18, 14);
          return (
            <div key={i} style={{ opacity: op, transform: `translateY(${ty}px)` }}>
              <OdometerNumber
                value={String(it.value ?? "")}
                frame={frame}
                start={s}
                fontSize={valueSize}
                color={textColor}
                fontFamily={ECONOMIST_SERIF_FONT}
                fontWeight={900}
                letterSpacing={-valueSize * 0.02}
              />
              <div style={{ width: isPortrait ? 72 : 56, height: isPortrait ? 5 : 4, background: accentColor, margin: "16px 0 12px", ...ruleDraw(frame, s + 8, 12) }} />
              <div
                style={{
                  fontFamily: ECONOMIST_SANS_FONT,
                  fontWeight: 700,
                  fontSize: isPortrait ? 31 : 23,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  color: textColor,
                  opacity: labelStamp.opacity,
                  transform: labelStamp.transform,
                  transformOrigin: "left center",
                  filter: labelStamp.filter,
                }}
              >
                {it.label}
              </div>
              {(d || cmpVal) && (
                <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 12, marginTop: 6, opacity: deltaSlide.opacity, transform: deltaSlide.transform }}>
                  {d && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: ECONOMIST_SANS_FONT, fontWeight: 700, fontSize: isPortrait ? 28 : 21, color: deltaColor }}>
                      {(up || down) && <TrendGlyph direction={trendDir} size={isPortrait ? 20 : 14} color={deltaColor} />}
                      {d.replace(/^[+\-−]/, "")}
                    </span>
                  )}
                  {cmpVal && (
                    <span style={{ fontFamily: ECONOMIST_SANS_FONT, fontWeight: 400, fontSize: isPortrait ? 25 : 18, color: ECONOMIST_COLORS.muted }}>
                      {cmpLab} <span style={{ fontWeight: 700 }}>{cmpVal}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </AbsoluteFill>
  );
};
