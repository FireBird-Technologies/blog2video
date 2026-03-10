import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { MatrixBackground } from "../MatrixBackground";
import type { MatrixLayoutProps } from "../types";

/**
 * TerminalText — Green Terminal Typewriter
 *
 * Monospace text types in character-by-character with blinking cursor.
 * One highlighted word glows brighter. Optional image alongside.
 */
export const TerminalText: React.FC<MatrixLayoutProps> = ({
  title,
  narration,
  imageUrl,
  highlightWord,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";
  const hasImage = !!imageUrl;

  const displayText = narration || title;

  // --- Animation Timings ---
  // contentOverallStartFrame acts as the general start point for the scene's main elements
  const contentOverallStartFrame = 5;

  // Image animation: slides from top with a bounce
  const imageStartFrame = contentOverallStartFrame;
  const imageEntryDuration = 30;
  const imageEntryProgress = spring({
    frame: frame - imageStartFrame,
    fps,
    config: { damping: 6, stiffness: 120, mass: 1 }, // Bounce configuration
    durationInFrames: imageEntryDuration,
  });

  const imageTranslateY = interpolate(imageEntryProgress, [0, 1], [-150, 0]); // Always slide from top
  const imageOpacity = interpolate(imageEntryProgress, [0, 1], [0, 1]);
  const imageScaleEffect = interpolate(imageEntryProgress, [0, 1], [0.9, 1]);

  // Glitch effect: flash between image and text appearing
  // Starts slightly before the image fully settles, for a smooth transition
  const glitchStartFrame = imageStartFrame + imageEntryDuration - 8;
  const glitchDuration = 10; // A quick flash duration
  const glitchProgress = spring({
    frame: frame - glitchStartFrame,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.5 },
    durationInFrames: glitchDuration,
  });

  const glitchOpacity = interpolate(glitchProgress, [0, 0.5, 1], [0, 1, 0]); // Flash in and out
  const glitchBrightness = interpolate(glitchProgress, [0, 0.5, 1], [1, 2, 1]);
  const glitchContrast = interpolate(glitchProgress, [0, 0.5, 1], [1, 1.5, 1]);
  const glitchHueRotate = interpolate(glitchProgress, [0, 0.5, 1], [0, 30, 0]); // Slight color shift
  const glitchScaleX = interpolate(glitchProgress, [0, 0.5, 1], [1, 1.02, 1]); // Slight horizontal stretch
  // Introduce a slight, deterministic horizontal wiggle for the glitch
  const glitchTranslateX = interpolate(glitchProgress, [0, 0.25, 0.75, 1], [0, 5, -5, 0]);

  // Text container animation: slams in from the left with an overshoot (like a punch)
  // Text entry starts as the glitch effect is fading out
  const textStartFrame = glitchStartFrame + glitchDuration - 5;
  const textEntryDuration = 25;
  const textEntryProgress = spring({
    frame: frame - textStartFrame,
    fps,
    config: { damping: 8, stiffness: 180, mass: 1, overshootClamping: false }, // Punch/overshoot config
    durationInFrames: textEntryDuration,
  });

  const textTranslateX = interpolate(textEntryProgress, [0, 1], [-200, 0]); // Slam from left
  const textOpacity = interpolate(textEntryProgress, [0, 1], [0, 1]);

  // Typing animation: begins after the text container has largely settled
  const typingStartFrame = textStartFrame + textEntryDuration - 5;
  const typingFrame = frame - typingStartFrame;

  const charsToShow = Math.min(
    Math.max(0, Math.floor(typingFrame * 1.8)),
    displayText.length
  );
  const visibleText = displayText.slice(0, charsToShow);
  const isTyping = charsToShow < displayText.length;
  const cursorVisible =
    (isTyping && typingFrame > 0) || (typingFrame > 0 && charsToShow === displayText.length && frame % 30 < 15);

  const words = visibleText.split(" ");

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <MatrixBackground bgColor={bgColor} opacity={0.2} />

      {/* Main content block (Image + Text Wrapper) */}
      {/* The overall content block itself no longer has an entrance animation, 
          as image and text now have their specific entrance animations. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: hasImage && !p ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          padding: p ? "10% 8%" : "0 8%",
          gap: hasImage ? (p ? 50 : 60) : 0,
        }}
      >
        {hasImage && (
          <div
            style={{
              flex: p ? "none" : "0 0 38%",
              width: p ? "80%" : "auto",
              height: p ? 240 : 400,
              overflow: "hidden",
              opacity: imageOpacity,
              transform: `translateY(${imageTranslateY}px) scale(${imageScaleEffect})`, // Image animated from top with bounce
              border: `1px solid ${accent}33`,
              position: "relative",
            }}
          >
            <Img
              src={imageUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {/* Scanline overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${accent}08 2px, ${accent}08 4px)`,
                pointerEvents: "none",
              }}
            />
          </div>
        )}

        <div
          style={{
            width: hasImage && !p ? "58%" : "85%",
            maxWidth: 1000,
            opacity: textOpacity, // Text animated with punch from left
            transform: `translateX(${textTranslateX}px)`,
          }}
        >
          {/* Prompt prefix */}
          <span
            style={{
              fontSize: titleFontSize ?? (p ? 68 : 48),
              fontWeight: 700,
              color: accent,
              fontFamily: "'Fira Code', 'Courier New', monospace",
              textShadow: `0 0 10px ${accent}66`,
            }}
          >
            {">"}&nbsp;
          </span>

          {/* Typed text */}
          {words.map((word, wi) => {
            const cleanWord = word.toLowerCase().replace(/[.,!?]/g, "");
            const isHighlight =
              highlightWord && cleanWord === highlightWord.toLowerCase();

            return (
              <span
                key={wi}
                style={{
                  fontSize: titleFontSize ?? (p ? 68 : 48),
                  fontWeight: isHighlight ? 700 : 400,
                  color: isHighlight ? "#FFFFFF" : accent,
                  fontFamily: "'Fira Code', 'Courier New', monospace",
                  lineHeight: 1.4,
                  textShadow: isHighlight
                    ? `0 0 16px ${accent}, 0 0 32px ${accent}66`
                    : "none",
                }}
              >
                {word}{" "}
              </span>
            );
          })}

          {/* Blinking cursor */}
          {cursorVisible && (
            <span
              style={{
                fontSize: titleFontSize ?? (p ? 68 : 48),
                fontWeight: 400,
                color: accent,
                fontFamily: "'Fira Code', 'Courier New', monospace",
                textShadow: `0 0 10px ${accent}`,
              }}
            >
              █
            </span>
          )}
        </div>
      </div>

      {/* Glitch Effect Overlay */}
      <AbsoluteFill
        style={{
          backgroundColor: accent, // Flash color
          opacity: glitchOpacity,
          transform: `scaleX(${glitchScaleX}) translateX(${glitchTranslateX}px)`,
          filter: `brightness(${glitchBrightness}) contrast(${glitchContrast}) hue-rotate(${glitchHueRotate}deg)`,
          pointerEvents: "none", // Ensure it doesn't block interactions
        }}
      />
    </AbsoluteFill>
  );
};
