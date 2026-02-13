import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SceneLayoutProps } from "./types";
import { AnimatedImage } from "./AnimatedImage";

export const HeroImage: React.FC<SceneLayoutProps> = ({
  imageUrl,
  bgColor,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 40], [0, 1], {
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, 60], [1.08, 1.0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor }}>
      {imageUrl && (
        <AnimatedImage
          src={imageUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity,
            transform: `scale(${scale})`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
