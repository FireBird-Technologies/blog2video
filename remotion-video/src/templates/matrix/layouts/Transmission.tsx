import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { MatrixBackground } from "../MatrixBackground";
import { MATRIX_DEFAULT_FONT_FAMILY } from "../constants";
import type { MatrixLayoutProps } from "../types";

// Define default spring config for various effects
const springConfigSoftBounce = {
  damping: 8, // Softer bounce for position
  stiffness: 80, // Medium stiffness
  mass: 0.8, // Lighter for quicker reaction
  overshootClamping: false, // Allow overshoot for the bounce effect
};

const springConfigEaseOut = {
  damping: 20, // Higher damping for smoother ease-out, minimal oscillation
  stiffness: 100, // Reasonable stiffness
  mass: 1,
  overshootClamping: true, // Prevents any overshoot for a clean ease-out
};


/**
 * Transmission — Intercepted Signal Flash
 *
 * 3-5 short phrases displayed sequentially like intercepted transmissions.
 * Each phrase: centered, monospace, green. Hard cuts between phrases.
 * [SIGNAL] prefix in dimmer green.
 */
export const Transmission: React.FC<MatrixLayoutProps> = ({
  phrases,
  title,
  narration,
  imageUrl,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";
  const resolvedFontFamily = fontFamily ?? MATRIX_DEFAULT_FONT_FAMILY;

  const displayPhrases =
    phrases && phrases.length > 0
      ? phrases
      : narration
        ? narration.split(/[.!?]+/).filter((s) => s.trim())
        : [title];

  const holdFrames = 45; // Reduced from 60 to make transitions faster
  const currentIdx = Math.floor(frame / holdFrames) % displayPhrases.length;

  // Calculate the frame relative to the start of the current phrase's activation
  const currentPhraseActiveFrame = frame % holdFrames;

  // --- Image Animation ---
  const imageAnimationStart = 0; // Animation starts immediately when phrase becomes active
  const imageAnimationDuration = 30; // frames for fall and bounce

  const imageFallProgress = spring({
    frame: Math.max(0, currentPhraseActiveFrame - imageAnimationStart),
    fps: 30,
    config: springConfigSoftBounce,
    durationInFrames: imageAnimationDuration,
  });

  // Image falls from above the frame and bounces
  const imageTranslateY = interpolate(imageFallProgress, [0, 1], [-300, 0]); // Do not clamp to allow bounce overshoot
  // Image fades in as it falls
  const imageOpacity = interpolate(imageFallProgress, [0, 0.2], [0, 1], {
    extrapolateRight: "clamp", // Clamp opacity to stay between 0 and 1
  });
  // Image scales slightly as it falls, potentially with a small bounce
  const imageScale = interpolate(imageFallProgress, [0, 1], [0.9, 1]); // Do not clamp to allow bounce overshoot

  // --- Text Animation ---
  const textAnimationStart = 5; // Start text animations after image starts slightly
  const textAnimationDuration = 25; // frames for slide up

  const headerDelay = 0; // Header animates first (relative to textAnimationStart)
  const bodyDelay = 5; // Body text animates 5 frames after header

  // Header ([SIGNAL] prefix) animation
  const headerSlideInProgress = spring({
    frame: Math.max(0, currentPhraseActiveFrame - (textAnimationStart + headerDelay)),
    fps: 30,
    config: springConfigEaseOut,
    durationInFrames: textAnimationDuration,
  });
  const headerTranslateY = interpolate(headerSlideInProgress, [0, 1], [50, 0], {
    extrapolateRight: "clamp",
  });
  const headerOpacity = interpolate(headerSlideInProgress, [0, 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Main phrase animation
  const bodySlideInProgress = spring({
    frame: Math.max(0, currentPhraseActiveFrame - (textAnimationStart + bodyDelay)),
    fps: 30,
    config: springConfigEaseOut,
    durationInFrames: textAnimationDuration,
  });
  const bodyTranslateY = interpolate(bodySlideInProgress, [0, 1], [50, 0], {
    extrapolateRight: "clamp",
  });
  const bodyOpacity = interpolate(bodySlideInProgress, [0, 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });

  const hasImage = !!imageUrl;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <MatrixBackground bgColor={bgColor} opacity={0.2} fontFamily={resolvedFontFamily} />

      {displayPhrases.map((phrase, i) => {
        const isActive = currentIdx === i;

        // The parent div's opacity now directly depends on `isActive`.
        // This achieves the "hard cuts between phrases" by instantly showing/hiding the overall container.
        // The children handle their own animated opacities and transforms within the active period.
        const parentOpacity = isActive ? 1 : 0;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: hasImage && !p ? "row" : "column",
              alignItems: "center",
              justifyContent: "center",
              padding: hasImage && !p ? "0 8% 0 0" : "0 8%",
              gap: hasImage ? 48 : 0,
              textAlign: "center",
              opacity: parentOpacity, // Controlled by isActive for hard cuts
              // Ensures that only the active phrase is visible and interactive
              pointerEvents: isActive ? 'auto' : 'none',
            }}
          >
            {hasImage && (
              <div
                style={{
                  flex: "0 0 38%",
                  height: "100%",
                  padding: "8% 0 8% 8%",
                  // Apply image animations
                  opacity: imageOpacity,
                  transform: `translateY(${imageTranslateY}px) scale(${imageScale})`,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    border: `1px solid ${accent}33`,
                  }}
                >
                  <Img
                    src={imageUrl}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>
              </div>
            )}
            <div
              style={{
                flex: hasImage && !p ? 1 : "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Signal prefix */}
              <div
                style={{
                  fontSize: p ? 14 : 18,
                  fontWeight: 400,
                  color: `${accent}44`,
                  fontFamily: resolvedFontFamily,
                  letterSpacing: "0.2em",
                  marginBottom: p ? 12 : 20,
                  textTransform: "uppercase",
                  // Apply header text animations
                  opacity: headerOpacity,
                  transform: `translateY(${headerTranslateY}px)`,
                }}
              >
                [SIGNAL INTERCEPTED]
              </div>

              {/* Main phrase */}
              <div
                style={{
                  fontSize: titleFontSize ?? (p ? 84 : 78),
                  fontWeight: 700,
                  color: accent,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                  fontFamily: resolvedFontFamily,
                  textShadow: `0 0 16px ${accent}44`,
                  // Apply body text animations
                  opacity: bodyOpacity,
                  transform: `translateY(${bodyTranslateY}px)`,
                }}
              >
                {phrase.trim()}
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
