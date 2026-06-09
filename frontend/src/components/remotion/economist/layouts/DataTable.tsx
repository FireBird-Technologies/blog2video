import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS, CHROME_INSET } from "../constants";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../../fonts/economist-defaults";
import { parseChartTable, toNum, fmtValue, clamp, textRise } from "./chartHelpers";

/**
 * DataTable — a ranked Economist table: rank · name · inline red magnitude bar ·
 * value. Rows sort descending and reveal top→down with the magnitude bar
 * growing in. Title + red tab on top.
 */
export const DataTable: React.FC<EconomistLayoutProps> = ({
  title,
  narration,
  chartTable,
  unit = "",
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
  const pad = isPortrait ? { x: 70, t: topInset, b: botInset } : { x: 96, t: topInset, b: botInset };
  const titleSize = (titleFontSize ?? (isPortrait ? 48 : 52)) as number;
  const subSize = Math.round(titleSize * 0.56);

  const headOp = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const { labels, series } = parseChartTable(chartTable);
  const vals = series[0]?.values ?? [];
  const rows = labels
    .map((label, i) => ({ label, value: Number.isFinite(vals[i]) ? vals[i] : toNum(label) ?? 0 }))
    .sort((a, b) => b.value - a.value);
  const maxV = Math.max(...rows.map((r) => r.value), 1);

  const innerW = width - pad.x * 2;
  const rankW = isPortrait ? 58 : 66;
  const nameW = isPortrait ? innerW * 0.4 : innerW * 0.34;
  const valueW = isPortrait ? 128 : 150;
  const barW = innerW - rankW - nameW - valueW - 24;
  const rowFont = isPortrait ? 32 : 32;
  // Scale row height to fill the body so a short table spreads instead of
  // stacking tight at the top with dead paper below.
  const headerBlock = 22 + titleSize * 1.05 + (narration ? subSize + 8 : 0) + 16 + 6 + 6;
  const availH = height - pad.t - pad.b - headerBlock;
  const rowCount = Math.max(1, rows.length);
  const rowH = clamp(availH / rowCount, 66, 104);

  return (
    <AbsoluteFill style={{ padding: `${pad.t}px ${pad.x}px ${pad.b}px` }}>
      {/* Header — tab, title and subtitle rise in with a stagger. */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ width: 34, height: 6, background: accentColor, marginBottom: 16, ...textRise(frame, 0, 14) }} />
        <div
          style={{
            fontFamily: ECONOMIST_SERIF_FONT,
            fontWeight: 700,
            fontSize: titleSize,
            lineHeight: 1.05,
            color: textColor,
            letterSpacing: -titleSize * 0.012,
            ...textRise(frame, 4),
          }}
        >
          {title}
        </div>
        {narration && (
          <div
            style={{
              fontFamily: ECONOMIST_SANS_FONT,
              fontSize: subSize,
              color: ECONOMIST_COLORS.muted,
              marginTop: 8,
              ...textRise(frame, 12),
            }}
          >
            {narration}
          </div>
        )}
      </div>

      {/* Header rule. */}
      <div style={{ height: 1.5, background: textColor, opacity: headOp, marginBottom: 4 }} />

      {/* Rows. */}
      <div>
        {rows.map((r, i) => {
          const s = 8 + i * 5;
          const op = interpolate(frame, [s, s + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const ty = interpolate(frame, [s, s + 14], [8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const grow = clamp(interpolate(frame, [s + 4, s + 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), 0, 1);
          const valOp = interpolate(grow, [0.6, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                height: rowH,
                borderBottom: `1px solid ${ECONOMIST_COLORS.rule}`,
                opacity: op,
                transform: `translateY(${ty}px)`,
              }}
            >
              <div style={{ width: rankW, fontFamily: ECONOMIST_SANS_FONT, fontWeight: 700, fontSize: rowFont * 0.8, color: ECONOMIST_COLORS.muted }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ width: nameW, fontFamily: ECONOMIST_SERIF_FONT, fontWeight: 600, fontSize: rowFont, color: textColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.label}
              </div>
              <div style={{ width: barW, paddingRight: 16 }}>
                <div style={{ width: `${(r.value / maxV) * 100 * grow}%`, height: rowFont * 0.66, background: accentColor }} />
              </div>
              <div style={{ width: valueW, textAlign: "right", fontFamily: ECONOMIST_SANS_FONT, fontWeight: 700, fontSize: rowFont, color: textColor, opacity: valOp }}>
                {fmtValue(r.value, unit)}
              </div>
            </div>
          );
        })}
      </div>

    </AbsoluteFill>
  );
};
