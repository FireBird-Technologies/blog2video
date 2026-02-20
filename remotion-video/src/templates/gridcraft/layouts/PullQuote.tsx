import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img } from "remotion";
import { GridcraftLayoutProps } from "../types";
import { glass, FONT_FAMILY, COLORS } from "../utils/styles";

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
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const text = quote || title || "Quote goes here";
  const source = attribution || subtitle || narration || "Author";
  const words = text.split(" ");
  const hasImage = !!imageUrl;
  const p = aspectRatio === "portrait";

  const highlightWords = (highlightPhrase || "").split(" ").map(w => w.toLowerCase().replace(/[.,!?;:]/g, ""));

  const imageOpacity = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });
  const imageScale = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 14 } });

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
        fontFamily: FONT_FAMILY.SERIF,
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
        }}
      >
      <div style={{ position: "absolute", top: 40, left: 40, fontSize: 120, color: accentColor || COLORS.ACCENT, opacity: 0.2, lineHeight: 0.5 }}>
          "
      </div>

      <div style={{ fontSize: titleFontSize ?? 42, lineHeight: 1.3, textAlign: "center", color: COLORS.DARK, fontWeight: 600, zIndex: 1, maxWidth: "90%" }}>
          {words.map((w, i) => {
              const delay = i * 2;
              const op = interpolate(frame, [delay, delay + 10], [0, 1], { extrapolateRight: "clamp" });
              const y = interpolate(frame, [delay, delay + 10], [10, 0], { extrapolateRight: "clamp" });

              const cleanWord = w.toLowerCase().replace(/[.,!?;:]/g, "");
              const isHighlight = highlightWords.includes(cleanWord) && highlightPhrase;

              return (
                  <span key={i} style={{
                      display: "inline-block",
                      opacity: op,
                      transform: `translateY(${y}px)`,
                      marginRight: "0.25em",
                      color: isHighlight ? (accentColor || COLORS.ACCENT) : "inherit"
                  }}>
                      {w}
                  </span>
              )
          })}
      </div>

      <div style={{
          marginTop: 40,
          fontFamily: FONT_FAMILY.SANS,
          fontSize: descriptionFontSize ?? 16,
          color: COLORS.MUTED,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          opacity: interpolate(frame, [words.length * 2 + 10, words.length * 2 + 30], [0, 1])
      }}>
          — {source}
      </div>
      </div>
    </div>
  );
};
