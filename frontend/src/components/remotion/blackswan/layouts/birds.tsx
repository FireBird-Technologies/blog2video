import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useBlackswanBirdMotion } from "../blackswanAnimationStyles";

const BANIMS = ["bsw-b1", "bsw-b2", "bsw-b3", "bsw-b4", "bsw-b5"] as const;

type BirdProps = { color: string; phase: number; uid: string; filterAttr?: string };

const NeonBird: React.FC<BirdProps> = ({ color, phase, uid, filterAttr }) => {
  const spd = 0.42 + (phase % 0.15);
  const cp = phase + 0.05;
  return (
    <g filter={filterAttr ?? `url(#bsw-fb-${uid})`}>
      <g
        style={{
          animation: `bsw-chirp ${spd}s ${cp}s ease-in-out infinite`,
        }}
      >
        <path
          d="M0 0 C-4 -2 -9 -4 -14 -1 C-9 2 -4 1 0 0"
          fill={color}
          opacity={0.9}
          style={{
            animation: `bsw-wflap-l ${spd}s ${phase}s ease-in-out infinite`,
          }}
        />
        <path
          d="M0 0 C4 -2 9 -4 14 -1 C9 2 4 1 0 0"
          fill={color}
          opacity={0.9}
          style={{
            animation: `bsw-wflap-r ${spd}s ${phase}s ease-in-out infinite`,
          }}
        />
        <ellipse cx={0} cy={0} rx={2.5} ry={1.5} fill={color} opacity={0.95} />
        <path
          d="M-2.5 0 C-4 1.5 -5 2 -4 2.5"
          fill="none"
          stroke={color}
          strokeWidth={0.7}
          opacity={0.6}
        />
      </g>
    </g>
  );
};

/** Five birds erupting from cx,cy — matches HTML `flock(cx, cy, startDelay)`. */
export const BlackswanFlock: React.FC<{
  uid: string;
  cx: number;
  cy: number;
  startDelaySec?: number;
}> = ({ uid, cx, cy, startDelaySec = 0 }) => {
  useBlackswanBirdMotion();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const cfg = [
    { a: BANIMS[0], d: 0, s: 1, c: "#00E5FF", p: 0 },
    { a: BANIMS[1], d: 0.13, s: 0.92, c: "#00CCFF", p: 0.08 },
    { a: BANIMS[2], d: 0.25, s: 0.84, c: "#00AAFF", p: 0.16 },
    { a: BANIMS[3], d: 0.38, s: 0.77, c: "#00BEFF", p: 0.06 },
    { a: BANIMS[4], d: 0.5, s: 0.7, c: "#0086CC", p: 0.12 },
  ] as const;

  return (
    <svg
      viewBox="0 0 1000 1000"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}
    >
      <defs>
        <filter id={`bsw-fb-${uid}`} x="-55%" y="-200%" width="210%" height="500%">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feColorMatrix
            in="b"
            type="matrix"
            values="0 0 0 0 0  0 0.3 0.84 0 0  0 0.62 0.98 0 0  0 0 0 0.6 0"
            result="c"
          />
          <feMerge>
            <feMergeNode in="c" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {cfg.map((c, i) => {
        const dur = 3.8 + c.d * 0.28;
        const del = startDelaySec + c.d;
        return (
          <g
            key={i}
            style={{
              transform: `translate(${cx}px, ${cy}px)`,
              opacity: 0,
              animation: `${c.a} ${dur}s cubic-bezier(0.22, 0.6, 0.45, 0.9) forwards`,
              animationDelay: `${del - t}s`,
            }}
          >
            <NeonBird color={c.c} phase={c.p} uid={uid} />
          </g>
        );
      })}
    </svg>
  );
};

/** Single bird for flight_path — rides path animation `bsw-b1`. */
export const BlackswanBirdOnPath: React.FC<{
  uid: string;
  x: number;
  y: number;
  scale?: number;
  color?: string;
  startSec?: number;
}> = ({ uid, x, y, scale = 0.7, color = "#00E5FF", startSec = 1.2 }) => {
  useBlackswanBirdMotion();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <svg
      viewBox="0 0 1000 1000"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}
    >
      <defs>
        <filter id={`bsw-fb-path-${uid}`} x="-55%" y="-200%" width="210%" height="500%">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feColorMatrix
            in="b"
            type="matrix"
            values="0 0 0 0 0  0 0.3 0.84 0 0  0 0.62 0.98 0 0  0 0 0 0.6 0"
            result="c"
          />
          <feMerge>
            <feMergeNode in="c" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g
        style={{
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
          opacity: 0,
          animation: `bsw-b1 4.5s cubic-bezier(0.3, 0.55, 0.5, 0.9) forwards`,
          animationDelay: `${startSec - t}s`,
        }}
      >
        <NeonBird color={color} phase={0} uid={uid} filterAttr={`url(#bsw-fb-path-${uid})`} />
      </g>
    </svg>
  );
};
