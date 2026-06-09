import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { EconomistLayoutProps, EconomistProsConsItem } from "../types";
import { ECONOMIST_COLORS } from "../constants";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../fonts/economist-defaults";

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
}
const ProsConsColumn: React.FC<ColumnProps> = ({
  label,
  color,
  items,
  startFrame,
  textColor,
  isPortrait,
}) => {
  const frame = useCurrentFrame();
  const headOp = interpolate(frame, [startFrame - 8, startFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const leadSize = isPortrait ? 24 : 24;
  const bodySize = isPortrait ? 27 : 26;
  const numSize = isPortrait ? 34 : 34;

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* ▶ LABEL */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: headOp,
          marginBottom: isPortrait ? 18 : 22,
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

      {items.map((it, i) => {
        const s = startFrame + 6 + i * 6;
        const op = interpolate(frame, [s, s + 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const ty = interpolate(frame, [s, s + 14], [10, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 14,
              marginBottom: isPortrait ? 16 : 18,
              opacity: op,
              transform: `translateY(${ty}px)`,
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

  const pad = isPortrait ? { x: 70, t: 64, b: 80 } : { x: 110, t: 70, b: 76 };
  const titleSize = (titleFontSize ?? (isPortrait ? 56 : 62)) as number;

  const headOp = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const introOp = interpolate(frame, [8, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ padding: `${pad.t}px ${pad.x}px ${pad.b}px` }}>
      {/* Title + rule. */}
      <div style={{ opacity: headOp, maxWidth: isPortrait ? "100%" : "70%" }}>
        <div
          style={{
            fontFamily: ECONOMIST_SERIF_FONT,
            fontWeight: 900,
            fontSize: titleSize,
            lineHeight: 1.04,
            letterSpacing: -titleSize * 0.012,
            color: textColor,
          }}
        >
          {title}
        </div>
      </div>
      <div style={{ height: 2, background: textColor, marginTop: 18, marginBottom: 18, opacity: headOp }} />

      {/* Intro paragraph. */}
      {intro && (
        <div
          style={{
            fontFamily: ECONOMIST_SERIF_FONT,
            fontSize: isPortrait ? 26 : 25,
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

      {/* Two columns. */}
      <div
        style={{
          display: "flex",
          flexDirection: isPortrait ? "column" : "row",
          gap: isPortrait ? 30 : 64,
        }}
      >
        <ProsConsColumn label={prosLabel} color={PROS_BLUE} items={pros} startFrame={12} textColor={textColor} isPortrait={isPortrait} />
        <ProsConsColumn label={consLabel} color={accentColor} items={cons} startFrame={isPortrait ? 12 + pros.length * 6 + 14 : 24} textColor={textColor} isPortrait={isPortrait} />
      </div>

    </AbsoluteFill>
  );
};
