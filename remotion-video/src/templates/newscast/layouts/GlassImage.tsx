import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useFitText } from "../components/useFitText";
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
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";

const GOLD = "#D4AA50";

export const GlassImage: React.FC<NewscastLayoutProps> = ({imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  title,
  narration,
  category,
  accentColor,
  textColor,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const portraitScale = getNewscastPortraitTypeScale(width, height);
  const p = height > width;

  /* ── Auto-fit ──────────────────────────────────────────────
     Title and narration are unbounded user input in a card centred on the
     frame with no fixed height; long copy could grow the card past the
     frame's overflow:hidden edge. Measure the real available height and
     shrink to fit. An explicitly chosen size is honored exactly (minPx ===
     targetPx no-ops the hook). */
  const fitTitleRef = React.useRef<HTMLDivElement>(null);
  const fitDescRef = React.useRef<HTMLDivElement>(null);
  const fitTitleTarget = titleFontSize ?? (p ? 34 : 26);
  const fitDescTarget = descriptionFontSize ?? (p ? 19 : 15);
  const { px: fitTitlePx } = useFitText(
    fitTitleRef,
    fitTitleTarget,
    titleFontSizeIsUserSet ? fitTitleTarget : Math.round(fitTitleTarget * 0.45),
    [title, fitTitleTarget, titleFontSizeIsUserSet, p, height],
    Math.round(height * (p ? 0.2 : 0.24)),
  );
  const { px: fitDescPx } = useFitText(
    fitDescRef,
    fitDescTarget,
    descriptionFontSizeIsUserSet ? fitDescTarget : Math.round(fitDescTarget * 0.5),
    [narration, fitDescTarget, descriptionFontSizeIsUserSet, fitTitlePx, p, height],
    Math.round(height * (p ? 0.28 : 0.32)),
  );

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
      {(imageUrl || videoUrl) ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${zoom}) translateY(${yShift}px)`,
            transformOrigin: "center center",
          }}
        >
          {videoUrl ? (
            <ZoomCropVideo
              src={videoUrl}
              imageObjectPosition={imageObjectPosition}
              imageZoom={imageZoom}
              muted={videoMuted ?? true}
              volume={videoVolume ?? 0.35}
              durationInFrames={videoDurationInFrames}
              startInFrames={videoStartInFrames}
            />
          ) : (
            <ZoomCropImg
              src={imageUrl!}
              imageObjectPosition={imageObjectPosition}
              imageZoom={imageZoom}
              alt=""
            />
          )}
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
          ref={fitTitleRef}
          style={{
            fontFamily: newscastFont(fontFamily, "title"),
            fontSize: fitTitlePx,
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
            ref={fitDescRef}
            style={{
              fontFamily: newscastFont(fontFamily, "body"),
              fontSize: fitDescPx,
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


