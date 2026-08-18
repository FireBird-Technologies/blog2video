import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import { Stickman2BackgroundImage } from "../Stickman2BackgroundImage";

/**
 * NightWalkV2 — "Lamppost"
 *
 * Variant of `night_walk`. Same props, different composition.
 *
 * Base tracks a figure walking left→right past three streetlamps, with the copy
 * column pinned top-left. This one is the stationary counterpoint: the figure has
 * already arrived and LEANS against a single tall lamppost, the lamp lit from the
 * first frame, and the copy column mirrors to the RIGHT of the post.
 *
 * Two things replace the base's motion:
 *   - the procedural walk cycle becomes a procedural IDLE (breath on the
 *     shoulders/head plus a slow head-turn), so the figure is alive but planted;
 *   - the base's lamp reaction (`interpolate(figureX, …)`, which needs a moving
 *     figure) becomes a gas-lamp flicker on a slow sine.
 *
 * PORTRAIT: all geometry is authored in the fixed 1920×1080 design space and
 * sliced by the viewBox, so portrait only reveals roughly x 656–1264. The post
 * and the leaning figure therefore sit around x≈820 — NOT the base's x=1480,
 * which would fall outside the portrait window entirely.
 */
export const NightWalkV2: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    imageUrl,
    imageObjectPosition,
    imageZoom,
    videoUrl,
    videoMuted,
    videoVolume,
    videoDurationInFrames,
    videoStartInFrames,
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

  // ── Starfield ──────────────────────────────────────────────────────────────
  // Own seed so this scene's sky differs from the base's, still deterministic.
  const stars = useMemo(() => {
    const arr: { x: number; y: number; r: number; phase: number; period: number; opacity: number }[] = [];
    const rng = (seed: number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };
    const rand = rng(207);
    for (let i = 0; i < 170; i++) {
      arr.push({ x: rand() * 1920, y: rand() * 1080, r: 1 + rand() * 1, phase: rand() * Math.PI * 2, period: 2 + rand() * 3, opacity: 0.4 + rand() * 0.5 });
    }
    return arr;
  }, []);

  // ── Fireflies ──────────────────────────────────────────────────────────────
  const fireflies = useMemo(() => {
    const arr: { x: number; y: number; phase: number; r: number }[] = [];
    const rng = (seed: number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };
    const rand = rng(451);
    for (let i = 0; i < 8; i++) {
      arr.push({ x: rand() * 1920, y: 750 + rand() * 280, phase: rand() * Math.PI * 2, r: 3 + rand() * 2 });
    }
    return arr;
  }, []);

  // ── Canvas ─────────────────────────────────────────────────────────────────
  const W = p ? 1080 : 1920;
  const H = p ? 1920 : 1080;

  const figureY = p ? 955 : 900;
  const groundY = figureY;

  // Portrait viewBox slice shows roughly x 656–1264 in design space.
  const portraitVisibleX = { min: 656, max: 1264 };

  // The post anchors the composition. Portrait puts it just left of the visible
  // window's centre so the copy still has room to its right; landscape sets it at
  // the classic left-third.
  const postX = p ? 820 : 470;
  const figScale = p ? 2.2 : 1.95;

  // Figure leans on the post from its right side, close enough to touch it.
  const figureX = postX + (p ? 96 : 88);

  // ── Gas-lamp flicker — the lamp is lit from frame 1 (no walk-by trigger) ────
  const t = frame / fps;
  const lampGlow = 0.55 + 0.25 * Math.sin(t * 0.8) + 0.06 * Math.sin(t * 5.3);

  // ── Text animation ─────────────────────────────────────────────────────────
  const titleProgress    = interpolate(frame, [8, 8 + 0.6 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const narrationOpacity = interpolate(frame, [8 + 0.6 * fps, 8 + 1.0 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const underlineProgress = interpolate(frame, [8 + 0.2 * fps, 8 + 0.55 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const filterId = "chalk-displace";

  const fireflyPositions = fireflies.map((ff, i) => {
    const speed = 0.3 + i * 0.07;
    return { x: ff.x + Math.sin(t * speed + ff.phase) * 120, y: ff.y + Math.cos(t * speed * 0.7 + ff.phase) * 40, r: ff.r };
  });

  const underlineLen  = p ? 640 : 560;
  const underlineDash = underlineLen * (1 - underlineProgress);

  // ── Copy column — mirrored to the RIGHT of the post (base pins it left) ─────
  // Landscape: starts clear of the post and runs to the frame's right margin.
  // Portrait: the design-space post is off-centre, but the HTML overlay is in
  // CANVAS space, so it just uses a normal padded column.
  const textColX = p ? 60 : 760;
  const textColW = p ? W - 120 : 1080;

  return (
    <AbsoluteFill
      style={{
        background: bgColor ?? "#000000",
        fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
        opacity: masterOpacity,
        overflow: "hidden",
      }}
    >
      <Stickman2BackgroundImage
        imageUrl={imageUrl}
        imageObjectPosition={imageObjectPosition}
        imageZoom={imageZoom}
        videoUrl={videoUrl}
        videoMuted={videoMuted}
        videoVolume={videoVolume}
        videoDurationInFrames={videoDurationInFrames}
        videoStartInFrames={videoStartInFrames}
      />

      {/* ── SVG Defs ── */}
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
          </radialGradient>
          <radialGradient id="lampGlowV2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,240,180,0.55)" />
            <stop offset="100%" stopColor="rgba(255,240,180,0)" />
          </radialGradient>
        </defs>
      </svg>

      {/* ── Main SVG — viewBox maps 1920×1080 design space to canvas ── */}
      <svg
        width={W}
        height={H}
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", top: 0, left: 0, zIndex: 1 }}
      >
        {/* Starfield */}
        {stars.map((s, i) => {
          const twinkle = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin((t / s.period) * Math.PI * 2 + s.phase));
          return (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill={i % 5 === 0 ? "#B0E8FF" : "white"}
              opacity={twinkle * s.opacity}
            />
          );
        })}

        {/* Vignette */}
        <rect x={0} y={0} width={1920} height={1080} fill="url(#vignette)" />

        {/* Crescent moon — offset away from the post so the two don't collide */}
        <g
          transform={`translate(${p ? 1180 : 1620}, ${p ? 120 : 130}) scale(1.45) translate(-30, 0)`}
          filter={`url(#${filterId})`}
          opacity={0.95}
        >
          <path
            d="M 30 -28 A 34 34 0 1 0 30 28 A 29 29 0 1 1 30 -28 Z"
            fill={textColor ?? "#FFFFFF"}
            stroke={textColor ?? "#FFFFFF"}
            strokeWidth={1.2}
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 14px rgba(255,255,255,0.65))" }}
          />
        </g>

        {/* Fireflies */}
        {fireflyPositions.map((ff, i) => (
          <circle
            key={i} cx={ff.x} cy={ff.y} r={ff.r}
            fill={accentColor ?? "#FFFFFF"}
            opacity={0.5 + 0.3 * Math.sin(t * 1.5 + i)}
            style={{ filter: `blur(6px) drop-shadow(0 0 6px ${accentColor ?? "#FFFFFF"})` }}
          />
        ))}

        {/* ── Ground line ── */}
        <line
          x1={0} y1={groundY}
          x2={1920} y2={groundY}
          stroke={textColor ?? "#FFFFFF"}
          strokeWidth={p ? 5 : 3}
          strokeLinecap="round"
          filter={`url(#${filterId})`}
        />

        {/* ── The lamppost — taller than the base's, it anchors the frame ── */}
        {(() => {
          const stroke = textColor ?? "#FFFFFF";
          const postTop = groundY - (p ? 300 : 330);
          const postWidth = p ? 5 : 3.5;
          return (
            <g filter={`url(#${filterId})`}>
              {/* Pooled light on the ground beneath the lantern */}
              <ellipse
                cx={postX + 22} cy={groundY - 4}
                rx={p ? 150 : 165} ry={p ? 22 : 18}
                fill="url(#lampGlowV2)" opacity={lampGlow * 0.75}
              />
              {/* Lantern halo */}
              <ellipse
                cx={postX + 22} cy={postTop - 6}
                rx={105} ry={105}
                fill="url(#lampGlowV2)" opacity={lampGlow}
              />
              {/* Post */}
              <line x1={postX} y1={groundY} x2={postX} y2={postTop + 26} stroke={stroke} strokeWidth={postWidth} strokeLinecap="round" />
              {/* Base collar */}
              <line x1={postX - 14} y1={groundY} x2={postX + 14} y2={groundY} stroke={stroke} strokeWidth={postWidth} strokeLinecap="round" />
              {/* Arm out to the lantern */}
              <line x1={postX} y1={postTop + 30} x2={postX + 22} y2={postTop + 8} stroke={stroke} strokeWidth={p ? 3.5 : 2.5} strokeLinecap="round" />
              {/* Lantern housing */}
              <rect
                x={postX + 10} y={postTop - 14} width={26} height={22} rx={3}
                fill={`rgba(255,240,180,${0.35 + lampGlow * 0.5})`}
                stroke={stroke} strokeWidth={p ? 3 : 2}
              />
              {/* Little cap on top */}
              <line x1={postX + 8} y1={postTop - 16} x2={postX + 38} y2={postTop - 16} stroke={stroke} strokeWidth={p ? 3 : 2} strokeLinecap="round" />
            </g>
          );
        })()}

        {/* ── Leaning figure — procedural idle, not a walk cycle ── */}
        <g transform={`translate(${figureX}, ${figureY})`} filter={`url(#${filterId})`}>
          {(() => {
            const stroke = textColor ?? "#FFFFFF";
            const S = figScale;
            // Breath drives the shoulder/head line; a much slower sine turns the
            // head toward and away from the post.
            const breath = Math.sin(t * 0.9) * 1.6;
            const headTurn = Math.sin(t * 0.32) * 3.2;
            // The whole figure tips slightly toward the post — that lean is the
            // pose, so it is a constant, not an animation.
            const lean = -7;

            return (
              <g transform={`rotate(${lean}) translate(0, ${breath}) scale(${S}) translate(-50, -114)`} strokeLinecap="round" strokeLinejoin="round">
                {/* Head + face, turned slightly by the idle */}
                <g transform={`rotate(${headTurn} 50 22)`}>
                  <circle cx="50" cy="22" r="14" stroke={stroke} strokeWidth="4.5" fill="none" />
                  <circle cx="45" cy="20" r="1.8" fill={stroke} stroke="none" />
                  <circle cx="55" cy="20" r="1.8" fill={stroke} stroke="none" />
                </g>
                {/* Torso */}
                <line x1="50" y1="38" x2="50" y2="72" stroke={stroke} strokeWidth="4.5" />
                {/* Near arm tucked, hand resting back against the post */}
                <line x1="50" y1="48" x2="34" y2="62" stroke={stroke} strokeWidth="4.5" />
                <line x1="34" y1="62" x2="30" y2="78" stroke={stroke} strokeWidth="4.5" />
                {/* Far arm hanging loose, drifting a touch with the breath */}
                <g transform={`rotate(${breath * 1.4} 50 48)`}>
                  <line x1="50" y1="48" x2="64" y2="70" stroke={stroke} strokeWidth="4.5" />
                  <line x1="64" y1="70" x2="66" y2="86" stroke={stroke} strokeWidth="4.5" />
                </g>
                {/* Weight-bearing leg, straight to the ground */}
                <line x1="50" y1="72" x2="44" y2="114" stroke={stroke} strokeWidth="4.5" />
                {/* Crossed/relaxed leg — the classic leaning tell */}
                <line x1="50" y1="72" x2="62" y2="98" stroke={stroke} strokeWidth="4.5" />
                <line x1="62" y1="98" x2="52" y2="114" stroke={stroke} strokeWidth="4.5" />
              </g>
            );
          })()}
        </g>
      </svg>

      {/* ── Text overlay — mirrored to the right of the post ── */}
      <div
        style={{
          position: "absolute",
          top: p ? 300 : 150,
          left: textColX,
          width: textColW,
          zIndex: 3,
        }}
      >
        {/* Title */}
        <div
          style={{
            fontSize: titleFontSize ?? (p ? 101 : 96),
            fontWeight: 700,
            color: accentColor ?? "#FFFFFF",
            lineHeight: 1.15,
            opacity: titleProgress,
            transform: `translateY(${interpolate(titleProgress, [0, 1], [20, 0])}px)`,
            textShadow: `0 0 12px ${accentColor ?? "#FFFFFF"}B3`,
            marginBottom: 16,
          }}
        >
          {title}
        </div>

        {/* Chalk underline */}
        <svg width={underlineLen} height={14} viewBox={`0 0 ${underlineLen} 14`} style={{ display: "block", marginBottom: 28, overflow: "visible" }}>
          <polyline
            points={`0,7 ${underlineLen * 0.25},5 ${underlineLen * 0.5},9 ${underlineLen * 0.75},6 ${underlineLen},7`}
            fill="none"
            stroke={accentColor ?? "#FFFFFF"}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={underlineLen}
            strokeDashoffset={underlineDash}
            filter={`url(#${filterId})`}
          />
        </svg>

        {/* Narration */}
        <div
          style={{
            fontSize: descriptionFontSize ?? (p ? 50 : 42),
            color: textColor ?? "#FFFFFF",
            lineHeight: 1.6,
            opacity: narrationOpacity,
            textShadow: "0 0 6px rgba(255,255,255,0.4)",
            maxWidth: textColW - 40,
          }}
        >
          {narration}
        </div>
      </div>
    </AbsoluteFill>
  );
};
