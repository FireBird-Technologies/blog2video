import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { useFitText } from "../components/useFitText";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY, derivePalette } from "../constants";
import type { BloombergLayoutProps } from "../types";
import { BackgroundGraph } from "./BackgroundGraph";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";

export const TerminalList: React.FC<BloombergLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  fontFamily,
  titleFontSize,
  descriptionFontSize,
  aspectRatio = "landscape",
  items = [],
  imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const amber = textColor || BLOOMBERG_COLORS.amber;
  const blue = accentColor || BLOOMBERG_COLORS.accent;
  const bg = bgColor || BLOOMBERG_COLORS.bg;
  const { panelBg, headerBg, border, muted } = derivePalette(bg, amber);

  const tSize = titleFontSize ?? (p ? 96 : 95);
  const dSize = descriptionFontSize ?? (p ? 41 : 36); 
  const labelSize = dSize * 0.4;

  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [5, 22], [0, 1], { extrapolateRight: "clamp" });

  const listItems = items.length > 0 ? items : [
    "Monitor FOMC minutes for rate guidance",
    "Watch 10Y yield for breakout confirmation",
    "Track VIX below 20 for risk-on continuation",
  ];

  const topH = p ? 56 : 48;
  const botH = p ? 44 : 36;
  const pad = p ? 60 : 80;
  const titleRef = React.useRef<HTMLDivElement>(null);
  const listMeasureRef = React.useRef<HTMLDivElement>(null);
  const listCopy = listItems.join("\n");
  const { px: fittedTitleSize } = useFitText(titleRef, tSize * 0.55, p ? 30 : 28, [title, tSize, p], p ? 150 : 130);
  const { px: fittedItemSize } = useFitText(listMeasureRef, dSize, p ? 22 : 20, [listCopy, dSize, p], p ? 650 : 560);

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff, overflow: "hidden" }}>
      <div ref={listMeasureRef} style={{ position: "absolute", visibility: "hidden", width: p ? "82%" : 950, fontSize: dSize, lineHeight: 1.65, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{listCopy}</div>
      {(videoUrl || imageUrl) && (
        <>
          <div style={{ position: "absolute", inset: 0 }}>
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
              <ZoomCropImg src={imageUrl!} imageObjectPosition={imageObjectPosition} imageZoom={imageZoom} />
            )}
          </div>
          <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.65)" }} />
        </>
      )}
      <BackgroundGraph accentColor={blue} textColor={amber} variant="list" />
      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: topH,
        backgroundColor: headerBg,
        
        display: "flex", alignItems: "center", padding: `0 ${p ? 40 : 48}px`,

      }}>
      </div>

      {/* Main Container - Shifted Upwards & Left Aligned */}
      <div style={{
        position: "absolute",
        top: topH,
        left: pad,
        right: pad,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start", 
        justifyContent: "flex-start", 
        marginTop: p ? 60 : 80, 
      }}>
        
        {/* Title */}
        <div ref={titleRef} style={{
          fontSize: fittedTitleSize,
          lineHeight: 1.1,
          opacity: titleOpacity,
          letterSpacing: -0.5,
          fontWeight: "bold",
          marginBottom: p ? 28 : 36,
        }}>
          <span style={{ backgroundColor: amber, color: bg, display: "inline-block", padding: "3px 14px 6px" }}>{title}</span>
        </div>

        {/* List Box */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: p ? 20 : 26,
          width: "100%",
          maxWidth: p ? "100%" : "950px", 
        }}>
          {listItems.map((item, i) => {
            const itemOpacity = interpolate(frame, [i * 8 + 15, i * 8 + 30], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div key={i} style={{
                display: "flex", 
                alignItems: "flex-start",
                gap: 25,
                opacity: itemOpacity,
              }}>
                <span style={{ color: blue, fontSize: fittedItemSize, fontWeight: "bold", flexShrink: 0 }}>
                  &gt;
                </span>
                <div style={{
                  color: amber, 
                  fontSize: fittedItemSize,
                  lineHeight: 1.3,
                  borderBottom: `1px solid ${border}`, 
                  paddingBottom: 12,
                  flex: 1,
                }}>
                  {item}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: botH,
        backgroundColor: headerBg,
        
        display: "flex", alignItems: "center", padding: `0 ${p ? 40 : 48}px`,
      }}>
        <span style={{ color: muted, fontSize: labelSize, letterSpacing: 2 }}>
          WATCH LIST
        </span>
      </div>
    </AbsoluteFill>
  );
};
