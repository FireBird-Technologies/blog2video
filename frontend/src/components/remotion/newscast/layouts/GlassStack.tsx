import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { NewscastLayoutProps } from "./types";
import { NewsCastLayoutImageBackground } from "../NewsCastLayoutImageBackground";
import {
  DEFAULT_NEWSCAST_ACCENT,
  DEFAULT_NEWSCAST_TEXT,
  getNewscastPortraitTypeScale,
  newscastFont,
  resolveNewscastNumberFontPx,
  scaleNewscastPx,
} from "../themeUtils";
import {
  HEADLINE_WEIGHT,
  headlinePop,
  headlinePopStyle,
  headlineTextShadow,
  panelTumbleStyle,
  panelTumbleUp,
} from "../newscastLayoutMotion";

const GOLD = "#D4AA50";

export const GlassStack: React.FC<NewscastLayoutProps> = ({
  sectionLabel = "THREE KEY PROVISIONS",
  items = [],
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

  const safeItems = useMemo(() => items.filter(Boolean).slice(0, 3), [items]);
  const isNarrow = width < 900;

  const safeTitle = title ?? "PROVISIONS";
  const safeNarration = narration ?? "";
  const safeLowerTag = lowerThirdTag ?? "LIVE COVERAGE";
  const safeLowerHeadline = lowerThirdHeadline ?? "Correspondent Report";
  const safeLowerSub = lowerThirdSub ?? "Reporting live from the broadcast desk";
  const safeTickerItems = (tickerItems?.filter(Boolean) ?? []).slice(0, 4);
  const RED = accentColor || DEFAULT_NEWSCAST_ACCENT;
  const STEEL = textColor || DEFAULT_NEWSCAST_TEXT;

  const zEnter = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const zRotY = interpolate(frame, [0, 18], [14, 0], { extrapolateRight: "clamp" });
  // The "pile" should feel stacked during the entrance, but must not stay overlapping.
  // We fade the pile offset out as each card settles.
  const pileOffsetY = isNarrow ? 24 : 30;
  const dropDistance = isNarrow ? 150 : 190;
  const dropStagger = isNarrow ? 10 : 12;
  const prismLock = interpolate(frame, [0, 10, 24, 36], [0, 1, 0.65, 0], {
    extrapolateRight: "clamp",
  });
  const lockPulse = interpolate(frame, [18, 26, 34], [1, 1.08, 1], { extrapolateRight: "clamp" });
  const tumble = panelTumbleUp(frame);
  const titlePop = headlinePop(frame, 2);

  return (
    <AbsoluteFill style={{ zIndex: 60, overflow: "hidden", opacity: sceneOpacity }}>
      <NewsCastLayoutImageBackground imageUrl={imageUrl} accentColor={RED} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isNarrow ? "7% 4% 6% 6%" : "7% 6% 6% 6%",
          gap: 18,
          zIndex: 1,
        }}
      >
        {/* Left: stack content */}
        <div style={{ flex: "1 1 65%", minWidth: 0 }}>
          <div
            style={{
              background: "rgba(10,42,110,0.18)",
              border: "1px solid rgba(200,220,255,0.20)",
              borderRadius: 14,
              backdropFilter: "blur(8px)",
              padding: isNarrow ? 16 : 18,
              overflow: "hidden",
              boxShadow: "0 18px 60px rgba(0,0,0,0.25)",
              ...panelTumbleStyle(tumble),
              opacity: tumble.opacity,
            }}
          >
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontFamily: newscastFont(fontFamily, "label"),
                  fontSize: scaleNewscastPx(11, portraitScale),
                  fontWeight: 600,
                  letterSpacing: 5,
                  color: STEEL,
                  textTransform: "uppercase",
                  display: "inline-block",
                }}
              >
                {sectionLabel}
              </div>
              <div
                style={{
                  width: 120,
                  height: 1,
                  margin: "10px 0 0",
                  background: `linear-gradient(90deg, transparent, ${RED}, transparent)`,
                  opacity: 0.95,
                }}
              />

              <div
                style={{
                  marginTop: 12,
                  fontFamily: newscastFont(fontFamily, "title"),
                  fontSize: titleFontSize ?? (p ? 31 : 24),
                  fontWeight: HEADLINE_WEIGHT,
                  color: "white",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  lineHeight: 1.1,
                  textShadow: headlineTextShadow.light,
                  ...headlinePopStyle(titlePop),
                }}
              >
                {safeTitle}
              </div>
              {safeNarration ? (
                <div
                  style={{
                    marginTop: 8,
                    fontFamily: newscastFont(fontFamily, "body"),
                    fontSize: descriptionFontSize ?? (p ? 18 : 14),
                    color: STEEL,
                    lineHeight: 1.5,
                    opacity: 0.95,
                    whiteSpace: "pre-wrap",
                    maxWidth: 740,
                  }}
                >
                  {safeNarration}
                </div>
              ) : null}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {safeItems.map((txt, idx) => {
                const indexLabel = String(idx + 1).padStart(2, "0");
                const indexBasePx = isNarrow ? 24 : 28;
                const indexFontSize = resolveNewscastNumberFontPx({
                  basePx: indexBasePx,
                  descriptionFontSize,
                  portraitScale,
                  text: indexLabel,
                  maxWidth: isNarrow ? 34 : 40,
                  maxHeight: isNarrow ? 34 : 38,
                  lineHeight: 1,
                  proportionalDamp: 0.68,
                  proportionalMin: 0.88,
                  proportionalMax: 1.18,
                  fitMin: 0.66,
                  fitMax: 1,
                });
                return (
                  <div
                    // eslint-disable-next-line react/no-array-index-key
                    key={idx}
                    style={{
                      position: "relative",
                      padding: isNarrow ? "11px 16px" : "12px 18px",
                      borderRadius: 10,
                      background: "rgba(10,42,110,0.25)",
                      border: "1px solid rgba(200,220,255,0.20)",
                      borderLeft: `4px solid ${RED}`,
                      backdropFilter: "blur(6px)",
                      transformStyle: "preserve-3d",
                      zIndex: 10 + idx,
                      opacity: interpolate(frame, [idx * dropStagger, idx * dropStagger + 10], [0, 1], {
                        extrapolateRight: "clamp",
                      }),
                      transform: (() => {
                        const start = idx * dropStagger;
                        const dropY = interpolate(
                          frame,
                          [start, start + 11, start + 20, start + 30],
                          [-dropDistance, 36, -16, 0],
                          { extrapolateRight: "clamp" }
                        );
                        const landScale = interpolate(
                          frame,
                          [start + 11, start + 20, start + 32],
                          [1.1, 0.9, 1.0],
                          { extrapolateRight: "clamp" }
                        );
                        const pileT = interpolate(frame, [start + 10, start + 30], [1, 0], {
                          extrapolateRight: "clamp",
                        });
                        const fanX = (idx - 1) * 120 * prismLock;
                        const fanY = (idx - 1) * -34 * prismLock;
                        const fanRot = (idx - 1) * 11 * prismLock;
                        return `translateX(${idx * 10 + fanX}px) translateY(${dropY - idx * pileOffsetY * pileT + fanY}px) perspective(900px) rotateY(${zRotY * 0.65 + fanRot}deg) rotateX(${
                          -zRotY * 0.35
                        }deg) translateZ(${zEnter * 18 + prismLock * 18}px) scale(${landScale * lockPulse})`;
                      })(),
                      overflow: "hidden",
                    }}
                  >
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, transparent 100%)",
                      pointerEvents: "none",
                    }}
                  />
                  <div style={{ position: "relative", display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <div
                      style={{
                        fontFamily: newscastFont(fontFamily, "title"),
                        fontSize: indexFontSize,
                        fontWeight: 700,
                        color: RED,
                        opacity: 0.8,
                        minWidth: isNarrow ? 30 : 34,
                        textAlign: "center",
                        paddingTop: 2,
                      }}
                    >
                      {indexLabel}
                    </div>
                    <div
                      style={{
                        fontFamily: newscastFont(fontFamily, "body"),
                        fontSize: scaleNewscastPx(isNarrow ? 15 : 17, portraitScale),
                        fontWeight: 500,
                        color: "white",
                        lineHeight: 1.4,
                        opacity: interpolate(frame, [idx * dropStagger + 8, idx * dropStagger + 18], [0, 1], {
                          extrapolateRight: "clamp",
                        }),
                      }}
                    >
                      {txt}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: “bulletin rail” */}
        <div style={{ flex: "0 0 30%", minWidth: isNarrow ? 190 : 250, display: "flex", flexDirection: "column", gap: 12 }}>
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
              <div
                style={{
                  fontFamily: newscastFont(fontFamily, "label"),
                  fontSize: scaleNewscastPx(10, portraitScale),
                  letterSpacing: 4,
                  fontWeight: 600,
                  color: "#B8C8E0",
                  textTransform: "uppercase",
                }}
              >
                {safeLowerTag}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontFamily: newscastFont(fontFamily, "title"),
                  fontSize: scaleNewscastPx(22, portraitScale),
                  fontWeight: 700,
                  color: "white",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  lineHeight: 1.05,
                }}
              >
                {safeLowerHeadline}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontFamily: newscastFont(fontFamily, "body"),
                  fontSize: scaleNewscastPx(13, portraitScale),
                  color: STEEL,
                  lineHeight: 1.5,
                }}
              >
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
              <div
                style={{
                  fontFamily: newscastFont(fontFamily, "label"),
                  fontSize: scaleNewscastPx(10, portraitScale),
                  letterSpacing: 4,
                  fontWeight: 600,
                  color: "#B8C8E0",
                  textTransform: "uppercase",
                }}
              >
                Latest
              </div>
              <div
                style={{
                  height: 1,
                  marginTop: 8,
                  background: `linear-gradient(90deg, transparent, ${RED}, ${GOLD})`,
                  opacity: 0.8,
                }}
              />
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {(safeTickerItems.length
                  ? safeTickerItems
                  : ["LIVE BREAKING FEED", "LATEST UPDATES", "OFFICIAL CONFIRMATIONS"]
                )
                  .slice(0, 3)
                  .map((t, i) => (
                    <div
                      key={`${t}-${i}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontFamily: newscastFont(fontFamily, "body"),
                        color: STEEL,
                        fontSize: scaleNewscastPx(13, portraitScale),
                        lineHeight: 1.3,
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: i === 0 ? RED : "#1E5FD4",
                          boxShadow: i === 0 ? "0 0 14px rgba(232,32,32,0.35)" : "0 0 14px rgba(30,95,212,0.35)",
                        }}
                      />
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

