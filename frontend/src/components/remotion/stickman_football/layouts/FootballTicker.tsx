import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneLayoutProps } from "../types";
import { FootballPitchBackdrop, FROSTED_CARD_STYLE, estimateWrappedTextHeight } from "./FootballPitchBackdrop";

const HAND_FONT = "'Patrick Hand', system-ui, sans-serif";
const MAX_ROWS = 10;
const MAX_COLS = 6;
const POSITIVE_COLOR = "#1E7A4C";
const NEGATIVE_COLOR = "#B83B3B";
const GRID_LINE = "rgba(17,17,17,0.12)";

function parseNumericCell(raw: string): number {
  const s = raw.trim();
  const wrapped = s.match(/^\(([0-9,.]+)\)$/);
  const signed = wrapped ? `-${wrapped[1]}` : s;
  return parseFloat(signed.replace(/[^0-9.\-+]/g, ""));
}

function highlightCell(raw: string): { color: string; bold: boolean } | undefined {
  const n = parseNumericCell(raw);
  if (!Number.isFinite(n)) return undefined;
  if (n > 0) return { color: POSITIVE_COLOR, bold: Math.abs(n) >= 10 };
  if (n < 0) return { color: NEGATIVE_COLOR, bold: Math.abs(n) >= 10 };
  return undefined;
}

