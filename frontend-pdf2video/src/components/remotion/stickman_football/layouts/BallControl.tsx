import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import { Football, GrassGround, StickFace } from "../shared";

export const BallControl: React.FC<SceneLayoutProps> = (props) => {
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
    stats,
  } = props;
  const p = aspectRatio === "portrait";
  const skillCaption = (props as any).skillCaption ?? "Ball Control";

  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const dur = sceneDurationInFrames ?? 150;
  const tSec = frame / fps;

  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [dur - 18, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sceneOpacity = enter * exit;

  const accent = accentColor ?? "#2E7D32";
  const bg = bgColor ?? "#FFFFFF";
  const text = textColor ?? "#111111";
  const font = fontFamily ?? "'Patrick Hand', system-ui, sans-serif";

  const msToFrames = (ms: number) => (ms / 1000) * fps;
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 2);
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

  const W = p ? 1080 : 1920;
  const H = p ? 1920 : 1080;

  // ── Figure geometry (slightly smaller — two players share the stage) ─────────
  const FIG = p ? 1.7 : 1.4;
  const torsoLen = 52 * FIG;
  const headR = 19 * FIG;
  const headLen = 18 * FIG;
  const thighLen = 30 * FIG;
  const shinLen = 30 * FIG;
  const sw = p ? 5.5 : 6;
  const ballR = p ? 26 : 22;

  const groundY = H * (p ? 0.72 : 0.8);

  // Two players facing each other; the right column leaves room for text in landscape.
  const leftX = p ? W * 0.2 : W * 0.14;
  const rightX = p ? W * 0.56 : W * 0.4;

  // Slide-in
  const slideL = interpolate(frame, [msToFrames(80), msToFrames(500)], [-70, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const slideR = interpolate(frame, [msToFrames(120), msToFrames(540)], [70, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const figOpacity = interpolate(frame, [msToFrames(80), msToFrames(320)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lX = leftX + slideL;
  const rX = rightX + slideR;

  // Body-part contact heights (relative to the ground).
  const hipY = groundY - (thighLen + shinLen);
  const headCY = hipY - torsoLen - headLen - headR * 0.4;
  const footUpY = groundY - thighLen;             // raised-foot volley height

  // Contact point of a touch on a given player.
  // type: "head" meets at head height; "foot" meets at a raised-foot height.
  type Touch = "head" | "foot";
  const contactY = (t: Touch) => (t === "head" ? headCY - ballR * 0.9 : footUpY);
  const contactDx = (t: Touch, dir: number) => (t === "head" ? 0 : dir * headR * 1.2);

  // ── Exchange sequence: who strikes and with what, alternating sides ──────────
  // Each entry = one strike that launches the ball toward the OTHER player.
  // Sides alternate L→R→L…; the strike type alternates so we get head & foot volleys.
  const STRIKES: { side: "L" | "R"; type: Touch }[] = [
    { side: "L", type: "foot" },
    { side: "R", type: "head" },
    { side: "L", type: "head" },
    { side: "R", type: "foot" },
    { side: "L", type: "foot" },
    { side: "R", type: "foot" },
    { side: "L", type: "head" },
    { side: "R", type: "head" },
  ];
  const flightSec = p ? 0.78 : 0.82;             // time for the ball to cross
  const cycleLen = STRIKES.length * flightSec;
  const startDelay = 0.7;
  const tLoop = Math.max(0, tSec - startDelay) % cycleLen;
  const idx = Math.floor(tLoop / flightSec) % STRIKES.length;
  const localT = (tLoop - idx * flightSec) / flightSec;    // 0..1 across this flight
  const cur = STRIKES[idx];
  const nxt = STRIKES[(idx + 1) % STRIKES.length];

  const senderX = cur.side === "L" ? lX : rX;
  const senderDir = cur.side === "L" ? 1 : -1;             // strikes toward the other
  const receiverX = nxt.side === "L" ? lX : rX;
  const receiverDir = nxt.side === "L" ? 1 : -1;

  // ── Ball: arcs from sender's strike point to receiver's contact point (aerial) ──
  const fromX = senderX + contactDx(cur.type, senderDir);
  const fromY = contactY(cur.type);
  const toX = receiverX + contactDx(nxt.type, receiverDir);
  const toY = contactY(nxt.type);
  const ballX = interpolate(localT, [0, 1], [fromX, toX]);
  // High parabola that always stays well above the ground (peaks above both heads).
  const apexY = Math.min(fromY, toY) - (p ? H * 0.13 : H * 0.16);
  const arc = Math.sin(localT * Math.PI);
  const lineY = interpolate(localT, [0, 1], [fromY, toY]);
  const ballY = lineY - arc * (Math.min(fromY, toY) - apexY);

  // Contact pop right at launch (start of flight) and at receive (end of flight).
  const launchPop = localT < 0.12 ? Math.sin((localT / 0.12) * Math.PI) : 0;
  const recvPop = localT > 0.88 ? Math.sin(((localT - 0.88) / 0.12) * Math.PI) : 0;
  const pop = Math.max(launchPop, recvPop);
  const headContact = (localT < 0.5 ? cur.type : nxt.type) === "head";
  const ballSqX = 1 + (headContact ? 0.2 : 0.24) * pop;
  const ballSqY = 1 - (headContact ? 0.22 : 0.26) * pop;
  const ballRot = senderDir * ((tSec * 120) % 360);

  // ── Per-player pose. A player reacts when (a) striking at localT≈0 or
  // (b) receiving at localT≈1. We compute an impulse + the active touch type. ──
  const buildPose = (side: "L" | "R") => {
    let kickLeg = 0, plantBend = 0.12, torsoBias = 0, headTilt = 0, armSpread = 0.35, impulse = 0;
    let activeType: Touch | null = null;
    if (cur.side === side) {
      // striking at the start of the flight
      impulse = Math.max(0, 1 - localT * 3.0);
      activeType = cur.type;
    } else if (nxt.side === side) {
      // receiving at the end of the flight (anticipate slightly)
      impulse = Math.max(0, 1 - (1 - localT) * 3.0);
      activeType = nxt.type;
    }
    if (activeType === "foot") {
      kickLeg = 0.5 + 0.5 * impulse;
      plantBend = 0.16 + 0.12 * impulse;
      torsoBias = -3 - 3 * impulse;
      armSpread = 0.5 + 0.3 * impulse;
    } else if (activeType === "head") {
      headTilt = -8 - 16 * impulse;   // head nods up to meet the ball
      torsoBias = 6 * impulse;
      plantBend = 0.14 + 0.14 * impulse;
      armSpread = 0.55 + 0.3 * impulse;
    }
    return { kickLeg, plantBend, torsoBias, headTilt, armSpread };
  };
  const poseL = buildPose("L");
  const poseR = buildPose("R");

  const bob = Math.sin(tSec * 3.0) * 2;

  // Render one articulated player at base x `bx`, facing `dir` (+1 right / −1 left).
  const Player: React.FC<{ bx: number; dir: number; pose: ReturnType<typeof buildPose>; variant: number }> = ({ bx, dir, pose, variant }) => {
    const torsoLean = -pose.torsoBias * dir;
    const torsoRad = (torsoLean * Math.PI) / 180;
    const shoulderX = bx + Math.sin(torsoRad) * torsoLen;
    const shoulderY = hipY - Math.cos(torsoRad) * torsoLen + bob;
    const neckLen = headLen + headR * 0.45;
    const headTiltRad = ((torsoLean + pose.headTilt) * Math.PI) / 180;
    const hX = shoulderX + Math.sin(headTiltRad) * neckLen;
    const hY = shoulderY - Math.cos(headTiltRad) * neckLen;

    // support leg behind (away from the ball), kicking leg toward the ball (dir).
    const plantFootX = bx - dir * headR * 0.5;
    const plantKneeX = (bx + plantFootX) / 2 - dir * 3 + dir * pose.plantBend * 9;
    const plantKneeY = (hipY + groundY) / 2 + 4 + pose.plantBend * 16;
    const restFootX = bx + dir * headR * 0.6;
    const kFootX = interpolate(pose.kickLeg, [0, 1], [restFootX, bx + dir * headR * 1.4]);
    const kFootY = interpolate(pose.kickLeg, [0, 1], [groundY, footUpY]);
    const kKneeX = (bx + kFootX) / 2 + dir * pose.kickLeg * 8;
    const kKneeY = (hipY + kFootY) / 2 - pose.kickLeg * 12;

    const a = pose.armSpread;
    const lEx = shoulderX - headR * (0.9 + a * 0.5), lEy = shoulderY + headR * (0.5 - a * 0.4);
    const lHx = shoulderX - headR * (1.5 + a * 0.7), lHy = shoulderY + headR * (0.2 - a * 0.7);
    const rEx = shoulderX + headR * (0.9 + a * 0.5), rEy = shoulderY + headR * (0.5 - a * 0.4);
    const rHx = shoulderX + headR * (1.5 + a * 0.7), rHy = shoulderY + headR * (0.2 - a * 0.7);

    return (
      <g opacity={figOpacity}>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round" stroke={text} strokeWidth={sw}>
          <circle cx={hX} cy={hY} r={headR} />
          <line x1={shoulderX} y1={shoulderY} x2={hX - Math.sin(headTiltRad) * headR * 0.72} y2={hY + Math.cos(headTiltRad) * headR * 0.72} />
          <line x1={shoulderX} y1={shoulderY} x2={bx} y2={hipY} />
          <polyline points={`${shoulderX},${shoulderY} ${lEx},${lEy} ${lHx},${lHy}`} />
          <polyline points={`${shoulderX},${shoulderY} ${rEx},${rEy} ${rHx},${rHy}`} />
          <polyline points={`${bx},${hipY} ${plantKneeX},${plantKneeY} ${plantFootX},${groundY}`} />
          <polyline points={`${bx},${hipY} ${kKneeX},${kKneeY} ${kFootX},${kFootY}`} />
        </g>
        <StickFace cx={hX} cy={hY} headR={headR} stroke={text} sw={sw} variant={variant} opacity={1} />
      </g>
    );
  };

  const ballOpacity = interpolate(frame, [msToFrames(startDelay * 1000 - 220), msToFrames(startDelay * 1000)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── Stats above the action (centred between the two players) ──
  const statItems = (Array.isArray(stats) ? stats : []).filter((s) => s && (s.label || s.value)).slice(0, 3);
  const statRevealF = msToFrames(500);
  const statIn = (i: number) => interpolate(frame, [statRevealF + i * 6, statRevealF + i * 6 + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const statPanelY = Math.max(12, headCY - headR - (p ? 230 : 290));
  const midX = (leftX + rightX) / 2;

  // ── Right-side text ──
  const titleWipe = interpolate(frame, [msToFrames(300), msToFrames(780)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOutCubic });
  const underline = interpolate(frame, [msToFrames(500), msToFrames(900)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOutCubic });
  const narrationOpacity = interpolate(frame, [msToFrames(600), msToFrames(950)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const badgeIn = interpolate(frame, [msToFrames(750), msToFrames(1130)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut });

  const titlePx = titleFontSize ?? (p ? 72 : 66);
  const descPx = descriptionFontSize ?? (p ? 40 : 34);

  return (
    <AbsoluteFill style={{ background: bg, opacity: sceneOpacity, fontFamily: font, overflow: "hidden" }}>
      <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(ellipse 120% 60% at 50% 110%, rgba(46,125,50,0.10) 0%, transparent 70%)` }} />

      {/* World SVG: grass ground + two jugglers + the aerial ball */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
          <GrassGround W={W} H={H} groundY={groundY} accent={accent} />
          <Player bx={lX} dir={1} pose={poseL} variant={0} />
          <Player bx={rX} dir={-1} pose={poseR} variant={2} />
          <g opacity={ballOpacity}>
            <Football x={ballX} y={ballY} r={ballR} rot={ballRot} sqX={ballSqX} sqY={ballSqY} accent={accent} />
          </g>
        </svg>
      </AbsoluteFill>

      {/* Stats above the action */}
      {statItems.length > 0 && (
        <div style={{ position: "absolute", top: statPanelY, left: midX, transform: "translateX(-50%)", display: "flex", gap: p ? 14 : 16, pointerEvents: "none" }}>
          {statItems.map((s, i) => {
            const inP = statIn(i);
            return (
              <div
                key={i}
                style={{
                  opacity: inP,
                  transform: `translateY(${(1 - inP) * 14}px) rotate(${(i % 2 === 0 ? -1 : 1) * 1.5}deg)`,
                  background: "#C8A26A",
                  border: "3px solid #8A6A3B",
                  borderRadius: 8,
                  padding: p ? "12px 16px" : "12px 18px",
                  minWidth: p ? 110 : 120,
                  textAlign: "center",
                  boxShadow: "4px 5px 0 rgba(0,0,0,0.18)",
                }}
              >
                <div style={{ fontFamily: font, fontWeight: 900, color: "#2B1C0B", fontSize: p ? 40 : 38, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontFamily: font, color: "#4A3416", fontSize: p ? 20 : 18, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Right-side title + narration + skill badge */}
      <div
        style={{
          position: "absolute",
          right: p ? "auto" : W * 0.04,
          left: p ? W * 0.06 : "auto",
          top: p ? H * 0.06 : H * 0.22,
          width: p ? W * 0.88 : W * 0.46,
          pointerEvents: "none",
        }}
      >
        <div style={{ clipPath: `inset(0 ${(1 - titleWipe) * 100}% 0 0)`, WebkitClipPath: `inset(0 ${(1 - titleWipe) * 100}% 0 0)` }}>
          <div
            style={{
              fontSize: titlePx,
              fontFamily: font,
              fontWeight: 900,
              color: text,
              lineHeight: 1.05,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              wordBreak: "break-word",
              overflowWrap: "break-word",
            }}
          >
            {title}
          </div>
        </div>
        <div style={{ height: 4, background: accent, borderRadius: 2, marginTop: 10, transformOrigin: "left center", transform: `scaleX(${underline})`, width: p ? "55%" : "70%" }} />
        {narration && (
          <div
            style={{
              marginTop: p ? 24 : 22,
              fontSize: descPx,
              fontFamily: font,
              fontWeight: 400,
              color: text,
              lineHeight: 1.42,
              opacity: narrationOpacity,
              wordBreak: "break-word",
              overflowWrap: "break-word",
            }}
          >
            {narration}
          </div>
        )}
        <div
          style={{
            display: "inline-block",
            marginTop: p ? 28 : 26,
            opacity: badgeIn,
            transform: `translateY(${(1 - badgeIn) * 16}px)`,
            background: accent,
            borderRadius: 20,
            padding: p ? "10px 24px" : "9px 22px",
            color: "#FFFFFF",
            fontFamily: font,
            fontWeight: 700,
            fontSize: p ? 28 : 24,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(46,125,50,0.3)",
          }}
        >
          {skillCaption}
        </div>
      </div>
    </AbsoluteFill>
  );
};
