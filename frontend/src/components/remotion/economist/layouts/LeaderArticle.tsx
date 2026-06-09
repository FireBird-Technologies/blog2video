import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Img } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS } from "../constants";
import { SectionKicker } from "../components/HairlineRule";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../../fonts/economist-defaults";

/**
 * LeaderArticle — the workhorse article page. Section kicker on a rule, a bold
 * serif headline, a drop-cap justified body, an optional byline, and an optional
 * inset image on the right (landscape). Long bodies flow into two columns when
 * there's no image.
 */
export const LeaderArticle: React.FC<EconomistLayoutProps> = ({
  title,
  narration,
  sectionLabel = "BRIEFING",
  byline,
  illuminatedLetter,
  imageUrl,
  imageObjectPosition = "50% 50%",
  imageZoom = 1,
  accentColor = ECONOMIST_COLORS.accent,
  textColor = ECONOMIST_COLORS.ink,
  titleFontSize,
  descriptionFontSize,
  aspectRatio = "landscape",
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";
  const hasImage = Boolean(imageUrl);

  const pad = isPortrait ? { x: 72, t: 72, b: 88 } : { x: 128, t: 84, b: 84 };
  const titleSize = (titleFontSize ?? (isPortrait ? 68 : 82)) as number;
  const bodySize = (descriptionFontSize ?? (isPortrait ? 32 : 30)) as number;

  const body = (narration || "").trim();
  const dropCap = (illuminatedLetter || body.charAt(0) || "").toUpperCase();
  const rest = body.slice(1);
  // Flow longer bodies into two columns (landscape, no inset image) so elongated
  // article text fills the page instead of running off the bottom.
  const twoCol = !isPortrait && !hasImage && body.length > 440;

  const kickerOp = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [6, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [6, 24], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bodyOp = interpolate(frame, [20, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const imgClip = interpolate(frame, [14, 38], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const kbScale = interpolate(frame, [0, 240], [1.04, 1.12], { extrapolateRight: "clamp" }) * imageZoom;

  // Split into a headline zone + body zone in landscape (no image); stack when
  // portrait or when an inset image takes the right half. The split fills the
  // frame so short copy never leaves a dead band at the top.
  const splitOpener = !isPortrait && !hasImage;

  const header = (
    <>
      <SectionKicker label={sectionLabel} accentColor={accentColor} fontSize={isPortrait ? 20 : 19} withRule style={{ opacity: kickerOp, marginBottom: 26 }} />
      <div
        style={{
          fontFamily: ECONOMIST_SERIF_FONT,
          fontWeight: 900,
          fontSize: titleSize,
          lineHeight: 1.04,
          letterSpacing: -titleSize * 0.012,
          color: textColor,
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
          marginBottom: byline ? 16 : 0,
        }}
      >
        {title}
      </div>
      {byline && (
        <div style={{ fontFamily: ECONOMIST_SANS_FONT, fontWeight: 700, fontSize: isPortrait ? 19 : 18, letterSpacing: 1.2, textTransform: "uppercase", color: ECONOMIST_COLORS.muted, opacity: titleOp }}>
          {byline}
        </div>
      )}
    </>
  );

  const bodyEl = (
    <div
      style={{
        fontFamily: ECONOMIST_SERIF_FONT,
        fontSize: bodySize,
        lineHeight: 1.6,
        color: textColor,
        textAlign: "justify",
        opacity: bodyOp,
        columnCount: !splitOpener && twoCol ? 2 : 1,
        columnGap: 48,
      }}
    >
      {dropCap && (
        <span
          style={{
            float: "left",
            fontFamily: ECONOMIST_SERIF_FONT,
            fontWeight: 900,
            fontSize: bodySize * 3.2,
            lineHeight: 0.82,
            padding: "6px 14px 0 0",
            color: accentColor,
          }}
        >
          {dropCap}
        </span>
      )}
      {rest}
    </div>
  );

  return (
    <AbsoluteFill style={{ padding: `${pad.t}px ${pad.x}px ${pad.b}px` }}>
      {splitOpener ? (
        // Magazine opener: headline left, body right, divided by a rule.
        <div style={{ display: "flex", height: "100%", alignItems: "stretch" }}>
          <div style={{ flex: 1.08, display: "flex", flexDirection: "column", justifyContent: "center", paddingRight: 60 }}>
            {header}
          </div>
          <div style={{ width: 1, background: ECONOMIST_COLORS.rule, margin: "8px 0" }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 60 }}>
            {bodyEl}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: isPortrait ? 0 : 56, height: "100%", alignItems: "stretch" }}>
          <div style={{ width: isPortrait ? "100%" : "58%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {header}
            <div style={{ marginTop: 28 }}>{bodyEl}</div>
          </div>
          {hasImage && !isPortrait && (
            <div style={{ width: "42%", alignSelf: "stretch", overflow: "hidden", clipPath: `inset(0 ${100 - imgClip}% 0 0)` }}>
              <Img
                src={imageUrl as string}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: imageObjectPosition, transform: `scale(${kbScale})` }}
              />
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
