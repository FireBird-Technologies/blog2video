import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Img } from "remotion";
import type { NewscastLayoutProps } from "./types";
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
  headlineTextShadow,
  panelTumbleStyle,
  panelTumbleUp,
} from "../newscastLayoutMotion";

const GOLD = "#D4AA50";

export const GlassImage: React.FC<NewscastLayoutProps> = ({
  imageUrl,
  title,
  narration,
  category,
  accentColor,
  textColor,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const portraitScale = getNewscastPortraitTypeScale(width, height);
  const p = height > width;

  const zoom = interpolate(frame, [0, fps * 8], [1, 1.05], { extrapolateRight: "clamp" });
  const yShift = interpolate(frame, [0, fps * 8], [0, -8], { extrapolateRight: "clamp" });
  const wipeA = interpolate(frame, [0, 16], [100, 0], { extrapolateRight: "clamp" });
  const wipeB = interpolate(frame, [4, 20], [100, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const wipeC = interpolate(frame, [8, 24], [100, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const cat = category ?? "WORLD AFFAIRS";
  const tumble = panelTumbleUp(frame, 4);
  const titlePop = headlinePop(frame, 8);
  const RED = accentColor || DEFAULT_NEWSCAST_ACCENT;
  const STEEL = textColor || DEFAULT_NEWSCAST_TEXT;

  return (
    <AbsoluteFill style={{ zIndex: 60, overflow: "hidden" }}>
      {imageUrl ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${zoom}) translateY(${yShift}px)`,
            transformOrigin: "center center",
          }}
        >
          <Img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(6,6,20,0.35) 0%, rgba(6,6,20,0.65) 55%, rgba(6,6,20,0.95) 100%)",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(ellipse at center, ${toRgba(RED, 0.18)} 0%, transparent 60%)`,
              opacity: 0.9,
            }}
          />
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%,-50%)",
          width: "66%",
          maxWidth: 860,
        }}
      >
        <div
          style={{
            background: "rgba(10,42,110,0.35)",
            border: "1px solid rgba(200,220,255,0.25)",
            backdropFilter: "blur(8px)",
            borderTop: `2px solid ${RED}`,
            borderLeft: `4px solid ${RED}`,
            borderRadius: 12,
            padding: "16px 18px 18px",
            boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
            ...panelTumbleStyle(tumble),
            opacity: tumble.opacity,
            position: "relative",
          }}
        >
        <div
          style={{
            fontFamily: newscastFont(fontFamily, "title"),
            fontSize: scaleNewscastPx(10, portraitScale),
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: GOLD,
            marginBottom: 4,
          }}
        >
          {cat}
        </div>
        <div
          style={{
            fontFamily: newscastFont(fontFamily, "title"),
            fontSize: titleFontSize ?? (p ? 34 : 26),
            fontWeight: HEADLINE_WEIGHT,
            color: "white",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            lineHeight: 1.1,
            marginBottom: 6,
            textShadow: headlineTextShadow.light,
            ...headlinePopStyle(titlePop),
          }}
        >
          {title}
        </div>
        {narration ? (
          <div
            style={{
              fontFamily: newscastFont(fontFamily, "body"),
              fontSize: descriptionFontSize ?? (p ? 19 : 15),
              fontWeight: 400,
              color: STEEL,
              letterSpacing: 0.3,
              lineHeight: 1.45,
            }}
          >
            {narration}
          </div>
        ) : null}
        </div>
      </div>
      <div aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${wipeA}%`, background: "rgba(4,8,18,0.72)" }} />
      <div aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: `${100 - wipeB}%`, width: `${wipeB}%`, background: "rgba(6,14,30,0.62)" }} />
      <div aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: `${100 - wipeC}%`, width: `${wipeC}%`, background: "rgba(8,18,38,0.5)" }} />
    </AbsoluteFill>
  );
};

