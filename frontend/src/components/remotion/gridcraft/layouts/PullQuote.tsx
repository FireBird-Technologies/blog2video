import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img } from "remotion";
import { GridcraftLayoutProps } from "../types";
import {
  GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY,
  GRIDCRAFT_DEFAULT_SERIF_FONT_FAMILY,
} from "../constants";
import { glass, COLORS } from "../utils/styles";

export const PullQuote: React.FC<GridcraftLayoutProps> = ({
  quote,
  attribution,
  highlightPhrase,
  title,
  subtitle,
  narration,
  imageUrl,
  accentColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const text = quote || title || "Quote goes here";
  const source = attribution || subtitle || narration || "Author";
  const words = text.split(" ");
  const hasImage = !!imageUrl;
  const p = aspectRatio === "portrait";
  const sansFontFamily = fontFamily ?? GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY;
  const serifFontFamily = fontFamily ?? GRIDCRAFT_DEFAULT_SERIF_FONT_FAMILY;
  const quoteFontFamily = p ? sansFontFamily : serifFontFamily;

  const highlightWords = (highlightPhrase || "").split(" ").map(w => w.toLowerCase().replace(/[.,!?;:]/g, ""));

  const imageOpacity = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });
  const imageScale = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 14 } });

  // Animation timings and properties
  // 1. Opening quotation mark animation
  const qMarkStartFrame = 0;
  const qMarkEndFrame = 30; // Animation finishes at frame 30

  const qMarkOpacity = interpolate(frame, [qMarkStartFrame, qMarkEndFrame], [0, 0.2], {
    extrapolateRight: "clamp",
  });
  const qMarkDropProgress = spring({
    frame: Math.max(0, frame - qMarkStartFrame),
    fps,
    config: {
      damping: 10, // Creates a gentle bounce
      stiffness: 100,
      mass: 0.8,
    },
    durationInFrames: qMarkEndFrame - qMarkStartFrame,
  });
  const qMarkTranslateY = interpolate(qMarkDropProgress, [0, 1], [-40, 0]); // Starts 40px above, drops to its final position

  // 2. Quote text word-by-word animation
  const wordAnimationStartDelay = qMarkEndFrame; // Start words after quote mark finishes
  const wordAnimationDurationPerWord = 15;
  const wordDelayMultiplier = 4; // Delay between each word's animation start

  // 3. Attribution line animation
  // Calculate when the last word animation finishes
  const lastWordAnimationEndFrame = wordAnimationStartDelay + (words.length - 1) * wordDelayMultiplier + wordAnimationDurationPerWord;
  const attributionPauseFrames = 15; // Short pause after quote finishes
  const attributionStartFrame = lastWordAnimationEndFrame + attributionPauseFrames;
  const attributionEndFrame = attributionStartFrame + 25; // Animation duration for attribution (fade + slide)

  const attributionOpacity = interpolate(frame, [attributionStartFrame, attributionEndFrame], [0, 1], {
    extrapolateRight: "clamp",
  });
  const attributionSlideProgress = spring({
    frame: Math.max(0, frame - attributionStartFrame),
    fps,
    config: {
      damping: 10,
      stiffness: 100,
      mass: 0.8,
    },
    durationInFrames: attributionEndFrame - attributionStartFrame,
  });
  const attributionTranslateX = interpolate(attributionSlideProgress, [0, 1], [50, 0]); // Slides from 50px to the right

  return (
    <div
      style={{
        ...glass(false),
        width: "90%",
        height: "80%",
        margin: "auto",
        display: "flex",
        flexDirection: hasImage && !p ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "5%",
        gap: hasImage ? (p ? 24 : 32) : 0,
        fontFamily: quoteFontFamily,
        position: "relative",
      }}
    >
      {hasImage && (
        <div
          style={{
            flex: p ? "none" : "0 0 38%",
            width: p ? "70%" : "auto",
            height: p ? 200 : 280,
            borderRadius: 12,
            overflow: "hidden",
            opacity: imageOpacity,
            transform: `scale(${imageScale})`,
          }}
        >
          <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flex: hasImage && !p ? 1 : "none",
          minWidth: 0,
          maxWidth: "100%",
        }}
      >
        {/* Opening quotation mark */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 40,
            fontSize: 120,
            color: accentColor || COLORS.ACCENT,
            lineHeight: 0.5,
            opacity: qMarkOpacity, // Animated fade-in
            transform: `translateY(${qMarkTranslateY}px)`, // Animated drop-down
            zIndex: 0, // Ensure it's behind the quote text
          }}
        >
          "
        </div>

        {/* Quote text */}
        <div
          style={{
            fontSize: titleFontSize ?? (p ? 49 : 50),
            lineHeight: 1.3,
            textAlign: "center",
            color: COLORS.DARK,
            fontWeight: 600,
            zIndex: 1,
            maxWidth: "100%",
            minWidth: 0,
            wordBreak: "break-word",
          }}
        >
          {words.map((w, i) => {
            const delay = wordAnimationStartDelay + i * wordDelayMultiplier;
            const op = interpolate(frame, [delay, delay + wordAnimationDurationPerWord], [0, 1], {
              extrapolateRight: "clamp",
            });
            const y = interpolate(frame, [delay, delay + wordAnimationDurationPerWord], [10, 0], {
              extrapolateRight: "clamp",
            });

            const cleanWord = w.toLowerCase().replace(/[.,!?;:]/g, "");
            const isHighlight = highlightWords.includes(cleanWord) && highlightPhrase;

            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  opacity: op,
                  transform: `translateY(${y}px)`, // Slight drop for smooth reveal
                  marginRight: "0.25em",
                  color: isHighlight ? (accentColor || COLORS.ACCENT) : "inherit",
                }}
              >
                {w}
              </span>
            );
          })}
        </div>

        {/* Attribution line */}
        <div
          style={{
            marginTop: 40,
            fontFamily: sansFontFamily,
            fontSize: descriptionFontSize ?? (p ? 33 : 29),
            color: COLORS.MUTED,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            opacity: attributionOpacity, // Animated fade-in
            transform: `translateX(${attributionTranslateX}px)`, // Animated slide-in
          }}
        >
          — {source}
        </div>
      </div>
    </div>
  );
};
