import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";

export const SignalFireScene: React.FC<SceneLayoutProps> = (props) => {
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

  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const dur = sceneDurationInFrames ?? 150;

  // Transitions
  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [dur - 18, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const masterOpacity = enter * exit;

  // Typography
  const titlePx = titleFontSize ?? (p ? 106 : 103);
  const descPx = descriptionFontSize ?? (p ? 57 : 54);

  // Canvas dimensions
  const W = p ? 1080 : 1920;
  const H = p ? 1920 : 1080;

  const t = frame / fps;
  const accent = accentColor ?? "#FFFFFF";
  const stroke = textColor ?? "#FFFFFF";
  const font = fontFamily ?? "'Patrick Hand', system-ui, sans-serif";

  // Deterministic pseudo-random
  const rnd = (n: number) => {
    const s = Math.sin(n * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  };

  // ── Repeated gunshot timing ────────────────────────────────────────────────
  const firstShotFrame = Math.round(0.7 * fps);
  const shotPeriod = Math.round(1.6 * fps);
  const shotTravel = Math.round(0.5 * fps); // slower bullet

  // Burst point for shot k — spread wide across the top so each shot leaves
  // the muzzle at a clearly different angle, but always aimed upward.
  const burstPoint = (k: number) => ({
    x: W * (0.1 + rnd(k * 1.7 + 0.5) * 0.8),
    y: (p ? H * 0.08 : H * 0.1) + rnd(k * 2.9 + 0.3) * (p ? H * 0.12 : H * 0.14),
  });

  // All shots fired so far
  const shots: { k: number; fireFrame: number }[] = [];
  for (let k = 0; ; k++) {
    const f = firstShotFrame + k * shotPeriod;
    if (f > frame) break;
    shots.push({ k, fireFrame: f });
  }
  const currentShot = shots.length ? shots[shots.length - 1] : null;
  const aimK = currentShot ? currentShot.k : 0;
  const aimTarget = burstPoint(aimK);

  const sinceFire = currentShot ? frame - currentShot.fireFrame : -999;
  const recoil = sinceFire >= 0 ? Math.exp(-sinceFire / 4) : 0; // sharp kick, quick decay
  const muzzleFlash = currentShot
    ? interpolate(frame, [currentShot.fireFrame, currentShot.fireFrame + 1, currentShot.fireFrame + 5], [0, 1, 0], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      })
    : 0;
  const shotProg = currentShot
    ? interpolate(frame, [currentShot.fireFrame, currentShot.fireFrame + shotTravel], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;
  const shotActive = currentShot != null && sinceFire >= 0 && sinceFire <= shotTravel + 1;

  // Screen flash on each burst
  const sinceCurrentBurst = currentShot ? frame - (currentShot.fireFrame + shotTravel) : -999;
  const burstFlash = interpolate(sinceCurrentBurst, [0, 2, 9], [0, 0.35, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Title / narration reveal — triggered by the first burst
  const firstBurst = firstShotFrame + shotTravel;
  const titleProgress = interpolate(frame, [firstBurst, firstBurst + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const narrationOpacity = interpolate(frame, [firstBurst + 14, firstBurst + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleOpacity = interpolate(titleProgress, [0, 0.3, 1], [0, 0.7, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── Background elements ──────────────────────────────────────────────────
  const stars = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < 150; i++) {
      const seed = i * 137.508;
      arr.push({
        x: (Math.sin(seed) * 0.5 + 0.5) * W,
        y: (Math.cos(seed * 1.618) * 0.5 + 0.5) * H,
        r: 1 + (Math.sin(seed * 2.1) * 0.5 + 0.5),
        baseOpacity: 0.4 + (Math.sin(seed * 7.1) * 0.5 + 0.5) * 0.5,
        period: 2 + (Math.sin(seed * 3.7) * 0.5 + 0.5) * 3,
        phase: (Math.sin(seed * 5.3) * 0.5 + 0.5) * Math.PI * 2,
      });
    }
    return arr;
  }, [W, H]);

  const fireflies = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < 8; i++) {
      const seed = i * 73.1 + 11;
      arr.push({
        baseX: (Math.sin(seed) * 0.5 + 0.5) * W,
        baseY: (Math.cos(seed * 2.1) * 0.5 + 0.5) * (H * 0.5),
        r: 3 + (Math.sin(seed * 4.1) * 0.5 + 0.5) * 2,
        period: 4 + (Math.sin(seed * 6.7) * 0.5 + 0.5) * 4,
        phase: (Math.sin(seed * 8.9) * 0.5 + 0.5) * Math.PI * 2,
        driftX: 40 + (Math.sin(seed * 1.7) * 0.5 + 0.5) * 60,
        driftY: 20 + (Math.sin(seed * 3.3) * 0.5 + 0.5) * 40,
      });
    }
    return arr;
  }, [W, H]);

  // ── Layout positions ────────────────────────────────────────────────────
  const groundY = p ? H * 0.88 : 860;
  const figScale = p ? 2.3 : 2.1;
  const figX = p ? W * 0.74 : 1700;
  const figGroundY = groundY;

  // ── Stick figure geometry (origin = feet) ─────────────────────────────────
  const breathing = Math.sin(t * 1.4) * 1.0;
  const bob = Math.sin(t * 0.9) * 1.4;
  const leanDeg = recoil * 7; // backward lean on recoil

  const hipLY = -46;
  const shoulderLY = hipLY - 44 + bob;
  const headR = 15;
  const headLY = shoulderLY - 24 - breathing - headR;
  const footLX = -13, footRX = 13, footY = 0;

  const S = figScale;
  const toC = (lx: number, ly: number) => ({ x: figX + lx * S, y: figGroundY + ly * S });
  const shoulderC = toC(0, shoulderLY);

  // Aiming arm + gun — points from shoulder toward the burst point.
  const aimSway = !currentShot ? Math.sin(t * 1.5) * 0.04 : 0;
  const aimAngle = Math.atan2(aimTarget.y - shoulderC.y, aimTarget.x - shoulderC.x) - recoil * 0.18 + aimSway;
  const aimDeg = (aimAngle * 180) / Math.PI;
  const armLen = 34 * S;
  const recoilBack = recoil * 9;
  const elbowX = shoulderC.x + Math.cos(aimAngle - 0.22) * armLen * 0.5;
  const elbowY = shoulderC.y + Math.sin(aimAngle - 0.22) * armLen * 0.5;
  const handX = elbowX + Math.cos(aimAngle) * armLen * 0.5 - Math.cos(aimAngle) * recoilBack;
  const handY = elbowY + Math.sin(aimAngle) * armLen * 0.5 - Math.sin(aimAngle) * recoilBack;

  // Gun geometry (local units along +x = barrel, +y = down), scaled by gunUnit.
  // When the barrel points left, mirror vertically so the grip/magazine stays
  // pointing down instead of flipping up.
  const gunUnit = S * 0.7;
  const gunFlip = Math.cos(aimAngle) < 0 ? -1 : 1;
  const muzzleLocalX = 44, muzzleLocalY = -2;
  const muzzleX = handX + (Math.cos(aimAngle) * muzzleLocalX - Math.sin(aimAngle) * muzzleLocalY) * gunUnit;
  const muzzleY = handY + (Math.sin(aimAngle) * muzzleLocalX + Math.cos(aimAngle) * muzzleLocalY) * gunUnit;

  // Support (off-)hand braces the gun, just behind the hand → two-handed grip
  const supportHandX = handX - Math.cos(aimAngle) * 9 * S * 0.5 + Math.cos(aimAngle + Math.PI / 2) * 5 * S * 0.5;
  const supportHandY = handY - Math.sin(aimAngle) * 9 * S * 0.5 + Math.sin(aimAngle + Math.PI / 2) * 5 * S * 0.5;
  const supportElbowX = (shoulderC.x + supportHandX) / 2 - 8 * S;
  const supportElbowY = (shoulderC.y + supportHandY) / 2 + 10 * S;

  // Shot streak (muzzle → burst)
  const shotHeadX = muzzleX + (aimTarget.x - muzzleX) * shotProg;
  const shotHeadY = muzzleY + (aimTarget.y - muzzleY) * shotProg;
  const shotTailF = Math.max(0, shotProg - 0.3);
  const shotTailX = muzzleX + (aimTarget.x - muzzleX) * shotTailF;
  const shotTailY = muzzleY + (aimTarget.y - muzzleY) * shotTailF;

  // ── Shining star created by each shot ─────────────────────────────────────
  // When the bullet reaches its burst point it pops into a twinkling 4-point
  // sparkle that stays lit in the sky. Repeated shots accumulate more stars.
  const renderStar = (k: number) => {
    const burstFrameK = firstShotFrame + k * shotPeriod + shotTravel;
    const since = frame - burstFrameK;
    if (since < 0) return null;
    const { x: bx, y: by } = burstPoint(k);

    const sinceSec = since / fps;
    const starLifeSec = 3.0; // shines for a few seconds, then fades out
    const fadeOutSec = 0.8;
    if (sinceSec > starLifeSec + fadeOutSec) return null;

    const pop = interpolate(since, [0, 6, 12], [0, 1.25, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }); // overshoot pop-in
    const appear = interpolate(since, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const fadeOut = interpolate(sinceSec, [starLifeSec, starLifeSec + fadeOutSec], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const twinkle = 0.8 + 0.2 * Math.sin(frame * 0.18 + k * 1.3);
    const R = (p ? 46 : 40) * pop;
    const ri = R * 0.34;
    const op = appear * twinkle * fadeOut;

    // 4-point sparkle path (alternating outer/inner radius)
    let d = "";
    for (let i = 0; i < 8; i++) {
      const ang = ((-90 + i * 45) * Math.PI) / 180;
      const rr = i % 2 === 0 ? R : ri;
      const px = bx + Math.cos(ang) * rr;
      const py = by + Math.sin(ang) * rr;
      d += `${i === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)} `;
    }
    d += "Z";

    const rayLen = R * (2.0 + 0.5 * Math.sin(frame * 0.2 + k));
    return (
      <g key={`star-${k}`} filter="url(#glow)" opacity={op}>
        {/* soft halo */}
        <circle cx={bx} cy={by} r={R * 1.3} fill={accent} opacity={0.12} />
        {/* lens-flare cross rays */}
        <line x1={bx - rayLen} y1={by} x2={bx + rayLen} y2={by} stroke="#FFFFFF" strokeWidth={2} opacity={0.7} strokeLinecap="round" />
        <line x1={bx} y1={by - rayLen} x2={bx} y2={by + rayLen} stroke="#FFFFFF" strokeWidth={2} opacity={0.7} strokeLinecap="round" />
        {/* star body */}
        <path d={d} fill="#FFFFFF" stroke={accent} strokeWidth={1.5} strokeLinejoin="round" />
        <circle cx={bx} cy={by} r={R * 0.18} fill="#FFFFFF" />
      </g>
    );
  };

  return (
    <AbsoluteFill
      style={{
        background: bgColor ?? "#000000",
        fontFamily: font,
        opacity: masterOpacity,
        overflow: "hidden",
      }}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", top: 0, left: 0 }}>
        <defs>
          <filter id="chalkFilter" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="fireflyGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Starfield */}
        {stars.map((star, i) => {
          const op = star.baseOpacity * (0.7 + 0.3 * Math.sin(t * (2 * Math.PI / star.period) + star.phase));
          return <circle key={`star-${i}`} cx={star.x} cy={star.y} r={star.r} fill="#E0F4FF" opacity={op} />;
        })}

        {/* Crescent moon top-right */}
        <g transform={p ? `translate(${W - 120}, 80)` : `translate(${W - 160}, 70)`}>
          <circle cx={0} cy={0} r={36} fill="none" stroke="#FFFFFF" strokeWidth={2.5} opacity={0.85} />
          <circle cx={14} cy={-8} r={30} fill={bgColor ?? "#000000"} />
        </g>

        {/* Fireflies */}
        {fireflies.map((ff, i) => {
          const ffX = ff.baseX + ff.driftX * Math.sin(t * (2 * Math.PI / ff.period) + ff.phase);
          const ffY = ff.baseY + ff.driftY * Math.cos(t * (2 * Math.PI / (ff.period * 0.7)) + ff.phase * 1.3);
          const ffOpacity = 0.5 + 0.3 * Math.sin(t * (2 * Math.PI / (ff.period * 0.5)) + ff.phase);
          return <circle key={`ff-${i}`} cx={ffX} cy={ffY} r={ff.r} fill={accent} opacity={ffOpacity} filter="url(#fireflyGlow)" />;
        })}

        {/* Ground line — rough chalk polyline */}
        <polyline
          points={`0,${groundY} ${W * 0.08},${groundY + 3} ${W * 0.18},${groundY - 2} ${W * 0.3},${groundY + 4} ${W * 0.42},${groundY - 1} ${W * 0.55},${groundY + 3} ${W * 0.65},${groundY - 3} ${W * 0.75},${groundY + 2} ${W * 0.85},${groundY - 2} ${W * 0.92},${groundY + 3} ${W},${groundY}`}
          fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          opacity={0.25} filter="url(#chalkFilter)"
        />

        {/* Shining stars created by each shot */}
        {shots.map((s) => renderStar(s.k))}

        {/* Shot streak */}
        {shotActive && (
          <g filter="url(#glow)">
            <line x1={shotTailX} y1={shotTailY} x2={shotHeadX} y2={shotHeadY}
              stroke={accent} strokeWidth={4} strokeLinecap="round" opacity={0.9} />
            <circle cx={shotHeadX} cy={shotHeadY} r={6} fill={accent} />
          </g>
        )}

        {/* Stick figure — standing on the right, two-handed aim upward */}
        <g filter="url(#chalkFilter)" transform={`rotate(${leanDeg}, ${figX}, ${figGroundY})`}>
          {/* Body (feet-anchored local coords) */}
          <g transform={`translate(${figX}, ${figGroundY}) scale(${S})`} strokeLinecap="round" strokeLinejoin="round">
            <circle cx={0} cy={headLY} r={headR} stroke={stroke} strokeWidth={4.5} fill="none" />
            <line x1={0} y1={shoulderLY} x2={0} y2={hipLY} stroke={stroke} strokeWidth={5} />
            <line x1={0} y1={hipLY} x2={footLX} y2={footY} stroke={stroke} strokeWidth={4.5} />
            <line x1={0} y1={hipLY} x2={footRX} y2={footY} stroke={stroke} strokeWidth={4.5} />
          </g>

          {/* Arms (canvas-space) */}
          <g strokeLinecap="round" strokeLinejoin="round">
            {/* Support arm */}
            <line x1={shoulderC.x} y1={shoulderC.y} x2={supportElbowX} y2={supportElbowY} stroke={stroke} strokeWidth={4.5 * S * 0.7} />
            <line x1={supportElbowX} y1={supportElbowY} x2={supportHandX} y2={supportHandY} stroke={stroke} strokeWidth={4.5 * S * 0.7} />
            {/* Aiming arm */}
            <line x1={shoulderC.x} y1={shoulderC.y} x2={elbowX} y2={elbowY} stroke={stroke} strokeWidth={4.5 * S * 0.7} />
            <line x1={elbowX} y1={elbowY} x2={handX} y2={handY} stroke={stroke} strokeWidth={4.5 * S * 0.7} />
          </g>

          {/* Gun — detailed semi-auto pistol held at the hand */}
          <g transform={`translate(${handX}, ${handY}) rotate(${aimDeg}) scale(${gunUnit}, ${gunUnit * gunFlip})`}>
            {/* ── Barrel ── */}
            <rect x={10} y={-5} width={38} height={6} rx={1.5} fill={stroke} />
            {/* Barrel underside / dust cover rail */}
            <rect x={12} y={1} width={30} height={3} rx={1} fill={stroke} opacity={0.7} />
            {/* Muzzle crown (ring at barrel end) */}
            <rect x={46} y={-6} width={3} height={8} rx={1} fill={stroke} />

            {/* ── Slide ── */}
            <rect x={-2} y={-9} width={48} height={11} rx={2.5} fill={stroke} />
            {/* Slide serrations (rear) — parallel notches cut into the slide */}
            {[0,3,6,9,12].map((ox) => (
              <line key={ox} x1={6+ox} y1={-9} x2={6+ox} y2={-4}
                stroke={bgColor ?? "#000000"} strokeWidth={1.3} strokeLinecap="round" opacity={0.85} />
            ))}
            {/* Ejection port cut-out */}
            <rect x={20} y={-9} width={14} height={5} rx={1} fill={bgColor ?? "#000000"} opacity={0.9} />

            {/* ── Frame / receiver ── */}
            <rect x={-2} y={2} width={30} height={7} rx={1.5} fill={stroke} />
            {/* Trigger guard — smooth curved outline */}
            <path d="M 8 9 Q 7 22 0 23 Q -3 23 -3 20 Q -3 16 2 15 Q 6 15 8 9 Z"
              fill={stroke} />
            {/* Trigger */}
            <line x1={4} y1={11} x2={3} y2={19} stroke={bgColor ?? "#000000"} strokeWidth={2} strokeLinecap="round" />

            {/* ── Grip ── */}
            {/* Main grip body — angled pistol grip */}
            <path d="M -2 9 L 14 9 L 18 32 L -1 32 Z" fill={stroke} />
            {/* Grip texture — horizontal stippling lines */}
            {[13,17,21,25,29].map((gy) => (
              <line key={gy} x1={0} y1={gy} x2={13} y2={gy + 1}
                stroke={bgColor ?? "#000000"} strokeWidth={1.1} strokeLinecap="round" opacity={0.7} />
            ))}
            {/* Magazine base plate */}
            <rect x={-1} y={30} width={16} height={3} rx={1} fill={stroke} opacity={0.9} />
            {/* Magazine release button */}
            <circle cx={14} cy={11} r={2} fill={bgColor ?? "#000000"} opacity={0.8} />

            {/* ── Sights ── */}
            {/* Rear sight (two posts) */}
            <rect x={1}  y={-13} width={3} height={5} rx={0.8} fill={stroke} />
            <rect x={7}  y={-13} width={3} height={5} rx={0.8} fill={stroke} />
            {/* Rear sight notch gap */}
            <rect x={4}  y={-13} width={3} height={4} rx={0.5} fill={bgColor ?? "#000000"} opacity={0.9} />
            {/* Front sight */}
            <rect x={43} y={-13} width={3} height={5} rx={0.8} fill={stroke} />

            {/* ── Rail / accessory rail on frame ── */}
            <line x1={12} y1={4} x2={26} y2={4} stroke={bgColor ?? "#000000"} strokeWidth={1.2} opacity={0.6} />
            <line x1={12} y1={6} x2={26} y2={6} stroke={bgColor ?? "#000000"} strokeWidth={1.2} opacity={0.6} />

            {/* ── Hammer (exposed, cocked back) ── */}
            <path d="M -2 -5 Q -7 -9 -5 -13 Q -3 -15 -1 -12 Q 0 -10 -2 -5 Z" fill={stroke} />
          </g>

          {/* Muzzle flash */}
          {muzzleFlash > 0 && (
            <g opacity={muzzleFlash} filter="url(#glow)">
              <circle cx={muzzleX} cy={muzzleY} r={15 * S * 0.5} fill={accent} />
              {Array.from({ length: 6 }).map((_, i) => {
                const a = aimAngle + (i - 2.5) * 0.34;
                const len = (12 + (i % 2) * 9) * S * 0.6;
                return <line key={i} x1={muzzleX} y1={muzzleY}
                  x2={muzzleX + Math.cos(a) * len} y2={muzzleY + Math.sin(a) * len}
                  stroke={accent} strokeWidth={3} strokeLinecap="round" />;
              })}
            </g>
          )}
        </g>
      </svg>

      {/* Radial vignette */}
      <div
        style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
          background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Burst screen flash */}
      {burstFlash > 0 && (
        <div style={{ position: "absolute", inset: 0, background: "#FFFFFF", opacity: burstFlash, pointerEvents: "none" }} />
      )}

      {/* Title + narration — centred in the middle of the screen */}
      <div
        style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: p ? "0 60px" : "0 140px",
          boxSizing: "border-box",
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${interpolate(titleProgress, [0, 1], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
            fontSize: titlePx,
            fontWeight: 700,
            color: accent,
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
            textShadow: `0 0 12px rgba(255,255,255,0.7), 0 0 24px rgba(255,255,255,0.3)`,
            fontFamily: font,
            wordBreak: "break-word",
          }}
        >
          {title}
        </div>

        {/* Chalk underline */}
        <svg width={p ? 480 : 520} height={14} viewBox={`0 0 ${p ? 480 : 520} 14`} style={{ display: "block", marginTop: 10 }}>
          <polyline
            points={`0,7 ${(p ? 480 : 520) * 0.3},10 ${(p ? 480 : 520) * 0.6},5 ${p ? 480 : 520},8`}
            fill="none" stroke={accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={p ? 480 : 520}
            strokeDashoffset={interpolate(titleProgress, [0, 1], [p ? 480 : 520, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
            opacity={0.8}
          />
        </svg>

        {narration && (
          <div
            style={{
              marginTop: 22,
              opacity: narrationOpacity,
              transform: `translateY(${interpolate(narrationOpacity, [0, 1], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
              fontSize: descPx,
              color: stroke,
              lineHeight: 1.55,
              textShadow: `0 0 6px rgba(255,255,255,0.4)`,
              fontFamily: font,
              maxWidth: p ? W - 160 : 1100,
              wordBreak: "break-word",
            }}
          >
            {narration}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
