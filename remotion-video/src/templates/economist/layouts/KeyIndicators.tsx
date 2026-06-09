import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS } from "../constants";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../fonts/economist-defaults";

/**
 * KeyIndicators — a "by the numbers" KPI panel. 2–4 large serif figures, each
 * with a thin red underline, an uppercase sans label, and an optional trend
 * (▲ blue / ▼ red). Cells reveal with a staggered rise.
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

  const pad = isPortrait ? { x: 70, t: 70, b: 84 } : { x: 120, t: 80, b: 80 };
  const titleSize = (titleFontSize ?? (isPortrait ? 52 : 56)) as number;
  const headOp = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const n = Math.max(1, indicators.length);
  const cols = isPortrait ? Math.min(2, n) : Math.min(4, n);
  // Length-aware value size so long figures ("$1.9trn", "+5.4%") don't overflow
  // their column. Size to the longest value across the row, not just the count.
  const longestVal = indicators.reduce((m, it) => Math.max(m, String(it.value ?? "").length), 1);
  const baseValueSize = isPortrait ? 92 : Math.min(120, 132 - cols * 8);
  const valueSize = Math.round(baseValueSize * Math.min(1, 6 / longestVal));

  return (
    <AbsoluteFill style={{ padding: `${pad.t}px ${pad.x}px ${pad.b}px`, justifyContent: "center" }}>
      {/* Header. */}
      <div style={{ position: "absolute", top: pad.t, left: pad.x, right: pad.x, opacity: headOp }}>
        <div style={{ width: 34, height: 6, background: accentColor, marginBottom: 16 }} />
        <div style={{ fontFamily: ECONOMIST_SERIF_FONT, fontWeight: 900, fontSize: titleSize, lineHeight: 1.04, color: textColor, letterSpacing: -titleSize * 0.012 }}>
          {title}
        </div>
        {narration && (
          <div style={{ fontFamily: ECONOMIST_SANS_FONT, fontSize: Math.round(titleSize * 0.42), color: ECONOMIST_COLORS.muted, marginTop: 8 }}>
            {narration}
          </div>
        )}
      </div>

      {/* KPI grid. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          columnGap: isPortrait ? 40 : 56,
          rowGap: isPortrait ? 48 : 56,
          marginTop: isPortrait ? 40 : 20,
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
          return (
            <div key={i} style={{ opacity: op, transform: `translateY(${ty}px)` }}>
              <div style={{ fontFamily: ECONOMIST_SERIF_FONT, fontWeight: 900, fontSize: valueSize, lineHeight: 1, color: textColor, letterSpacing: -valueSize * 0.02 }}>
                {it.value}
              </div>
              <div style={{ width: 56, height: 4, background: accentColor, margin: "16px 0 12px" }} />
              <div style={{ fontFamily: ECONOMIST_SANS_FONT, fontWeight: 700, fontSize: isPortrait ? 25 : 23, letterSpacing: 0.6, textTransform: "uppercase", color: textColor }}>
                {it.label}
              </div>
              {d && (
                <div style={{ fontFamily: ECONOMIST_SANS_FONT, fontWeight: 700, fontSize: isPortrait ? 23 : 21, color: deltaColor, marginTop: 6 }}>
                  {up ? "▲" : down ? "▼" : ""} {d.replace(/^[+\-−]/, "")}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </AbsoluteFill>
  );
};
