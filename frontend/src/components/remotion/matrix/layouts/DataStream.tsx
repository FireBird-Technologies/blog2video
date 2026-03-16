import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { MatrixBackground } from "../MatrixBackground";
import { MATRIX_DEFAULT_FONT_FAMILY } from "../constants";
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
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";
  const hasImage = !!imageUrl;
  const resolvedFontFamily = fontFamily ?? MATRIX_DEFAULT_FONT_FAMILY;

  const displayItems = items || [title];
  const framesPerLine = 40; // Duration for one full line to appear word by word
  const framesPerWord = 4;  // Delay between words in a line
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


  const itemCount = displayItems.length;
  const baseFontSize = p ? 56 : 64;
  const scaledFontSize = Math.max(
    p ? 24 : 28,
    Math.min(baseFontSize, Math.floor(baseFontSize * (4 / Math.max(itemCount, 4))))
  );
  const computedFontSize = descriptionFontSize ?? scaledFontSize;
  const prefixWidth = p ? 110 : 132;
  const stackPaddingTop = hasImage ? (p ? 56 : 36) : (p ? 180 : 140);
  const stackPaddingBottom = p ? 120 : 84;
  const stackPaddingX = p ? 40 : 88;
  const listMaxWidth = hasImage ? (p ? 760 : 920) : (p ? 820 : 1080);

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: bgColor }}>
      <MatrixBackground bgColor={bgColor} opacity={0.2} fontFamily={resolvedFontFamily} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: `${stackPaddingTop}px ${stackPaddingX}px ${stackPaddingBottom}px`,
          boxSizing: "border-box",
          zIndex: 20,
        }}
      >
        {hasImage && (
          <div
            style={{
              width: p ? "60%" : "35%",
              maxWidth: p ? 400 : 500,
              height: "auto",
              marginBottom: p ? 32 : 40,
              opacity: imageOpacity,
              filter: `blur(${imageBlur}px)`,
              transform: `translateX(${imageTranslateX}px) scale(${imageScale})`,
            }}
          >
            <Img
              src={imageUrl}
              style={{
                width: "100%",
                height: "auto",
                maxHeight: p ? 260 : 300,
                objectFit: "contain",
                borderRadius: 8,
              }}
            />
          </div>
        )}

        <div
          style={{
            width: "100%",
            maxWidth: listMaxWidth,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: p ? 14 : 18,
          }}
        >
        {displayItems.map((item, i) => {
          const lineAppearStartFrame = textStartFrame + (i * framesPerLine);

          const lineEnd = lineAppearStartFrame + framesPerLine;
          const lineOpacity = interpolate(
            frame,
            [lineAppearStartFrame, lineAppearStartFrame + 20, lineEnd, lineEnd + 30],
            [0, 1, 1, (i < currentLineIdx) ? 0.3 : 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          const words = item.trim().split(/\s+/).filter(Boolean);

          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: `${prefixWidth}px minmax(0, 1fr)`,
                alignItems: "flex-start",
                width: "100%",
                columnGap: p ? 18 : 24,
                opacity: lineOpacity,
                filter: `drop-shadow(0 0 8px ${accent}66)`,
              }}
            >
              <div
                style={{
                  fontSize: computedFontSize,
                  fontWeight: 700,
                  color: accent,
                  fontFamily: resolvedFontFamily,
                  lineHeight: 1.4,
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "baseline",
                  gap: "0.34em",
                  whiteSpace: "nowrap",
                }}
              >
                <span>{">"}</span>
                <span>{String(i + 1).padStart(2, "0")}</span>
              </div>
              <span
                style={{
                  fontSize: computedFontSize,
                  fontWeight: 400,
                  color: accent,
                  fontFamily: resolvedFontFamily,
                  letterSpacing: "0.01em",
                  lineHeight: 1.4,
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  justifyContent: "flex-start",
                  columnGap: "0.38em",
                  rowGap: "0.14em",
                }}
              >
                {words.map((word, wordIdx) => {
                  const wordAppearFrame = lineAppearStartFrame + (wordIdx * framesPerWord);
                  const wordIsShown = frame >= wordAppearFrame;

                  const wordSpring = spring({
                    frame: frame - wordAppearFrame,
                    fps,
                    config: {
                      damping: 22,
                      stiffness: 120,
                      mass: 1,
                    },
                    from: 0,
                    to: 1,
                    durationInFrames: 30,
                  });

                  const translateY = interpolate(wordSpring, [0, 1], [30, 0]);
                  const wordOpacity = interpolate(wordSpring, [0, 1], [0, 1]);

                  return (
                    <span
                      key={`${i}-${wordIdx}`}
                      style={{
                        display: "inline-block",
                        transform: `translateY(${wordIsShown ? translateY : 30}px)`,
                        opacity: wordIsShown ? wordOpacity : 0,
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
      </div>
    </AbsoluteFill>
  );
};
