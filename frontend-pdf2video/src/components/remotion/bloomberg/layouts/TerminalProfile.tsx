import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useFitText } from "../components/useFitText";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY, derivePalette } from "../constants";
import type { BloombergLayoutProps } from "../types";
import { BackgroundHistogramGraph } from "./BackgroundHistogramGraph";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";

export const TerminalProfile: React.FC<BloombergLayoutProps> = ({
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
  const { height } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const amber = textColor || BLOOMBERG_COLORS.amber;
  const blue = accentColor || BLOOMBERG_COLORS.accent;
  const bg = bgColor || BLOOMBERG_COLORS.bg;
  const { panelBg, headerBg, border, muted } = derivePalette(bg, amber);

  const tSize = titleFontSize ?? (p ? 105 : 107);
  const dSize = descriptionFontSize ?? (p ? 33 : 35);
  const labelSize = dSize * 0.4;

  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const profiles = items.length > 0 ? items : [
    "CLASSIC    Amber on black. Pure terminal baseline.",
    "BLUE-HOUR  Cool blue accent. After-hours session.",
    "RISK-RED   Red dominant. Drawdown / alert mode.",
    "MACRO-GOLD Gold palette. Macro and rates focus.",
    "DARK-CONTRAST High contrast whites. Print clarity.",
  ];

  const topH = p ? 56 : 48;
  const botH = p ? 44 : 36;
  const pad = p ? 40 : 48;
  const titleRef = React.useRef<HTMLDivElement>(null);
  const profileMeasureRef = React.useRef<HTMLDivElement>(null);
  const narrationRef = React.useRef<HTMLDivElement>(null);
  const profileTarget = dSize * 0.7;
  const profileCopy = profiles.join("\n");
  const { px: fittedTitleSize } = useFitText(titleRef, tSize * 0.6, p ? 30 : 28, [title, tSize, p], p ? 170 : 140);
  const { px: fittedProfileSize } = useFitText(profileMeasureRef, profileTarget, p ? 19 : 18, [profileCopy, profileTarget, p], p ? 580 : 420);
  const narrationBudget = Math.round(height * 0.28);
  const { px: fittedNarrationSize } = useFitText(
    narrationRef,
    dSize * 0.85,
    p ? 12 : 11,
    [narration, dSize, p, height],
    narrationBudget,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: ff, overflow: "hidden" }}>
      <div ref={profileMeasureRef} style={{ position: "absolute", visibility: "hidden", width: p ? "82%" : 340, fontSize: profileTarget, lineHeight: 1.45, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{profileCopy}</div>
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
      {/* Top bar (Title removed) */}
      <BackgroundHistogramGraph accentColor={blue} textColor={amber} />
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: topH,
        backgroundColor: headerBg,
        
        display: "flex", alignItems: "center", padding: `0 ${pad}px`,

      }}>
      </div>

      {/* Main Centered Container */}
      <div style={{
        position: "absolute",
        top: topH,
        right: 0,
        bottom: botH,
        left: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: `0 ${pad}px`,
      }}>
        
        {/* Single Centered Title */}
        <div ref={titleRef} style={{
          color: amber,
          fontSize: fittedTitleSize,
          lineHeight: 1.1,
          opacity: titleOpacity,
          letterSpacing: -0.5,
          fontWeight: "bold",
          textAlign: "center",
          textTransform: "uppercase",
          marginBottom: p ? 30 : 50,
        }}>
          {title}
        </div>

        {/* Profiles Grid (Cards) */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: p ? 16 : 24,
          width: "100%",
          maxWidth: 1200,
        }}>
          {profiles.map((profile, i) => {
            const rowOpacity = interpolate(frame, [i * 7 + 10, i * 7 + 25], [0, 1], { extrapolateRight: "clamp" });
            const rowSlide = interpolate(frame, [i * 7 + 10, i * 7 + 25], [20, 0], { extrapolateRight: "clamp" });
            
            const parts = profile.split(/\s{2,}/);
            const name = parts[0] || profile;
            const desc = parts.slice(1).join("  ");

            return (
              <div key={i} style={{
                backgroundColor: panelBg,
                border: `1px solid ${border}`,
                borderTop: `3px solid ${amber}`, // Highlight top of card
                padding: p ? "20px" : "24px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                width: p ? "100%" : "30%", // 3 columns on landscape, full width on portrait
                minWidth: p ? "none" : 280,
                opacity: rowOpacity,
                transform: `translateY(${rowSlide}px)`,
              }}>
                <span style={{ 
                  color: blue, 
                  fontSize: fittedProfileSize,
                  letterSpacing: 2, 
                  fontWeight: "bold" 
                }}>
                  {name}
                </span>
                <span style={{ 
                  color: muted, 
                  fontSize: fittedProfileSize,
                  lineHeight: 1.4 
                }}>
                  {desc}
                </span>
              </div>
            );
          })}
        </div>

        {/* Increased Narration Size below Cards */}
        <div ref={narrationRef} style={{
          marginTop: p ? 40 : 50,
          color: muted,
          fontSize: fittedNarrationSize,
          lineHeight: 1.35,
          maxHeight: narrationBudget,
          flexShrink: 0,
          overflow: "hidden",
          overflowWrap: "anywhere",
          textAlign: "center",
          width: "100%",
          maxWidth: p ? "88%" : "92%",
          opacity: interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          {narration}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: botH,
        backgroundColor: headerBg,
        
        display: "flex", alignItems: "center", padding: `0 ${pad}px`,
      }}>
        <span style={{ color: muted, fontSize: labelSize, letterSpacing: 2 }}>
          PREFERENCES
        </span>
      </div>
    </AbsoluteFill>
  );
};
