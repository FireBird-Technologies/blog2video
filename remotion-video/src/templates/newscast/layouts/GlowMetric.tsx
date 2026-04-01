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
  resolveNewscastDescriptionSize,
  resolveNewscastTitleSize,
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

const BLUE = "#1E5FD4";
const GOLD = "#D4AA50";

function parseTarget(value: string | undefined) {
  const v = (value ?? "").toString().trim();
  const num = Number(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(num) ? num : null;
}

export const GlowMetric: React.FC<NewscastLayoutProps> = ({
  metrics = [],
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
  const countT = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });

  const safeMetrics = useMemo(() => metrics.filter(Boolean).slice(0, 3), [metrics]);
  const { width, height } = useVideoConfig();
  const portraitScale = getNewscastPortraitTypeScale(width, height);
  const isNarrow = width < 900;

  const safeTickerItems = (tickerItems?.filter(Boolean) ?? []).slice(0, 4);
  const safeTitle = title ?? "MARKET PULSE";
  const safeNarration = narration ?? "Editorial analysis and live updates.";
  const safeLowerTag = lowerThirdTag ?? "LIVE COVERAGE";
  const safeLowerHeadline = lowerThirdHeadline ?? "Correspondent Report";
  const safeLowerSub = lowerThirdSub ?? "Reporting live from the broadcast desk";
  const RED = accentColor || DEFAULT_NEWSCAST_ACCENT;
  const STEEL = textColor || DEFAULT_NEWSCAST_TEXT;

  const contentOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const zEnter = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const zRotY = interpolate(frame, [0, 18], [22, 0], { extrapolateRight: "clamp" });
  const primaryDropY = interpolate(frame, [0, 14, 28, 40], [140, -18, 12, 0], { extrapolateRight: "clamp" });
  const primaryNumScale = interpolate(frame, [0, 8, 20, 36, 54], [0.62, 1.28, 1.12, 1.04, 1], {
    extrapolateRight: "clamp",
  });
  const primaryFocusBoost = interpolate(frame, [0, 10, 24], [1.22, 1.08, 1], {
    extrapolateRight: "clamp",
  });
  const primaryValueGlow = interpolate(frame, [0, 8, 20], [0.9, 0.65, 0.38], {
    extrapolateRight: "clamp",
  });
  const primaryCrackleAmp = interpolate(frame, [0, 10, 24], [8, 3, 0], {
    extrapolateRight: "clamp",
  });
  const primaryCrackleX = Math.sin(frame * 1.9) * primaryCrackleAmp * 0.42;
  const primaryCrackleY = Math.cos(frame * 2.4) * primaryCrackleAmp * 0.22;
  const primaryCrackleFlicker = interpolate(frame, [0, 6, 14, 24], [0.95, 0.55, 0.28, 0], {
    extrapolateRight: "clamp",
  });
  const tumble = panelTumbleUp(frame);
  const titlePop = headlinePop(frame, 2);

  return (
    <AbsoluteFill style={{ zIndex: 60, overflow: "hidden", opacity: contentOpacity }}>
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
        {/* Left: metric cards + editorial header */}
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
                  fontFamily: newscastFont(fontFamily, "title"),
                  fontSize: resolveNewscastTitleSize(titleFontSize, 18, portraitScale),
                  fontWeight: HEADLINE_WEIGHT,
                  color: "white",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  textShadow: headlineTextShadow.light,
                  ...headlinePopStyle(titlePop),
                }}
              >
                {safeTitle}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontFamily: newscastFont(fontFamily, "body"),
                  fontSize: resolveNewscastDescriptionSize(descriptionFontSize, 14, portraitScale),
                  color: STEEL,
                  lineHeight: 1.5,
                  opacity: 0.95,
                  whiteSpace: "pre-wrap",
                  maxWidth: 720,
                }}
              >
                {safeNarration}
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "flex-start" }}>
              {safeMetrics.map((m, idx) => {
                const primary = idx === 0;
                const target = parseTarget(m.value);
                const suffix = m.suffix ?? "";
                const label = m.label ?? "";
                const display = target == null ? m.value : Math.round(target * countT).toString();
                const cardWidth = primary ? (isNarrow ? 210 : 280) : isNarrow ? 180 : 230;
                const cardHeight = isNarrow ? 190 : 210;
                const cardPadding = isNarrow ? 18 : 22;
                const baseNumberPx = primary ? (isNarrow ? 58 : 68) : isNarrow ? 46 : 56;
                const fitText = `${display}${suffix}`;
                const numberFontSize = resolveNewscastNumberFontPx({
                  basePx: baseNumberPx,
                  descriptionFontSize,
                  portraitScale,
                  text: fitText,
                  maxWidth: cardWidth - cardPadding * 2 - 10,
                  maxHeight: cardHeight - cardPadding * 2 - 44,
                  lineHeight: 1,
                  proportionalDamp: 0.68,
                  proportionalMin: 0.86,
                  proportionalMax: 1.2,
                  fitMin: 0.52,
                  fitMax: 1,
                  paddingX: 4,
                  paddingY: 2,
                });
                const baseScaledNumberPx = scaleNewscastPx(baseNumberPx, portraitScale);
                const staticScaleRatio = numberFontSize / Math.max(1, baseScaledNumberPx);
                const ringOpacity = primary ? 1 : 0.6;
                const flyInStart = idx * 4;
                const flyInY = interpolate(frame, [flyInStart, flyInStart + 14, flyInStart + 24], [120, -14, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const flyInX = interpolate(
                  frame,
                  [flyInStart, flyInStart + 14, flyInStart + 24],
                  [idx % 2 === 0 ? -54 : 54, 10, 0],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                );
                const flyInRotate = interpolate(frame, [flyInStart, flyInStart + 14, flyInStart + 24], [primary ? -15 : 12, -3, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const metricThunderWindow = interpolate(
                  frame,
                  [flyInStart + 12, flyInStart + 20, flyInStart + 36, flyInStart + 48],
                  [0, 1, 1, 0],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                );
                const metricThunderX = Math.sin(frame * (2.4 + idx * 0.4)) * (primary ? 3.8 : 2.4) * metricThunderWindow;
                const metricThunderY = Math.cos(frame * (2.9 + idx * 0.35)) * (primary ? 2.6 : 1.7) * metricThunderWindow;
                const metricThunderGlow = (0.14 + 0.22 * (0.5 + 0.5 * Math.sin(frame * (2.2 + idx * 0.25)))) * metricThunderWindow;
                const cardScaleCap =
                  staticScaleRatio < 0.98
                    ? Math.max(1, (1 / Math.max(staticScaleRatio, 0.52)) * 0.94)
                    : primary
                      ? 1.2
                      : 1.06;
                const metricCardScale = Math.min(primary ? primaryNumScale : 1 + metricThunderWindow * 0.03, cardScaleCap);
                const primaryValueScaleCap =
                  staticScaleRatio < 0.98 ? Math.max(1, (1 / Math.max(staticScaleRatio, 0.52)) * 0.92) : 1.2;
                const primaryValueScale = Math.min(primaryFocusBoost, primaryValueScaleCap);

                return (
                  <div
                    key={`${label}-${idx}`}
                    style={{
                      position: "relative",
                      flex: primary
                        ? isNarrow
                          ? "0 0 210px"
                          : "0 0 280px"
                        : isNarrow
                          ? "0 0 180px"
                          : "0 0 230px",
                      minHeight: isNarrow ? 190 : 210,
                      padding: isNarrow ? 18 : 22,
                      borderRadius: 14,
                      background: "rgba(10,42,110,0.22)",
                      border: "1px solid rgba(200,220,255,0.20)",
                      backdropFilter: "blur(8px)",
                      borderTop: primary ? `3px solid ${RED}` : `3px solid rgba(30,95,212,0.35)`,
                      transformStyle: "preserve-3d",
                      transform: `perspective(900px) translateX(${flyInX + metricThunderX}px) translateY(${(primary ? primaryDropY : 0) + flyInY + metricThunderY}px) rotateY(${zRotY * (primary ? 1 : 0.7)}deg) rotateX(${-zRotY * 0.5}deg) rotateZ(${flyInRotate}deg) translateZ(${zEnter * (primary ? 26 : 18)}px) scale(${metricCardScale})`,
                      overflow: "hidden",
                      boxShadow: primary
                        ? `0 0 ${28 + metricThunderWindow * 22}px rgba(232,32,32,${0.18 + metricThunderGlow})`
                        : `0 0 ${18 + metricThunderWindow * 14}px rgba(30,95,212,${0.12 + metricThunderGlow * 0.7})`,
                    }}
                  >
                    {primary ? (
                      <>
                        <div
                          aria-hidden
                          style={{
                            position: "absolute",
                            inset: -40,
                            borderRadius: "50%",
                            border: `1px solid rgba(232,32,32,0.18)`,
                            boxShadow: `0 0 30px rgba(232,32,32,0.18)`,
                            transform: `rotate(${frame * 2.2}deg)`,
                            opacity: ringOpacity,
                          }}
                        />
                        <div
                          aria-hidden
                          style={{
                            position: "absolute",
                            inset: -15,
                            borderRadius: "50%",
                            border: `1px dashed rgba(30,95,212,0.18)`,
                            transform: `rotate(${-frame * 3.0}deg)`,
                            opacity: ringOpacity * 0.9,
                          }}
                        />
                      </>
                    ) : null}

                    <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
                      <div
                        style={{
                          fontFamily: newscastFont(fontFamily, "title"),
                          fontSize: numberFontSize,
                          fontWeight: 700,
                          color: "white",
                          letterSpacing: 0.5,
                          textShadow: primary
                            ? `0 0 24px rgba(232,32,32,${primaryValueGlow}), 0 0 34px rgba(120,170,255,${primaryValueGlow * 0.35}), ${primaryCrackleX}px ${-primaryCrackleY}px 14px rgba(255,240,210,${primaryCrackleFlicker})`
                            : "0 0 16px rgba(30,95,212,0.25)",
                          lineHeight: 1,
                          transform: primary
                            ? `translate(${primaryCrackleX}px, ${primaryCrackleY}px) scale(${primaryValueScale})`
                            : undefined,
                          transformOrigin: "50% 55%",
                        }}
                      >
                        {display}
                        {suffix ? <span style={{ color: RED }}>{suffix}</span> : null}
                      </div>
                      <div
                        style={{
                          marginTop: 10,
                          fontFamily: newscastFont(fontFamily, "label"),
                          fontSize: scaleNewscastPx(isNarrow ? 12 : 13, portraitScale),
                          fontWeight: 600,
                          letterSpacing: 3,
                          color: STEEL,
                          textTransform: "uppercase",
                        }}
                      >
                        {label}
                      </div>
                      {primary ? (
                        <div
                          aria-hidden
                          style={{
                            margin: "14px auto 0",
                            width: 60,
                            height: 1,
                            background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
                            opacity: 0.7,
                          }}
                        />
                      ) : null}
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
                  fontSize: resolveNewscastDescriptionSize(descriptionFontSize, 13, portraitScale),
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
                        fontSize: resolveNewscastDescriptionSize(descriptionFontSize, 13, portraitScale),
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

