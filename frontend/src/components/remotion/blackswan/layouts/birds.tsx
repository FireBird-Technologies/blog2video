import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useBlackswanBirdMotion } from "../blackswanAnimationStyles";
import { blackswanNeonPalette } from "./blackswanAccent";

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
  accentColor?: string;
}> = ({ uid, cx, cy, startDelaySec = 0, accentColor = "#00E5FF" }) => {
  useBlackswanBirdMotion();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const birdColors = useMemo(() => {
    const p = blackswanNeonPalette(accentColor);
    return [p.core, p.vivid, p.mid, p.light, p.waterLo];
  }, [accentColor]);

  const cfg = [
    { a: BANIMS[0], d: 0, s: 1, c: birdColors[0], p: 0 },
    { a: BANIMS[1], d: 0.13, s: 0.92, c: birdColors[1], p: 0.08 },
    { a: BANIMS[2], d: 0.25, s: 0.84, c: birdColors[2], p: 0.16 },
    { a: BANIMS[3], d: 0.38, s: 0.77, c: birdColors[3], p: 0.06 },
    { a: BANIMS[4], d: 0.5, s: 0.7, c: birdColors[4], p: 0.12 },
  ] as const;

  return (
    <svg
      viewBox="0 0 1000 1000"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}
    >
      <defs>
        <filter id={`bsw-fb-${uid}`} x="-55%" y="-200%" width="210%" height="500%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
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
  accentColor?: string;
  startSec?: number;
}> = ({ uid, x, y, scale = 0.7, color, accentColor = "#00E5FF", startSec = 1.2 }) => {
  const fill = color ?? accentColor;
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
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
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
        <NeonBird color={fill} phase={0} uid={uid} filterAttr={`url(#bsw-fb-path-${uid})`} />
      </g>
    </svg>
  );
};

type ArcBirdLane = { y: number; startSec: number; scale: number; phase: number; color: string };

/**
 * Several small birds flying left → right (`bsw-b1`) across the upper sky, looped for long clips.
 * Outer `translate` + `scale` sit above the animated transform so paths stay LTR in both layouts.
 */
export const BlackswanArcBirdPass: React.FC<{
  uid: string;
  accentColor: string;
  portrait: boolean;
  /** Extra scale multiplier (default 1). */
  sizeScale?: number;
  /** Stacking vs scene chrome (EndingSocials uses lower so CTA/socials stay on top). */
  zIndex?: number;
}> = ({ uid, accentColor, portrait, sizeScale = 1, zIndex = 2 }) => {
  useBlackswanBirdMotion();
  const pal = useMemo(() => blackswanNeonPalette(accentColor), [accentColor]);

  const lanes: ArcBirdLane[] = useMemo(() => {
    if (portrait) {
      return [
        { y: 105, startSec: 0, scale: 0.6, phase: 0, color: pal.core },
        { y: 178, startSec: 1.15, scale: 0.5, phase: 0.09, color: pal.vivid },
        { y: 78, startSec: 2.35, scale: 0.55, phase: 0.15, color: pal.mid },
        { y: 142, startSec: 3.5, scale: 0.48, phase: 0.06, color: pal.light },
      ];
    }
    return [
      { y: 92, startSec: 0, scale: 0.62, phase: 0, color: pal.core },
      { y: 162, startSec: 1.05, scale: 0.53, phase: 0.08, color: pal.vivid },
      { y: 68, startSec: 2.2, scale: 0.58, phase: 0.12, color: pal.mid },
      { y: 128, startSec: 3.35, scale: 0.5, phase: 0.05, color: pal.light },
    ];
  }, [pal, portrait]);

  return (
    <svg
      viewBox="0 0 1000 1000"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
        zIndex,
      }}
    >
      <defs>
        {lanes.map((_, i) => (
          <filter key={`arc-f-${i}`} id={`bsw-fb-arc-${uid}-${i}`} x="-55%" y="-200%" width="210%" height="500%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
      </defs>
      {lanes.map((b, i) => (
        <g key={`arc-b-${i}`} transform={`translate(0 ${b.y}) scale(${Math.min(0.92, b.scale * sizeScale)})`}>
          <g
            style={{
              opacity: 0,
              animation: `bsw-b1 4.8s cubic-bezier(0.3, 0.55, 0.5, 0.9) infinite`,
              animationDelay: `${b.startSec}s`,
            }}
          >
            <NeonBird
              color={b.color}
              phase={b.phase}
              uid={`${uid}-arc${i}`}
              filterAttr={`url(#bsw-fb-arc-${uid}-${i})`}
            />
          </g>
        </g>
      ))}
    </svg>
  );
};
