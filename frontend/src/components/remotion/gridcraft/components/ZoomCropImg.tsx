import React from "react";
import { Img } from "remotion";
import { GridcraftClip } from "./GridcraftClip";

/**
 * Scene image framing: pan (object-position) + zoom (scale) clipped inside a fixed box.
 *
 * zoom >= 1  →  object-fit: cover  + scale(z) from the focus point (zoom-in, crops edges)
 * zoom <  1  →  object-fit: contain + scale(z) from center (zoom-out, reveals full image)
 */
export function ZoomCropImg({
  src,
  videoUrl,
  videoMuted = true,
  videoVolume = 0.35,
  videoDurationInFrames,
  videoStartInFrames,
  imageObjectPosition,
  imageZoom,
  alt = "",
}: {
  src?: string;
  videoUrl?: string;
  videoMuted?: boolean;
  videoVolume?: number;
  videoDurationInFrames?: number;
  videoStartInFrames?: number;
  imageObjectPosition?: string;
  imageZoom?: number;
  alt?: string;
}) {
  const pos = imageObjectPosition ?? "50% 50%";
  const z = Math.max(0.1, imageZoom ?? 1);
  const isZoomedOut = z < 1;

  const wrapperStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
  };

  const mediaStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    objectFit: isZoomedOut ? "contain" : "cover",
    objectPosition: isZoomedOut ? "center" : pos,
    transform: `scale(${z})`,
    transformOrigin: isZoomedOut ? "center center" : pos,
  };

  if (videoUrl) {
    return (
      <div style={wrapperStyle}>
        <GridcraftClip
          src={videoUrl}
          imageObjectPosition={imageObjectPosition}
          imageZoom={imageZoom}
          muted={videoMuted}
          volume={videoVolume}
          durationInFrames={videoDurationInFrames}
          startInFrames={videoStartInFrames}
          style={mediaStyle}
        />
      </div>
    );
  }

  if (!src) return null;

  return (
    <div style={wrapperStyle}>
      <Img src={src} alt={alt} style={mediaStyle} />
    </div>
  );
}
