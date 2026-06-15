import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneLayoutProps } from "../types";

const HAND_FONT = "'Patrick Hand', system-ui, sans-serif";

const MAX_ROWS = 20;
const MAX_COLS = 6;
const POSITIVE_COLOR = "#4ADE80";
const NEGATIVE_COLOR = "#F87171";
const GRID_LINE = "rgba(255,255,255,0.10)";

const STARS = Array.from({ length: 46 }).map((_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12543.227;
  return {
    x: (a - Math.floor(a)) * 100,
    y: (b - Math.floor(b)) * 100,
    r: 0.5 + ((a - Math.floor(a)) * 1.4),
  };
});

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

export const Stickman2TickerTable: React.FC<SceneLayoutProps> = ({
  title = "Key Figures",
  narration,
  accentColor = "#00E5FF",
  bgColor = "#000000",
  textColor = "#FFFFFF",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  tickerTable,
  tickerTitle,
  tickerFootnote,
  tickerHighlightCol,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const font = fontFamily ?? HAND_FONT;

  const titleSize = titleFontSize ?? (p ? 76 : 72);
  const descSize = descriptionFontSize ?? (p ? 36 : 37);

  const rawHeaders = (tickerTable?.headers ?? []).slice(0, MAX_COLS);
  const rawRows = (tickerTable?.rows ?? []).slice(0, MAX_ROWS).map((r) => (r ?? []).slice(0, MAX_COLS));
  const colCount = Math.max(rawHeaders.length, rawRows.reduce((m, r) => Math.max(m, r.length), 0), 1);
  const rowCount = rawRows.length;
  const hlCol = typeof tickerHighlightCol === "number" && tickerHighlightCol >= 0 && tickerHighlightCol < colCount ? tickerHighlightCol : -1;
  const hasData = rowCount > 0;

  const densityTier = rowCount <= 10 ? 0 : rowCount <= 16 ? 1 : 2;
  const fewRows = rowCount <= 6;
  const fewCols = colCount <= 4;

  const cellFontSize = (() => {
    const colTier = colCount <= 3 ? 0 : colCount <= 5 ? 1 : 2;
    const tier = Math.max(densityTier, colTier);
    const base = p ? 40 : 36;
    return Math.round(base * [1, 0.95, 0.9][tier]);
  })();
  const headerFontSize = Math.round(cellFontSize * 0.88);
  const cellPadV = (p ? [14, 11, 9] : [12, 10, 8])[densityTier];
  const cellPadH = colCount <= 4 ? 14 : 10;
  const naturalRowH = Math.round(cellFontSize * 1.6 + cellPadV * 2);

  const tableWidthCap = colCount <= 2 ? (p ? "72%" : "56%") : colCount === 3 ? (p ? "88%" : "72%") : colCount === 4 ? (p ? "96%" : "86%") : "100%";

  const titleOp = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const headerOp = interpolate(frame, [4, 20], [0, 1], { extrapolateRight: "clamp" });
  const footnoteOp = interpolate(frame, [20 + rowCount * 8, 20 + rowCount * 8 + 16], [0, 1], { extrapolateRight: "clamp" });

  function rowOp(i: number) {
    const delay = 20 + i * 8;
    return interpolate(frame, [delay, delay + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  }

  const cellBorder = (ci: number) => ci < colCount - 1 ? `1px solid ${GRID_LINE}` : "none";

  // ── Stickman animations (distinct from the Whiteboard ticker) ─────────────
  const stickOp = interpolate(frame, [12, 30], [0, 1], { extrapolateRight: "clamp" });

  // Landscape: bouncing a cricket ball off the ground and catching it.
  // One full cycle = throw down → ball hits ground → bounces back up → caught.
  const BOUNCE_LEN = 34;                                // frames per throw cycle
  const bc = (frame % BOUNCE_LEN) / BOUNCE_LEN;         // 0..1 within a cycle
  const HAND_Y = 118, GROUND_Y = 252, BALL_R = 9;
  // Ball rests in the hand at cycle ends, reaches the ground exactly at mid-cycle.
  // sin(bc·π): 0 at ends (hand) → 1 at middle (ground). Ball bottom touches floor.
  const groundContact = Math.sin(bc * Math.PI);        // 0..1, peaks at impact
  const ballY = HAND_Y + (GROUND_Y - BALL_R - HAND_Y) * groundContact;
  const ballSpin = frame * 16;                          // degrees, ball rotation
  // "Impact": sharp spike right when the ball meets the ground (groundContact≈1).
  const impact = Math.pow(Math.max(0, groundContact - 0.82) / 0.18, 1.5); // 0..1, brief
  // Ball squashes flat at the moment of contact.
  const ballSquashX = 1 + impact * 0.45;
  const ballSquashY = 1 - impact * 0.4;
  // Throwing/catching arm: extended down while the ball is near the hand
  // (start/end of cycle), tucked up while the ball is mid-air near the ground.
  const nearHand = Math.pow(Math.cos(bc * Math.PI), 2); // ~1 at ends, 0 at middle
  const armReach = nearHand;                            // 0..1 hand drops to meet ball
  const bodyBob = -nearHand * 3;                        // tiny dip on catch/throw

  // Portrait: two stickmen facing each other, chatting and gesturing.
  // They take turns "speaking"; each speaker's arm gestures more actively.
  const convoPhase = frame / 10;
  const leftSpeak = (Math.sin(frame / 26) + 1) / 2;     // 0..1, left is talking
  const rightSpeak = 1 - leftSpeak;                     // right talks when left rests
  const leftArm = Math.sin(convoPhase) * 16 * (0.4 + 0.6 * leftSpeak);   // deg
  const rightArm = Math.sin(convoPhase + 1.4) * 16 * (0.4 + 0.6 * rightSpeak);
  const leftHeadNod = Math.sin(frame / 12) * 3 * leftSpeak;
  const rightHeadNod = Math.sin(frame / 12 + 2) * 3 * rightSpeak;
  // Speech bubble dots pulse for whoever is currently talking.
  const leftBubble = Math.max(0, leftSpeak - 0.45) / 0.55;   // 0..1
  const rightBubble = Math.max(0, rightSpeak - 0.45) / 0.55;

  // Landscape: stickman bouncing a cricket ball off the ground and catching it.
  // The throwing hand drops down toward the ball as it returns, then lifts.
  const handX = 30;                                       // x of the throwing hand
  const handYNow = 118 + (1 - armReach) * -10;            // hand lifts a touch mid-air
  const PlayingStickman = (
    <svg viewBox="0 0 120 300" style={{ width: "100%", height: "auto", maxHeight: "82%", opacity: stickOp }} fill="none">
      {/* ground line the ball strikes */}
      <line x1={10} y1={GROUND_Y} x2={110} y2={GROUND_Y} stroke={textColor} strokeWidth={3} strokeOpacity={0.25} />
      {/* impact mark on the ground — flares only at the moment of contact */}
      <ellipse cx={handX} cy={GROUND_Y} rx={14 + impact * 10} ry={4} fill={accentColor} opacity={0.08 + impact * 0.4} />
      {/* radiating impact burst lines */}
      <g stroke={accentColor} strokeWidth={2.4} strokeLinecap="round" opacity={impact}>
        <line x1={handX - 8} y1={GROUND_Y - 4} x2={handX - 8 - impact * 14} y2={GROUND_Y - 10 - impact * 8} />
        <line x1={handX + 8} y1={GROUND_Y - 4} x2={handX + 8 + impact * 14} y2={GROUND_Y - 10 - impact * 8} />
        <line x1={handX} y1={GROUND_Y - 6} x2={handX} y2={GROUND_Y - 12 - impact * 12} />
      </g>

      <g transform={`translate(0, ${bodyBob})`}>
        {/* head, looking down at the ball */}
        <circle cx={64} cy={48} r={26} stroke={textColor} strokeWidth={5} />
        <circle cx={52} cy={52} r={3.2} fill={textColor} />
        <path d="M44,58 Q50,62 56,59" stroke={textColor} strokeWidth={3} fill="none" strokeLinecap="round" />
        {/* neck + body */}
        <line x1={64} y1={74} x2={64} y2={196} stroke={textColor} strokeWidth={5} strokeLinecap="round" />
        {/* back arm tucked for balance */}
        <path d="M64,112 L84,150" stroke={textColor} strokeWidth={5} fill="none" strokeLinecap="round" />
        {/* throwing/catching arm: shoulder (64,108) → elbow → hand that tracks the ball */}
        <path d={`M64,108 L46,118 L${handX},${handYNow}`} stroke={textColor} strokeWidth={5} fill="none" strokeLinecap="round" />
        {/* legs */}
        <path d="M64,196 L50,288" stroke={textColor} strokeWidth={5} strokeLinecap="round" />
        <path d="M64,196 L80,288" stroke={textColor} strokeWidth={5} strokeLinecap="round" />
      </g>

      {/* cricket ball: thrown down, bounces off the ground, returns to the hand.
          On contact it squashes flat, with the bottom edge pinned to the floor. */}
      <g transform={`translate(${handX}, ${ballY + BALL_R * (1 - ballSquashY)}) scale(${ballSquashX}, ${ballSquashY})`}>
        <g transform={`rotate(${ballSpin}, 0, 0)`}>
          <circle cx={0} cy={0} r={BALL_R} fill={accentColor} stroke={textColor} strokeWidth={2} />
          {/* seam lines */}
          <path d="M-9,-2 Q0,3 9,-2" stroke={bgColor} strokeWidth={1.6} fill="none" />
          <path d="M-9,2 Q0,7 9,2" stroke={bgColor} strokeWidth={1.6} fill="none" opacity={0.6} />
        </g>
      </g>
    </svg>
  );

  // Portrait: two stickmen facing each other, talking and gesturing.
  const ConversingStickmen = (
    <svg viewBox="0 0 320 210" style={{ width: "100%", height: "auto", opacity: stickOp }} fill="none">
      {/* ground glows */}
      <ellipse cx={96} cy={202} rx={34} ry={5} fill={accentColor} opacity={0.14} />
      <ellipse cx={224} cy={202} rx={34} ry={5} fill={accentColor} opacity={0.14} />

      {/* ── LEFT figure (faces right) ── */}
      <g>
        {/* speech bubble dots when speaking */}
        <g opacity={leftBubble}>
          <circle cx={132} cy={34} r={3} fill={accentColor} />
          <circle cx={144} cy={30} r={4} fill={accentColor} />
          <circle cx={158} cy={28} r={5} fill={accentColor} />
        </g>
        <g transform={`rotate(${leftHeadNod}, 96, 60)`}>
          <circle cx={96} cy={60} r={20} stroke={textColor} strokeWidth={5} />
          {/* face on the right side, looking at the other figure */}
          <circle cx={108} cy={58} r={2.6} fill={textColor} />
          <path d="M104,68 Q110,72 116,68" stroke={textColor} strokeWidth={3} fill="none" strokeLinecap="round" />
        </g>
        {/* neck + body */}
        <line x1={96} y1={80} x2={96} y2={158} stroke={textColor} strokeWidth={5} strokeLinecap="round" />
        {/* far arm at side */}
        <path d="M96,104 L82,140" stroke={textColor} strokeWidth={5} fill="none" strokeLinecap="round" />
        {/* gesturing arm toward the other figure (hinged at shoulder 96,104) */}
        <g transform={`rotate(${leftArm}, 96, 104)`}>
          <path d="M96,104 L120,118 L138,112" stroke={textColor} strokeWidth={5} fill="none" strokeLinecap="round" />
          <circle cx={138} cy={112} r={4.5} stroke={accentColor} strokeWidth={3} fill={bgColor} />
        </g>
        {/* legs */}
        <path d="M96,158 L82,196" stroke={textColor} strokeWidth={5} strokeLinecap="round" />
        <path d="M96,158 L110,196" stroke={textColor} strokeWidth={5} strokeLinecap="round" />
      </g>

      {/* ── RIGHT figure (faces left) ── */}
      <g>
        <g opacity={rightBubble}>
          <circle cx={188} cy={34} r={3} fill={accentColor} />
          <circle cx={176} cy={30} r={4} fill={accentColor} />
          <circle cx={162} cy={28} r={5} fill={accentColor} />
        </g>
        <g transform={`rotate(${rightHeadNod}, 224, 60)`}>
          <circle cx={224} cy={60} r={20} stroke={textColor} strokeWidth={5} />
          {/* face on the left side, looking at the other figure */}
          <circle cx={212} cy={58} r={2.6} fill={textColor} />
          <path d="M204,68 Q210,72 216,68" stroke={textColor} strokeWidth={3} fill="none" strokeLinecap="round" />
        </g>
        {/* neck + body */}
        <line x1={224} y1={80} x2={224} y2={158} stroke={textColor} strokeWidth={5} strokeLinecap="round" />
        {/* far arm at side */}
        <path d="M224,104 L238,140" stroke={textColor} strokeWidth={5} fill="none" strokeLinecap="round" />
        {/* gesturing arm toward the other figure (hinged at shoulder 224,104) */}
        <g transform={`rotate(${-rightArm}, 224, 104)`}>
          <path d="M224,104 L200,118 L182,112" stroke={textColor} strokeWidth={5} fill="none" strokeLinecap="round" />
          <circle cx={182} cy={112} r={4.5} stroke={accentColor} strokeWidth={3} fill={bgColor} />
        </g>
        {/* legs */}
        <path d="M224,158 L210,196" stroke={textColor} strokeWidth={5} strokeLinecap="round" />
        <path d="M224,158 L238,196" stroke={textColor} strokeWidth={5} strokeLinecap="round" />
      </g>
    </svg>
  );

  const tableColumn = (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: 0 }}>
        {/* Title block */}
        <div style={{ opacity: titleOp, flexShrink: 0, marginBottom: Math.round(height * 0.022), alignSelf: fewCols ? "center" : "stretch", textAlign: fewCols ? "center" : "left", width: tableWidthCap, maxWidth: "100%" }}>
          <div style={{ fontFamily: font, fontWeight: 700, fontSize: titleSize, lineHeight: 1.1, color: textColor, textShadow: `0 0 20px ${accentColor}55` }}>
            {title}
          </div>
          {tickerTitle && (
            <div style={{ fontFamily: font, fontWeight: 500, fontSize: descSize - 4, color: accentColor, opacity: 0.8, marginTop: 6 }}>
              {tickerTitle}
            </div>
          )}
        </div>

        {/* Table */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: fewCols ? "center" : "stretch", justifyContent: fewRows ? "center" : "flex-start" }}>
          <div style={{ alignSelf: fewCols ? "center" : "stretch", width: tableWidthCap, maxWidth: "100%", flex: fewRows ? "0 1 auto" : "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", borderRadius: 8, overflow: "hidden", background: "rgba(255,255,255,0.06)", border: `1px solid rgba(255,255,255,0.12)`, backdropFilter: "blur(12px)" }}>
            {!hasData ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "8%", fontFamily: font, fontSize: descSize, color: textColor, opacity: 0.4, fontStyle: "italic" }}>
                No data — add a table by editing this scene
              </div>
            ) : (
              <>
                {rawHeaders.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "row", flexShrink: 0, background: `rgba(255,255,255,0.10)`, borderBottom: `1px solid ${accentColor}44`, opacity: headerOp }}>
                    {rawHeaders.map((hdr, ci) => (
                      <div key={ci} style={{ flex: "1 1 0", minWidth: 0, boxSizing: "border-box", padding: `${Math.round(cellPadV * 1.1)}px ${cellPadH}px`, fontFamily: font, fontWeight: 700, fontSize: headerFontSize, letterSpacing: "0.08em", textTransform: "uppercase", color: accentColor, borderRight: ci < colCount - 1 ? `1px solid rgba(255,255,255,0.08)` : "none", textAlign: ci > 0 ? "right" : "left", display: "flex", alignItems: "center", justifyContent: ci > 0 ? "flex-end" : "flex-start" }}>
                        {hdr}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ flex: fewRows ? "0 1 auto" : "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start", overflow: "hidden" }}>
                  {rawRows.map((row, ri) => (
                    <div key={ri} style={{ flex: fewRows ? `0 0 ${naturalRowH}px` : "1 1 0", minHeight: 0, display: "flex", flexDirection: "row", alignItems: "stretch", borderBottom: ri < rowCount - 1 ? `1px solid ${GRID_LINE}` : "none", opacity: rowOp(ri), background: ri % 2 === 1 ? "rgba(255,255,255,0.03)" : "transparent" }}>
                      {Array.from({ length: colCount }).map((_, ci) => {
                        const cellRaw = row[ci] ?? "";
                        const hlStyle = ci === hlCol ? highlightCell(cellRaw) : undefined;
                        return (
                          <div key={ci} style={{ flex: "1 1 0", minWidth: 0, boxSizing: "border-box", padding: `${cellPadV}px ${cellPadH}px`, fontFamily: font, fontWeight: hlStyle?.bold ? 700 : ci === 0 ? 600 : 400, fontSize: cellFontSize, lineHeight: 1.4, color: hlStyle ? hlStyle.color : textColor, borderRight: cellBorder(ci), textAlign: ci > 0 ? "right" : "left", fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", justifyContent: ci > 0 ? "flex-end" : "flex-start" }}>
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
        </div>

        {/* Footnote */}
        {(tickerFootnote || narration) && (
          <div style={{ opacity: footnoteOp * 0.55, flexShrink: 0, marginTop: Math.round(height * 0.014), fontFamily: font, fontStyle: "italic", fontSize: Math.round(descSize * 0.82), color: textColor, lineHeight: 1.4 }}>
            {tickerFootnote || narration}
          </div>
        )}
    </div>
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: font, background: bgColor }}>
      {/* Starfield */}
      {STARS.map((s, i) => (
        <div key={i} style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, width: s.r * 2, height: s.r * 2, borderRadius: "50%", background: "#fff", opacity: 0.35 + (s.r * 0.15) }} />
      ))}
      {/* Subtle vignette */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.5) 100%)" }} />

      {p ? (
        /* ── PORTRAIT: table on top, two stickmen chatting below ── */
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "8% 7%", gap: 0, zIndex: 10 }}>
          {tableColumn}
          <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", alignItems: "flex-start", marginTop: -2 }}>
            <div style={{ width: "52%", maxWidth: 340 }}>{ConversingStickmen}</div>
          </div>
        </div>
      ) : (
        /* ── LANDSCAPE: table left 90%, ball-bouncing stickman right 10% ── */
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "row", alignItems: "stretch", padding: "5% 4% 5% 7%", gap: 0, zIndex: 10 }}>
          <div style={{ flexBasis: "90%", flexGrow: 0, flexShrink: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {tableColumn}
          </div>
          <div style={{ flexBasis: "10%", flexGrow: 0, flexShrink: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingLeft: 8 }}>
            {PlayingStickman}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
