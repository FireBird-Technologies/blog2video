import React from "react";
import { AbsoluteFill } from "remotion";
import { MOSAIC_COLORS } from "./constants";
import { MosaicFrame, MosaicRadialGuides, MosaicShards } from "./mosaicPrimitives";
import {
  getTileEntryProgress,
  getTileExitBreakProgress,
  type MosaicTileEntryPattern,
} from "./transitions";

type MosaicBackgroundVariant =
  | "titleBands"
  | "panelField"
  | "streamField"
  | "coverField"
  | "punchField"
  | "metricField"
  | "phrasesFrame"
  | "closeField"
  | "default";

const makeFieldTiles = (count: number, variant: MosaicBackgroundVariant) =>
  variant === "streamField"
    ? (() => {
        const cols = 34;
        const rows = 20;
        const tileW = 100 / cols;
        const tileH = 100 / rows;
        const cool = [MOSAIC_COLORS.cobalt, MOSAIC_COLORS.aqua, MOSAIC_COLORS.sky, "#244D62"];
        const neutral = ["#0B1420", "#101D2B", "#122030", "#162739"];
        const palette = [...neutral, ...cool];
        return Array.from({ length: cols * rows }, (_, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;
          return {
            x: col * tileW + 0.05,
            y: row * tileH + 0.05,
            size: Math.min(tileW, tileH) - 0.1,
            fill: palette[(row * 5 + col * 3) % palette.length],
            order: i,
          };
        });
      })()
    : variant === "coverField"
      ? (() => {
          const cols = 18;
          const rows = 10;
          const cellW = 100 / cols;
          const cellH = 100 / rows;
          const stone = ["#1B2734", "#243646", "#2F4657", "#3B5566"];
          const warm = ["#9F6E38", "#B47A3F", "#8D5E2F"];
          const cool = ["#35607A", "#3F6F86", "#4D7E96"];
          const palette = [...stone, ...warm, ...cool];
          return Array.from({ length: cols * rows }, (_, i) => {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const jitterX = ((row * 13 + col * 7) % 8) * 0.06;
            const jitterY = ((row * 5 + col * 11) % 8) * 0.06;
            const shrink = 0.55 + (((row * 17 + col * 19) % 10) / 10) * 0.32;
            const tileW = cellW * shrink;
            const tileH = cellH * shrink;
            return {
              x: col * cellW + (cellW - tileW) / 2 + jitterX,
              y: row * cellH + (cellH - tileH) / 2 + jitterY,
              size: Math.min(tileW, tileH),
              fill: palette[(row * 3 + col * 5) % palette.length],
              order: i,
            };
          });
        })()
    : Array.from({ length: count }, (_, i) => {
        const edgeSeed = i % 12;
        const x = edgeSeed < 4 ? (i * 17) % 24 : edgeSeed < 8 ? 76 + ((i * 13) % 22) : (i * 41) % 100;
        const y = edgeSeed < 4 ? (i * 11) % 22 : edgeSeed < 8 ? 78 + ((i * 7) % 20) : (i * 29) % 100;
        const size = 1.3 + ((i * 5) % 2.6);
        const cool = [MOSAIC_COLORS.cobalt, MOSAIC_COLORS.aqua, MOSAIC_COLORS.sky, "#244D62"];
        const warm = ["#B63A1F", "#C36A2E", "#C34E22", "#A25E2B"];
        const neutral = ["#0B1420", "#101D2B", "#122030", "#162739"];
        const palette =
          variant === "punchField" || variant === "closeField"
            ? [...neutral, ...warm]
            : [...neutral, ...cool];
        return { x, y, size, fill: palette[i % palette.length], order: i };
      });

export const MosaicBackground: React.FC<{
  bgColor?: string;
  accentColor?: string;
  variant?: MosaicBackgroundVariant;
  opacity?: number;
  frameReveal?: number;
  frameDrift?: number;
  tileBuildProgress?: number;
  tileEntryPattern?: MosaicTileEntryPattern;
  tileEntryIntensity?: number;
  tileExitProgress?: number;
  tileExitSeed?: number;
  tileExitIntensity?: number;
}> = ({
  bgColor,
  accentColor,
  variant = "default",
  opacity = 1,
  frameReveal = 1,
  frameDrift = 1,
  tileBuildProgress = 1,
  tileEntryPattern,
  tileEntryIntensity = 24,
  tileExitProgress = 0,
  tileExitSeed = 17,
  tileExitIntensity = 26,
}) => {
  const base = bgColor || MOSAIC_COLORS.deepNavy;
  const gold = accentColor || MOSAIC_COLORS.gold;
  const tiles = makeFieldTiles(170, variant);
  const showFrame = true;
  const buildProgress = Math.min(1, Math.max(0, tileBuildProgress));
  const breakProgress = Math.min(1, Math.max(0, tileExitProgress));
  const entryPattern =
    tileEntryPattern || (variant === "streamField" ? "diagonal" : "center");

  return (
    <AbsoluteFill style={{ backgroundColor: base, overflow: "hidden" }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="0" y="0" width="100" height="100" fill={base} />
        {tiles.map((t, i) => {
          const cx = t.x + t.size / 2;
          const cy = t.y + t.size / 2;
          const tileReveal = getTileEntryProgress({
            progress: buildProgress,
            index: t.order,
            total: tiles.length,
            x: cx,
            y: cy,
            pattern: entryPattern,
            intensity: tileEntryIntensity,
          });
          const tileExit = getTileExitBreakProgress({
            progress: breakProgress,
            index: t.order,
            total: tiles.length,
            x: cx,
            y: cy,
            seed: tileExitSeed,
            intensity: tileExitIntensity,
          });
          const baseOpacity = variant === "punchField" || variant === "closeField" ? 0.24 : 0.2;
          return (
            <rect
              key={`tile-${i}`}
              x={t.x}
              y={t.y}
              width={t.size}
              height={t.size}
              fill={t.fill}
              opacity={baseOpacity * tileReveal * tileExit}
            />
          );
        })}
        {(variant === "titleBands" || variant === "default") && (
          <>
            <path d="M0 66 C20 50, 40 76, 60 62 C74 52, 86 60, 100 50" stroke="#2A4858" strokeWidth="2.8" fill="none" opacity={0.18 + frameReveal * 0.17} />
            <path d="M0 70 C20 54, 40 78, 60 64 C74 54, 86 62, 100 53" stroke={gold} strokeWidth="0.32" fill="none" opacity={0.3 + frameReveal * 0.5} />
          </>
        )}
        <line x1="7" y1="12" x2="93" y2="12" stroke={gold} strokeWidth="0.24" opacity={0.2 + frameReveal * 0.3} />
        <line x1="7" y1="88" x2="93" y2="88" stroke={gold} strokeWidth="0.24" opacity={0.2 + frameReveal * 0.3} />
      </svg>
      {(variant === "metricField" || variant === "punchField") ? <MosaicRadialGuides accentColor={gold} /> : null}
      {(variant === "punchField" || variant === "closeField") ? <MosaicShards driftProgress={frameDrift} /> : null}
      {showFrame ? <MosaicFrame revealProgress={frameReveal} density={variant === "phrasesFrame" ? "soft" : "dense"} opacity={variant === "panelField" ? 0.75 : 0.88} /> : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 28% 8%, rgba(105,149,184,0.22), rgba(6,10,17,0) 42%)",
          opacity,
        }}
      />
    </AbsoluteFill>
  );
};