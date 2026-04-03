import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { NewscastLayoutProps } from "./types";
import { NewsCastLayoutImageBackground } from "../NewsCastLayoutImageBackground";
import {
  DEFAULT_NEWSCAST_ACCENT,
  DEFAULT_NEWSCAST_TEXT,
  getNewscastPortraitTypeScale,
  newscastFont,
  scaleNewscastPx,
  toRgba,
} from "../themeUtils";
import {
  HEADLINE_WEIGHT,
  headlinePop,
  headlinePopStyle,
  headlineTextShadowFor,
  panelTumbleStyle,
  panelTumbleUp,
} from "../newscastLayoutMotion";

const GOLD = "#D4AA50";

export const GlassCode: React.FC<NewscastLayoutProps> = ({
  title,
  codeLanguage = "javascript",
  codeLines = [],
  imageUrl,
  accentColor,
  textColor,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portraitScale = getNewscastPortraitTypeScale(width, height);
  const p = height > width;
  const t = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const impactY = interpolate(frame, [0, 6, 18], [-220, 16, 0], { extrapolateRight: "clamp" });
  const impactScale = interpolate(frame, [0, 6, 18], [1.22, 0.96, 1], { extrapolateRight: "clamp" });
  const blink = interpolate((frame % 30) / 30, [0, 0.5, 1], [1, 0.2, 1], { extrapolateRight: "clamp" });
  const tumble = panelTumbleUp(frame);
  const titlePop = headlinePop(frame, 2);

  const safeLines = useMemo(() => codeLines.slice(0, 12), [codeLines]);
  const revealed = Math.max(0, Math.min(safeLines.length, Math.floor((frame + 6) / 7)));
  const RED = accentColor || DEFAULT_NEWSCAST_ACCENT;
  const STEEL = textColor || DEFAULT_NEWSCAST_TEXT;
  const shadows = headlineTextShadowFor(RED);

  return (
    <AbsoluteFill style={{ zIndex: 60, overflow: "hidden", opacity: t }}>
      <NewsCastLayoutImageBackground imageUrl={imageUrl} accentColor={RED} />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%,-50%) translateY(${impactY}px) scale(${impactScale})`,
          width: "70%",
          maxWidth: 920,
        }}
      >
        <div
          style={{
            background: "rgba(10,42,110,0.25)",
            border: "1px solid rgba(200,220,255,0.25)",
            backdropFilter: "blur(8px)",
            borderRadius: 12,
            overflow: "hidden",
            ...panelTumbleStyle(tumble),
            opacity: tumble.opacity * t,
          }}
        >
        {title ? (
          <div
            style={{
              padding: "12px 18px 0",
              fontFamily: newscastFont(fontFamily, "title"),
              fontWeight: HEADLINE_WEIGHT,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "white",
              textShadow: shadows.light,
              fontSize: titleFontSize ?? (p ? 23 : 18),
              ...headlinePopStyle(titlePop),
            }}
          >
            {title}
          </div>
        ) : null}
        {/* Terminal header */}
        <div
          style={{
            height: 44,
            background: "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
            borderBottom: `1px solid rgba(200,220,255,0.15)`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 16px",
          }}
        >
          {/* traffic lights */}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF5F57" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFBD2E" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28C840" }} />
          </div>
          <div
            style={{
              fontFamily: newscastFont(fontFamily, "label"),
              fontSize: scaleNewscastPx(12, portraitScale),
              letterSpacing: 3,
              color: STEEL,
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {codeLanguage}
          </div>
        </div>

        <div style={{ padding: "16px 18px 18px" }}>
          <div style={{ fontFamily: newscastFont(fontFamily, "mono"), fontSize: scaleNewscastPx(14, portraitScale), lineHeight: 1.65 }}>
            {safeLines.map((line, idx) => {
              const isVisible = idx < revealed;
              const faded = !isVisible ? 0 : 1;
              return (
                <div key={idx} style={{ display: "flex", gap: 12, opacity: faded }}>
                  <div style={{ width: 30, textAlign: "right", color: toRgba(RED, 0.75), fontWeight: 700 }}>
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <div
                    style={{
                      color: /[0-9]/.test(line ?? "") ? "rgba(255,232,160,0.96)" : "rgba(232,238,248,0.92)",
                      fontSize: descriptionFontSize ?? (p ? 18 : 14),
                    }}
                  >
                    {line || " "}
                  </div>
                </div>
              );
            })}
            {/* blinking cursor */}
            <div style={{ marginTop: 6, opacity: blink, color: GOLD }}>
              {" "}
              {revealed < safeLines.length ? " " : ""}
              ▍
            </div>
          </div>
        </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

