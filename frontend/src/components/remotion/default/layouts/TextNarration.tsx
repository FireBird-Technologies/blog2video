import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from "remotion";
import React from "react";
import { SceneLayoutProps } from "../types";

// A decorative geometric shape to be placed in the corners.
const CornerShape: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const purple = "#6366F1";
  const cyan = "#22D3EE";

  return (
    <div style={{ position: "absolute", ...style }}>
      <svg
        width="500"
        height="500"
        viewBox="0 0 150 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M137.5 73L101 131.5L28.5 110.5L2.5 40.5L50.5 3.5L137.5 73Z"
          stroke={purple}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M147.5 42L112.5 2L42.5 21L8 85.5L46 148L147.5 42Z"
          stroke={cyan}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export const TextNarration: React.FC<SceneLayoutProps> = ({
  title,
  narration,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const p = aspectRatio === "portrait";

  // Title: spring-driven entrance with slide up
  const titleSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 200, stiffness: 250, mass: 1.2 },
  });
  const titleOp = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [30, 0]);

  // Narration: spring-driven with slight delay for initial entrance
  const textSpring = spring({
    frame: frame - 20,
    fps,
    config: { damping: 200, stiffness: 250 },
  });
  const textOp = interpolate(textSpring, [0, 1], [0, 1]);

  // Corner shapes entrance animation
  const shapeEntranceSpring = spring({
    frame: frame,
    fps,
    config: { damping: 200, stiffness: 150 },
  });
  const entranceShapeScale = interpolate(shapeEntranceSpring, [0, 1], [0.6, 1]);
  const entranceShapeOpacity = interpolate(shapeEntranceSpring, [0, 1], [0, 1]);

  // Corner shapes exit animation: move to center and vanish
  const vanishAnimationDuration = 45; // frames (1.5 seconds at 30fps)
  const vanishStartFrame = durationInFrames - vanishAnimationDuration;

  const shapeExitSpring = spring({
    frame: frame - vanishStartFrame,
    fps,
    config: { damping: 200, stiffness: 150, mass: 0.8 },
    durationInFrames: vanishAnimationDuration,
  });

  const exitShapeScale = interpolate(shapeExitSpring, [0, 1], [1, 0]);
  const exitShapeOpacity = interpolate(shapeExitSpring, [0, 1], [1, 0]);

  // Combined scale and opacity for shapes (entrance * exit)
  const combinedShapeScale = entranceShapeScale * exitShapeScale;
  const combinedShapeOpacity = entranceShapeOpacity * exitShapeOpacity;

  // Text fade out at the end, synchronized with shape exit
  // This will be for individual characters now, but need a master spring
  const maxCharFadeOutDelay = 15; // Max additional delay for a single character's fade-out in frames
  const charBlowAwayDuration = vanishAnimationDuration + maxCharFadeOutDelay;

  const charFadeOutSpring = spring({
    frame: frame - vanishStartFrame,
    fps,
    config: { damping: 200, stiffness: 150, mass: 0.8 },
    durationInFrames: charBlowAwayDuration, // Extend duration to accommodate staggered delays
  });

  const cornerOffset = p ? -100 : -150;
  const shapeSize = 500; // Based on SVG width/height in CornerShape
  const centerScreenX = width / 2;
  const centerScreenY = height / 2;

  // --- Top-Left Shape (no initial scale flips) ---
  const initialCenterX_TL = cornerOffset + shapeSize / 2;
  const initialCenterY_TL = cornerOffset + shapeSize / 2;
  const deltaX_TL = centerScreenX - initialCenterX_TL;
  const deltaY_TL = centerScreenY - initialCenterY_TL;
  const tx_TL = interpolate(shapeExitSpring, [0, 1], [0, deltaX_TL]);
  const ty_TL = interpolate(shapeExitSpring, [0, 1], [0, deltaY_TL]);

  // --- Top-Right Shape (scaleX(-1) applied) ---
  const initialCenterX_TR = width - cornerOffset - shapeSize / 2;
  const initialCenterY_TR = cornerOffset + shapeSize / 2;
  const deltaX_TR = centerScreenX - initialCenterX_TR;
  const deltaY_TR = centerScreenY - initialCenterY_TR;
  const tx_TR = interpolate(shapeExitSpring, [0, 1], [0, -deltaX_TR]);
  const ty_TR = interpolate(shapeExitSpring, [0, 1], [0, deltaY_TR]);

  // --- Bottom-Left Shape (scaleY(-1) applied) ---
  const initialCenterX_BL = cornerOffset + shapeSize / 2;
  const initialCenterY_BL = height - cornerOffset - shapeSize / 2;
  const deltaX_BL = centerScreenX - initialCenterX_BL;
  const deltaY_BL = centerScreenY - initialCenterY_BL;
  const tx_BL = interpolate(shapeExitSpring, [0, 1], [0, deltaX_BL]);
  const ty_BL = interpolate(shapeExitSpring, [0, 1], [0, -deltaY_BL]);

  // --- Bottom-Right Shape (scaleX(-1) and scaleY(-1) applied) ---
  const initialCenterX_BR = width - cornerOffset - shapeSize / 2;
  const initialCenterY_BR = height - cornerOffset - shapeSize / 2;
  const deltaX_BR = centerScreenX - initialCenterX_BR;
  const deltaY_BR = centerScreenY - initialCenterY_BR;
  const tx_BR = interpolate(shapeExitSpring, [0, 1], [0, -deltaX_BR]);
  const ty_BR = interpolate(shapeExitSpring, [0, 1], [0, -deltaY_BR]);

  // Determine if text is explicitly black or very dark
  const isDarkText = textColor === '#000000' || textColor === '#000' || textColor === 'black';

  // Adjust background color: if text is dark, make background white for prominence.
  // Otherwise, use the provided bgColor.
  const adjustedBgColor = isDarkText ? '#FFFFFF' : bgColor;

  // Adjust narration text opacity for steady state: if text is dark, make it fully opaque for prominence.
  // Otherwise, use the original reduced opacity.
  const narrationSteadyOpacity = isDarkText ? textOp : textOp * 0.7;

  // --- Character-level animation setup ---
  interface AnimatedChar {
    id: string; // Unique ID for React key
    char: string;
    globalIndex: number;
    wordIndex: number; // -1 for spaces
    offsetX: number; // For 'blown away' effect
    offsetY: number; // For 'blown away' effect
    rotate: number; // For 'blown away' effect
    delay: number; // Small random delay for individual char fade-out
  }

  const allAnimatedChars = React.useMemo(() => {
    const chars: AnimatedChar[] = [];
    let globalIdx = 0;
    let wordIdx = 0;

    // Split by spaces, keeping spaces as separate segments
    narration.split(/(\s+)/g).forEach(segment => {
      if (segment.length === 0) return; // Handle empty strings from split

      if (segment.match(/^\s+$/)) { // Check if segment contains only spaces
        segment.split('').forEach(char => {
          chars.push({
            id: `char-${globalIdx}`,
            char: char,
            globalIndex: globalIdx++,
            wordIndex: -1, // Mark as space
            offsetX: Math.random() * 200 - 100, // Range -100 to 100
            offsetY: Math.random() * 200 - 100,
            rotate: Math.random() * 720 - 360, // Range -360 to 360 degrees
            delay: Math.random() * maxCharFadeOutDelay,
          });
        });
      } else { // This is a word
        segment.split('').forEach(char => {
          chars.push({
            id: `char-${globalIdx}`,
            char: char,
            globalIndex: globalIdx++,
            wordIndex: wordIdx,
            offsetX: Math.random() * 200 - 100,
            offsetY: Math.random() * 200 - 100,
            rotate: Math.random() * 720 - 360,
            delay: Math.random() * maxCharFadeOutDelay,
          });
        });
        wordIdx++;
      }
    });
    return chars;
  }, [narration, maxCharFadeOutDelay]);

  // NEW: Identify all unique word indices
  const allWordIndices = React.useMemo(() => {
    const wordIndexes = new Set<number>();
    allAnimatedChars.forEach(c => {
      if (c.wordIndex !== -1) {
        wordIndexes.add(c.wordIndex);
      }
    });
    return Array.from(wordIndexes);
  }, [allAnimatedChars]);

  // NEW: Randomly select 4 word indices for highlighting and sizing
  const randomSelectedWordIndexes = React.useMemo(() => {
    if (allWordIndices.length === 0) return [];

    const shuffled = [...allWordIndices].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(4, shuffled.length));
  }, [allWordIndices]);

  // Calculate timing for word-by-word highlight
  const narrationInitialAnimationStart = 20; // Corresponds to `textSpring` frame offset
  const narrationWordAnimationEndFrame = vanishStartFrame - 5; // End word animation slightly before char fade starts
  const numWords = new Set(allAnimatedChars.filter(c => c.wordIndex !== -1).map(c => c.wordIndex)).size;
  const wordHighlightTotalDuration = narrationWordAnimationEndFrame - narrationInitialAnimationStart;
  const framesPerWordHighlight = numWords > 0 ? wordHighlightTotalDuration / numWords : 0;


  return (
    <AbsoluteFill
      style={{
        backgroundColor: adjustedBgColor,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <CornerShape
        style={{
          opacity: combinedShapeOpacity,
          top: cornerOffset,
          left: cornerOffset,
          transform: `scale(${combinedShapeScale}) translateX(${tx_TL}px) translateY(${ty_TL}px)`,
        }}
      />
      <CornerShape
        style={{
          opacity: combinedShapeOpacity,
          top: cornerOffset,
          right: cornerOffset,
          transform: `scale(${combinedShapeScale}) scaleX(-1) translateX(${tx_TR}px) translateY(${ty_TR}px)`,
        }}
      />
      <CornerShape
        style={{
          opacity: combinedShapeOpacity,
          bottom: cornerOffset,
          left: cornerOffset,
          transform: `scale(${combinedShapeScale}) scaleY(-1) translateX(${tx_BL}px) translateY(${ty_BL}px)`,
        }}
      />
      <CornerShape
        style={{
          opacity: combinedShapeOpacity,
          bottom: cornerOffset,
          right: cornerOffset,
          transform: `scale(${combinedShapeScale}) scaleX(-1) scaleY(-1) translateX(${tx_BR}px) translateY(${ty_BR}px)`,
        }}
      />

      <div
        style={{
          textAlign: "center",
          maxWidth: p ? "90%" : "75%",
        }}
      >
        <h1
          style={{
            color: textColor,
            fontSize: titleFontSize ?? (p ? 102 : 84),
            fontWeight: 800,
            opacity: titleOp * interpolate(charFadeOutSpring, [0, 1], [1, 0]), // Title fades out with the first char
            transform: `translateY(${titleY}px)`,
            margin: 0,
            marginBottom: 32,
            fontFamily: "'Roboto Slab', serif",
            lineHeight: 1.1,
            whiteSpace: "pre-wrap",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            color: textColor,
            fontSize: descriptionFontSize ?? (p ? 52 : 47),
            lineHeight: 1.5,
            maxWidth: "45ch",
            margin: "0 auto",
            fontFamily: "'Roboto Slab', serif",
            display: "flex", // Enable flexbox for character spacing and wrapping
            flexWrap: "wrap", // Allow text to wrap naturally
            justifyContent: "center", // Center the line of text
            // Opacity is handled per character below
          }}
        >
          {allAnimatedChars.map(animatedChar => {
            const { char, id, wordIndex, offsetX, offsetY, rotate, delay } = animatedChar;

            // --- Word grow and shrink animation ---
            let currentWordScale = 1;
            let isRandomBigWord = false;
            let fontWeightStyle: React.CSSProperties = {}; // New style object for highlighting

            if (wordIndex !== -1) { // Only for actual words, not spaces
              isRandomBigWord = randomSelectedWordIndexes.includes(wordIndex);

              const GROW_DURATION_MAX = 15; // Max frames to grow from 1 to 1.2
              const SHRINK_DURATION_MAX = 15; // Max frames to shrink from 1.2 to 1

              const wordStartTime = narrationInitialAnimationStart + wordIndex * framesPerWordHighlight;

              // Calculate the current frame relative to the word's animation start
              const progress = frame - wordStartTime;

              // The total duration for which a word's scale animation is active.
              const wordAnimationTotalDuration = framesPerWordHighlight;

              if (wordAnimationTotalDuration <= 0) {
                  currentWordScale = 1; // No animation if duration is 0 or negative (e.g., no words)
              } else if (wordAnimationTotalDuration < GROW_DURATION_MAX + SHRINK_DURATION_MAX) {
                  // If the total duration for a word is too short for full grow and shrink phases,
                  currentWordScale = interpolate(
                      progress,
                      [
                          0, // Start of animation window, scale is 1
                          wordAnimationTotalDuration / 2, // Peak, scale is 1.4
                          wordAnimationTotalDuration // End of animation window, scale is 1
                      ],
                      [1, 1, 1],
                      {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                      }
                  );
              } else {
                  // Enough time for full grow, a plateau at 1.2, and then shrink.
                  currentWordScale = interpolate(
                      progress,
                      [
                          0, // Start of animation window, scale is 1
                          GROW_DURATION_MAX, // End of grow phase, scale is 1.2
                          wordAnimationTotalDuration - SHRINK_DURATION_MAX, // Start of shrink phase, scale is 1.2
                          wordAnimationTotalDuration // End of animation window, scale is 1
                      ],
                      [1, 1.2, 1.2, 1],
                      {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                      }
                  );
              }

              // Apply additional scale and highlight if this is one of the randomly selected words
              if (isRandomBigWord) {
                currentWordScale *= 1.2; // Increase size by an additional 20%
                fontWeightStyle = { fontWeight: 'bold' }; // Make it bold
              }
            }

            // --- Character fade-out/blown away animation ---
            // Interpolate the overall spring progress for each character individually, considering its delay
            const charOpacity = interpolate(
              charFadeOutSpring,
              [delay / charBlowAwayDuration, 1 + delay / charBlowAwayDuration], // Shift input range for staggered fade
              [narrationSteadyOpacity, 0], // Starts at steady narration opacity, fades to 0
              {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }
            );

            const charTranslateX = interpolate(
              charFadeOutSpring,
              [delay / charBlowAwayDuration, 1 + delay / charBlowAwayDuration],
              [0, offsetX],
              {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }
            );

            const charTranslateY = interpolate(
              charFadeOutSpring,
              [delay / charBlowAwayDuration, 1 + delay / charBlowAwayDuration],
              [0, offsetY],
              {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }
            );

            const charRotate = interpolate(
              charFadeOutSpring,
              [delay / charBlowAwayDuration, 1 + delay / charBlowAwayDuration],
              [0, rotate],
              {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }
            );

            // Calculate dynamic letter spacing based on currentWordScale
            const letterSpacingValue = interpolate(
              currentWordScale, // Use the potentially modified scale here
              [1, 2], // currentWordScale goes from 1 (normal) to 2 (max for short durations + random big word)
              [0, 0.15], // letter-spacing in em units, adjust as needed
              {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }
            );

            return (
              <span
                key={id}
                style={{
                  ...fontWeightStyle, // Apply bold style if it's a random big word
                  display: 'inline-block', // Crucial for transforms
                  opacity: charOpacity,
                  transform: `scale(${currentWordScale}) translateX(${charTranslateX}px) translateY(${charTranslateY}px) rotate(${charRotate}deg)`,
                  whiteSpace: 'pre', // Preserve whitespace for correct flow, even if char is a space
                  lineHeight: 'inherit', // Maintain parent's line height
                  letterSpacing: `${letterSpacingValue}em`, // Apply dynamic letter spacing
                }}
              >
                {char}
              </span>
            );
          })}
        </p>
      </div>
    </AbsoluteFill>
  );
};
