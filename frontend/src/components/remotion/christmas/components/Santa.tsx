/**
 * Santa — an SVG rig drawn in a local 200 × 260 box (feet at 100,260).
 *
 * Joints use nested transforms (same technique as stickman_2/NightWalk): each arm
 * is a group rotated at the shoulder, with the forearm a child group rotated at the
 * elbow, so poses are just angles. Idle life: a belly bob, a beard sway and blinks.
 *
 * Poses
 *  - wave    right arm up, waving; left hand on the belly
 *  - hold    both hands forward at chest height (holding a sign / letter)
 *  - sleigh  seated, both hands forward on the reins (lower body hidden by the sleigh)
 *  - idle    arms relaxed
 *  - walk    walking: legs stride, arms swing
 *  - pull    walking while the left hand pulls a rope back and down (see santaHand)
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { FESTIVE, mix } from "../christmasStyle";

export type SantaPose = "wave" | "hold" | "sleigh" | "idle" | "walk" | "pull";

const SUIT = "#C8202F";
const SUIT_DARK = "#8F1420";
const TRIM = "#FFFFFF";
const BOOT = "#2A1A14";
const MITT = "#1E5F3D";

/** Walk-cycle phase (radians) for a frame. */
const stride = (frame: number) => frame / 4.2;

/** Fixed left-arm angles [upper, forearm] for the `pull` pose (rope hand back and down). */
export const SANTA_PULL_ARM: [number, number] = [62, 14];
/** Left shoulder pivot in Santa's local units. */
export const SANTA_LEFT_SHOULDER = { x: 56, y: 124 } as const;

/**
 * Where a hand (mitten centre) ends up, in Santa's local units, for an arm with the
 * given shoulder pivot and [upper, forearm] angles — matches <Arm/>'s geometry.
 */
export const santaHand = (shoulder: { x: number; y: number }, [upper, fore]: [number, number]) => {
  const r = (deg: number) => (deg * Math.PI) / 180;
  const ex = shoulder.x - 40 * Math.sin(r(upper));
  const ey = shoulder.y + 40 * Math.cos(r(upper));
  return { x: ex - 46 * Math.sin(r(upper + fore)), y: ey + 46 * Math.cos(r(upper + fore)) };
};

/** Arm angles [upper, forearm] in degrees for each pose (0 = hanging straight down). */
const armAngles = (pose: SantaPose, frame: number, side: "left" | "right"): [number, number] => {
  const breathe = Math.sin(frame / 18) * 3;
  if (pose === "wave") {
    if (side === "right") return [-145 + Math.sin(frame / 9) * 6, -25 + Math.sin(frame / 4.2) * 28];
    return [28, -95]; // hand resting on the belly
  }
  if (pose === "walk" || pose === "pull") {
    const swing = Math.sin(stride(frame)) * 22;
    if (side === "left") return pose === "pull" ? SANTA_PULL_ARM : [14 - swing, 12];
    return [-14 - swing, -12];
  }
  if (pose === "hold") return side === "right" ? [-62 + breathe, -38] : [62 - breathe, 38];
  if (pose === "sleigh") {
    const tug = Math.sin(frame / 6) * 6;
    return side === "right" ? [-70 + tug, -30] : [70 - tug, 30];
  }
  return side === "right" ? [-12 + breathe, -8] : [12 - breathe, 8];
};

const Arm: React.FC<{ x: number; y: number; upper: number; fore: number }> = ({ x, y, upper, fore }) => (
  <g transform={`translate(${x} ${y}) rotate(${upper.toFixed(2)})`}>
    <line x1={0} y1={0} x2={0} y2={40} stroke={SUIT} strokeWidth={26} strokeLinecap="round" />
    <g transform={`translate(0 40) rotate(${fore.toFixed(2)})`}>
      <line x1={0} y1={0} x2={0} y2={30} stroke={SUIT} strokeWidth={24} strokeLinecap="round" />
      <rect x={-14} y={28} width={28} height={10} rx={5} fill={TRIM} />
      <circle cx={0} cy={46} r={11} fill={MITT} />
      <ellipse cx={-8} cy={42} rx={5} ry={7} fill={MITT} />
    </g>
  </g>
);

