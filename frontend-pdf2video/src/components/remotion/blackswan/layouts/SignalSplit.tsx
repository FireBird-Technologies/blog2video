import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useFitText } from "../components/useFitText";
import type { BlackswanLayoutProps } from "../types";
import { NeonWater } from "./neonWater";
import { neonTitleTubeStyle, StarField } from "./scenePrimitives";
import { blackswanNeonPalette, rgbaFromHex } from "./blackswanAccent";

// Righteous — same family as DropletIntro
const mono = "'Righteous', cursive";
const display = "'Righteous', cursive";

export const SignalSplit: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor = "#00E5FF",
    bgColor = "#000000",
    textColor = "#DFFFFF",
    leftLabel,
    rightLabel,
    leftDescription,
    rightDescription,
    titleFontSize,
    descriptionFontSize,
    titleFontSizeIsUserSet,
    descriptionFontSizeIsUserSet,
    fontFamily,
    aspectRatio = "landscape",
  } = props;

  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const pal = useMemo(() => blackswanNeonPalette(accentColor), [accentColor]);
  const beforeBorder = rgbaFromHex(pal.deep, 0.16);
  const beforeRule = rgbaFromHex(pal.mid, 0.19);
  const beforeMuted = rgbaFromHex(pal.mid, 0.65);

  const titleOp  = interpolate(frame, [0, 20],  [0, 1], { extrapolateRight: "clamp" });
  const titleY   = interpolate(frame, [0, 20],  [12, 0], { extrapolateRight: "clamp" });
  const narOp    = interpolate(frame, [10, 28], [0, 1], { extrapolateRight: "clamp" });
  const narY     = interpolate(frame, [10, 28], [8, 0],  { extrapolateRight: "clamp" });
  const leftOp   = interpolate(frame, [18, 38], [0, 1], { extrapolateRight: "clamp" });
  const rightOp  = interpolate(frame, [26, 46], [0, 1], { extrapolateRight: "clamp" });

  // Font sizes — all driven by the two sliders
  const headingSize = titleFontSize     ? titleFontSize * 0.55     : (p ? 46 : 42);
  const eyebrowSize = titleFontSize     ? titleFontSize * 0.22     : (p ? 18 : 16);
  const descTarget = descriptionFontSize ?? (p ? 34 : 31);
  const titleTarget = titleFontSize ?? (p ? 91 : 81);

  // Format the title to capitalize the first letter of each word
  const formattedTitle = useMemo(() => {
    if (!title) return "";
    return title
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }, [title]);
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const narrationRef = React.useRef<HTMLParagraphElement>(null);
  const leftDescRef = React.useRef<HTMLParagraphElement>(null);
  const rightDescRef = React.useRef<HTMLParagraphElement>(null);
  const { px: titleSize } = useFitText(titleRef, titleTarget, titleFontSizeIsUserSet ? titleTarget : Math.max(15, Math.round(titleTarget * 0.32)), [formattedTitle, titleTarget, titleFontSizeIsUserSet, p, height], Math.round(height * (p ? 0.12 : 0.14)));
  const descMin = descriptionFontSizeIsUserSet ? descTarget : Math.max(9, Math.round(descTarget * 0.38));
  const { px: narSize } = useFitText(narrationRef, descTarget, descMin, [narration, descTarget, descMin, titleSize, p, height], Math.round(height * 0.11));
  const { px: leftDescSize } = useFitText(leftDescRef, descTarget, descMin, [leftDescription, descTarget, descMin, p, height], Math.round(height * (p ? 0.12 : 0.22)));
  const { px: rightDescSize } = useFitText(rightDescRef, descTarget, descMin, [rightDescription, descTarget, descMin, p, height], Math.round(height * (p ? 0.12 : 0.22)));


  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      <StarField accentColor={accentColor} />

      {/* ── NeonWater ─────────────────────────────────────────────────────── */}
      {/* Landscape: one below each card, no shade */}
      {!p && (
        <>
          <NeonWater
            uid="sL"
            cx={265}
            yPct={86}
            rxBase={130}
            ryBase={18}
            maxRx={230}
            nRings={4}
            delay={0.2}
            hideBg
            fadeEdges
            accentColor={accentColor}
          />
          <NeonWater
            uid="sR"
            cx={735}
            yPct={86}
            rxBase={130}
            ryBase={18}
            maxRx={230}
            nRings={4}
            delay={0.5}
            hideBg
            fadeEdges
            accentColor={accentColor}
          />
        </>
      )}
      {/* Portrait: single water at bottom */}
      {p && (
        <NeonWater
          uid="sP"
          cx={500}
          yPct={93}
          rxBase={160}
          ryBase={22}
          maxRx={300}
          nRings={5}
          delay={0.3}
          hideBg
          fadeEdges
          accentColor={accentColor}
        />
      )}

      {/* ── Title + Narration ─────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: p ? "24%" : "4%",
          paddingLeft: "6%",
          paddingRight: "6%",
          gap: p ? 14 : 18,
          zIndex: 2,
        }}
      >
        {/* Title */}
        <h1 ref={titleRef}
          style={{
            margin: 0,
            fontFamily: fontFamily ?? display,
            fontSize: titleSize,
            fontWeight: 400,
            ...neonTitleTubeStyle(accentColor, { bgColor }),
            lineHeight: 1.1,
            letterSpacing: "0.12em",
            // textTransform: "uppercase", // Removed, as formatting is handled by JS
            textAlign: "center",
            opacity: titleOp,
            transform: `translateY(${titleY}px)`,
          }}
        >
          {formattedTitle}
        </h1>

        {/* Accent line */}
        <div
          style={{
            height: 2,
            width: p ? 180 : 220,
            background: accentColor,
            boxShadow: `0 0 8px ${accentColor}, 0 0 18px ${accentColor}88`,
            opacity: titleOp,
            flexShrink: 0,
          }}
        />

        {/* Narration */}
        {narration && (
          <p ref={narrationRef}
            style={{
              margin: 0,
              fontFamily: fontFamily ?? display,
              fontSize: narSize,
              fontWeight: 400,
              color: textColor,
              lineHeight: 1.7,
              letterSpacing: "0.04em",
              textAlign: "center",
              maxWidth: p ? "90%" : "72%",
              opacity: narOp,
              transform: `translateY(${narY}px)`,
            }}
          >
            {narration}
          </p>
        )}
      </div>

      {/* ── Comparison Cards ──────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: p ? "center" : "flex-start",
          justifyContent: "center",
          boxSizing: "border-box",
          paddingTop: p ? "40%" : Math.round(height * 0.46),
          paddingBottom: p ? "20%" : Math.round(height * 0.03),
          paddingLeft: "4%",
          paddingRight: "4%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: p ? "column" : "row",
            alignItems: "stretch",
            width: "100%",
            maxWidth: p ? 680 : 1300, // Increased card width for landscape
            gap: 0,
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* BEFORE panel */}
          <div
            style={{
              flex: 1,
              padding: p ? "36px 32px" : "40px 36px", // Modified: increased card padding for portrait
              display: "flex",
              flexDirection: "column",
              gap: p ? 14 : 18,
              border: `1px solid ${beforeBorder}`,
              opacity: leftOp,
            }}
          >
            {/* Eyebrow */}
            <div
              style={{
                fontSize: eyebrowSize,
                letterSpacing: 5,
                color: pal.deep,
                textTransform: "uppercase",
                fontFamily: fontFamily ?? mono,
                fontWeight: 400,
              }}
            >
              {leftLabel ?? "Before"}
            </div>

            {/* Heading */}
            <div
              style={{
                fontFamily: fontFamily ?? display,
                fontSize: headingSize,
                fontWeight: 400,
                color: pal.mid,
                letterSpacing: "0.02em",
                lineHeight: 1.2,
              }}
            >
              {leftLabel ?? "Manual"}
            </div>

            {/* Thin rule */}
            <div style={{ height: 1, width: 80, background: beforeRule }} />

            {/* Description */}
            <p ref={leftDescRef}
              style={{
                margin: 0,
                fontSize: leftDescSize,
                color: beforeMuted,
                lineHeight: 1.7,
                fontFamily: fontFamily ?? mono,
                fontWeight: 400,
              }}
            >
              {leftDescription ?? ""}
            </p>
          </div>

          {/* Divider */}
          {!p && (
            <div
              style={{
                width: 1,
                background: `linear-gradient(to bottom, transparent, ${rgbaFromHex(accentColor, 0.33)}, transparent)`,
                margin: "32px 0",
              }}
            />
          )}
          {p && (
            <div
              style={{
                height: 1,
                background: `linear-gradient(to right, transparent, ${rgbaFromHex(accentColor, 0.33)}, transparent)`,
                margin: "0 32px",
              }}
            />
          )}

          {/* AFTER panel */}
          <div
            style={{
              flex: 1,
              padding: p ? "36px 32px" : "40px 36px", // Modified: increased card padding for portrait
              display: "flex",
              flexDirection: "column",
              gap: p ? 14 : 18,
              border: `1px solid ${rgbaFromHex(accentColor, 0.16)}`,
              opacity: rightOp,
            }}
          >
            {/* Eyebrow */}
            <div
              style={{
                fontSize: eyebrowSize,
                letterSpacing: 5,
                color: pal.mid,
                textTransform: "uppercase",
                fontFamily: fontFamily ?? mono,
                fontWeight: 400,
              }}
            >
              {rightLabel ?? "After"}
            </div>

            {/* Heading */}
            <div
              style={{
                fontFamily: fontFamily ?? display,
                fontSize: headingSize,
                fontWeight: 400,
                color: accentColor,
                letterSpacing: "0.02em",
                lineHeight: 1.2,
              }}
            >
              {rightLabel ?? "Automated"}
            </div>

            {/* Neon line */}
            <div
              style={{
                height: 1,
                width: 80,
                background: accentColor,
                boxShadow: `0 0 4px ${accentColor}, 0 0 8px ${rgbaFromHex(accentColor, 0.5)}`,
              }}
            />

            {/* Description */}
            <p ref={rightDescRef}
              style={{
                margin: 0,
                fontSize: rightDescSize,
                color: rgbaFromHex(accentColor, 0.68),
                lineHeight: 1.7,
                fontFamily: fontFamily ?? mono,
                fontWeight: 400,
              }}
            >
              {rightDescription ?? ""}
            </p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
