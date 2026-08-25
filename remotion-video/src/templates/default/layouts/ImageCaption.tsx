import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from "remotion";
import { SceneLayoutProps } from "../types";
import { AnimatedImage } from "./AnimatedImage";
import { AnimatedVideo } from "./AnimatedVideo";
import { FlybyPlane } from "../components/FlybyPlane";
import { useFitText } from "../components/useFitText";

export const ImageCaption: React.FC<SceneLayoutProps> = ({
  title,
  narration,
  imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  titleFontSizeIsUserSet,
  descriptionFontSizeIsUserSet,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, width: videoWidth, height: videoHeight } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const hasImage = !!imageUrl || !!videoUrl; // New variable to track image/video presence

  /* ── Auto-fit ──────────────────────────────────────────────
     Title and narration are unbounded user input. The text column is a plain
     centred flex block with no height limit of its own (it shares the frame
     with the image, when present), so long copy just grows past the frame
     and is clipped by the AbsoluteFill's overflow:hidden. Title and
     narration each fit against their own fixed, independent budget. A size
     the user explicitly picked is honored exactly (minPx === targetPx makes
     the hook a no-op).

     No give-back cross-talk between the two: a useLayoutEffect+setState
     chain reacting to another useFitText's overflow output creates a
     multi-render convergence that Remotion's per-frame headless capture can
     settle at different points on different frames (confirmed via a real
     render — frame-to-frame scene-change score hit 1.0, i.e. maximum, twice
     in the first ten frames, in the equivalent newscast/newspaper opening
     scenes). */
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const narrationRef = React.useRef<HTMLParagraphElement>(null);

  const actualTitleFontSize = titleFontSize ?? (p ? 57 : 56);
  const actualDescriptionFontSize = descriptionFontSize ?? (p ? 37 : 32);

  const titleBudgetPx = Math.round(videoHeight * (hasImage ? 0.2 : 0.24));

  const { px: titlePx } = useFitText(
    titleRef,
    actualTitleFontSize,
    titleFontSizeIsUserSet ? actualTitleFontSize : p ? 26 : 24,
    [title, actualTitleFontSize, titleFontSizeIsUserSet, titleBudgetPx, hasImage],
    titleBudgetPx,
  );

  const narrationBudgetPx = Math.round(videoHeight * (hasImage ? 0.28 : 0.4));
  const { px: narrationPx } = useFitText(
    narrationRef,
    actualDescriptionFontSize,
    descriptionFontSizeIsUserSet ? actualDescriptionFontSize : p ? 16 : 14,
    [narration, actualDescriptionFontSize, descriptionFontSizeIsUserSet, titlePx, narrationBudgetPx, hasImage],
    narrationBudgetPx,
  );

  // --- Initial animations (spring in) ---

  // Image springs in with zoom
  const imgSpring = spring({
    frame,
    fps,
    config: { damping: 28, stiffness: 70, mass: 1 },
  });
  const imgOp = interpolate(imgSpring, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });
  const imgScale = interpolate(imgSpring, [0, 1], [1.06, 1], {
    extrapolateRight: "clamp",
  });

  // Text springs in after image
  const textSpring = spring({
    frame: frame - 12,
    fps,
    config: { damping: 20, stiffness: 80, mass: 1 },
  });
  const textOp = interpolate(textSpring, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });
  const textY = interpolate(textSpring, [0, 1], [20, 0], {
    extrapolateRight: "clamp",
  });
  const borderW = interpolate(frame, [5, 30], [0, 100], {
    extrapolateRight: "clamp",
  });

  // --- End Scene Animation ---
  const endAnimationDurationSeconds = 1.5; // 1.5 seconds for the end animation
  const endAnimationStartFrame = durationInFrames - fps * endAnimationDurationSeconds;

  // Text end animation: zoom out, fade, and translate
  const textEndSpring = spring({
    frame: frame - endAnimationStartFrame,
    fps,
    config: { damping: 20, stiffness: 80, mass: 1 },
    durationInFrames: fps * endAnimationDurationSeconds,
  });

  const textEndScale = interpolate(textEndSpring, [0, 1], [1, 0.8], {
    extrapolateLeft: "identity", // Keep current value before animation starts
    extrapolateRight: "clamp",
  });
  const textEndOpacity = interpolate(textEndSpring, [0, 1], [1, 0], {
    extrapolateLeft: "identity",
    extrapolateRight: "clamp",
  });
  // Text end translation should only occur if there's an image to interact with
  const textEndTranslateY = interpolate(textEndSpring, [0, 1], [0, p && hasImage ? -videoHeight * 0.2 : 0], {
    extrapolateLeft: "identity",
    extrapolateRight: "clamp",
  });
  const textEndTranslateX = interpolate(textEndSpring, [0, 1], [0, !p && hasImage ? -videoWidth * 0.15 : 0], {
    extrapolateLeft: "identity",
    extrapolateRight: "clamp",
  });

  // Image end animation: move to center, zoom in, and vanish
  const imageEndSpring = spring({
    frame: frame - endAnimationStartFrame,
    fps,
    config: { damping: 20, stiffness: 80, mass: 1 },
    durationInFrames: fps * endAnimationDurationSeconds,
  });

  const finalImageScaleFactor = p ? 2.5 : 2.0; // How much image scales up at the end
  const imageEndScale = interpolate(imageEndSpring, [0, 1], [1, finalImageScaleFactor], {
    extrapolateLeft: "identity",
    extrapolateRight: "clamp",
  });
  const imageEndOpacity = interpolate(imageEndSpring, [0, 1], [1, 0], {
    extrapolateLeft: "identity",
    extrapolateRight: "clamp",
  });

  // Calculate transform for moving image towards center (relative to its current position)
  const imageEndTranslateX = interpolate(imageEndSpring, [0, 1], [0, !p ? videoWidth * 0.15 : 0], {
    extrapolateLeft: "identity",
    extrapolateRight: "clamp",
  });
  const imageEndTranslateY = interpolate(imageEndSpring, [0, 1], [0, p ? videoHeight * 0.2 : 0], {
    extrapolateLeft: "identity",
    extrapolateRight: "clamp",
  });

  // --- Combined styles based on animation state ---
  const isEnding = frame > endAnimationStartFrame;

  const currentImageScale = isEnding ? imageEndScale : imgScale;
  const currentImageOpacity = isEnding ? imageEndOpacity : imgOp;
  const currentImageTranslateX = isEnding ? imageEndTranslateX : 0;
  const currentImageTranslateY = isEnding ? imageEndTranslateY : 0;

  const currentTextScale = isEnding ? textEndScale : 1;
  const currentTextOpacity = isEnding ? textEndOpacity : textOp;
  // Text translation should only be applied if there's an image to interact with
  const currentTextTranslateY = isEnding ? (hasImage ? textEndTranslateY : 0) : textY;
  const currentTextTranslateX = isEnding ? (hasImage ? textEndTranslateX : 0) : 0;

  let imageZIndex = 1;
  if (isEnding) {
    imageZIndex = 2; // Bring image to front during end animation
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        display: "flex",
        flexDirection: p ? "column" : "row",
        alignItems: "center",
        justifyContent: !hasImage ? "center" : undefined,
        padding: p ? "60px 50px" : "60px 80px",
        gap: hasImage ? (p ? 80 : 56) : 0,
        overflow: "hidden",
      }}
    >
      {/* Flyby plane decoration when no image */}
      {!hasImage && (
        <FlybyPlane accentColor={accentColor ?? "#6366F1"} startFrame={20} yZone={0.15} />
      )}

      {/* Image area */}
      {hasImage && ( // Only render image area if imageUrl exists
        <div
          style={{
            flex: p ? "none" : 1,
            width: p ? "100%" : undefined,
            height: p ? "45%" : undefined,
            borderRadius: 16,
            overflow: "hidden",
            opacity: currentImageOpacity,
            transform: `translate(${currentImageTranslateX}px, ${currentImageTranslateY}px) scale(${currentImageScale})`,
            boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
            border: `2px solid ${accentColor}20`,
            zIndex: imageZIndex, // Ensure image is on top during end animation
          }}
        >
          {videoUrl ? (
            <AnimatedVideo
              src={videoUrl}
              muted={videoMuted ?? true}
              volume={videoVolume ?? 0.35}
              durationInFrames={videoDurationInFrames}
              startInFrames={videoStartInFrames}
              style={{
                width: "100%",
                height: "100%",
                objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
                objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
                transform: `scale(${imageZoom ?? 1})`,
                transformOrigin: (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
              }}
            />
          ) : (
            <AnimatedImage
              src={imageUrl!} // imageUrl is guaranteed to exist here due to `hasImage` condition
              style={{
                width: "100%",
                height: "100%",
                objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
                objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
                  transform: `scale(${imageZoom ?? 1})`,
                  transformOrigin: (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
              }}
            />
          )}
        </div>
      )}

      {/* Text area */}
      <div
        style={{
          flex: hasImage ? (p ? "none" : 1) : "none",
          width: !hasImage ? (p ? "90%" : "70%") : undefined,
          maxHeight: "100%",
          opacity: currentTextOpacity,
          transform: `translateY(${currentTextTranslateY}px) translateX(${currentTextTranslateX}px) scale(${currentTextScale})`,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          minHeight: 0,
        }}
      >
        <div
          style={{
            width: `${borderW}%`,
            maxWidth: p ? 80 : undefined,
            height: 4,
            backgroundColor: accentColor,
            borderRadius: 2,
            marginBottom: 20,
            flexShrink: 0,
            // Center the border if no image or if portrait
            marginLeft: (!hasImage || p) ? "auto" : undefined,
            marginRight: (!hasImage || p) ? "auto" : undefined,
          }}
        />
        <h2
          ref={titleRef}
          style={{
            color: textColor,
            fontSize: titlePx,
            fontWeight: 700,
            fontFamily: fontFamily ?? "'Roboto Slab', serif",
            marginTop: 0,
            marginBottom: 16,
            lineHeight: 1.3,
            flexShrink: 0,
          }}
        >
          {title}
        </h2>
        <p
          ref={narrationRef}
          style={{
            color: textColor,
            fontSize: narrationPx,
            fontFamily: fontFamily ?? "'Roboto Slab', serif",
            lineHeight: 1.6,
            opacity: 0.7,
            margin: 0,
            flex: "0 1 auto",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {narration}
        </p>
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