/** Santa as an SVG group in his local 200 × 260 units — embed inside any <svg>. */
export const SantaFigure: React.FC<{
  frame: number;
  pose?: SantaPose;
  /** Extra SVG drawn in Santa's local coordinates on top of the body (e.g. a held sign). */
  children?: React.ReactNode;
}> = ({ frame, pose = "idle", children }) => {
  const walking = pose === "walk" || pose === "pull";
  const bob = walking ? -Math.abs(Math.sin(stride(frame))) * 4 : Math.sin(frame / 10) * (pose === "wave" ? 2.5 : 1.5);
  const legSwing = walking ? Math.sin(stride(frame)) * 18 : 0;
  const beard = Math.sin(frame / 14) * 2.2;
  // Blink for 4 frames roughly every 3.3 s (deterministic).
  const blink = frame % 100 > 95 ? 0.15 : 1;
  const [ru, rf] = armAngles(pose, frame, "right");
  const [lu, lf] = armAngles(pose, frame, "left");
  const seated = pose === "sleigh";
  return (
      <g transform={`translate(0 ${bob.toFixed(2)})`}>
        {/* legs + boots (hidden in the sleigh) */}
        {!seated ? (
          <g>
            <g transform={`rotate(${legSwing.toFixed(2)} 83 198)`}>
              <rect x={70} y={196} width={26} height={44} rx={8} fill={SUIT_DARK} />
              <rect x={66} y={226} width={30} height={10} rx={4} fill={TRIM} />
              <path d="M64 236 h34 v18 q0 6 -6 6 h-36 q-6 0 -4 -8 z" fill={BOOT} />
            </g>
            <g transform={`rotate(${(-legSwing).toFixed(2)} 117 198)`}>
              <rect x={104} y={196} width={26} height={44} rx={8} fill={SUIT_DARK} />
              <rect x={104} y={226} width={30} height={10} rx={4} fill={TRIM} />
              <path d="M102 236 h34 l10 16 q2 8 -6 8 h-38 z" fill={BOOT} />
            </g>
          </g>
        ) : null}

        {/* left arm behind the body when holding / on the reins */}
        {pose !== "wave" ? <Arm x={56} y={124} upper={lu} fore={lf} /> : null}

        {/* coat */}
        <ellipse cx={100} cy={166} rx={64} ry={62} fill={SUIT} />
        <path d="M44 150 Q40 200 60 220 L140 220 Q160 200 156 150 Z" fill={SUIT} />
        <ellipse cx={82} cy={150} rx={22} ry={36} fill={mix(SUIT, "#ffffff", 0.12)} opacity={0.5} />
        <rect x={93} y={112} width={14} height={104} fill={TRIM} rx={4} />
        <rect x={40} y={208} width={120} height={18} rx={9} fill={TRIM} />
        {/* belt */}
        <rect x={38} y={168} width={124} height={15} fill={BOOT} />
        <rect x={87} y={163} width={26} height={25} rx={3} fill="none" stroke={FESTIVE.gold} strokeWidth={5} />

        {pose === "wave" ? <Arm x={56} y={124} upper={lu} fore={lf} /> : null}
        <Arm x={144} y={124} upper={ru} fore={rf} />

        {/* head */}
        <circle cx={100} cy={80} r={30} fill={FESTIVE.skin} />
        <circle cx={83} cy={88} r={7} fill={FESTIVE.cheek} opacity={0.75} />
        <circle cx={117} cy={88} r={7} fill={FESTIVE.cheek} opacity={0.75} />
        <g transform={`translate(0 ${(76 * (1 - blink)).toFixed(2)}) scale(1 ${blink})`}>
          <ellipse cx={90} cy={76} rx={3.2} ry={4} fill="#2A1A14" />
          <ellipse cx={110} cy={76} rx={3.2} ry={4} fill="#2A1A14" />
        </g>
        <path d="M82 66 q8 -5 14 0" stroke={TRIM} strokeWidth={4} fill="none" strokeLinecap="round" />
        <path d="M104 66 q8 -5 14 0" stroke={TRIM} strokeWidth={4} fill="none" strokeLinecap="round" />

        {/* beard (sways from the chin) */}
        <g transform={`rotate(${beard.toFixed(2)} 100 96)`}>
          <path
            d="M68 82 Q64 112 78 130 Q88 146 100 150 Q112 146 122 130 Q136 112 132 82 Q120 104 100 104 Q80 104 68 82 Z"
            fill={TRIM}
          />
          <path d="M78 122 q6 8 12 4 M100 140 q4 6 8 0 M112 124 q6 6 10 -2" stroke={FESTIVE.snowShade} strokeWidth={2} fill="none" />
        </g>
        <ellipse cx={90} cy={96} rx={12} ry={6} fill={TRIM} />
        <ellipse cx={110} cy={96} rx={12} ry={6} fill={TRIM} />
        <circle cx={100} cy={88} r={6} fill={FESTIVE.cheek} />
        <path d="M94 103 q6 4 12 0" stroke="#7A2A22" strokeWidth={2.5} fill="none" strokeLinecap="round" />

        {/* hat */}
        <path d={`M70 58 Q78 22 106 18 Q136 16 ${150 + beard * 1.5} ${44 + beard} L136 58 Z`} fill={SUIT} />
        <circle cx={150 + beard * 1.5} cy={46 + beard} r={11} fill={TRIM} />
        <rect x={64} y={50} width={74} height={17} rx={8.5} fill={TRIM} />

        {children}
      </g>
  );
};

/** Santa as a standalone SVG, `height` px tall. */
export const Santa: React.FC<{
  frame: number;
  pose?: SantaPose;
  /** Rendered height in px (the rig is 260 units tall). */
  height: number;
  /** Mirror horizontally (face the other way). */
  flip?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ frame, pose = "idle", height, flip = false, style, children }) => (
  <svg
    width={(200 * height) / 260}
    height={height}
    viewBox="0 0 200 260"
    style={{ overflow: "visible", transform: flip ? "scaleX(-1)" : undefined, ...style }}
  >
    <SantaFigure frame={frame} pose={pose}>
      {children}
    </SantaFigure>
  </svg>
);

/** Where Santa's hands are (local units) in the `hold` pose — for placing a held prop. */
export const SANTA_HOLD_CENTER = { x: 100, y: 150 } as const;
