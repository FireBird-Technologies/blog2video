import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MosaicBackground, bgTilePalette } from "../MosaicBackground";
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

export const MosaicMetric: React.FC<MosaicLayoutProps> = ({
  title,
  metrics,
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
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const motion = getSceneTransition(frame, durationInFrames, 18, 14);
  // Content starts when tiles are ≥55% done (frame 55)
  const contentStart = 55;
  const ringIn       = getStaggeredReveal(frame, contentStart,      18);
  const secondaryIn  = getStaggeredReveal(frame, contentStart + 10, 14);
  const tileEntry = interpolate(frame, [0, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tileExit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 16), durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const family = fontFamily || MOSAIC_DEFAULT_FONT_FAMILY;
  const list = metrics && metrics.length > 0 ? metrics.slice(0, 3) : [{ value: "97", label: title || "craft precision", suffix: "%" }];
  const first = list[0];
  const line = accentColor || MOSAIC_COLORS.gold;
  const tp = bgTilePalette(bgColor || MOSAIC_COLORS.deepNavy);
  const panelBg = tp[1] + "F2";     // near-lightest tile stop, 95% opacity
  const panelBorder = tp[6] + "60"; // mid-palette stop, ~38% opacity

  return (
    <AbsoluteFill>
      <MosaicBackground
        bgColor={bgColor}
        accentColor={accentColor}
        variant="metricField"
        frameReveal={tileEntry * motion.exit}
        frameDrift={tileEntry}
        tileBuildProgress={tileEntry}
        tileEntryPattern={mosaicPattern}
        tileEntryIntensity={mosaicIntensity ?? 13}
        tileExitProgress={tileExit}
        tileExitSeed={59}
        tileExitIntensity={mosaicIntensity ?? 27}
        tileExitPattern={mosaicPattern}
        tileGridSize={mosaicTileSize}
        tileGridGap={mosaicTileGap}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div
          style={{
            border: `1px solid ${line}88`,
            padding: "40px 70px",
            background: panelBg,
            opacity: motion.presence,
            transform: `scale(${0.97 + ringIn * 0.03})`,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 860,
            }}
          >
            <TileWordSvg
              text={`${first.value}${first.suffix || ""}`}
              tileSize={mosaicTileSize ?? (titleFontSize ? Math.max(Math.floor(titleFontSize / 10), 9) : 14)}
              gap={mosaicTileGap ?? 1}
              revealProgress={ringIn}
              colors={accentPalette(accentColor || MOSAIC_COLORS.gold)}              fontFamily={fontFamily}              style={{ width: "100%", height: "auto", aspectRatio: "8 / 1.65" }}
            />
          </div>
          <div style={{ marginTop: 14, height: 1, background: `${line}` }} />
          <div
            style={{
              marginTop: 14,
              fontFamily: family,
              fontSize: descriptionFontSize ?? 32,
              color: textColor || MOSAIC_COLORS.textSecondary,
              fontStyle: "italic",
            }}
          >
            {first.label}
          </div>
          {list.length > 1 ? (
            <div style={{ marginTop: 30, display: "flex", gap: 48, justifyContent: "center" }}>
              {list.slice(1).map((metric, idx) => (
                <div key={`${metric.value}-${metric.label}`} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: family, fontSize: 40, color: accentColor || MOSAIC_COLORS.gold, fontWeight: 700, opacity: secondaryIn * (1 - idx * 0.06) }}>
                    {metric.value}
                    {metric.suffix || ""}
                  </div>
                  <div style={{ marginTop: 6, fontFamily: family, fontSize: 24, color: textColor || MOSAIC_COLORS.textSecondary, fontStyle: "italic", opacity: secondaryIn * (1 - idx * 0.06) }}>
                    {metric.label}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
