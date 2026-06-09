import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS, CHROME_INSET } from "../constants";
import { ECONOMIST_SERIF_FONT } from "../../../../fonts/economist-defaults";
import { EditorialDivider, EngravingTexture } from "../components/EconomistOrnaments";

/**
 * SectionDivider — a full-bleed chapter break. A small red square springs in
 * above double hairline rules, then a very large serif section name and an
 * italic standfirst. The block is anchored in the upper third (not floated dead
 * centre) and boxed by two faint vertical rules so it fills the spread. The
 * running dateline is supplied by the shared chrome footer strip.
 */
export const SectionDivider: React.FC<EconomistLayoutProps> = ({
  title,
  standfirst,
  narration,
  accentColor = ECONOMIST_COLORS.accent,
  textColor = ECONOMIST_COLORS.ink,
  titleFontSize,
  aspectRatio = "landscape",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";

  const nameSize = (titleFontSize ?? (isPortrait ? 140 : 184)) as number;
  const squareScale = spring({ frame: frame - 4, fps, config: { damping: 13, mass: 0.5 } });
  const ruleW = interpolate(frame, [8, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const nameOp = interpolate(frame, [16, 32], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const nameY = interpolate(frame, [16, 34], [18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sfOp = interpolate(frame, [30, 46], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sideY = interpolate(frame, [12, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const sub = standfirst || narration;
  const ruleWidth = isPortrait ? width * 0.72 : width * 0.58;
  const sidePad = isPortrait ? 70 : 120;

  // Clear the chrome strips; anchor the block in the upper third instead of
  // floating it dead-centre in a sea of paper.
  const topInset = (isPortrait ? CHROME_INSET.topPortrait : CHROME_INSET.top) + 24;
  const botInset = (isPortrait ? CHROME_INSET.bottomPortrait : CHROME_INSET.bottom) + 22;
  // Anchor the block high under the masthead strip rather than floating it low.
  const paddingTop = topInset + (isPortrait ? 40 : 28);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", padding: `${paddingTop}px ${sidePad}px ${botInset}px` }}>
      {/* Faint engraved hairline field fills the wide empty paper behind the name. */}
      <EngravingTexture opacity={0.035} gap={10} />

      {/* Two faint vertical rules box the chapter break like a real spread. */}
      {[sidePad, width - sidePad].map((x, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: topInset,
            bottom: botInset,
            left: x,
            width: 1,
            background: ECONOMIST_COLORS.rule,
            transform: `scaleY(${sideY})`,
            transformOrigin: "top center",
          }}
        />
      ))}

      <div style={{ width: 22, height: 22, background: accentColor, transform: `scale(${squareScale}) rotate(45deg)`, marginBottom: isPortrait ? 36 : 44 }} />

      {/* Engraved centre-diamond divider (SVG) above the section name. */}
      <EditorialDivider width={ruleWidth} progress={ruleW} accentColor={accentColor} height={16} />

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

      {/* Engraved centre-diamond divider (SVG) below the section name. */}
      <EditorialDivider width={ruleWidth} progress={ruleW} accentColor={accentColor} height={16} />

      {sub && (
        <div
          style={{
            fontFamily: ECONOMIST_SERIF_FONT,
            fontStyle: "italic",
            fontSize: 34,
            lineHeight: 1.45,
            color: ECONOMIST_COLORS.muted,
            textAlign: "center",
            maxWidth: isPortrait ? "100%" : "78%",
            marginTop: isPortrait ? 26 : 28,
            opacity: sfOp,
          }}
        >
          {sub}
        </div>
      )}
    </AbsoluteFill>
  );
};
