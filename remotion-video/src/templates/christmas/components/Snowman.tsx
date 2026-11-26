/**
 * Snowman — an SVG character in a local 300 × 420 box (base at 150,420).
 *
 * `build` 0→1 assembles him: the three snowballs stack with a pop (bottom, middle,
 * head), the top hat drops on, then the scarf, face and stick arms appear.
 * Idle life: the eyes blink (a smooth close/open about every 2.3 s, with a double
 * blink every third time), a gentle squash-bob, head tilt, a fluttering scarf tail
 * and a wiggling carrot nose. The stick arms hold still.
 *
 * Poses
 *  - wave  his left stick arm (viewer's right) raised in a hello; the other out to the side
 *  - point his left stick arm (viewer's right) stretches out at `pointAngle`
 *          degrees (0 = straight right, negative = up), the other hangs out low
 *  - hold  both stick arms reach to the sides of something held in front of him;
 *          `holdHalfW` / `holdY` give its half-width and centre height (local units)
 *
 * `hat`, `arms` and `buttons` (all default true) can be switched off for a plain
 * snowman — just the snowballs, face and scarf.
 *
 * `outfit`: "classic" (black top hat, red scarf) or "cozy" — a green knitted beanie
 * with a white ribbed band and red pom-pom, a green-and-white scarf, red mittens on
 * the stick hands and rosy cheeks.
 * `mittenColor` puts mittens on any outfit.
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { Easing, interpolate } from "remotion";
import { clamp, FESTIVE, mix, withOpacity } from "../christmasStyle";

const COAL = "#23262B";
const CARROT = "#F08A24";
const STICK = "#6B4A2E";

/**
 * Eye openness (1 = open, ~0.08 = shut) for a frame: one smooth 8-frame blink every
 * 70 frames, and a second quick blink just before it every third cycle.
 */
const eyeOpenness = (frame: number): number => {
  const PERIOD = 70;
  const LEN = 8;
  const t = frame % PERIOD;
  const cycle = Math.floor(frame / PERIOD);
  const shut = (start: number) => (t >= start && t < start + LEN ? Math.sin((Math.PI * (t - start)) / LEN) : 0);
  const closed = Math.max(shut(PERIOD - LEN), cycle % 3 === 2 ? shut(PERIOD - LEN * 2 - 4) : 0);
  return 1 - closed * 0.92;
};

const popIn = (build: number, from: number, to: number) =>
  interpolate(build, [from, to], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) });

/** A twiggy stick arm from (x, y) at `angle` degrees (0 = pointing right, y down). */
const StickArm: React.FC<{ x: number; y: number; angle: number; length: number; grow: number; mitten?: string }> = ({
  x,
  y,
  angle,
  length,
  grow,
  mitten,
}) => {
  if (grow <= 0) return null;
  const a = (angle * Math.PI) / 180;
  const L = length * grow;
  const ex = x + Math.cos(a) * L;
  const ey = y + Math.sin(a) * L;
  const twig = (t: number, off: number, len: number) => {
    const bx = x + Math.cos(a) * L * t;
    const by = y + Math.sin(a) * L * t;
    return `M${bx.toFixed(1)} ${by.toFixed(1)} L${(bx + Math.cos(a + off) * len).toFixed(1)} ${(by + Math.sin(a + off) * len).toFixed(1)}`;
  };
  return (
    <g>
      <path
        d={`M${x} ${y} L${ex.toFixed(1)} ${ey.toFixed(1)} ${twig(0.62, -0.7, 22 * grow)} ${mitten ? "" : `${twig(1, -0.55, 18 * grow)} ${twig(1, 0.5, 16 * grow)}`}`}
        stroke={STICK}
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
      />
      {mitten && grow > 0.6 ? (
        <g transform={`translate(${ex.toFixed(1)} ${ey.toFixed(1)}) rotate(${angle.toFixed(1)})`}>
          <ellipse cx={4} cy={0} rx={14} ry={11} fill={mitten} />
          <ellipse cx={0} cy={-10} rx={5} ry={7} fill={mitten} transform="rotate(-30 0 -10)" />
          <rect x={-12} y={-11} width={7} height={22} rx={3} fill={FESTIVE.snow} />
        </g>
      ) : null}
    </g>
  );
};

