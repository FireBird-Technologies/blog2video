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

/** hex → [h 0-360, s 0-100, l 0-100] */
function hexToHsl(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}
/** [h 0-360, s 0-100, l 0-100] → hex */
function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100, ll = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sl * Math.min(ll, 1 - ll);
  const f = (n: number) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}
/** 12-stop tile palette derived from the background colour.
 *  Dark bg → lighter tiles (+14..+40 L). Light bg → slightly darker tiles (−14..−40 L). */
export function bgTilePalette(bg: string): string[] {
  try {
    const [h, s, l] = hexToHsl(bg);
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const isLight = l >= 50;
    // Dark bg  → lighten tiles significantly so they read as mosaic texture (+14…+40)
    // Light bg → darken tiles only very subtly (-2…-14) so they stay light/pale
    const offsets = isLight
      ? [14, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]
      : [40, 36, 34, 30, 28, 26, 24, 22, 20, 18, 16, 14];
    const d = isLight ? -1 : 1;
    return [
      hslToHex(h, clamp(s - 4, 0, 100), clamp(l + offsets[0]  * d, 5, 95)),
      hslToHex(h, clamp(s - 2, 0, 100), clamp(l + offsets[1]  * d, 5, 95)),
      hslToHex(h, clamp(s,     0, 100), clamp(l + offsets[2]  * d, 5, 95)),
      hslToHex(h, clamp(s + 2, 0, 100), clamp(l + offsets[3]  * d, 5, 95)),
      hslToHex(h, clamp(s - 3, 0, 100), clamp(l + offsets[4]  * d, 5, 95)),
      hslToHex(h, clamp(s + 4, 0, 100), clamp(l + offsets[5]  * d, 5, 95)),
      hslToHex(h, clamp(s - 2, 0, 100), clamp(l + offsets[6]  * d, 5, 95)),
      hslToHex(h, clamp(s,     0, 100), clamp(l + offsets[7]  * d, 5, 95)),
      hslToHex(h, clamp(s + 3, 0, 100), clamp(l + offsets[8]  * d, 5, 95)),
      hslToHex(h, clamp(s - 1, 0, 100), clamp(l + offsets[9]  * d, 5, 95)),
      hslToHex(h, clamp(s + 2, 0, 100), clamp(l + offsets[10] * d, 5, 95)),
      hslToHex(h, clamp(s - 2, 0, 100), clamp(l + offsets[11] * d, 5, 95)),
    ];
  } catch {
    return ["#F7F3EC", "#F4F0E8", "#F2EDE4", "#EFEBE0",
            "#EAE4DA", "#E7E0D6", "#E4DCCF", "#E0D8CB",
            "#DDD4C5", "#DAD1C2", "#D6CEC1", "#D3CABB"];
  }
}

const makeFieldTiles = (tileSizePx: number = 20, gapPx: number = 0, palette: string[]) => {
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
    const hash = (row * 7 + col * 13 + row * col * 3) % palette.length;
    return {
      x: col * cellW + gW / 2,
      y: row * cellH + gH / 2,
      w: Math.max(0.01, cellW - gW),
      h: Math.max(0.01, cellH - gH),
      fill: palette[hash],
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
  // Derive tile palette, grout, grid-line, and glow colours dynamically from bgColor/accentColor
  const tilePalette = bgTilePalette(base);
  // Use a slightly lightened palette stop as the canvas fill so the background
  // feels harmonised with the tile colours rather than the raw dark base showing through.
  const lightBase = tilePalette[9];
  const { cols, rows, tiles } = makeFieldTiles(tileGridSize ?? 20, tileGridGap ?? 0, tilePalette);
  // Border/grout come from the same palette array as the tiles — fully synchronous
  const groutColor   = tilePalette[10]; // lightest/darkest stop closest to base → subtle grout line
  const gridLineColor = tilePalette[3]; // mid-bright stop → visible grid overlay
  // Border tiles use a 12-stop palette centred on the accent colour
  const accentBorderPalette = bgTilePalette(gold);
  const glowRgb = (() => { try { const c = gold.replace("#", ""); return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)]; } catch { return [194, 98, 64]; } })();
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
        backgroundColor: lightBase,
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
        <rect x="0" y="0" width="100" height="100" fill={lightBase} />
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
              stroke={groutColor}
              strokeOpacity="0.25"
              strokeWidth="0.06"
              opacity={tileReveal * tileExit}
            />
          );
        })}


        <line x1="7" y1="12" x2="93" y2="12" stroke={gold} strokeWidth="0.24" opacity={0.2 + frameReveal * 0.3} />
        <line x1="7" y1="88" x2="93" y2="88" stroke={gold} strokeWidth="0.24" opacity={0.2 + frameReveal * 0.3} />
      </svg>

      {/* ── Layer 2: Decorative primitives ──────────── */}
      {(variant === "metricField" || variant === "punchField") ? <MosaicRadialGuides accentColor={gold} /> : null}
      {(variant === "punchField" || variant === "closeField") ? <MosaicShards driftProgress={frameDrift} /> : null}
      {showFrame ? <MosaicFrame revealProgress={frameReveal} density={variant === "phrasesFrame" ? "soft" : "dense"} opacity={variant === "panelField" ? 0.75 : 0.88} palette={accentBorderPalette} /> : null}

      {/* ── Layer 3: Warm radial glow ──────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            `radial-gradient(circle at 28% 8%, rgba(${glowRgb[0]},${glowRgb[1]},${glowRgb[2]},0.07), transparent 55%)`,

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
              `linear-gradient(to right,  ${gridLineColor}20 0.5px, transparent 0.5px)`,
              `linear-gradient(to bottom, ${gridLineColor}30 0.5px, transparent 0.5px)`,
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
