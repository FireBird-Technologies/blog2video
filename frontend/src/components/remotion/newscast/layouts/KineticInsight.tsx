import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { NewscastLayoutProps } from "./types";
import { NewsCastLayoutImageBackground } from "../NewsCastLayoutImageBackground";
import { HEADLINE_WEIGHT, headlinePop, headlinePopStyle, headlineTextShadow } from "../newscastLayoutMotion";
import {
  DEFAULT_NEWSCAST_ACCENT,
  DEFAULT_NEWSCAST_TEXT,
  getNewscastPortraitTypeScale,
  newscastFont,
  scaleNewscastPx,
} from "../themeUtils";

const GOLD = "#D4AA50";

function highlightQuote(
  quote: string,
  highlightWord: string | undefined,
  accentColor: string,
  fx: { blurPx: number; rotZDeg: number; scale: number; yPx: number; opacity: number }
) {
  const word = (highlightWord ?? "").trim();
  if (!word) return quote;
  const safeWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b(${safeWord})\\b`, "i");
  const parts = quote.split(re);
  if (parts.length < 3) return quote;

  // parts: [before, match, after]
  return (
    <>
      {parts[0]}
      <span
        style={{
          color: accentColor,
          textShadow: "0 0 30px rgba(232,32,32,0.6)",
          position: "relative",
          display: "inline-block",
          opacity: fx.opacity,
          filter: `blur(${fx.blurPx}px)`,
          transform: `translateY(${fx.yPx}px) rotateZ(${fx.rotZDeg}deg) scale(${fx.scale})`,
          willChange: "transform, filter, opacity",
        }}
      >
        {parts[1]}
      </span>
      {parts.slice(2).join("")}
    </>
  );
}

export const KineticInsight: React.FC<NewscastLayoutProps> = ({
  quote,
  highlightWord,
  attribution,
  title,
  narration,
  tickerItems,
  lowerThirdTag,
  lowerThirdHeadline,
  lowerThirdSub,
  imageUrl,
  accentColor,
  textColor,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const portraitScale = getNewscastPortraitTypeScale(width, height);
  const p = height > width;
  const sceneFadeFrames = 16;
  const sceneOpacity = interpolate(
    frame,
    [0, sceneFadeFrames, durationInFrames - sceneFadeFrames, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const opacity = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: "clamp" });
  const dropY = interpolate(frame, [0, 16, 30], [120, -18, 0], { extrapolateRight: "clamp" });
  const rotX = interpolate(frame, [0, 16, 30], [12, -4, 0], { extrapolateRight: "clamp" });
  const rowScale = interpolate(frame, [0, 12, 26, 40], [0.9, 1.12, 0.98, 1], {
    extrapolateRight: "clamp",
  });
  const rowZ = interpolate(frame, [0, 16, 30], [88, -14, 0], { extrapolateRight: "clamp" });
  const breachScale = interpolate(frame, [0, 8, 18, 30], [0.72, 1.18, 0.96, 1], {
    extrapolateRight: "clamp",
  });
  const gridOpacity = interpolate(frame, [0, 10, 24], [0.85, 0.52, 0.18], { extrapolateRight: "clamp" });
  const kpiOpacity = interpolate(frame, [6, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const headlineDropY = interpolate(frame, [0, 14, 28], [-180, 20, 0], { extrapolateRight: "clamp" });
  const headlineCrackleAmp = interpolate(frame, [0, 12, 30], [9, 4, 0], { extrapolateRight: "clamp" });
  const headlineCrackleX = Math.sin(frame * 2.1) * headlineCrackleAmp * 0.45;
  const headlineCrackleY = Math.cos(frame * 2.7) * headlineCrackleAmp * 0.22;
  const headlineCrackleGlow = interpolate(frame, [0, 8, 20, 32], [0.9, 0.62, 0.34, 0], {
    extrapolateRight: "clamp",
  });

  // Highlight: blur -> sharp + small pop & rotation.
  const hlStart = 10;
  const highlightBlurPx = interpolate(frame, [hlStart, hlStart + 10], [7, 0], { extrapolateRight: "clamp" });
  const highlightY = interpolate(frame, [hlStart, hlStart + 16], [10, 0], { extrapolateRight: "clamp" });
  const highlightRotZ = interpolate(frame, [hlStart, hlStart + 16], [6, 0], { extrapolateRight: "clamp" });
  const highlightScale = interpolate(frame, [hlStart, hlStart + 8, hlStart + 18], [0.92, 1.2, 1], {
    extrapolateRight: "clamp",
  });
  const highlightOpacity = interpolate(frame, [hlStart, hlStart + 6], [0, 1], { extrapolateRight: "clamp" });
  const isNarrow = width < 900;
  const q = quote ?? title ?? "";
  const attr = attribution ?? narration ?? "";
  const quoteHeadPop = headlinePop(frame, 4);
  const safeTickerItems = (tickerItems?.filter(Boolean) ?? []).slice(0, 4);
  const safeLowerTag = lowerThirdTag ?? "LIVE COVERAGE";
  const safeLowerHeadline = lowerThirdHeadline ?? "Correspondent Report";
  const safeLowerSub = lowerThirdSub ?? "Reporting live from the broadcast desk";
  const RED = accentColor || DEFAULT_NEWSCAST_ACCENT;
  const STEEL = textColor || DEFAULT_NEWSCAST_TEXT;

  return (
    <AbsoluteFill style={{ zIndex: 60, overflow: "hidden", opacity: sceneOpacity }}>
      <NewsCastLayoutImageBackground imageUrl={imageUrl} accentColor={RED} />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(180,210,255,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(180,210,255,0.14) 1px, transparent 1px)",
          backgroundSize: "46px 46px",
          opacity: gridOpacity,
          transform: `scale(${breachScale})`,
          transformOrigin: "50% 50%",
        }}
      />
      {/* Top/bottom gold rules */}
      <div aria-hidden style={{ position: "absolute", top: "28%", left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ width: 420, height: 1, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, opacity: 0.85 }} />
      </div>
      <div aria-hidden style={{ position: "absolute", top: "57%", left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ width: 420, height: 1, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, opacity: 0.85 }} />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          transform: `perspective(900px) translateY(${dropY}px) rotateX(${rotX}deg) translateZ(${rowZ}px) scale(${rowScale * breachScale})`,
          opacity,
          padding: isNarrow ? "0 40px" : "0 70px",
          gap: 24,
          zIndex: 1,
        }}
      >
        <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingRight: 20 }}>
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 16,
              opacity: kpiOpacity,
              transform: `translateY(${(1 - kpiOpacity) * 16}px)`,
            }}
          >
            {["KPI", "DELTA", "CONF"].map((k) => (
              <div
                key={k}
                style={{
                  fontFamily: newscastFont(fontFamily, "label"),
                  fontSize: scaleNewscastPx(11, portraitScale),
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  color: STEEL,
                  border: "1px solid rgba(200,220,255,0.28)",
                  background: "rgba(10,42,110,0.28)",
                  padding: "4px 10px",
                }}
              >
                {k}
              </div>
            ))}
          </div>
          <div
            style={{
              fontFamily: newscastFont(fontFamily, "title"),
              fontSize: titleFontSize ?? (p ? 75 : 58),
              fontWeight: HEADLINE_WEIGHT,
              textTransform: "uppercase",
              textAlign: "center",
              letterSpacing: 1,
              lineHeight: 1.2,
              maxWidth: 900,
              color: "white",
              textShadow: `${headlineTextShadow.strong}, ${headlineCrackleX}px ${-headlineCrackleY}px 16px rgba(255,235,205,${headlineCrackleGlow}), 0 0 28px rgba(232,32,32,${headlineCrackleGlow * 0.75})`,
              transform: `translateY(${headlineDropY + headlineCrackleY}px) translateX(${headlineCrackleX}px)`,
              ...headlinePopStyle(quoteHeadPop),
            }}
          >
            {highlightQuote(q, highlightWord, RED, {
              blurPx: highlightBlurPx,
              rotZDeg: highlightRotZ,
              scale: highlightScale,
              yPx: highlightY,
              opacity: highlightOpacity,
            })}
          </div>

          <div
            style={{
              fontFamily: newscastFont(fontFamily, "label"),
              fontSize: descriptionFontSize ?? (p ? 17 : 13),
              letterSpacing: 4,
              color: STEEL,
              textTransform: "uppercase",
              marginTop: 18,
              opacity: 0.95,
              textAlign: "center",
            }}
          >
            {attr}
          </div>
        </div>

        {/* Right: bulletin rail */}
        <div style={{ flex: "0 0 28%", minWidth: isNarrow ? 190 : 250, display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              background: "rgba(10,42,110,0.25)",
              border: "1px solid rgba(200,220,255,0.20)",
              borderRadius: 12,
              backdropFilter: "blur(8px)",
              padding: "12px 14px 12px",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, transparent 100%)",
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative" }}>
              <div style={{ fontFamily: newscastFont(fontFamily, "label"), fontSize: scaleNewscastPx(10, portraitScale), letterSpacing: 4, fontWeight: 600, color: "#B8C8E0", textTransform: "uppercase" }}>
                {safeLowerTag}
              </div>
              <div style={{ marginTop: 6, fontFamily: newscastFont(fontFamily, "title"), fontSize: scaleNewscastPx(22, portraitScale), fontWeight: 700, color: "white", textTransform: "uppercase", letterSpacing: 0.5, lineHeight: 1.05 }}>
                {safeLowerHeadline}
              </div>
              <div style={{ marginTop: 6, fontFamily: newscastFont(fontFamily, "body"), fontSize: scaleNewscastPx(13, portraitScale), color: STEEL, lineHeight: 1.5 }}>
                {safeLowerSub}
              </div>
            </div>
          </div>

          <div
            style={{
              background: "rgba(10,42,110,0.25)",
              border: "1px solid rgba(200,220,255,0.20)",
              borderRadius: 12,
              backdropFilter: "blur(8px)",
              padding: "12px 14px",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div style={{ position: "relative" }}>
              <div style={{ fontFamily: newscastFont(fontFamily, "label"), fontSize: scaleNewscastPx(10, portraitScale), letterSpacing: 4, fontWeight: 600, color: "#B8C8E0", textTransform: "uppercase" }}>Latest</div>
              <div style={{ height: 1, marginTop: 8, background: `linear-gradient(90deg, transparent, ${RED}, ${GOLD})`, opacity: 0.8 }} />
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {(safeTickerItems.length ? safeTickerItems : ["LIVE BREAKING FEED", "LATEST UPDATES", "OFFICIAL CONFIRMATIONS"])
                  .slice(0, 3)
                  .map((t, i) => (
                    <div key={`${t}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: newscastFont(fontFamily, "body"), color: STEEL, fontSize: scaleNewscastPx(13, portraitScale), lineHeight: 1.3 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 999, background: i === 0 ? RED : "#1E5FD4", boxShadow: i === 0 ? "0 0 14px rgba(232,32,32,0.35)" : "0 0 14px rgba(30,95,212,0.35)" }} />
                      <div style={{ flex: 1 }}>{t}</div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

