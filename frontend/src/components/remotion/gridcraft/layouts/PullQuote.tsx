import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import type { GridcraftLayoutProps } from "../types";

export const PullQuote: React.FC<GridcraftLayoutProps> = ({
  quote,
  attribution,
  highlightPhrase,
  narration,
  accentColor,
  bgColor,
  textColor,
}) => {
  const frame = useCurrentFrame();

  const quoteText = quote || narration;
  const words = quoteText.split(" ");

  const quoteMarkOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const quoteMarkScale = interpolate(frame, [0, 12], [0.8, 1], { extrapolateRight: "clamp" });

  const attribOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      backgroundColor: bgColor || "#FAFAFA",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        width: "70%",
        maxWidth: 900,
        position: "relative",
        paddingTop: 60,
      }}>
        {/* Decorative quotation marks */}
        <span style={{
          position: "absolute",
          top: -20,
          left: -10,
          fontSize: 120,
          fontWeight: 700,
          color: accentColor || "#F97316",
          opacity: quoteMarkOpacity * 0.3,
          transform: `scale(${quoteMarkScale})`,
          fontFamily: "Georgia, serif",
          lineHeight: 1,
          userSelect: "none",
        }}>
          &ldquo;
        </span>

        {/* Quote text — word by word fade in */}
        <p style={{
          fontSize: 32,
          fontWeight: 600,
          color: textColor || "#171717",
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          lineHeight: 1.5,
          textAlign: "center",
          margin: 0,
        }}>
          {words.map((word, i) => {
            const wordDelay = 5 + i * 2;
            const wordOpacity = interpolate(frame, [wordDelay, wordDelay + 6], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            const isHighlighted = highlightPhrase && word.toLowerCase().replace(/[^a-z]/g, "")
              === highlightPhrase.toLowerCase().replace(/[^a-z]/g, "");

            return (
              <span
                key={i}
                style={{
                  opacity: wordOpacity,
                  color: isHighlighted ? (accentColor || "#F97316") : undefined,
                  fontWeight: isHighlighted ? 700 : undefined,
                }}
              >
                {word}{" "}
              </span>
            );
          })}
        </p>

        {/* Attribution */}
        {attribution && (
          <p style={{
            fontSize: 16,
            fontWeight: 400,
            color: "rgba(23,23,23,0.5)",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            textAlign: "center",
            marginTop: 24,
            opacity: attribOpacity,
          }}>
            — {attribution}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};
