import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from "remotion";
import { SceneLayoutProps } from "../types";
import { GeometricBackground } from "../components/GeometricBackground";
import { FlybyPlane } from "../components/FlybyPlane";
import { useFitText } from "../components/useFitText";

export const QuoteCallout: React.FC<SceneLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  quote,
  quoteAuthor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  fontFamily,
  sceneIndex,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const { height } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const displayQuote = quote || narration;
  const displayAuthor = quoteAuthor || title;

  /* ── Auto-fit ──────────────────────────────────────────────
     Quote and author are unbounded user input; the text column has no height
     limit of its own (just `alignItems:stretch` next to the accent bar), so a
     long quote grows past the frame and gets clipped by the AbsoluteFill's
     overflow:hidden. Quote and author each fit against their own fixed,
     independent budget. A size the user explicitly picked is honored exactly
     (minPx === targetPx makes the hook a no-op).

     No give-back cross-talk between the two: a useLayoutEffect+setState
     chain reacting to another useFitText's overflow output creates a
     multi-render convergence that Remotion's per-frame headless capture can
     settle at different points on different frames (confirmed via a real
     render — frame-to-frame scene-change score hit 1.0, i.e. maximum, twice
     in the first ten frames, in the equivalent newscast/newspaper opening
     scenes). */
  const quoteRef = React.useRef<HTMLParagraphElement>(null);
  const authorRef = React.useRef<HTMLParagraphElement>(null);

  const actualQuoteFontSize = titleFontSize ?? (p ? 54 : 49);
  const actualAuthorFontSize = descriptionFontSize ?? (p ? 30 : 26);

  const quoteBudgetPx = Math.round(height * (p ? 0.5 : 0.46));

  const { px: quotePx } = useFitText(
    quoteRef,
    actualQuoteFontSize,
    titleFontSizeIsUserSet ? actualQuoteFontSize : p ? 24 : 20,
    [displayQuote, actualQuoteFontSize, titleFontSizeIsUserSet, quoteBudgetPx, p],
    quoteBudgetPx,
  );

  const authorBudgetPx = Math.round(height * 0.14);
  const { px: authorPx } = useFitText(
    authorRef,
    actualAuthorFontSize,
    descriptionFontSizeIsUserSet ? actualAuthorFontSize : p ? 16 : 14,
    [displayAuthor, actualAuthorFontSize, descriptionFontSizeIsUserSet, quotePx, authorBudgetPx, p],
    authorBudgetPx,
  );

  const barH = interpolate(frame, [0, 25], [0, 100], {
    extrapolateRight: "clamp",
  });

  // Quote text springs in with slide
  const textSpring = spring({
    frame: frame - 8,
    fps,
    config: { damping: 20, stiffness: 80, mass: 1 },
  });
  const textOp = interpolate(textSpring, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });
  const textX = interpolate(textSpring, [0, 1], [-30, 0], {
    extrapolateRight: "clamp",
  });

  // Author label springs in after quote
  const labelSpring = spring({
    frame: frame - 20,
    fps,
    config: { damping: 22, stiffness: 90, mass: 1 },
  });
  const labelOp = interpolate(labelSpring, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });
  const glowOp = interpolate(frame, [5, 40], [0, 0.15], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: p ? "80px 50px" : "80px 120px",
        overflow: "hidden",
      }}
    >
      <GeometricBackground accentColor={accentColor} frame={frame} sceneIndex={sceneIndex} />
      {/* Decorative flyby — different startFrame + slightly lower yZone than BulletList */}
      <FlybyPlane accentColor={accentColor} startFrame={50} yZone={0.16} />
      {/* Glow effect */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "10%",
          width: p ? 280 : 400,
          height: p ? 280 : 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}${Math.round(glowOp * 255)
            .toString(16)
            .padStart(2, "0")}, transparent)`,
        }}
      />

      <div
        style={{
          display: "flex",
          gap: p ? 28 : 40,
          alignItems: "stretch",
          maxWidth: p ? 900 : 1000,
          maxHeight: "84%",
          position: "relative",
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            width: 6,
            backgroundColor: accentColor,
            borderRadius: 3,
            height: `${barH}%`,
            alignSelf: "center",
            flexShrink: 0,
          }}
        />

        <div
          style={{
            opacity: textOp,
            transform: `translateX(${textX}px)`,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <p
            ref={quoteRef}
            style={{
              color: textColor,
              fontSize: quotePx,
              fontWeight: 600,
              fontFamily: fontFamily ?? "'Roboto Slab', serif",
              lineHeight: 1.55,
              fontStyle: "italic",
              marginTop: 0,
              marginBottom: 24,
              flexShrink: 0,
            }}
          >
            &ldquo;{displayQuote}&rdquo;
          </p>
          <p
            ref={authorRef}
            style={{
              color: accentColor,
              fontSize: authorPx,
              fontWeight: 500,
              fontFamily: fontFamily ?? "'Roboto Slab', serif",
              opacity: labelOp,
              textTransform: "uppercase",
              letterSpacing: 3,
              margin: 0,
              flex: "0 1 auto",
              overflow: "hidden",
            }}
          >
            {displayAuthor}
          </p>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 4,
          backgroundColor: accentColor,
        }}
      />
    </AbsoluteFill>
  );
};
