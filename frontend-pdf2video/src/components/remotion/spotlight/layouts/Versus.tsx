import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { BigGlyphBackdrop, DiagonalShards, FilmGrain, FlashPop, HalftoneField } from "../components/SpotlightArtifacts";
import {
  SPOTLIGHT_BODY_DEFAULT_FONT_FAMILY,
  SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY,
} from "../constants";
import type { SpotlightLayoutProps } from "../types";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";
import { useFitText } from "../components/useFitText";

/**
 * One side of the split — its own component so left/right each get their own
 * useFitText refs/calls (Rules of Hooks forbid a variable number of hook
 * calls, and inlining both sides in one function body would otherwise need
 * two differently-keyed calls anyway; a component keeps it symmetric).
 */
const VersusPanel: React.FC<{
  kicker: string;
  heading: string;
  description: string;
  headingTargetPx: number;
  descTargetPx: number;
  budgetPx: number;
  p: boolean;
  headingColor: string;
  descColor: string;
  displayFontFamily: string;
  bodyFontFamily: string;
  style: React.CSSProperties;
}> = ({ kicker, heading, description, headingTargetPx, descTargetPx, budgetPx, p, headingColor, descColor, displayFontFamily, bodyFontFamily, style }) => {
  const stackRef = React.useRef<HTMLDivElement>(null);
  const headingRef = React.useRef<HTMLDivElement>(null);
  const descRef = React.useRef<HTMLDivElement>(null);

  const headingBudgetPx = Math.round(budgetPx * (description ? 0.6 : 1));
  const { px: headingPx } = useFitText(
    headingRef,
    headingTargetPx,
    p ? 30 : 26,
    [heading, headingTargetPx, headingBudgetPx],
    headingBudgetPx,
  );
  const descBudgetPx = Math.max(1, budgetPx - headingBudgetPx);
  const { px: descPx } = useFitText(
    descRef,
    descTargetPx,
    p ? 18 : 16,
    [description, descTargetPx, descBudgetPx, headingPx],
    descBudgetPx,
  );

  return (
    <div style={style}>
      <div
        style={{
          fontSize: p ? 14 : 18,
          fontWeight: 700,
          color: "#666666",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          fontFamily: bodyFontFamily,
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        {kicker}
      </div>
      <div ref={stackRef} style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: 0, overflow: "hidden", maxHeight: "100%" }}>
        <div
          ref={headingRef}
          style={{
            fontSize: headingPx,
            fontWeight: 900,
            color: headingColor,
            textAlign: "center",
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            fontFamily: displayFontFamily,
            flexShrink: 0,
          }}
        >
          {heading}
        </div>
        {description && (
          <div
            ref={descRef}
            style={{
              fontSize: descPx,
              color: descColor,
              marginTop: 12,
              textAlign: "center",
              fontFamily: bodyFontFamily,
              maxWidth: "90%",
              minHeight: 0,
              overflow: "hidden",
              flex: "0 1 auto",
            }}
          >
            {description}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Versus — Contrast Split
 *
 * Screen splits vertically: left = white bg / black text, right = black bg / white text.
 * Optional image alongside when available.
 */
export const Versus: React.FC<SpotlightLayoutProps> = ({
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
  const displayFontFamily =
    fontFamily ?? SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY;
  const bodyFontFamily = fontFamily ?? SPOTLIGHT_BODY_DEFAULT_FONT_FAMILY;
  const headingTargetPx = titleFontSize ?? (p ? 64 : 57);
  const descTargetPx = descriptionFontSize ?? (p ? 36 : 42);
  // Each panel's column has ~76% of the frame minus padding to work with.
  const panelBudgetPx = Math.round(height * 0.7);

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

  const displayLeftLabel = leftLabel || "Before";
  const displayRightLabel = rightLabel || "After";
  const displayLeftDesc = leftDescription || narration || "";
  const displayRightDesc = rightDescription || "";
  const hasImage = !!imageUrl || !!videoUrl;

  const imageOpacity = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });
  const imageScale = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 80 } });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: hasImage && !p ? "row" : (p ? "column" : "row"),
        overflow: "hidden",
      }}
    >
      {hasImage && (
        <div
          style={{
            flex: p ? "none" : "0 0 38%",
            width: p ? "100%" : "auto",
            height: p ? 280 : "100%",
            padding: p ? "8% 8% 0" : "8% 0 0 8%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: imageOpacity,
            transform: `scale(${imageScale})`,
          }}
        >
          <div style={{ width: "100%", height: "100%", borderRadius: 4, overflow: "hidden" }}>
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
          flex: 1,
          display: "flex",
          flexDirection: p ? "column" : "row",
          minWidth: 0,
        }}
      >
      {/* Left — White background */}
      <VersusPanel
        kicker={displayLeftLabel}
        heading={title && !leftLabel ? title : displayLeftLabel}
        description={displayLeftDesc}
        headingTargetPx={headingTargetPx}
        descTargetPx={descTargetPx}
        budgetPx={panelBudgetPx}
        p={p}
        headingColor="#000000"
        descColor="#888888"
        displayFontFamily={displayFontFamily}
        bodyFontFamily={bodyFontFamily}
        style={{
          flex: 1,
          backgroundColor: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "8%",
          minHeight: 0,
          transform: p
            ? `translateY(${(1 - leftSpring) * -60}px)`
            : `translateX(${(1 - leftSpring) * -60}px)`,
          opacity: leftSpring,
        }}
      />

      {/* Divider */}
      <div
        style={{
          width: p ? "100%" : 3,
          height: p ? 3 : "100%",
          backgroundColor: accentColor,
          boxShadow: `0 0 12px ${accentColor}, 0 0 24px ${accentColor}44`,
          transform: p ? `scaleX(${lineSpring})` : `scaleY(${lineSpring})`,
          transformOrigin: "center",
          flexShrink: 0,
        }}
      />

      {/* Right — Black background */}
      <VersusPanel
        kicker={displayRightLabel}
        heading={displayRightLabel}
        description={displayRightDesc}
        headingTargetPx={headingTargetPx}
        descTargetPx={descTargetPx}
        budgetPx={panelBudgetPx}
        p={p}
        headingColor="#FFFFFF"
        descColor="#666666"
        displayFontFamily={displayFontFamily}
        bodyFontFamily={bodyFontFamily}
        style={{
          flex: 1,
          backgroundColor: "#000000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "8%",
          minHeight: 0,
          transform: p
            ? `translateY(${(1 - rightSpring) * 60}px)`
            : `translateX(${(1 - rightSpring) * 60}px)`,
          opacity: rightSpring,
        }}
      />
      </div>

      {/* Decorative artifacts — ghost VS, shards on both corners, flashes on the face-off. */}
      <BigGlyphBackdrop glyph="VS" accentColor={accentColor} tint="accent" startFrame={6} />
      <DiagonalShards accentColor={accentColor} corner="top-right" startFrame={4} />
      <DiagonalShards accentColor={accentColor} corner="bottom-left" startFrame={8} />
      <FlashPop count={2} every={78} seed={27} startFrame={16} />
      {/* Halftone wedges on opposite corners read like a comic face-off poster. */}
      <HalftoneField accentColor={accentColor} corner="top-left" />
      <HalftoneField accentColor={accentColor} corner="bottom-right" />
      <FilmGrain />
    </AbsoluteFill>
  );
};

