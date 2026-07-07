import React from "react";

// ── Football geometry ───────────────────────────────────────────────────────
// Regular pentagon points for the black-and-white ball patches.
export function pentagonPoints(cx: number, cy: number, r: number, startDeg: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = ((startDeg + i * 72) * Math.PI) / 180;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(" ");
}

// Classic black-and-white pentagon football (Telstar style). Draw it at (x,y) with
// the given radius; spin/squish via the optional transform props.
export const Football: React.FC<{
  x: number;
  y: number;
  r: number;
  rot?: number;
  sqX?: number;
  sqY?: number;
  accent: string;
}> = ({ x, y, r, rot = 0, sqX = 1, sqY = 1, accent }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${sqX} ${sqY})`}>
    <circle cx={0} cy={0} r={r} fill="#FFFFFF" stroke="#111111" strokeWidth={3} />
    <g transform={`scale(${r / 18})`}>
      <polygon points={pentagonPoints(0, 0, 6.5, -90)} fill="#111111" />
      {[-90, -18, 54, 126, 198].map((ang, i) => {
        const cxp = Math.cos((ang * Math.PI) / 180) * 12;
        const cyp = Math.sin((ang * Math.PI) / 180) * 12;
        return <polygon key={i} points={pentagonPoints(cxp, cyp, 4, ang + 90)} fill="#111111" />;
      })}
      {[-90, -18, 54, 126, 198].map((ang, i) => {
        const vx = Math.cos((ang * Math.PI) / 180) * 6.5;
        const vy = Math.sin((ang * Math.PI) / 180) * 6.5;
        const ex = Math.cos((ang * Math.PI) / 180) * 17;
        const ey = Math.sin((ang * Math.PI) / 180) * 17;
        return <line key={`s${i}`} x1={vx} y1={vy} x2={ex} y2={ey} stroke="#111111" strokeWidth={1.2} />;
      })}
    </g>
  </g>
);

// ── Grassy ground ────────────────────────────────────────────────────────────
// Solid green grass filling the whole area below `groundY`, with an edge line and
// a dense row of grass blades along the top edge.
export const GrassGround: React.FC<{ W: number; H: number; groundY: number; accent: string }> = ({ W, H, groundY, accent }) => (
  <>
    <rect x={0} y={groundY} width={W} height={H - groundY} fill={accent} />
    <rect x={0} y={groundY} width={W} height={H - groundY} fill="url(#sf_grassShade)" opacity={0.5} />
    <defs>
      <linearGradient id="sf_grassShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#000000" stopOpacity={0} />
        <stop offset="100%" stopColor="#000000" stopOpacity={0.25} />
      </linearGradient>
    </defs>
    <line x1={0} y1={groundY} x2={W} y2={groundY} stroke="#1F5A23" strokeWidth={4} />
    {Array.from({ length: Math.ceil(W / 26) }).map((_, i) => {
      const gx = i * 26 + ((i % 3) - 1) * 3;
      const h = 14 + (i % 4) * 5;
      const lean = ((i % 5) - 2) * 2;
      return (
        <path key={i} d={`M ${gx} ${groundY} q ${lean} ${-h * 0.6} ${lean * 1.4} ${-h}`} stroke="#3C9A42" strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.85} />
      );
    })}
  </>
);

// ── Face (hair, eyes, nose, mouth, per-variant mustache/beard) ───────────────
export const StickFace: React.FC<{
  cx: number;
  cy: number;
  headR: number;
  stroke: string;
  sw: number;
  variant: number;
  opacity: number;
}> = ({ cx, cy, headR, stroke, sw, variant, opacity }) => {
  if (opacity <= 0.02) return null;
  const hairColor = variant === 0 ? "#3B2412" : variant === 1 ? "#111111" : "#5A3A1E";
  return (
    <g opacity={opacity}>
      {variant === 0 ? (
        <g stroke={hairColor} strokeWidth={sw * 0.8}>
          {[-0.6, -0.3, 0, 0.3, 0.6].map((o, i) => (
            <line key={i} x1={cx + o * headR} y1={cy - headR * 0.78} x2={cx + o * headR * 1.1} y2={cy - headR * 1.25} />
          ))}
        </g>
      ) : variant === 1 ? (
        <path d={`M ${cx - headR} ${cy - headR * 0.2} A ${headR} ${headR} 0 0 1 ${cx + headR} ${cy - headR * 0.2} Z`} fill={hairColor} stroke="none" />
      ) : (
        <path d={`M ${cx - headR} ${cy - headR * 0.1} Q ${cx - headR * 0.2} ${cy - headR * 1.3} ${cx + headR} ${cy - headR * 0.3}`} fill="none" stroke={hairColor} strokeWidth={sw} />
      )}
      <circle cx={cx - headR * 0.38} cy={cy - headR * 0.1} r={Math.max(1.6, headR * 0.09)} fill={stroke} stroke="none" />
      <circle cx={cx + headR * 0.38} cy={cy - headR * 0.1} r={Math.max(1.6, headR * 0.09)} fill={stroke} stroke="none" />
      <line x1={cx} y1={cy} x2={cx - headR * 0.12} y2={cy + headR * 0.28} stroke={stroke} strokeWidth={sw * 0.7} strokeLinecap="round" />
      {variant === 0 && (
        <path d={`M ${cx - headR * 0.4} ${cy + headR * 0.42} Q ${cx} ${cy + headR * 0.6} ${cx + headR * 0.4} ${cy + headR * 0.42}`} stroke={stroke} strokeWidth={sw * 0.9} fill="none" strokeLinecap="round" />
      )}
      {variant === 1 && (
        <path d={`M ${cx - headR * 0.7} ${cy + headR * 0.2} Q ${cx} ${cy + headR * 1.5} ${cx + headR * 0.7} ${cy + headR * 0.2}`} fill={stroke} stroke="none" opacity={0.9} />
      )}
      {variant === 2 && (
        <>
          <path d={`M ${cx - headR * 0.38} ${cy + headR * 0.4} Q ${cx} ${cy + headR * 0.56} ${cx + headR * 0.38} ${cy + headR * 0.4}`} stroke={stroke} strokeWidth={sw * 0.9} fill="none" strokeLinecap="round" />
          <path d={`M ${cx - headR * 0.28} ${cy + headR * 0.62} Q ${cx} ${cy + headR * 1.0} ${cx + headR * 0.28} ${cy + headR * 0.62}`} fill={stroke} stroke="none" opacity={0.9} />
        </>
      )}
      {variant !== 1 && (
        <path d={`M ${cx - headR * 0.22} ${cy + headR * 0.34} Q ${cx} ${cy + headR * 0.42} ${cx + headR * 0.22} ${cy + headR * 0.34}`} stroke={stroke} strokeWidth={sw * 0.6} fill="none" strokeLinecap="round" />
      )}
    </g>
  );
};

// ── Player stickman: stands planted on the ground (wide stance, face to camera),
// and can swing a kicking leg toward `faceDir`. `kickLeg`: −0.4 wind-up … 1 full
// follow-through (0 = neutral wide stance). Feet stay on the ground line. ──────
export const PlayerStickman: React.FC<{
  x: number;
  groundY: number;
  faceDir: number;        // +1 faces/kicks right, −1 faces/kicks left
  kickLeg: number;        // −0.4 … 1
  plantBend: number;      // 0..1 knee bend on the plant leg during the kick
  torsoBias: number;      // extra lean (deg) while kicking
  tSec: number;
  thighLen: number;
  shinLen: number;
  torsoLen: number;
  headR: number;
  headLen: number;
  stroke: string;
  sw: number;
  variant: number;
  faceOpacity?: number;
  armPose?: "default" | "despair" | "celebrate" | "gkReach" | "gkHold";
  armPoseAmt?: number;    // 0..1 blend into armPose
  armIdle?: number;       // 0..1 subtle pre-kick hand sway (keeper)
  armSwing?: number;      // signed fore/aft hand swing (px) for active dribbling/balance
  headTilt?: number;      // extra head/neck nod (deg): + nods forward in faceDir, − pulls back
  kneelAmt?: number;      // 0..1 sink to both knees on the ground
  // Forward walk gait (modelled on the whiteboard DrawnTitle figure): thigh swings
  // about the hip and the knee only ever bends backward, so the foot lifts cleanly.
  // `amt` blends the walk in over the kick/stand pose, `cycle` advances the stride,
  // `moveDir` is the direction of travel (+1 right, −1 left).
  walk?: { amt: number; cycle: number; moveDir: number };
}> = ({ x, groundY, faceDir, kickLeg, plantBend, torsoBias, tSec, thighLen, shinLen, torsoLen, headR, headLen, stroke, sw, variant, faceOpacity = 1, armPose = "default", armPoseAmt = 1, armIdle = 0, armSwing = 0, headTilt = 0, kneelAmt = 0, walk }) => {
  const dir = faceDir;
  const footY = groundY;
  const kickFwd = Math.max(0, kickLeg);
  const breath = Math.sin(tSec * 1.3) * 1.2;
  const kneel = Math.max(0, Math.min(1, kneelAmt));
  const blend = (a: number, b: number) => a + (b - a) * kneel;

  const walkAmt = Math.max(0, Math.min(1, walk?.amt ?? 0));
  const walkBob = walkAmt > 0 ? Math.sin((walk?.cycle ?? 0) * 2) * 3 : 0;

  const standHipY = groundY - (thighLen + shinLen);
  const kneelHipY = groundY - thighLen * 0.9;
  const hipY = blend(standHipY, kneelHipY) + walkBob;

  const torsoLean = -dir * (torsoBias + kickFwd * 6 * (1 - kneel * 0.8)) + Math.sin(tSec * 0.6) * 2 * (1 - kneel * 0.5);
  const torsoRad = (torsoLean * Math.PI) / 180;
  const shoulderX = x + Math.sin(torsoRad) * torsoLen;
  const shoulderY = hipY - Math.cos(torsoRad) * torsoLen + breath * (1 - kneel * 0.4);
  const neckExtend = headR * 0.45;
  // The head/neck can nod independently of the torso (e.g. winding back then snapping
  // forward for a header). `headTilt` adds to the torso lean for the head segment only,
  // pivoting about the shoulder, with +headTilt nodding forward in the facing direction.
  const headRad = torsoRad + (dir * headTilt * Math.PI) / 180;
  const headX = shoulderX + Math.sin(headRad) * (headLen + neckExtend);
  const headY = shoulderY - Math.cos(headRad) * (headLen + neckExtend);
  const neckEndX = headX - Math.sin(headRad) * headR * 0.72;
  const neckEndY = headY + Math.cos(headRad) * headR * 0.72;

  const plantFootX0 = x - dir * 22;
  let plantKneeX = (x + plantFootX0) / 2 - dir * 3 + dir * plantBend * 9;
  let plantKneeY = (standHipY + footY) / 2 + 4 + plantBend * 12;
  let plantFootX = plantFootX0;
  let plantFootY = footY - plantBend * 5;

  const restFootX = x + dir * 22;
  const backFootX = x - dir * 26;
  const backFootY = footY - 10;
  const extFootX = x + dir * 72;
  const extFootY = footY - 70;
  let kFootX: number, kFootY: number;
  if (kickLeg >= 0) {
    kFootX = restFootX + (extFootX - restFootX) * kickLeg;
    kFootY = footY + (extFootY - footY) * kickLeg;
  } else {
    const wt = Math.abs(kickLeg) / 0.4;
    kFootX = restFootX + (backFootX - restFootX) * wt;
    kFootY = footY + (backFootY - footY) * wt;
  }
  let kKneeX = (x + kFootX) / 2 + dir * 8 * kickFwd;
  let kKneeY = (standHipY + kFootY) / 2 - kickFwd * 10;

  if (kneel > 0) {
    const lKneeX = x - 20;
    const rKneeX = x + 20;
    const kneeY = (hipY + groundY) / 2 + 8;
    plantKneeX = blend(plantKneeX, lKneeX);
    plantKneeY = blend(plantKneeY, kneeY);
    plantFootX = blend(plantFootX, lKneeX - 9);
    plantFootY = blend(plantFootY, groundY);
    kKneeX = blend(kKneeX, rKneeX);
    kKneeY = blend(kKneeY, kneeY);
    kFootX = blend(kFootX, rKneeX + 9);
    kFootY = blend(kFootY, groundY);
  }

  // ── Forward walk gait ──────────────────────────────────────────────────────
  // Each leg = thigh (hip→knee) + shin (knee→foot). The thigh swings about the hip
  // (sin), the knee only bends backward (rectified sin, lagged 90°) so the trailing
  // foot lifts off the ground — exactly the joint motion of the whiteboard figure.
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  let walkArmSwing = 0;
  if (walkAmt > 0) {
    const move = walk?.moveDir ?? dir;
    const legPose = (phase: number) => {
      const ph = (walk?.cycle ?? 0) + phase;
      const thighRot = (Math.sin(ph) * 32 * Math.PI) / 180;        // ±32° about the hip
      const kneeRot = (Math.max(0, Math.sin(ph - Math.PI / 2)) * 42 * Math.PI) / 180; // knee bends back only
      // Thigh points down, swung toward the travel direction (`move`) by thighRot.
      const kneeX = x + Math.sin(thighRot) * move * thighLen;
      const kneeY = hipY + Math.cos(thighRot) * thighLen;
      // Shin continues from the knee, the knee bending back (away from travel).
      const shinAng = thighRot - kneeRot;
      const footX = kneeX + Math.sin(shinAng) * move * shinLen;
      let footY = kneeY + Math.cos(shinAng) * shinLen;
      if (footY > groundY) footY = groundY; // never sink below the pitch
      return { kneeX, kneeY, footX, footY };
    };
    const front = legPose(0);
    const back = legPose(Math.PI);
    plantKneeX = lerp(plantKneeX, back.kneeX, walkAmt);
    plantKneeY = lerp(plantKneeY, back.kneeY, walkAmt);
    plantFootX = lerp(plantFootX, back.footX, walkAmt);
    plantFootY = lerp(plantFootY, back.footY, walkAmt);
    kKneeX = lerp(kKneeX, front.kneeX, walkAmt);
    kKneeY = lerp(kKneeY, front.kneeY, walkAmt);
    kFootX = lerp(kFootX, front.footX, walkAmt);
    kFootY = lerp(kFootY, front.footY, walkAmt);
    walkArmSwing = Math.sin(walk?.cycle ?? 0) * 26 * walkAmt;
  }

  // Arms: shoulder → elbow → hand (3-point polylines for natural bends).
  const sw2 = kickFwd * 22 + Math.sin(tSec * 1.5) * 3;
  const amt = Math.max(0, Math.min(1, armPoseAmt));
  const idle = Math.max(0, Math.min(1, armIdle));
  const idleSway = Math.sin(tSec * 2.4) * 5 * idle;
  const idleLift = Math.sin(tSec * 1.8 + 0.6) * 3 * idle;

  type ArmPts = { ex: number; ey: number; hx: number; hy: number };
  let lArm: ArmPts;
  let rArm: ArmPts;

  if (armPose === "despair" && amt > 0) {
    // Hands on head — elbows bent wide outside
    lArm = {
      ex: headX - headR * (1.05 + 0.42 * amt),
      ey: headY + headR * 0.22,
      hx: headX - headR * 0.42,
      hy: headY - headR * 0.58 * amt,
    };
    rArm = {
      ex: headX + headR * (1.05 + 0.42 * amt),
      ey: headY + headR * 0.22,
      hx: headX + headR * 0.42,
      hy: headY - headR * 0.58 * amt,
    };
  } else if (armPose === "celebrate" && amt > 0) {
    const r = amt;

    // Start from a loose athletic stance, then sweep into a static victory V
    const defL = {
      ex: shoulderX - headR * 0.72,
      ey: shoulderY + headR * 0.42,
      hx: shoulderX - headR * 0.48,
      hy: shoulderY + headR * 0.78,
    };
    const defR = {
      ex: shoulderX + headR * 0.72,
      ey: shoulderY + headR * 0.42,
      hx: shoulderX + headR * 0.48,
      hy: shoulderY + headR * 0.78,
    };

    const celL = {
      ex: shoulderX - headR * 1.3,
      ey: shoulderY - headR * 0.55,
      hx: shoulderX - headR * 1.44,
      hy: headY - headR * 1.22,
    };
    const celR = {
      ex: shoulderX + headR * 1.26,
      ey: shoulderY - headR * 0.72,
      hx: shoulderX + headR * 1.58,
      hy: headY - headR * 1.48,
    };

    const mix = (from: number, to: number) => from + (to - from) * r;
    lArm = {
      ex: mix(defL.ex, celL.ex),
      ey: mix(defL.ey, celL.ey),
      hx: mix(defL.hx, celL.hx),
      hy: mix(defL.hy, celL.hy),
    };
    rArm = {
      ex: mix(defR.ex, celR.ex),
      ey: mix(defR.ey, celR.ey),
      hx: mix(defR.hx, celR.hx),
      hy: mix(defR.hy, celR.hy),
    };
  } else if (armPose === "gkReach" && amt > 0) {
    // Diving reach — natural arm length, both gloves toward the ball
    const reach = amt;
    lArm = {
      ex: x - 14 - reach * 5,
      ey: shoulderY - 4 - reach * 16 + idleLift,
      hx: x - 26 - reach * 30,
      hy: shoulderY - 16 - reach * 26,
    };
    rArm = {
      ex: x + 8 + idleSway * 0.3,
      ey: shoulderY - 8 - reach * 18,
      hx: x - 20 - reach * 34,
      hy: shoulderY - 18 - reach * 28,
    };
  } else if (armPose === "gkHold" && amt > 0) {
    // Both hands clutching the ball in front
    const hold = amt;
    const ballGripX = x - 28 * hold;
    const ballGripY = shoulderY - 16 - 18 * hold;
    lArm = {
      ex: x - 12,
      ey: shoulderY - 4 - 12 * hold,
      hx: ballGripX - 10,
      hy: ballGripY,
    };
    rArm = {
      ex: x + 8,
      ey: shoulderY - 6 - 14 * hold,
      hx: ballGripX + 10,
      hy: ballGripY,
    };
  } else {
    lArm = { ex: x - 32 + idleSway, ey: shoulderY + 20 - idleLift, hx: x - 13 + idleSway * 0.4, hy: hipY - 2 };
    rArm = { ex: x + 32 - idleSway, ey: shoulderY + 20 - idleLift, hx: x + 13 - idleSway * 0.4, hy: hipY - 2 };
    const frontArm = dir > 0 ? rArm : lArm;
    frontArm.ey -= sw2 * 0.4;
    frontArm.hy -= sw2 * 0.3;
    if (walkAmt > 0) {
      // Hands swing fore/aft opposite to the legs while walking.
      const move = walk?.moveDir ?? dir;
      lArm.hx += walkArmSwing * move;
      lArm.hy += Math.abs(walkArmSwing) * 0.3;
      rArm.hx -= walkArmSwing * move;
      rArm.hy += Math.abs(walkArmSwing) * 0.3;
    }
    if (armSwing !== 0) {
      // Active balance swing (dribbling/heading): arms pump in opposition, the leading
      // hand also lifts a little as it comes forward. Elbows follow the hands slightly.
      lArm.hx += armSwing * dir;
      lArm.ex += armSwing * dir * 0.5;
      lArm.hy -= Math.max(0, armSwing * dir) * 0.35;
      rArm.hx -= armSwing * dir;
      rArm.ex -= armSwing * dir * 0.5;
      rArm.hy -= Math.max(0, -armSwing * dir) * 0.35;
    }
  }

  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke={stroke} strokeWidth={sw}>
        <circle cx={headX} cy={headY} r={headR} fill="none" />
        <line x1={shoulderX} y1={shoulderY} x2={x} y2={hipY} />
        <line x1={shoulderX} y1={shoulderY} x2={neckEndX} y2={neckEndY} />
        <polyline points={`${shoulderX},${shoulderY} ${lArm.ex},${lArm.ey} ${lArm.hx},${lArm.hy}`} />
        <polyline points={`${shoulderX},${shoulderY} ${rArm.ex},${rArm.ey} ${rArm.hx},${rArm.hy}`} />
        <polyline points={`${x},${hipY} ${plantKneeX},${plantKneeY} ${plantFootX},${plantFootY}`} />
        <polyline points={`${x},${hipY} ${kKneeX},${kKneeY} ${kFootX},${kFootY}`} />
      </g>
      <StickFace cx={headX} cy={headY} headR={headR} stroke={stroke} sw={sw} variant={variant} opacity={faceOpacity} />
    </g>
  );
};
