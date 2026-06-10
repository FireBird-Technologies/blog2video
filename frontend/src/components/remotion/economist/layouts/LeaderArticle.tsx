import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Img } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS, CHROME_INSET } from "../constants";
import { SectionKicker } from "../components/HairlineRule";
import { EditorialDivider } from "../components/EconomistOrnaments";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../../fonts/economist-defaults";
import { clamp01, letterpressStamp, redactionReveal, ruleDraw } from "./motion";

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
  const { fps, width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";
  const hasImage = Boolean(imageUrl);

  const topInset = (isPortrait ? CHROME_INSET.topPortrait : CHROME_INSET.top) + 24;
  const botInset = (isPortrait ? CHROME_INSET.bottomPortrait : CHROME_INSET.bottom) + 22;
  const pad = isPortrait ? { x: 72, t: topInset, b: botInset } : { x: 100, t: topInset, b: botInset };
  const titleSize = (titleFontSize ?? (isPortrait ? 68 : 82)) as number;
  const bodySize = (descriptionFontSize ?? (isPortrait ? 32 : 30)) as number;

  const body = (narration || "").trim();
  const dropCap = (illuminatedLetter || body.charAt(0) || "").toUpperCase();
  const rest = body.slice(1);

  const kickerReveal = redactionReveal(frame, 0, 14);
  const titleOp = interpolate(frame, [6, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Spring-based headline rise for a more editorial, weighty entrance — the ink
  // "dries" (blur decays) as it settles.
  const titleSpring = spring({ frame: frame - 6, fps, config: { damping: 16, mass: 0.7 } });
  const titleY = interpolate(titleSpring, [0, 1], [26, 0]);
  const titleBlur = 4 * (1 - clamp01((frame - 6) / 18));
  const bodyOp = interpolate(frame, [20, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const imgClip = interpolate(frame, [14, 38], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const kbScale = interpolate(frame, [0, 240], [1.04, 1.12], { extrapolateRight: "clamp" }) * imageZoom;
  // Inset image develops from newsprint duotone to full colour.
  const duoT = clamp01((frame - 14) / 50);
  const imgFilter = `grayscale(${(1 - duoT).toFixed(3)}) contrast(${(1.08 - 0.08 * duoT).toFixed(3)})`;
  // Drop cap pressed into the page, its press-shadow lifting as the ink dries.
  const capStamp = letterpressStamp(frame, 18, 16, 1.6);
  const capShadowA = 0.25 * (1 - clamp01((frame - 18) / 16));

  // Landscape, no image → a classic full-width leader opener: headline band on
  // top, body flowing in two columns beneath. Stack when portrait or when an
  // inset image takes the right half.
  const splitOpener = !isPortrait && !hasImage;
  // Two columns once there's enough copy to balance them; one otherwise.
  const bodyCols = splitOpener && body.length > 240 ? 2 : 1;

  const header = (
    <>
      <div style={{ position: "relative", marginBottom: 26 }}>
        <SectionKicker label={sectionLabel} accentColor={accentColor} fontSize={isPortrait ? 20 : 19} withRule style={{ clipPath: kickerReveal.clipPath }} />
        <span
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${kickerReveal.barLeftPct.toFixed(2)}%`,
            width: `${kickerReveal.barWidthPct}%`,
            background: accentColor,
            opacity: kickerReveal.barOpacity,
          }}
        />
      </div>
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
          filter: titleBlur > 0.01 ? `blur(${titleBlur.toFixed(2)}px)` : "none",
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
        columnCount: bodyCols,
        columnGap: 56,
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
            display: "inline-block",
            opacity: capStamp.opacity,
            transform: capStamp.transform,
            transformOrigin: "left top",
            filter: [
              capStamp.filter !== "none" ? capStamp.filter : "",
              capShadowA > 0.005 ? `drop-shadow(0 4px 8px rgba(0,0,0,${capShadowA.toFixed(3)}))` : "",
            ]
              .filter(Boolean)
              .join(" ") || "none",
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
        // Full-width leader opener: headline band on top, two-column body beneath.
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {header}
          {/* Full-width rule draws across under the headline band. */}
          <div style={{ height: 2, background: textColor, opacity: titleOp, margin: "30px 0 32px", ...ruleDraw(frame, 18, 18) }} />
          <div style={{ flex: 1 }}>{bodyEl}</div>
          {/* Closing engraved end-mark (SVG). */}
          <div style={{ marginTop: 24, opacity: bodyOp }}>
            <EditorialDivider width={220} progress={bodyOp} accentColor={accentColor} height={16} />
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
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: imageObjectPosition, transform: `scale(${kbScale})`, filter: imgFilter }}
              />
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
