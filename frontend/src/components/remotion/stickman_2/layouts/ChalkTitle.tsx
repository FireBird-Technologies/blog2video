import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { SceneLayoutProps } from "../types";
import { Stickman2BackgroundImage } from "../Stickman2BackgroundImage";

export const ChalkTitle: React.FC<SceneLayoutProps> = (props) => {
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

  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const dur = sceneDurationInFrames ?? 150;

  // Transitions
  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [dur - 18, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const masterOpacity = enter * exit;

  const accent = accentColor ?? "#FFFFFF";
  const bg = bgColor ?? "#000000";
  const text = textColor ?? "#FFFFFF";
  const ff = fontFamily ?? "'Patrick Hand', system-ui, sans-serif";

  const titlePx = titleFontSize ?? (p ? 93 : 84);
  const descPx = descriptionFontSize ?? (p ? 50 : 45);

  // ── Starfield ──────────────────────────────────────────────────────────────
  const stars = useMemo(() => {
    const count = 380;
    const arr: { x: number; y: number; r: number; phase: number; period: number; bright: boolean }[] = [];
    const rng = (seed: number) => {
      let s = seed;
      return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
    };
    const rand = rng(42);
    for (let i = 0; i < count; i++) {
      const bright = rand() > 0.82;
      arr.push({
        x: rand() * 1920,
        y: rand() * 1080,
        r: bright ? 1.8 + rand() * 1.4 : 0.8 + rand() * 1.2,
        phase: rand() * Math.PI * 2,
        period: 1.2 + rand() * 2.8,
        bright,
      });
    }
    return arr;
  }, []);

  // ── Fireflies ──────────────────────────────────────────────────────────────
  const fireflies = useMemo(() => {
    const count = 8;
    const arr: { x: number; y: number; r: number; phase: number; speedX: number; speedY: number }[] = [];
    const rng = (seed: number) => {
      let s = seed;
      return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
    };
    const rand = rng(99);
    for (let i = 0; i < count; i++) {
      arr.push({
        x: rand() * 1920,
        y: 700 + rand() * 380,
        r: 3 + rand() * 2,
        phase: rand() * Math.PI * 2,
        speedX: (rand() - 0.5) * 0.4,
        speedY: (rand() - 0.5) * 0.2,
      });
    }
    return arr;
  }, []);

  const t = frame / fps;

  // ── Title animation ────────────────────────────────────────────────────────
  // Title fades+slides in starting at frame 0, staggered feel
  const titleProgress = interpolate(frame, [0, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(titleProgress, [0, 1], [20, 0]);

  // Narration fades in after title (frame ~35 → 55)
  const narrationProgress = interpolate(frame, [35, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const narrationY = interpolate(narrationProgress, [0, 1], [20, 0]);

  // ── Stick figure animation ─────────────────────────────────────────────────
  // Figure fades in at t=0.8s
  const figFadeFrame = Math.round(0.8 * fps);
  const figOpacity = interpolate(frame, [figFadeFrame, figFadeFrame + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Figure position — bottom-right archer
  const figX = p ? 1200 : 1720;
  const figY = p ? 980 : 900;
  const figScale = p ? 1.35 : 2.05;

  const aimElevDeg = p ? 74 : 60;
  const aimRad = (aimElevDeg * Math.PI) / 180;
  const bowDownSvgDeg = p ? 18 : -12;
  const bowUpSvgDeg = p ? 78 : 30;

  const rotLocal = (px: number, py: number, ox: number, oy: number, ang: number) => {
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const dx = px - ox;
    const dy = py - oy;
    return { x: ox + dx * cos - dy * sin, y: oy + dx * sin + dy * cos };
  };

  // ── Full moon (lowered) ────────────────────────────────────────────────────
  const moonGlow = 0.65 + 0.35 * Math.sin((t * Math.PI * 2) / 4);
  const moonX = 960;
  const moonY = p ? 165 : 155;
  const moonR = p ? 62 : 72;

  // ── Looping archery cycle: down → load → raise → draw → fire → lower → repeat ─
  const cycleLen = Math.round(5.2 * fps);
  const animFrame = Math.max(0, frame - figFadeFrame);
  const cFrame = animFrame % cycleLen;

  const loadStart = Math.round(0.1 * cycleLen);
  const loadEnd = Math.round(0.26 * cycleLen);
  const raiseEnd = Math.round(0.46 * cycleLen);
  const drawEnd = Math.round(0.6 * cycleLen);
  const releaseFrame = drawEnd;
  const flightEnd = Math.round(0.9 * cycleLen);

  const loadProgress = interpolate(cFrame, [loadStart, loadEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bowRaiseProgress = interpolate(cFrame, [loadEnd, raiseEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const drawProgress = interpolate(cFrame, [raiseEnd, drawEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bowLowerProgress = interpolate(cFrame, [flightEnd, cycleLen], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const arrowFlight = interpolate(cFrame, [releaseFrame, flightEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const arrowFlying = cFrame >= releaseFrame && cFrame < flightEnd;
  const arrowLoaded = cFrame >= loadStart && cFrame < releaseFrame;

  const maxStringPull = 30;
  const stringSnapEnd = releaseFrame + Math.round(0.1 * cycleLen);
  const stringPullBack =
    cFrame < releaseFrame
      ? drawProgress * maxStringPull
      : cFrame < stringSnapEnd
        ? maxStringPull *
          (1 -
            interpolate(cFrame, [releaseFrame, stringSnapEnd], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }))
        : 0;

  let bowSvgDeg = bowDownSvgDeg;
  if (cFrame < loadEnd) {
    bowSvgDeg = bowDownSvgDeg;
  } else if (cFrame < raiseEnd) {
    bowSvgDeg = bowDownSvgDeg + (bowUpSvgDeg - bowDownSvgDeg) * bowRaiseProgress;
  } else if (cFrame < flightEnd) {
    bowSvgDeg = bowUpSvgDeg;
  } else {
    bowSvgDeg = bowUpSvgDeg + (bowDownSvgDeg - bowUpSvgDeg) * bowLowerProgress;
  }
  const bowRot = (bowSvgDeg * Math.PI) / 180;

  const bowPivotX = p ? 10 : 8;
  const bowPivotY = p ? 34 : 56;
  const bowX = bowPivotX - 6;
  const bowMidX = bowPivotX - 11;
  const stringBaseX = bowPivotX + 36;
  const stringBaseY = bowPivotY - 6;
  const toWorld = (lx: number, ly: number) => ({
    x: figX + figScale * (lx - 50),
    y: figY + figScale * (ly - 105),
  });

  const fireBowRot = (bowUpSvgDeg * Math.PI) / 180;

  const getArrowReleaseWorld = () => {
    const tip = rotLocal(bowPivotX - 18, bowPivotY, bowPivotX, bowPivotY, fireBowRot);
    return toWorld(tip.x, tip.y);
  };

  const groundY = toWorld(48, 159).y;

  const getArrowPoint = (progress: number) => {
    const start = getArrowReleaseWorld();
    const v0 = p ? 540 : 820;
    const gravity = p ? 182 : 245;
    const vx = -Math.cos(aimRad) * v0;
    const vy = -Math.sin(aimRad) * v0;
    const disc = vy * vy - 4 * gravity * (start.y - groundY);
    const totalT = disc > 0 ? (-vy + Math.sqrt(disc)) / (2 * gravity) : 2.8;
    const t = progress * totalT;
    const x = start.x + vx * t;
    const y = start.y + vy * t + gravity * t * t;
    const dx = vx;
    const dy = vy + 2 * gravity * t;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    return { x, y, angle };
  };

  // Side-profile archer — camera on the figure's right, facing left toward the moon
  const ArcherStickman: React.FC<{ figX: number; figY: number; scale?: number; opacity?: number }> = ({
    figX,
    figY,
    scale = 1.5,
    opacity = 1,
  }) => {
    const stroke = text;
    const tt = frame * 0.05;
    const breath = Math.sin(tt * 1.2) * 1.2;

    const cx = 48;
    const hipY = 105 + breath * 0.3;
    const shoulderY = 58 + breath * 0.5;
    const headY = 30 + breath * 0.6;
    const headR = 14;

    const pivotY = bowPivotY + breath * 0.4;

    const bowHand = rotLocal(bowPivotX, pivotY, bowPivotX, pivotY, bowRot);
    const stringHand = rotLocal(
      stringBaseX + stringPullBack,
      stringBaseY + breath * 0.3,
      bowPivotX,
      pivotY,
      bowRot,
    );
    const bowElbow = {
      x: (cx + bowHand.x) / 2 - (p ? 4 : 2),
      y: (shoulderY + bowHand.y) / 2 - (p ? 18 : 12),
    };
    const stringElbow = {
      x: (cx + stringHand.x) / 2 + (p ? 14 : 12),
      y: (shoulderY + stringHand.y) / 2 - (p ? 12 : 8),
    };

    const frontFootX = 40;
    const backFootX = 56;
    const footY = 155;

    const arrowTip = rotLocal(bowPivotX - 18, pivotY, bowPivotX, pivotY, bowRot);
    const arrowNock = rotLocal(bowPivotX - 4 + stringPullBack * 0.35, pivotY, bowPivotX, pivotY, bowRot);

    return (
      <g transform={`translate(${figX}, ${figY}) scale(${scale})`} opacity={opacity} filter="url(#chalk-fig)">
        <g transform="translate(-50, -105)" strokeLinecap="round" strokeLinejoin="round">
          <line x1={cx} y1={hipY} x2={frontFootX} y2={footY} stroke={stroke} strokeWidth={5} />
          <line x1={cx} y1={hipY} x2={backFootX} y2={footY} stroke={stroke} strokeWidth={5} />
          <line
            x1={26}
            y1={footY + 5}
            x2={70}
            y2={footY + 5}
            stroke={stroke}
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.85}
          />
          <line x1={cx} y1={shoulderY} x2={cx} y2={hipY} stroke={stroke} strokeWidth={5} />
          <g transform={`rotate(${bowSvgDeg}, ${bowPivotX}, ${pivotY})`}>
            <path
              d={`M ${bowX} ${pivotY - 22 + breath * 0.4} Q ${bowMidX} ${pivotY + breath * 0.4} ${bowX} ${pivotY + 22 + breath * 0.4}`}
              stroke={stroke}
              strokeWidth={3.5}
              fill="none"
            />
            <line
              x1={bowX}
              y1={pivotY - 22 + breath * 0.4}
              x2={stringBaseX + stringPullBack}
              y2={stringBaseY + breath * 0.3}
              stroke={stroke}
              strokeWidth={1.5}
              opacity={0.9}
            />
            <line
              x1={bowX}
              y1={pivotY + 22 + breath * 0.4}
              x2={stringBaseX + stringPullBack}
              y2={stringBaseY + breath * 0.3}
              stroke={stroke}
              strokeWidth={1.5}
              opacity={0.9}
            />
          </g>
          {arrowLoaded && !arrowFlying && (
            <line
              x1={arrowNock.x}
              y1={arrowNock.y}
              x2={arrowTip.x}
              y2={arrowTip.y}
              stroke={accent}
              strokeWidth={1.2}
              strokeLinecap="round"
              opacity={cFrame < loadEnd ? 0.3 + loadProgress * 0.7 : 0.95}
            />
          )}
          <path d={`M ${cx} ${shoulderY} Q ${bowElbow.x} ${bowElbow.y} ${bowHand.x} ${bowHand.y}`} stroke={stroke} strokeWidth={4.5} fill="none" />
          <path d={`M ${cx} ${shoulderY} Q ${stringElbow.x} ${stringElbow.y} ${stringHand.x} ${stringHand.y}`} stroke={stroke} strokeWidth={4.5} fill="none" />
          <circle cx={cx} cy={headY} r={headR} stroke={stroke} strokeWidth={4.5} fill="none" />
          <line x1={cx - headR + 2} y1={headY} x2={cx - headR - 7} y2={headY + 1} stroke={stroke} strokeWidth={3} strokeLinecap="round" />
          <circle cx={bowHand.x} cy={bowHand.y} r={2.5} fill={stroke} />
          <circle cx={stringHand.x} cy={stringHand.y} r={2.5} fill={stroke} />
        </g>
      </g>
    );
  };

  const FlyingArrow: React.FC = () => {
    if (!arrowFlying) return null;
    const { x, y, angle } = getArrowPoint(arrowFlight);
    const tailLen = 48;
    const rad = (angle * Math.PI) / 180;
    const tailX = x - Math.cos(rad) * tailLen;
    const tailY = y - Math.sin(rad) * tailLen;
    const headX = x + Math.cos(rad) * 7;
    const headY = y + Math.sin(rad) * 7;
    const wing = 4;
    const perpX = -Math.sin(rad);
    const perpY = Math.cos(rad);
    return (
      <g opacity={figOpacity} filter="url(#chalk-fig)">
        <line x1={tailX} y1={tailY} x2={headX} y2={headY} stroke={accent} strokeWidth={1.2} strokeLinecap="round" />
        <line
          x1={x - Math.cos(rad) * 6}
          y1={y - Math.sin(rad) * 6}
          x2={x - Math.cos(rad) * 6 + perpX * wing}
          y2={y - Math.sin(rad) * 6 + perpY * wing}
          stroke={accent}
          strokeWidth={0.8}
          strokeLinecap="round"
        />
        <line
          x1={x - Math.cos(rad) * 6}
          y1={y - Math.sin(rad) * 6}
          x2={x - Math.cos(rad) * 6 - perpX * wing}
          y2={y - Math.sin(rad) * 6 - perpY * wing}
          stroke={accent}
          strokeWidth={0.8}
          strokeLinecap="round"
        />
        <polygon
          points={`${headX},${headY} ${x + perpX * 3 - Math.cos(rad) * 3},${y + perpY * 3 - Math.sin(rad) * 3} ${x - perpX * 3 - Math.cos(rad) * 3},${y - perpY * 3 - Math.sin(rad) * 3}`}
          fill={accent}
        />
      </g>
    );
  };

  // Title glow pulse
  const titleGlow = 0.7 + 0.3 * Math.sin((t * Math.PI * 2) / 2.2);

  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden", opacity: masterOpacity }}>

      {/* ── Layer 1: Optional full-bleed image ── */}
      <Stickman2BackgroundImage
        imageUrl={imageUrl}
        imageObjectPosition={imageObjectPosition}
        imageZoom={imageZoom}
      />

      {/* ── Layer 2: Starfield ── */}
      <AbsoluteFill style={{ zIndex: 1 }}>
        <svg width="100%" height="100%" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
          <defs>
            <filter id="chalk-jitter">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="2" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
          {stars.map((s, i) => {
            const twinkle = 0.5 + 0.5 * Math.sin(t * (Math.PI * 2) / s.period + s.phase);
            const shine = 0.5 + 0.5 * Math.sin(t * (Math.PI * 2) / (s.period * 0.6) + s.phase * 1.7);
            const opacity = s.bright
              ? 0.35 + 0.65 * twinkle * shine
              : 0.2 + 0.55 * twinkle;
            const glowR = s.r * (1 + shine * (s.bright ? 2.5 : 1.2));
            return (
              <g key={i}>
                {s.bright && (
                  <circle
                    cx={s.x}
                    cy={s.y}
                    r={glowR}
                    fill={i % 5 === 0 ? accent : "white"}
                    opacity={opacity * 0.25}
                  />
                )}
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={s.r}
                  fill={i % 5 === 0 ? accent : "white"}
                  opacity={opacity}
                />
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>

      {/* ── Layer 3: Radial vignette ── */}
      <AbsoluteFill
        style={{
          zIndex: 2,
          background: "radial-gradient(ellipse 80% 45% at 50% 50%, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.72) 100%)",
        }}
      />

      {/* ── Layer 4: Title ── */}
      <AbsoluteFill style={{ zIndex: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start" }}>
        <div
          style={{
            position: "absolute",
            top: p ? "38%" : "42%",
            left: "50%",
            transform: `translate(-50%, -50%) translateY(${titleY}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: titleProgress,
            width: p ? "90%" : "80%",
          }}
        >
          {/* Title */}
          <div
            style={{
              fontFamily: ff,
              fontSize: titleFontSize ?? (p ? 93 : 84),
              fontWeight: 700,
              color: accent,
              textAlign: "center",
              letterSpacing: "0.04em",
              lineHeight: 1.15,
              filter: `drop-shadow(0 0 12px rgba(255,255,255,${titleGlow * 0.7}))`,
              textShadow: `0 0 24px rgba(255,255,255,0.5), 0 0 8px rgba(255,255,255,0.3)`,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {title}
          </div>
        </div>

        {/* ── Layer 5: Narration ── */}
        {narration && (
          <div
            style={{
              position: "absolute",
              top: p ? "56%" : "58%",
              left: "50%",
              transform: `translate(-50%, -50%) translateY(${narrationY}px)`,
              opacity: narrationProgress,
              width: p ? "85%" : "70%",
              textAlign: "center",
              fontFamily: ff,
              fontSize: descriptionFontSize ?? (p ? 50 : 45),
              color: text,
              lineHeight: 1.5,
              filter: `drop-shadow(0 0 6px rgba(255,255,255,0.4))`,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {narration}
          </div>
        )}
      </AbsoluteFill>

      {/* ── Layer 6: Stargazing stick figure ── */}
      <AbsoluteFill style={{ zIndex: 4 }}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1920 1080"
          preserveAspectRatio="xMidYMid slice"
          style={{ overflow: "visible" }}
        >
          <defs>
            <filter id="chalk-fig">
              <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="5" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.2" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            {/* Streetlamp glow */}
            <radialGradient id="lamp-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255,240,180,0.35)" />
              <stop offset="100%" stopColor="rgba(255,240,180,0)" />
            </radialGradient>
            <radialGradient id="moon-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255,255,240,0.45)" />
              <stop offset="100%" stopColor="rgba(255,255,240,0)" />
            </radialGradient>
          </defs>

          {/* Archer + arrow (arrow drawn below moon layer) */}
          <ArcherStickman figX={figX} figY={figY} scale={figScale} opacity={figOpacity} />
          <FlyingArrow />

          {/* Full moon — centered, lowered; arrow passes underneath */}
          <g transform={`translate(${moonX}, ${moonY})`} opacity={moonGlow * 0.95} filter="url(#chalk-fig)">
            <circle cx={0} cy={0} r={moonR * 1.55} fill="url(#moon-glow)" />
            <circle
              cx={0}
              cy={0}
              r={moonR}
              fill={text}
              stroke={text}
              strokeWidth={1.5}
              style={{ filter: `drop-shadow(0 0 18px rgba(255,255,255,0.55))` }}
            />
            <ellipse cx={-18} cy={-12} rx={14} ry={11} fill={bg} opacity={0.12} />
            <ellipse cx={22} cy={8} rx={18} ry={14} fill={bg} opacity={0.1} />
            <ellipse cx={-8} cy={24} rx={11} ry={9} fill={bg} opacity={0.14} />
            <ellipse cx={30} cy={-20} rx={9} ry={7} fill={bg} opacity={0.09} />
            <ellipse cx={-32} cy={14} rx={8} ry={6} fill={bg} opacity={0.11} />
          </g>

          {/* Streetlamp near figure */}
          <g transform={`translate(${figX - 120}, ${figY - 60})`} opacity={figOpacity * 0.85}>
            {/* Lamp glow */}
            <circle cx={0} cy={-160} r={50} fill="url(#lamp-glow)" />
            {/* Post */}
            <line
              x1={0} y1={0}
              x2={0} y2={-150}
              stroke={text}
              strokeWidth={2.5}
              strokeLinecap="round"
              filter="url(#chalk-fig)"
            />
            {/* Arm */}
            <line
              x1={0} y1={-150}
              x2={20} y2={-165}
              stroke={text}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            {/* Hexagonal lantern head (simplified as polygon) */}
            <polygon
              points="20,-155 28,-160 28,-170 20,-175 12,-170 12,-160"
              stroke={text}
              strokeWidth={2}
              fill="rgba(255,240,180,0.15)"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </AbsoluteFill>

      {/* ── Layer 7: Fireflies ── */}
      <AbsoluteFill style={{ zIndex: 5, pointerEvents: "none" }}>
        <svg width="100%" height="100%" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
          {fireflies.map((ff, i) => {
            const fx = ff.x + Math.sin(t * 0.3 + ff.phase) * 80 + ff.speedX * frame * 0.5;
            const fy = ff.y + Math.cos(t * 0.2 + ff.phase * 1.3) * 40 + ff.speedY * frame * 0.3;
            const fOpacity = 0.5 + 0.3 * Math.sin(t * (Math.PI * 2) / 2.5 + ff.phase);
            return (
              <circle
                key={i}
                cx={((fx % 1920) + 1920) % 1920}
                cy={((fy - 700) % 380 + 380) % 380 + 700}
                r={ff.r}
                fill={accent}
                opacity={fOpacity}
                style={{ filter: `blur(6px) drop-shadow(0 0 ${ff.r * 2}px ${accent})` }}
              />
            );
          })}
        </svg>
      </AbsoluteFill>

    </AbsoluteFill>
  );
};
