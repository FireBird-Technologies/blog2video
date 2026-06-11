import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { EconomistLayoutProps, EconomistProsConsItem } from "../types";
import { ECONOMIST_COLORS, CHROME_INSET } from "../constants";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../fonts/economist-defaults";
import {
  baselineSettle,
  clamp01,
  letterpressStamp,
  redactionReveal,
  ruleDraw,
  slideFrom,
} from "./motion";

/**
 * ProsCons — the signature debate page (← prosandcons.jpeg).
 * Two columns: ▶ PROS (Economist blue) / ▶ CONS (Economist red), each a numbered
 * coloured square + a bold uppercase lead-in + a serif explanation. Title +
 * justified intro on top.
 * Left column reveals first, then the right.
 */
const PROS_BLUE = ECONOMIST_COLORS.blue;

interface ColumnProps {
  label: string;
  color: string;
  items: EconomistProsConsItem[];
  startFrame: number;
  textColor: string;
  isPortrait: boolean;
  /** Which edge the column's items slide in from: -1 = left, 1 = right. */
  slideSign: 1 | -1;
}
const ProsConsColumn: React.FC<ColumnProps> = ({
  label,
  color,
  items,
  startFrame,
  textColor,
  isPortrait,
  slideSign,
}) => {
  const frame = useCurrentFrame();
  const headReveal = redactionReveal(frame, Math.max(0, startFrame - 8), 14);
  const leadSize = isPortrait ? 32 : 25;
  const bodySize = isPortrait ? 36 : 28;
  const numSize = isPortrait ? 42 : 34;

  return (
    <div style={{ flex: isPortrait ? "0 0 auto" : 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      {/* ▶ LABEL — uncovered by a sweeping bar in the column colour. */}
      <div style={{ position: "relative", display: "inline-block", alignSelf: "flex-start", marginBottom: isPortrait ? 18 : 22 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            clipPath: headReveal.clipPath,
          }}
        >
          <span style={{ color, fontSize: numSize, lineHeight: 1 }}>▶</span>
          <span
            style={{
              fontFamily: ECONOMIST_SANS_FONT,
              fontWeight: 800,
              fontSize: numSize,
              letterSpacing: 1,
              color,
              textTransform: "uppercase",
            }}
          >
            {label}
          </span>
        </div>
        <span
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${headReveal.barLeftPct.toFixed(2)}%`,
            width: `${headReveal.barWidthPct}%`,
            background: color,
            opacity: headReveal.barOpacity,
          }}
        />
      </div>

      {items.map((it, i) => {
        const s = startFrame + 6 + i * 6;
        const row = slideFrom(frame, s, slideSign * 30);
        const stamp = letterpressStamp(frame, s, 12, 1.45);
        const rot = -6 * (1 - clamp01((frame - s) / 12));
        return (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 14,
              marginBottom: isPortrait ? 16 : 18,
              opacity: row.opacity,
              transform: row.transform,
            }}
          >
            <div
              style={{
                flexShrink: 0,
                width: numSize,
                height: numSize,
                background: color,
                color: "#fff",
                fontFamily: ECONOMIST_SANS_FONT,
                fontWeight: 700,
                fontSize: numSize * 0.56,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 3,
                opacity: stamp.opacity,
                transform: `${stamp.transform} rotate(${rot.toFixed(2)}deg)`,
                filter: stamp.filter,
              }}
            >
              {i + 1}
            </div>
            <div
              style={{
                fontFamily: ECONOMIST_SERIF_FONT,
                fontSize: bodySize,
                lineHeight: 1.4,
                color: textColor,
              }}
            >
              <span
                style={{
                  fontFamily: ECONOMIST_SANS_FONT,
                  fontWeight: 700,
                  fontSize: leadSize,
                  letterSpacing: 0.3,
                  textTransform: "uppercase",
                  color: textColor,
                  marginRight: 8,
                }}
              >
                {it.lead}
              </span>
              {it.body}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const ProsCons: React.FC<EconomistLayoutProps> = ({
  title,
  intro,
  pros = [],
  cons = [],
  prosLabel = "PROS",
  consLabel = "CONS",
  accentColor = ECONOMIST_COLORS.accent,
  textColor = ECONOMIST_COLORS.ink,
  titleFontSize,
  aspectRatio = "landscape",
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";

  const topInset = (isPortrait ? CHROME_INSET.topPortrait : CHROME_INSET.top) + 24;
  const botInset = (isPortrait ? CHROME_INSET.bottomPortrait : CHROME_INSET.bottom) + 22;
  const pad = isPortrait ? { x: 70, t: topInset, b: botInset } : { x: 88, t: topInset, b: botInset };
  const titleSize = (titleFontSize ?? (isPortrait ? 66 : 62)) as number;

  const headOp = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const introOp = interpolate(frame, [8, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ padding: `${pad.t}px ${pad.x}px ${pad.b}px`, display: "flex", flexDirection: "column" }}>
      {/* Title + rule — title rises in. */}
      <div style={{ maxWidth: isPortrait ? "100%" : "82%" }}>
        <div
          style={{
            fontFamily: ECONOMIST_SERIF_FONT,
            fontWeight: 900,
            fontSize: titleSize,
            lineHeight: 1.04,
            letterSpacing: -titleSize * 0.012,
            color: textColor,
            ...baselineSettle(frame, 2),
          }}
        >
          {title}
        </div>
      </div>
      <div style={{ height: 2, background: textColor, marginTop: 18, marginBottom: 18, opacity: headOp, ...ruleDraw(frame, 10, 16) }} />

      {/* Intro paragraph. */}
      {intro && (
        <div
          style={{
            fontFamily: ECONOMIST_SERIF_FONT,
            fontSize: isPortrait ? 32 : 25,
            lineHeight: 1.5,
            color: ECONOMIST_COLORS.muted,
            textAlign: "justify",
            marginBottom: isPortrait ? 26 : 32,
            opacity: introOp,
          }}
        >
          {intro}
        </div>
      )}

      {/* Two columns — fill the body so short lists spread down the page. */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: isPortrait ? "column" : "row",
          justifyContent: isPortrait ? "center" : "flex-start",
          gap: isPortrait ? 48 : 72,
        }}
      >
        <ProsConsColumn label={prosLabel} color={PROS_BLUE} items={pros} startFrame={12} textColor={textColor} isPortrait={isPortrait} slideSign={-1} />
        <ProsConsColumn label={consLabel} color={accentColor} items={cons} startFrame={isPortrait ? 12 + pros.length * 6 + 14 : 24} textColor={textColor} isPortrait={isPortrait} slideSign={isPortrait ? -1 : 1} />
      </div>

    </AbsoluteFill>
  );
};
