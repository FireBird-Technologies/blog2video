import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useFitText } from "../components/useFitText";
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
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  accentColor,
  textColor,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
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

  /* ── Auto-fit ──────────────────────────────────────────────
     Title is unbounded user input; code is capped at 12 lines but each line's
     length is unbounded, and the panel is centred with no fixed height, so a
     long title or a tall code block could grow the card past the frame's
     overflow:hidden edge. Fit the title on its own line, and the whole code
     block (all lines together, since one fontSize applies to all of them) to
     its available height. An explicitly chosen size is honored exactly
     (minPx === targetPx no-ops the hook). */
  const fitTitleRef = React.useRef<HTMLDivElement>(null);
  const fitCodeRef = React.useRef<HTMLDivElement>(null);
  const fitTitleTarget = titleFontSize ?? (p ? 23 : 18);
  const fitCodeTarget = descriptionFontSize ?? (p ? 18 : 14);
  const codeBlockKey = safeLines.join("\n");
  const { px: fitTitlePx } = useFitText(
    fitTitleRef,
    fitTitleTarget,
    titleFontSizeIsUserSet ? fitTitleTarget : Math.round(fitTitleTarget * 0.5),
    [title, fitTitleTarget, titleFontSizeIsUserSet, p, height],
    Math.round(height * (p ? 0.08 : 0.1)),
  );
  const { px: fitCodePx } = useFitText(
    fitCodeRef,
    fitCodeTarget,
    descriptionFontSizeIsUserSet ? fitCodeTarget : Math.round(fitCodeTarget * 0.55),
    [codeBlockKey, fitCodeTarget, descriptionFontSizeIsUserSet, p, height],
    Math.round(height * (p ? 0.32 : 0.4)),
  );
  const revealed = Math.max(0, Math.min(safeLines.length, Math.floor((frame + 6) / 7)));
  const RED = accentColor || DEFAULT_NEWSCAST_ACCENT;
  const STEEL = textColor || DEFAULT_NEWSCAST_TEXT;
  const shadows = headlineTextShadowFor(RED);

  return (
    <AbsoluteFill style={{ zIndex: 60, overflow: "hidden", opacity: t }}>
      <NewsCastLayoutImageBackground imageUrl={imageUrl} imageObjectPosition={imageObjectPosition} imageZoom={imageZoom} accentColor={RED} videoUrl={videoUrl} videoMuted={videoMuted} videoVolume={videoVolume} videoDurationInFrames={videoDurationInFrames} videoStartInFrames={videoStartInFrames} />
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
            ref={fitTitleRef}
            style={{
              padding: "12px 18px 0",
              fontFamily: newscastFont(fontFamily, "title"),
              fontWeight: HEADLINE_WEIGHT,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "white",
              textShadow: shadows.light,
              fontSize: fitTitlePx,
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
          <div ref={fitCodeRef} style={{ fontFamily: newscastFont(fontFamily, "mono"), fontSize: scaleNewscastPx(14, portraitScale), lineHeight: 1.65 }}>
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
                      fontSize: fitCodePx,
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

