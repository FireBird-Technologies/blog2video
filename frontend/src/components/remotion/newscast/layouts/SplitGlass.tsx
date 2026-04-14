import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { NewscastLayoutProps } from "./types";
import { NewsCastLayoutImageBackground } from "../NewsCastLayoutImageBackground";
import {
  DEFAULT_NEWSCAST_ACCENT,
  DEFAULT_NEWSCAST_TEXT,
  getNewscastPortraitTypeScale,
  newscastFont,
  scaleNewscastPx,
} from "../themeUtils";
import {
  HEADLINE_WEIGHT,
  headlinePopObvious,
  headlinePopStyle,
  headlineTextShadow,
  panelTumbleStyle,
  panelTumbleUp,
} from "../newscastLayoutMotion";

const GOLD = "#D4AA50";

export const SplitGlass: React.FC<NewscastLayoutProps> = ({
  leftLabel = "BEFORE",
  rightLabel = "AFTER",
  leftTitle = "Previous Framework",
  rightTitle = "New Geneva Accord",
  leftBody,
  rightBody,
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
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const settle = interpolate(frame, [0, 25], [0.96, 1], { extrapolateRight: "clamp" });
  const { width, height } = useVideoConfig();
  const portraitScale = getNewscastPortraitTypeScale(width, height);
  const p = height > width;
  const isNarrow = width < 900;

  const safeLeftBody = leftBody ?? "";
  const safeRightBody = rightBody ?? "";
  const safeTickerItems = (tickerItems?.filter(Boolean) ?? []).slice(0, 4);
  const safeLowerTag = lowerThirdTag ?? "LIVE COVERAGE";
  const safeLowerHeadline = lowerThirdHeadline ?? "Correspondent Report";
  const safeLowerSub = lowerThirdSub ?? "Reporting live from the broadcast desk";
  const RED = accentColor || DEFAULT_NEWSCAST_ACCENT;
  const STEEL = textColor || DEFAULT_NEWSCAST_TEXT;

  const leftTumble = panelTumbleUp(frame, 0);
  const rightTumble = panelTumbleUp(frame, 10);
  const leftTitlePop = headlinePopObvious(frame, 4);
  const rightTitlePop = headlinePopObvious(frame, 14);
  const dividerEntryScale = interpolate(frame, [0, 10, 24], [3.2, 1.45, 1], {
    extrapolateRight: "clamp",
  });
  const dividerGlow = interpolate(frame, [0, 8, 22], [0.95, 0.68, 0.38], {
    extrapolateRight: "clamp",
  });
  const dividerWidth = interpolate(frame, [0, 10, 22], [12, 8, 4], {
    extrapolateRight: "clamp",
  });
  const vortexPull = interpolate(frame, [0, 14, 28], [1, 0.34, 0], {
    extrapolateRight: "clamp",
  });
  const leftSwirlX = -140 * vortexPull;
  const rightSwirlX = 140 * vortexPull;
  const swirlY = -80 * vortexPull;
  const leftSwirlRot = -18 * vortexPull;
  const rightSwirlRot = 18 * vortexPull;
  const dividerImpactPulse = interpolate(frame, [0, 9, 20], [1.34, 1.12, 1], {
    extrapolateRight: "clamp",
  });
  const dividerImpactFlash = interpolate(frame, [0, 4, 11], [0.7, 0.32, 0], {
    extrapolateRight: "clamp",
  });

  const leftTint = "rgba(139,0,0,0.20)";
  const rightTint = "rgba(10,42,110,0.30)";

  const sideBorder = (tint: "red" | "blue") => (tint === "red" ? "rgba(232,32,32,0.30)" : "rgba(100,150,220,0.30)");

  const tagStyle = (isLeft: boolean) => ({
    fontFamily: newscastFont(fontFamily, "title"),
    fontSize: scaleNewscastPx(11, portraitScale),
    fontWeight: 600,
    letterSpacing: 4,
    textTransform: "uppercase" as const,
    color: GOLD,
  });

  return (
    <AbsoluteFill style={{ zIndex: 60, overflow: "hidden", opacity }}>
      <NewsCastLayoutImageBackground imageUrl={imageUrl} accentColor={RED} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isNarrow ? "8% 4%" : "8% 5%",
          gap: 18,
          transform: `scale(${settle})`,
          zIndex: 1,
        }}
      >
        <div style={{ width: isNarrow ? "92%" : "72%", maxWidth: isNarrow ? 1180 : 900, display: "flex", height: 360, gap: 0 }}>
          <div
            style={{
              flex: 1,
              background: leftTint,
              border: `1px solid ${sideBorder("red")}`,
              borderRight: "none",
              backdropFilter: "blur(6px)",
              padding: "24px 28px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              ...panelTumbleStyle(leftTumble),
              opacity: leftTumble.opacity,
              transform: `translateX(${leftSwirlX}px) translateY(${swirlY}px) rotateZ(${leftSwirlRot}deg)`,
              transformOrigin: "80% 50%",
            }}
          >
            <div style={tagStyle(true)}>{leftLabel}</div>
            <div
              style={{
                marginTop: 8,
                fontFamily: newscastFont(fontFamily, "title"),
                fontSize: titleFontSize ?? (p ? 34 : 26),
                fontWeight: HEADLINE_WEIGHT,
                textTransform: "uppercase",
                color: "white",
                lineHeight: 1.1,
                textShadow: headlineTextShadow.strong,
                ...headlinePopStyle(leftTitlePop),
              }}
            >
              {leftTitle}
            </div>
            {safeLeftBody ? (
              <div
                style={{
                  marginTop: 10,
                  fontFamily: newscastFont(fontFamily, "body"),
                  fontSize: descriptionFontSize ?? (p ? 18 : 14),
                  lineHeight: 1.5,
                  color: "rgba(255,255,255,0.86)",
                }}
              >
                {safeLeftBody}
              </div>
            ) : null}
          </div>

          <div
            aria-hidden
            style={{
              width: dividerWidth,
              background: "linear-gradient(to bottom, transparent, #D4AA50 30%, #E82020 50%, #D4AA50 70%, transparent)",
              boxShadow: `0 0 20px rgba(232,32,32,${dividerGlow}), 0 0 38px rgba(120,180,255,${dividerGlow * 0.45})`,
              flexShrink: 0,
              transform: `scaleY(${dividerEntryScale * dividerImpactPulse}) scaleX(${dividerImpactPulse})`,
              transformOrigin: "50% 50%",
            }}
          />

          <div
            style={{
              flex: 1,
              background: rightTint,
              border: `1px solid ${sideBorder("blue")}`,
              borderLeft: "none",
              backdropFilter: "blur(6px)",
              padding: "24px 28px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              ...panelTumbleStyle(rightTumble),
              opacity: rightTumble.opacity,
              transform: `translateX(${rightSwirlX}px) translateY(${swirlY}px) rotateZ(${rightSwirlRot}deg)`,
              transformOrigin: "20% 50%",
            }}
          >
            <div style={tagStyle(false)}>{rightLabel}</div>
            <div
              style={{
                marginTop: 8,
                fontFamily: newscastFont(fontFamily, "title"),
                fontSize: titleFontSize ?? (p ? 34 : 26),
                fontWeight: HEADLINE_WEIGHT,
                textTransform: "uppercase",
                color: "white",
                lineHeight: 1.1,
                textShadow: headlineTextShadow.strong,
                ...headlinePopStyle(rightTitlePop),
              }}
            >
              {rightTitle}
            </div>
            {safeRightBody ? (
              <div
                style={{
                  marginTop: 10,
                  fontFamily: newscastFont(fontFamily, "body"),
                  fontSize: descriptionFontSize ?? (p ? 18 : 14),
                  lineHeight: 1.5,
                  color: "rgba(255,255,255,0.86)",
                }}
              >
                {safeRightBody}
              </div>
            ) : null}
          </div>
        </div>
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: isNarrow ? 320 : 420,
            height: isNarrow ? 320 : 420,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.72) 0%, rgba(232,32,32,0.28) 24%, rgba(120,180,255,0.18) 45%, rgba(10,20,44,0) 72%)",
            opacity: dividerImpactFlash,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />

        {/* Right: bulletin rail */}
        <div style={{ flex: "0 0 28%", minWidth: isNarrow ? 190 : 250, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "rgba(10,42,110,0.25)", border: "1px solid rgba(200,220,255,0.20)", borderRadius: 12, backdropFilter: "blur(8px)", padding: "12px 14px 12px", overflow: "hidden", position: "relative" }}>
            <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, transparent 100%)", pointerEvents: "none" }} />
            <div style={{ position: "relative" }}>
              <div style={{ fontFamily: newscastFont(fontFamily, "label"), fontSize: scaleNewscastPx(10, portraitScale), letterSpacing: 4, fontWeight: 600, color: "#B8C8E0", textTransform: "uppercase" }}>{safeLowerTag}</div>
              <div style={{ marginTop: 6, fontFamily: newscastFont(fontFamily, "title"), fontSize: scaleNewscastPx(22, portraitScale), fontWeight: 700, color: "white", textTransform: "uppercase", letterSpacing: 0.5, lineHeight: 1.05 }}>{safeLowerHeadline}</div>
              <div style={{ marginTop: 6, fontFamily: newscastFont(fontFamily, "body"), fontSize: scaleNewscastPx(13, portraitScale), color: STEEL, lineHeight: 1.5 }}>{safeLowerSub}</div>
            </div>
          </div>

          <div style={{ background: "rgba(10,42,110,0.25)", border: "1px solid rgba(200,220,255,0.20)", borderRadius: 12, backdropFilter: "blur(8px)", padding: "12px 14px", overflow: "hidden", position: "relative" }}>
            <div style={{ position: "relative" }}>
              <div style={{ fontFamily: newscastFont(fontFamily, "label"), fontSize: scaleNewscastPx(10, portraitScale), letterSpacing: 4, fontWeight: 600, color: "#B8C8E0", textTransform: "uppercase" }}>Latest</div>
              <div style={{ height: 1, marginTop: 8, background: `linear-gradient(90deg, transparent, ${RED}, ${GOLD})`, opacity: 0.8 }} />
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {(safeTickerItems.length ? safeTickerItems : ["LIVE BREAKING FEED", "LATEST UPDATES", "OFFICIAL CONFIRMATIONS"]).slice(0, 3).map((t, i) => (
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

