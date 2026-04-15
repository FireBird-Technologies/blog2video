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

/**
 * Dense tile grid covering the entire viewport.
 * 96 cols × 54 rows = 5,184 tiles, each ~20px square on 1920×1080.
 * Every tile has a 4-sided grout stroke so the animated rects ARE the small visible tiles.
 */
const TILE_PALETTE = [
  "#F7F3EC", "#F4F0E8", "#F2EDE4", "#EFEBE0",
  "#EAE4DA", "#E7E0D6", "#E4DCCF", "#E0D8CB",
  "#DDD4C5", "#DAD1C2", "#D6CEC1", "#D3CABB",
];

const makeFieldTiles = (tileSizePx: number = 20, gapPx: number = 0) => {
  /* Reference canvas 1920×1080,  viewBox 0 0 100 100 */
  const refW = 1920;
  const refH = 1080;
  let cols = Math.max(4, Math.ceil(refW / tileSizePx));
  let rows = Math.max(4, Math.ceil(refH / tileSizePx));
  /* Cap total SVG rects for render performance */
  const maxTiles = 8000;
  if (cols * rows > maxTiles) {
    const s = Math.sqrt(maxTiles / (cols * rows));
    cols = Math.max(4, Math.round(cols * s));
    rows = Math.max(4, Math.round(rows * s));
  }
  const cellW = 100 / cols;
  const cellH = 100 / rows;
  /* Convert pixel gap → SVG-viewBox units */
  const gW = gapPx * (100 / refW);
  const gH = gapPx * (100 / refH);
  const tiles = Array.from({ length: cols * rows }, (_, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const hash = (row * 7 + col * 13 + row * col * 3) % TILE_PALETTE.length;
    return {
      x: col * cellW + gW / 2,
      y: row * cellH + gH / 2,
      w: Math.max(0.01, cellW - gW),
      h: Math.max(0.01, cellH - gH),
      fill: TILE_PALETTE[hash],
      order: i,
    };
  });
  return { cols, rows, tiles };
};

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
  tileExitPattern?: MosaicTileEntryPattern;
  /** Pass false to suppress the tile-grid border overlay (e.g. on text-heavy scenes) */
  showTileGrid?: boolean;
  /** Size of each tile in px (controls grid cols/rows). Default: 20 */
  tileGridSize?: number;
  /** Grout gap between tiles in px. Default: 0 */
  tileGridGap?: number;
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
  tileExitPattern,
  showTileGrid,
  tileGridSize,
  tileGridGap,
}) => {
  const base = bgColor || MOSAIC_COLORS.deepNavy;
  const gold = accentColor || MOSAIC_COLORS.gold;
  const { cols, rows, tiles } = makeFieldTiles(tileGridSize ?? 20, tileGridGap ?? 0);
  const showFrame = true;
  const buildProgress = Math.min(1, Math.max(0, tileBuildProgress));
  const breakProgress = Math.min(1, Math.max(0, tileExitProgress));
  const entryPattern =
    tileEntryPattern || (variant === "streamField" ? "diagonal" : "center");
  // Aspect correction: cols/rows ≈ 16/9 for landscape tile grids
  const gridAspect = cols / rows;

  // Hide grid on clean text/metric layouts unless explicitly requested
  const showGrid =
    showTileGrid !== undefined
      ? showTileGrid
      : variant !== "panelField" && variant !== "metricField";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: base,
        overflow: "hidden",
      }}
    >
      {/* ── Layer 1: SVG colour-variation tiles ──────────── */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0 }}
      >
        <rect x="0" y="0" width="100" height="100" fill={base} />
        {tiles.map((t, i) => {
          const cx = t.x + t.w / 2;
          const cy = t.y + t.h / 2;
          const tileReveal = getTileEntryProgress({
            progress: buildProgress,
            index: t.order,
            total: tiles.length,
            x: cx,
            y: cy,
            pattern: entryPattern,
            intensity: tileEntryIntensity,
            aspectCorrection: gridAspect,
          });
          const tileExit = getTileExitBreakProgress({
            progress: breakProgress,
            index: t.order,
            total: tiles.length,
            x: cx,
            y: cy,
            seed: tileExitSeed,
            intensity: tileExitIntensity,
            pattern: tileExitPattern,
            aspectCorrection: gridAspect,
          });
          return (
            <rect
              key={`tile-${i}`}
              x={t.x}
              y={t.y}
              width={t.w}
              height={t.h}
              fill={t.fill}
              stroke="rgba(42,42,40,0.22)"
              strokeWidth="0.06"
              opacity={tileReveal * tileExit}
            />
          );
        })}

        {variant === "default" && (
          <>
            <path d="M0 66 C20 50, 40 76, 60 62 C74 52, 86 60, 100 50" stroke="#2A2A28" strokeWidth="2.8" fill="none" opacity={0.12 + frameReveal * 0.16} />
            <path d="M0 70 C20 54, 40 78, 60 64 C74 54, 86 62, 100 53" stroke={gold} strokeWidth="0.32" fill="none" opacity={0.3 + frameReveal * 0.5} />
          </>
        )}
        <line x1="7" y1="12" x2="93" y2="12" stroke={gold} strokeWidth="0.24" opacity={0.2 + frameReveal * 0.3} />
        <line x1="7" y1="88" x2="93" y2="88" stroke={gold} strokeWidth="0.24" opacity={0.2 + frameReveal * 0.3} />
      </svg>

      {/* ── Layer 2: Decorative primitives ──────────── */}
      {(variant === "metricField" || variant === "punchField") ? <MosaicRadialGuides accentColor={gold} /> : null}
      {(variant === "punchField" || variant === "closeField") ? <MosaicShards driftProgress={frameDrift} /> : null}
      {showFrame ? <MosaicFrame revealProgress={frameReveal} density={variant === "phrasesFrame" ? "soft" : "dense"} opacity={variant === "panelField" ? 0.75 : 0.88} /> : null}

      {/* ── Layer 3: Warm radial glow ──────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 28% 8%, rgba(194,98,64,0.06), rgba(234,228,218,0) 55%)",
          opacity,
          pointerEvents: "none",
        }}
      />

      {/* ── Layer 4: True 4-sided tile-grid overlay ─────────────────────
           Vertical dividers  → muted teal  (inspired by the blue wave tiles)
           Horizontal dividers → terracotta  (inspired by the orange sun tiles)
           Both directions = all 4 sides of every tile are bordered          */}
      {showGrid && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: [
              "linear-gradient(to right,  rgba(74,120,140,0.14) 0.5px, transparent 0.5px)",
              "linear-gradient(to bottom, rgba(194,98,64,0.16) 0.5px, transparent 0.5px)",
            ].join(", "),
            backgroundSize: `${100 / cols}% ${100 / rows}%`,
            pointerEvents: "none",
            zIndex: 2,
            opacity: buildProgress,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
