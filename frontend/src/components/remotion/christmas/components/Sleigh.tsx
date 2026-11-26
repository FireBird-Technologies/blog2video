/**
 * The flying team: two galloping reindeer (the lead one with a glowing red nose),
 * reins, and Santa seated in a red sleigh piled with gifts.
 *
 * Everything is drawn in one local 820 × 260 box facing RIGHT (direction of
 * travel), runners at y ≈ 250. Reindeer legs use nested hip/knee transforms driven
 * by a gallop cycle.
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { FESTIVE, mix, withOpacity } from "../christmasStyle";
import { SantaFigure } from "./Santa";

const FUR = "#8B5A3C";
const FUR_DARK = "#5E3B25";
const FUR_LIGHT = "#C9A27E";
const HOOF = "#2A1A14";
const SLEIGH = "#C8202F";

const Leg: React.FC<{ x: number; y: number; thigh: number; knee: number }> = ({ x, y, thigh, knee }) => (
  <g transform={`translate(${x} ${y}) rotate(${thigh.toFixed(2)})`}>
    <line x1={0} y1={0} x2={0} y2={30} stroke={FUR} strokeWidth={11} strokeLinecap="round" />
    <g transform={`translate(0 30) rotate(${knee.toFixed(2)})`}>
      <line x1={0} y1={0} x2={0} y2={28} stroke={FUR_DARK} strokeWidth={7} strokeLinecap="round" />
      <rect x={-5} y={26} width={10} height={7} rx={2} fill={HOOF} />
    </g>
  </g>
);

/** One reindeer in a local 220 × 170 box facing right, feet at y ≈ 165. */
export const Reindeer: React.FC<{ frame: number; phase?: number; rudolph?: boolean; galloping?: boolean }> = ({
  frame,
  phase = 0,
  rudolph = false,
  galloping = true,
}) => {
  const c = galloping ? frame * 0.42 + phase : 0;
  const bob = galloping ? Math.sin(c * 2) * 4 : 0;
  const leg = (o: number, front: boolean): [number, number] => {
    if (!galloping) return [0, 0];
    const thigh = Math.sin(c + o) * (front ? 38 : 32);
    const knee = (front ? -1 : 1) * Math.max(0, Math.sin(c + o - Math.PI / 2)) * 55;
    return [thigh, knee];
  };
  const glow = 0.6 + 0.4 * Math.sin(frame / 5);
  return (
    <g transform={`translate(0 ${bob.toFixed(2)})`}>
      {/* far legs (darker) */}
      <g opacity={0.8}>
        <Leg x={72} y={100} thigh={leg(Math.PI, false)[0]} knee={leg(Math.PI, false)[1]} />
        <Leg x={148} y={100} thigh={leg(Math.PI * 0.5, true)[0]} knee={leg(Math.PI * 0.5, true)[1]} />
      </g>
      {/* tail */}
      <ellipse cx={42} cy={74} rx={12} ry={8} fill={FUR_LIGHT} transform="rotate(-25 42 74)" />
      {/* body */}
      <ellipse cx={110} cy={84} rx={66} ry={30} fill={FUR} />
      <ellipse cx={112} cy={98} rx={48} ry={13} fill={FUR_LIGHT} opacity={0.75} />
      {/* harness */}
      <rect x={96} y={56} width={14} height={58} rx={4} fill={mix(FESTIVE.pine, "#000", 0.1)} />
      <circle cx={103} cy={66} r={4} fill={FESTIVE.gold} />
      <circle cx={103} cy={82} r={4} fill={FESTIVE.gold} />
      <circle cx={103} cy={98} r={4} fill={FESTIVE.gold} />
      {/* neck + head */}
      <path d="M150 76 Q160 40 176 22 L196 34 Q178 56 172 90 Z" fill={FUR} />
      <ellipse cx={190} cy={26} rx={24} ry={15} fill={FUR} transform="rotate(12 190 26)" />
      <ellipse cx={208} cy={32} rx={11} ry={8} fill={FUR_LIGHT} />
      <circle cx={186} cy={20} r={3.2} fill={HOOF} />
      <path d="M176 10 q-8 -8 -14 -2 q6 6 14 6 z" fill={FUR_DARK} />
      {/* antlers */}
      <path
        d="M182 8 Q178 -18 168 -30 M178 -12 Q166 -14 160 -24 M174 -22 Q182 -34 186 -44 M190 8 Q196 -16 210 -26 M198 -10 Q210 -8 216 -16 M204 -20 Q204 -34 198 -42"
        stroke={FUR_DARK}
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
      />
      {/* nose */}
      {rudolph ? (
        <>
          <circle cx={219} cy={30} r={14 + glow * 6} fill={withOpacity("#FF3B3B", 0.25 * glow)} />
          <circle cx={219} cy={30} r={7} fill="#E5202E" />
          <circle cx={217} cy={28} r={2.2} fill="#FFB3B3" />
        </>
      ) : (
        <circle cx={219} cy={30} r={5.5} fill={HOOF} />
      )}
      {/* near legs */}
      <Leg x={84} y={102} thigh={leg(0, false)[0]} knee={leg(0, false)[1]} />
      <Leg x={160} y={102} thigh={leg(-Math.PI * 0.5, true)[0]} knee={leg(-Math.PI * 0.5, true)[1]} />
    </g>
  );
};

