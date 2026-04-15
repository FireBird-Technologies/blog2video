import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MosaicBackground } from "../MosaicBackground";
import { MosaicImageReveal } from "../MosaicImageReveal";
import { MOSAIC_COLORS, MOSAIC_DEFAULT_FONT_FAMILY } from "../constants";
import { TileWordSvg } from "../mosaicPrimitives";
import { getSceneTransition, getStaggeredReveal } from "../transitions";
import type { MosaicLayoutProps } from "../types";

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

/** 8-stop palette centred on the accent colour (lighter → darker with slight hue drift) */
function accentPalette(accent: string): string[] {
  try {
    const [h, s, l] = hexToHsl(accent);
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    return [
      hslToHex(h,              clamp(s - 5,  0, 100), clamp(l + 24, 20, 90)),
      hslToHex(h,              clamp(s,      0, 100), clamp(l + 14, 20, 90)),
      hslToHex(h,              clamp(s + 5,  0, 100), clamp(l +  6, 20, 90)),
      hslToHex(h,              s,                     l),
      hslToHex((h + 6) % 360, clamp(s + 5,  0, 100), clamp(l -  8, 10, 80)),
      hslToHex(h,              clamp(s + 8,  0, 100), clamp(l - 16, 10, 80)),
      hslToHex((h - 6 + 360) % 360, clamp(s + 5, 0, 100), clamp(l - 22, 10, 80)),
      hslToHex(h,              clamp(s - 15, 0, 100), clamp(l - 10, 10, 80)),
    ];
  } catch {
    return [accent];
  }
}

/** 3-stop muted palette for narration derived from the text colour */
function narrationPalette(textColor: string): string[] {
  try {
    const [h, s, l] = hexToHsl(textColor);
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    return [
      hslToHex(h, clamp(s - 20, 0, 100), clamp(l + 18, 15, 75)),
      hslToHex(h, clamp(s - 10, 0, 100), clamp(l + 28, 15, 80)),
      hslToHex(h, s,                     l),
    ];
  } catch {
    return [textColor];
  }
}

/** Split text into word-wrapped lines not exceeding maxChars each */
function wrapToLines(text: string, maxChars: number): string[] {
  const words = text.split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current === "") {
      current = word;
    } else if ((current + " " + word).length <= maxChars) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

export const MosaicTitle: React.FC<MosaicLayoutProps> = ({
  title,
  narration,
  imageUrl,
  accentColor,
  bgColor,
  textColor,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
  mosaicPattern,
  mosaicIntensity,
  mosaicTileSize,
  mosaicTileGap,
  aspectRatio,
}) => {
  const isPortrait = aspectRatio === "portrait";
  const p = isPortrait;
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const motion = getSceneTransition(frame, durationInFrames, 34, 12);
  // Tile sweep — 130 frames ≈ 4.3s
  const tileEntry = interpolate(frame, [0, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Content starts at frame 72 (≈55% of tile sweep done)
  const contentStart = 72;
  const titleIn        = getStaggeredReveal(frame, contentStart,      45);
  const titleBlocksIn  = getStaggeredReveal(frame, contentStart,      80);
  const subIn          = getStaggeredReveal(frame, contentStart + 12, 34);
  // Border builds IN SYNC with tiles from frame 0
  const borderSettle   = getStaggeredReveal(frame, 0, 110);
  const tileExit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 18), durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Image reveals after tiles are ~70% done
  const imageReveal = interpolate(frame, [90, 155], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const family = fontFamily || MOSAIC_DEFAULT_FONT_FAMILY;

  const titleLines = wrapToLines((title || "TESSERAE").toUpperCase(), isPortrait ? 14 : 16);
  const narrationLines = wrapToLines((narration || "STONE").toUpperCase(), isPortrait ? 18 : 22);
  const titleLineH = titleFontSize ? Math.round(titleFontSize * 1.5) : (isPortrait ? 100 : 110);
  const narLineH   = descriptionFontSize ? Math.round(descriptionFontSize * 1.8) : (isPortrait ? 58 : 66);

  return (
    <AbsoluteFill>
      <MosaicBackground
        bgColor={bgColor}
        accentColor={accentColor}
        variant="titleBands"
        frameReveal={borderSettle * motion.exit}
        frameDrift={0.3 + tileEntry * 0.7}
        tileBuildProgress={tileEntry}
        tileEntryPattern={mosaicPattern ?? "scatter"}
        tileEntryIntensity={mosaicIntensity ?? 13}
        tileExitProgress={tileExit}
        tileExitSeed={19}
        tileExitIntensity={mosaicIntensity ?? 26}
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
                background: "linear-gradient(160deg, rgba(234,228,218,0.55) 0%, rgba(234,228,218,0.38) 100%)",
              }}
            />
          }
        />
      )}

      <AbsoluteFill
        style={{
          flexDirection: "column",
          alignItems: "center",
          justifyContent: isPortrait ? "space-evenly" : "center",
          textAlign: "center",
          padding: isPortrait ? "12% 6%" : "0 8%",
          opacity: motion.presence,
          filter: `blur(${(1 - motion.exit) * 2}px)`,
        }}
      >
        {/* ── Title — plain text with custom font, or TileWordSvg per line ─────────── */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            opacity: titleIn,
            transform: `translateY(${(1 - titleIn) * 16}px)`,
          }}
        >
          {fontFamily ? (
            <div
              style={{
                fontFamily,
                fontWeight: 900,
                fontSize: titleFontSize ?? (p ? 96 : 84),
                color: (accentPalette(accentColor || MOSAIC_COLORS.gold))[0],
                lineHeight: 1.15,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}
            >
              {(title || "TESSERAE").toUpperCase()}
            </div>
          ) : (
            titleLines.map((line, i) => (
              <div key={i} style={{ width: "100%", height: titleLineH }}>
                <TileWordSvg
                  text={line}
                  tileSize={mosaicTileSize ?? 7}
                  gap={mosaicTileGap ?? 1}
                  revealProgress={titleBlocksIn}
                  revealMode="linear"
                  exitProgress={0}
                  colors={accentPalette(accentColor || MOSAIC_COLORS.gold)}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            ))
          )}
        </div>

        {/* ── Narration — plain text with custom font, or TileWordSvg per line ──────── */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginTop: isPortrait ? 60 : 24,
            opacity: subIn,
          }}
        >
          {fontFamily ? (
            <div
              style={{
                fontFamily,
                fontSize: descriptionFontSize ?? (p ? 42 : 34),
                color: narrationPalette(textColor || MOSAIC_COLORS.textSecondary)[0],
                lineHeight: 1.3,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              {(narration || "STONE").toUpperCase()}
            </div>
          ) : (
            narrationLines.map((line, i) => (
              <div key={i} style={{ width: "100%", height: narLineH }}>
                <TileWordSvg
                  text={line}
                  tileSize={mosaicTileSize ?? 5}
                  gap={mosaicTileGap ?? 1}
                  revealProgress={subIn}
                  revealMode="linear"
                  exitProgress={0}
                  colors={narrationPalette(textColor || MOSAIC_COLORS.textSecondary)}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            ))
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};