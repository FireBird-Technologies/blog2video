import React from "react";
import { AbsoluteFill } from "remotion";
import { MOSAIC_COLORS } from "./constants";

type FrameDensity = "dense" | "soft";
type TileRevealMode = "linear" | "diagonal" | "cluster";

const BORDER_PALETTE = [
  "#DAD1C2",
  "#E4DCCF",
  "#C26240",
  "#D6CEC1",
  "#CFC6B8",
  "#C8785A",
  "#EAE4DA",
  "#B8AFA0",
  "#D4956A",
  "#E0D6C8",
  "#C26240",
  "#F2EDE4",
];

const SHARD_PALETTE = ["#C26240", "#D4956A", "#B8AFA0", "#C8785A", "#DAD1C2"];

const TILE_FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  6: ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
};

const safeChar = (char: string) => (char === " " ? " " : char.toUpperCase());

const pick = (palette: string[], seed: number) => palette[Math.abs(seed) % palette.length];
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const MosaicFrame: React.FC<{
  opacity?: number;
  density?: FrameDensity;
  inset?: number;
  revealProgress?: number;
}> = ({ opacity = 0.9, density = "dense", inset = 0, revealProgress = 1 }) => {
  const tile = density === "dense" ? 18 : 14;
  const topCols = density === "dense" ? 44 : 58;
  const sideRows = density === "dense" ? 24 : 30;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", inset }}>
      <svg width="100%" height="100%" viewBox="0 0 800 450" preserveAspectRatio="none">
        <g opacity={opacity * revealProgress}>
          {Array.from({ length: topCols }).map((_, i) => (
            <React.Fragment key={`top-${i}`}>
              <rect x={i * tile} y={0} width={tile - 1} height={tile - 1} fill={pick(BORDER_PALETTE, i)} />
              <rect
                x={i * tile}
                y={450 - tile}
                width={tile - 1}
                height={tile - 1}
                fill={pick(BORDER_PALETTE, i + 11)}
              />
            </React.Fragment>
          ))}
          {Array.from({ length: sideRows }).map((_, i) => (
            <React.Fragment key={`side-${i}`}>
              <rect x={0} y={tile + i * tile} width={tile - 1} height={tile - 1} fill={pick(BORDER_PALETTE, i + 7)} />
              <rect
                x={800 - tile}
                y={tile + i * tile}
                width={tile - 1}
                height={tile - 1}
                fill={pick(BORDER_PALETTE, i + 17)}
              />
            </React.Fragment>
          ))}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export const MosaicShards: React.FC<{
  opacity?: number;
  driftProgress?: number;
}> = ({ opacity = 0.55, driftProgress = 1 }) => {
  const shards = [
    { x: 120, y: 120, s: 10, r: 15 },
    { x: 640, y: 98, s: 8, r: -20 },
    { x: 250, y: 360, s: 11, r: 34 },
    { x: 510, y: 70, s: 7, r: -11 },
    { x: 676, y: 312, s: 9, r: 25 },
    { x: 150, y: 338, s: 8, r: 42 },
  ];
  return (
    <svg width="100%" height="100%" viewBox="0 0 800 450" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
      {shards.map((shard, idx) => (
        <rect
          key={`shard-${idx}`}
          x={shard.x}
          y={shard.y}
          width={shard.s}
          height={shard.s}
          fill={pick(SHARD_PALETTE, idx)}
          opacity={opacity}
          transform={`translate(${(1 - driftProgress) * (idx % 2 === 0 ? -16 : 16)}, ${(1 - driftProgress) * 10}) rotate(${shard.r},${shard.x + shard.s / 2},${shard.y + shard.s / 2})`}
        />
      ))}
    </svg>
  );
};

export const MosaicRadialGuides: React.FC<{
  centerX?: number;
  centerY?: number;
  accentColor?: string;
}> = ({ centerX = 400, centerY = 225, accentColor }) => (
  <svg width="100%" height="100%" viewBox="0 0 800 450" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
    <circle cx={centerX} cy={centerY} r={170} stroke="#B8AFA0" strokeWidth={1} fill="none" opacity={0.42} />
    <circle cx={centerX} cy={centerY} r={125} stroke="#CFC6B8" strokeWidth={1} fill="none" opacity={0.34} />
    <circle cx={centerX} cy={centerY} r={78} stroke="#DAD1C2" strokeWidth={0.8} fill="none" opacity={0.28} />
    <circle cx={centerX} cy={centerY} r={45} stroke="#E4DCCF" strokeWidth={0.7} fill="none" opacity={0.22} />
    <line x1={centerX} y1={30} x2={centerX} y2={420} stroke={accentColor || MOSAIC_COLORS.gold} strokeWidth={1} opacity={0.25} />
    <line x1={60} y1={centerY} x2={740} y2={centerY} stroke={accentColor || MOSAIC_COLORS.gold} strokeWidth={1} opacity={0.25} />
  </svg>
);

export const TileWordSvg: React.FC<{
  text: string;
  tileSize?: number;
  gap?: number;
  colors?: string[];
  style?: React.CSSProperties;
  revealProgress?: number;
  revealMode?: TileRevealMode;
  exitProgress?: number;
}> = ({
  text,
  tileSize = 10,
  gap = 1,
  colors,
  style,
  revealProgress = 1,
  revealMode = "linear",
  exitProgress = 0,
}) => {
  const palette = colors && colors.length > 0 ? colors : ["#D06030", "#C03820", "#C87828", "#E0B870", "#4A7880", "#5A9090"];
  const chars = text.split("").map(safeChar);
  let cursor = 0;
  const placements = chars.map((char) => {
    if (char === " ") {
      const before = cursor;
      cursor += 3;
      return { char, x: before };
    }
    const glyph = TILE_FONT[char] || TILE_FONT.E;
    const before = cursor;
    cursor += glyph[0].length + 1;
    return { char, x: before };
  });
  const widthUnits = Math.max(cursor - 1, 1);
  const width = widthUnits * (tileSize + gap);
  const height = 7 * (tileSize + gap);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={style}>
      {placements.map((placement, idx) => {
        if (placement.char === " ") {
          return null;
        }
        const glyph = TILE_FONT[placement.char] || TILE_FONT.E;
        return glyph.flatMap((row, y) =>
          row.split("").map((cell, x) => {
            if (cell !== "1") {
              return null;
            }
            const px = (placement.x + x) * (tileSize + gap);
            const py = y * (tileSize + gap);
            const colorSeed = idx * 19 + x * 11 + y * 7;
            const gx = placement.x + x;
            const nx = gx / Math.max(widthUnits, 1);
            const ny = y / 6;
            const linearOrder = idx * 0.03 + y * 0.02 + x * 0.01;
            const diagonalOrder = nx * 0.72 + ny * 0.28;
            const clusterBand = ((Math.floor(gx / 2) + Math.floor(y / 2)) % 5) / 5;
            const clusterOrder = nx * 0.5 + ny * 0.35 + clusterBand * 0.35;
            const revealOrder =
              revealMode === "cluster"
                ? clamp01(clusterOrder * 0.9)
                : revealMode === "diagonal"
                  ? clamp01(diagonalOrder * 0.9)
                  : clamp01(linearOrder);
            const isVisibleIn = revealProgress >= revealOrder;
            const isVisibleOut = exitProgress <= 1 - revealOrder;
            return (
              <rect
                key={`${placement.char}-${idx}-${x}-${y}`}
                x={px}
                y={py}
                width={tileSize}
                height={tileSize}
                fill={pick(palette, colorSeed)}
                opacity={isVisibleIn && isVisibleOut ? 1 : 0}
              />
            );
          }),
        );
      })}
    </svg>
  );
};

export const DiamondIndicators: React.FC<{
  count: number;
  activeIndex: number;
  activeColor?: string;
}> = ({ count, activeIndex, activeColor }) => (
  <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
    {Array.from({ length: count }).map((_, index) => (
      <div
        key={`diamond-${index}`}
        style={{
          width: 8,
          height: 8,
          transform: "rotate(45deg)",
          background: index === activeIndex ? activeColor || "#C26240" : "#DAD1C2",
          transition: "background 160ms ease",
        }}
      />
    ))}
  </div>
);
