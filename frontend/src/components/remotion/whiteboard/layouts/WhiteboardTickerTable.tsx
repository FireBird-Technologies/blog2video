import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";

const HAND_FONT = "'Patrick Hand', system-ui, sans-serif";
const PAPER_PANEL = "rgba(255,255,255,0.55)";
const MAX_ROWS = 20;
const MAX_COLS = 6;
const POSITIVE_COLOR = "#1E7A4C";
const NEGATIVE_COLOR = "#B83B3B";
const GRID_LINE = "rgba(31,41,55,0.14)";

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

export const WhiteboardTickerTable: React.FC<WhiteboardLayoutProps> = ({
  title = "Key Figures",
  narration,
  accentColor = "#FFB800",
  bgColor = "#FDFDF5",
  textColor = "#1a1a1a",
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

  const titleSize = titleFontSize ?? (p ? 62 : 56);
  const descSize = descriptionFontSize ?? (p ? 31 : 26);

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
    const base = p ? 30 : 26;
    return Math.round(base * [1, 0.95, 0.9][tier]);
  })();
  const headerFontSize = Math.round(cellFontSize * 0.88);
  const cellPadV = (p ? [14, 11, 9] : [12, 10, 8])[densityTier];
  const cellPadH = colCount <= 4 ? 14 : 10;
  const naturalRowH = Math.round(cellFontSize * 1.6 + cellPadV * 2);

  const tableWidthCap = colCount <= 2 ? (p ? "72%" : "56%") : colCount === 3 ? (p ? "88%" : "72%") : colCount === 4 ? (p ? "96%" : "86%") : "100%";

  const titleOp = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 16], [10, 0], { extrapolateRight: "clamp" });
  const ruleW = interpolate(frame, [4, 22], [0, 100], { extrapolateRight: "clamp" });
  const headerOp = interpolate(frame, [4, 20], [0, 1], { extrapolateRight: "clamp" });
  const footnoteOp = interpolate(frame, [20 + rowCount * 8, 20 + rowCount * 8 + 16], [0, 1], { extrapolateRight: "clamp" });

  function rowOp(i: number) {
    const delay = 20 + i * 8;
    return interpolate(frame, [delay, delay + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  }

  const cellBorder = (ci: number) => ci < colCount - 1 ? `1px solid ${GRID_LINE}` : "none";

  // Stickman entrance
  const stickOp = interpolate(frame, [12, 30], [0, 1], { extrapolateRight: "clamp" });

  // ── Football juggling (landscape) ─────────────────────────────────────────
  // One continuous phase drives everything; the two feet share it with a
  // half-cycle offset, so they alternate smoothly with no instant switch.
  const BOUNCE_LEN = 30;                                 // frames per bounce
  const phase = (frame / BOUNCE_LEN) * Math.PI;         // continuous, radians

  // A smooth "lift" pulse: a raised cosine that peaks once per cycle and
  // eases all the way to 0 between peaks. Each foot uses it, offset by π.
  const liftPulse = (ph: number) => {
    const c = Math.cos(ph);          // -1..1
    return Math.pow(Math.max(0, c), 1.6); // 0..1, smooth in & out, flat at rest
  };
  const leftKick = liftPulse(phase);            // left foot peaks at phase = 0, 2π…
  const rightKick = liftPulse(phase - Math.PI); // right foot peaks half a cycle later

  // The ball sits on whichever foot is currently up and arcs between touches.
  // blend: 0 = fully on left foot, 1 = fully on right foot — eased, not snapped.
  const blend = (1 - Math.cos(phase)) / 2;             // 0..1 smooth back & forth
  // Ball height: lowest (touching a foot) when either foot peaks; highest between.
  const ballLift = (1 - Math.max(leftKick, rightKick)) * 60;
  // Ball drifts smoothly between the two foot x-positions.
  const ballX = 28 + blend * 18;

  // Tiny body bob with the effort — dips whenever a foot is up.
  const juggleBob = -Math.max(leftKick, rightKick) * 4;
  const ballSpin = frame * 11;                          // degrees, ball rotation

  // Lifting stickman (portrait): gentle lift sway
  const liftBob = Math.sin(frame / 11) * 3;

  // Landscape: stickman juggling a football (keepie-uppie), facing left toward the ball.
  // Hips at (60,196). Each leg bends: when active, the knee rises and the foot
  // lifts forward to meet the falling ball; when planted, it stands on the ground.
  const hipX = 60, hipY = 196;
  // LEFT leg (forward/ball side). Planted: foot at (30,288). Active: knee up, foot to (26,~214).
  const lFootGroundY = 288, lFootUpY = 214;
  const lFootY = lFootGroundY - (lFootGroundY - lFootUpY) * leftKick;
  const lKneeX = 44 - 6 * leftKick, lKneeY = 244 - 18 * leftKick;
  const lFootX = 30 - 8 * leftKick;
  // RIGHT leg (back side). Planted: foot at (84,288). Active: knee up, foot to (36,~214).
  const rFootGroundY = 288, rFootUpY = 214;
  const rFootY = rFootGroundY - (rFootGroundY - rFootUpY) * rightKick;
  const rKneeX = 78 - 30 * rightKick, rKneeY = 244 - 22 * rightKick;
  const rFootX = 84 - 48 * rightKick;
  // Ball rests just above the raised foot (both feet lift to the same height).
  const restY = lFootUpY - 14;
  // Effort signal for arm balance (whichever foot is currently up).
  const effort = Math.max(leftKick, rightKick);

  const PointingStickman = (
    <svg viewBox="0 0 120 300" style={{ width: "100%", height: "auto", maxHeight: "80%", opacity: stickOp }} fill="none">
      {/* ground shadow */}
      <ellipse cx={64} cy={290} rx={34} ry={6} fill={textColor} opacity={0.12} />

      {/* upper body bobs slightly with each contact */}
      <g transform={`translate(0, ${juggleBob})`}>
        {/* head */}
        <circle cx={64} cy={48} r={26} stroke={textColor} strokeWidth={5} />
        {/* face on the left side of the head — facing the ball */}
        <circle cx={50} cy={48} r={3.2} fill={textColor} />
        <path d="M42,52 Q47,57 53,55" stroke={textColor} strokeWidth={3} fill="none" strokeLinecap="round" />
        {/* nose pointing left toward the ball */}
        <path d="M40,46 L46,49" stroke={textColor} strokeWidth={3} fill="none" strokeLinecap="round" />
        {/* neck */}
        <line x1={64} y1={74} x2={64} y2={88} stroke={textColor} strokeWidth={5} strokeLinecap="round" />
        {/* body, leaning slightly toward the ball */}
        <line x1={64} y1={88} x2={60} y2={196} stroke={textColor} strokeWidth={5} strokeLinecap="round" />
        {/* far arm (behind), tucked back for balance, sways a touch with the effort */}
        <path d={`M62,104 L82,128 L${92 - effort * 4},${120 - effort * 6}`} stroke={textColor} strokeWidth={5} fill="none" strokeLinecap="round" />
        {/* near arm out front for balance */}
        <path d={`M62,104 L42,124 L${30 + effort * 4},${118 + effort * 4}`} stroke={textColor} strokeWidth={5} fill="none" strokeLinecap="round" />
      </g>

      {/* RIGHT leg (drawn first = behind) */}
      <path d={`M${hipX},${hipY} L${rKneeX},${rKneeY} L${rFootX},${rFootY}`} stroke={textColor} strokeWidth={5} fill="none" strokeLinecap="round" />
      <path d={`M${rFootX},${rFootY} L${rFootX - 12},${rFootY - (rightKick > 0.1 ? 3 : -2)}`} stroke={textColor} strokeWidth={5} strokeLinecap="round" />

      {/* LEFT leg (forward / ball side) */}
      <path d={`M${hipX},${hipY} L${lKneeX},${lKneeY} L${lFootX},${lFootY}`} stroke={textColor} strokeWidth={5} fill="none" strokeLinecap="round" />
      <path d={`M${lFootX},${lFootY} L${lFootX - 12},${lFootY - (leftKick > 0.1 ? 3 : -2)}`} stroke={textColor} strokeWidth={5} strokeLinecap="round" />

      {/* football: arcs up from the active foot and falls back */}
      <g transform={`translate(${ballX}, ${restY - ballLift}) rotate(${ballSpin}, 0, 0)`}>
        <circle cx={0} cy={0} r={11} stroke={textColor} strokeWidth={4} fill={bgColor} />
        {/* pentagon/seams hint */}
        <circle cx={0} cy={0} r={3.4} fill={accentColor} />
        <path d="M0,-11 L0,-4 M-9.5,-5.5 L-3.2,-1.4 M9.5,-5.5 L3.2,-1.4 M-6,9 L-2.4,2.7 M6,9 L2.4,2.7" stroke={textColor} strokeWidth={2} strokeLinecap="round" />
      </g>
    </svg>
  );

  // Portrait: small stickman below the table, both arms raised lifting it.
  const LiftingStickman = (
    <svg viewBox="0 0 200 210" style={{ width: "100%", height: "auto", opacity: stickOp }} fill="none">
      {/* ground shadow */}
      <ellipse cx={100} cy={202} rx={42} ry={6} fill={textColor} opacity={0.12} />
      {/* head */}
      <circle cx={100} cy={58} r={20} stroke={textColor} strokeWidth={5} />
      {/* strained face */}
      <circle cx={92} cy={55} r={2.6} fill={textColor} />
      <circle cx={108} cy={55} r={2.6} fill={textColor} />
      <path d="M92,68 Q100,64 108,68" stroke={textColor} strokeWidth={3} fill="none" strokeLinecap="round" />
      {/* neck — clearly visible, longer segment between head and shoulders */}
      <line x1={100} y1={78} x2={100} y2={102} stroke={textColor} strokeWidth={5} strokeLinecap="round" />
      {/* body — lengthened for a taller figure */}
      <line x1={100} y1={102} x2={100} y2={166} stroke={textColor} strokeWidth={5} strokeLinecap="round" />
      {/* both arms raised up toward the table above */}
      <g transform={`translate(0, ${liftBob})`}>
        <path d="M100,108 L74,68 L62,42" stroke={textColor} strokeWidth={5} fill="none" strokeLinecap="round" />
        <path d="M100,108 L126,68 L138,42" stroke={textColor} strokeWidth={5} fill="none" strokeLinecap="round" />
        {/* hands */}
        <circle cx={62} cy={42} r={5} stroke={accentColor} strokeWidth={3} fill={bgColor} />
        <circle cx={138} cy={42} r={5} stroke={accentColor} strokeWidth={3} fill={bgColor} />
      </g>
      {/* legs */}
      <path d="M100,166 L80,202" stroke={textColor} strokeWidth={5} strokeLinecap="round" />
      <path d="M100,166 L120,202" stroke={textColor} strokeWidth={5} strokeLinecap="round" />
    </svg>
  );

  const tableColumn = (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: 0 }}>
        {/* Title block */}
        <div style={{ opacity: titleOp, transform: `translateY(${titleY}px)`, flexShrink: 0, marginBottom: Math.round(height * 0.022), alignSelf: "flex-start", textAlign: "left", width: "100%", maxWidth: "100%" }}>
          <div style={{ fontFamily: fontFamily ?? HAND_FONT, fontWeight: 700, fontSize: titleSize, lineHeight: 1.1, color: textColor }}>
            {title}
          </div>
          {tickerTitle && (
            <div style={{ fontFamily: fontFamily ?? HAND_FONT, fontWeight: 600, fontSize: descSize - 4, color: textColor, opacity: 0.6, marginTop: 6 }}>
              {tickerTitle}
            </div>
          )}
          {/* Hand-drawn underline */}
          <svg width={`${ruleW}%`} height="8" style={{ display: "block", marginTop: 8, overflow: "visible" }}>
            <path d={`M 0,4 Q ${35}%,0 ${70}%,5 T 100%,3`} fill="none" stroke={accentColor} strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>

        {/* Table */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: fewCols ? "center" : "stretch", justifyContent: fewRows ? "center" : "flex-start" }}>
          <div style={{ alignSelf: fewCols ? "center" : "stretch", width: tableWidthCap, maxWidth: "100%", flex: fewRows ? "0 1 auto" : "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", borderRadius: 8, overflow: "hidden", background: PAPER_PANEL, border: `2px solid ${textColor}18`, boxShadow: "4px 6px 18px rgba(0,0,0,0.06)" }}>
            {!hasData ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "8%", fontFamily: fontFamily ?? HAND_FONT, fontSize: descSize, color: textColor, opacity: 0.45, fontStyle: "italic" }}>
                No data — add a table by editing this scene
              </div>
            ) : (
              <>
                {rawHeaders.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "row", flexShrink: 0, background: `${accentColor}80`, borderBottom: `2px solid ${accentColor}`, opacity: headerOp }}>
                    {rawHeaders.map((hdr, ci) => (
                      <div key={ci} style={{ flex: "1 1 0", minWidth: 0, boxSizing: "border-box", padding: `${Math.round(cellPadV * 1.1)}px ${cellPadH}px`, fontFamily: fontFamily ?? HAND_FONT, fontWeight: 700, fontSize: headerFontSize, color: textColor, borderRight: ci < colCount - 1 ? `1px solid rgba(0,0,0,0.12)` : "none", textAlign: ci > 0 ? "right" : "left", display: "flex", alignItems: "center", justifyContent: ci > 0 ? "flex-end" : "flex-start" }}>
                        {hdr}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ flex: fewRows ? "0 1 auto" : "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start", overflow: "hidden" }}>
                  {rawRows.map((row, ri) => (
                    <div key={ri} style={{ flex: fewRows ? `0 0 ${naturalRowH}px` : "1 1 0", minHeight: 0, display: "flex", flexDirection: "row", alignItems: "stretch", borderBottom: ri < rowCount - 1 ? `1px dashed ${GRID_LINE}` : "none", opacity: rowOp(ri), background: ri % 2 === 1 ? "rgba(0,0,0,0.02)" : "transparent" }}>
                      {Array.from({ length: colCount }).map((_, ci) => {
                        const cellRaw = row[ci] ?? "";
                        const hlStyle = ci === hlCol ? highlightCell(cellRaw) : undefined;
                        return (
                          <div key={ci} style={{ flex: "1 1 0", minWidth: 0, boxSizing: "border-box", padding: `${cellPadV}px ${cellPadH}px`, fontFamily: fontFamily ?? HAND_FONT, fontWeight: hlStyle?.bold ? 700 : ci === 0 ? 600 : 400, fontSize: cellFontSize, lineHeight: 1.4, color: hlStyle ? hlStyle.color : textColor, borderRight: cellBorder(ci), textAlign: ci > 0 ? "right" : "left", fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", justifyContent: ci > 0 ? "flex-end" : "flex-start" }}>
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
          <div style={{ opacity: footnoteOp, flexShrink: 0, marginTop: Math.round(height * 0.014), fontFamily: fontFamily ?? HAND_FONT, fontStyle: "italic", fontSize: Math.round(descSize * 0.82), color: textColor, lineHeight: 1.4 }}>
            {tickerFootnote || narration}
          </div>
        )}
    </div>
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: fontFamily ?? HAND_FONT }}>
      <WhiteboardBackground bgColor={bgColor} />

      {p ? (
        /* ── PORTRAIT: table on top, small stickman lifting it from below ── */
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "8% 7%", gap: 0, zIndex: 10 }}>
          {tableColumn}
          {/* Small lifting stickman below the table */}
          <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", alignItems: "flex-start", marginTop: -6 }}>
            <div style={{ width: "26%", maxWidth: 200 }}>{LiftingStickman}</div>
          </div>
        </div>
      ) : (
        /* ── LANDSCAPE: table left 90%, pointing stickman right 10% ── */
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "row", alignItems: "stretch", padding: "5% 4% 5% 7%", gap: 0, zIndex: 10 }}>
          <div style={{ flexBasis: "90%", flexGrow: 0, flexShrink: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {tableColumn}
          </div>
          <div style={{ flexBasis: "10%", flexGrow: 0, flexShrink: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingLeft: 8 }}>
            {PointingStickman}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
