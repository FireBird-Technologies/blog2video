import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import { Stickman2BackgroundImage } from "../Stickman2BackgroundImage";

/**
 * ChalkTitleV2 — "Constellation"
 *
 * Variant of `chalk_title`. Same props, different composition.
 *
 * Base is an archer at frame-right firing across a horizontal ground plane into a
 * target at frame-left, on a 5.2s looping cycle, with the title centred mid-frame.
 * This one drops the archery entirely and inverts the axis from horizontal to
 * vertical: a seated STARGAZER at bottom-centre raises an arm and DRAWS the
 * constellation overhead, and the title resolves in the upper third only after the
 * lines complete — so the figure appears to name what it just drew.
 *
 * The constellation is the scene's main event, so it uses the template's
 * stroke-reveal idiom (strokeDasharray/strokeDashoffset over a deliberately
 * irregular polyline) scaled up from the base's small chalk underline. The
 * pointing arm is driven off the SAME progress value and tracks the drawing tip,
 * which is what sells the figure as the author of the lines.
 *
 * PORTRAIT: geometry is authored in the fixed 1920×1080 design space and sliced by
 * the viewBox, so portrait reveals only x 656–1264. Every constellation node and
 * the figure are authored inside that window.
 */

/** Constellation nodes in design space, hand-placed per orientation so the figure
 *  reads as drawing a real pattern rather than a scatter. Portrait keeps every node
 *  inside the x 656–1264 slice; landscape spreads across the upper sky. */
// Landscape keeps the pattern in the top quarter so the title band below it stays
// clear sky — the two must not share vertical space or the type is unreadable. It is
// also biased RIGHT of centre, because the figure sits left and points across at it.
const NODES_LANDSCAPE: { x: number; y: number; r: number }[] = [
  { x: 800,  y: 210, r: 5.0 },
  { x: 970,  y: 116, r: 3.4 },
  { x: 1150, y: 175, r: 6.2 },
  { x: 1330, y: 98,  r: 3.8 },
  { x: 1470, y: 192, r: 4.6 },
  { x: 1340, y: 272, r: 3.2 },
  { x: 1100, y: 278, r: 4.0 },
];

// Portrait squeezes the pattern into a shallow band at the very top of the design
// space: the viewBox stretches design-space Y by ~1.78× on a 1080×1920 canvas, so
// anything below y≈220 here would collide with the title/narration block.
/** Local-space y of the seated figure's ground contact. The figure group offsets by
 *  this (not the standing figure's 114) so the seat and both feet land exactly on the
 *  ground line. */
const SEAT_BASE = 100;

/** Local-space length of the pointing arm. Must clear the head (which occupies local
 *  y 21–47 around the shoulder at y=50), or the raised arm renders *behind* the head
 *  and reads as missing entirely. */
const ARM_LEN = 62;

/** Local-space x of the pointing shoulder. Offset to the figure's near side, clear of
 *  the head's centre line (x=47, r=13), so the raised arm passes beside the head
 *  rather than through it. */
const SHOULDER_X = 64;

const NODES_PORTRAIT: { x: number; y: number; r: number }[] = [
  { x: 700,  y: 132, r: 5.0 },
  { x: 800,  y: 62,  r: 3.4 },
  { x: 928,  y: 116, r: 6.2 },
  { x: 1055, y: 56,  r: 3.8 },
  { x: 1215, y: 132, r: 4.6 },
  { x: 1085, y: 196, r: 3.2 },
  { x: 858,  y: 200, r: 4.0 },
];

/**
 * A second, smaller constellation — a quiet cluster set apart from the main figure so
 * the sky reads as a real star chart rather than one lone shape. It draws AFTER the
 * hero pattern (see `minorProgress`) and stays dimmer so it never competes.
 * Landscape tucks it into the open left sky above the stargazer; portrait puts it low
 * on the right, inside the x 656–1264 slice.
 */
// Sits below-left of the moon (which occupies roughly x 260–350, y 100–190) so the two
// do not crowd each other.
const MINOR_LANDSCAPE: { x: number; y: number; r: number }[] = [
  { x: 250, y: 340, r: 4.4 },
  { x: 356, y: 268, r: 3.4 },
  { x: 436, y: 356, r: 5.0 },
  { x: 322, y: 424, r: 3.2 },
  { x: 250, y: 340, r: 4.4 },
];

