import React from "react";
import { interpolate, useVideoConfig, delayRender, continueRender } from "remotion";
import type { SceneLayoutProps } from "../types";
import {
  SAKURA,
  SAKURA_DISPLAY_FONT,
  SAKURA_BODY_FONT,
  SakuraScene,
  useSakuraFrame,
  BrushUnderline,
  CornerBlossoms,
  KamonWatermark,
  SakuraVineFrame,
} from "../sakuraStyle";

const SAKURA_TABLE_MAX_ROWS = 20;
const TABLE_MAX_COLS = 6;

const INK_DIM = "rgba(26,10,15,0.60)";
const POSITIVE_COLOR = "#3B6E50";
const NEGATIVE_COLOR = SAKURA.crimson;
const GRID_STROKE = "rgba(26,10,15,0.16)";
const PANEL_BG = "rgba(253,246,240,0.66)";
const HEADER_BG = "rgba(192,20,60,0.10)";

function parseNumericCell(raw: string): number {
  const s = raw.trim();
  const wrapped = s.match(/^\(([0-9,.]+)\)$/);
  const signed = wrapped ? `-${wrapped[1]}` : s;
  const cleaned = signed.replace(/[^0-9.+\-]/g, "");
  return parseFloat(cleaned);
}

function highlightCellColor(raw: string): { color: string; bold: boolean } | undefined {
  const n = parseNumericCell(raw);
  if (!Number.isFinite(n)) return undefined;
  if (n > 0) return { color: POSITIVE_COLOR, bold: Math.abs(n) >= 10 };
  if (n < 0) return { color: NEGATIVE_COLOR, bold: Math.abs(n) >= 10 };
  return undefined;
}

function reveal(frame: number, start: number, end: number): number {
  if (end <= start) return frame >= start ? 1 : 0;
  return Math.max(0, Math.min(1, (frame - start) / (end - start)));
}

