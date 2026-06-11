import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import { Stickman2BackgroundImage } from "../Stickman2BackgroundImage";

export const ChalkTitle: React.FC<SceneLayoutProps> = (props) => {
  const {
    title, narration, imageUrl, imageObjectPosition, imageZoom,
    accentColor, bgColor, textColor, aspectRatio, sceneDurationInFrames,
    titleFontSize, descriptionFontSize, fontFamily,
  } = props;
  const p = aspectRatio === "portrait";
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const dur = sceneDurationInFrames ?? 150;

  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [dur - 18, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const masterOpacity = enter * exit;

  const accent = accentColor ?? "#FFFFFF";
  const bg = bgColor ?? "#000000";
  const text = textColor ?? "#FFFFFF";
  const ff = fontFamily ?? "'Patrick Hand', system-ui, sans-serif";
  const t = frame / fps;

  // ── Starfield ──────────────────────────────────────────────────────────────
  const stars = useMemo(() => {
    const count = 380;
    const arr: { x: number; y: number; r: number; phase: number; period: number; bright: boolean }[] = [];
    let s = 42;
    const rng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    for (let i = 0; i < count; i++) {
      const bright = rng() > 0.82;
      arr.push({ x: rng() * 1920, y: rng() * 1080, r: bright ? 1.8 + rng() * 1.4 : 0.8 + rng() * 1.2, phase: rng() * Math.PI * 2, period: 1.2 + rng() * 2.8, bright });
    }
    return arr;
  }, []);

  // ── Fireflies ──────────────────────────────────────────────────────────────
  const fireflies = useMemo(() => {
    const count = 8;
    const arr: { x: number; y: number; r: number; phase: number; speedX: number; speedY: number }[] = [];
    let s = 99;
    const rng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    for (let i = 0; i < count; i++) {
      arr.push({ x: rng() * 1920, y: 700 + rng() * 380, r: 3 + rng() * 2, phase: rng() * Math.PI * 2, speedX: (rng() - 0.5) * 0.4, speedY: (rng() - 0.5) * 0.2 });
    }
    return arr;
  }, []);

  // ── Title animation ────────────────────────────────────────────────────────
  const titleProgress = interpolate(frame, [0, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(titleProgress, [0, 1], [20, 0]);
  const narrationProgress = interpolate(frame, [35, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const narrationY = interpolate(narrationProgress, [0, 1], [20, 0]);
  const titleGlow = 0.7 + 0.3 * Math.sin((t * Math.PI * 2) / 2.2);

  // ── Archer figure constants ────────────────────────────────────────────────
  const figFadeFrame = Math.round(0.8 * fps);
  const figOpacity = interpolate(frame, [figFadeFrame, figFadeFrame + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const figX = p ? 1200 : 1720;
  const figY = p ? 980 : 900;
  const figScale = p ? 1.35 : 2.05;

  // Bow pivot in stickman local coords
  const bowPivotX = p ? 10 : 8;
  const bowPivotY = p ? 34 : 56;
  const bowHalfLen = p ? 26 : 30;

  // ── Target world constants ─────────────────────────────────────────────────
  const targetWorldX = p ? 720 : 195;
  const targetRadius = p ? 46 : 60;
  const groundWorldY = figY + figScale * (155 - 105); // feet world Y
  const targetCenterY = figY + figScale * (bowPivotY - 105) + 8; // roughly at release height

  // ── Bow angles — aiming horizontally LEFT at target ────────────────────────
  const bowDownSvgDeg = p ? 22 : -52;  // resting: bow low
  const bowUpSvgDeg = -3;              // aimed: nearly vertical = horizontal shot

  // ── Archery animation cycle ────────────────────────────────────────────────
  const cycleLen = Math.round(5.2 * fps);
  const animFrame = Math.max(0, frame - figFadeFrame);
  const cFrame = animFrame % cycleLen;
  const cycleNum = Math.floor(animFrame / cycleLen);

  const loadStart  = Math.round(0.08 * cycleLen);
  const loadEnd    = Math.round(0.22 * cycleLen);
  const raiseEnd   = Math.round(0.40 * cycleLen);
  const drawEnd    = Math.round(0.56 * cycleLen);
  const releaseFrame = drawEnd;
  const flightEnd  = Math.round(0.82 * cycleLen);

  const loadProgress     = interpolate(cFrame, [loadStart, loadEnd],     [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bowRaiseProgress = interpolate(cFrame, [loadEnd, raiseEnd],      [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const drawProgress     = interpolate(cFrame, [raiseEnd, drawEnd],      [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bowLowerProgress = interpolate(cFrame, [flightEnd, cycleLen],    [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const arrowFlight      = interpolate(cFrame, [releaseFrame, flightEnd],[0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const arrowFlying = cFrame >= releaseFrame && cFrame < flightEnd;
  const arrowLoaded = cFrame >= loadStart && cFrame < releaseFrame;

  // String pull-back
  const maxStringPull = 32;
  const stringSnapEnd = releaseFrame + Math.round(0.08 * cycleLen);
  const stringPullBack = cFrame < releaseFrame
    ? drawProgress * maxStringPull
    : cFrame < stringSnapEnd
      ? maxStringPull * (1 - interpolate(cFrame, [releaseFrame, stringSnapEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))
      : 0;

  // String vibration after release — realistic snap oscillation
  const stringVibAmp = (cFrame >= releaseFrame && cFrame < releaseFrame + 20)
    ? interpolate(cFrame, [releaseFrame, releaseFrame + 20], [9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;
  const stringVib = stringVibAmp * Math.sin(cFrame * 2.8);

  // Bow angle this frame
  let bowSvgDeg = bowDownSvgDeg;
  if (cFrame < loadEnd)          bowSvgDeg = bowDownSvgDeg;
  else if (cFrame < raiseEnd)    bowSvgDeg = bowDownSvgDeg + (bowUpSvgDeg - bowDownSvgDeg) * bowRaiseProgress;
  else if (cFrame < flightEnd)   bowSvgDeg = bowUpSvgDeg;
  else                           bowSvgDeg = bowUpSvgDeg + (bowDownSvgDeg - bowUpSvgDeg) * bowLowerProgress;
  const bowRot = (bowSvgDeg * Math.PI) / 180;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const rotLocal = (px: number, py: number, ox: number, oy: number, ang: number) => {
    const cos = Math.cos(ang); const sin = Math.sin(ang);
    const dx = px - ox; const dy = py - oy;
    return { x: ox + dx * cos - dy * sin, y: oy + dx * sin + dy * cos };
  };

  const toWorld = (lx: number, ly: number) => ({
    x: figX + figScale * (lx - 50),
    y: figY + figScale * (ly - 105),
  });

  // Arrow tip release position in world coords (at aimed angle)
  const fireBowRot = (bowUpSvgDeg * Math.PI) / 180;
  const getArrowReleaseWorld = () => {
    const tipLocal = rotLocal(bowPivotX - bowHalfLen - 6, bowPivotY, bowPivotX, bowPivotY, fireBowRot);
    return toWorld(tipLocal.x, tipLocal.y);
  };

  // Straight-line trajectory — arrow travels directly to target
  const getArrowBezierPoint = (progress: number) => {
    const start = getArrowReleaseWorld();
    const end = { x: targetWorldX, y: targetCenterY };
    const x = start.x + (end.x - start.x) * progress;
    const y = start.y + (end.y - start.y) * progress;
    const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
    return { x, y, angle };
  };

  // ── Stuck arrow positions (seeded, consistent per session) ─────────────────
  const stuckArrowOffsets = useMemo(() => {
    let s = 137;
    const rng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    return Array.from({ length: 8 }, () => ({
      dx: (rng() - 0.5) * targetRadius * 0.45,
      dy: (rng() - 0.5) * targetRadius * 0.45,
    }));
  }, [targetRadius]);

  const arrowsInTarget = cFrame >= flightEnd ? cycleNum + 1 : cycleNum;
  const arrowsToShow = Math.min(arrowsInTarget, 6);

  // Hit flash opacity
  const hitFlashOpacity = (cFrame >= flightEnd && cFrame < flightEnd + 12)
    ? interpolate(cFrame, [flightEnd, flightEnd + 12], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  // ── Moon ──────────────────────────────────────────────────────────────────
  const moonGlow = 0.65 + 0.35 * Math.sin((t * Math.PI * 2) / 4);
  const moonX = 960;
  const moonY = p ? 165 : 155;
  const moonR = p ? 62 : 72;

  // ══════════════════════════════════════════════════════════════════════════
  // Sub-components (access closure vars for animation state)
  // ══════════════════════════════════════════════════════════════════════════

  const ArcherStickman: React.FC<{ fX: number; fY: number; sc: number; op: number }> = ({ fX, fY, sc, op }) => {
    const stroke = text;
    const breath = Math.sin(frame * 0.06) * 1.1;

    const cx = 48;
    const headR = 13;
    const headY = 30 + breath * 0.5;
    const shoulderY = 56 + breath * 0.4;
    const hipY = 100 + breath * 0.2;
    const footY = 155;
    const frontFootX = 32;  // left foot (toward target)
    const backFootX = 62;   // right foot (back)

    // Torso leans slightly toward target as draw increases
    const leanX = drawProgress * 2.8;

    const pivotY = bowPivotY + breath * 0.3;

    // String hand — gets pulled back during draw
    const stringBaseX = bowPivotX + 38;
    const stringBaseY = bowPivotY;
    const stringHand = rotLocal(stringBaseX + stringPullBack, stringBaseY + breath * 0.2, bowPivotX, pivotY, bowRot);
    const stringHandVibX = cFrame >= releaseFrame ? stringVib * 0.25 : 0;

    // Bow hand stays at pivot (it's the rotation center)
    const bowHandX = bowPivotX;
    const bowHandY = pivotY;

    // Bow arm elbow — slightly raised, arm nearly straight
    const bowElbow = {
      x: (cx - leanX + bowHandX) / 2 - 7,
      y: (shoulderY + bowHandY) / 2 - 20,
    };
    // Draw arm elbow — flares to the right (back elbow drives the draw)
    const drawElbow = {
      x: (cx - leanX + stringHand.x) / 2 + 18,
      y: (shoulderY + stringHand.y) / 2 - 10,
    };

    // Bow shape — detailed recurve limbs
    const bpx = bowPivotX;
    const bpy = pivotY;
    const hl = bowHalfLen;
    // Upper tip and lower tip (recurved: slightly back toward string side at very end)
    const utX = bpx - 5, utY = bpy - hl - 2;
    const ltX = bpx - 5, ltY = bpy + hl + 2;
    // Riser mid-points
    const riserTopX = bpx - 3, riserTopY = bpy - 9;
    const riserBotX = bpx - 3, riserBotY = bpy + 9;
    // Bow path: upper tip → limb → riser → limb → lower tip
    const bowPath = [
      `M ${utX} ${utY}`,
      `C ${bpx - 14} ${utY + 8}  ${bpx - 13} ${bpy - 16}  ${riserTopX} ${riserTopY}`,
      `L ${riserBotX} ${riserBotY}`,
      `C ${bpx - 13} ${bpy + 16}  ${bpx - 14} ${ltY - 8}  ${ltX} ${ltY}`,
    ].join(" ");

    // String — two lines from tips to draw point, with vibration applied at midpoint
    const drawPtX = stringBaseX + stringPullBack + stringVib;
    const drawPtY = bpy + breath * 0.2;

    // Arrow when loaded: shaft from nock to tip
    const arrowTipLocal = rotLocal(bpx - hl - 6, bpy, bpx, bpy, bowRot);
    const arrowNockLocal = rotLocal(stringBaseX + stringPullBack * 0.38 - 2, bpy, bpx, bpy, bowRot);

    return (
      <g transform={`translate(${fX}, ${fY}) scale(${sc})`} opacity={op} filter="url(#chalk-fig)">
        <g transform="translate(-50, -105)" strokeLinecap="round" strokeLinejoin="round">

          {/* ── Ground shadow ── */}
          <ellipse cx={cx} cy={footY + 6} rx={24} ry={4} fill="rgba(0,0,0,0.22)" />

          {/* ── Quiver on archer's back (right hip, since facing left) ── */}
          <g opacity={0.82}>
            {/* Quiver body */}
            <path
              d={`M ${cx+5} ${shoulderY+10} Q ${cx+12} ${shoulderY+10} ${cx+13} ${shoulderY+16} L ${cx+13} ${hipY-4} Q ${cx+13} ${hipY+1} ${cx+8} ${hipY+1} Q ${cx+3} ${hipY+1} ${cx+5} ${hipY-4} Z`}
              stroke={stroke} strokeWidth={1.8} fill="none"
            />
            {/* Arrow nocks sticking out of quiver */}
            <line x1={cx+6}  y1={shoulderY+7}  x2={cx+6}  y2={shoulderY+11} stroke={stroke} strokeWidth={1.6} />
            <line x1={cx+8}  y1={shoulderY+4}  x2={cx+8}  y2={shoulderY+11} stroke={stroke} strokeWidth={1.6} />
            <line x1={cx+10} y1={shoulderY+7}  x2={cx+10} y2={shoulderY+11} stroke={stroke} strokeWidth={1.6} />
            {/* Small fletching on quiver arrows */}
            <line x1={cx+5}  y1={shoulderY+6}  x2={cx+7}  y2={shoulderY+5}  stroke={stroke} strokeWidth={1} opacity={0.7} />
            <line x1={cx+7}  y1={shoulderY+3}  x2={cx+9}  y2={shoulderY+2}  stroke={stroke} strokeWidth={1} opacity={0.7} />
            <line x1={cx+9}  y1={shoulderY+6}  x2={cx+11} y2={shoulderY+5}  stroke={stroke} strokeWidth={1} opacity={0.7} />
          </g>

          {/* ── Legs ── */}
          {/* Front leg (left, toward target) */}
          <line x1={cx} y1={hipY} x2={frontFootX} y2={footY} stroke={stroke} strokeWidth={5} />
          {/* Back leg (right, away from target) — knee slightly bent for stance */}
          <line x1={cx} y1={hipY} x2={(cx+backFootX)/2+2} y2={(hipY+footY)/2-4} stroke={stroke} strokeWidth={5} />
          <line x1={(cx+backFootX)/2+2} y1={(hipY+footY)/2-4} x2={backFootX} y2={footY} stroke={stroke} strokeWidth={5} />
          {/* Feet */}
          <line x1={frontFootX-9} y1={footY+4} x2={frontFootX+5} y2={footY+4} stroke={stroke} strokeWidth={3} strokeLinecap="round" />
          <line x1={backFootX-3}  y1={footY+4} x2={backFootX+11} y2={footY+4} stroke={stroke} strokeWidth={3} strokeLinecap="round" />

          {/* ── Torso ── */}
          <line x1={cx-leanX} y1={shoulderY} x2={cx} y2={hipY} stroke={stroke} strokeWidth={5.5} />

          {/* ── Bow group (rotated for aim) ── */}
          <g transform={`rotate(${bowSvgDeg}, ${bpx}, ${bpy})`}>
            {/* Recurve bow limbs */}
            <path d={bowPath} stroke={stroke} strokeWidth={3.8} fill="none" />
            {/* Riser grip wrap detail */}
            <line x1={bpx-4} y1={bpy-5} x2={bpx-2} y2={bpy-5} stroke={stroke} strokeWidth={1.2} opacity={0.6} />
            <line x1={bpx-4} y1={bpy}   x2={bpx-2} y2={bpy}   stroke={stroke} strokeWidth={1.2} opacity={0.6} />
            <line x1={bpx-4} y1={bpy+5} x2={bpx-2} y2={bpy+5} stroke={stroke} strokeWidth={1.2} opacity={0.6} />
            {/* Upper string */}
            <line x1={utX} y1={utY} x2={drawPtX} y2={drawPtY - 2} stroke={stroke} strokeWidth={1.5} opacity={0.92} />
            {/* Lower string */}
            <line x1={ltX} y1={ltY} x2={drawPtX} y2={drawPtY + 2} stroke={stroke} strokeWidth={1.5} opacity={0.92} />
          </g>

          {/* ── Arrow when nocked and drawn ── */}
          {arrowLoaded && !arrowFlying && (() => {
            const opacity = cFrame < loadEnd ? 0.25 + loadProgress * 0.75 : 0.96;
            const ang = Math.atan2(arrowTipLocal.y - arrowNockLocal.y, arrowTipLocal.x - arrowNockLocal.x);
            const cos = Math.cos(ang); const sin = Math.sin(ang);
            const perp = [-sin, cos];
            // Arrowhead tip
            const htX = arrowTipLocal.x + cos * 5.5;
            const htY = arrowTipLocal.y + sin * 5.5;
            // Fletching base (near nock)
            const fb1X = arrowNockLocal.x + cos * 5;
            const fb1Y = arrowNockLocal.y + sin * 5;
            const fb2X = arrowNockLocal.x + cos * 12;
            const fb2Y = arrowNockLocal.y + sin * 12;
            return (
              <g opacity={opacity}>
                {/* Shaft */}
                <line x1={arrowNockLocal.x} y1={arrowNockLocal.y} x2={arrowTipLocal.x} y2={arrowTipLocal.y} stroke={accent} strokeWidth={2} strokeLinecap="round" />
                {/* Arrowhead */}
                <polygon
                  points={`${htX},${htY} ${arrowTipLocal.x+perp[0]*3-cos*4},${arrowTipLocal.y+perp[1]*3-sin*4} ${arrowTipLocal.x-cos*1},${arrowTipLocal.y-sin*1} ${arrowTipLocal.x-perp[0]*3-cos*4},${arrowTipLocal.y-perp[1]*3-sin*4}`}
                  fill={accent}
                />
                {/* Fletching vane upper */}
                <line x1={fb1X} y1={fb1Y} x2={fb1X+perp[0]*6} y2={fb1Y+perp[1]*6} stroke={accent} strokeWidth={1.1} />
                <line x1={fb1X+perp[0]*6} y1={fb1Y+perp[1]*6} x2={fb2X} y2={fb2Y} stroke={accent} strokeWidth={1.1} />
                {/* Fletching vane lower */}
                <line x1={fb1X} y1={fb1Y} x2={fb1X-perp[0]*6} y2={fb1Y-perp[1]*6} stroke={accent} strokeWidth={1.1} />
                <line x1={fb1X-perp[0]*6} y1={fb1Y-perp[1]*6} x2={fb2X} y2={fb2Y} stroke={accent} strokeWidth={1.1} />
              </g>
            );
          })()}

          {/* ── Arms ── */}
          {/* Bow arm (left, toward target) */}
          <path d={`M ${cx-leanX} ${shoulderY} Q ${bowElbow.x} ${bowElbow.y} ${bowHandX} ${bowHandY}`} stroke={stroke} strokeWidth={4.5} fill="none" />
          {/* Draw arm (right, pulling string back) */}
          <path d={`M ${cx-leanX} ${shoulderY} Q ${drawElbow.x} ${drawElbow.y} ${stringHand.x+stringHandVibX} ${stringHand.y}`} stroke={stroke} strokeWidth={4.5} fill="none" />
          {/* Hand dots */}
          <circle cx={bowHandX} cy={bowHandY} r={3.2} fill={stroke} />
          <circle cx={stringHand.x+stringHandVibX} cy={stringHand.y} r={3.2} fill={stroke} />
          {/* Elbow joints (subtle) */}
          <circle cx={bowElbow.x} cy={bowElbow.y} r={2.2} fill={stroke} opacity={0.45} />
          <circle cx={drawElbow.x} cy={drawElbow.y} r={2.2} fill={stroke} opacity={0.45} />

          {/* ── Head ── */}
          <circle cx={cx-leanX*0.6} cy={headY} r={headR} stroke={stroke} strokeWidth={4.5} fill="none" />
          {/* Eye (facing left toward target) */}
          <circle cx={cx-leanX*0.6 - headR*0.55} cy={headY-2} r={2} fill={stroke} />
          {/* Nose */}
          <line x1={cx-leanX*0.6 - headR+4} y1={headY+3} x2={cx-leanX*0.6 - headR-5} y2={headY+4} stroke={stroke} strokeWidth={2.5} strokeLinecap="round" />
          {/* Chin/jaw (slight detail) */}
          <line x1={cx-leanX*0.6 - headR-5} y1={headY+4} x2={cx-leanX*0.6 - headR-2} y2={headY+headR-2} stroke={stroke} strokeWidth={2} strokeLinecap="round" opacity={0.6} />
        </g>
      </g>
    );
  };

  // ── Flying Arrow ────────────────────────────────────────────────────────────
  const FlyingArrow: React.FC = () => {
    if (!arrowFlying) return null;
    const { x, y, angle } = getArrowBezierPoint(arrowFlight);
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad); const sin = Math.sin(rad);
    const perp = [-sin, cos];

    const shaftLen = 58;
    const headLen  = 11;
    const headWide = 4.5;

    const tailX = x - cos * shaftLen;
    const tailY = y - sin * shaftLen;
    const tipX  = x + cos * headLen;
    const tipY  = y + sin * headLen;

    // Fletching: two feather vanes near tail (triangular)
    const fb1 = { x: tailX + cos * 8, y: tailY + sin * 8 };
    const fb2 = { x: tailX + cos * 20, y: tailY + sin * 20 };

    return (
      <g opacity={figOpacity} filter="url(#chalk-fig)">
        {/* Shaft (wood-toned — use accent with slight desaturation) */}
        <line x1={tailX} y1={tailY} x2={x} y2={y} stroke={accent} strokeWidth={2.2} strokeLinecap="round" />

        {/* Fletching vane 1 (upper) */}
        <line x1={fb1.x} y1={fb1.y} x2={fb1.x + perp[0]*8} y2={fb1.y + perp[1]*8} stroke={accent} strokeWidth={1.3} />
        <line x1={fb1.x + perp[0]*8} y1={fb1.y + perp[1]*8} x2={fb2.x} y2={fb2.y} stroke={accent} strokeWidth={1.3} />
        {/* Fletching vane 2 (lower) */}
        <line x1={fb1.x} y1={fb1.y} x2={fb1.x - perp[0]*8} y2={fb1.y - perp[1]*8} stroke={accent} strokeWidth={1.3} />
        <line x1={fb1.x - perp[0]*8} y1={fb1.y - perp[1]*8} x2={fb2.x} y2={fb2.y} stroke={accent} strokeWidth={1.3} />
        {/* Nock wrap (dark band) */}
        <line x1={tailX+cos*2} y1={tailY+sin*2} x2={tailX+cos*5} y2={tailY+sin*5} stroke={text} strokeWidth={2.5} strokeLinecap="round" opacity={0.7} />

        {/* Arrowhead — diamond shape */}
        <polygon
          points={[
            `${tipX},${tipY}`,
            `${x + perp[0]*headWide},${y + perp[1]*headWide}`,
            `${x - cos*3},${y - sin*3}`,
            `${x - perp[0]*headWide},${y - perp[1]*headWide}`,
          ].join(" ")}
          fill={accent}
          stroke={accent}
          strokeWidth={0.5}
        />
      </g>
    );
  };

  // ── Archery Target ─────────────────────────────────────────────────────────
  const ArcheryTarget: React.FC = () => {
    const tx = targetWorldX;
    const ty = targetCenterY;
    const R  = targetRadius;
    const rings = [
      { r: R,       fill: "rgba(215,215,205,0.94)" }, // white outer
      { r: R * 0.8, fill: "rgba(22,22,22,0.94)"    }, // black
      { r: R * 0.6, fill: "rgba(215,215,205,0.94)" }, // white
      { r: R * 0.4, fill: "rgba(22,22,22,0.94)"    }, // black
      { r: R * 0.2, fill: "rgba(215,215,205,0.94)" }, // white bullseye
    ];
    return (
      <g filter="url(#chalk-fig)" opacity={figOpacity}>
        {/* A-frame stand */}
        <line x1={tx-20} y1={groundWorldY} x2={tx}    y2={ty+R+2} stroke={text} strokeWidth={4.5} strokeLinecap="round" />
        <line x1={tx+20} y1={groundWorldY} x2={tx}    y2={ty+R+2} stroke={text} strokeWidth={4.5} strokeLinecap="round" />
        {/* Cross brace */}
        <line x1={tx-16} y1={groundWorldY-35} x2={tx+16} y2={groundWorldY-35} stroke={text} strokeWidth={2.5} strokeLinecap="round" />

        {/* Straw backing circle (slightly bigger, behind rings) */}
        <circle cx={tx} cy={ty} r={R+7} fill="rgba(130,95,45,0.55)" stroke={text} strokeWidth={1.8} />

        {/* Concentric scoring rings */}
        {rings.map((ring, i) => (
          <circle key={i} cx={tx} cy={ty} r={ring.r} fill={ring.fill} />
        ))}

        {/* Cross divider lines */}
        <line x1={tx-R} y1={ty} x2={tx+R} y2={ty} stroke="rgba(0,0,0,0.28)" strokeWidth={1.2} />
        <line x1={tx} y1={ty-R} x2={tx} y2={ty+R} stroke="rgba(0,0,0,0.28)" strokeWidth={1.2} />

        {/* Outer ring stroke */}
        <circle cx={tx} cy={ty} r={R} fill="none" stroke={text} strokeWidth={1.4} opacity={0.55} />
      </g>
    );
  };

  // ── Arrows Embedded in Target ──────────────────────────────────────────────
  const StuckArrows: React.FC = () => {
    if (arrowsToShow === 0) return null;
    const tx = targetWorldX;
    const ty = targetCenterY;

    return (
      <g filter="url(#chalk-fig)" opacity={figOpacity}>
        {stuckArrowOffsets.slice(0, arrowsToShow).map((offset, i) => {
          const ax = tx + offset.dx;
          const ay = ty + offset.dy;

          // Arrow comes from the right, embeds in target pointing left.
          // Tail (nock + fletching) sticks out to the RIGHT of the hit point.
          const tailX = ax + 50; // nock end
          const fletch1Base = { x: tailX - 9, y: ay };
          const fletch1Tip  = { x: tailX - 22, y: ay };

          // Recent arrow wobbles briefly
          const isNewest = i === arrowsToShow - 1;
          const wobble = isNewest && hitFlashOpacity > 0
            ? hitFlashOpacity * 4 * Math.sin(cFrame * 4) : 0;
          const wobbleAy = ay + wobble;

          return (
            <g key={i}>
              {/* Shaft protruding from target */}
              <line
                x1={tailX} y1={wobbleAy}
                x2={ax}    y2={wobbleAy}
                stroke={accent} strokeWidth={2.2} strokeLinecap="round"
              />
              {/* Nock wrap */}
              <line x1={tailX-1} y1={wobbleAy} x2={tailX-4} y2={wobbleAy} stroke={text} strokeWidth={2.8} strokeLinecap="round" opacity={0.7} />
              {/* Fletching vane upper */}
              <line x1={fletch1Base.x} y1={wobbleAy} x2={fletch1Base.x} y2={wobbleAy-8} stroke={accent} strokeWidth={1.3} />
              <line x1={fletch1Base.x} y1={wobbleAy-8} x2={fletch1Tip.x} y2={wobbleAy} stroke={accent} strokeWidth={1.3} />
              {/* Fletching vane lower */}
              <line x1={fletch1Base.x} y1={wobbleAy} x2={fletch1Base.x} y2={wobbleAy+8} stroke={accent} strokeWidth={1.3} />
              <line x1={fletch1Base.x} y1={wobbleAy+8} x2={fletch1Tip.x} y2={wobbleAy} stroke={accent} strokeWidth={1.3} />
            </g>
          );
        })}
      </g>
    );
  };

  // ── Impact Flash ───────────────────────────────────────────────────────────
  const HitFlash: React.FC = () => {
    if (hitFlashOpacity <= 0) return null;
    const tx = targetWorldX;
    const ty = targetCenterY;
    const R  = targetRadius;
    // Spark rays
    const numRays = 8;
    const rays = Array.from({ length: numRays }, (_, i) => {
      const ang = (i / numRays) * Math.PI * 2;
      return {
        x1: tx + Math.cos(ang) * R * 0.15,
        y1: ty + Math.sin(ang) * R * 0.15,
        x2: tx + Math.cos(ang) * R * (0.6 + hitFlashOpacity * 0.5),
        y2: ty + Math.sin(ang) * R * (0.6 + hitFlashOpacity * 0.5),
      };
    });
    return (
      <g opacity={hitFlashOpacity} filter="url(#chalk-fig)">
        {/* Bright core flash */}
        <circle cx={tx} cy={ty} r={R * 0.35} fill="white" opacity={0.9} />
        <circle cx={tx} cy={ty} r={R * 0.6}  fill="white" opacity={0.35} />
        {/* Spark rays */}
        {rays.map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke="white" strokeWidth={1.8} strokeLinecap="round" opacity={0.7} />
        ))}
      </g>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden", opacity: masterOpacity }}>

      {/* ── Layer 1: Background image ── */}
      <Stickman2BackgroundImage imageUrl={imageUrl} imageObjectPosition={imageObjectPosition} imageZoom={imageZoom} />

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
            const shine   = 0.5 + 0.5 * Math.sin(t * (Math.PI * 2) / (s.period * 0.6) + s.phase * 1.7);
            const op = s.bright ? 0.35 + 0.65 * twinkle * shine : 0.2 + 0.55 * twinkle;
            const glowR = s.r * (1 + shine * (s.bright ? 2.5 : 1.2));
            return (
              <g key={i}>
                {s.bright && <circle cx={s.x} cy={s.y} r={glowR} fill={i % 5 === 0 ? accent : "white"} opacity={op * 0.25} />}
                <circle cx={s.x} cy={s.y} r={s.r} fill={i % 5 === 0 ? accent : "white"} opacity={op} />
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>

      {/* ── Layer 3: Vignette ── */}
      <AbsoluteFill style={{ zIndex: 2, background: "radial-gradient(ellipse 80% 45% at 50% 50%, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.72) 100%)" }} />

      {/* ── Layer 4: Title ── */}
      <AbsoluteFill style={{ zIndex: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start" }}>
        <div style={{ position: "absolute", top: p ? "38%" : "42%", left: "50%", transform: `translate(-50%, -50%) translateY(${titleY}px)`, display: "flex", flexDirection: "column", alignItems: "center", opacity: titleProgress, width: p ? "90%" : "80%" }}>
          <div style={{ fontFamily: ff, fontSize: titleFontSize ?? (p ? 93 : 84), fontWeight: 700, color: accent, textAlign: "center", letterSpacing: "0.04em", lineHeight: 1.15, filter: `drop-shadow(0 0 12px rgba(255,255,255,${titleGlow * 0.7}))`, textShadow: `0 0 24px rgba(255,255,255,0.5), 0 0 8px rgba(255,255,255,0.3)`, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {title}
          </div>
        </div>
        {narration && (
          <div style={{ position: "absolute", top: p ? "56%" : "58%", left: "50%", transform: `translate(-50%, -50%) translateY(${narrationY}px)`, opacity: narrationProgress, width: p ? "85%" : "70%", textAlign: "center", fontFamily: ff, fontSize: descriptionFontSize ?? (p ? 50 : 45), color: text, lineHeight: 1.5, filter: `drop-shadow(0 0 6px rgba(255,255,255,0.4))`, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {narration}
          </div>
        )}
      </AbsoluteFill>

      {/* ── Layer 5: Archer + Target + Arrows ── */}
      <AbsoluteFill style={{ zIndex: 4 }}>
        <svg width="100%" height="100%" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" style={{ overflow: "visible" }}>
          <defs>
            <filter id="chalk-fig">
              <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="5" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.2" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            <radialGradient id="moon-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255,255,240,0.45)" />
              <stop offset="100%" stopColor="rgba(255,255,240,0)" />
            </radialGradient>
            <radialGradient id="lamp-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255,240,180,0.35)" />
              <stop offset="100%" stopColor="rgba(255,240,180,0)" />
            </radialGradient>
          </defs>

          {/* Archery target (render first so arrows appear on top) */}
          <ArcheryTarget />

          {/* Arrows already stuck in the target */}
          <StuckArrows />

          {/* Impact flash */}
          <HitFlash />

          {/* Archer */}
          <ArcherStickman fX={figX} fY={figY} sc={figScale} op={figOpacity} />

          {/* Arrow in flight */}
          <FlyingArrow />

          {/* Moon — centered above */}
          <g transform={`translate(${moonX}, ${moonY})`} opacity={moonGlow * 0.95} filter="url(#chalk-fig)">
            <circle cx={0} cy={0} r={moonR * 1.55} fill="url(#moon-glow)" />
            <circle cx={0} cy={0} r={moonR} fill={text} stroke={text} strokeWidth={1.5} style={{ filter: `drop-shadow(0 0 18px rgba(255,255,255,0.55))` }} />
            <ellipse cx={-18} cy={-12} rx={14} ry={11} fill={bg} opacity={0.12} />
            <ellipse cx={22}  cy={8}   rx={18} ry={14} fill={bg} opacity={0.10} />
            <ellipse cx={-8}  cy={24}  rx={11} ry={9}  fill={bg} opacity={0.14} />
            <ellipse cx={30}  cy={-20} rx={9}  ry={7}  fill={bg} opacity={0.09} />
            <ellipse cx={-32} cy={14}  rx={8}  ry={6}  fill={bg} opacity={0.11} />
          </g>

        </svg>
      </AbsoluteFill>

      {/* ── Layer 6: Fireflies ── */}
      <AbsoluteFill style={{ zIndex: 5, pointerEvents: "none" }}>
        <svg width="100%" height="100%" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
          {fireflies.map((ff, i) => {
            const fx = ff.x + Math.sin(t * 0.3 + ff.phase) * 80 + ff.speedX * frame * 0.5;
            const fy = ff.y + Math.cos(t * 0.2 + ff.phase * 1.3) * 40 + ff.speedY * frame * 0.3;
            const fOp = 0.5 + 0.3 * Math.sin(t * (Math.PI * 2) / 2.5 + ff.phase);
            return (
              <circle key={i} cx={((fx % 1920) + 1920) % 1920} cy={((fy - 700) % 380 + 380) % 380 + 700} r={ff.r} fill={accent} opacity={fOp} style={{ filter: `blur(6px) drop-shadow(0 0 ${ff.r * 2}px ${accent})` }} />
            );
          })}
        </svg>
      </AbsoluteFill>

    </AbsoluteFill>
  );
};
