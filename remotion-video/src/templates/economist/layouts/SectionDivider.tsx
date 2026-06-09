import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS } from "../constants";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../fonts/economist-defaults";

/**
 * SectionDivider — a full-bleed chapter break. A small red square springs in
 * above double hairline rules, then a very large serif section name, an italic
 * standfirst, and a dateline pinned bottom-centre. Wrapped by minimal chrome.
 */
export const SectionDivider: React.FC<EconomistLayoutProps> = ({
  title,
  standfirst,
  narration,
  dateline,
  accentColor = ECONOMIST_COLORS.accent,
  textColor = ECONOMIST_COLORS.ink,
  titleFontSize,
  aspectRatio = "landscape",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";

  const nameSize = (titleFontSize ?? (isPortrait ? 120 : 156)) as number;
  const squareScale = spring({ frame: frame - 4, fps, config: { damping: 13, mass: 0.5 } });
  const ruleW = interpolate(frame, [8, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const nameOp = interpolate(frame, [16, 32], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const nameY = interpolate(frame, [16, 34], [18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sfOp = interpolate(frame, [30, 46], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const sub = standfirst || narration;
  const ruleWidth = isPortrait ? width * 0.62 : width * 0.46;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: `0 ${isPortrait ? 70 : 120}px` }}>
      <div style={{ width: 22, height: 22, background: accentColor, transform: `scale(${squareScale}) rotate(45deg)`, marginBottom: isPortrait ? 36 : 44 }} />

      <div style={{ width: ruleWidth, height: 1.5, background: ECONOMIST_COLORS.rule, transform: `scaleX(${ruleW})` }} />
      <div style={{ width: ruleWidth, height: 1.5, background: ECONOMIST_COLORS.rule, transform: `scaleX(${ruleW})`, marginTop: 6 }} />

      <div
        style={{
          fontFamily: ECONOMIST_SERIF_FONT,
          fontWeight: 900,
          fontSize: nameSize,
          lineHeight: 1.0,
          letterSpacing: -nameSize * 0.015,
          color: textColor,
          textAlign: "center",
          margin: `${isPortrait ? 30 : 36}px 0`,
          opacity: nameOp,
          transform: `translateY(${nameY}px)`,
        }}
      >
        {title}
      </div>

      <div style={{ width: ruleWidth, height: 1.5, background: ECONOMIST_COLORS.rule, transform: `scaleX(${ruleW})` }} />
      <div style={{ width: ruleWidth, height: 1.5, background: ECONOMIST_COLORS.rule, transform: `scaleX(${ruleW})`, marginTop: 6 }} />

      {sub && (
        <div
          style={{
            fontFamily: ECONOMIST_SERIF_FONT,
            fontStyle: "italic",
            fontSize: isPortrait ? 34 : 34,
            lineHeight: 1.4,
            color: ECONOMIST_COLORS.muted,
            textAlign: "center",
            maxWidth: isPortrait ? "100%" : "60%",
            marginTop: isPortrait ? 30 : 34,
            opacity: sfOp,
          }}
        >
          {sub}
        </div>
      )}

      {dateline && (
        <div
          style={{
            position: "absolute",
            bottom: isPortrait ? 80 : 70,
            fontFamily: ECONOMIST_SANS_FONT,
            fontWeight: 700,
            fontSize: isPortrait ? 18 : 17,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: ECONOMIST_COLORS.muted,
            opacity: sfOp,
          }}
        >
          {dateline}
        </div>
      )}
    </AbsoluteFill>
  );
};
