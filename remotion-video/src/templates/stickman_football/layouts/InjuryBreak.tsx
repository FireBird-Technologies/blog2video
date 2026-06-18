import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import { GrassGround, StickFace } from "../shared";

export const InjuryBreak: React.FC<SceneLayoutProps> = (props) => {
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

  const leftLabel = (props as any).leftLabel ?? "What happened";
  const rightLabel = (props as any).rightLabel ?? "The outcome";
  const leftDescription = (props as any).leftDescription ?? "";
  const rightDescription = (props as any).rightDescription ?? "";

  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const dur = sceneDurationInFrames ?? 150;
  const tSec = frame / fps;

  const titlePx = titleFontSize ?? (p ? 62 : 57);
  const descPx = descriptionFontSize ?? (p ? 44 : 34);
  const labelPx = p ? 40 : 48;
  const ff = fontFamily ?? "'Patrick Hand', system-ui, sans-serif";

  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [dur - 18, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sceneOpacity = enter * exit;

  const msToFrames = (ms: number) => (ms / 1000) * fps;
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 2);
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
  const seg = (startMs: number, durMs: number, ease: (t: number) => number = easeOut) =>
    ease(interpolate(frame, [msToFrames(startMs), msToFrames(startMs + durMs)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

  const accent = accentColor ?? "#2E7D32";
  const bg = bgColor ?? "#FFFFFF";
  const text = textColor ?? "#111111";
  const ink = "#111111";
  const painMarkColor = "#CC2222";
  const refShirtYellow = "#F5C518";
  const refShortsBlack = ink;
  const cardColor = "#E10600";

  const W = p ? 1080 : 1920;
  const H = p ? 1920 : 1080;
  const dividerX = W / 2;

  const estimateWrappedTextHeight = (
    raw: string,
    widthPx: number,
    fontSize: number,
    lineHeight: number,
  ) => {
    const text = raw.trim();
    if (!text) return 0;
    const charsPerLine = Math.max(14, Math.floor(widthPx / (fontSize * 0.55)));
    const lines = text
      .split("\n")
      .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
    return lines * fontSize * lineHeight;
  };

  // In portrait, push scene groups upward when bottom text becomes large.
  const portraitTitleH = title ? estimateWrappedTextHeight(title, W * 0.88, titlePx, 1.05) : 0;
  const portraitNarrH = narration ? estimateWrappedTextHeight(narration, W * 0.96, descPx, 1.4) : 0;
  const portraitTextNeed = portraitTitleH + (title && narration ? 14 : 0) + portraitNarrH + 36;
  const portraitBaseBand = H * 0.18;
  const portraitLift = p ? Math.min(H * 0.14, Math.max(0, portraitTextNeed - portraitBaseBand)) : 0;

  // ── Reveal timings ──
  const leftFigFade = seg(150, 500, easeOutCubic);
  const rightFigFade = seg(400, 500, easeOutCubic);
  const titleFade = seg(250, 400);
  const narrFade = seg(450, 400);

  // ── Looping motions ──
  const wave = Math.sin(tSec * 5.0);                    // friend waving for help
  const cardRaise = seg(800, 500, easeOutCubic);        // referee lifts the card straight up
  const argue = Math.sin(tSec * 4.5) * rightFigFade;    // opponent's protest sway
  const despair = seg(2000, 700, easeOutCubic);         // then hands on head

  // ── Smaller figures ──
  const sw = p ? 5 : 5;
  const headR = p ? 27 : 24;

  const Head: React.FC<{ cx: number; cy: number; r: number; stroke: string; variant: number; faceStroke?: string }> = ({ cx, cy, r, stroke, variant, faceStroke }) => (
    <>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth={sw} />
      <StickFace cx={cx} cy={cy} headR={r} stroke={faceStroke ?? stroke} sw={sw} variant={variant} opacity={1} />
    </>
  );

  // ── LEFT group: injured player lying down + friend kneeling, calling for help ──
  // Drawn relative to a group centre `cx` on a ground baseline `gy`.
  const LeftGroup: React.FC<{ cx: number; gy: number }> = ({ cx, gy }) => {
    const injHeadX = cx - headR * 5;
    const injY = gy - headR;                 // lying head rests on the ground
    const bodyEndX = cx + headR * 2;
    const fx = cx + headR * 5;                // friend
    const hipY = gy - headR * 2.2;
    const shoulderY = hipY - headR * 3.2;
    const fHeadY = shoulderY - headR - 10;
    const waveHandX = fx + headR * (1.0 + wave * 0.7);
    const waveHandY = shoulderY - headR * (2.0 + 0.3 * Math.abs(wave));
    return (
      <g opacity={leftFigFade} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* injured: lying torso + bent knee + arms */}
        <line x1={injHeadX + headR} y1={injY} x2={bodyEndX} y2={gy - sw} stroke={ink} strokeWidth={sw} />
        <line x1={injHeadX + headR * 2.6} y1={injY + sw} x2={injHeadX + headR * 3.6} y2={gy - sw} stroke={ink} strokeWidth={sw} />
        <polyline points={`${bodyEndX},${gy - sw} ${bodyEndX + headR * 1.2},${gy - headR * 1.8} ${bodyEndX + headR * 2.2},${gy - headR * 0.3}`} stroke={ink} strokeWidth={sw} />
        <line x1={bodyEndX} y1={gy - sw} x2={bodyEndX + headR * 2.4} y2={gy - sw} stroke={ink} strokeWidth={sw} />
        <Head cx={injHeadX} cy={injY} r={headR} stroke={ink} variant={0} />
        {/* pain marks */}
        <g stroke={painMarkColor} strokeWidth={sw * 0.8}>
          <line x1={injHeadX - headR * 1.4} y1={injY - headR * 1.4} x2={injHeadX - headR * 0.9} y2={injY - headR * 1.9} />
          <line x1={injHeadX - headR * 0.9} y1={injY - headR * 1.4} x2={injHeadX - headR * 1.4} y2={injY - headR * 1.9} />
        </g>

        {/* friend kneeling, waving an arm overhead */}
        <line x1={fx} y1={hipY} x2={fx - headR * 0.6} y2={shoulderY} stroke={ink} strokeWidth={sw} />
        <polyline points={`${fx},${hipY} ${fx - headR * 1.1},${gy - headR * 0.4} ${fx - headR * 2.2},${gy}`} stroke={ink} strokeWidth={sw} />
        <polyline points={`${fx},${hipY} ${fx + headR * 0.9},${gy - headR * 1.2} ${fx + headR * 0.4},${gy}`} stroke={ink} strokeWidth={sw} />
        {/* lower arm reaching to the injured player */}
        <polyline points={`${fx - headR * 0.5},${shoulderY + headR * 0.6} ${fx - headR * 1.6},${shoulderY + headR * 1.0} ${fx - headR * 3.0},${shoulderY + headR * 0.9}`} stroke={ink} strokeWidth={sw} />
        {/* waving arm overhead */}
        <polyline points={`${fx - headR * 0.5},${shoulderY + headR * 0.3} ${fx + headR * 0.7},${shoulderY - headR * 0.9} ${waveHandX},${waveHandY}`} stroke={ink} strokeWidth={sw} />
        <Head cx={fx - headR * 0.8} cy={fHeadY} r={headR} stroke={ink} variant={2} />
        {/* help marks near the waving hand */}
        <g stroke={painMarkColor} strokeWidth={sw * 0.8} opacity={0.6 + 0.4 * Math.abs(wave)}>
          <line x1={waveHandX + headR * 0.6} y1={waveHandY - headR * 0.2} x2={waveHandX + headR * 0.9} y2={waveHandY - headR * 0.9} />
          <line x1={waveHandX + headR * 1.1} y1={waveHandY - headR * 0.1} x2={waveHandX + headR * 1.3} y2={waveHandY - headR * 0.8} />
        </g>

        {/* first-aid cross above */}
        <g transform={`translate(${cx - headR}, ${injY - headR * 3.2})`}>
          <rect x={-headR * 0.95} y={-headR * 0.32} width={headR * 1.9} height={headR * 0.64} rx={4} fill={cardColor} />
          <rect x={-headR * 0.32} y={-headR * 0.95} width={headR * 0.64} height={headR * 1.9} rx={4} fill={cardColor} />
        </g>
      </g>
    );
  };

  // ── RIGHT group: opponent (argue → hands on head) + referee (red card) ──
  const RightGroup: React.FC<{ cx: number; gy: number }> = ({ cx, gy }) => {
    const thigh = headR * 2.7;
    const shin = headR * 2.7;
    const torso = headR * 3.6;
    const refX = cx - headR * 3.2;
    const oppX = cx + headR * 4.2;

    // opponent
    const oHipY = gy - (thigh + shin);
    const oShoulderY = oHipY - torso;
    const lean = (-6 + argue * 5) * (1 - despair);
    const shX = oppX + lean;
    const oHeadCY = oShoulderY - headR - 12;
    const gestureY = oShoulderY + headR * 0.3 - argue * headR * 0.8;
    const lerp = (a: number, b: number) => a + (b - a) * despair;
    const lElbowX = lerp(shX - headR * 1.3, shX - headR * 1.15);
    const lElbowY = lerp(gestureY, oShoulderY - headR * 0.1);
    const lHandX = lerp(shX - headR * 2.5, shX - headR * 0.5);
    const lHandY = lerp(gestureY + headR * 0.3, oHeadCY - headR * 0.55);
    const rElbowX = lerp(shX - headR * 0.9, shX + headR * 1.15);
    const rElbowY = lerp(oShoulderY + headR * 1.3, oShoulderY - headR * 0.1);
    const rHandX = lerp(shX - headR * 2.0, shX + headR * 0.5);
    const rHandY = lerp(oShoulderY + headR * 1.0, oHeadCY - headR * 0.55);

    // referee
    const rHipY = gy - (thigh + shin);
    const rShoulderY = rHipY - torso;
    const rHeadCY = rShoulderY - headR - 12;
    const cardHandX = refX + headR * 1.35;
    const otherHandX = refX + headR * 2.3;
    const otherHandY = rShoulderY + headR * 0.2;
    const kneeY = (rHipY + gy) / 2;
    const lKneeX = refX - headR * 0.5;
    const rKneeX = refX + headR * 0.5;
    const refShoulderHalf = headR * 0.88;
    const refLShX = refX - refShoulderHalf;
    const refRShX = refX + refShoulderHalf;
    const refShY = rShoulderY + headR * 0.12;
    const refNeckTopY = rHeadCY + headR * 0.72;
    const cardRestY = rShoulderY + headR * 0.35;
    const cardHandY = cardRestY - cardRaise * headR * 3.4;
    const cardElbowX = refX + headR * 0.95;
    const cardElbowY = refShY + headR * 0.08 - cardRaise * headR * 1.65;

    return (
      <g opacity={rightFigFade} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* opponent */}
        <polyline points={`${oppX},${oHipY} ${oppX + headR * 0.5},${(oHipY + gy) / 2} ${oppX + headR * 1.0},${gy}`} stroke={ink} strokeWidth={sw} />
        <polyline points={`${oppX},${oHipY} ${oppX - headR * 0.5},${(oHipY + gy) / 2} ${oppX - headR * 1.0},${gy}`} stroke={ink} strokeWidth={sw} />
        <line x1={oppX} y1={oHipY} x2={shX} y2={oShoulderY} stroke={ink} strokeWidth={sw} />
        <polyline points={`${shX},${oShoulderY + headR * 0.4} ${lElbowX},${lElbowY} ${lHandX},${lHandY}`} stroke={ink} strokeWidth={sw} />
        <polyline points={`${shX},${oShoulderY + headR * 0.5} ${rElbowX},${rElbowY} ${rHandX},${rHandY}`} stroke={ink} strokeWidth={sw} />
        <Head cx={shX} cy={oHeadCY} r={headR} stroke={ink} variant={1} />

        {/* referee: filled yellow shirt, black shorts, black face/hands/feet */}
        <g stroke={refShortsBlack} strokeWidth={sw * 1.7} strokeLinecap="round" fill="none">
          <line x1={refX} y1={rHipY} x2={lKneeX} y2={kneeY} />
          <line x1={refX} y1={rHipY} x2={rKneeX} y2={kneeY} />
          <line x1={lKneeX} y1={kneeY} x2={refX - headR * 0.9} y2={gy} />
          <line x1={rKneeX} y1={kneeY} x2={refX + headR * 0.9} y2={gy} />
        </g>
        <path
          d={`M ${refLShX} ${refShY}
              L ${refRShX} ${refShY}
              L ${refX + headR * 0.74} ${rHipY}
              L ${refX - headR * 0.74} ${rHipY} Z`}
          fill={refShirtYellow}
          stroke={refShirtYellow}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
        <path
          d={`M ${refX - headR * 0.3} ${refShY} L ${refX} ${refShY + headR * 0.62} L ${refX + headR * 0.3} ${refShY}`}
          fill="#FFFFFF"
          stroke="none"
        />
        <line x1={refX} y1={refShY - 2} x2={refX} y2={refNeckTopY} stroke={ink} strokeWidth={sw * 1.1} />
        <g stroke={ink} strokeWidth={sw * 1.3} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <polyline points={`${refLShX + headR * 0.05},${refShY + headR * 0.22} ${refX + headR * 1.0},${refShY + headR * 0.42} ${otherHandX},${otherHandY}`} />
          <polyline points={`${refRShX - headR * 0.05},${refShY + headR * 0.22} ${cardElbowX},${cardElbowY} ${cardHandX},${cardHandY}`} />
        </g>
        <g transform={`translate(${cardHandX}, ${cardHandY})`}>
          <rect x={-headR * 0.42} y={-headR * 1.5} width={headR * 0.84} height={headR * 1.5} rx={4} fill={cardColor} stroke={ink} strokeWidth={sw * 0.5} />
        </g>
        <circle cx={cardHandX} cy={cardHandY} r={Math.max(3, headR * 0.14)} fill={ink} stroke="none" />
        <circle cx={otherHandX} cy={otherHandY} r={Math.max(3, headR * 0.14)} fill={ink} stroke="none" />
        <circle cx={refX} cy={rHeadCY} r={headR} fill="none" stroke={ink} strokeWidth={sw} />
        <StickFace cx={refX} cy={rHeadCY} headR={headR} stroke={ink} sw={sw} variant={1} opacity={1} />
        <g fill={ink} stroke={ink} strokeWidth={sw * 0.5}>
          <path d={`M ${refX - headR * 1.05} ${rHeadCY - headR * 0.5} Q ${refX} ${rHeadCY - headR * 1.65} ${refX + headR * 1.05} ${rHeadCY - headR * 0.5} Z`} />
          <path d={`M ${refX + headR * 0.4} ${rHeadCY - headR * 0.5} L ${refX + headR * 1.7} ${rHeadCY - headR * 0.36} L ${refX + headR * 0.9} ${rHeadCY - headR * 0.16} Z`} />
        </g>
      </g>
    );
  };

  // ── Ground baselines per orientation ──
  // Landscape: one ground line near the bottom (shared). Portrait: two halves,
  // each with its own ground line.
  const lsGroundY = H * 0.7;
  const topGroundY = H * 0.42 - portraitLift * 0.35;   // portrait: left group sits in the top half
  const botGroundY = H * 0.86 - portraitLift;          // portrait: right group sits in the bottom half
  const portraitTopLabelY = Math.max(28, 60 - portraitLift * 0.24);
  const portraitBottomLabelY = Math.max(H * 0.36, H * 0.5 + 24 - portraitLift * 0.58);

  const labelBlock = (
    label: string,
    desc: string,
    labelDelay: number,
    descDelay: number,
  ) => (
    <>
      <div style={{ color: text, fontSize: labelPx, fontWeight: 800, lineHeight: 1.1, letterSpacing: "0.02em", textTransform: "uppercase", opacity: seg(labelDelay, 350), wordBreak: "break-word", overflowWrap: "break-word" }}>
        {label}
        <div style={{ height: 4, background: accent, marginTop: 8, width: "60%", transformOrigin: "left center", transform: `scaleX(${seg(labelDelay, 350)})`, borderRadius: 2 }} />
      </div>
      {desc ? (
        <div style={{ marginTop: 14, color: text, fontSize: descPx, fontWeight: 500, lineHeight: 1.42, opacity: seg(descDelay, 350), wordBreak: "break-word", overflowWrap: "break-word" }}>
          {desc}
        </div>
      ) : null}
    </>
  );

  return (
    <AbsoluteFill style={{ background: bg, opacity: sceneOpacity, fontFamily: ff, overflow: "hidden" }}>
      {/* Grass-green radial wash */}
      <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(ellipse 120% 60% at 50% 110%, rgba(46,125,50,0.10) 0%, transparent 70%)` }} />

      {/* World SVG: grass ground(s) + figures */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
          {p ? (
            <>
              <GrassGround W={W} H={H} groundY={topGroundY} accent={accent} />
              <GrassGround W={W} H={H} groundY={botGroundY} accent={accent} />
              <LeftGroup cx={W * 0.5} gy={topGroundY} />
              <RightGroup cx={W * 0.5} gy={botGroundY} />
            </>
          ) : (
            <>
              <GrassGround W={W} H={H} groundY={lsGroundY} accent={accent} />
              <LeftGroup cx={W * 0.26} gy={lsGroundY} />
              <RightGroup cx={W * 0.74} gy={lsGroundY} />
            </>
          )}
        </svg>
      </AbsoluteFill>

      {/* ── Labels + descriptions ── */}
      {p ? (
        <>
          {/* Top section (left group) */}
          <div style={{ position: "absolute", left: 48, right: 48, top: portraitTopLabelY, pointerEvents: "none" }}>
            {labelBlock(leftLabel, leftDescription, 350, 500)}
          </div>
          {/* Bottom section (right group) */}
          <div style={{ position: "absolute", left: 48, right: 48, top: portraitBottomLabelY, pointerEvents: "none" }}>
            {labelBlock(rightLabel, rightDescription, 550, 700)}
          </div>
        </>
      ) : (
        <>
          <div style={{ position: "absolute", left: 56, top: 70, maxWidth: dividerX - 85, pointerEvents: "none" }}>
            {labelBlock(leftLabel, leftDescription, 350, 500)}
          </div>
          <div style={{ position: "absolute", left: dividerX + 56, top: 70, maxWidth: dividerX - 85, pointerEvents: "none" }}>
            {labelBlock(rightLabel, rightDescription, 550, 700)}
          </div>
        </>
      )}

      {/* Title + narration — centred on the bottom grass band (black text) */}
      <div
        style={{
          position: "absolute",
          top: p ? botGroundY : lsGroundY,
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: p ? 14 : 16,
          padding: `0 ${p ? 6 : 8}%`,
          pointerEvents: "none",
        }}
      >
        {title ? (
          <div
            style={{
              opacity: titleFade * exit,
              color: text,
              fontSize: titlePx,
              fontWeight: 900,
              textAlign: "center",
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              lineHeight: 1.05,
              textShadow: "2px 2px 0 rgba(255,255,255,0.3)",
              wordBreak: "break-word",
              overflowWrap: "break-word",
            }}
          >
            {title}
          </div>
        ) : null}
        {narration ? (
          <div
            style={{
              opacity: narrFade * exit,
              color: text,
              fontSize: descPx,
              fontWeight: 600,
              textAlign: "center",
              lineHeight: 1.4,
              maxWidth: p ? "96%" : "82%",
              textShadow: "1px 1px 0 rgba(255,255,255,0.3)",
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
