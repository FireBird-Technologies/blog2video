import React from "react";
import { AbsoluteFill, interpolate } from "remotion";

/** Full-green pitch + white wash + vignette + top-down markings (MatchStats style). */
export const FootballPitchBackdrop: React.FC<{
  W: number;
  H: number;
  p: boolean;
  accent: string;
  frame: number;
  fps: number;
}> = ({ W, H, p, accent, frame, fps }) => {
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 2);
  const msToFrames = (ms: number) => (ms / 1000) * fps;
  const pitchDraw = interpolate(frame, [0, msToFrames(700)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });

  const pxL = W * 0.06;
  const pxR = W * 0.94;
  const pyT = H * 0.05;
  const pyB = H * 0.95;
  const pw = pxR - pxL;
  const ph = pyB - pyT;
  const cxc = W / 2;
  const cyc = H / 2;
  const lineColor = "rgba(255,255,255,0.85)";
  const lineW = 4;
  const dashOpacity = 0.85;
  const acr = p ? pw : ph;
  const penAcr = acr * 0.5;
  const penDepth = (p ? H : W) * (p ? 0.11 : 0.13);
  const goalAreaAcr = acr * 0.26;
  const goalAreaDepth = (p ? H : W) * (p ? 0.05 : 0.06);
  const goalAcr = acr * 0.18;
  const goalDepth = Math.min(W, H) * 0.018;
  const cornerR = Math.min(W, H) * 0.03;
  const centreR = Math.min(W, H) * (p ? 0.12 : 0.14);

  return (
    <>
      <AbsoluteFill style={{ background: accent }} />
      <AbsoluteFill style={{ pointerEvents: "none", background: "rgba(255,255,255,0.30)" }} />
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, transparent 18%, transparent 82%, rgba(0,0,0,0.16) 100%)",
        }}
      />
      <AbsoluteFill style={{ pointerEvents: "none", opacity: pitchDraw }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
          <rect x={pxL} y={pyT} width={pw} height={ph} fill="none" stroke={lineColor} strokeWidth={lineW} />
          <circle cx={cxc} cy={cyc} r={centreR} fill="none" stroke={lineColor} strokeWidth={lineW} />
          <circle cx={cxc} cy={cyc} r={lineW * 1.6} fill={lineColor} />
          {p ? (
            <>
              <line x1={pxL} y1={cyc} x2={pxR} y2={cyc} stroke={lineColor} strokeWidth={lineW} />
              <rect x={cxc - penAcr / 2} y={pyT} width={penAcr} height={penDepth} fill="none" stroke={lineColor} strokeWidth={lineW} />
              <rect x={cxc - goalAreaAcr / 2} y={pyT} width={goalAreaAcr} height={goalAreaDepth} fill="none" stroke={lineColor} strokeWidth={lineW} />
              <rect x={cxc - goalAcr / 2} y={pyT - goalDepth} width={goalAcr} height={goalDepth} fill="rgba(255,255,255,0.18)" stroke={lineColor} strokeWidth={lineW} />
              <rect x={cxc - penAcr / 2} y={pyB - penDepth} width={penAcr} height={penDepth} fill="none" stroke={lineColor} strokeWidth={lineW} />
              <rect x={cxc - goalAreaAcr / 2} y={pyB - goalAreaDepth} width={goalAreaAcr} height={goalAreaDepth} fill="none" stroke={lineColor} strokeWidth={lineW} />
              <rect x={cxc - goalAcr / 2} y={pyB} width={goalAcr} height={goalDepth} fill="rgba(255,255,255,0.18)" stroke={lineColor} strokeWidth={lineW} />
            </>
          ) : (
            <>
              <line x1={cxc} y1={pyT} x2={cxc} y2={pyB} stroke={lineColor} strokeWidth={lineW} />
              <rect x={pxL} y={cyc - penAcr / 2} width={penDepth} height={penAcr} fill="none" stroke={lineColor} strokeWidth={lineW} />
              <rect x={pxL} y={cyc - goalAreaAcr / 2} width={goalAreaDepth} height={goalAreaAcr} fill="none" stroke={lineColor} strokeWidth={lineW} />
              <rect x={pxL - goalDepth} y={cyc - goalAcr / 2} width={goalDepth} height={goalAcr} fill="rgba(255,255,255,0.18)" stroke={lineColor} strokeWidth={lineW} />
              <rect x={pxR - penDepth} y={cyc - penAcr / 2} width={penDepth} height={penAcr} fill="none" stroke={lineColor} strokeWidth={lineW} />
              <rect x={pxR - goalAreaDepth} y={cyc - goalAreaAcr / 2} width={goalAreaDepth} height={goalAreaAcr} fill="none" stroke={lineColor} strokeWidth={lineW} />
              <rect x={pxR} y={cyc - goalAcr / 2} width={goalDepth} height={goalAcr} fill="rgba(255,255,255,0.18)" stroke={lineColor} strokeWidth={lineW} />
            </>
          )}
          <path d={`M ${pxL + cornerR} ${pyT} A ${cornerR} ${cornerR} 0 0 1 ${pxL} ${pyT + cornerR}`} fill="none" stroke={lineColor} strokeWidth={lineW} opacity={dashOpacity} />
          <path d={`M ${pxR - cornerR} ${pyT} A ${cornerR} ${cornerR} 0 0 0 ${pxR} ${pyT + cornerR}`} fill="none" stroke={lineColor} strokeWidth={lineW} opacity={dashOpacity} />
          <path d={`M ${pxL + cornerR} ${pyB} A ${cornerR} ${cornerR} 0 0 0 ${pxL} ${pyB - cornerR}`} fill="none" stroke={lineColor} strokeWidth={lineW} opacity={dashOpacity} />
          <path d={`M ${pxR - cornerR} ${pyB} A ${cornerR} ${cornerR} 0 0 1 ${pxR} ${pyB - cornerR}`} fill="none" stroke={lineColor} strokeWidth={lineW} opacity={dashOpacity} />
        </svg>
      </AbsoluteFill>
    </>
  );
};

export const FROSTED_CARD_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.65)",
  border: "3px solid rgba(255,255,255,0.92)",
  borderRadius: 22,
  boxShadow: "0 12px 40px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.85)",
  backdropFilter: "blur(6px)",
};

/** Rough wrapped-line height for bottom narration (avoids card overlap in data/ticker scenes). */
export function estimateWrappedTextHeight(
  text: string,
  widthPx: number,
  fontSize: number,
  lineHeight = 1.4,
): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const charsPerLine = Math.max(14, Math.floor(widthPx / (fontSize * 0.55)));
  const lines = trimmed
    .split("\n")
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  return lines * fontSize * lineHeight;
}
