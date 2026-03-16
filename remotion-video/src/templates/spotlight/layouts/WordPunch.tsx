import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring } from "remotion";
import { SpotlightBackground } from "../SpotlightBackground";
import { SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY } from "../constants";
import type { SpotlightLayoutProps } from "../types";

/**
 * WordPunch — Single Word Impact
 *
 * ONE word/short phrase fills the entire frame at 180-200px.
 * Springs from 0% to ~110% (overshoot) then settles to 100%.
 * Optional image can sit below the word when available.
 */
export const WordPunch: React.FC<SpotlightLayoutProps> = ({
  word,
  title,
  imageUrl,
  accentColor,
  bgColor,
  aspectRatio,
  titleFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const p = aspectRatio === "portrait";
  const displayFontFamily =
    fontFamily ?? SPOTLIGHT_DISPLAY_DEFAULT_FONT_FAMILY;

  const punchSpring = spring({
    frame: frame - 3,
    fps,
    config: { damping: 14, stiffness: 220, mass: 1.1 },
  });

  const scale = punchSpring * 1.1 - Math.sin(punchSpring * Math.PI) * 0.06;

  const opacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });

  const displayWord = word || title;
  const hasImage = Boolean(imageUrl);
  const imageOpacity = interpolate(frame, [10, 35], [0, 1], {
    extrapolateRight: "clamp",
  });
  const imageScale = spring({
    frame: frame - 10,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <SpotlightBackground bgColor={bgColor} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: hasImage ? "flex-start" : "center",
          gap: hasImage ? (p ? 36 : 44) : 0,
          padding: hasImage
            ? p
              ? "14% 8% 12%"
              : "10% 8% 10%"
            : p
              ? "10% 8%"
              : "0 8%",
        }}
      >
        <div
          style={{
            fontSize: titleFontSize ?? (hasImage ? (p ? 100 : 148) : (p ? 112 : 164)),
            fontWeight: 900,
            color: accentColor,
            textTransform: "uppercase",
            letterSpacing: "-0.05em",
            transform: `scale(${Math.max(scale, 0)})`,
            opacity,
            fontFamily: displayFontFamily,
            lineHeight: 1,
            textAlign: "center",
            padding: "0 5%",
            maxWidth: hasImage ? "90%" : "100%",
          }}
        >
          {displayWord}
        </div>

        {hasImage && (
          <div
            style={{
              width: p ? "72%" : "42%",
              height: p ? "26%" : "32%",
              borderRadius: 4,
              overflow: "hidden",
              opacity: imageOpacity,
              transform: `scale(${imageScale})`,
            }}
          >
            <Img
              src={imageUrl!}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