export const SakuraTable: React.FC<SceneLayoutProps> = ({
  title = "The data in view",
  narration,
  accentColor = SAKURA.crimson,
  bgColor,
  textColor = SAKURA.ink,
  aspectRatio = "landscape",
  sceneDurationInFrames,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
  tickerTable,
  tickerTitle,
  tickerFootnote,
  tickerHighlightCol,
}) => {
  const frame = useSakuraFrame();
  const { height, width, durationInFrames } = useVideoConfig();
  const dur = sceneDurationInFrames ?? durationInFrames;
  const p = aspectRatio === "portrait" || height > width;
  const bodyFont = fontFamily || SAKURA_BODY_FONT;
  const ink = textColor || SAKURA.ink;
  const accent = accentColor || SAKURA.crimson;

  const titleSize = titleFontSize ?? (p ? 50 : 44);
  const descSize = descriptionFontSize ?? (p ? 22 : 19);

  const rawHeaders = (tickerTable?.headers ?? []).slice(0, TABLE_MAX_COLS);
  const rawRows = (tickerTable?.rows ?? [])
    .slice(0, SAKURA_TABLE_MAX_ROWS)
    .map((row: string[]) => (row ?? []).slice(0, TABLE_MAX_COLS));

  const colCount = Math.max(rawHeaders.length, rawRows.reduce((m: number, row: string[]) => Math.max(m, row.length), 0));
  const rowCount = rawRows.length;

  const hlColIndex =
    typeof tickerHighlightCol === "number" && tickerHighlightCol >= 0 && tickerHighlightCol < colCount
      ? tickerHighlightCol
      : -1;

  const densityTier = rowCount <= 10 ? 0 : rowCount <= 16 ? 1 : 2;
  const fewRows = rowCount <= 6;
  const fewCols = colCount <= 4;

  const cellFontSize = (() => {
    const colTier = colCount <= 3 ? 0 : colCount <= 5 ? 1 : 2;
    const tier = Math.max(densityTier, colTier);
    // Portrait gets a notably larger table so it reads well on tall screens;
    // landscape is unchanged.
    const baseFs = p ? 32 : 22;
    const scale = [1, 0.96, 0.91][tier];
    return Math.round(baseFs * scale);
  })();
  const headerFontSize = Math.round(cellFontSize * 0.9);
  const cellPadV = (p ? [18, 15, 12] : [12, 10, 8])[densityTier];
  const cellPadH = colCount <= 4 ? 14 : 10;

  const naturalRowHeight = Math.round(cellFontSize * 1.6 + cellPadV * 2);
  // Width the table panel is capped to, as a fraction of the content area, plus
  // the CSS percentage string used for layout. The fraction lets us compute the
  // panel's real pixel width deterministically (see vineW) so the vine frame
  // never shrinks to a stale partial width.
  const tableWidthFrac = (() => {
    if (colCount <= 2) return p ? 0.7 : 0.55;
    if (colCount === 3) return p ? 0.88 : 0.7;
    if (colCount === 4) return p ? 0.96 : 0.85;
    return 1;
  })();
  const tableWidthCap = `${Math.round(tableWidthFrac * 100)}%`;

  const titleA = reveal(frame, 4, 22);
  const headerA = reveal(frame, 10, 26);
  function rowOpacity(i: number): number {
    const start = 16 + i * (rowCount <= 6 ? 6 : rowCount <= 12 ? 4 : 3);
    return reveal(frame, start, start + 20);
  }
  const footnoteA = reveal(frame, 60, 80);

  // Flowering vine that grows around the table's edge. It creeps clockwise from
  // the top-left corner, blossoms unfurling in its wake, once the panel and its
  // first rows have appeared. The panel is flex-sized, so we MEASURE it and feed
  // the real pixel border to the vine. A delayRender handle keeps each still /
  // export frame from being captured before that first measured re-render lands
  // (otherwise the vine collapses to a flat h≈0 line).
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [panelSize, setPanelSize] = React.useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [handle] = React.useState(() => delayRender("sakura-table-vine-measure"));
  const measured = React.useRef(false);
  React.useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setPanelSize((prev) =>
        Math.abs(prev.w - r.width) > 0.5 || Math.abs(prev.h - r.height) > 0.5
          ? { w: r.width, h: r.height }
          : prev,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Release the captured frame only AFTER the measured size has been committed,
  // so the still/export re-renders with the real border in hand. Require BOTH
  // width AND height: nested flex columns resolve width before height, so a
  // width-only gate can release with h≈0, collapsing the vine to a flat top line.
  React.useEffect(() => {
    if (!measured.current && ((panelSize.w > 0 && panelSize.h > 0) || panelRef.current === null)) {
      measured.current = true;
      continueRender(handle);
    }
  }, [panelSize, handle]);

  // Deterministic panel size (both axes). The measured size can come back
  // STALE/partial in some render environments — flex hasn't finished resolving
  // the panel when getBoundingClientRect runs — which shrinks the vine to only
  // the first rows (bad height) or the first columns (bad width). These computed
  // values are reliable lower bounds, so we frame the vine around
  // max(measured, computed) on each axis and the collapse can't happen.
  //
  // Height: header + all rows (the panel is never shorter than its content).
  const headerBoxH = rawHeaders.length > 0 ? Math.round(headerFontSize * 1.2 + cellPadV * 1.08 * 2) : 0;
  const contentPanelH = headerBoxH + rowCount * naturalRowHeight;
  const vineH = Math.max(panelSize.h, contentPanelH);
  // Width: the panel is `tableWidthFrac` of the content area, and the content
  // area is the scene width minus the outer horizontal padding (6% portrait /
  // 7% landscape each side, CSS % padding is relative to width).
  const contentAreaW = width * (1 - 2 * (p ? 0.06 : 0.07));
  const contentPanelW = contentAreaW * tableWidthFrac;
  const vineW = Math.max(panelSize.w, contentPanelW);

  const vineGrow = reveal(frame, 26, 26 + (p ? 78 : 66));

  const nCols = Math.max(colCount, rawHeaders.length, 1);
  const cellBorder = (ci: number) => (ci < nCols - 1 ? `1px solid ${GRID_STROKE}` : "none");

  const chrome = (
    <>
      <CornerBlossoms heavy={["tr"]} light={["bl"]} scale={0.8} />
      <KamonWatermark cx={width * 0.14} cy={height * 0.16} r={70} opacity={0.06} />
    </>
  );

  return (
    <SakuraScene
      backdrop="washi_radial"
      entranceLayout="sakura_list_scene"
      bgColor={bgColor}
      accentColor={accent}
      dur={dur}
      petals={12}
      petalIntensity={0.7}
      petalMode="float"
      ambient="mist_gold"
      chrome={chrome}
    >
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: `${p ? "8%" : "6%"} ${p ? "6%" : "7%"}`, minHeight: 0, gap: 0 }}>
        <div style={{ opacity: titleA, flexShrink: 0, marginBottom: Math.round(height * 0.016), textAlign: "center" }}>
          <div style={{ fontFamily: SAKURA_DISPLAY_FONT, fontWeight: 700, fontSize: titleSize, lineHeight: 1.08, color: ink }}>
            {title}
          </div>
          {tickerTitle && (
            <div style={{ fontFamily: bodyFont, fontWeight: 400, fontSize: Math.round(descSize * 0.95), letterSpacing: "0.08em", textTransform: "uppercase", color: INK_DIM, marginTop: Math.round(height * 0.006) }}>
              {tickerTitle}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "center", marginTop: Math.round(height * 0.012) }}>
            <BrushUnderline width={Math.min(200, width * 0.22)} color={accent} startFrame={8} durationFrames={18} />
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: fewCols ? "center" : "stretch", justifyContent: fewRows ? "center" : "flex-start" }}>
          {/* Sizing wrapper: holds the clipped panel + the (unclipped) vine overlay */}
          <div
            ref={panelRef}
            style={{
              position: "relative",
              alignSelf: fewCols ? "center" : "stretch",
              width: tableWidthCap,
              maxWidth: "100%",
              flex: fewRows ? "0 1 auto" : "1 1 0",
              minHeight: 0,
              maxHeight: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
          <div
            style={{
              flex: fewRows ? "0 1 auto" : "1 1 0",
              minHeight: 0,
              maxHeight: "100%",
              display: "flex",
              flexDirection: "column",
              borderRadius: 6,
              overflow: "hidden",
              background: PANEL_BG,
              border: `1.5px solid rgba(26,10,15,0.20)`,
              borderTop: `3px solid ${accent}`,
              boxShadow: "0 2px 12px rgba(26,10,15,0.08)",
            }}
          >
            {rawHeaders.length > 0 && (
              <div style={{ display: "flex", flexDirection: "row", width: "100%", flexShrink: 0, background: HEADER_BG, borderBottom: `1.5px solid rgba(26,10,15,0.20)`, opacity: headerA, alignItems: "stretch" }}>
                {rawHeaders.map((hdr, ci) => (
                  <div key={ci} style={{ flex: "1 1 0", minWidth: 0, boxSizing: "border-box", padding: `${Math.round(cellPadV * 1.08)}px ${cellPadH}px`, fontFamily: bodyFont, fontWeight: 700, fontSize: headerFontSize, letterSpacing: "0.08em", textTransform: "uppercase", color: ink, borderRight: cellBorder(ci), whiteSpace: "normal", overflowWrap: "break-word", wordBreak: "break-word", lineHeight: 1.2, textAlign: ci > 0 ? "right" : "left", display: "flex", alignItems: "center", justifyContent: ci > 0 ? "flex-end" : "flex-start" }}>
                    {hdr}
                  </div>
                ))}
              </div>
            )}

            <div style={{ flex: fewRows ? "0 1 auto" : "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start", overflow: "hidden" }}>
              {rawRows.length > 0
                ? rawRows.map((row, ri) => (
                    <div key={ri} style={{ flex: fewRows ? `0 0 ${naturalRowHeight}px` : "1 1 0", minHeight: 0, display: "flex", flexDirection: "row", alignItems: "stretch", background: ri % 2 === 1 ? "rgba(192,20,60,0.05)" : "transparent", borderBottom: ri < rawRows.length - 1 ? `1px solid ${GRID_STROKE}` : "none", opacity: rowOpacity(ri) }}>
                      {Array.from({ length: nCols }).map((_, ci) => {
                        const cellRaw = row[ci] ?? "";
                        const isHL = ci === hlColIndex;
                        const hlStyle = isHL ? highlightCellColor(cellRaw) : undefined;
                        return (
                          <div key={ci} style={{ flex: "1 1 0", minWidth: 0, boxSizing: "border-box", padding: `${cellPadV}px ${cellPadH}px`, fontFamily: bodyFont, fontWeight: hlStyle?.bold ? 700 : ci === 0 ? 600 : 400, fontSize: cellFontSize, letterSpacing: "0.01em", lineHeight: 1.38, color: hlStyle ? hlStyle.color : ink, borderRight: cellBorder(ci), whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word", textAlign: ci > 0 ? "right" : "left", fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", justifyContent: ci > 0 ? "flex-end" : "flex-start" }}>
                            <span style={{ maxWidth: "100%" }}>{cellRaw}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))
                : null}
              {rawRows.length === 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: `${Math.round(height * 0.04)}px`, fontFamily: bodyFont, fontSize: descSize, color: INK_DIM, fontStyle: "italic" }}>
                  No entries — add data by editing this scene
                </div>
              )}
            </div>
          </div>
          {vineW > 0 && vineH > 0 && (
            <SakuraVineFrame
              width={vineW}
              height={vineH}
              grow={vineGrow}
              blossomColor={SAKURA.blush}
              blossomCenter={SAKURA.deepBlush}
              blossomCount={p ? 58 : 52}
              blossomR={p ? 16 : 14}
              seed={41}
            />
          )}
          </div>
        </div>

        {(tickerFootnote || narration) && (
          <div style={{ opacity: footnoteA, flexShrink: 0, marginTop: Math.round(height * 0.012), fontFamily: bodyFont, fontStyle: "italic", fontWeight: 400, fontSize: Math.round(descSize * 0.88), letterSpacing: "0.02em", color: INK_DIM, lineHeight: 1.4, whiteSpace: "normal", textAlign: "center" }}>
            {tickerFootnote || narration}
          </div>
        )}
      </div>
    </SakuraScene>
  );
};
