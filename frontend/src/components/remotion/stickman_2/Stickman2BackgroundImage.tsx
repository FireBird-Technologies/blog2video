import React from "react";
import { AbsoluteFill, Img } from "remotion";

interface Props {
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  opacity?: number;
}

/** Full-canvas atmospheric background — matches chalk_title hero treatment. */
export const Stickman2BackgroundImage: React.FC<Props> = ({
  imageUrl,
  imageObjectPosition,
  imageZoom,
  opacity = 0.35,
}) => {
  if (!imageUrl) return null;
  return (
    <AbsoluteFill style={{ zIndex: 0 }}>
      <Img
        src={imageUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: imageObjectPosition ?? "50% 50%",
          transform: `scale(${imageZoom ?? 1})`,
          transformOrigin: "center",
          opacity,
        }}
      />
    </AbsoluteFill>
  );
};
