import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { Stickman2Clip } from "./components/Stickman2Clip";

interface Props {
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  opacity?: number;
  // Stock footage: a clip fills the same atmospheric slot as the still.
  videoUrl?: string;
  videoMuted?: boolean;
  videoVolume?: number;
  videoDurationInFrames?: number;
  videoStartInFrames?: number;
}

/** Full-canvas atmospheric background — matches chalk_title hero treatment. */
export const Stickman2BackgroundImage: React.FC<Props> = ({
  imageUrl,
  imageObjectPosition,
  imageZoom,
  opacity = 0.35,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
}) => {
  if (!imageUrl && !videoUrl) return null;
  const visualStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: imageObjectPosition ?? "50% 50%",
    transform: `scale(${imageZoom ?? 1})`,
    transformOrigin: "center",
    opacity,
  };
  return (
    <AbsoluteFill style={{ zIndex: 0 }}>
      {videoUrl ? (
        <Stickman2Clip
          src={videoUrl}
          imageObjectPosition={imageObjectPosition}
          imageZoom={imageZoom}
          muted={videoMuted ?? true}
          volume={videoVolume ?? 0.35}
          durationInFrames={videoDurationInFrames}
          startInFrames={videoStartInFrames}
          style={visualStyle}
        />
      ) : (
        <Img src={imageUrl!} style={visualStyle} />
      )}
    </AbsoluteFill>
  );
};
