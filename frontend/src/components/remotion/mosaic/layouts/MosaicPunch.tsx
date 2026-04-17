import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MosaicBackground } from "../MosaicBackground";
import { MosaicImageReveal } from "../MosaicImageReveal";
import { MOSAIC_COLORS, MOSAIC_DEFAULT_FONT_FAMILY } from "../constants";
import { TileWordSvg } from "../mosaicPrimitives";
import { getSceneTransition, getStaggeredReveal } from "../transitions";
import type { MosaicLayoutProps } from "../types";

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
function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100, ll = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sl * Math.min(ll, 1 - ll);
  const f = (n: number) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "00")).join("");
}
function accentPalette(accent: string): string[] {
  try {
    const [h, s, l] = hexToHsl(accent);
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    return [
      hslToHex(h, clamp(s - 5, 0, 100), clamp(l + 24, 20, 90)),
      hslToHex(h, clamp(s, 0, 100), clamp(l + 14, 20, 90)),
      hslToHex(h, clamp(s + 5, 0, 100), clamp(l + 6, 20, 90)),
      hslToHex(h, s, l),
      hslToHex((h + 6) % 360, clamp(s + 5, 0, 100), clamp(l - 8, 10, 80)),
      hslToHex(h, clamp(s + 8, 0, 100), clamp(l - 16, 10, 80)),
    ];
  } catch { return [accent]; }
}

export const MosaicPunch: React.FC<MosaicLayoutProps> = ({
  title,
  word,
  imageUrl,
  accentColor,
  bgColor,
  textColor,
  titleFontSize,
  fontFamily,
  aspectRatio,
  mosaicPattern,
  mosaicIntensity,
  mosaicTileSize,
  mosaicTileGap,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const motion = getSceneTransition(frame, durationInFrames, 24, 18);
  // Tile sweep — 100 frames ≈ 3.3s
  const tileEntry = interpolate(frame, [0, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Content starts at frame 60 (60% of tile sweep)
  const scale   = interpolate(frame, [60, 76, 95], [0.92, 1.03, 1], { extrapolateRight: "clamp" });
  const opacity = interpolate(frame, [60, 82], [0, 1], { extrapolateRight: "clamp" });
  const seamGrow = getStaggeredReveal(frame, 68, 30);
  const exitBreak = interpolate(
    frame,
    [Math.max(0, durationInFrames - 24), durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const tileExit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 18), durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Image blurs in when tiles are ~65% done
  const imageReveal = interpolate(frame, [65, 125], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const line = accentColor || MOSAIC_COLORS.gold;
  const value = (word || title || "ENDURES").toUpperCase();

  return (
    <AbsoluteFill>
      <MosaicBackground
        bgColor={bgColor}
        accentColor={accentColor}
        variant="punchField"
        frameReveal={tileEntry * motion.exit}
        frameDrift={tileEntry}
        tileBuildProgress={tileEntry}
        tileEntryPattern={mosaicPattern ?? "scatter"}
        tileEntryIntensity={mosaicIntensity ?? 13}
        tileExitProgress={tileExit}
        tileExitSeed={31}
        tileExitIntensity={mosaicIntensity ?? 32}
        tileExitPattern={mosaicPattern ?? "scatter"}
        tileGridSize={mosaicTileSize}
        tileGridGap={mosaicTileGap}
      />

      {/* ── Full-bleed image revealed tile-by-tile with center ripple ── */}
      {imageUrl && (
        <MosaicImageReveal
          imageUrl={imageUrl}
          revealProgress={tileEntry}
          clarityProgress={imageReveal}
          pattern={mosaicPattern ?? "scatter"}
          intensity={mosaicIntensity ?? 13}
          style={{ opacity: motion.exit }}
          overlay={
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(234,228,218,0.58)",
              }}
            />
          }
        />
      )}

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            transform: `scale(${scale})`,
            opacity: opacity * motion.exit,
            display: "flex",
            justifyContent: "center",
            width: "90%",
            filter: `blur(${(1 - motion.exit) * 2}px)`,
          }}
        >
          {/* Height-driven container: titleFontSize controls how tall (and thus how wide) the mosaic text renders */}
          <div style={{ height: titleFontSize ?? (p ? 110 : 142) }}>
            {fontFamily ? (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  fontFamily,
                  fontWeight: 900,
                  fontSize: titleFontSize ?? (p ? 110 : 142),
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                  color: (accentPalette(accentColor || MOSAIC_COLORS.gold))[0],
                  opacity: interpolate(motion.entry, [0.1, 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                }}
              >
                {value}
              </div>
            ) : (
              <TileWordSvg
                text={value}
                tileSize={mosaicTileSize ?? Math.max(Math.round((titleFontSize ?? (p ? 110 : 142)) / 8), 8)}
                gap={mosaicTileGap ?? 1}
                revealProgress={motion.entry}
                revealMode="cluster"
                exitProgress={exitBreak}
                colors={accentPalette(accentColor || MOSAIC_COLORS.gold)}
                style={{ height: "100%", width: "auto" }}
              />
            )}
          </div>
        </div>
        <div style={{ position: "absolute", top: "34%", left: "8%", right: "8%", height: 1, background: "rgba(42,42,40,0.25)", opacity: 0.35 * motion.exit }} />
        <div style={{ position: "absolute", left: "50%", top: "8%", bottom: "8%", width: 1, background: "rgba(42,42,40,0.25)", opacity: 0.35 }} />
        <div style={{ position: "absolute", top: "34%", left: "12%", width: 260 * seamGrow, height: 1, background: line, opacity: 0.8 * motion.exit }} />
        <div style={{ position: "absolute", bottom: "34%", right: "12%", width: 260 * seamGrow, height: 1, background: line, opacity: 0.8 * motion.exit }} />
       
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
