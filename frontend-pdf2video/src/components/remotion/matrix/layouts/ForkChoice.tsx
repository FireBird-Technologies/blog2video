import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { useFitText } from "../components/useFitText";
import { CodeFragments, DecodeSweep, GlitchSlice, ScanlinesOverlay } from "../components/MatrixArtifacts";
import { MATRIX_DEFAULT_FONT_FAMILY } from "../constants";
import type { MatrixLayoutProps } from "../types";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";

/**
 * ForkChoice — Red Pill / Blue Pill Split
 *
 * Screen splits vertically: left = red-tinted, right = blue-tinted.
 * Green neon divider. Both sides slide in from opposite edges.
 * Optional image alongside.
 */
export const ForkChoice: React.FC<MatrixLayoutProps> = ({
  title,
  narration,
  leftLabel,
  rightLabel,
  leftDescription,
  rightDescription,imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  accentColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";
  const resolvedFontFamily = fontFamily ?? MATRIX_DEFAULT_FONT_FAMILY;

  const leftSpring = spring({
    frame: frame - 3,
    fps,
    config: { damping: 18, stiffness: 200, mass: 1 },
  });

  const rightSpring = spring({
    frame: frame - 3,
    fps,
    config: { damping: 18, stiffness: 200, mass: 1 },
  });

  const lineSpring = spring({
    frame: frame - 8,
    fps,
    config: { damping: 20, stiffness: 180 },
  });

  const displayLeftLabel = leftLabel || "Red Pill";
  const displayRightLabel = rightLabel || "Blue Pill";
  const displayLeftDesc = leftDescription || narration || "";
  const displayRightDesc = rightDescription || "";
  const hasImage = !!imageUrl || !!videoUrl;
  const leftTitleRef = React.useRef<HTMLDivElement>(null);
  const rightTitleRef = React.useRef<HTMLDivElement>(null);
  const leftDescRef = React.useRef<HTMLDivElement>(null);
  const rightDescRef = React.useRef<HTMLDivElement>(null);
  const titleTarget = titleFontSize ?? (p ? 76 : 58);
  const descTarget = descriptionFontSize ?? (p ? 48 : 32);
  const panelBudget = height * (p ? (hasImage ? 0.18 : 0.28) : 0.22);
  const { px: leftTitleSize } = useFitText(leftTitleRef, titleTarget, 14, [title, displayLeftLabel, titleTarget, p, hasImage], panelBudget);
  const { px: rightTitleSize } = useFitText(rightTitleRef, titleTarget, 14, [displayRightLabel, titleTarget, p, hasImage], panelBudget);
  const { px: leftDescSize } = useFitText(leftDescRef, descTarget, 11, [displayLeftDesc, descTarget, p, hasImage], height * 0.16);
  const { px: rightDescSize } = useFitText(rightDescRef, descTarget, 11, [displayRightDesc, descTarget, p, hasImage], height * 0.16);

  const imageOpacity = interpolate(frame, [5, 25], [0, 1], {
    extrapolateRight: "clamp",
  });
  const imageScale = spring({
    frame: frame - 5,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: hasImage && !p ? "row" : p ? "column" : "row",
        overflow: "hidden",
      }}
    >
      {hasImage && (
        <div
          style={{
            flex: p ? "none" : "0 0 50%", // Set left panel to 50% width
            width: p ? "100%" : "auto",
            height: p ? 280 : "100%", // Set left panel to 100% height
            padding: p ? "8% 8% 0" : "0", // Remove padding to ensure image fills
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: imageOpacity,
            transform: `scale(${imageScale})`,
            // backgroundColor: "#000000", // Removed as image should fill completely
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              overflow: "hidden", // Ensures nothing bleeds out
              border: `1px solid ${accent}33`,
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
              />
            )}
          </div>
        </div>
      )}

      <div
        style={{
          flex: 1, // This panel will take the remaining 50% width
          display: "flex",
          flexDirection: p ? "column" : "row",
          minWidth: 0,
        }}
      >
        {/* Left — Red Pill */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#1a0808",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "8%",
            transform: p
              ? `translateY(${(1 - leftSpring) * -60}px)`
              : `translateX(${(1 - leftSpring) * -60}px)`,
            opacity: leftSpring,
          }}
        >
          {/* Label + title are pinned to a fixed band from the top of the
              panel — NOT vertically centered together with the description —
              so both panels' titles land at the same Y regardless of whether
              either side has description text below (or how many lines it
              wraps to). The description flows in its own space beneath. */}
          <div style={{ flex: "0 0 auto", marginTop: p ? "18%" : "30%" }}>
            <div
              style={{
                fontSize: p ? 12 : 16,
                fontWeight: 700,
                color: "#EF444488",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                fontFamily: resolvedFontFamily,
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              {">"} {displayLeftLabel}
            </div>
            <div
              ref={leftTitleRef}
              style={{
                fontSize: leftTitleSize,
                fontWeight: 700,
                color: "#EF4444",
                textAlign: "center",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                fontFamily: resolvedFontFamily,
                textShadow: "0 0 16px #EF444444",
                overflowWrap: "anywhere",
              }}
            >
              {title && !leftLabel ? title : displayLeftLabel}
            </div>
          </div>
          {displayLeftDesc && (
            <div
              ref={leftDescRef}
              style={{
                fontSize: leftDescSize,
                color: "#EF444488",
                marginTop: 16,
                textAlign: "center",
                fontFamily: resolvedFontFamily,
                maxWidth: "90%",
                overflowWrap: "anywhere",
              }}
            >
              {displayLeftDesc}
            </div>
          )}
        </div>

        {/* Green Divider */}
        <div
          style={{
            width: p ? "100%" : 3,
            height: p ? 3 : "100%",
            backgroundColor: accent,
            boxShadow: `0 0 12px ${accent}, 0 0 24px ${accent}44`,
            transform: p ? `scaleX(${lineSpring})` : `scaleY(${lineSpring})`,
            transformOrigin: "center",
            flexShrink: 0,
          }}
        />

        {/* Right — Blue Pill */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#080818",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "8%",
            transform: p
              ? `translateY(${(1 - rightSpring) * 60}px)`
              : `translateX(${(1 - rightSpring) * 60}px)`,
            opacity: rightSpring,
          }}
        >
          {/* Same fixed label+title band as the left panel — keeps both
              titles aligned regardless of description presence/length. */}
          <div style={{ flex: "0 0 auto", marginTop: p ? "18%" : "30%" }}>
            <div
              style={{
                fontSize: p ? 12 : 16,
                fontWeight: 700,
                color: "#3B82F688",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                fontFamily: resolvedFontFamily,
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              {">"} {displayRightLabel}
            </div>
            <div
              ref={rightTitleRef}
              style={{
                fontSize: rightTitleSize,
                fontWeight: 700,
                color: "#3B82F6",
                textAlign: "center",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                fontFamily: resolvedFontFamily,
                textShadow: "0 0 16px #3B82F644",
                overflowWrap: "anywhere",
              }}
            >
              {displayRightLabel}
            </div>
          </div>
          {displayRightDesc && (
            <div
              ref={rightDescRef}
              style={{
                fontSize: rightDescSize,
                color: "#3B82F688",
                marginTop: 16,
                textAlign: "center",
                fontFamily: resolvedFontFamily,
                maxWidth: "90%",
                overflowWrap: "anywhere",
              }}
            >
              {displayRightDesc}
            </div>
          )}
        </div>
      </div>

      {/* Decorative artifacts — decode pass, glitch ticks, readouts, CRT texture over the split. */}
      <DecodeSweep accentColor={accent} startFrame={8} seed={31} />
      <GlitchSlice accentColor={accent} every={70} seed={33} />
      <CodeFragments accentColor={accent} count={7} seed={61} startFrame={12} />
      <ScanlinesOverlay accentColor={accent} intensity={0.7} />
    </AbsoluteFill>
  );
};
