import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { useFitText } from "../components/useFitText";
import { MatrixBackground } from "../MatrixBackground";
import { buildHudStatus, GlitchSlice, RainBurst, ScanlinesOverlay, TerminalHUD } from "../components/MatrixArtifacts";
import { MATRIX_DEFAULT_FONT_FAMILY } from "../constants";
import type { MatrixLayoutProps } from "../types";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { ZoomCropVideo } from "../components/ZoomCropVideo";

const GLITCH_CHARS = "アイウエオカキクケコ0123456789!@#$%^&*<>{}[]";

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * MatrixTitle — Character Decode Hero
 *
 * Title text decodes from random characters on black + digital rain.
 * Each character cycles through random symbols before settling.
 */
export const MatrixTitle: React.FC<MatrixLayoutProps> = ({
  title,
  narration,imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  accentColor,
  bgColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";
  const resolvedFontFamily = fontFamily ?? MATRIX_DEFAULT_FONT_FAMILY;
  const hasImage = !!imageUrl || !!videoUrl;
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const narrationRef = React.useRef<HTMLParagraphElement>(null);
  const titleTarget = titleFontSize ?? (p ? 128 : 110);
  const narrationTarget = descriptionFontSize ?? (p ? 52 : 53);
  const { px: fittedTitleSize } = useFitText(titleRef, titleTarget, 18, [title, titleTarget, p, hasImage], height * (hasImage ? 0.25 : 0.38));
  const narrationBudget = Math.round(height * (hasImage && !p ? 0.34 : 0.42));
  const { px: fittedNarrationSize } = useFitText(
    narrationRef,
    narrationTarget,
    p ? 12 : 11,
    [narration, narrationTarget, p, hasImage, width, height],
    narrationBudget,
  );

  const titleChars = title.split("");
  // Speed up decode for longer titles so animation completes in time
  const decodeFramesPerChar = titleChars.length > 30 ? 2 : 3;
  const totalDecodeFrames = titleChars.length * decodeFramesPerChar + 10;

  const subtitleOpacity = interpolate(
    frame,
    [totalDecodeFrames, totalDecodeFrames + 20],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  const subtitleY = spring({
    frame: frame - totalDecodeFrames,
    fps,
    config: { damping: 20, stiffness: 160 },
  });

  // --- Image entrance animation ---
  const imageDelay = 20; // Start image animation at this frame
  const imageEntranceProgress = spring({
    frame: frame - imageDelay,
    fps,
    config: {
      damping: 18,
      stiffness: 120,
      mass: 1.2,
    },
  });

  const imageScaleValue = interpolate(imageEntranceProgress, [0, 1], [0.7, 1]); // Scales from 70% to 100%
  const imageOpacityValue = interpolate(imageEntranceProgress, [0, 1], [0, 1]); // Fades in
  const imageInitialYOffset = p ? 150 : 80; // Starting Y position for slide-in (more for portrait)
  const imageAnimatedTranslateY = interpolate(imageEntranceProgress, [0, 1], [imageInitialYOffset, 0]);
  const imageRotateXValue = interpolate(imageEntranceProgress, [0, 1], [p ? 45 : 25, 0]); // Rotates from an angle (more for portrait)

  // Additional static offset for portrait mode to move image upwards
  const imageFinalYPortraitOffset = -70;
  const combinedImageTranslateY = imageAnimatedTranslateY + (p ? imageFinalYPortraitOffset : 0);
  // --- End Image entrance animation ---

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <MatrixBackground bgColor={bgColor} opacity={0.25} fontFamily={resolvedFontFamily} />

      {/* Decorative artifacts — rain surge, HUD chrome, CRT texture, rare glitch ticks. */}
      <RainBurst accentColor={accent} centerX={50} widthPct={80} startFrame={0} seed={5} />
      <TerminalHUD accentColor={accent} statusText={buildHudStatus("DECODING", title)} startFrame={6} />
      <ScanlinesOverlay accentColor={accent} intensity={0.8} />
      <GlitchSlice accentColor={accent} every={76} seed={51} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: hasImage && !p ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? 40 : 80,
          gap: hasImage ? (p ? 24 : 48) : 0,
        }}
      >
        {hasImage && (
          <div
            style={{
              flex: p ? "none" : "0 0 38%",
              width: p ? "70%" : "auto",
              height: p ? 220 : 360,
              borderRadius: 0,
              overflow: "hidden",
              border: `1px solid ${accent}33`,
              // Apply combined image animation styles
              opacity: imageOpacityValue,
              transform: `
                perspective(1000px)
                rotateX(${imageRotateXValue}deg)
                scale(${imageScaleValue})
                translateY(${combinedImageTranslateY}px)
              `,
              transformOrigin: 'center center', // Ensures rotation and scaling are from the center
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

        <div
          style={{
            flex: hasImage && !p ? 1 : "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: hasImage && !p ? undefined : "100%",
            maxHeight: "100%",
            minHeight: 0,
          }}
        >
          {/* Hidden full-text mirror carries the real heading semantics — the
              visible element below is a decorative per-character decode
              animation (an unrevealed character renders as a blank space,
              not its real glyph), so it's marked aria-hidden and this
              invisible-but-measured <h1> is what a screen reader announces.
              Measuring the mirror (not the animating text) also means the
              fit is computed from the true final content, not whatever
              partially-blank shape the decode happens to be in at the frame
              the probe runs. */}
          <h1
            ref={titleRef}
            style={{
              position: "absolute",
              visibility: "hidden",
              pointerEvents: "none",
              fontSize: fittedTitleSize,
              fontWeight: 700,
              fontFamily: resolvedFontFamily,
              textAlign: "center",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              margin: 0,
              width: "100%",
              maxWidth: "95%",
              overflowWrap: "anywhere",
            }}
          >
            {title}
          </h1>
          <div
            aria-hidden
            style={{
              fontSize: fittedTitleSize,
              fontWeight: 700,
              color: accent,
              fontFamily: resolvedFontFamily,
              textAlign: "center",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              margin: 0,
              width: "100%",
              maxWidth: "95%",
              overflowWrap: "anywhere",
              textShadow: `0 0 20px ${accent}88, 0 0 40px ${accent}44`,
            }}
          >
            {titleChars.map((char, i) => {
              const charRevealFrame = i * decodeFramesPerChar + 5;
              const isRevealed = frame >= charRevealFrame;
              const isDecoding =
                frame >= charRevealFrame - 8 && !isRevealed;

              let displayChar = char;
              if (char === " ") {
                displayChar = " ";
              } else if (isDecoding) {
                const glitchIdx = Math.floor(
                  seededRandom(i * 100 + frame * 7) * GLITCH_CHARS.length
                );
                displayChar = GLITCH_CHARS[glitchIdx];
              } else if (!isRevealed && frame < charRevealFrame - 8) {
                displayChar = " ";
              }

              return (
                <span
                  key={i}
                  style={{
                    opacity: char === " " ? 1 : isRevealed || isDecoding ? 1 : 0,
                    color: isDecoding ? `${accent}66` : accent,
                  }}
                >
                  {displayChar}
                </span>
              );
            })}
          </div>

          {narration && (
            <p
              ref={narrationRef}
              style={{
                fontSize: fittedNarrationSize,
                fontWeight: 400,
                color: `${accent}88`,
                fontFamily: resolvedFontFamily,
                textAlign: "center",
                margin: `${p ? 20 : 28}px 0 0`,
                letterSpacing: "0.08em",
                opacity: subtitleOpacity,
                transform: `translateY(${(1 - subtitleY) * 12}px)`,
                width: "100%",
                maxWidth: p ? "88%" : hasImage ? "100%" : Math.min(1320, width * 0.72),
                maxHeight: narrationBudget,
                flexShrink: 0,
                overflow: "hidden",
                overflowWrap: "anywhere",
              }}
            >
              {narration}
            </p>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
