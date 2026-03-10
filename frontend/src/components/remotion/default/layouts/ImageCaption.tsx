import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from "remotion";
import { SceneLayoutProps } from "../types";
import { AnimatedImage } from "./AnimatedImage";

export const ImageCaption: React.FC<SceneLayoutProps> = ({
  title,
  narration,
  imageUrl,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, width: videoWidth, height: videoHeight } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const hasImage = !!imageUrl; // New variable to track image presence

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
        padding: p ? "60px 50px" : "60px 80px",
        gap: hasImage ? (p ? 80 : 56) : 0, // No gap if no image
        overflow: "hidden",
      }}
    >
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
          <AnimatedImage
            src={imageUrl!} // imageUrl is guaranteed to exist here due to `hasImage` condition
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}

      {/* Text area */}
      <div
        style={{
          flex: hasImage ? (p ? "none" : 1) : 1, // If no image, text takes full available flex space.
          opacity: currentTextOpacity,
          transform: `translateY(${currentTextTranslateY}px) translateX(${currentTextTranslateX}px) scale(${currentTextScale})`,
          textAlign: hasImage ? (p ? "center" : "left") : "center", // Center text if no image
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
            // Center the border if no image or if portrait
            marginLeft: (!hasImage || p) ? "auto" : undefined,
            marginRight: (!hasImage || p) ? "auto" : undefined,
          }}
        />
        <h2
          style={{
            color: textColor,
            fontSize: titleFontSize ?? (p ? 57 : 56),
            fontWeight: 700,
            fontFamily: "Inter, sans-serif",
            marginTop: 0,
            marginBottom: 16,
            lineHeight: 1.3,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            color: textColor,
            fontSize: descriptionFontSize ?? (p ? 37 : 32),
            fontFamily: "Inter, sans-serif",
            lineHeight: 1.6,
            opacity: 0.7,
            margin: 0,
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