export const FootballTicker: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor,
    textColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
    tickerTable,
    tickerTitle,
    tickerFootnote,
    tickerHighlightCol,
  } = props;

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const dur = sceneDurationInFrames ?? 150;

  const W = p ? 1080 : 1920;
  const H = p ? 1920 : 1080;
  const accent = accentColor ?? "#2E7D32";
  const text = textColor ?? "#111111";
  const font = fontFamily ?? HAND_FONT;

  const titlePx = titleFontSize ?? (p ? 68 : 71);
  const descPx = descriptionFontSize ?? (p ? 38 : 36);

  const rawHeaders = (tickerTable?.headers ?? []).slice(0, MAX_COLS);
  const rawRows = (tickerTable?.rows ?? []).slice(0, MAX_ROWS).map((r) => (r ?? []).slice(0, MAX_COLS));
  const colCount = Math.max(rawHeaders.length, rawRows.reduce((m, r) => Math.max(m, r.length), 0), 1);
  const rowCount = rawRows.length;
  const hlCol =
    typeof tickerHighlightCol === "number" && tickerHighlightCol >= 0 && tickerHighlightCol < colCount
      ? tickerHighlightCol
      : -1;
  const hasData = rowCount > 0;

  const fewRows = rowCount <= 6;
  const fewCols = colCount <= 4;
  const densityTier = rowCount <= 10 ? 0 : rowCount <= 16 ? 1 : 2;
  const cellFontSize = Math.round((p ? 28 : 24) * [1, 0.95, 0.88][densityTier]);
  const headerFontSize = Math.round(cellFontSize * 0.9);
  const cellPadV = (p ? [12, 10, 8] : [10, 9, 7])[densityTier];
  const cellPadH = colCount <= 4 ? 14 : 10;
  const naturalRowH = Math.round(cellFontSize * 1.35 + cellPadV * 2);

  const tableWidthCap =
    colCount <= 2 ? (p ? "72%" : "56%") : colCount === 3 ? (p ? "88%" : "72%") : colCount === 4 ? (p ? "96%" : "86%") : "100%";

  const enter = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [dur - 16, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sceneOpacity = enter * exit;
  const titleOp = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 16], [10, 0], { extrapolateRight: "clamp" });
  const ruleW = interpolate(frame, [4, 22], [0, 100], { extrapolateRight: "clamp" });
  const headerOp = interpolate(frame, [4, 20], [0, 1], { extrapolateRight: "clamp" });
  const cardOp = interpolate(frame, [10, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const footnoteOp = interpolate(frame, [20 + rowCount * 8, 20 + rowCount * 8 + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const narrationOp = interpolate(frame, [28 + rowCount * 8, 28 + rowCount * 8 + 18], [0, 0.88], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const rowOp = (i: number) =>
    interpolate(frame, [20 + i * 8, 20 + i * 8 + 14], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  const cardInsetX = W * (p ? 0.07 : 0.08);
  const cardW = W - cardInsetX * 2;
  const narrFontSize = descPx * 0.88;
  const narrationBottom = p ? H * 0.05 : H * 0.045;
  const narrGap = 14;
  const narrHeight = narration
    ? estimateWrappedTextHeight(narration, cardW, narrFontSize, 1.4)
    : 0;
  const portraitCardTextGap = 14;
  const portraitVerticalPadding = H * 0.06;
  const portraitTitleH =
    titlePx * 1.2 + (tickerTitle ? descPx + 4 : 0) + 16;
  const portraitContentMaxH = H - portraitVerticalPadding * 2;
  const portraitBelowCard = narration ? portraitCardTextGap + narrHeight : 0;
  const portraitCardMaxH = Math.max(
    H * 0.22,
    portraitContentMaxH - portraitTitleH - portraitCardTextGap - portraitBelowCard,
  );
  const contentTop = H * (p ? 0.09 : 0.07);
  const contentBottom = narration
    ? narrationBottom + narrHeight + narrGap + 8
    : p ? H * 0.06 : H * 0.05;

  const cellBorder = (ci: number) => (ci < colCount - 1 ? `1px solid ${GRID_LINE}` : "none");

  const tablePanel = (
    <div
      style={{
        alignSelf: fewCols ? "center" : "stretch",
        width: tableWidthCap,
        maxWidth: "100%",
        flex: fewRows ? "0 1 auto" : "1 1 0",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        borderRadius: 12,
        overflow: "hidden",
        background: "rgba(255,255,255,0.42)",
        border: `2px solid ${text}14`,
      }}
    >
      {!hasData ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: p ? "10% 8%" : "8% 6%",
            fontSize: descPx,
            color: text,
            opacity: 0.5,
            fontStyle: "italic",
          }}
        >
          No data — add a table by editing this scene
        </div>
      ) : (
        <>
          {rawHeaders.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                flexShrink: 0,
                background: `${accent}CC`,
                borderBottom: `2px solid ${accent}`,
                opacity: headerOp,
              }}
            >
              {rawHeaders.map((hdr, ci) => (
                <div
                  key={ci}
                  style={{
                    flex: "1 1 0",
                    minWidth: 0,
                    boxSizing: "border-box",
                    padding: `${Math.round(cellPadV * 1.1)}px ${cellPadH}px`,
                    fontWeight: 700,
                    fontSize: headerFontSize,
                    color: text,
                    borderRight: ci < colCount - 1 ? `1px solid rgba(0,0,0,0.1)` : "none",
                    textAlign: ci > 0 ? "right" : "left",
                  }}
                >
                  {hdr}
                </div>
              ))}
            </div>
          )}
          <div
            style={{
              flex: fewRows ? "0 1 auto" : "1 1 0",
              minHeight: 0,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {rawRows.map((row, ri) => (
              <div
                key={ri}
                style={{
                  flex: fewRows ? `0 0 ${naturalRowH}px` : "1 1 0",
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "row",
                  borderBottom: ri < rowCount - 1 ? `1px dashed ${GRID_LINE}` : "none",
                  opacity: rowOp(ri),
                  background: ri % 2 === 1 ? "rgba(0,0,0,0.03)" : "transparent",
                }}
              >
                {Array.from({ length: colCount }).map((_, ci) => {
                  const cellRaw = row[ci] ?? "";
                  const hlStyle = ci === hlCol ? highlightCell(cellRaw) : undefined;
                  return (
                    <div
                      key={ci}
                      style={{
                        flex: "1 1 0",
                        minWidth: 0,
                        boxSizing: "border-box",
                        padding: `${cellPadV}px ${cellPadH}px`,
                        fontWeight: hlStyle?.bold ? 700 : ci === 0 ? 600 : 400,
                        fontSize: cellFontSize,
                        lineHeight: 1.35,
                        color: hlStyle ? hlStyle.color : text,
                        borderRight: cellBorder(ci),
                        textAlign: ci > 0 ? "right" : "left",
                        fontVariantNumeric: "tabular-nums",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: ci > 0 ? "flex-end" : "flex-start",
                      }}
                    >
                      <span style={{ maxWidth: "100%", overflowWrap: "anywhere" }}>{cellRaw}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const titleBlock = (centered: boolean) => (
    <div
      style={{
        opacity: titleOp,
        transform: `translateY(${titleY}px)`,
        flexShrink: 0,
        marginBottom: centered ? 0 : 10,
        textAlign: centered ? "center" : "left",
        width: "100%",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: titlePx, color: text, textTransform: "uppercase", letterSpacing: "0.02em" }}>
        {title}
      </div>
      {tickerTitle && (
        <div style={{ fontWeight: 600, fontSize: descPx - 2, color: text, opacity: 0.65, marginTop: 4 }}>
          {tickerTitle}
        </div>
      )}
      <div
        style={{
          marginTop: 6,
          marginLeft: centered ? "auto" : undefined,
          marginRight: centered ? "auto" : undefined,
          height: 4,
          width: centered ? "55%" : `${ruleW}%`,
          background: accent,
          borderRadius: 2,
          transformOrigin: centered ? "center center" : "left center",
          transform: centered ? `scaleX(${ruleW / 100})` : undefined,
        }}
      />
    </div>
  );

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity, overflow: "hidden", fontFamily: font }}>
      <FootballPitchBackdrop W={W} H={H} p={p} accent={accent} frame={frame} fps={fps} />

      {p ? (
        <div
          style={{
            position: "absolute",
            left: cardInsetX,
            right: cardInsetX,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            maxHeight: portraitContentMaxH,
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div style={{ width: "100%", marginBottom: portraitCardTextGap }}>{titleBlock(true)}</div>

          <div
            style={{
              width: "100%",
              maxHeight: portraitCardMaxH,
              opacity: cardOp,
              ...FROSTED_CARD_STYLE,
              padding: "22px 20px",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              flex: "0 1 auto",
              minHeight: 0,
            }}
          >
            <div
              style={{
                flex: fewRows ? "0 1 auto" : "1 1 0",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: fewCols ? "center" : "stretch",
                justifyContent: fewRows ? "center" : "flex-start",
              }}
            >
              {tablePanel}
            </div>

            {tickerFootnote && (
              <div
                style={{
                  flexShrink: 0,
                  marginTop: 12,
                  opacity: footnoteOp * 0.75,
                  fontStyle: "italic",
                  fontSize: Math.round(descPx * 0.78),
                  color: text,
                  lineHeight: 1.35,
                  textAlign: "center",
                  width: "100%",
                }}
              >
                {tickerFootnote}
              </div>
            )}
          </div>

          {narration && (
            <div
              style={{
                marginTop: portraitCardTextGap,
                width: "100%",
                fontSize: narrFontSize,
                color: text,
                opacity: narrationOp,
                lineHeight: 1.4,
                textAlign: "center",
                wordBreak: "break-word",
                overflowWrap: "break-word",
              }}
            >
              {narration}
            </div>
          )}
        </div>
      ) : (
        <>
      <div
        style={{
          position: "absolute",
          left: cardInsetX,
          right: cardInsetX,
          top: contentTop,
          bottom: contentBottom,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: H * (p ? 0.04 : 0.035),
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: cardW,
            maxHeight: "100%",
            opacity: cardOp,
            ...FROSTED_CARD_STYLE,
            padding: p ? "22px 20px" : "24px 28px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            flex: fewRows ? "0 1 auto" : "1 1 0",
            minHeight: 0,
          }}
        >
          {titleBlock(false)}

          <div
            style={{
              flex: fewRows ? "0 1 auto" : "1 1 0",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: fewCols ? "center" : "stretch",
              justifyContent: fewRows ? "center" : "flex-start",
            }}
          >
            {tablePanel}
          </div>

          {tickerFootnote && (
            <div
              style={{
                flexShrink: 0,
                marginTop: 12,
                opacity: footnoteOp * 0.75,
                fontStyle: "italic",
                fontSize: Math.round(descPx * 0.78),
                color: text,
                lineHeight: 1.35,
                textAlign: "left",
                width: "100%",
              }}
            >
              {tickerFootnote}
            </div>
          )}
        </div>
      </div>

      {narration && (
        <div
          style={{
            position: "absolute",
            left: cardInsetX,
            right: cardInsetX,
            bottom: narrationBottom,
            fontSize: narrFontSize,
            color: text,
            opacity: narrationOp,
            lineHeight: 1.4,
            wordBreak: "break-word",
            overflowWrap: "break-word",
          }}
        >
          {narration}
        </div>
      )}
        </>
      )}
    </AbsoluteFill>
  );
};
