import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS, CHROME_INSET } from "../constants";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../fonts/economist-defaults";
import { parseChartTable, toNum, fmtValue, clamp, textRise } from "./chartHelpers";
import {
  clamp01,
  easeOutBack,
  letterpressStamp,
  ruleDraw,
  slideFrom,
  countUpValue,
  panelSqueeze,
} from "./motion";
import { ExplainerBox } from "./ExplainerBox";

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
  explainer,
  accentColor = ECONOMIST_COLORS.accent,
  textColor = ECONOMIST_COLORS.ink,
  titleFontSize,
  fontFamily,
  aspectRatio = "landscape",
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";

  const topInset = (isPortrait ? CHROME_INSET.topPortrait : CHROME_INSET.top) + 24;
  const botInset = (isPortrait ? CHROME_INSET.bottomPortrait : CHROME_INSET.bottom) + 22;
  const pad = isPortrait ? { x: 70, t: topInset, b: botInset } : { x: 96, t: topInset, b: botInset };
  const titleSize = (titleFontSize ?? (isPortrait ? 58 : 52)) as number;
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
  const rowFont = isPortrait ? 42 : 32;
  // Scale row height to fill the body so a short table spreads instead of
  // stacking tight at the top with dead paper below.
  const headerBlock = 22 + titleSize * 1.05 + (narration ? subSize + 8 : 0) + 16 + 6 + 6;
  const availH = height - pad.t - pad.b - headerBlock;
  const rowCount = Math.max(1, rows.length);
  const rowH = clamp(availH / rowCount, isPortrait ? 88 : 66, isPortrait ? 140 : 104);
  // Centre the row block in the body: when the rows don't fill availH, split the
  // leftover space above and below instead of letting it all pool at the bottom.
  const rowsBlockH = rowH * rowCount;
  const rowsTopSpacer = Math.max(0, (availH - rowsBlockH) * 0.5);

  // Dynamic insight: the top-ranked row (and its lead over the next) — the
  // fallback takeaway when the LLM didn't supply an explainer.
  const tableInsight = (() => {
    if (rows.length === 0) return "";
    const u = (unit || "").trim();
    const top = rows[0];
    const topVal = Number.isInteger(top.value) ? String(top.value) : top.value.toFixed(1);
    if (rows.length > 1) {
      const gap = top.value - rows[1].value;
      const gapStr = Number.isInteger(gap) ? String(gap) : gap.toFixed(1);
      return `${top.label} leads at ${topVal}${u}, ${gapStr}${u} ahead of ${rows[1].label}.`;
    }
    return `${top.label} leads at ${topVal}${u}.`;
  })();

  // Post-animation squeeze + takeaway panel. The last row settles at a
  // data-dependent frame; the clamp keeps everything inside the 200f minimum
  // scene duration. The rows block scales about its top, freeing a bottom band.
  const lastRowEnd = 8 + (rowCount - 1) * 5 + 26;
  const squeezeStart = Math.min(lastRowEnd + 14, 130);
  const boxDelay = squeezeStart + 10;
  const sq = panelSqueeze(frame, squeezeStart, isPortrait ? 0.92 : 0.88);
  const takeaway = (explainer ?? "").trim() || tableInsight;

  return (
    <AbsoluteFill style={{ padding: `${pad.t}px ${pad.x}px ${pad.b}px` }}>
      {/* Header — tab, title and subtitle rise in with a stagger. */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ width: 34, height: 6, background: accentColor, marginBottom: 16, ...textRise(frame, 0, 14) }} />
        <div
          style={{
            fontFamily: fontFamily ?? ECONOMIST_SERIF_FONT,
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
              fontFamily: fontFamily ?? ECONOMIST_SANS_FONT,
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

      {/* Header rule draws across. */}
      <div style={{ height: 1.5, background: textColor, opacity: headOp, marginBottom: 4, ...ruleDraw(frame, 6, 14) }} />

      {/* Rows — the block squeezes about its top once the last row settles. */}
      <div
        style={{
          marginTop: rowsTopSpacer,
          transform: `scale(${sq.toFixed(4)})`,
          transformOrigin: "50% 0%",
        }}
      >
        {rows.map((r, i) => {
          const s = 8 + i * 5;
          const row = slideFrom(frame, s, -26);
          const rankStamp = letterpressStamp(frame, s, 12, 1.3);
          // Bar grows with a slight spring past its mark, capped at the column.
          const growRaw = clamp(interpolate(frame, [s + 4, s + 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), 0, 1);
          const grow = easeOutBack(growRaw, 1.1);
          const barPct = Math.min((r.value / maxV) * 100 * Math.max(0, grow), 100);
          const valOp = clamp01((growRaw - 0.6) / 0.4);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                height: rowH,
                borderBottom: `1px solid ${ECONOMIST_COLORS.rule}`,
                opacity: row.opacity,
                transform: row.transform,
              }}
            >
              <div
                style={{
                  width: rankW,
                  fontFamily: fontFamily ?? ECONOMIST_SANS_FONT,
                  fontWeight: 700,
                  fontSize: rowFont * 0.8,
                  color: ECONOMIST_COLORS.muted,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    opacity: rankStamp.opacity,
                    transform: rankStamp.transform,
                    filter: rankStamp.filter,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <div style={{ width: nameW, fontFamily: fontFamily ?? ECONOMIST_SERIF_FONT, fontWeight: 600, fontSize: rowFont, color: textColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.label}
              </div>
              <div style={{ width: barW, paddingRight: 16 }}>
                <div style={{ width: `${barPct.toFixed(2)}%`, height: rowFont * 0.66, background: accentColor }} />
              </div>
              <div style={{ width: valueW, textAlign: "right", fontFamily: fontFamily ?? ECONOMIST_SANS_FONT, fontWeight: 700, fontSize: rowFont, color: textColor, opacity: valOp }}>
                {countUpValue(fmtValue(r.value, unit), frame, s + 8)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Takeaway panel rising into the band freed by the squeeze. Absolute
          children ignore the AbsoluteFill's padding, so re-apply it here. */}
      <ExplainerBox
        frame={frame}
        delay={boxDelay}
        left={pad.x}
        bottom={pad.b}
        width={width - pad.x * 2}
        text={takeaway}
        accentColor={accentColor}
        fontSize={Math.round(subSize * (isPortrait ? 0.8 : 0.85))}
        isPortrait={isPortrait}
        fontFamily={fontFamily}
      />
    </AbsoluteFill>
  );
};
