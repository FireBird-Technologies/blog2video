import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";

export const ConstellationStats: React.FC<SceneLayoutProps> = (props) => {
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

  const titlePx    = titleFontSize ?? (p ? 86 : 79);
  const descPx     = descriptionFontSize ?? (p ? 50 : 41);
  // Sign text size is its own entity, derived from the narration (description)
  // font size as a fixed offset smaller (descPx − 15). It is rendered at this
  // absolute px size — decoupled from the figure scale — so the stats always
  // read a bit smaller than the narration text. The sign board sizes to match.
  const signFontPx = ((props as any).signFontSize ?? Math.max(10, descPx - 15)) as number;

  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit  = interpolate(frame, [dur - 18, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const masterOpacity = enter * exit;

  const rawStats = (props as any).stats;
  const stats: { label: string; value: string }[] = Array.isArray(rawStats)
    ? rawStats.slice(0, 6)
    : [];
  const numStats = Math.max(Math.min(stats.length, 6), 0);

  const stroke = textColor ?? "#FFFFFF";
  const accent = accentColor ?? "#FFFFFF";
  const t = frame / fps;

  // ── Starfield ─────────────────────────────────────────────────────────────
  const bgStars = React.useMemo(() => {
    const arr: { x: number; y: number; r: number; period: number; phase: number; baseOpacity: number }[] = [];
    for (let i = 0; i < 140; i++) {
      const seed = i * 137.508;
      arr.push({
        x: (Math.sin(seed) * 0.5 + 0.5) * width,
        y: (Math.cos(seed * 1.3) * 0.5 + 0.5) * height,
        r: 1 + (Math.sin(seed * 2.1) * 0.5 + 0.5),
        period: 2 + (Math.sin(seed * 3.7) * 0.5 + 0.5) * 3,
        phase: (Math.sin(seed * 5.3) * 0.5 + 0.5) * Math.PI * 2,
        baseOpacity: 0.35 + (Math.sin(seed * 7.1) * 0.5 + 0.5) * 0.45,
      });
    }
    return arr;
  }, [width, height]);

  // ── Layout constants ───────────────────────────────────────────────────────
  const figScale = p ? 2.2 : 1.8;

  const ropeMargin = p ? width * 0.09 : width * 0.10;
  const ropeX1 = ropeMargin;
  const ropeX2 = width - ropeMargin;

  // Portrait zigzag: figures are evenly spaced in X across the canvas width,
  // but alternate between two Y rows (even index = upper row, odd = lower row).
  // This guarantees every figure has a unique X so none overlap.
  // Landscape: single flat ground line, evenly spaced in X.
  const getFigPos = (i: number, n: number): { x: number; y: number } => {
    if (!p) {
      const groundY = height * 0.82;
      const x = n === 1 ? width / 2 : ropeX1 + (i / (n - 1)) * (ropeX2 - ropeX1);
      return { x, y: groundY };
    }
    // Portrait: all figures distributed evenly in X, zigzag in Y
    const margin = width * 0.14;
    const x = n === 1 ? width / 2 : margin + (i / (n - 1)) * (width - margin * 2);
    const rowT = height * 0.58;  // upper ground line
    const rowB = height * 0.88;  // lower ground line
    const y = i % 2 === 0 ? rowT : rowB;
    return { x, y };
  };

  // For landscape, a single flat groundY is used for the ground line
  const groundY = p ? height * 0.84 : height * 0.82; // used only for landscape ground line + label positions

  // Timing
  const figStagger   = 0.4;   // s between each figure entrance
  const figEnterDur  = 0.35;  // s to scale in
  const ropeSegDur   = 0.25;  // s per rope segment draw
  const signLiftDur  = 0.45;  // s for sign to float up
  const countDur     = 1.2;   // s for count-up

  // ── Rope-wave animation ───────────────────────────────────────────────────
  // After all figures have entered, a wave ping-pongs left↔right along the chain.
  // wavePeriod = full round-trip (left→right→left) in seconds.
  const allEnteredSec = numStats * figStagger + figEnterDur + signLiftDur + 0.3;
  const allEnteredFrame = allEnteredSec * fps;
  const wavePeriod = 5.0; // seconds per full left→right→left trip

  // wavePos: 0 = leftmost figure, numStats-1 = rightmost. Ping-pongs.
  // Returns 0..1 position along the chain (0=left, 1=right) as a triangle wave.
  const rawWavePhase = frame > allEnteredFrame
    ? ((frame - allEnteredFrame) / fps / wavePeriod) % 1
    : 0;
  // Triangle wave: 0→1→0
  const waveNorm = rawWavePhase < 0.5 ? rawWavePhase * 2 : 2 - rawWavePhase * 2;
  // wavePos: position in figure-index space (0 .. numStats-1)
  const wavePos = waveNorm * (numStats - 1);

  // For each figure i, how much is the wave "at" that figure right now?
  // Gaussian falloff around wavePos, width ~0.8 figure-units.
  const waveAtFig = (i: number) => {
    if (numStats <= 1 || frame <= allEnteredFrame) return 0;
    const dist = Math.abs(i - wavePos);
    return Math.exp(-(dist * dist) / (2 * 0.5 * 0.5)); // sigma=0.5
  };

  // For each rope segment i (between fig i and i+1), wave intensity at midpoint
  const waveAtSeg = (i: number) => {
    if (numStats <= 1 || frame <= allEnteredFrame) return 0;
    const mid = i + 0.5;
    const dist = Math.abs(mid - wavePos);
    return Math.exp(-(dist * dist) / (2 * 0.6 * 0.6));
  };

  // Figure local geometry (origin = feet, all in "local units" before S is applied)
  // hipLY=-50, shoulderLY≈-94, headLY≈-114
  const hipLY      = -50;
  const torsoLen   = 44;
  const headR      = 15;
  const armReach   = 28;
  const armWaistY  = hipLY + 10; // where arms meet rope

  const parseValue = (v: string) => {
    const m = v.match(/^([^0-9]*)([0-9]+(?:\.[0-9]+)?)(.*)$/);
    return m ? { prefix: m[1], num: parseFloat(m[2]), suffix: m[3], isFloat: m[2].includes(".") } : null;
  };

  // Sign board sized to hold its content (value + label) so text never spills
  // out. Returns unscaled local dimensions; callers apply S and signPop. Width
  // grows with the longer of value/label so the board expands instead of clipping.
  const signDims = (stat?: { label: string; value: string }) => {
    const charW = signFontPx * 0.62;
    const valW = (stat?.value ?? "").length * charW;
    const labW = (stat?.label ?? "").length * charW * 0.6;
    const contentW = Math.max(valW, labW) + signFontPx * 1.6;
    const wLocal = Math.max(signFontPx * 3.6, contentW);
    const hLocal = signFontPx * 2.4;
    return { wLocal, hLocal };
  };

  return (
    <AbsoluteFill style={{
      background: bgColor ?? "#000000",
      fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
      overflow: "hidden",
      opacity: masterOpacity,
    }}>
      <svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
        <defs>
          <filter id="chalk" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="signGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
          </radialGradient>
        </defs>

        {/* Stars */}
        {bgStars.map((s, i) => {
          const twinkle = s.baseOpacity * (0.7 + 0.3 * Math.sin(t * (2 * Math.PI / s.period) + s.phase));
          return <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={i % 5 === 0 ? "#B0E8FF" : "#FFFFFF"} opacity={twinkle} />;
        })}

        {/* Crescent moon */}
        <g transform={`translate(${width - (p ? 90 : 110)}, ${p ? 90 : 75})`}
           style={{ filter: "drop-shadow(0 0 10px rgba(255,255,255,0.6))" }}>
          <path d="M 0 -26 A 26 26 0 1 1 0 26 A 17 17 0 1 0 0 -26 Z" fill="#FFFFFF" opacity={0.85} />
        </g>

        {/* Vignette */}
        <rect x={0} y={0} width={width} height={height} fill="url(#vignette)" />

        {/* Ground line(s) — one flat line in landscape, two per-row lines in portrait */}
        {p ? (
          <>
            <line x1={width * 0.06} y1={height * 0.58} x2={width * 0.94} y2={height * 0.58}
              stroke={stroke} strokeWidth={4} strokeLinecap="round" opacity={0.5} filter="url(#chalk)" />
            <line x1={width * 0.06} y1={height * 0.88} x2={width * 0.94} y2={height * 0.88}
              stroke={stroke} strokeWidth={4} strokeLinecap="round" opacity={0.5} filter="url(#chalk)" />
          </>
        ) : (
          <line x1={ropeX1 - 30} y1={groundY} x2={ropeX2 + 30} y2={groundY}
            stroke={stroke} strokeWidth={3.5} strokeLinecap="round"
            opacity={0.7} filter="url(#chalk)" />
        )}

        {/* Rope segments */}
        {numStats > 1 && Array.from({ length: numStats - 1 }).map((_, i) => {
          const segStart = ((i + 1) * figStagger + figEnterDur) * fps;
          const segEnd   = segStart + ropeSegDur * fps;
          const segProg  = interpolate(frame, [segStart, segEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          if (segProg <= 0) return null;

          const posA = getFigPos(i, numStats);
          const posB = getFigPos(i + 1, numStats);
          const ry1 = posA.y + armWaistY * figScale;
          const ry2 = posB.y + armWaistY * figScale;
          const mx  = (posA.x + posB.x) / 2;
          // Wave adds extra sag when it passes through this segment
          const waveSag = waveAtSeg(i) * (p ? 38 : 30);
          const baseSag = p ? 22 : 16;
          const my  = (ry1 + ry2) / 2 + baseSag + waveSag;
          const approxLen = Math.sqrt((posB.x - posA.x) ** 2 + (ry2 - ry1) ** 2) * 1.1;
          // Rope thickens slightly when the wave passes through
          const ropeStroke = (p ? 3.5 : 3) + waveAtSeg(i) * 2;

          return (
            <path key={i}
              d={`M ${posA.x} ${ry1} Q ${mx} ${my} ${posB.x} ${ry2}`}
              fill="none" stroke={accent}
              strokeWidth={ropeStroke}
              strokeLinecap="round" opacity={0.9}
              filter="url(#chalk)"
              strokeDasharray={approxLen}
              strokeDashoffset={approxLen * (1 - segProg)}
            />
          );
        })}

        {/* Stick figures */}
        {numStats > 0 && Array.from({ length: numStats }).map((_, i) => {
          const figEnterStart = i * figStagger * fps;
          const figEnterEnd   = figEnterStart + figEnterDur * fps;
          const figProg = interpolate(frame, [figEnterStart, figEnterEnd], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          if (figProg <= 0) return null;

          const { x: figX, y: figGroundY } = getFigPos(i, numStats);
          const S = figScale * figProg;

          // Body stays pure idle — wave only affects the rope-holding arm hand position
          const sway      = figProg >= 1 ? Math.sin(t * 0.6 + i * 1.3) * 2.5 : 0;
          const bob       = figProg >= 1 ? Math.sin(t * 0.9 + i * 0.7) * 1.8 : 0;
          const breathing = figProg >= 1 ? Math.sin(t * 1.4 + i * 0.5) * 1.0 : 0;

          const shoulderLX = Math.sin((sway * Math.PI) / 180) * 35;
          const shoulderLY = hipLY - torsoLen + bob;
          const headLX     = shoulderLX + Math.sin((sway * 0.5 * Math.PI) / 180) * 12;
          const headLY     = shoulderLY - headR - 2 - breathing;
          const footLX = -13, footRX = 13;

          const hasPrev = i > 0;
          const hasNext = i < numStats - 1;

          // When the wave is at this figure, the rope-holding hand dips down (tugs rope)
          const wave = waveAtFig(i);
          const tugDip = wave * 14; // hand drops by up to 14 local units
          const leftHandY  = armWaistY + tugDip;
          const rightHandY = armWaistY + tugDip;

          return (
            <g key={i} filter="url(#chalk)">
              <g transform={`translate(${figX}, ${figGroundY + bob * S})`}>
                <g transform={`scale(${S})`} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx={headLX} cy={headLY} r={headR} stroke={stroke} strokeWidth={4.5} fill="none" />
                  <line x1={shoulderLX} y1={shoulderLY} x2={0} y2={hipLY} stroke={stroke} strokeWidth={5} />
                  <line x1={0} y1={hipLY} x2={footLX} y2={0} stroke={stroke} strokeWidth={4.5} strokeLinecap="round" />
                  <line x1={0} y1={hipLY} x2={footRX} y2={0} stroke={stroke} strokeWidth={4.5} strokeLinecap="round" />
                  {/* Left arm — rope side or resting */}
                  {(hasPrev || numStats === 1) && (
                    <line x1={shoulderLX} y1={shoulderLY} x2={shoulderLX - armReach} y2={leftHandY}
                      stroke={stroke} strokeWidth={4.5} strokeLinecap="round" />
                  )}
                  {/* Right arm — rope side or resting */}
                  {(hasNext || numStats === 1) && (
                    <line x1={shoulderLX} y1={shoulderLY} x2={shoulderLX + armReach} y2={rightHandY}
                      stroke={stroke} strokeWidth={4.5} strokeLinecap="round" />
                  )}
                  {/* Resting arm on the free side for end figures */}
                  {numStats > 1 && i === 0 && (
                    <line x1={shoulderLX} y1={shoulderLY} x2={shoulderLX - armReach} y2={leftHandY}
                      stroke={stroke} strokeWidth={4.5} strokeLinecap="round" />
                  )}
                  {numStats > 1 && i === numStats - 1 && (
                    <line x1={shoulderLX} y1={shoulderLY} x2={shoulderLX + armReach} y2={rightHandY}
                      stroke={stroke} strokeWidth={4.5} strokeLinecap="round" />
                  )}
                </g>
              </g>
            </g>
          );
        })}

        {/* Floating cardboard signs */}
        {numStats > 0 && Array.from({ length: numStats }).map((_, i) => {
          const figEnterStart = i * figStagger * fps;
          const figEnterEnd   = figEnterStart + figEnterDur * fps;
          const figProg = interpolate(frame, [figEnterStart, figEnterEnd], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          if (figProg <= 0) return null;

          const signLiftStart = figEnterEnd;
          const signLiftEnd   = signLiftStart + signLiftDur * fps;
          const signProg = interpolate(frame, [signLiftStart, signLiftEnd], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          if (signProg <= 0) return null;

          const { x: figX, y: figGroundY } = getFigPos(i, numStats);
          const S = figScale * figProg;

          const wave2   = waveAtFig(i);
          const sway2   = figProg >= 1 ? Math.sin(t * 0.6 + i * 1.3) * 2.5 : 0;
          const bob2    = figProg >= 1 ? Math.sin(t * 0.9 + i * 0.7) * 1.8 : 0;
          const breath2 = figProg >= 1 ? Math.sin(t * 1.4 + i * 0.5) * 1.0 : 0;
          const shLX2   = Math.sin((sway2 * Math.PI) / 180) * 35;
          const shLY2   = hipLY - torsoLen + bob2;
          const hdLY2   = shLY2 - headR - 2 - breath2;

          const signTopLocal = interpolate(signProg, [0, 1], [hdLY2 - 20, hdLY2 - 100]);
          const signCX = figX + shLX2 * S;
          const signCY = figGroundY + (signTopLocal + bob2) * S;
          // Sign pops larger when wave arrives: scale 1.0 → 1.4 → 1.0
          const signPop = 1 + wave2 * 0.4;
          const dims = signDims(stats[i]);
          // Board sized at an absolute px size (figProg for entrance + wave pop),
          // independent of figScale, so the sign text stays at signFontPx.
          const signSize = figProg * signPop;
          const signW  = dims.wLocal * signSize;
          const signH  = dims.hLocal * signSize;
          const signBob = figProg >= 1 ? Math.sin(t * 1.1 + i * 0.9) * 2.5 * S : 0;

          return (
            <g key={i} opacity={signProg} filter="url(#signGlow)">
              <rect
                x={signCX - signW / 2}
                y={signCY + signBob}
                width={signW}
                height={signH}
                rx={5 * figProg} ry={5 * figProg}
                fill={bgColor ?? "#000000"}
                stroke={accent}
                strokeWidth={2.5 + wave2 * 1.5}
              />
            </g>
          );
        })}
      </svg>

      {/* Sign text (HTML overlay for crisp rendering) */}
      {numStats > 0 && Array.from({ length: numStats }).map((_, i) => {
        const stat = stats[i];
        if (!stat) return null;

        const figEnterStart = i * figStagger * fps;
        const figEnterEnd   = figEnterStart + figEnterDur * fps;
        const figProg = interpolate(frame, [figEnterStart, figEnterEnd], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        if (figProg <= 0) return null;

        const signLiftStart = figEnterEnd;
        const signLiftEnd   = signLiftStart + signLiftDur * fps;
        const signProg = interpolate(frame, [signLiftStart, signLiftEnd], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });

        const S    = figScale * figProg;
        const { x: figX, y: figGroundY } = getFigPos(i, numStats);

        const waveH  = waveAtFig(i);
        const swayH  = figProg >= 1 ? Math.sin(t * 0.6 + i * 1.3) * 2.5 : 0;
        const bobH   = figProg >= 1 ? Math.sin(t * 0.9 + i * 0.7) * 1.8 : 0;
        const breathH = figProg >= 1 ? Math.sin(t * 1.4 + i * 0.5) * 1.0 : 0;
        const shLXH  = Math.sin((swayH * Math.PI) / 180) * 35;
        const shLYH  = hipLY - torsoLen + bobH;
        const hdLYH  = shLYH - headR - 2 - breathH;

        const signTopLocal = interpolate(signProg, [0, 1], [hdLYH - 20, hdLYH - 100]);
        const signBob = figProg >= 1 ? Math.sin(t * 1.1 + i * 0.9) * 2.5 * S : 0;

        const signPop = 1 + waveH * 0.4;
        const signCX  = figX + shLXH * S;
        const signCY  = figGroundY + (signTopLocal + bobH) * S + signBob;
        const dims = signDims(stat);
        const signSize = figProg * signPop;
        const signW = dims.wLocal * signSize;
        const signH = dims.hLocal * signSize;

        // Count-up
        const countStart = signLiftStart;
        const countEnd   = countStart + countDur * fps;
        const countProg  = interpolate(frame, [countStart, countEnd], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });

        const parsed = parseValue(stat.value);
        let displayValue: string;
        if (parsed) {
          const cur = parsed.num * countProg;
          displayValue = parsed.prefix + (parsed.isFloat ? cur.toFixed(1) : Math.round(cur).toString()) + parsed.suffix;
        } else {
          displayValue = signProg > 0.5 ? stat.value : "";
        }

        const valFontSize   = Math.max(10, signFontPx * signSize);
        const labelFontSize = Math.max(8, (p ? 19 : 16) * figProg);

        return (
          <div key={i} style={{ position: "absolute", pointerEvents: "none" }}>
            {/* Value + label inside sign */}
            {signProg > 0 && (
              <div style={{
                position: "absolute",
                left: signCX - signW / 2,
                top: signCY,
                width: signW,
                height: signH,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                opacity: signProg,
                gap: 1,
              }}>
                <div style={{
                  color: accent,
                  fontSize: valFontSize,
                  fontWeight: 700,
                  fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  textShadow: `0 0 8px ${accent}AA`,
                }}>{displayValue}</div>
                <div style={{
                  color: stroke,
                  fontSize: Math.max(7, signFontPx * signSize * 0.6),
                  fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  opacity: 0.8,
                  overflow: "hidden",
                  maxWidth: signW - 6,
                  textOverflow: "ellipsis",
                }}>{stat.label}</div>
              </div>
            )}
            {/* Label also below feet for readability */}
            <div style={{
              position: "absolute",
              left: figX - 65,
              top: figGroundY + 10,
              width: 130,
              textAlign: "center",
              color: stroke,
              fontSize: labelFontSize,
              fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
              opacity: figProg * 0.7,
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}>{stat.label}</div>
          </div>
        );
      })}

      {/* Title + narration */}
      {(() => {
        const titleProg = interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const narrationProg = interpolate(frame, [0.9 * fps, 1.3 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div style={{
            position: "absolute",
            top: p ? 70 : 50,
            left: p ? 60 : 80,
            right: p ? 60 : 80,
            opacity: titleProg,
            transform: `translateY(${interpolate(titleProg, [0, 1], [20, 0])}px)`,
            textAlign: p ? "center" : "left",
          }}>
            <div style={{
              color: accent,
              fontSize: titlePx,
              fontWeight: 700,
              fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
              textShadow: `0 0 14px ${accent}B3`,
              lineHeight: 1.15,
              marginBottom: p ? 12 : 10,
            }}>{title}</div>
            {narration && (
              <div style={{
                color: stroke,
                fontSize: descPx,
                fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
                textShadow: "0 0 6px rgba(255,255,255,0.4)",
                opacity: narrationProg,
                lineHeight: 1.4,
                marginTop: p ? 16 : 12,
              }}>{narration}</div>
            )}
          </div>
        );
      })()}
    </AbsoluteFill>
  );
};
