import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Img } from "remotion";
import type { NewscastLayoutProps } from "./types";
import {
  DEFAULT_NEWSCAST_ACCENT,
  DEFAULT_NEWSCAST_TEXT,
  getNewscastPortraitTypeScale,
  newscastFont,
  resolveNewscastDescriptionSize,
  resolveNewscastTitleSize,
  scaleNewscastPx,
} from "../themeUtils";
import {
  HEADLINE_WEIGHT,
  glassNarrativeHeadlinePop,
  glassNarrativePanelTumble,
  headlineTextShadow,
  panelTumbleStyle,
} from "../newscastLayoutMotion";

const NAVY_PANEL = "rgba(10,42,110,0.28)";
const BORDER = "rgba(200,220,255,0.25)";
const GOLD = "#D4AA50";

export const GlassNarrative: React.FC<NewscastLayoutProps> = ({
  title,
  narration,
  category,
  imageUrl,
  tickerItems,
  lowerThirdTag,
  lowerThirdHeadline,
  lowerThirdSub,
  accentColor,
  textColor,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portraitScale = getNewscastPortraitTypeScale(width, height);

  const isNarrow = width < 900;

  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const tumble = glassNarrativePanelTumble(frame);
  const panelBlur = interpolate(frame, [0, 12], [6, 0], { extrapolateRight: "clamp" });
  const titlePop = glassNarrativeHeadlinePop(frame, 6);

  // Staggered article lead in (chip -> headline -> narration -> image)
  const chipOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const chipY = interpolate(frame, [0, 12], [40, 0], { extrapolateRight: "clamp" });
  const chipScale = interpolate(frame, [0, 12], [0.82, 1], { extrapolateRight: "clamp" });
  const chipBlur = interpolate(frame, [0, 12], [8, 0], { extrapolateRight: "clamp" });

  const headlineOpacity = interpolate(frame, [6, 18], [0, 1], { extrapolateRight: "clamp" });
  const headlineY = interpolate(frame, [6, 18], [28, 0], { extrapolateRight: "clamp" });
  const headlineBlur = interpolate(frame, [6, 18], [6, 0], { extrapolateRight: "clamp" });

  const narrationOpacity = interpolate(frame, [12, 24], [0, 1], { extrapolateRight: "clamp" });
  const narrationY = interpolate(frame, [12, 24], [26, 0], { extrapolateRight: "clamp" });
  const narrationScale = interpolate(frame, [12, 24], [0.94, 1], { extrapolateRight: "clamp" });

  const imageOpacity = interpolate(frame, [14, 30], [0, 1], { extrapolateRight: "clamp" });
  const imageY = interpolate(frame, [14, 30], [44, 0], { extrapolateRight: "clamp" });
  const imageScale = interpolate(frame, [14, 22, 30], [0.94, 1.06, 1], { extrapolateRight: "clamp" });
  const foldLeftX = interpolate(frame, [0, 14], [-180, 0], { extrapolateRight: "clamp" });
  const foldRightX = interpolate(frame, [0, 14], [180, 0], { extrapolateRight: "clamp" });
  const timelineOpacity = interpolate(frame, [6, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const cat = category ?? "WORLD AFFAIRS";
  const safeTickerItems = (tickerItems?.filter(Boolean) ?? []).slice(0, 4);
  const safeLowerTag = lowerThirdTag ?? "LIVE COVERAGE";
  const safeLowerHeadline = lowerThirdHeadline ?? "Correspondent Report";
  const safeLowerSub = lowerThirdSub ?? "Reporting live from the broadcast desk";
  const RED = accentColor || DEFAULT_NEWSCAST_ACCENT;
  const STEEL = textColor || DEFAULT_NEWSCAST_TEXT;

  return (
    <AbsoluteFill style={{ zIndex: 60, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isNarrow ? "7% 4% 6% 6%" : "7% 6% 6% 6%",
          gap: 18,
          opacity,
        }}
      >
        <div
          style={{
            position: "relative",
            width: isNarrow ? "62%" : "62%",
            maxWidth: 860,
            ...panelTumbleStyle(tumble),
            filter: `blur(${panelBlur}px)`,
            opacity: tumble.opacity,
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              background: NAVY_PANEL,
              border: `1px solid ${BORDER}`,
              backdropFilter: "blur(8px)",
              padding: 26,
              paddingLeft: 28,
              overflow: "hidden",
            }}
          >
          {/* Red top accent + left accent */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: RED,
              opacity: 0.95,
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: 4,
              background: RED,
              opacity: 0.95,
            }}
          />

          {/* Gold corner tick marks */}
          {(["tl", "tr", "bl", "br"] as const).map((pos) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={pos}
              aria-hidden
              style={{
                position: "absolute",
                width: 18,
                height: 18,
                ...(pos === "tl" ? { top: 0, left: 0 } : null),
                ...(pos === "tr" ? { top: 0, right: 0 } : null),
                ...(pos === "bl" ? { bottom: 0, left: 0 } : null),
                ...(pos === "br" ? { bottom: 0, right: 0 } : null),
                borderTop: pos === "bl" || pos === "br" ? "none" : `2px solid ${GOLD}`,
                borderLeft: pos === "tr" || pos === "br" ? "none" : `2px solid ${GOLD}`,
                borderRight: pos === "tr" || pos === "br" ? `2px solid ${GOLD}` : "none",
                borderBottom: pos === "bl" || pos === "br" ? `2px solid ${GOLD}` : "none",
                opacity: 0.6,
              }}
            />
          ))}

          {/* Body layout */}
          <div style={{ display: "flex", gap: imageUrl ? 22 : 0, alignItems: "stretch" }}>
            <div style={{ flex: 1, minWidth: 0, transform: `translateX(${foldLeftX}px)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, opacity: timelineOpacity }}>
                <div style={{ width: 54, height: 2, background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
                <div style={{ fontFamily: newscastFont(fontFamily, "label"), fontSize: scaleNewscastPx(11, portraitScale), color: STEEL, letterSpacing: 3, textTransform: "uppercase" }}>
                  M1  M2  M3
                </div>
              </div>
              <div
                style={{
                  display: "inline-block",
                  background: RED,
                  color: "white",
                  fontFamily: newscastFont(fontFamily, "title"),
                  fontSize: scaleNewscastPx(12, portraitScale),
                  fontWeight: 800,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  padding: "4px 12px",
                  borderRadius: 2,
                  marginBottom: 14,
                  opacity: chipOpacity,
                  transform: `translateY(${chipY}px) scale(${chipScale})`,
                  filter: `blur(${chipBlur}px)`,
                  boxShadow: "0 4px 24px rgba(232,32,32,0.45)",
                }}
              >
                {cat}
              </div>

              <h2
                style={{
                  fontFamily: newscastFont(fontFamily, "title"),
                  fontSize: resolveNewscastTitleSize(titleFontSize, 30, portraitScale),
                  fontWeight: HEADLINE_WEIGHT,
                  color: "white",
                  textTransform: "uppercase",
                  lineHeight: 1.15,
                  margin: 0,
                  marginBottom: 10,
                  opacity: headlineOpacity * titlePop.opacity,
                  textShadow: headlineTextShadow.strong,
                  transform: `translateY(${headlineY + titlePop.translateY}px) scale(${titlePop.scale}) rotateZ(${titlePop.rotateZ}deg)`,
                  filter: `blur(${headlineBlur}px)`,
                }}
              >
                {title}
              </h2>

              {narration ? (
                <div
                  style={{
                    fontFamily: newscastFont(fontFamily, "body"),
                    fontSize: resolveNewscastDescriptionSize(descriptionFontSize, 16, portraitScale),
                    fontWeight: 500,
                    color: "rgba(232,238,248,0.95)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    transform: `translateY(${narrationY}px) scale(${narrationScale})`,
                    opacity: narrationOpacity,
                  }}
                >
                  {narration}
                </div>
              ) : null}
            </div>

            {imageUrl ? (
              <div
                style={{
                  flex: "0 0 40%",
                  borderRadius: 12,
                  overflow: "hidden",
                  alignSelf: "center",
                  position: "relative",
                  opacity: imageOpacity,
                  transform: `translateX(${foldRightX}px) translateY(${imageY}px) scale(${imageScale})`,
                }}
              >
                <Img
                  src={imageUrl}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(90deg, rgba(10,42,110,0) 0%, rgba(10,42,110,0.7) 65%, rgba(10,42,110,0.9) 100%)",
                  }}
                />
              </div>
            ) : null}
          </div>
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
              <div style={{ marginTop: 6, fontFamily: newscastFont(fontFamily, "body"), fontSize: resolveNewscastDescriptionSize(descriptionFontSize, 13, portraitScale), color: STEEL, lineHeight: 1.5 }}>
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
              <div style={{ fontFamily: newscastFont(fontFamily, "label"), fontSize: scaleNewscastPx(10, portraitScale), letterSpacing: 4, fontWeight: 600, color: "#B8C8E0", textTransform: "uppercase" }}>
                Latest
              </div>
              <div style={{ height: 1, marginTop: 8, background: `linear-gradient(90deg, transparent, ${RED}, ${GOLD})`, opacity: 0.8 }} />
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {(safeTickerItems.length ? safeTickerItems : ["LIVE BREAKING FEED", "LATEST UPDATES", "OFFICIAL CONFIRMATIONS"]).slice(0, 3).map((t, i) => (
                  <div key={`${t}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: newscastFont(fontFamily, "body"), color: STEEL, fontSize: resolveNewscastDescriptionSize(descriptionFontSize, 13, portraitScale), lineHeight: 1.3 }}>
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

