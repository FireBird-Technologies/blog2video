import React from "react";
import { ECONOMIST_COLORS } from "../constants";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../../fonts/economist-defaults";
import { textRise } from "./chartHelpers";
import { ruleDraw } from "./motion";

/**
 * ExplainerBox — the post-animation takeaway panel shared by the chart/table
 * scenes. Once a chart's main animation has settled the layout squeezes the
 * plot up slightly (see panelSqueeze in motion.ts) and this panel rises into
 * the freed band: accent top rule, "THE TAKEAWAY" kicker with an optional
 * compact colour key, then a serif-italic sentence (LLM `explainer` prop or
 * the procedurally computed insight).
 */
export const ExplainerBox: React.FC<{
  frame: number;
  delay: number;
  left: number;
  bottom: number;
  width: number;
  text: string;
  keys?: Array<{ label: string; color: string }>;
  accentColor: string;
  fontSize: number;
  isPortrait: boolean;
  fontFamily?: string;
}> = ({ frame, delay, left, bottom, width, text, keys, accentColor, fontSize, isPortrait, fontFamily }) => {
  if (!text) return null;
  const kickerSize = Math.round(fontSize * 0.62);
  const keySize = Math.round(fontSize * 0.72);
  return (
    <div
      style={{
        position: "absolute",
        left,
        bottom,
        width,
        background: "rgba(246,244,238,0.96)",
        border: `1px solid ${ECONOMIST_COLORS.rule}`,
        padding: isPortrait ? "14px 16px" : "16px 20px",
        ...textRise(frame, delay, 22, 16),
      }}
    >
      {/* Accent top rule draws on across the full panel width. */}
      <div
        style={{
          position: "absolute",
          top: -1,
          left: -1,
          right: -1,
          height: 3,
          background: accentColor,
          ...ruleDraw(frame, delay + 2, 14),
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          columnGap: 16,
          rowGap: 5,
          ...textRise(frame, delay + 4, 14, 14),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 18, height: 4, background: accentColor }} />
          <span
            style={{
              fontFamily: fontFamily ?? ECONOMIST_SANS_FONT,
              fontWeight: 700,
              fontSize: kickerSize,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: ECONOMIST_COLORS.muted,
            }}
          >
            The takeaway
          </span>
        </div>
        {(keys ?? []).map((k, i) => (
          <div key={`ek-${i}`} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 15, height: 3.5, background: k.color, borderRadius: 1, flex: "0 0 auto" }} />
            <span
              style={{
                fontFamily: fontFamily ?? ECONOMIST_SANS_FONT,
                fontWeight: 700,
                fontSize: keySize,
                color: ECONOMIST_COLORS.ink,
              }}
            >
              {k.label}
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          fontFamily: fontFamily ?? ECONOMIST_SERIF_FONT,
          fontStyle: "italic",
          fontSize,
          lineHeight: 1.4,
          color: ECONOMIST_COLORS.ink,
          marginTop: 10,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          ...textRise(frame, delay + 10, 14, 14),
        }}
      >
        {text}
      </div>
    </div>
  );
};
