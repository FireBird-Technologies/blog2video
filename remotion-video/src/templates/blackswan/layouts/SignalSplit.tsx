import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { BlackswanLayoutProps } from "../types";
import { NeonWater } from "./neonWater";
import { neonTitleTubeStyle, StarField } from "./scenePrimitives";

// Righteous — same family as DropletIntro
const mono = "'Righteous', cursive";
const display = "'Righteous', cursive";

export const SignalSplit: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor = "#00E5FF",
    textColor = "#DFFFFF",
    leftLabel,
    rightLabel,
    leftDescription,
    rightDescription,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
    aspectRatio = "landscape",
  } = props;

  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";

  const titleOp  = interpolate(frame, [0, 20],  [0, 1], { extrapolateRight: "clamp" });
  const titleY   = interpolate(frame, [0, 20],  [12, 0], { extrapolateRight: "clamp" });
  const narOp    = interpolate(frame, [10, 28], [0, 1], { extrapolateRight: "clamp" });
  const narY     = interpolate(frame, [10, 28], [8, 0],  { extrapolateRight: "clamp" });
  const leftOp   = interpolate(frame, [18, 38], [0, 1], { extrapolateRight: "clamp" });
  const rightOp  = interpolate(frame, [26, 46], [0, 1], { extrapolateRight: "clamp" });

  // Font sizes — all driven by the two sliders
  const headingSize = titleFontSize     ? titleFontSize * 0.55     : (p ? 46 : 42);
  const eyebrowSize = titleFontSize     ? titleFontSize * 0.22     : (p ? 18 : 16);
  const descSize    = descriptionFontSize ?? (p ? 34 : 31);
  const narSize     = descriptionFontSize ?? (p ? 34 : 31);
  const titleSize   = titleFontSize ?? (p ? 91 : 81);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      <StarField />

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
        <h1
          style={{
            margin: 0,
            fontFamily: fontFamily ?? display,
            fontSize: titleSize,
            fontWeight: 400,
            ...neonTitleTubeStyle(accentColor),
            lineHeight: 1.1,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            textAlign: "center",
            opacity: titleOp,
            transform: `translateY(${titleY}px)`,
          }}
        >
          {title}
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
          <p
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
          alignItems: "center",
          justifyContent: "center",
          paddingTop: p ? "40%" : "28%", // Modified: adjust card position for portrait to be below the new title position
          paddingBottom: p ? "20%" : "18%",
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
              border: "1px solid #3366FF28",
              opacity: leftOp,
            }}
          >
            {/* Eyebrow */}
            <div
              style={{
                fontSize: eyebrowSize,
                letterSpacing: 5,
                color: "#4466FF",
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
                color: "#4466FF",
                letterSpacing: "0.02em",
                lineHeight: 1.2,
              }}
            >
              {leftLabel ?? "Manual"}
            </div>

            {/* Thin rule */}
            <div style={{ height: 1, width: 80, background: "#3366FF30" }} />

            {/* Description */}
            <p
              style={{
                margin: 0,
                fontSize: descSize,
                color: "#4466FFAA",
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
                background: "linear-gradient(to bottom, transparent, #00E5FF55, transparent)",
                margin: "32px 0",
              }}
            />
          )}
          {p && (
            <div
              style={{
                height: 1,
                background: "linear-gradient(to right, transparent, #00E5FF55, transparent)",
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
              border: "1px solid #00E5FF28",
              opacity: rightOp,
            }}
          >
            {/* Eyebrow */}
            <div
              style={{
                fontSize: eyebrowSize,
                letterSpacing: 5,
                color: "#00AAFF",
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
                boxShadow: `0 0 4px ${accentColor}, 0 0 8px #00AAFF88`,
              }}
            />

            {/* Description */}
            <p
              style={{
                margin: 0,
                fontSize: descSize,
                color: "#00AAFF",
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
