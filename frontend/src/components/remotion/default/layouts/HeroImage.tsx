import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from "remotion";
import { SceneLayoutProps } from "../types";
import { AnimatedImage } from "./AnimatedImage";

export const HeroImage: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    imageUrl,
    accentColor,
    bgColor,
    textColor,
    aspectRatio,
    titleFontSize,
    descriptionFontSize,
    ...extra
  } = props;
  const frame = useCurrentFrame();
  const fps = 30;
  const { durationInFrames, width, height } = useVideoConfig();
  const isPortrait = height > width;

  const hasImage = !!imageUrl; // Determine if an image URL is provided

  // Content entrance animation for both halves (opacity and scale)
  const contentEntranceDelay = 10;
  const contentSpringVal = spring({
    frame: frame - contentEntranceDelay,
    fps,
    config: { damping: 40, stiffness: 80, mass: 1 },
  });
  const contentOpacity = interpolate(contentSpringVal, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const contentScale = interpolate(contentSpringVal, [0, 1], [0.98, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Background image subtle zoom (applies only to the image within its half)
  const bgSpring = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 100 },
  });
  const bgScale = interpolate(bgSpring, [0, 1], [1.1, 1]);

  // Vanish animation for both sections moving apart and fading out
  const vanishDurationFrames = 30;
  const vanishStartFrame = durationInFrames - vanishDurationFrames;

  const vanishSpringVal = spring({
    frame: frame - vanishStartFrame,
    fps,
    config: { damping: 40, stiffness: 80, mass: 1 },
    durationInFrames: vanishDurationFrames,
  });

  // Calculate transforms for the two halves to move apart
  // Image half moves up (portrait) or left (landscape)
  const imageHalfTranslate = hasImage ? interpolate(
    vanishSpringVal,
    [0, 1],
    [0, isPortrait ? -height / 2 : -width / 2],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  ) : 0; // If no image, it doesn't move

  // Content half moves down (portrait) or right (landscape)
  const contentHalfTranslate = hasImage ? interpolate(
    vanishSpringVal,
    [0, 1],
    [0, isPortrait ? height / 2 : width / 2],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  ) : 0; // If no image, it doesn't move

  // Opacity and scale for the items *within* the halves as they vanish
  const vanishItemOpacity = interpolate(vanishSpringVal, [0, 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const vanishItemScale = interpolate(vanishSpringVal, [0, 1], [1, 0.8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor || "#F0F0F0",
        display: "flex",
        // If an image exists, split the screen. Otherwise, use column direction as there's only one main content block.
        flexDirection: hasImage ? (isPortrait ? "column" : "row") : "column",
        overflow: "hidden", // Hide parts of the sections that move out
      }}
    >
      {/* Upper (portrait) / Left (landscape) Half: Image (only renders if imageUrl exists) */}
      {hasImage && (
        <div
          style={{
            flex: 1, // Takes 50% width or height
            position: "relative", // Needed for AbsoluteFill children to position correctly
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            // Overall transform combines entrance scale with exit translateX/Y
            transform: `${
              isPortrait ? `translateY(${imageHalfTranslate}px)` : `translateX(${imageHalfTranslate}px)`
            } scale(${contentScale})`,
            // Overall opacity for the section's entrance
            opacity: contentOpacity,
          }}
        >
          {/* The image itself gets the background scale and its own vanish opacity/scale */}
          <AbsoluteFill
            style={{
              transform: `scale(${bgScale * vanishItemScale})`,
              opacity: vanishItemOpacity,
            }}
          >
            <AnimatedImage
              src={imageUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </AbsoluteFill>

          {/* Gradient Overlay for the image half */}
          <AbsoluteFill
            style={{
              background:
                "linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, transparent 50%, rgba(200, 230, 255, 0.15) 100%)",
              opacity: vanishItemOpacity, // Gradient also vanishes
            }}
          />
        </div>
      )}

      {/* Lower (portrait) / Right (landscape) Half: Content (Title & Narration) */}
      <div
        style={{
          flex: 1, // Always takes up available space (either 50% or 100% if no image)
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "80px", // Padding around the content
          // Overall transform combines entrance scale with exit translateX/Y
          transform: `${
            isPortrait ? `translateY(${contentHalfTranslate}px)` : `translateX(${contentHalfTranslate}px)`
          } scale(${contentScale})`,
          // Overall opacity for the section's entrance
          opacity: contentOpacity,
        }}
      >
        {/* Content wrapper for text, gets vanish opacity/scale, no card background */}
        <div
          style={{
            textAlign: "center",
            maxWidth: "90%", // Max width for text block
            // The transform and opacity for vanishing apply directly to this content block
            transform: `scale(${vanishItemScale})`,
            opacity: vanishItemOpacity,
          }}
        >
          <h1
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: titleFontSize ?? 76,
              fontWeight: 800,
              lineHeight: 1.1,
              color: textColor || "black",
              margin: 0,
              padding: 0,
              textTransform: "uppercase",
              textShadow: "none",
              whiteSpace: "pre-wrap",
            }}
          >
            {title}
          </h1>

          {narration && (
            <p
              style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: descriptionFontSize ?? 40,
                fontWeight: 400,
                lineHeight: 1.4,
                color: textColor || "black",
                margin: "30px auto 0 auto",
                maxWidth: "40ch", // Keep description max-width for readability
                textShadow: "none",
              }}
            >
              {narration}
            </p>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
