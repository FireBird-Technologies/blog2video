import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { MatrixBackground } from "../MatrixBackground";
import { MATRIX_DEFAULT_FONT_FAMILY } from "../constants";
import type { MatrixLayoutProps } from "../types";

/**
 * Awakening — Blur-to-Sharp Closer
 *
 * Text sharpens from gaussian blur (like waking from the Matrix).
 * Green underline draws beneath key phrase. System-style CTA fades in.
 * Always the last scene.
 */
export const Awakening: React.FC<MatrixLayoutProps> = ({
  title,
  narration,
  highlightPhrase,
  cta,
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
  const fps = 30;
  const p = aspectRatio === "portrait";
  const accent = accentColor || "#00FF41";
  const resolvedFontFamily = fontFamily ?? MATRIX_DEFAULT_FONT_FAMILY;

  // Existing line animation for highlight phrase
  const lineSpring = spring({
    frame: frame - 28,
    fps,
    config: { damping: 18, stiffness: 180 },
  });

  // Image animation: starts completely transparent and scales up from 80% to 100% size with a slow ease-in.
  const imageDelay = 10;
  const imageAnimSpring = spring({
    frame: frame - imageDelay,
    fps,
    config: { damping: 18, stiffness: 90, mass: 1.2 }, // Slower ease-in
  });
  const imageOpacityAnim = interpolate(imageAnimSpring, [0, 1], [0, 1]); // From transparent
  const imageScaleAnim = interpolate(imageAnimSpring, [0, 1], [0.8, 1]); // From 80% to 100%

  // CTA animation: slides in from the right edge with a smooth ease-out, landing last.
  const ctaDelay = 60; // Start after image and headline
  const ctaSlideSpring = spring({
    frame: frame - ctaDelay,
    fps,
    config: { damping: 16, stiffness: 100, mass: 1 }, // Smooth ease-out
  });

  const ctaSlideX = interpolate(ctaSlideSpring, [0, 1], [300, 0]); // From 300px right to 0
  const ctaOpacityAnim = interpolate(ctaSlideSpring, [0, 0.2, 1], [0, 1, 1]); // Fade in slightly as it slides

  const displayText = narration || title;
  const displayCta = cta || "> Read the full article";
  const hasImage = !!imageUrl;

  // Headline animation: each word fades in one at a time from slight blur to sharp focus.
  const wordDelay = 5; // Frames between each word animation start
  const renderAnimatedHeadline = () => {
    const processedElements: React.ReactNode[] = [];
    let currentWordIdx = 0; // Global word counter for staggered animation

    // Helper to animate a segment of text (words and spaces)
    const animateSegment = (segmentText: string, isHighlightSegment: boolean) => {
      // Split by spaces, but keep the spaces themselves for correct re-assembly
      const segmentWordsAndSpaces = segmentText.split(/(\s+)/).filter(s => s.length > 0);

      segmentWordsAndSpaces.forEach((wordOrSpace, index) => {
        if (wordOrSpace.trim() === '') {
          // Render spaces directly without animation
          processedElements.push(<span key={`space-${currentWordIdx}-${index}`}>{wordOrSpace}</span>);
        } else {
          // It's a word, apply animation
          const startFrame = currentWordIdx * wordDelay;
          const wordAnimProgress = spring({
            frame: frame - startFrame,
            fps,
            config: { damping: 15, stiffness: 80 },
          });

          const wordOpacity = interpolate(wordAnimProgress, [0, 1], [0, 1], {
            extrapolateRight: "clamp",
          });
          const wordBlur = interpolate(wordAnimProgress, [0, 1], [8, 0], {
            extrapolateRight: "clamp",
          });

          processedElements.push(
            <span
              key={`animated-word-${currentWordIdx}`}
              style={{
                display: "inline-block", // Crucial for individual word animation
                opacity: wordOpacity,
                filter: `blur(${wordBlur}px)`,
                color: isHighlightSegment ? "#FFFFFF" : accent, // Apply highlight color
                position: "relative",
                textShadow: wordBlur < 2 ? `0 0 12px ${accent}44` : "none",
              }}
            >
              {wordOrSpace}
            </span>
          );
          currentWordIdx++;
        }
      });
    };

    if (!highlightPhrase) {
      animateSegment(displayText, false);
    } else {
      const idx = displayText.toLowerCase().indexOf(highlightPhrase.toLowerCase());
      if (idx === -1) {
        animateSegment(displayText, false);
      } else {
        const before = displayText.slice(0, idx);
        const match = displayText.slice(idx, idx + highlightPhrase.length);
        const after = displayText.slice(idx + highlightPhrase.length);

        animateSegment(before, false);

        // For the match, we need a container span for the underline
        const matchWordsAndSpaces = match.split(/(\s+)/).filter(s => s.length > 0);
        const animatedMatchWords: React.ReactNode[] = [];
        matchWordsAndSpaces.forEach((wordOrSpace, index) => {
          if (wordOrSpace.trim() === '') {
            animatedMatchWords.push(<span key={`match-space-${currentWordIdx}-${index}`}>{wordOrSpace}</span>);
          } else {
            const startFrame = currentWordIdx * wordDelay;
            const wordAnimProgress = spring({
              frame: frame - startFrame,
              fps,
              config: { damping: 15, stiffness: 80 },
            });
            const wordOpacity = interpolate(wordAnimProgress, [0, 1], [0, 1], {
              extrapolateRight: "clamp",
            });
            const wordBlur = interpolate(wordAnimProgress, [0, 1], [8, 0], {
              extrapolateRight: "clamp",
            });

            animatedMatchWords.push(
              <span
                key={`match-word-${currentWordIdx}`}
                style={{
                  display: "inline-block",
                  opacity: wordOpacity,
                  filter: `blur(${wordBlur}px)`,
                  color: "#FFFFFF", // Always white for highlight
                  position: "relative",
                  textShadow: wordBlur < 2 ? `0 0 12px ${accent}44` : "none",
                }}
              >
                {wordOrSpace}
              </span>
            );
            currentWordIdx++;
          }
        });
        processedElements.push(
          <span key="highlight-container" style={{ position: "relative", display: "inline-block" }}>
            {animatedMatchWords}
            <span
              style={{
                position: "absolute",
                bottom: -4,
                left: 0,
                height: 2,
                width: `${lineSpring * 100}%`,
                backgroundColor: accent,
                boxShadow: `0 0 8px ${accent}`,
                display: "block",
              }}
            />
          </span>
        );
        animateSegment(after, false);
      }
    }
    return processedElements;
  };

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <MatrixBackground bgColor={bgColor} opacity={0.15} fontFamily={resolvedFontFamily} />

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
              overflow: "hidden",
              opacity: imageOpacityAnim, // Apply animated opacity
              transform: `scale(${imageScaleAnim})`, // Apply animated scale
              border: `1px solid ${accent}33`,
            }}
          >
            <Img
              src={imageUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
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
          <div
            style={{
              fontSize: titleFontSize ?? (p ? 40 : 46),
              fontWeight: 700,
              color: accent, // Default color, words will override if highlighted
              letterSpacing: "-0.01em",
              lineHeight: 1.3,
              // Removed global blur and opacity, now handled per word
              fontFamily: resolvedFontFamily,
              position: "relative",
              // Removed global text shadow, now handled per word
            }}
          >
            {renderAnimatedHeadline()}
          </div>

          <div
            style={{
              marginTop: p ? 24 : 36,
              fontSize: descriptionFontSize ?? (p ? 37 : 24),
              fontWeight: 400,
              color: `${accent}66`,
              letterSpacing: "0.1em",
              fontFamily: resolvedFontFamily,
              opacity: ctaOpacityAnim, // Apply animated opacity
              transform: `translateX(${ctaSlideX}px)`, // Apply animated slide from right
            }}
          >
            [EXECUTE] {displayCta}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
