import React from "react";
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
  chapterBreakHeadlinePop,
  headlinePopStyle,
  headlineTextShadow,
  panelTumbleStyle,
  panelTumbleUpErupt,
} from "../newscastLayoutMotion";

const GOLD = "#D4AA50";
const STEEL_DARK = "#7A9AB8";

export const ChapterBreak: React.FC<NewscastLayoutProps> = ({
  chapterNumber = 2,
  chapterLabel,
  subtitle,
  title,
  narration,
  imageUrl,
  accentColor,
  textColor,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portraitScale = getNewscastPortraitTypeScale(width, height);
  const p = height > width;
  const numStr = String(chapterNumber).padStart(2, "0");
  const watermarkNum = resolveNewscastNumberFontPx({
    basePx: 230,
    descriptionFontSize,
    portraitScale,
    text: numStr,
    maxWidth: width * 0.56,
    maxHeight: height > width ? height * 0.22 : height * 0.3,
    lineHeight: 1,
    proportionalDamp: 0.7,
    proportionalMin: 0.86,
    proportionalMax: 1.18,
    fitMin: 0.58,
    fitMax: 1,
    paddingX: 10,
    paddingY: 6,
  });
  const opacity = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: "clamp" });
  const tumble = panelTumbleUpErupt(frame);
  const labelPop = chapterBreakHeadlinePop(frame, 0);
  const titlePop = chapterBreakHeadlinePop(frame, 8);
  const bgNumScale = interpolate(frame, [0, 14, 32], [0.88, 1.12, 1], { extrapolateRight: "clamp" });
  const numberPulse = interpolate(frame, [0, 6, 16, 28], [0.62, 1.42, 1.16, 1], {
    extrapolateRight: "clamp",
  });
  const portalRingScale = interpolate(frame, [0, 12, 26], [0.22, 1.08, 1], { extrapolateRight: "clamp" });
  const portalRingOpacity = interpolate(frame, [0, 8, 24], [0.88, 0.56, 0.2], { extrapolateRight: "clamp" });
  const portalSpin = interpolate(frame, [0, 26], [0, 1], { extrapolateRight: "clamp" });
  const labelOpacity = interpolate(frame, [24, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const beamScaleX = interpolate(frame, [30, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [36, 52], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [44, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const numberCrackle = interpolate(frame, [0, 3, 10, 18], [0.55, 0.36, 0.16, 0], { extrapolateRight: "clamp" });
  const numberShakeX = Math.sin(frame * 3.4) * interpolate(frame, [0, 4, 12], [8, 4, 0], { extrapolateRight: "clamp" });
  const focusVignette = interpolate(frame, [0, 10, 24], [0.45, 0.3, 0.16], { extrapolateRight: "clamp" });
  const scanBandOpacity = interpolate(frame, [0, 8, 22, 34], [0.56, 0.42, 0.12, 0], { extrapolateRight: "clamp" });
  const scanSweepX = interpolate(frame, [0, 20], [-120, 120], { extrapolateRight: "clamp" });
  const scanPulseOpacity = interpolate(frame, [14, 20, 28], [0, 0.12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const watermarkBasePx = scaleNewscastPx(230, portraitScale);
  const watermarkFitRatio = watermarkNum / Math.max(1, watermarkBasePx);
  const pulseCap =
    watermarkFitRatio < 0.98
      ? Math.max(1.02, (1 / Math.max(watermarkFitRatio, 0.58)) * 0.9)
      : height > width
        ? 1.28
        : 1.42;
  const safeNumberPulse = Math.min(numberPulse, pulseCap);
  const safeBgNumScale = Math.min(bgNumScale, height > width ? 1.08 : 1.12);
  const labelStr = chapterLabel ?? `CHAPTER TWO`;
  const subStr = subtitle ?? narration ?? "";
  const RED = accentColor || DEFAULT_NEWSCAST_ACCENT;
  const STEEL = textColor || DEFAULT_NEWSCAST_TEXT;

  return (
    <AbsoluteFill style={{ zIndex: 60, overflow: "hidden", opacity }}>
      <NewsCastLayoutImageBackground imageUrl={imageUrl} accentColor={RED} />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(to bottom, rgba(8,16,34,0.82) 0px, rgba(8,16,34,0.82) 13px, rgba(8,16,34,0.0) 13px, rgba(8,16,34,0.0) 26px)",
          opacity: scanBandOpacity,
          transform: `translateX(${scanSweepX}px)`,
          mixBlendMode: "multiply",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 52% 48%, rgba(255,255,255,0.52) 0%, rgba(190,220,255,0.22) 24%, rgba(10,20,44,0) 66%)",
          opacity: scanPulseOpacity,
          mixBlendMode: "screen",
          pointerEvents: "none",
          zIndex: 3,
        }}
      />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", zIndex: 1 }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "48%",
            fontFamily: newscastFont(fontFamily, "title"),
            fontSize: watermarkNum,
            fontWeight: 700,
            letterSpacing: -6,
            color: "rgba(255,255,255,0.16)",
            userSelect: "none",
            transform: `translate(-50%, -50%) translateX(${numberShakeX}px) scale(${safeBgNumScale * safeNumberPulse})`,
            textShadow: `0 0 90px rgba(232,32,32,${0.45 + numberCrackle * 0.35}), 0 0 46px rgba(180,220,255,${numberCrackle * 0.25})`,
          }}
        >
          {numStr}
        </div>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at 50% 50%, rgba(10,20,44,0) 0%, rgba(8,12,24,0.55) 52%, rgba(6,8,18,0.92) 100%)",
            opacity: focusVignette,
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 360,
            height: 2,
            background: `linear-gradient(90deg, transparent, rgba(255,255,255,${numberCrackle}), transparent)`,
            transform: `translate(-50%, -50%) rotate(${18 + frame * 1.2}deg)`,
            opacity: numberCrackle,
            mixBlendMode: "screen",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 360,
            height: 2,
            background: `linear-gradient(90deg, transparent, rgba(232,32,32,${numberCrackle}), transparent)`,
            transform: `translate(-50%, -50%) rotate(${-24 - frame * 1.5}deg)`,
            opacity: numberCrackle * 0.9,
            mixBlendMode: "screen",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            width: 360,
            height: 360,
            borderRadius: "50%",
            border: `1px solid rgba(212,170,80,${portalRingOpacity * 0.85})`,
            boxShadow: `0 0 40px rgba(232,32,32,${portalRingOpacity * 0.35})`,
            transform: `scale(${portalRingScale}) rotate(${portalSpin * 160}deg)`,
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            width: 300,
            height: 300,
            borderRadius: "50%",
            border: `1px dashed rgba(120,180,255,${portalRingOpacity})`,
            transform: `scale(${portalRingScale * 1.08}) rotate(${-portalSpin * 210}deg)`,
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            width: 420,
            height: 420,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(232,32,32,0.08) 25%, rgba(120,180,255,0.08) 42%, rgba(10,20,44,0) 68%)",
            opacity: portalRingOpacity * 0.85,
            transform: `scale(${portalRingScale * 0.94})`,
          }}
        />

        {/* Decorative corner frames */}
        <div aria-hidden style={{ position: "absolute", top: "15%", left: "8%", width: 40, height: 40, borderTop: "1px solid rgba(200,220,255,0.2)", borderLeft: "1px solid rgba(200,220,255,0.2)" }} />
        <div aria-hidden style={{ position: "absolute", top: "15%", right: "8%", width: 40, height: 40, borderTop: "1px solid rgba(200,220,255,0.2)", borderRight: "1px solid rgba(200,220,255,0.2)" }} />
        <div aria-hidden style={{ position: "absolute", bottom: "20%", left: "8%", width: 40, height: 40, borderBottom: "1px solid rgba(200,220,255,0.2)", borderLeft: "1px solid rgba(200,220,255,0.2)" }} />
        <div aria-hidden style={{ position: "absolute", bottom: "20%", right: "8%", width: 40, height: 40, borderBottom: "1px solid rgba(200,220,255,0.2)", borderRight: "1px solid rgba(200,220,255,0.2)" }} />

        <div
          style={{
            position: "relative",
            textAlign: "center",
            padding: "0 60px",
            ...panelTumbleStyle(tumble),
            opacity: tumble.opacity * opacity,
          }}
        >
          <div
            style={{
              fontFamily: newscastFont(fontFamily, "label"),
              fontSize: scaleNewscastPx(11, portraitScale),
              fontWeight: 600,
              letterSpacing: 8,
              color: STEEL_DARK,
              textTransform: "uppercase",
              marginBottom: 12,
              ...headlinePopStyle(labelPop),
              opacity: labelOpacity,
            }}
          >
            {labelStr}
          </div>
          <div
            style={{
              width: 160,
              height: 2,
              background: `linear-gradient(90deg, transparent, ${RED}, ${GOLD}, ${RED}, transparent)`,
              boxShadow: `0 0 16px rgba(232,32,32,0.55), 0 0 28px rgba(30,95,212,0.25)`,
              margin: "12px auto",
              transform: `scaleX(${beamScaleX})`,
              transformOrigin: "50% 50%",
            }}
          />
          <div
            style={{
              fontFamily: newscastFont(fontFamily, "title"),
              fontSize: titleFontSize ?? (p ? 47 : 36),
              fontWeight: HEADLINE_WEIGHT,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "white",
              marginTop: 12,
              textShadow: headlineTextShadow.strong,
              ...headlinePopStyle(titlePop),
              opacity: titleOpacity,
            }}
          >
            {title}
          </div>
          {subStr ? (
            <div
              style={{
                fontFamily: newscastFont(fontFamily, "body"),
                fontSize: descriptionFontSize ?? (p ? 18 : 14),
                fontWeight: 300,
                letterSpacing: 3,
                color: STEEL,
                textTransform: "uppercase",
                marginTop: 10,
                opacity: subOpacity,
              }}
            >
              {subStr}
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

