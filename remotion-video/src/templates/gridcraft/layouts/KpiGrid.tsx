import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img } from "remotion";
import { GridcraftLayoutProps } from "../types";
import { GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY } from "../constants";
import { glass, COLORS } from "../utils/styles";

// Animation Constants
const CARD_STAGGER_DELAY = 12; // frames between each card's animation start
const CARD_ENTRANCE_DURATION = 20; // frames for card to scale/fade in using spring
const NUMBER_COUNT_DURATION = 25; // frames for the number to count up
const LABEL_FADE_DELAY_AFTER_NUMBER = 5; // frames delay for label after number finishes counting
const LABEL_FADE_IN_DURATION = 10; // frames for label to fade in

// Helper to parse numeric value and its suffix from a string
const parseValueAndSuffix = (value: string) => {
  const numMatch = value.match(/^(\d+(\.\d+)?)/); // Captures leading number, possibly with decimal
  if (numMatch && numMatch[1]) {
    const num = parseFloat(numMatch[1]);
    const suffix = value.substring(numMatch[1].length);
    return { num: isNaN(num) ? 0 : num, suffix };
  }
  return { num: 0, suffix: value }; // Default to 0 and original value as suffix if no number
};

// Helper to format the animated number back to a string with its suffix,
// trying to preserve the original value's implied precision.
const formatAnimatedValue = (animatedNum: number, targetNum: number, suffix: string, originalValueString: string) => {
    // If animated number is very small (approaching 0), just show 0 to avoid -0 or tiny floats
    if (animatedNum < 0.001) {
        return `0${suffix}`;
    }

    let formattedNum;
    const originalHasDecimal = originalValueString.includes('.');

    if (originalHasDecimal) {
        // Count decimal places in the original string to match precision
        const decimalPartMatch = originalValueString.match(/\.(\d+)/);
        const precision = decimalPartMatch ? decimalPartMatch[1].length : 0;
        formattedNum = animatedNum.toFixed(precision);
    } else if (suffix.includes('M') || suffix.includes('K')) { 
        // For Millions/Thousands, often displayed with one decimal if targetNum is not a round integer, e.g., "1.2M", "1M"
        if (targetNum % 1 !== 0 || animatedNum % 1 !== 0) { // If target or current animated has a decimal component
            formattedNum = animatedNum.toFixed(1);
        } else {
            formattedNum = Math.round(animatedNum).toString();
        }
    } else if (Math.abs(targetNum) < 1 && targetNum !== 0) { // For numbers like "0.5", keep one decimal
        formattedNum = animatedNum.toFixed(1);
    } else { // Original was integer-like and no specific suffix implying decimals
        formattedNum = Math.round(animatedNum).toString();
    }

    // Remove trailing .0 if it results from toFixed, for cleaner integer representation
    if (formattedNum.endsWith('.0')) {
        formattedNum = formattedNum.slice(0, -2);
    }
    return `${formattedNum}${suffix}`;
};

export const KpiGrid: React.FC<GridcraftLayoutProps> = ({
  dataPoints,
  highlightIndex = 0,
  imageUrl,
  accentColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = dataPoints && dataPoints.length > 0 ? dataPoints : [
      { label: "Growth", value: "10x", trend: "up" },
      { label: "Users", value: "1M+", trend: "up" },
      { label: "Latency", value: "15ms", trend: "down" }
  ];

  const hasImage = !!imageUrl;
  const p = aspectRatio === "portrait";
  const resolvedFontFamily = fontFamily ?? GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY;

  const imageOpacity = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });
  const imageScale = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 14 } });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: hasImage && !p ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        width: "90%",
        height: "80%",
        margin: "auto",
        gap: hasImage ? (p ? 24 : 32) : 0,
        fontFamily: resolvedFontFamily,
      }}
    >
      {hasImage && (
        <div
          style={{
            flex: p ? "none" : "0 0 38%",
            width: p ? "80%" : "auto",
            height: p ? 220 : 320,
            borderRadius: 12,
            overflow: "hidden",
            opacity: imageOpacity,
            transform: `scale(${imageScale})`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, 1fr)`,
          gap: 20,
          flex: hasImage && !p ? 1 : "none",
          width: hasImage && !p ? "auto" : "100%",
          alignItems: "center",
        }}
      >
      {items.slice(0, 3).map((item, i) => {
          // --- Card entrance animation (scale and fade-in) ---
          const cardStartFrame = i * CARD_STAGGER_DELAY;
          const cardSpringProgress = spring({
              frame: Math.max(0, frame - cardStartFrame),
              fps,
              config: { damping: 14, mass: 0.8, stiffness: 100 } // Snappy spring config
          });
          const cardOpacity = interpolate(cardSpringProgress, [0, 1], [0, 1]);
          const cardScale = interpolate(cardSpringProgress, [0, 1], [0.8, 1]);
          
          // --- Number counting animation ---
          const { num: targetValue, suffix: valueSuffix } = parseValueAndSuffix(item.value || "0");
          const numberStartFrame = cardStartFrame;
          const numberEndFrame = numberStartFrame + NUMBER_COUNT_DURATION;

          const animatedNumber = interpolate(
            frame,
            [numberStartFrame, numberEndFrame],
            [0, targetValue],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }
          );
          const finalDisplayedValue = formatAnimatedValue(animatedNumber, targetValue, valueSuffix, item.value || "0");

          // --- Label fade-in animation ---
          const labelStartFrame = numberEndFrame + LABEL_FADE_DELAY_AFTER_NUMBER;
          const labelEndFrame = labelStartFrame + LABEL_FADE_IN_DURATION;

          const labelOpacity = interpolate(
            frame,
            [labelStartFrame, labelEndFrame],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }
          );

          const isAccent = i === highlightIndex;

          const trendIcon = item.trend === "up" ? "▲" : item.trend === "down" ? "▼" : "●";
          const trendColor = item.trend === "up" ? "#22C55E" : item.trend === "down" ? "#EF4444" : COLORS.MUTED;

          return (
              <div
                key={i}
                style={{
                  ...glass(isAccent),
                  backgroundColor: isAccent ? (accentColor || COLORS.ACCENT) : undefined,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 40,
                  transform: `scale(${cardScale})`,
                  opacity: cardOpacity, // Apply card opacity here
                  aspectRatio: "1/1",
                }}
              >
                  <div style={{ 
                      fontSize: titleFontSize ?? (p ? 57 : 75), 
                      fontWeight: 700, 
                      lineHeight: 1, 
                      color: isAccent ? COLORS.WHITE : (textColor || COLORS.DARK),
                      marginBottom: 12
                    }}>
                      {finalDisplayedValue} {/* Use animated value */}
                  </div>
                  
                  <div style={{ fontSize: 24, color: isAccent ? "rgba(255,255,255,0.8)" : trendColor }}>
                      {trendIcon}
                  </div>

                  <div style={{ 
                      marginTop: 12, 
                      fontSize: descriptionFontSize ?? (p ? 45 : 39), 
                      textTransform: "uppercase", 
                      letterSpacing: "0.1em",
                      opacity: labelOpacity, // Apply label opacity here
                      color: isAccent ? COLORS.WHITE : COLORS.MUTED
                   }}>
                      {item.label}
                  </div>
              </div>
          )
      })}
      </div>
    </div>
  );
};
