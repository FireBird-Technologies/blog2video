import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import { AccentBars, FilmGrain, LightDust, PulseRing, SpotlightBeam } from "../components/SpotlightArtifacts";
import { SPOTLIGHT_BODY_DEFAULT_FONT_FAMILY } from "../constants";
import type { SpotlightLayoutProps } from "../types";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";
import { useFitText } from "../components/useFitText";

/**
 * Closer — Final Takeaway
 *
 * Text fades in from gaussian blur, sharpens over ~20 frames.
 * Optional image alongside when available.
 */
export const Closer: React.FC<SpotlightLayoutProps> = ({
  title,
  narration,
  highlightPhrase,
  cta,imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const bodyFontFamily = fontFamily ?? SPOTLIGHT_BODY_DEFAULT_FONT_FAMILY;

  const hasImageForFit = Boolean(imageUrl) || Boolean(videoUrl);

  /* ── Auto-fit ──────────────────────────────────────────────
     Statement text and CTA line are unbounded user input stacked in one
     column with no height cap. Each fits against its own fixed, independent
     budget. No give-back cross-talk: a useLayoutEffect+setState chain
     reacting to another useFitText's overflow output creates a multi-render
     convergence that Remotion's per-frame headless capture can settle at
     different points on different frames (confirmed via a real render —
     frame-to-frame scene-change score hit 1.0, i.e. maximum, twice in the
     first ten frames, in the equivalent newscast/newspaper opening scenes). */
  const statementRef = React.useRef<HTMLDivElement>(null);
  const ctaRef = React.useRef<HTMLDivElement>(null);
  const statementTargetPx = titleFontSize ?? (p ? 55 : 42);
  const ctaTargetPx = descriptionFontSize ?? (p ? 55 : 44);
  const displayTextForFit = narration || title;
  const displayCtaForFit = cta || "Read the full article →";

  const stackBudgetPx = Math.round(height * (hasImageForFit && !p ? 0.55 : p ? 0.55 : 0.65));
  const statementBudgetPx = Math.round(stackBudgetPx * 0.62);

  const { px: statementPx } = useFitText(
    statementRef,
    statementTargetPx,
    p ? 24 : 20,
    [displayTextForFit, statementTargetPx, statementBudgetPx],
    statementBudgetPx,
  );
  const ctaBudgetPx = Math.max(1, stackBudgetPx - statementBudgetPx);
  const { px: ctaPx } = useFitText(
    ctaRef,
    ctaTargetPx,
    p ? 20 : 18,
    [displayCtaForFit, ctaTargetPx, ctaBudgetPx, statementPx],
    ctaBudgetPx,
  );

  const blurSpring = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 120, mass: 1 },
  });

  const blur = Math.max(0, 16 - blurSpring * 16);
  const textOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const lineSpring = spring({
    frame: frame - 28,
    fps,
    config: { damping: 18, stiffness: 180 },
  });

  const ctaOpacity = interpolate(frame, [40, 55], [0, 1], {
    extrapolateRight: "clamp",
  });

  const ctaY = spring({
    frame: frame - 40,
    fps,
    config: { damping: 20, stiffness: 160 },
  });

  const displayText = narration || title;
  const displayCta = cta || "Read the full article →";
  const hasImage = !!imageUrl || !!videoUrl;

  const imageOpacity = interpolate(frame, [10, 35], [0, 1], { extrapolateRight: "clamp" });
  const imageScale = spring({ frame: frame - 10, fps, config: { damping: 20, stiffness: 80 } });

  const renderTextWithHighlight = () => {
    if (!highlightPhrase) {
      return (
        <span>
          {displayText}
          <span
            style={{
              position: "absolute",
              bottom: -4,
              left: 0,
              height: 3,
              width: `${lineSpring * 100}%`,
              backgroundColor: accentColor,
              display: "block",
            }}
          />
        </span>
      );
    }

    const idx = displayText.toLowerCase().indexOf(highlightPhrase.toLowerCase());
    if (idx === -1) {
      return displayText;
    }

    const before = displayText.slice(0, idx);
    const match = displayText.slice(idx, idx + highlightPhrase.length);
    const after = displayText.slice(idx + highlightPhrase.length);

    return (
      <>
        {before}
        <span style={{ position: "relative", display: "inline-block" }}>
          <span style={{ color: accentColor }}>{match}</span>
          <span
            style={{
              position: "absolute",
              bottom: -4,
              left: 0,
              height: 3,
              width: `${lineSpring * 100}%`,
              backgroundColor: accentColor,
              display: "block",
            }}
          />
        </span>
        {after}
      </>
    );
  };

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <SpotlightBackground bgColor={bgColor} accentColor={accentColor} />

      {/* Decorative artifacts — converging stage lights, a soft pulse + dust in the beam. */}
      <SpotlightBeam mode="converge" startFrame={2} intensity={0.85} />
      <PulseRing accentColor={accentColor} periodFrames={100} />
      <LightDust count={20} seed={9} />
      <FilmGrain />
      {!hasImage && <AccentBars accentColor={accentColor} position="bottom-left" count={2} startFrame={8} />}

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: hasImage && !p ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "0 8%" : "0 12%",
          textAlign: "center",
          gap: hasImage ? (p ? 24 : 48) : 0,
        }}
      >
        {hasImage && (
          <div
            style={{
              flex: p ? "none" : "0 0 38%",
              width: p ? "70%" : "auto",
              height: p ? 220 : 320,
              borderRadius: 4,
              overflow: "hidden",
              opacity: imageOpacity,
              transform: `scale(${imageScale})`,
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
        )}
        <div style={{ flex: hasImage && !p ? 1 : "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div
          ref={statementRef}
          style={{
            fontSize: statementPx,
            fontWeight: 700,
            color: textColor || "#FFFFFF",
            letterSpacing: "-0.02em",
            lineHeight: 1.25,
            filter: `blur(${blur}px)`,
            opacity: Math.min(textOpacity * 1.5, 1),
            fontFamily: bodyFontFamily,
            position: "relative",
          }}
        >
          {renderTextWithHighlight()}
        </div>

        <div
          ref={ctaRef}
          style={{
            marginTop: p ? 24 : 36,
            fontSize: ctaPx,
            fontWeight: 300,
            color: "#666666",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontFamily: bodyFontFamily,
            opacity: ctaOpacity,
            transform: `translateY(${(1 - ctaY) * 10}px)`,
          }}
        >
          {displayCta}
        </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

