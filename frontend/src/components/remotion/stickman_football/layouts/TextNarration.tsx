import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import { GrassGround, StickFace } from "../shared";

export const TextNarration: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor,
    bgColor,
    textColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
  } = props;
  const p = aspectRatio === "portrait";
  const eyebrow = (props as any).eyebrow as string | undefined;
  const leftLabel = (props as any).leftLabel ?? "Pundit One";
  const rightLabel = (props as any).rightLabel ?? "Pundit Two";
  const leftReport = (props as any).leftDescription ?? "";
  const rightReport = (props as any).rightDescription ?? "";

  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const dur = sceneDurationInFrames ?? 150;
  const tSec = frame / fps;

  const titlePx = titleFontSize ?? (p ? 92 : 62);
  const narrationPx = descriptionFontSize ?? (p ? 44 : 40);
  const ff = fontFamily ?? "'Patrick Hand', system-ui, sans-serif";

  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [dur - 18, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sceneOpacity = Math.min(enter, exit);

  const msToFrames = (ms: number) => (ms / 1000) * fps;
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 2);
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
  const seg = (startMs: number, durMs: number, ease: (t: number) => number = easeOut) =>
    ease(interpolate(frame, [msToFrames(startMs), msToFrames(startMs + durMs)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

  const accent = accentColor ?? "#2E7D32";
  const bg = bgColor ?? "#FFFFFF";
  const text = textColor ?? "#111111";
  const ink = "#111111";
  const suit = "#2A3550";        // navy suit jacket
  const tie = accent;
  const board = "#C8A26A";       // cardboard
  const boardEdge = "#8A6A3B";

  const W = p ? 1080 : 1920;
  const H = p ? 1920 : 1080;

  // Ground band near the bottom; figures stand on it.
  const groundY = H * (p ? 0.88 : 0.84);

  // Figure sizing (bigger in portrait)
  const FIG = p ? 2.0 : 1.4;
  const headR = 22 * FIG;
  const neckLen = 12 * FIG;
  const torsoLen = 60 * FIG;
  const hipLegLen = 78 * FIG;
  const sw = p ? 6.5 : 6;

  // Board text size tracks the description font size.
  const boardBodyPx = Math.max(12, narrationPx - 8);
  const boardHeadPx = boardBodyPx + 6;

  // Reveal timings
  const leftFade = seg(200, 500, easeOutCubic);
  const rightFade = seg(380, 500, easeOutCubic);
  const titleFade = seg(120, 420);
  const narrFade = seg(380, 420);

  // ── A suited reporter holding a cardboard report overhead with both hands ────
  const Reporter: React.FC<{
    cx: number;
    fade: number;
    variant: number;
    label: string;
    report: string;
    wavePhase: number;
  }> = ({ cx, fade, variant, label, report, wavePhase }) => {
    const gy = groundY;
    const hipY = gy - hipLegLen;
    const shoulderY = hipY - torsoLen;
    const neckTopY = shoulderY - neckLen;
    const headCY = neckTopY - headR;
    const shoulderHalf = headR * 1.05;

    // Gentle idle sway of the whole upper body.
    const sway = Math.sin(tSec * 1.6 + wavePhase) * 2;

    // Legs (suit trousers) — slight stance.
    const lFootX = cx - headR * 0.7;
    const rFootX = cx + headR * 0.7;

    // Gentle waving tilt of the board (held overhead with both hands).
    const boardWave = Math.sin(tSec * 2.4 + wavePhase) * 6;         // deg tilt
    const boardLift = Math.sin(tSec * 2.4 + wavePhase) * headR * 0.18; // small up/down bob

    // Shoulders
    const lShX = cx - shoulderHalf + sway;
    const rShX = cx + shoulderHalf + sway;
    const shY = shoulderY + 2;

    // ── Board sized to the report text ──
    const charBudget = p ? 22 : 24;
    const reportLines = wrapText(report, charBudget).slice(0, 5);
    const longest = Math.max(label.length, ...reportLines.map((l) => l.length), 6);
    const padX = boardBodyPx * 1.0;
    const padY = boardBodyPx * 0.8;
    const bw = Math.min(W * (p ? 0.46 : 0.42), longest * boardBodyPx * 0.56 + padX * 2);
    const lineGap = boardBodyPx * 1.32;
    const headerH = boardHeadPx * 1.5;
    const bh = padY * 2 + headerH + reportLines.length * lineGap;

    // Board centre sits ABOVE the head, both hands raised to its bottom corners.
    const boardCX = cx + sway * 0.6;
    const boardCY = headCY - headR - bh * 0.5 - headR * 0.5 + boardLift;
    const boardBottomY = boardCY + bh * 0.5;

    // Both arms reach UP to the board's bottom corners (curved through the elbow).
    const lHandX = boardCX - bw * 0.32;
    const rHandX = boardCX + bw * 0.32;
    const handY = boardBottomY + headR * 0.1;
    const lElbowX = (lShX + lHandX) / 2 - headR * 0.5;
    const rElbowX = (rShX + rHandX) / 2 + headR * 0.5;
    const elbowY = shY - headR * 0.4;

    return (
      <g opacity={fade}>
        {/* Legs (trousers) */}
        <g stroke={suit} strokeWidth={sw * 1.7} strokeLinecap="round" fill="none">
          <line x1={cx} y1={hipY} x2={lFootX} y2={gy} />
          <line x1={cx} y1={hipY} x2={rFootX} y2={gy} />
        </g>
        {/* Shoes */}
        <g stroke={ink} strokeWidth={sw * 1.2} strokeLinecap="round">
          <line x1={lFootX - headR * 0.18} y1={gy} x2={lFootX + headR * 0.28} y2={gy} />
          <line x1={rFootX - headR * 0.28} y1={gy} x2={rFootX + headR * 0.18} y2={gy} />
        </g>

        {/* Suit jacket torso (filled) */}
        <path
          d={`M ${lShX} ${shY}
              L ${rShX} ${shY}
              L ${cx + headR * 0.75} ${hipY}
              L ${cx - headR * 0.75} ${hipY} Z`}
          fill={suit}
          stroke={suit}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
        {/* Shirt V + tie */}
        <path d={`M ${cx - headR * 0.32} ${shY} L ${cx} ${shY + headR * 0.9} L ${cx + headR * 0.32} ${shY}`} fill="#FFFFFF" stroke="none" />
        <path d={`M ${cx} ${shY + headR * 0.35} L ${cx - headR * 0.16} ${shY + headR * 0.7} L ${cx} ${hipY - headR * 0.3} L ${cx + headR * 0.16} ${shY + headR * 0.7} Z`} fill={tie} stroke="none" />

        {/* Neck (visible) */}
        <line x1={cx + sway * 0.4} y1={shY - 2} x2={cx + sway * 0.6} y2={neckTopY} stroke={ink} strokeWidth={sw * 1.1} strokeLinecap="round" />

        {/* Both arms raised overhead to hold the board (curved through the elbow) */}
        <g stroke={ink} strokeWidth={sw * 1.3} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d={`M ${lShX} ${shY + headR * 0.2} Q ${lElbowX} ${elbowY} ${lHandX} ${handY}`} />
          <path d={`M ${rShX} ${shY + headR * 0.2} Q ${rElbowX} ${elbowY} ${rHandX} ${handY}`} />
        </g>

        {/* Head + face */}
        <circle cx={cx + sway * 0.6} cy={headCY} r={headR} fill="none" stroke={ink} strokeWidth={sw} />
        <StickFace cx={cx + sway * 0.6} cy={headCY} headR={headR} stroke={ink} sw={sw} variant={variant} opacity={1} />

        {/* ── Cardboard report held overhead (waving) ── */}
        <g transform={`translate(${boardCX} ${boardCY}) rotate(${boardWave})`}>
          <rect x={-bw / 2} y={-bh / 2} width={bw} height={bh} rx={10} fill={board} stroke={boardEdge} strokeWidth={sw} />
          <rect x={-bw / 2 + 8} y={-bh / 2 + 8} width={bw - 16} height={bh - 16} rx={8} fill="none" stroke={boardEdge} strokeWidth={1.5} opacity={0.5} />
          {/* heading */}
          <text x={0} y={-bh / 2 + padY + boardHeadPx * 0.85} textAnchor="middle" fontFamily={ff} fontWeight={800} fontSize={boardHeadPx} fill="#2B1C0B" style={{ textTransform: "uppercase", letterSpacing: "0.03em" }}>
            {label}
          </text>
          {/* divider */}
          <line x1={-bw / 2 + 16} y1={-bh / 2 + padY + headerH} x2={bw / 2 - 16} y2={-bh / 2 + padY + headerH} stroke={boardEdge} strokeWidth={2} opacity={0.6} />
          {/* report body (wrapped) */}
          {reportLines.map((ln, i) => (
            <text key={i} x={0} y={-bh / 2 + padY + headerH + lineGap * (i + 0.8)} textAnchor="middle" fontFamily={ff} fontWeight={500} fontSize={boardBodyPx} fill="#4A3416">
              {ln}
            </text>
          ))}
        </g>
      </g>
    );
  };

  const halfL = W * 0.27;
  const halfR = W * 0.73;

  return (
    <AbsoluteFill style={{ background: bg, opacity: sceneOpacity, fontFamily: ff, overflow: "hidden" }}>
      {/* Grass-green radial wash */}
      <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(ellipse 120% 60% at 50% 110%, rgba(46,125,50,0.10) 0%, transparent 70%)` }} />

      {/* World SVG: grass ground + two reporters */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
          <GrassGround W={W} H={H} groundY={groundY} accent={accent} />
          <Reporter cx={halfL} fade={leftFade} variant={0} label={leftLabel} report={leftReport} wavePhase={0} />
          <Reporter cx={halfR} fade={rightFade} variant={2} label={rightLabel} report={rightReport} wavePhase={Math.PI} />
        </svg>
      </AbsoluteFill>

      {/* Title + narration at the top (centred, no divider line) */}
      <div
        style={{
          position: "absolute",
          top: H * 0.05,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: `0 ${p ? 6 : 10}%`,
          pointerEvents: "none",
        }}
      >
        {eyebrow ? (
          <div style={{ opacity: titleFade, color: accent, fontSize: narrationPx * 0.8, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
            {eyebrow}
          </div>
        ) : null}
        <div
          style={{
            opacity: titleFade,
            transform: `translateY(${(1 - titleFade) * 24}px)`,
            color: text,
            fontSize: titlePx,
            fontWeight: 900,
            textAlign: "center",
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            lineHeight: 1.05,
            wordBreak: "break-word",
            overflowWrap: "break-word",
          }}
        >
          {title}
        </div>
        <div style={{ height: 4, width: p ? W * 0.4 : W * 0.26, background: accent, borderRadius: 2, marginTop: 12, transformOrigin: "center", transform: `scaleX(${seg(300, 420, easeOutCubic)})` }} />
        {narration ? (
          <div
            style={{
              marginTop: 18,
              opacity: narrFade,
              color: text,
              fontSize: narrationPx,
              fontWeight: 500,
              textAlign: "center",
              lineHeight: 1.4,
              maxWidth: p ? "96%" : "84%",
              wordBreak: "break-word",
              overflowWrap: "break-word",
            }}
          >
            {narration}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// Simple greedy word-wrap into lines of at most `maxChars` characters.
function wrapText(text: string, maxChars: number): string[] {
  if (!text) return [];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) current = next;
    else { if (current) lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines;
}
