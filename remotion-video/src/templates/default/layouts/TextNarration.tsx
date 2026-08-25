import { AbsoluteFill, useVideoConfig } from "remotion";
import React from "react";
import { SceneLayoutProps } from "../types";
import { GeometricBackground } from "../components/GeometricBackground";
import { ScenePlane } from "../components/ScenePlane";
import { useFitText } from "../components/useFitText";
import { useCurrentFrame } from "remotion";

export const TextNarration: React.FC<SceneLayoutProps> = ({
  title,
  narration,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  fontFamily,
  sceneIndex,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const isDarkText =
    textColor === "#000000" || textColor === "#000" || textColor === "black";
  const adjustedBgColor = isDarkText ? "#FFFFFF" : bgColor;

  /* ── Auto-fit ──────────────────────────────────────────────
     Title and narration are unbounded user input; ScenePlane centres this
     block with no height limit of its own, so long copy would just grow past
     the frame and be clipped by the AbsoluteFill's overflow:hidden. Fit the
     Title and narration each fit against their own fixed, independent
     budget. A size the user explicitly picked is honored exactly (minPx ===
     targetPx makes the hook a no-op).

     No give-back cross-talk between the two: a useLayoutEffect+setState
     chain reacting to another useFitText's overflow output creates a
     multi-render convergence that Remotion's per-frame headless capture can
     settle at different points on different frames (confirmed via a real
     render — frame-to-frame scene-change score hit 1.0, i.e. maximum, twice
     in the first ten frames, in the equivalent newscast/newspaper opening
     scenes). */
  const titleRef = React.useRef<HTMLDivElement>(null);
  const narrationRef = React.useRef<HTMLDivElement>(null);

  const actualTitleFontSize = titleFontSize ?? (p ? 102 : 84);
  const actualDescriptionFontSize = descriptionFontSize ?? (p ? 52 : 47);

  // The title is `flex-shrink:0` inside its column, so its own clientHeight
  // always equals its content height; give it an explicit budget instead —
  // a capped fraction of the frame, leaving room for the narration below.
  const titleBudgetPx = Math.round(height * (p ? 0.34 : 0.36));

  const { px: titlePx } = useFitText(
    titleRef,
    actualTitleFontSize,
    titleFontSizeIsUserSet ? actualTitleFontSize : p ? 44 : 36,
    [title, actualTitleFontSize, titleFontSizeIsUserSet, titleBudgetPx, p],
    titleBudgetPx,
  );

  const narrationBudgetPx = Math.round(height * (p ? 0.5 : 0.48));
  const { px: narrationPx } = useFitText(
    narrationRef,
    actualDescriptionFontSize,
    descriptionFontSizeIsUserSet ? actualDescriptionFontSize : p ? 22 : 18,
    [narration, actualDescriptionFontSize, descriptionFontSizeIsUserSet, titlePx, narrationBudgetPx, p],
    narrationBudgetPx,
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: adjustedBgColor,
        overflow: "hidden",
      }}
    >
      {/* Flowing-contour background that flies in/out per scene */}
      <GeometricBackground
        accentColor={accentColor || "#6366F1"}
        frame={frame}
        sceneIndex={sceneIndex}
      />

      {/* The plane sweeps in, reveals the text "modal", and sweeps it away on exit */}
      <ScenePlane accentColor={accentColor || "#6366F1"} sceneIndex={sceneIndex}>
        <div
          style={{
            textAlign: "center",
            maxWidth: p ? "90%" : "75%",
            maxHeight: "100%",
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <h1
            ref={titleRef}
            style={{
              color: textColor,
              fontSize: titlePx,
              fontWeight: 800,
              marginBottom: 32,
              fontFamily: fontFamily ?? "'Roboto Slab', serif",
              flexShrink: 0,
            }}
          >
            {title}
          </h1>

          <p
            ref={narrationRef}
            style={{
              color: textColor,
              fontSize: narrationPx,
              lineHeight: 1.5,
              maxWidth: "45ch",
              margin: "0 auto",
              fontFamily: fontFamily ?? "'Roboto Slab', serif",
              opacity: isDarkText ? 1 : 0.85,
              flex: "0 1 auto",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            {narration}
          </p>
        </div>
      </ScenePlane>
    </AbsoluteFill>
  );
};
