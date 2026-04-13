import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export type NeonWaterProps = {
  uid: string;
  cx?: number;
  /** Vertical band: cy = yPct × 10 in 1000×1000 space */
  yPct?: number;
  scale?: number;
  rxBase?: number;
  ryBase?: number;
  maxRx?: number;
  nRings?: number;
  /** Base delay in seconds (HTML neonWater `delay`) */
  delay?: number;
  /** Hide the gradient background rect (card shade) */
  hideBg?: boolean;
  /** Fade rings out radially as they expand outward */
  fadeEdges?: boolean;
};

/** One-shot + looping ellipse shockwave — frame-synced for Remotion render. */
function ellipseExpandSample(p: number, maxRx: number, maxRy: number): {
  rx: number;
  ry: number;
  opacity: number;
  sw: number;
} {
  const rx = interpolate(p, [0, 1], [8, maxRx], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ry = interpolate(p, [0, 1], [3, maxRy], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(p, [0, 0.15, 0.5, 0.85, 1], [0.95, 0.88, 0.62, 0.28, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sw = interpolate(p, [0, 0.15, 0.5, 0.85, 1], [2.2, 1.8, 1.2, 0.6, 0.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { rx, ry, opacity, sw };
}

function loopProgress(t: number, delaySec: number, durSec: number): number {
  const x = t - delaySec;
  if (x <= 0) return 0;
  const c = x % durSec;
  return c / durSec;
}

/**
 * Neon water — gradient wash, ambient dashed ellipses (breathe + dash drift),
 * expanding ripples. All motion is driven by `useCurrentFrame()` so Studio and
 * `remotion render` match.
 */
export const NeonWater: React.FC<NeonWaterProps> = ({
  uid,
  cx = 500,
  yPct = 86,
  scale = 1,
  rxBase = 180,
  ryBase = 22,
  maxRx = 320,
  nRings = 6,
  delay = 0,
  hideBg = false,
  fadeEdges = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const cy = yPct * 10;
  const rxB = rxBase * scale;
  const ryB = ryBase * scale;
  const maxR = maxRx * scale;

  const ambientRings = [
    { rx: rxB, ry: ryB, sw: 1.8, op: 0.72, dur: 4.2, col: "#00E5FF" },
    { rx: rxB * 1.45, ry: ryB * 1.4, sw: 1.1, op: 0.42, dur: 5.1, col: "#00AAFF" },
    { rx: rxB * 1.92, ry: ryB * 1.85, sw: 0.7, op: 0.24, dur: 6.3, col: "#0077BB" },
  ];

  const dashLen0 = Math.round(2 * Math.PI * 30 * 0.22);
  const dashGap0 = Math.round(2 * Math.PI * 30 * 0.06);
  const pattern0 = dashLen0 + dashGap0;

  return (
    <svg
      viewBox="0 0 1000 1000"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        <linearGradient id={`bsw-wfg-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#00AAFF" stopOpacity={0.055} />
          <stop offset="40%" stopColor="#0040FF" stopOpacity={0.025} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0} />
        </linearGradient>
        {fadeEdges && (
          <radialGradient id={`bsw-fade-${uid}`} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="30%" stopColor="white" stopOpacity={1} />
            <stop offset="75%" stopColor="white" stopOpacity={0.5} />
            <stop offset="100%" stopColor="white" stopOpacity={0} />
          </radialGradient>
        )}
        {fadeEdges && (
          <mask id={`bsw-mask-${uid}`}>
            <ellipse cx={cx} cy={cy} rx={maxR * 1.1} ry={maxR * 0.35} fill={`url(#bsw-fade-${uid})`} />
          </mask>
        )}
        <filter id={`bsw-fneon2-${uid}`} x="-30%" y="-900%" width="160%" height="1900%">
          <feGaussianBlur stdDeviation="9" result="b" />
          <feColorMatrix
            in="b"
            type="matrix"
            values="0 0 0 0 0  0 0.2 0.72 0 0  0 0.45 0.92 0 0  0 0 0 0.55 0"
          />
        </filter>
        <filter id={`bsw-fneon-${uid}`} x="-16%" y="-800%" width="132%" height="1700%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feColorMatrix
            in="b"
            type="matrix"
            values="0 0 0 0 0  0 0.35 0.92 0 0  0 0.68 0.98 0 0  0 0 0 0.9 0"
            result="glow"
          />
          <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="soft" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="soft" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {!hideBg && <rect x={0} y={Math.max(0, cy - 200)} width={1000} height={280} fill={`url(#bsw-wfg-${uid})`} />}

      <g mask={fadeEdges ? `url(#bsw-mask-${uid})` : undefined}>
      {ambientRings.map((ar, k) => {
        const circ = 2 * Math.PI * ar.rx;
        const dashLen = Math.round(circ * 0.14);
        const dashGap = Math.round(circ * 0.04);
        const pattern = dashLen + dashGap;
        const del = delay + k * 0.8;
        const spinDel = delay + k * 1.2;
        const breatheU = (2 * Math.PI * (t + del)) / ar.dur;
        const ryMul = 1 + 0.06 * (1 - Math.cos(breatheU));
        const ry = ar.ry * ryMul;
        const opPulse = 0.5 - 0.5 * Math.cos(breatheU);
        const glowOp = 0.18 + 0.14 * opPulse;
        const crispOp = ar.op * (0.35 + 0.4 * opPulse);
        const swPulse = ar.sw * (0.65 + 0.15 * Math.cos(breatheU));
        const spinSpeed = circ * 0.12;
        const dashOff = -((t + spinDel) * spinSpeed) % pattern;

        return (
          <React.Fragment key={`amb-${k}`}>
            <ellipse
              cx={cx}
              cy={cy}
              rx={ar.rx}
              ry={ry}
              fill="none"
              stroke={ar.col}
              strokeWidth={ar.sw * 3}
              strokeDasharray={`${dashLen} ${dashGap}`}
              strokeDashoffset={dashOff}
              strokeLinecap="round"
              filter={`url(#bsw-fneon2-${uid})`}
              opacity={glowOp}
            />
            <ellipse
              cx={cx}
              cy={cy}
              rx={ar.rx}
              ry={ry}
              fill="none"
              stroke={ar.col}
              strokeWidth={swPulse}
              strokeDasharray={`${dashLen} ${dashGap}`}
              strokeDashoffset={dashOff}
              strokeLinecap="round"
              filter={`url(#bsw-fneon-${uid})`}
              opacity={crispOp}
            />
          </React.Fragment>
        );
      })}

      {Array.from({ length: nRings }).map((_, i) => {
        const ringMaxRx = maxR * (0.5 + i * 0.18);
        const ringMaxRy = ringMaxRx * 0.25;
        const dur = 2.0 + i * 0.38;
        const del = delay + i * 0.44 + (i % 2) * 0.22;
        const col = i === 0 ? "#00E5FF" : i === 1 ? "#00CCFF" : i < 4 ? "#00AAFF" : "#0077BB";
        const sw = i === 0 ? 1.8 : i < 3 ? 1.3 : 0.8;
        const p = loopProgress(t, del, dur);
        const { rx, ry, opacity, sw: ew } = ellipseExpandSample(p, ringMaxRx, ringMaxRy);
        const spinOff = -((t + del) * 40) % pattern0;
        const crispW = Math.max(0.2, ew * (sw / 2.2));

        return (
          <React.Fragment key={`exp-${i}`}>
            <ellipse
              cx={cx}
              cy={cy}
              rx={rx}
              ry={ry}
              fill="none"
              stroke={col}
              strokeWidth={ew * 3.2}
              strokeDasharray={`${dashLen0} ${dashGap0}`}
              strokeDashoffset={spinOff}
              strokeLinecap="round"
              filter={`url(#bsw-fneon2-${uid})`}
              opacity={opacity * 0.55}
            />
            <ellipse
              cx={cx}
              cy={cy}
              rx={rx}
              ry={ry}
              fill="none"
              stroke={col}
              strokeWidth={crispW}
              strokeDasharray={`${dashLen0} ${dashGap0}`}
              strokeDashoffset={spinOff}
              strokeLinecap="round"
              filter={`url(#bsw-fneon-${uid})`}
              opacity={opacity * 0.88}
            />
          </React.Fragment>
        );
      })}
      </g>
    </svg>
  );
};