const MINOR_PORTRAIT: { x: number; y: number; r: number }[] = [
  { x: 1130, y: 470, r: 3.2 },
  { x: 1205, y: 418, r: 2.4 },
  { x: 1245, y: 496, r: 3.8 },
  { x: 1160, y: 540, r: 2.2 },
  { x: 1130, y: 470, r: 3.2 },
];

/**
 * Shooting stars, following the template's own idiom (see ShootingStar.tsx): a tapered
 * tail drawn as a triangle filled with a userSpaceOnUse gradient, plus a glowing head.
 * Hand-timed rather than random so at least one always fires during a short scene, and
 * all of them cross the OPEN sky, clear of the title band and the constellations.
 */
// Every path ENDS above y≈370 — the landscape title band starts at ~389, and a bright
// streak head crossing the type reads as a mistake even with the title's dark halo.
const SHOOTERS = [
  { startSec: 1.1, dur: 1.5, x1: 1560, y1: -40, x2: 1080, y2: 300, tail: 210 },
  { startSec: 2.6, dur: 1.7, x1: 1900, y1: 30,  x2: 1420, y2: 355, tail: 240 },
  { startSec: 4.2, dur: 1.5, x1: 1240, y1: -60, x2: 830,  y2: 240, tail: 195 },
  { startSec: 5.6, dur: 1.8, x1: 2010, y1: -20, x2: 1500, y2: 330, tail: 230 },
] as const;

