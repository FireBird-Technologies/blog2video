import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { withOpacity } from "./themeColor";

const rand = (seed: number, salt: number) => {
  const value = Math.sin(seed * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const smooth = Easing.bezier(0.22, 0.72, 0.2, 1);
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

type Props = { accentColor?: string; bgColor?: string; textColor?: string; frames?: number; seed?: number };

/**
 * Background-coloured cover that dissolves into text / accent coloured stardust, revealing
 * whatever is painted beneath it. Renders nothing once finished.
 */
export const StardustReveal: React.FC<Props> = ({ accentColor = "#217cff", bgColor = "#000000", textColor = "#ffffff", frames = 70, seed = 0 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  if (frame > frames) return null;
  const t = interpolate(frame, [0, frames], [0, 1], clamp);
  const columns = 20;
  const rows = 12;
  const cellWidth = width / columns;
  const cellHeight = height / rows;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: columns * rows }, (_, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const delay = .06 + rand(index + seed + 5100, 1) * .5;
        const local = interpolate(t, [delay, delay + .34], [0, 1], { ...clamp, easing: smooth });
        return (
          <div key={`sd-blob-${index}`} style={{
            position: "absolute",
            left: (column + .5) * cellWidth - cellWidth * 1.1,
            top: (row + .5) * cellHeight - cellHeight * 1.1,
            width: cellWidth * 2.2,
            height: cellHeight * 2.2,
            background: `radial-gradient(ellipse at center, ${bgColor} 0%, ${bgColor} 58%, ${withOpacity(bgColor, 0)} 100%)`,
            opacity: 1 - local,
            transform: `scale(${1 - local * .55})`,
          }} />
        );
      })}
      {Array.from({ length: 900 }, (_, index) => {
        const x0 = rand(index + seed + 5600, 1) * width;
        const y0 = rand(index + seed + 5600, 2) * height;
        const delay = .02 + rand(index + seed + 5600, 3) * .5;
        const local = interpolate(t, [delay, 1], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
        const angle = rand(index + seed + 5600, 4) * Math.PI * 2;
        const dist = (.03 + rand(index + seed + 5600, 5) * .2) * Math.min(width, height) * 1.6;
        const bright = index % 9 === 0;
        const size = Math.max(1, height * (bright
          ? .003 + rand(index + seed + 5600, 6) * .004
          : .0009 + Math.pow(rand(index + seed + 5600, 6), 2) * .0032));
        const color = index % 4 === 0 ? accentColor : textColor;
        const twinkle = .55 + .45 * Math.sin(frame * (.18 + rand(index + seed + 5600, 7) * .25) + index);
        const sparkle = Math.pow(Math.sin(Math.min(1, local) * Math.PI), .6) * twinkle;
        const flare = size * (6 + rand(index + seed + 5600, 8) * 6);
        return (
          <div key={`sd-mote-${index}`} style={{
            position: "absolute", left: x0, top: y0, width: size, height: size, opacity: sparkle,
            transform: `translate(${Math.cos(angle) * dist * local}px, ${Math.sin(angle) * dist * local}px)`,
          }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, boxShadow: `0 0 ${size * (bright ? 8 : 4)}px ${size * (bright ? 1.5 : .6)}px ${color}` }} />
            {bright ? (
              <>
                <div style={{ position: "absolute", left: size / 2 - flare / 2, top: size / 2 - .5, width: flare, height: 1, background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
                <div style={{ position: "absolute", top: size / 2 - flare / 2, left: size / 2 - .5, height: flare, width: 1, background: `linear-gradient(180deg, transparent, ${color}, transparent)` }} />
              </>
            ) : null}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
