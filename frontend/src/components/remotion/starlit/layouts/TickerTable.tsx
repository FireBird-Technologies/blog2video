import React from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { GRID_BUILD_CONTENT_DELAY } from "../components/SceneTransition";
import { SpaceBackdrop } from "../components/SpaceBackdrop";
import { FitText } from "../components/FitText";
import { useFitText } from "../components/useFitText";
import type { SceneLayoutProps } from "../types";
import { getStarlitFontFamily, getStarlitTypography } from "../typography";
import { mixTheme, withOpacity } from "../components/themeColor";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const alpha = withOpacity;
const numeric = (value: string) => Number.parseFloat(value.replace(/[^0-9+.\-]/g, ""));

const TickerTableScene: React.FC<SceneLayoutProps> = (props) => {
  const thTxt = props.textColor || "#ffffff"; const thBg = props.bgColor || "#000000"; const thAcc = props.accentColor || "#217cff"; const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portrait = props.aspectRatio === "portrait" || height > width;
  const unit = Math.min(width, height) / 1080;
  const type = getStarlitTypography({
    ...props,
    titleFontSize: props.titleFontSize ?? (portrait ? 104 : 72),
    descriptionFontSize: props.descriptionFontSize ?? (portrait ? 58 : 48),
  }, portrait);
  const font = getStarlitFontFamily(props);
  const accent = props.accentColor || "#217cff";
  const text = props.textColor || "#ffffff";
  const headers = (props.tickerTable?.headers || []).slice(0, 6);
  const rows = (props.tickerTable?.rows || []).slice(0, 20).map((row) => row.slice(0, 6));
  const colCount = Math.max(1, headers.length, ...rows.map((row) => row.length));
  const highlight = typeof props.tickerHighlightCol === "number" ? props.tickerHighlightCol : -1;
  const titleIn = interpolate(frame, [6, 26], [0, 1], clamp);
  const frameIn = interpolate(frame, [0, 24], [0, 1], clamp);
  const headerIn = interpolate(frame, [4, 22], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  // Same living atmosphere as the Cosmic Hero planet rim: crisp line over breathing blue glow.
  const rimShimmer = (.68 + Math.sin(frame * .055) * .10) / .68;
  const densityScale = rows.length > 16 ? .46 : rows.length > 11 ? .56 : rows.length > 7 ? .68 : .9;
  const titleSize = type.titleIsUserSet ? type.title : Math.min(portrait ? 76 : 72, Math.max(type.title * .76, portrait ? 58 : 54));
  const rowFont = type.bodyIsUserSet
    ? type.body
    : Math.min(
      portrait ? 48 : 54,
      Math.max(type.body * densityScale, portrait ? (rows.length > 12 ? 23 : 36) : (rows.length > 12 ? 21 : 34)),
    );
  const headerFont = type.bodyIsUserSet ? type.body : Math.min(portrait ? 30 : 28, Math.max(rowFont * .56, portrait ? 21 : 20));
  const cellPadH = portrait ? (colCount > 4 ? 12 : 22) : 30;
  const wideFit = portrait && colCount > 4 ? .7 : 1; // many columns on a tall canvas: smaller cells so nothing is cut off
  const headerHeight = portrait ? 66 : 52;
  const idealRowHeight = portrait
    ? (rows.length <= 4 ? 130 : rows.length <= 7 ? 100 : 78)
    : (rows.length <= 4 ? 92 : rows.length <= 7 ? 70 : 54);
  const tableHeight = Math.min(
    height * (portrait ? .62 : .64),
    headerHeight + Math.max(1, rows.length) * idealRowHeight,
  );
  // A few of the constellation's brightest nodes remain attached to the
  // rounded perimeter, making the completed table feel like its final form.
  const borderStars = [
    { x: 1.2, y: 6.5, size: 3.2, phase: .1 }, { x: 8, y: 0, size: 1.8, phase: .8 },
    { x: 22, y: 0, size: 2.4, phase: 1.4 }, { x: 39, y: 0, size: 1.5, phase: 2 },
    { x: 56, y: 0, size: 2.1, phase: 2.6 }, { x: 73, y: 0, size: 1.6, phase: 3.2 },
    { x: 91, y: 0, size: 2.5, phase: 3.8 }, { x: 98.8, y: 7.5, size: 3, phase: 4.4 },
    { x: 100, y: 28, size: 1.7, phase: 5 }, { x: 100, y: 52, size: 2.2, phase: 5.6 },
    { x: 100, y: 76, size: 1.6, phase: 6.2 }, { x: 98.7, y: 92, size: 3, phase: .5 },
    { x: 86, y: 100, size: 1.8, phase: 1.1 }, { x: 68, y: 100, size: 2.4, phase: 1.7 },
    { x: 50, y: 100, size: 1.5, phase: 2.3 }, { x: 31, y: 100, size: 2, phase: 2.9 },
    { x: 12, y: 100, size: 1.7, phase: 3.5 }, { x: 1.3, y: 92, size: 2.8, phase: 4.1 },
    { x: 0, y: 66, size: 1.8, phase: 4.7 }, { x: 0, y: 35, size: 2.1, phase: 5.3 },
  ];
  // The table keeps its drafted grid: column and row lines in the accent colour, with a small star
  // where lines cross, matching the build-in transition (and handing off from it without a jump).
  const colWeights = colCount === 3 ? [portrait ? 1.25 : 1.35, 1, 1] : Array.from({ length: colCount }, (_, i) => (i === 0 && colCount > 3 ? 1.6 : 1));
  const wSum = colWeights.reduce((a, b) => a + b, 0);
  const colFrac: number[] = [];
  colWeights.reduce((acc, w) => { colFrac.push(acc / wSum); return acc + w; }, 0);
  const innerCols = colFrac.slice(1); // inner dividers only
  const bodyRowH = (tableHeight - headerHeight) / Math.max(1, rows.length);
  const rowLineY = [headerHeight, ...Array.from({ length: Math.max(0, rows.length - 1) }, (_, i) => headerHeight + bodyRowH * (i + 1))];
  const xsPct = [0, ...innerCols, 1];
  const ysPx = [0, ...rowLineY, tableHeight];
  const gridIn = interpolate(frame, [14, 46], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const gridTwinkle = (i: number) => .8 + .2 * Math.sin(frame / 30 * 1.8 + i * 1.3);
  const gridColumns = colCount === 3
    ? `${portrait ? 1.25 : 1.35}fr 1fr 1fr`
    : `${colCount > 3 ? 1.6 : 1}fr repeat(${Math.max(0, colCount - 1)}, minmax(0, 1fr))`;
  const headerMeasureRef = React.useRef<HTMLDivElement>(null);
  const cellMeasureRef = React.useRef<HTMLDivElement>(null);
  const longestHeader = [...headers].sort((a, b) => String(b).length - String(a).length)[0] || "";
  const longestCell = rows.flat().map(String).sort((a, b) => b.length - a.length)[0] || "";
  const tableContentWidth = width * (portrait ? .90 : .82);
  const smallestCellWidth = Math.max(24, tableContentWidth * (Math.min(...colWeights) / wSum) - cellPadH * 2);
  const headerTarget = type.bodyIsUserSet ? headerFont : headerFont * .78 * wideFit;
  const cellTarget = type.bodyIsUserSet ? rowFont : rowFont * .72 * wideFit;
  const headerFit = useFitText(headerMeasureRef, headerTarget, type.bodyIsUserSet ? headerTarget : 10, [longestHeader, headerTarget, type.bodyIsUserSet, smallestCellWidth], headerHeight * .75, smallestCellWidth);
  const cellFit = useFitText(cellMeasureRef, cellTarget, type.bodyIsUserSet ? cellTarget : 11, [longestCell, cellTarget, type.bodyIsUserSet, smallestCellWidth, bodyRowH], bodyRowH * .78, smallestCellWidth);

  return (
    <AbsoluteFill style={{ background: "transparent", color: text, fontFamily: font, overflow: "hidden" }}>
      <div ref={headerMeasureRef} aria-hidden style={{position: "absolute", visibility: "hidden", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: portrait && colCount > 4 ? ".1em" : ".22em", fontWeight: 500}}>{longestHeader}</div>
      <div ref={cellMeasureRef} aria-hidden style={{position: "absolute", visibility: "hidden", whiteSpace: "nowrap", letterSpacing: ".01em", fontWeight: 500}}>{longestCell}</div>
      <div style={{ position: "absolute", inset: portrait ? "8% 5%" : "8% 9%", display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 0 }}>
        <FitText targetPx={titleSize} minPx={portrait ? 30 : 28} maxHeightPx={height * .14} fitKey={`ticker-title:${props.title || ""}:${portrait}`} exact={type.titleIsUserSet} style={{ flexShrink: 0, marginBottom: portrait ? 36 : 30, textAlign: portrait ? "center" : "left", opacity: titleIn, transform: `translateY(${(1 - titleIn) * 22}px)`, color: text, lineHeight: 1.04, fontWeight: 560, letterSpacing: "-.03em" }}>
          {props.title || ""}
        </FitText>

        {rows.length === 0 && headers.length === 0 ? null : <div style={{ position: "relative", flex: `0 0 ${tableHeight}px`, minHeight: 0, width: "100%", display: "flex", flexDirection: "column", borderRadius: portrait ? 24 : 18, border: `1px solid ${accent}`, background: alpha(mixTheme(thBg,thAcc,.1), .9), boxShadow: `0 0 8px ${alpha(accent, .55 * rimShimmer)}, 0 0 34px ${alpha(accent, .2 * rimShimmer)}, 0 0 80px ${alpha(accent, .09 * rimShimmer)}, inset 0 0 0 1px ${withOpacity(thTxt,.2)}, inset 0 0 40px ${alpha(accent, .06)}`, overflow: "visible", opacity: frameIn, transform: `scale(${.985 + frameIn * .015})` }}>
          <svg style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none", zIndex: 2, opacity: gridIn }}>
            {innerCols.map((f, i) => <line key={`cv${i}`} x1={`${f * 100}%`} y1={0} x2={`${f * 100}%`} y2={tableHeight} stroke={accent} strokeWidth="1.2" opacity=".5" />)}
            <line x1="0" y1={headerHeight} x2="100%" y2={headerHeight} stroke={accent} strokeWidth="1.3" opacity=".7" />
            {rowLineY.slice(1).map((y, i) => <line key={`rh${i}`} x1="0" y1={y} x2="100%" y2={y} stroke={accent} strokeWidth="1" opacity=".4" />)}
            {ysPx.flatMap((y, yi) => xsPct.map((f, xi) => {
              const corner = (xi === 0 || xi === xsPct.length - 1) && (yi === 0 || yi === ysPx.length - 1);
              return <g key={`n${xi}-${yi}`} opacity={gridTwinkle(xi * 7 + yi)}>
                <circle cx={`${f * 100}%`} cy={y} r={corner ? 11 : 7} fill={accent} opacity=".24" />
                <circle cx={`${f * 100}%`} cy={y} r={corner ? 3.6 : 2.4} fill={thPale} />
              </g>;
            }))}
          </svg>
          {headers.length > 0 && <div style={{ opacity: headerIn, transform: `translateX(${(1 - headerIn) * -70}px)`, display: "grid", gridTemplateColumns: gridColumns, minHeight: headerHeight, borderBottom: `1px solid ${alpha("${thTxt}", .12)}`, flexShrink: 0 }}>
            {Array.from({ length: colCount }).map((_, index) => <div key={index} style={{ padding: `0 ${cellPadH}px`, color: index === highlight ? accent : alpha(text, .5), fontSize: headerFit.px, fontWeight: 500, letterSpacing: portrait && colCount > 4 ? ".1em" : ".22em", textTransform: "uppercase", textAlign: index ? "right" : "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", justifyContent: index ? "flex-end" : "flex-start" }}>{headers[index] || `Field ${index + 1}`}</div>)}
          </div>}
          <div style={{ display: "flex", flexDirection: "column", flex: "1 1 0", minHeight: 0 }}>
            {rows.map((row, rowIndex) => {
              const rowIn = interpolate(frame, [14 + rowIndex * 5, 30 + rowIndex * 5], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
              return <div key={rowIndex} style={{ display: "grid", gridTemplateColumns: gridColumns, flex: "1 1 0", minHeight: 0, borderBottom: rowIndex < rows.length - 1 ? `1px solid ${alpha("${thTxt}", .07)}` : "none", opacity: rowIn, transform: `translateX(${(1 - rowIn) * -70}px)` }}>
                {Array.from({ length: colCount }).map((_, colIndex) => {
                  const value = String(row[colIndex] ?? "");
                  const n = numeric(value);
                  const isHot = colIndex === highlight && Number.isFinite(n);
                  // Negative changes stay a fixed red on purpose: red reads as a loss whatever the palette.
                  const color = isHot ? (n < 0 ? "#ff6d8a" : n > 0 ? accent : text) : (colIndex === 0 ? alpha(text, .96) : alpha(text, .68));
                  return <div key={colIndex} style={{ padding: `0 ${cellPadH}px`, fontSize: cellFit.px, lineHeight: 1.16, fontWeight: colIndex === 0 ? 500 : isHot ? 500 : 400, letterSpacing: colIndex === 0 ? "-.01em" : ".01em", color, textAlign: colIndex ? "right" : "left", fontVariantNumeric: "tabular-nums", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", justifyContent: colIndex ? "flex-end" : "flex-start" }}>{value}</div>;
                })}
              </div>;
            })}
          </div>
          {borderStars.map((star, index) => {
            const pulse = .76 + Math.sin(frame * .09 + star.phase) * .24;
            const core = star.size * unit;
            return <div key={index} style={{ position: "absolute", left: `${star.x}%`, top: `${star.y}%`, width: core, height: core, borderRadius: "50%", background: text, opacity: frameIn * (.72 + pulse * .28), transform: `translate(-50%, -50%) scale(${.88 + pulse * .18})`, boxShadow: `0 0 ${core * 3}px ${text}, 0 0 ${core * 8}px ${alpha(accent, .5 * pulse)}`, zIndex: 4 }}>
              <div style={{ position: "absolute", left: -core * 2.2, top: core * .39, width: core * 5.4, height: Math.max(.55, unit * .65), background: accent, opacity: .5 * pulse }} />
              <div style={{ position: "absolute", left: core * .39, top: -core * 3, width: Math.max(.55, unit * .65), height: core * 7, background: accent, opacity: .5 * pulse }} />
            </div>;
          })}
        </div>}
      </div>
    </AbsoluteFill>
  );
};

/** The real table starts as the constellation settles into its responsive grid geometry. */
export const TickerTable: React.FC<SceneLayoutProps> = (props) => {
  const thTxt = props.textColor || "#ffffff"; const thBg = props.bgColor || "#000000"; const thAcc = props.accentColor || "#217cff"; const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const { width, height } = useVideoConfig();
  const portrait = props.aspectRatio === "portrait" || height > width;
  const duration = props.sceneDurationInFrames ?? 150;
  return (
    <AbsoluteFill style={{ background: props.bgColor || "#000" }}>
      <SpaceBackdrop seed={props.seed ?? 244} density={portrait ? 170 : 205} dustDensity={42} accentColor={props.accentColor || "#217cff"} backgroundColor={props.bgColor || "#000000"} textColor={props.textColor || "#ffffff"} />
      <Sequence from={GRID_BUILD_CONTENT_DELAY} layout="none">
        <TickerTableScene {...props} sceneDurationInFrames={Math.max(60, duration - GRID_BUILD_CONTENT_DELAY)} />
      </Sequence>
    </AbsoluteFill>
  );
};