export const ChalkTitleV2: React.FC<SceneLayoutProps> = (props) => {
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

  const accent = accentColor ?? "#FFFFFF";
  const text = textColor ?? "#FFFFFF";
  const ff = fontFamily ?? "'Patrick Hand', system-ui, sans-serif";

  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit  = interpolate(frame, [dur - 18, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const masterOpacity = enter * exit;

  const t = frame / fps;

  // ── Starfield ──────────────────────────────────────────────────────────────
  const stars = useMemo(() => {
    const arr: { x: number; y: number; r: number; phase: number; period: number; bright: boolean }[] = [];
    const rng = (seed: number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };
    const rand = rng(311);
    for (let i = 0; i < 380; i++) {
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

  // ── Canvas ─────────────────────────────────────────────────────────────────
  const W = p ? 1080 : 1920;
  const H = p ? 1920 : 1080;

  const nodes = p ? NODES_PORTRAIT : NODES_LANDSCAPE;
  const minorNodes = p ? MINOR_PORTRAIT : MINOR_LANDSCAPE;

  // ── Constellation draw ─────────────────────────────────────────────────────
  // One continuous polyline through the nodes, revealed by dashoffset. Segment
  // lengths are needed both for the dash length and to walk the path to the
  // drawing tip for the pointing arm.
  const { pointStr, segLens, totalLen } = useMemo(() => {
    const lens: number[] = [];
    let total = 0;
    for (let i = 1; i < nodes.length; i++) {
      const d = Math.hypot(nodes[i].x - nodes[i - 1].x, nodes[i].y - nodes[i - 1].y);
      lens.push(d);
      total += d;
    }
    return {
      pointStr: nodes.map((n) => `${n.x},${n.y}`).join(" "),
      segLens: lens,
      totalLen: total,
    };
  }, [nodes]);

  // The draw is the scene's spine: starts once the figure has settled, finishes
  // well before the title so the title reads as a consequence.
  const drawStart = Math.round(0.7 * fps);
  const drawEnd = Math.round(2.6 * fps);
  const drawProgress = interpolate(frame, [drawStart, drawEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The minor cluster traces itself in after the hero pattern has landed, so the two
  // read as a sequence rather than arriving together.
  const minorProgress = interpolate(
    frame,
    [Math.round(2.7 * fps), Math.round(4.1 * fps)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const minorPath = useMemo(() => {
    let total = 0;
    for (let i = 1; i < minorNodes.length; i++) {
      total += Math.hypot(minorNodes[i].x - minorNodes[i - 1].x, minorNodes[i].y - minorNodes[i - 1].y);
    }
    return { points: minorNodes.map((n) => `${n.x},${n.y}`).join(" "), len: total };
  }, [minorNodes]);

  // Shooting stars — position + tapered tail, in design space.
  const shooters = SHOOTERS.map((s) => {
    const start = Math.round(s.startSec * fps);
    const end = start + Math.round(s.dur * fps);
    const prog = interpolate(frame, [start, end], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const x = s.x1 + (s.x2 - s.x1) * prog;
    const y = s.y1 + (s.y2 - s.y1) * prog;
    const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
    return {
      x,
      y,
      tailX: x - s.tail * Math.cos(angle),
      tailY: y - s.tail * Math.sin(angle),
      angle,
      // Fade in and out at the ends of the streak so it never pops.
      opacity:
        prog > 0 && prog < 1
          ? interpolate(prog, [0, 0.12, 0.8, 1], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 0,
    };
  });

  /** Walk the polyline to `progress` (0–1) and return the design-space tip. */
  const tip = useMemo(() => {
    if (drawProgress <= 0) return { x: nodes[0].x, y: nodes[0].y };
    const want = totalLen * drawProgress;
    let acc = 0;
    for (let i = 0; i < segLens.length; i++) {
      if (acc + segLens[i] >= want) {
        const f = segLens[i] === 0 ? 0 : (want - acc) / segLens[i];
        return {
          x: nodes[i].x + (nodes[i + 1].x - nodes[i].x) * f,
          y: nodes[i].y + (nodes[i + 1].y - nodes[i].y) * f,
        };
      }
      acc += segLens[i];
    }
    const last = nodes[nodes.length - 1];
    return { x: last.x, y: last.y };
  }, [drawProgress, nodes, segLens, totalLen]);

  // ── Seated stargazer ───────────────────────────────────────────────────────
  // Sits left of centre so the sky it is pointing into occupies the open right side
  // of the frame. Portrait shifts less: its viewBox slice only reveals x 656–1264, so
  // a large offset would push the figure out of frame.
  const figX = p ? 830 : 620;
  const figY = p ? 900 : 925;
  const figS = p ? 2.6 : 2.5;
  const figOpacity = interpolate(frame, [4, Math.round(0.6 * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const breath = Math.sin(t * 0.95) * 1.4;

  // Pointing arm. Everything below is in the figure's LOCAL coordinate space (the
  // one the `scale(figS) translate(-50,-SEAT_BASE)` group establishes), because the
  // arm is rendered inside that group alongside every other limb. Computing the
  // angle in absolute design space — as an earlier revision did — puts the arm in a
  // different convention from the rest of the figure and it detaches.
  const shoulderLocal = { x: SHOULDER_X, y: 50 };
  // Convert the absolute-space drawing tip into the figure's local space.
  const tipLocal = {
    x: (tip.x - figX) / figS + 50,
    y: (tip.y - figY) / figS + SEAT_BASE,
  };
  const armAngleDeg =
    (Math.atan2(tipLocal.y - shoulderLocal.y, tipLocal.x - shoulderLocal.x) * 180) / Math.PI;

  // ── Title + narration — upper third, after the drawing lands ───────────────
  const titleStart = drawEnd - Math.round(0.15 * fps);
  const titleProgress = interpolate(frame, [titleStart, titleStart + Math.round(0.7 * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const narrationProgress = interpolate(
    frame,
    [titleStart + Math.round(0.55 * fps), titleStart + Math.round(1.15 * fps)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const titleGlow = 0.7 + 0.3 * Math.sin((t * Math.PI * 2) / 2.2);

  const filterId = "chalk-displace";

  return (
    <AbsoluteFill
      style={{
        background: bgColor ?? "#000000",
        fontFamily: ff,
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
          <radialGradient id="vignetteCt2" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
          </radialGradient>
        </defs>
      </svg>

      {/* ── Main SVG ── */}
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
              opacity={twinkle * (s.bright ? 1 : 0.75)}
            />
          );
        })}

        <rect x={0} y={0} width={1920} height={1080} fill="url(#vignetteCt2)" />

        {/* Crescent moon — pushed to the upper LEFT so it clears the constellation */}
        <g
          // Portrait: x must stay well inside the 656–1264 slice or the moon is cut in
          // half by the frame edge (the glyph spans roughly ±45 design units at 1.35×).
          // Its Y must also clear the copy band — portrait stretches design-space Y by
          // ~1.78×, so y=330 landed the moon squarely behind the title.
          transform={`translate(${p ? 1180 : 300}, ${p ? 250 : 145}) scale(1.35) translate(-30, 0)`}
          filter={`url(#${filterId})`}
          opacity={0.92}
        >
          <path
            d="M 30 -28 A 34 34 0 1 0 30 28 A 29 29 0 1 1 30 -28 Z"
            fill={text}
            stroke={text}
            strokeWidth={1.2}
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 14px rgba(255,255,255,0.65))" }}
          />
        </g>

        {/* ── The constellation ── */}
        <g filter={`url(#${filterId})`}>
          {/* Joining lines, stroke-revealed */}
          <polyline
            points={pointStr}
            fill="none"
            stroke={accent}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={totalLen}
            strokeDashoffset={totalLen * (1 - drawProgress)}
            opacity={0.85}
            style={{ filter: `drop-shadow(0 0 10px ${accent}AA)` }}
          />
          {/* Nodes pop as the line reaches them */}
          {nodes.map((n, i) => {
            // Fraction of the path length at which the line arrives at this node. The
            // LAST node sits at exactly 1.0, so the pop window has to be carved out
            // BEFORE it — `[reachAt, reachAt + 0.06]` would collapse to [1, 1] there,
            // and Remotion's interpolate throws on a non-increasing input range
            // (which blanks the whole scene, not just the node).
            const POP = 0.06;
            const raw = i === 0 ? 0 : segLens.slice(0, i).reduce((a, b) => a + b, 0) / totalLen;
            const popFrom = Math.min(raw, 1 - POP);
            const pop = interpolate(drawProgress, [popFrom, popFrom + POP], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const shimmer = 0.75 + 0.25 * Math.sin(t * 2.2 + i);
            return (
              <circle
                key={i}
                cx={n.x}
                cy={n.y}
                r={n.r * pop}
                fill={accent}
                opacity={pop * shimmer}
                style={{ filter: `drop-shadow(0 0 12px ${accent})` }}
              />
            );
          })}
          {/* Chalk dust at the drawing tip while the line is still being drawn */}
          {drawProgress > 0.001 && drawProgress < 0.999 && (
            <circle cx={tip.x} cy={tip.y} r={4.5} fill="#FFFFFF" opacity={0.9} style={{ filter: "blur(2px)" }} />
          )}
        </g>

        {/* ── Secondary constellation — dimmer, drawn after the hero pattern ──
               Group opacity is kept fairly high because it COMPOUNDS with each child's
               own opacity; at 0.55 the small nodes came out around 0.47 effective and
               disappeared, leaving a bare outline. */}
        <g filter={`url(#${filterId})`} opacity={0.8}>
          <polyline
            points={minorPath.points}
            fill="none"
            stroke={accent}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={minorPath.len}
            strokeDashoffset={minorPath.len * (1 - minorProgress)}
            opacity={0.7}
            style={{ filter: `drop-shadow(0 0 7px ${accent}88)` }}
          />
          {minorNodes.map((n, i) => {
            // The list closes the loop (last point repeats the first), so skip the
            // duplicate to avoid drawing a double-bright node there.
            if (i === minorNodes.length - 1) return null;
            const pop = interpolate(minorProgress, [i / minorNodes.length, i / minorNodes.length + 0.18], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const shimmer = 0.7 + 0.3 * Math.sin(t * 1.9 + i * 1.3);
            return (
              <circle
                key={i}
                cx={n.x}
                cy={n.y}
                r={n.r * pop}
                fill={accent}
                opacity={pop * shimmer}
                style={{ filter: `drop-shadow(0 0 10px ${accent})` }}
              />
            );
          })}
        </g>

        {/* ── Shooting stars ──
               Tapered tail as a triangle filled with a userSpaceOnUse gradient plus a
               glowing head — the same construction ShootingStar.tsx uses. */}
        {shooters.map((s, i) =>
          s.opacity <= 0.001 ? null : (
            <g key={`shoot-${i}`} opacity={s.opacity}>
              <defs>
                <linearGradient
                  id={`ctv2Tail${i}`}
                  gradientUnits="userSpaceOnUse"
                  x1={s.x}
                  y1={s.y}
                  x2={s.tailX}
                  y2={s.tailY}
                >
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.95} />
                  <stop offset="35%" stopColor="#FFFFFF" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
                </linearGradient>
              </defs>
              {(() => {
                const hw = 3.4; // half-width at the head
                const perp = s.angle + Math.PI / 2;
                const px = Math.cos(perp) * hw;
                const py = Math.sin(perp) * hw;
                return (
                  <path
                    d={`M ${s.x + px} ${s.y + py} L ${s.x - px} ${s.y - py} L ${s.tailX} ${s.tailY} Z`}
                    fill={`url(#ctv2Tail${i})`}
                  />
                );
              })()}
              <circle
                cx={s.x}
                cy={s.y}
                r={3.6}
                fill="#FFFFFF"
                style={{ filter: "drop-shadow(0 0 9px #FFFFFF)" }}
              />
            </g>
          ),
        )}

        {/* ── Ground the figure sits on ──
               NOTE: no chalk-displace filter here. That filter's region is defined as
               a percentage of the element's bounding box, and for a zero-height
               horizontal line the vertical region collapses, so the line vanishes
               entirely. The base layout gets away with it because its ground line
               shares a group with taller geometry. */}
        <line
          x1={0} y1={figY}
          x2={1920} y2={figY}
          stroke={text}
          strokeWidth={p ? 5 : 3.5}
          strokeLinecap="round"
          opacity={0.85}
        />

        {/* ── Seated stargazer, pointing at the drawing tip ──
             Local space: translate(-50, -SEAT_BASE) puts local y=SEAT_BASE on the
             ground line, so the seat and both feet actually touch it. The pointing
             arm lives INSIDE this same group and uses the local-space angle, so it
             scales and jitters with every other limb rather than floating free. */}
        <g transform={`translate(${figX}, ${figY})`} opacity={figOpacity} filter={`url(#${filterId})`}>
          <g
            transform={`translate(0, ${breath}) scale(${figS}) translate(-50, -${SEAT_BASE})`}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Seated side-on with the knees drawn up, leaning back on one braced arm
                and pointing skyward with the other.
                What makes it read as SEATED rather than crouching:
                  • the SEAT itself rests on the ground (46,96) — the buttocks are a
                    contact point, not just the feet;
                  • the torso rises near-vertically from that seat, so there is a clear
                    bend at the hip instead of one straight diagonal;
                  • each leg has a real knee (≈60° at the vertex) with a thigh angling
                    UP from the seat and a shin dropping to the ground. Nearly collinear
                    thigh/shin segments are what previously made the legs read as a
                    single bent stick. */}

            {/* Braced arm behind: shoulder -> elbow -> hand flat on the ground */}
            <line x1="38" y1="52" x2="24" y2="74" stroke={text} strokeWidth="4.5" />
            <line x1="24" y1="74" x2="14" y2={SEAT_BASE} stroke={text} strokeWidth="4.5" />

            {/* Far leg (behind) — knee LOW and foot tucked back. The two legs need real
                separation (≈27 units at the knee); closer than that and the thigh/shin
                of each overlap into a single wedge. */}
            <line x1="46" y1="96" x2="66" y2="74" stroke={text} strokeWidth="4.5" />
            <line x1="66" y1="74" x2="74" y2={SEAT_BASE} stroke={text} strokeWidth="4.5" />

            {/* Seat — a short flat contact where the figure meets the ground. */}
            <line x1="36" y1={SEAT_BASE} x2="52" y2={SEAT_BASE} stroke={text} strokeWidth="4.5" />

            {/* Torso — rises from the seat and leans back, so the shoulders land under
                the head at x≈36. The head cannot move right: the pointing arm sweeps
                from SHOULDER_X and only clears a head centred at x≤36. */}
            <line x1="46" y1="96" x2="38" y2="46" stroke={text} strokeWidth="4.5" />
            {/* Shoulder line out to the pointing arm's pivot, so the raised arm is
                attached to the body rather than floating beside it. */}
            <line x1="38" y1="49" x2={SHOULDER_X} y2="50" stroke={text} strokeWidth="4.5" />

            {/* Near leg (in front) — knee HIGH and foot planted further out */}
            <line x1="46" y1="96" x2="86" y2="56" stroke={text} strokeWidth="4.5" />
            <line x1="86" y1="56" x2="100" y2={SEAT_BASE} stroke={text} strokeWidth="4.5" />

            {/* Head — sits ABOVE the shoulder on a short neck, tilted back to look up.
                Its centre must clear the shoulder by more than its radius, or the
                raised pointing arm is drawn straight through it. */}
            <g transform="rotate(-16 36 28)">
              <circle cx="36" cy="28" r="13" stroke={text} strokeWidth="4.5" fill="none" />
              <circle cx="31.5" cy="25" r="1.7" fill={text} stroke="none" />
              <circle cx="40.5" cy="25" r="1.7" fill={text} stroke="none" />
            </g>

            {/* Pointing arm — upper arm plus forearm, rotated as one unit by the
                LOCAL-space angle to the drawing tip, and rendered last so it lies
                above the torso.
                The pivot is the FAR shoulder (SHOULDER_X, 50), offset sideways from the
                head's centre line: pinning it under the head meant that at the angles
                this scene actually uses (≈-90° to -110°, i.e. pointing up) the arm was
                drawn straight THROUGH the head. */}
            <g transform={`rotate(${armAngleDeg} ${SHOULDER_X} 50)`}>
              <line x1={SHOULDER_X} y1="50" x2={SHOULDER_X + ARM_LEN * 0.5} y2="47" stroke={text} strokeWidth="4.5" />
              <line
                x1={SHOULDER_X + ARM_LEN * 0.5}
                y1="47"
                x2={SHOULDER_X + ARM_LEN}
                y2="49"
                stroke={text}
                strokeWidth="4.5"
              />
              <circle cx={SHOULDER_X + ARM_LEN} cy="49" r="3" fill={text} stroke="none" />
            </g>
          </g>
        </g>
      </svg>

      {/* ── Text overlay ──
             Title and narration share ONE flow container pinned below the
             constellation band, so they stack by document order and cannot overlap.
             (Positioning them as two independent absolute bands is what printed the
             narration on top of the title.) */}
      <AbsoluteFill style={{ zIndex: 3, pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            // Top edge of the copy block — clear sky beneath the constellation.
            top: p ? "30%" : "36%",
            left: "50%",
            transform: "translateX(-50%)",
            width: p ? "88%" : "78%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: p ? 26 : 22,
          }}
        >
          <div
            style={{
              fontFamily: ff,
              fontSize: titleFontSize ?? (p ? 93 : 84),
              fontWeight: 700,
              color: accent,
              textAlign: "center",
              letterSpacing: "0.04em",
              lineHeight: 1.15,
              opacity: titleProgress,
              transform: `translateY(${interpolate(titleProgress, [0, 1], [22, 0])}px)`,
              // A DARK halo first, so the chalk type separates from stars and any
              // constellation line that passes near it; the accent glow sits on top.
              // (An all-white glow on a white accent is what made this unreadable.)
              textShadow: `0 2px 12px rgba(0,0,0,0.95), 0 0 26px rgba(0,0,0,0.8), 0 0 18px ${accent}${Math.round(
                titleGlow * 90,
              )
                .toString(16)
                .padStart(2, "0")}`,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {title}
          </div>

          {narration ? (
            <div
              style={{
                width: p ? "96%" : "84%",
                textAlign: "center",
                fontFamily: ff,
                fontSize: descriptionFontSize ?? (p ? 50 : 45),
                color: text,
                lineHeight: 1.5,
                opacity: narrationProgress,
                transform: `translateY(${interpolate(narrationProgress, [0, 1], [16, 0])}px)`,
                textShadow: "0 2px 10px rgba(0,0,0,0.95), 0 0 20px rgba(0,0,0,0.75)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {narration}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