export const SnowmanFigure: React.FC<{
  frame: number;
  accent: string;
  build?: number;
  pose?: "wave" | "hold" | "point";
  /** `point` pose: arm angle in degrees (0 = right, y down). */
  pointAngle?: number;
  holdHalfW?: number;
  holdY?: number;
  shade?: string;
  hat?: boolean;
  arms?: boolean;
  buttons?: boolean;
  outfit?: "classic" | "cozy";
  /** Override the scarf colour (defaults: accent for classic, pine for cozy). */
  scarfColor?: string;
  /** Mittens on the stick hands in this colour (default: accent for cozy, none for classic). */
  mittenColor?: string;
}> = ({ frame, accent, build = 1, pose = "wave", pointAngle = -12, holdHalfW = 130, holdY = 260, shade = FESTIVE.snowShade, hat = true, arms: showArms = true, buttons = true, outfit = "classic", scarfColor: scarfOverride, mittenColor }) => {
  const cozy = outfit === "cozy";
  const scarfColor = scarfOverride ?? (cozy ? FESTIVE.pine : accent);
  const scarfStripe = cozy ? FESTIVE.snow : FESTIVE.gold;
  const mitten = mittenColor ?? (cozy ? accent : undefined);
  const id = React.useId().replace(/:/g, "");
  const bottom = popIn(build, 0, 0.28);
  const middle = popIn(build, 0.18, 0.44);
  const head = popIn(build, 0.34, 0.6);
  const hatDrop = interpolate(build, [0.56, 0.78], [0, 1], { ...clamp, easing: Easing.bounce });
  const face = interpolate(build, [0.66, 0.82], [0, 1], clamp);
  const scarf = popIn(build, 0.7, 0.88);
  const arms = interpolate(build, [0.8, 1], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const alive = build >= 1;

  const squash = alive ? Math.sin(frame / 14) * 0.012 : 0;
  const tilt = alive ? Math.sin(frame / 26) * 3.5 : 0;
  const blink = alive ? eyeOpenness(frame) : 1;
  const flutter = Math.sin(frame / 6) * 7 + Math.sin(frame / 3.3) * 3;
  const nose = alive ? Math.sin(frame / 9) * 4 : 0;

  // Arms (shoulders on the middle ball).
  const leftShoulder = { x: 86, y: 196 };
  const rightShoulder = { x: 214, y: 196 };
  // Arms are still (no waving) — only the eyes and small idle motions animate.
  let leftAngle = 158; // out and a little down
  let rightAngle = -34; // raised up-right in a hello
  let leftLen = 112;
  let rightLen = 112;
  if (pose === "point") {
    rightAngle = pointAngle;
    rightLen = 150;
    leftAngle = 150;
  }
  if (pose === "hold") {
    const toL = { x: 150 - holdHalfW - leftShoulder.x, y: holdY - leftShoulder.y };
    const toR = { x: 150 + holdHalfW - rightShoulder.x, y: holdY - rightShoulder.y };
    leftAngle = (Math.atan2(toL.y, toL.x) * 180) / Math.PI;
    rightAngle = (Math.atan2(toR.y, toR.x) * 180) / Math.PI;
    leftLen = Math.hypot(toL.x, toL.y) + 10;
    rightLen = Math.hypot(toR.x, toR.y) + 10;
  }

  const ball = (cx: number, cy: number, r: number, s: number) =>
    s > 0 ? (
      <g transform={`translate(${cx} ${cy}) scale(${s.toFixed(3)}) translate(${-cx} ${-cy})`}>
        <circle cx={cx} cy={cy} r={r} fill={`url(#snowball-${id})`} stroke={mix(shade, "#5d7891", 0.2)} strokeWidth={2.5} />
        <path d={`M${cx - r * 0.75} ${cy + r * 0.35} Q${cx} ${cy + r * 0.9} ${cx + r * 0.75} ${cy + r * 0.35}`} stroke={withOpacity(shade, 0.7)} strokeWidth={3} fill="none" />
      </g>
    ) : null;

  return (
    <g transform={`translate(150 420) scale(${(1 - squash).toFixed(4)} ${(1 + squash).toFixed(4)}) translate(-150 -420)`}>
      <defs>
        <radialGradient id={`snowball-${id}`} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor={FESTIVE.snow} />
          <stop offset="0.65" stopColor={mix(FESTIVE.snow, shade, 0.25)} />
          <stop offset="1" stopColor={shade} />
        </radialGradient>
      </defs>
      <ellipse cx={150} cy={414} rx={110 * bottom} ry={14 * bottom} fill={withOpacity(shade, 0.75)} />

      {/* arms behind the body */}
      {showArms ? (
        <>
          <StickArm x={leftShoulder.x} y={leftShoulder.y} angle={leftAngle} length={leftLen} grow={arms} mitten={mitten} />
          <StickArm x={rightShoulder.x} y={rightShoulder.y} angle={rightAngle} length={rightLen} grow={arms} mitten={mitten} />
        </>
      ) : null}

      {ball(150, 322, 96, bottom)}
      {ball(150, 196, 70, middle)}
      {/* buttons */}
      {(buttons ? [168, 200, 232] : []).map((y, i) => (
        <circle key={y} cx={150} cy={y} r={7 * face} fill={COAL} opacity={i === 0 && middle < 1 ? 0 : 1} />
      ))}

      {/* head (tilts) */}
      <g transform={`rotate(${tilt.toFixed(2)} 150 128)`}>
        {ball(150, 88, 52, head)}
        {face > 0 ? (
          <g opacity={face}>
            <g transform={`translate(0 ${(76 * (1 - blink)).toFixed(2)}) scale(1 ${blink})`}>
              <circle cx={133} cy={76} r={6} fill={COAL} />
              <circle cx={167} cy={76} r={6} fill={COAL} />
              <circle cx={131} cy={74} r={1.8} fill="#fff" />
              <circle cx={165} cy={74} r={1.8} fill="#fff" />
            </g>
            <g transform={`rotate(${nose.toFixed(2)} 150 92)`}>
              <path d="M148 86 L200 96 L148 100 Z" fill={CARROT} stroke={mix(CARROT, "#000", 0.25)} strokeWidth={1.5} />
              <path d="M162 90 l4 7 M176 92 l3 5" stroke={mix(CARROT, "#000", 0.3)} strokeWidth={1.5} />
            </g>
            {cozy ? (
              <>
                <circle cx={122} cy={96} r={9} fill={FESTIVE.cheek} opacity={0.55} />
                <circle cx={178} cy={96} r={9} fill={FESTIVE.cheek} opacity={0.55} />
              </>
            ) : null}
            {[0, 1, 2, 3, 4].map((i) => {
              const a = Math.PI * (0.2 + i * 0.15);
              return <circle key={i} cx={150 - Math.cos(a) * 24} cy={104 + Math.sin(a) * 10} r={3.4} fill={COAL} />;
            })}
          </g>
        ) : null}
        {/* knitted beanie drops on (cozy): hugs the top of the head (centre 150,88,
            r 52) — the ribbed band ends at y 62, well above the eyes at y 76. */}
        {hat && cozy && hatDrop > 0 ? (
          <g transform={`translate(0 ${((1 - hatDrop) * -160).toFixed(1)}) rotate(-4 150 50)`}>
            <path d="M104 50 Q104 2 150 0 Q196 2 196 50 Z" fill={FESTIVE.pine} />
            <path d="M122 12 Q124 32 122 48 M136 5 Q138 28 136 48 M150 2 L150 48 M164 5 Q162 28 164 48 M178 12 Q176 32 178 48" stroke={mix(FESTIVE.pine, "#000000", 0.18)} strokeWidth={3} fill="none" />
            <rect x={100} y={44} width={100} height={18} rx={8} fill={FESTIVE.snow} stroke={withOpacity(FESTIVE.snowShade, 0.9)} strokeWidth={2} />
            <path d="M112 46 v14 M124 46 v14 M136 46 v14 M148 46 v14 M160 46 v14 M172 46 v14 M184 46 v14" stroke={withOpacity(FESTIVE.snowShade, 0.9)} strokeWidth={2} />
            <circle cx={150} cy={-4} r={14} fill={accent} />
            <circle cx={145} cy={-9} r={4.5} fill={mix(accent, "#ffffff", 0.35)} />
          </g>
        ) : null}
        {/* top hat drops on (classic) */}
        {hat && !cozy && hatDrop > 0 ? (
          <g transform={`translate(0 ${((1 - hatDrop) * -160).toFixed(1)}) rotate(-8 150 42)`}>
            <rect x={104} y={34} width={92} height={12} rx={5} fill={COAL} />
            <rect x={118} y={-22} width={64} height={60} rx={6} fill={COAL} />
            <rect x={118} y={20} width={64} height={12} fill={accent} />
            <path d="M176 20 l14 -10 l2 16 z" fill={FESTIVE.pine} />
            <circle cx={180} cy={22} r={5} fill={accent} />
          </g>
        ) : null}
      </g>

      {/* scarf */}
      {scarf > 0 ? (
        <g transform={`translate(150 140) scale(${scarf.toFixed(3)}) translate(-150 -140)`}>
          <g transform={`rotate(${flutter.toFixed(2)} 118 146)`}>
            <path d="M112 140 L104 214 L132 210 L130 146 Z" fill={scarfColor} />
            <path d="M106 196 L132 193 M105 206 L132 203" stroke={scarfStripe} strokeWidth={4} />
            <path d="M104 214 l3 10 M113 213 l2 10 M122 212 l2 10 M131 210 l2 10" stroke={scarfColor} strokeWidth={3} strokeLinecap="round" />
          </g>
          <path d="M94 128 Q150 152 206 128 L208 150 Q150 174 92 150 Z" fill={scarfColor} />
          <path d="M110 136 L112 158 M140 144 L140 166 M170 142 L168 164 M194 134 L192 156" stroke={scarfStripe} strokeWidth={4} />
        </g>
      ) : null}
    </g>
  );
};

/** The standalone SVG's viewBox (room above the head for the hat): local y = top … top + h. */
export const SNOWMAN_VIEW = { w: 300, top: -40, h: 460 } as const;

/** Local snowman units → px offset inside a <Snowman height={height} />. */
export const snowmanPoint = (height: number, x: number, y: number) => {
  const k = height / SNOWMAN_VIEW.h;
  return { x: x * k, y: (y - SNOWMAN_VIEW.top) * k, k };
};

/** The snowman as a standalone SVG, `height` px tall. */
export const Snowman: React.FC<
  React.ComponentProps<typeof SnowmanFigure> & { height: number; style?: React.CSSProperties; children?: React.ReactNode }
> = ({ height, style, children, ...figure }) => (
  <svg
    width={(SNOWMAN_VIEW.w * height) / SNOWMAN_VIEW.h}
    height={height}
    viewBox={`0 ${SNOWMAN_VIEW.top} ${SNOWMAN_VIEW.w} ${SNOWMAN_VIEW.h}`}
    style={{ overflow: "visible", ...style }}
  >
    <SnowmanFigure {...figure} />
    {children}
  </svg>
);
