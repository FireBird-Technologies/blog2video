import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img, Easing } from "remotion";
import { GridcraftLayoutProps } from "../types";
import { glass, FONT_FAMILY, COLORS } from "../utils/styles";

export const BentoHighlight: React.FC<GridcraftLayoutProps> = ({
  // Backend props
  mainPoint,
  supportingFacts,
  // Fallbacks
  title,
  dataPoints,

  imageUrl,
  subtitle,
  textColor,
  accentColor,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();

  // Responsive flag based on video width, assuming 'p' implies a smaller width or aspect ratio
  const p = width < 1000;

  // Helper for spring animations, allowing custom config
  const spr = (d: number, config?: Parameters<typeof spring>[2]) => spring({
    frame: Math.max(0, frame - d),
    fps,
    config: { damping: 14, stiffness: 110, ...config }, // Default config, allowing override
  });

  // --- Overall Layout Fade Out ---
  const fadeOutStartFrame = durationInFrames - fps * 1.5; // Start fade out 1.5 seconds before end
  const layoutOpacity = interpolate(
    frame,
    [fadeOutStartFrame, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // --- Main Highlight Box Animation (existing, using for timing base) ---
  const mainBoxInStart = 0;
  const mainBoxInEnd = 30; // Roughly when it settles
  const scale1 = interpolate(spr(mainBoxInStart), [0, 1], [0.95, 1]);
  const op1 = interpolate(spr(mainBoxInStart), [0, 1], [0, 1]);

  // Resolve content
  const primaryText = mainPoint || title || "Highlight Key Feature Here";
  const facts = (supportingFacts && supportingFacts.length > 0)
    ? supportingFacts
    : (dataPoints || []).map(d => d.value || d.description || d.label || "");

  const hasImage = !!imageUrl;

  // Facts text size follows display/description text size
  const factFontSize = descriptionFontSize ?? (p ? 47 : 28);
  const factLabelSize = Math.round(factFontSize * 0.6);

  // --- Title Word-by-Word Animation ---
  const titleWords = primaryText.split(" ");
  const titleWordStartDelay = mainBoxInEnd + 10; // Start title words after main box has appeared
  const titleWordStagger = 4; // Frames between each word's animation start
  const titleWordAnimationDuration = 30; // Frames for each word to animate in

  // --- Subtitle Animation Timing ---
  // Calculate when the last title word is mostly animated in
  const lastTitleWordAnimEnd = titleWordStartDelay + (titleWords.length - 1) * titleWordStagger + titleWordAnimationDuration;
  const subtitleInStart = lastTitleWordAnimEnd - 15; // Subtitle starts slightly before last word finishes

  // --- Fact Card Animations Timing ---
  const factCardInStart = lastTitleWordAnimEnd + 10; // Facts start after title/subtitle are mostly in
  const factCardStagger = 15; // Stagger between fact cards

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1.8fr 1fr",
        gap: 20,
        width: "90%",
        height: "80%",
        margin: "auto",
        fontFamily: FONT_FAMILY.SANS,
        opacity: layoutOpacity, // Apply overall fade out here
      }}
    >
      {/* Main Highlight Box - with optional image */}
      <div
        style={{
          gridColumn: "1 / 3",
          ...glass(false),
          backgroundColor: "rgba(255,255,255,0.4)",
          border: `1px solid ${(accentColor || COLORS.ACCENT)}40`,
          display: "flex",
          flexDirection: hasImage ? "row" : "column",
          justifyContent: "center",
          padding: hasImage ? 0 : 42,
          overflow: "hidden",
          transform: `scale(${scale1})`,
          opacity: op1,
        }}
      >
        {hasImage && (
          <div style={{ flex: 1, position: "relative", overflow: "hidden", minWidth: 0 }}>
            <Img
              src={imageUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 100%)", mixBlendMode: "overlay" }} />
          </div>
        )}
        <div
          style={{
            flex: hasImage ? 1 : "none",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: 42,
          }}
        >
          <div style={{
            fontSize: 14,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: accentColor || COLORS.ACCENT,
            fontWeight: 700,
            marginBottom: 16,
          }}>
            Main Point
          </div>
          {/* Animated Main Title (word by word from top) */}
          <div style={{
            fontSize: titleFontSize ?? (p ? 50 : 52),
            fontWeight: 700,
            lineHeight: 1.3,
            color: textColor || COLORS.DARK,
            maxWidth: "90%",
            display: "flex", // Make it a flex container to align words
            flexWrap: "wrap", // Allow words to wrap
            overflow: "hidden", // Hide overflow during animation
          }}>
            {titleWords.map((word, i) => {
              const wordAnimDelay = titleWordStartDelay + i * titleWordStagger;
              // Gentle ease-in config for word animations
              const wordProgress = spr(wordAnimDelay, { damping: 20, stiffness: 100 });
              const wordOpacity = interpolate(wordProgress, [0, 1], [0, 1]);
              const wordTranslateY = interpolate(wordProgress, [0, 1], [-20, 0]); // Fade from top

              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block", // Important for transform
                    opacity: wordOpacity,
                    transform: `translateY(${wordTranslateY}px)`,
                    marginRight: "0.4em", // Space between words
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
          {/* Animated Subtitle (Body Text) fading in softly */}
          {subtitle && (
            <div style={{
              fontSize: descriptionFontSize ?? (p ? 47 : 28),
              color: COLORS.MUTED,
              marginTop: 12,
              // Soft fade in after title words finish
              opacity: interpolate(spr(subtitleInStart, { damping: 20, stiffness: 100 }), [0, 1], [0, 1]),
            }}>{subtitle}</div>
          )}
        </div>
      </div>

      {/* Supporting Facts - Render up to 2 dynamically */}
      {facts.slice(0, 2).map((fact, i) => {
         const factAnimDelay = factCardInStart + i * factCardStagger;
         // Gentle ease-out config for fact card animations
         const progress = spr(factAnimDelay, { damping: 18, stiffness: 100 });
         const factOpacity = interpolate(progress, [0, 1], [0, 1]);
         // Fact 1 slides from left (-100), Fact 2 slides from right (100)
         const translateX = interpolate(progress, [0, 1], [i === 0 ? -100 : 100, 0], { easing: Easing.out(Easing.ease) });

         const isAccent = i === 1;

         return (
             <div key={i} style={{
                 ...glass(isAccent),
                 backgroundColor: isAccent ? (accentColor || COLORS.ACCENT) : undefined,
                 padding: 24,
                 display: "flex",
                 flexDirection: "column",
                 justifyContent: "center",
                 transform: `translateX(${translateX}px)`, // Apply slide animation
                 opacity: factOpacity,
             }}>
                 <div style={{ fontSize: factLabelSize, opacity: 0.8, fontWeight: 500, marginBottom: 8, textTransform: "uppercase" }}>
                     Fact {i + 1}
                 </div>
                 <div style={{ fontSize: factFontSize, fontWeight: 600, lineHeight: 1.4 }}>
                     {fact}
                 </div>
             </div>
         )
      })}
    </div>
  );
};