/** The sleigh (with Santa seated in it and a pile of gifts), local 300 × 220, facing right. */
const SleighBody: React.FC<{ frame: number; accent: string }> = ({ frame, accent }) => (
  <g>
    {/* gift sack + boxes behind Santa */}
    <ellipse cx={70} cy={82} rx={52} ry={56} fill={mix(FESTIVE.wood, "#fff", 0.3)} />
    <path d="M44 34 q26 -24 52 0" stroke={FESTIVE.woodDark} strokeWidth={6} fill="none" />
    <rect x={20} y={88} width={44} height={40} rx={3} fill={FESTIVE.pine} />
    <rect x={38} y={88} width={8} height={40} fill={FESTIVE.gold} />
    <rect x={64} y={76} width={40} height={52} rx={3} fill={accent} />
    <rect x={80} y={76} width={8} height={52} fill={FESTIVE.snow} />
    {/* Santa, seated (his legs are hidden by the sleigh body drawn after him) */}
    <g transform="translate(98 -44) scale(0.7)">
      <SantaFigure frame={frame} pose="sleigh" />
    </g>
    {/* sleigh body */}
    <path
      d="M10 120 L226 120 Q268 118 270 78 Q272 54 252 50 Q238 50 240 66 Q244 92 214 104 L40 104 Q14 100 10 120 Z"
      fill={mix(SLEIGH, "#000", 0.15)}
    />
    <path d="M8 118 L232 118 Q262 116 260 160 L240 176 L40 176 Q8 176 8 140 Z" fill={SLEIGH} />
    <path d="M24 132 L232 132" stroke={FESTIVE.gold} strokeWidth={5} strokeLinecap="round" />
    <path d="M30 160 Q130 170 236 156" stroke={FESTIVE.gold} strokeWidth={3} fill="none" />
    {/* runners */}
    <path d="M40 176 L40 200 M200 176 L200 200" stroke={FESTIVE.gold} strokeWidth={6} />
    <path d="M0 202 L250 202 Q292 202 290 176 Q288 160 274 164" stroke={FESTIVE.gold} strokeWidth={7} fill="none" strokeLinecap="round" />
  </g>
);

export const SleighTeam: React.FC<{
  frame: number;
  /** Rendered width in px (the team is 820 units wide). */
  width: number;
  accent: string;
  /** Sparkle trail behind the runners (0 = none). */
  trail?: number;
  style?: React.CSSProperties;
}> = ({ frame, width, accent, trail = 1, style }) => {
  const scale = width / 820;
  return (
    <svg width={width} height={260 * scale} viewBox="0 -60 820 320" style={{ overflow: "visible", ...style }}>
      {trail > 0
        ? Array.from({ length: 14 }, (_, i) => {
            const t = (frame * 0.6 + i * 7) % 98;
            const x = 10 - t * 3.2;
            const y = 236 + Math.sin((frame + i * 13) / 6) * 10 + (i % 3) * 6;
            const o = (1 - t / 98) * trail;
            const r = 3 + (i % 4);
            return (
              <path
                key={i}
                d={`M${x} ${y - r * 2} L${x + r * 0.5} ${y - r * 0.5} L${x + r * 2} ${y} L${x + r * 0.5} ${y + r * 0.5} L${x} ${y + r * 2} L${x - r * 0.5} ${y + r * 0.5} L${x - r * 2} ${y} L${x - r * 0.5} ${y - r * 0.5} Z`}
                fill={i % 2 ? FESTIVE.gold : FESTIVE.goldLight}
                opacity={o}
              />
            );
          })
        : null}
      {/* reins from Santa's hands to the harnesses */}
      <path d="M262 108 Q420 150 500 120 Q560 100 640 120" stroke={FESTIVE.woodDark} strokeWidth={3} fill="none" />
      <path d="M262 112 Q400 160 470 128" stroke={FESTIVE.woodDark} strokeWidth={3} fill="none" />
      <g transform="translate(0 50)">
        <SleighBody frame={frame} accent={accent} />
      </g>
      <g transform="translate(350 60) scale(0.9)">
        <Reindeer frame={frame} phase={0.9} />
      </g>
      <g transform="translate(560 40) scale(0.95)">
        <Reindeer frame={frame} rudolph />
      </g>
    </svg>
  );
};
