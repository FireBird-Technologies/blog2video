import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import { Stickman2BackgroundImage } from "../Stickman2BackgroundImage";

export const ShootingStar: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    imageUrl,
    imageObjectPosition,
    imageZoom,
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

  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const dur = sceneDurationInFrames ?? 150;

  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit  = interpolate(frame, [dur - 18, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const masterOpacity = enter * exit;

  const W = p ? 1080 : 1920;
  const H = p ? 1920 : 1080;
  const scaleX = W / 1920;
  const scaleY = H / 1080;

  // ── Shooting stars ───────────────────────────────────────────────────────
  const shootingStars = React.useMemo(() => {
    const paths = [
      { duration: 2.2, x1: -60,  y1: 50,  x2: 2020, y2: 640, tailLen: 220 },
      { duration: 2.0, x1: 120,  y1: 15,  x2: 1960, y2: 760, tailLen: 190 },
      { duration: 2.3, x1: -40,  y1: 110, x2: 1850, y2: 920, tailLen: 250 },
      { duration: 2.1, x1: 250,  y1: 5,   x2: 2000, y2: 680, tailLen: 200 },
      { duration: 2.0, x1: 0,    y1: 90,  x2: 1920, y2: 850, tailLen: 210 },
      { duration: 2.2, x1: 180,  y1: 40,  x2: 1980, y2: 720, tailLen: 230 },
      { duration: 2.1, x1: -80,  y1: 70,  x2: 1900, y2: 800, tailLen: 215 },
      { duration: 2.0, x1: 90,   y1: 25,  x2: 1940, y2: 700, tailLen: 195 },
      { duration: 2.3, x1: 40,   y1: 130, x2: 1880, y2: 880, tailLen: 245 },
    ];
    const waveStartsSec = [0.15, 2.3, 4.5, 6.7];
    const staggerSec = 0.38;
    const stars: { startFrame: number; duration: number; x1: number; y1: number; x2: number; y2: number; tailLen: number }[] = [];
    waveStartsSec.forEach((waveStart, wi) => {
      for (let i = 0; i < 3; i++) {
        const tpl = paths[(wi * 3 + i) % paths.length];
        stars.push({ ...tpl, startFrame: Math.round((waveStart + i * staggerSec) * fps), duration: Math.round(tpl.duration * fps) });
      }
    });
    return stars;
  }, [fps]);

  const starStates = shootingStars.map((s) => {
    const prog = interpolate(frame, [s.startFrame, s.startFrame + s.duration], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (t) => t,
    });
    const x = (s.x1 + (s.x2 - s.x1) * prog) * scaleX;
    const y = (s.y1 + (s.y2 - s.y1) * prog) * scaleY;
    const angle = Math.atan2((s.y2 - s.y1) * scaleY, (s.x2 - s.x1) * scaleX);
    const tailX = x - s.tailLen * scaleX * Math.cos(angle);
    const tailY = y - s.tailLen * scaleY * Math.sin(angle);
    return { x, y, tailX, tailY, visible: prog > 0 && prog < 1, angle };
  });

  // ── Flash ────────────────────────────────────────────────────────────────
  const impactFrame = Math.round(2.4 * fps);
  const flashProg = interpolate(frame, [impactFrame, impactFrame + Math.round(0.5 * fps)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const flashOpacity = flashProg < 0.4
    ? interpolate(flashProg, [0, 0.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : interpolate(flashProg, [0.4, 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── Title / narration ────────────────────────────────────────────────────
  const titleProg = interpolate(frame, [impactFrame, impactFrame + Math.round(0.3 * fps)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleScale = interpolate(titleProg, [0, 1], [1.15, 1.0]);
  const narrationProg = interpolate(frame, [Math.round(1.8 * fps), Math.round(2.3 * fps)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const narrationTranslateY = interpolate(narrationProg, [0, 1], [15, 0]);
  const underlineProgress = interpolate(frame, [impactFrame + Math.round(0.3 * fps), impactFrame + Math.round(0.65 * fps)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const underlineLength = 400 * scaleX;

  // ── Starfield ────────────────────────────────────────────────────────────
  const bgStars = React.useMemo(() => {
    const arr: { x: number; y: number; r: number; period: number; phase: number; baseOpacity: number }[] = [];
    for (let i = 0; i < 150; i++) {
      const seed = i * 137.508;
      arr.push({
        x: (Math.sin(seed) * 0.5 + 0.5) * W,
        y: (Math.cos(seed * 1.3) * 0.5 + 0.5) * H,
        r: 1 + (Math.sin(seed * 2.1) * 0.5 + 0.5),
        period: 2 + (Math.sin(seed * 3.7) * 0.5 + 0.5) * 3,
        phase: (Math.sin(seed * 5.3) * 0.5 + 0.5) * Math.PI * 2,
        baseOpacity: 0.4 + (Math.sin(seed * 7.1) * 0.5 + 0.5) * 0.5,
      });
    }
    return arr;
  }, [W, H]);

  // ── Fireflies ────────────────────────────────────────────────────────────
  const fireflies = React.useMemo(() => {
    const arr: { baseX: number; baseY: number; r: number; period: number; phase: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const seed = i * 241.7;
      arr.push({
        baseX: (Math.sin(seed) * 0.5 + 0.5) * W,
        baseY: H * 0.65 + (Math.sin(seed * 2.3) * 0.5 + 0.5) * H * 0.3,
        r: 3 + (Math.sin(seed * 4.1) * 0.5 + 0.5) * 2,
        period: 4 + (Math.sin(seed * 6.7) * 0.5 + 0.5) * 4,
        phase: (Math.sin(seed * 8.9) * 0.5 + 0.5) * Math.PI * 2,
      });
    }
    return arr;
  }, [W, H]);

  const t = frame / fps;
  const stroke = textColor ?? "#FFFFFF";

  // ── Pointing arm target — computed ONCE at frame 0 direction, frozen ────
  // We capture a static direction (upper-right sky region) so the pointer
  // never wobbles — arm is pinned in space like a statue.
  const staticAimX = W * 0.68;
  const staticAimY = H * 0.18;

  // ── Group layout ──────────────────────────────────────────────────────────
  // Figures are larger, tighter together, with staggered ground heights
  // so they look naturally clustered on slightly uneven ground.
  const figScale   = p ? 2.4  : 1.85;   // bigger than before
  const figSpacing = p ? 128  : 120;
  const groupCX    = p ? W * 0.22 : W * 0.19;

  // Each figure has its own ground Y — slight up/down variation
  const groundOffsets = [-8, 6, -4];   // px relative to base groundY
  const baseGroundY   = p ? H * 0.81 : H * 0.81;

  const figDefs = [
    { dx: -figSpacing, phase: 0.0, lean:  3, role: "point" as const  },
    { dx:  0,          phase: 1.5, lean: -1, role: "watch" as const  },
    { dx:  figSpacing, phase: 2.8, lean:  4, role: "watch" as const  },
  ];

  const renderFigure = (def: typeof figDefs[number], idx: number) => {
    const figX   = groupCX + def.dx;
    const groundY = baseGroundY + groundOffsets[idx];
    const figY    = groundY;

    const sway      = Math.sin(t * 0.6 + def.phase) * def.lean;
    const bob       = Math.sin(t * 0.9 + def.phase * 0.5) * 2.2;
    const breathing = Math.sin(t * 1.4 + def.phase) * 1.2;

    const S = figScale;

    // Local coords, origin = feet
    const hipLX = 0,  hipLY = -44;
    const shoulderLX = Math.sin((sway * Math.PI) / 180) * 40;
    const shoulderLY = -44 - 40 + bob;
    const headLX = shoulderLX + Math.sin((sway * 0.5 * Math.PI) / 180) * 16;
    const headLY = shoulderLY - 18 - breathing;
    const footLX = -13, footRX = 13, footY = 0;

    const toCanvas = (lx: number, ly: number) => ({
      cx: figX + lx * S,
      cy: figY + ly * S,
    });
    const shoulderC = toCanvas(shoulderLX, shoulderLY);
    const hipC      = toCanvas(hipLX, hipLY);

    // Head tilt looks upward
    const headTiltDeg = sway * 0.3 - 14 + Math.sin(t * 0.4 + def.phase) * 3.5;

    return (
      <g key={idx}>
        {/* Per-figure ground segment */}
        <line
          x1={figX - 60 * S} y1={figY + 2}
          x2={figX + 60 * S} y2={figY + 2}
          stroke={stroke} strokeWidth={p ? 4.5 : 3.5}
          strokeLinecap="round" opacity={0.92}
          filter="url(#chalk)"
        />

        {/* Body */}
        <g transform={`translate(${figX}, ${figY})`} filter="url(#chalk)">
          <g transform={`translate(0, ${bob}) scale(${S})`} strokeLinecap="round" strokeLinejoin="round">
            {/* Head */}
            <g transform={`rotate(${headTiltDeg} ${headLX} ${headLY})`}>
              <circle cx={headLX} cy={headLY} r={14} stroke={stroke} strokeWidth={4.5} fill="none" />
            </g>
            {/* Torso */}
            <line x1={shoulderLX} y1={shoulderLY} x2={hipLX} y2={hipLY} stroke={stroke} strokeWidth={5} />
            {/* Legs */}
            <line x1={hipLX} y1={hipLY} x2={footLX} y2={footY} stroke={stroke} strokeWidth={4.5} strokeLinecap="round" />
            <line x1={hipLX} y1={hipLY} x2={footRX} y2={footY} stroke={stroke} strokeWidth={4.5} strokeLinecap="round" />
          </g>
        </g>

        {/* Arms — drawn in canvas space */}
        {def.role === "point" ? (
          <>
            {/* POINTING ARM — fully static, no wobble, locked direction */}
            {(() => {
              const pointAngle = Math.atan2(staticAimY - shoulderC.cy, staticAimX - shoulderC.cx);
              const upperA = 28, foreA = 26;
              const elbowX = shoulderC.cx + Math.cos(pointAngle - 0.18) * upperA * S;
              const elbowY = shoulderC.cy + Math.sin(pointAngle - 0.18) * upperA * S;
              const handX  = elbowX + Math.cos(pointAngle) * foreA * S;
              const handY  = elbowY + Math.sin(pointAngle) * foreA * S;
              return (
                <g filter="url(#chalk)">
                  <line x1={shoulderC.cx} y1={shoulderC.cy} x2={elbowX} y2={elbowY}
                    stroke={stroke} strokeWidth={4.5 * S * 0.68} strokeLinecap="round" />
                  <line x1={elbowX} y1={elbowY} x2={handX} y2={handY}
                    stroke={stroke} strokeWidth={4.5 * S * 0.68} strokeLinecap="round" />
                </g>
              );
            })()}
            {/* RESTING ARM — hand on waist, gentle sway */}
            {(() => {
              const elbowX = shoulderC.cx + 22 * S + Math.sin(t * 0.8 + def.phase) * 2;
              const elbowY = (shoulderC.cy + hipC.cy) / 2 + 5 * S;
              const handX  = hipC.cx + 5 * S;
              const handY  = hipC.cy - 4 * S;
              return (
                <path d={`M ${shoulderC.cx} ${shoulderC.cy} Q ${elbowX} ${elbowY} ${handX} ${handY}`}
                  fill="none" stroke={stroke} strokeWidth={4.5 * S * 0.68}
                  strokeLinecap="round" filter="url(#chalk)" />
              );
            })()}
          </>
        ) : (
          <>
            {/* AKIMBO — both hands on hips, gentle micro-sway */}
            {(() => {
              const swing = Math.sin(t * 0.7 + def.phase) * 2.5;
              // Left arm
              const lElbowX = shoulderC.cx - 24 * S - swing;
              const lElbowY = (shoulderC.cy + hipC.cy) / 2 + 5 * S;
              const lHandX  = hipC.cx - 6 * S;
              const lHandY  = hipC.cy - 4 * S;
              // Right arm
              const rElbowX = shoulderC.cx + 24 * S + swing;
              const rElbowY = (shoulderC.cy + hipC.cy) / 2 + 5 * S;
              const rHandX  = hipC.cx + 6 * S;
              const rHandY  = hipC.cy - 4 * S;
              return (
                <g filter="url(#chalk)">
                  <path d={`M ${shoulderC.cx} ${shoulderC.cy} Q ${lElbowX} ${lElbowY} ${lHandX} ${lHandY}`}
                    fill="none" stroke={stroke} strokeWidth={4.5 * S * 0.68} strokeLinecap="round" />
                  <path d={`M ${shoulderC.cx} ${shoulderC.cy} Q ${rElbowX} ${rElbowY} ${rHandX} ${rHandY}`}
                    fill="none" stroke={stroke} strokeWidth={4.5 * S * 0.68} strokeLinecap="round" />
                </g>
              );
            })()}
          </>
        )}
      </g>
    );
  };

  // Shared horizon ground line spanning the full group
  const groupGroundX1 = groupCX - figSpacing - 75 * figScale;
  const groupGroundX2 = groupCX + figSpacing + 75 * figScale;
  const sharedGroundY  = baseGroundY + 2;

  const flashCX = W * 0.5;
  const flashCY = H * 0.42;

  return (
    <AbsoluteFill style={{
      background: bgColor ?? "#000000",
      fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
      overflow: "hidden",
      opacity: masterOpacity,
    }}>
      <Stickman2BackgroundImage
        imageUrl={imageUrl}
        imageObjectPosition={imageObjectPosition}
        imageZoom={imageZoom}
      />
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", top: 0, left: 0, zIndex: 1 }}>
        <defs>
          <filter id="chalk" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="starBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2 0" />
          </filter>
          <filter id="fireflyGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
          </radialGradient>
        </defs>

        {/* Background stars */}
        {bgStars.map((s, i) => {
          const twinkle = s.baseOpacity * (0.7 + 0.3 * Math.sin(t * (2 * Math.PI / s.period) + s.phase));
          return <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={i % 5 === 0 ? "#B0E8FF" : "#FFFFFF"} opacity={twinkle} />;
        })}

        {/* Crescent moon */}
        <g transform={`translate(${W - (p ? 240 : 290) * scaleX}, ${(p ? 155 : 145) * scaleY}) scale(${1.55 * Math.min(scaleX, scaleY) * 1.6})`}
           filter="url(#chalk)" opacity={0.95}>
          <path d="M 30 -28 A 34 34 0 1 0 30 28 A 31 31 0 1 1 30 -28 Z"
            fill={textColor ?? "#FFFFFF"} stroke={textColor ?? "#FFFFFF"}
            strokeWidth={1.2} strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 14px rgba(255,255,255,0.65))" }} />
        </g>

        {/* Shooting stars — tapered tail with a gradient that fades from the
            bright head to transparent at the tip, like a real shooting star */}
        {starStates.map((s, i) => {
          if (!s.visible) return null;
          const head = accentColor ?? "#FFFFFF";
          // Tail tapers: wide at the head, narrowing to a point at the tip.
          const hw = 5 * scaleX;             // half-width at the head
          const perp = s.angle + Math.PI / 2;
          const px = Math.cos(perp);
          const py = Math.sin(perp);
          const headLX = s.x + px * hw;
          const headLY = s.y + py * hw;
          const headRX = s.x - px * hw;
          const headRY = s.y - py * hw;
          return (
            <g key={i} filter="url(#starBlur)">
              <defs>
                <linearGradient id={`shootTail${i}`} gradientUnits="userSpaceOnUse"
                  x1={s.x} y1={s.y} x2={s.tailX} y2={s.tailY}>
                  <stop offset="0%" stopColor={head} stopOpacity={0.95} />
                  <stop offset="35%" stopColor={head} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={head} stopOpacity={0} />
                </linearGradient>
              </defs>
              {/* Tapered tail */}
              <path d={`M ${headLX} ${headLY} L ${headRX} ${headRY} L ${s.tailX} ${s.tailY} Z`}
                fill={`url(#shootTail${i})`} />
              {/* Glowing head */}
              <circle cx={s.x} cy={s.y} r={5 * scaleX} fill={head} opacity={0.95}
                style={{ filter: `drop-shadow(0 0 8px ${head})` }} />
            </g>
          );
        })}

        {/* Fireflies */}
        {fireflies.map((f, i) => {
          const dx = 40 * Math.sin(t * (2 * Math.PI / f.period) + f.phase);
          const dy = 20 * Math.cos(t * (2 * Math.PI / (f.period * 0.7)) + f.phase * 1.3);
          const op = 0.5 + 0.3 * Math.sin(t * (2 * Math.PI / (f.period * 0.5)) + f.phase);
          return <circle key={i} cx={f.baseX + dx} cy={f.baseY + dy} r={f.r}
            fill={accentColor ?? "#FFFFFF"} opacity={op} filter="url(#fireflyGlow)" />;
        })}

        {/* Full-width horizon ground line */}
        <line
          x1={groupGroundX1} y1={sharedGroundY}
          x2={groupGroundX2} y2={sharedGroundY}
          stroke={stroke} strokeWidth={p ? 5 : 4}
          strokeLinecap="round" opacity={0.95}
          filter="url(#chalk)"
        />

        {/* Stickmen */}
        {figDefs.map((def, i) => renderFigure(def, i))}

        {/* Impact flash */}
        {flashOpacity > 0 && (
          <g opacity={flashOpacity}>
            {Array.from({ length: 8 }).map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              return <line key={i}
                x1={flashCX + Math.cos(angle) * 20 * scaleX} y1={flashCY + Math.sin(angle) * 20 * scaleY}
                x2={flashCX + Math.cos(angle) * (30 + (i % 3) * 10) * scaleX}
                y2={flashCY + Math.sin(angle) * (30 + (i % 3) * 10) * scaleY}
                stroke={accentColor ?? "#FFFFFF"} strokeWidth={2.5 * scaleX} strokeLinecap="round" />;
            })}
            <circle cx={flashCX} cy={flashCY} r={8 * scaleX} fill={accentColor ?? "#FFFFFF"} opacity={0.8} />
          </g>
        )}

        <rect x={0} y={0} width={W} height={H} fill="url(#vignette)" />
        {flashOpacity > 0 && (
          <rect x={0} y={0} width={W} height={H} fill={accentColor ?? "#FFFFFF"} opacity={flashOpacity * 0.1} />
        )}
      </svg>

      {/* Title */}
      <div style={{
        position: "absolute", top: p ? "27%" : "29%", left: "50%",
        transform: `translateX(-50%) scale(${titleScale})`,
        opacity: titleProg * masterOpacity, textAlign: "center",
        width: p ? "85%" : "75%", pointerEvents: "none",
      }}>
        <div style={{
          fontSize: titleFontSize ?? (p ? 103 : 79), fontWeight: 700,
          color: accentColor ?? "#FFFFFF",
          textShadow: `0 0 12px ${accentColor ?? "#FFFFFF"}B3, 0 0 24px ${accentColor ?? "#FFFFFF"}66`,
          lineHeight: 1.15, letterSpacing: "0.02em",
          fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
        }}>{title}</div>
        <svg width={underlineLength} height={12 * scaleY} viewBox={`0 0 ${underlineLength} ${12 * scaleY}`}
          style={{ display: "block", margin: `${8 * scaleY}px auto 0` }}>
          <polyline
            points={`0,${6 * scaleY} ${underlineLength * 0.3},${4 * scaleY} ${underlineLength * 0.6},${8 * scaleY} ${underlineLength},${5 * scaleY}`}
            fill="none" stroke={accentColor ?? "#FFFFFF"} strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={underlineLength * 1.1}
            strokeDashoffset={underlineProgress * underlineLength * 1.1} opacity={0.8} />
        </svg>
      </div>

      {/* Narration */}
      <div style={{
        position: "absolute", top: p ? "44%" : "46%", left: "50%",
        transform: `translateX(-50%) translateY(${narrationTranslateY}px)`,
        opacity: narrationProg * masterOpacity, textAlign: "center",
        width: p ? "80%" : "60%", pointerEvents: "none",
      }}>
        <div style={{
          fontSize: descriptionFontSize ?? (p ? 48 : 40),
          color: textColor ?? "#FFFFFF",
          textShadow: "0 0 6px rgba(255,255,255,0.4)",
          lineHeight: 1.5,
          fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
          fontWeight: 400,
        }}>{narration}</div>
      </div>
    </AbsoluteFill>
  );
};