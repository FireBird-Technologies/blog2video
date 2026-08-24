import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from "remotion";
import type { SpringConfig } from "remotion";
import { GridcraftLayoutProps } from "../types";
import { GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY } from "../constants";
import { glass, COLORS } from "../utils/styles";
import { ZoomCropImg } from "../components/ZoomCropImg";
import { useFitText } from "../components/useFitText";

/**
 * One supporting-fact card. The fact row is a `1fr` grid track (or `auto` in
 * portrait), not a shrinkable measurable box, so budget the fact text from a
 * fixed fraction of the frame height passed in as `budgetPx`.
 */
const FactCard: React.FC<{
  fact: string;
  factNumber: number;
  factFontSize: number;
  factLabelSize: number;
  descriptionFontSizeIsUserSet?: boolean;
  p: boolean;
  budgetPx: number;
  style: React.CSSProperties;
}> = ({ fact, factNumber, factFontSize, factLabelSize, descriptionFontSizeIsUserSet, p, budgetPx, style }) => {
  const factRef = React.useRef<HTMLDivElement>(null);
  const { px: factPx } = useFitText(
    factRef,
    factFontSize,
    descriptionFontSizeIsUserSet ? factFontSize : p ? 14 : 13,
    [fact, factFontSize, descriptionFontSizeIsUserSet, budgetPx],
    budgetPx,
  );
  return (
    <div style={style}>
      <div style={{ fontSize: factLabelSize, opacity: 0.8, fontWeight: 500, marginBottom: 8, textTransform: "uppercase", wordBreak: "break-word" }}>
        Fact {factNumber}
      </div>
      <div ref={factRef} style={{ fontSize: factPx, fontWeight: 600, lineHeight: 1.4, wordBreak: "break-word" }}>
        {fact}
      </div>
    </div>
  );
};

