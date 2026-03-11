import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { MatrixBackground } from "../MatrixBackground";
import type { MatrixLayoutProps } from "../types";

/**
 * DataStream — Incoming Data Packets
 *
 * Items appear one at a time, stacking vertically like incoming data.
 * Each item prefixed with `>` terminal prompt + index number.
 * Previous items dim as new ones appear.
 */
export const DataStream: React.FC<MatrixLayoutProps> = ({
  title,
  items,
  imageUrl,
  accentColor,
  bgColor,
  textColor, // Not used but kept in props for consistency
  aspectRatio,
  titleFontSize, // Not explicitly used for general items, but kept for consistency
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";
  const hasImage = !!imageUrl;

  const displayItems = items || [title];
  const framesPerLine = 25; // Duration for one full line to appear word by word
  const framesPerWord = 3;  // Delay between words in a line
  const initialImageDelay = 0; // Image starts immediately
  const imageAnimationDuration = 60; // How long image takes to fully animate in (2 seconds)
  const textAnimationDelayAfterImage = 15; // Delay before text starts animating after image is done

  // --- Image Animation ---
  const imageAnimationProgress = spring({
    frame: frame - initialImageDelay,
    fps,
    config: { damping: 20, stiffness: 80 }, // Adjusted stiffness for smoother drift
    durationInFrames: imageAnimationDuration,
    from: 0,
    to: 1,
  });

  const imageOpacity = interpolate(imageAnimationProgress, [0, 1], [0, 1]);
  const imageTranslateX = interpolate(imageAnimationProgress, [0, 1], [-50, 0]); // Drifts from slight left
  const imageBlur = interpolate(imageAnimationProgress, [0, 1], [10, 0]); // Clears depth-of-field blur
  const imageScale = interpolate(imageAnimationProgress, [0, 1], [1.05, 1]); // Starts slightly larger

  // Determine current active line for dimming effect
  const textStartFrame = initialImageDelay + imageAnimationDuration + textAnimationDelayAfterImage;
  const currentLineIdx = Math.min(
    Math.floor((frame - textStartFrame) / framesPerLine),
    displayItems.length - 1
  );


  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: bgColor }}>
      <MatrixBackground bgColor={bgColor} opacity={0.2} />

      {hasImage && (
        <div
          style={{
            position: "absolute",
            top: p ? "8%" : "5%", // Upper portion positioning for image
            left: "50%",
            transform: `translateX(calc(-50% + ${imageTranslateX}px)) scale(${imageScale})`, // Center horizontally + drift + scale
            width: p ? "70%" : "50%",
            maxWidth: p ? 500 : 700,
            height: "auto", // Allow height to adjust based on aspect ratio
            opacity: imageOpacity,
            filter: `blur(${imageBlur}px)`,
            zIndex: 10,
            paddingBottom: p ? 0 : 30, // Breathing room below image in landscape
          }}
        >
          <Img
            src={imageUrl}
            style={{
              width: "100%",
              height: "auto",
              maxHeight: p ? 400 : 500, // Limit image height
              objectFit: "contain", // Use 'contain' to ensure full image is visible
              borderRadius: 8, // Soft edges for the image container
            }}
          />
        </div>
      )}

      {/* Main content container for text */}
      <div
        style={{
          position: "absolute",
          top: hasImage ? (p ? "40%" : "60%") : "50%", // Adjust text vertical position based on image presence and aspect ratio
          left: "50%",
          transform: `translateX(-50%)`, // Center horizontally
          width: p ? "85%" : "80%",
          maxWidth: p ? 600 : 1000,
          display: "flex",
          flexDirection: "column",
          gap: p ? 12 : 20,
          paddingTop: hasImage ? 0 : (p ? "8%" : "0"), // Adjust padding if no image
          paddingBottom: p ? "8%" : "0", // Add bottom padding for breathing room if portrait
          zIndex: 20,
        }}
      >
        {displayItems.map((item, i) => {
          const lineAppearStartFrame = textStartFrame + (i * framesPerLine);

          const lineOpacity = interpolate(
            frame,
            [lineAppearStartFrame, lineAppearStartFrame + framesPerLine, lineAppearStartFrame + framesPerLine + 30], // Animation stages
            [0, 1, (i < currentLineIdx) ? 0.3 : 1], // Fade in, then dim if previous line
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          // Split the item into words, preserving spaces so spacing is maintained
          const words = item.split(/(\s+)/);

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: p ? 10 : 16,
                opacity: lineOpacity, // Apply dimming to the entire line container
                filter: `drop-shadow(0 0 8px ${accent}66)`, // Text shadow
              }}
            >
              <span
                style={{
                  fontSize: descriptionFontSize ?? (p ? 59 : 67),
                  fontWeight: 700,
                  color: accent,
                  fontFamily: "'Fira Code', 'Courier New', monospace",
                  minWidth: p ? 70 : 90,
                  whiteSpace: "nowrap", // Prevent "> 01" from wrapping
                }}
              >
                {">"} {String(i + 1).padStart(2, "0")}
              </span>
              <span
                style={{
                  fontSize: descriptionFontSize ?? (p ? 59 : 67),
                  fontWeight: 400,
                  color: accent,
                  fontFamily: "'Fira Code', 'Courier New', monospace",
                  letterSpacing: "0.01em",
                  display: "flex", // Enable flex for word rendering
                  flexWrap: "wrap", // Allow words to wrap
                }}
              >
                {words.map((word, wordIdx) => {
                  const wordAppearFrame = lineAppearStartFrame + (wordIdx * framesPerWord);
                  const wordIsShown = frame >= wordAppearFrame;

                  const wordSpring = spring({
                    frame: frame - wordAppearFrame,
                    fps,
                    config: {
                      damping: 18,
                      stiffness: 180,
                      mass: 1,
                    },
                    from: 0,
                    to: 1,
                    durationInFrames: 30, // Word animation lasts a bit longer for smoothness
                  });

                  // If it's a space, render it directly without animation
                  if (word.trim() === '') {
                      return <span key={`${i}-${wordIdx}-space`}>{word}</span>;
                  }

                  const translateY = interpolate(wordSpring, [0, 1], [50, 0]); // Rises from bottom
                  const wordOpacity = interpolate(wordSpring, [0, 1], [0, 1]); // Fades in

                  return (
                    <span
                      key={`${i}-${wordIdx}`}
                      style={{
                        display: 'inline-block', // Important for translateY on individual words
                        transform: `translateY(${wordIsShown ? translateY : 50}px)`, // Keep hidden words off-screen
                        opacity: wordIsShown ? wordOpacity : 0, // Keep hidden words invisible
                        marginRight: '0.25em', // Add a consistent space after each word
                      }}
                    >
                      {word}
                    </span>
                  );
                })}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
