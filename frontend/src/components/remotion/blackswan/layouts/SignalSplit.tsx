import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { BlackswanLayoutProps } from "../types";
import { NeonWater } from "./neonWater";

const mono = "'IBM Plex Mono', monospace";
const display = "'Syne', sans-serif";

export const SignalSplit: React.FC<BlackswanLayoutProps> = (props) => {
  const {
    title,
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

  const leftOp   = interpolate(frame, [5, 30], [0, 1], { extrapolateRight: "clamp" });
  const rightOp  = interpolate(frame, [15, 40], [0, 1], { extrapolateRight: "clamp" });

  const panelW = p ? "100%" : 360;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      {/* Two water sources — left cx:220, right cx:780 — matches HTML exactly */}
      {!p && (
        <NeonWater
          uid="sL"
          cx={220}
          yPct={84}
          rxBase={120}
          ryBase={18}
          maxRx={220}
          nRings={3}
          delay={0.2}
        />
      )}
      <NeonWater
        uid="sR"
        cx={p ? 500 : 780}
        yPct={p ? 89 : 84}
        rxBase={120}
        ryBase={18}
        maxRx={220}
        nRings={3}
        delay={0.5}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "8% 6%" : "0",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: p ? "column" : "row",
            alignItems: "stretch",
            gap: 0,
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* BEFORE panel */}
          <div
            style={{
              width: panelW,
              padding: p ? "28px 22px" : "44px 36px",
              display: "flex",
              flexDirection: "column",
              gap: p ? 12 : 16,
              border: "1px solid #3366FF18",
              opacity: leftOp,
            }}
          >
            {/* Eyebrow */}
            <div
              style={{
                fontSize: p ? 8 : 9,
                letterSpacing: 6,
                color: "#4466FF",
                textTransform: "uppercase",
                fontFamily: fontFamily ?? mono,
              }}
            >
              {leftLabel ?? "Before"}
            </div>

            {/* Label heading */}
            <div
              style={{
                fontFamily: fontFamily ?? display,
                fontSize: titleFontSize ?? (p ? 22 : 28),
                fontWeight: 700,
                color: "#4466FF",
              }}
            >
              {leftLabel ?? "Manual"}
            </div>

            {/* Thin rule */}
            <div style={{ height: 1, width: 80, background: "#3366FF28" }} />

            {/* Description */}
            <p
              style={{
                margin: 0,
                fontSize: descriptionFontSize ?? (p ? 12 : 13),
                color: "#4466FF55",
                lineHeight: 1.7,
                fontFamily: fontFamily ?? mono,
              }}
            >
              {leftDescription ?? ""}
            </p>
          </div>

          {/* Gradient divider — matches HTML linear-gradient divider */}
          {!p && (
            <div
              style={{
                width: 1,
                background: "linear-gradient(to bottom, transparent, #00E5FF, transparent)",
                margin: "40px 0",
                opacity: 0.35,
              }}
            />
          )}
          {p && (
            <div
              style={{
                height: 1,
                background: "linear-gradient(to right, transparent, #00E5FF, transparent)",
                margin: "0 40px",
                opacity: 0.35,
              }}
            />
          )}

          {/* AFTER panel */}
          <div
            style={{
              width: panelW,
              padding: p ? "28px 22px" : "44px 36px",
              display: "flex",
              flexDirection: "column",
              gap: p ? 12 : 16,
              border: "1px solid #00E5FF18",
              opacity: rightOp,
            }}
          >
            {/* Eyebrow */}
            <div
              style={{
                fontSize: p ? 8 : 9,
                letterSpacing: 6,
                color: "#00AAFF",
                textTransform: "uppercase",
                fontFamily: fontFamily ?? mono,
              }}
            >
              {rightLabel ?? "After"}
            </div>

            {/* Label heading */}
            <div
              style={{
                fontFamily: fontFamily ?? display,
                fontSize: titleFontSize ?? (p ? 22 : 28),
                fontWeight: 700,
                color: accentColor,
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
                boxShadow: `0 0 2px ${accentColor}, 0 0 5px #00AAFF`,
              }}
            />

            {/* Description */}
            <p
              style={{
                margin: 0,
                fontSize: descriptionFontSize ?? (p ? 12 : 13),
                color: "#00AAFF",
                lineHeight: 1.7,
                fontFamily: fontFamily ?? mono,
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