export const BentoHighlight: React.FC<GridcraftLayoutProps> = ({
  // Backend props
  mainPoint,
  supportingFacts,
  // Fallbacks
  title,
  dataPoints,imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  subtitle,
  textColor,
  accentColor,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  aspectRatio,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, height: videoHeight } = useVideoConfig();

  const p = aspectRatio === "portrait";

  // Helper for spring animations, allowing custom config
  const spr = (d: number, config?: Partial<SpringConfig>) => spring({
    frame: Math.max(0, frame - d),
    fps,
    config: { damping: 14, stiffness: 110, ...(config ?? {}) }, // Default config, allowing override
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

  const hasImage = !!(imageUrl || videoUrl);
  const resolvedFontFamily = fontFamily ?? GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY;

  // Facts text size follows display/description text size
  const factFontSize = descriptionFontSize ?? (p ? 24 : 28);
  const factLabelSize = Math.round(factFontSize * 0.6);

  /* ── Auto-fit ──────────────────────────────────────────────
     The main box is a `1.8fr` grid track (or `auto` in portrait), not a
     measurable shrinkable box, so budget the title and subtitle from fixed
     fractions of the frame height; the title fits first, the subtitle's
     residual overflow feeds back to shrink the title's budget further. */
  const titleRef = React.useRef<HTMLDivElement>(null);
  const subtitleRef = React.useRef<HTMLDivElement>(null);
  const actualTitleFontSize = titleFontSize ?? (p ? 50 : 52);
  const actualSubtitleFontSize = descriptionFontSize ?? (p ? 26 : 28);
  const titleBudgetPx = Math.max(1, videoHeight * (p ? 0.22 : 0.26));
  const subtitleBudgetPx = Math.max(1, videoHeight * (p ? 0.1 : 0.12));

  const [titleGiveBackPx, setTitleGiveBackPx] = React.useState(0);
  React.useLayoutEffect(() => {
    setTitleGiveBackPx(0);
  }, [primaryText, subtitle, actualTitleFontSize, actualSubtitleFontSize, titleBudgetPx]);

  const { px: titlePx } = useFitText(
    titleRef,
    actualTitleFontSize,
    titleFontSizeIsUserSet ? actualTitleFontSize : p ? 26 : 24,
    [primaryText, actualTitleFontSize, titleFontSizeIsUserSet, titleBudgetPx, titleGiveBackPx],
    Math.max(1, titleBudgetPx - titleGiveBackPx),
  );
  const { px: subtitlePx, overflowPx: subtitleOverflowPx } = useFitText(
    subtitleRef,
    actualSubtitleFontSize,
    descriptionFontSizeIsUserSet ? actualSubtitleFontSize : p ? 14 : 13,
    [subtitle, actualSubtitleFontSize, descriptionFontSizeIsUserSet, subtitleBudgetPx, titlePx],
    subtitleBudgetPx,
  );
  React.useLayoutEffect(() => {
    if (titleFontSizeIsUserSet || subtitleOverflowPx <= 0) return;
    setTitleGiveBackPx((prev) => Math.min(titleBudgetPx * 0.6, prev + subtitleOverflowPx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitleOverflowPx, titleFontSizeIsUserSet]);

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
        gridTemplateColumns: p ? "1fr" : "1fr 1fr",
        gridTemplateRows: p ? "auto auto auto" : "1.8fr 1fr",
        gap: 20,
        width: "90%",
        height: "80%",
        margin: "auto",
        fontFamily: resolvedFontFamily,
        opacity: layoutOpacity, // Apply overall fade out here
        minWidth: 0,
      }}
    >
      {/* Main Highlight Box - with optional image */}
      <div
        style={{
          gridColumn: "1 / -1",
          ...glass(false),
          backgroundColor: "rgba(255,255,255,0.4)",
          border: `1px solid ${(accentColor || COLORS.ACCENT)}40`,
          display: "flex",
          flexDirection: hasImage && !p ? "row" : "column",
          justifyContent: "center",
          padding: hasImage ? 0 : 42,
          overflow: "hidden",
          transform: `scale(${scale1})`,
          opacity: op1,
        }}
      >
        {hasImage && (
          <div style={{ flex: 1, position: "relative", overflow: "hidden", minWidth: 0, minHeight: 0 }}>
            <ZoomCropImg
              src={imageUrl}
              imageObjectPosition={imageObjectPosition}
              imageZoom={imageZoom}
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
            padding: p && hasImage ? 28 : 42,
            minWidth: 0,
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
          <div ref={titleRef} style={{
            fontSize: titlePx,
            fontWeight: 700,
            lineHeight: 1.3,
            color: textColor || COLORS.DARK,
            maxWidth: "100%",
            minWidth: 0,
            display: "flex", // Make it a flex container to align words
            flexWrap: "wrap", // Allow words to wrap
            overflow: "hidden", // Hide overflow during animation
            wordBreak: "break-word",
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
            <div ref={subtitleRef} style={{
              fontSize: subtitlePx,
              color: COLORS.MUTED,
              marginTop: 12,
              wordBreak: "break-word",
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
         // Fact 1 slides from left (-100), Fact 2 from right (landscape); portrait uses vertical slide
         const translateX = interpolate(progress, [0, 1], [i === 0 ? -100 : 100, 0], { easing: Easing.out(Easing.ease) });
         const translateY = interpolate(progress, [0, 1], [i === 0 ? -40 : 40, 0], { easing: Easing.out(Easing.ease) });

         const isAccent = i === 1;

         return (
             <FactCard
               key={i}
               fact={fact}
               factNumber={i + 1}
               factFontSize={factFontSize}
               factLabelSize={factLabelSize}
               descriptionFontSizeIsUserSet={descriptionFontSizeIsUserSet}
               p={p}
               budgetPx={Math.max(1, videoHeight * (p ? 0.14 : 0.18))}
               style={{
                 gridColumn: p ? "1" : undefined,
                 gridRow: p ? i + 2 : undefined,
                 ...glass(isAccent),
                 backgroundColor: isAccent ? (accentColor || COLORS.ACCENT) : undefined,
                 padding: 24,
                 display: "flex",
                 flexDirection: "column",
                 justifyContent: "center",
                 minWidth: 0,
                 overflow: "hidden",
                 transform: p ? `translateY(${translateY}px)` : `translateX(${translateX}px)`,
                 opacity: factOpacity,
               }}
             />
         )
      })}
    </div>
  );
};

