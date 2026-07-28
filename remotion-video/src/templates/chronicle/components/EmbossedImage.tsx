import React from "react";
import { Img, interpolate, useCurrentFrame } from "remotion";
import { ChronicleClip } from "./ChronicleClip";

interface EmbossedImageProps {
  src: string;
  videoUrl?: string;
  videoMuted?: boolean;
  videoVolume?: number;
  videoDurationInFrames?: number;
  videoStartInFrames?: number;
  objectPosition?: string;
  zoom?: number;
  rotate?: number;
  revealStart?: number;
  instant?: boolean;
  style?: React.CSSProperties;
  matSize?: number;
  inkFrame?: boolean;
}

export const EmbossedImage: React.FC<EmbossedImageProps> = ({
  src,
  videoUrl,
  videoMuted = true,
  videoVolume = 0.35,
  videoDurationInFrames,
  videoStartInFrames,
  objectPosition,
  zoom,
  rotate = 0,
  revealStart = 0,
  instant = false,
  style,
  matSize = 14,
  inkFrame = true,
}) => {
  const frame = useCurrentFrame();
  const local = frame - revealStart;

  const revealProgress = instant
    ? 1
    : interpolate(local, [0, 20], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const sepiaAmount = instant ? 0.55 : interpolate(revealProgress, [0, 1], [0.85, 0.55]);
  const blurAmount = instant ? 0 : interpolate(revealProgress, [0, 1], [8, 0]);

  const clipRadius = instant ? 120 : interpolate(revealProgress, [0, 1], [0, 120]);
  const z = zoom ?? 1;
  const isZoomedOut = z < 1;
  const pos = objectPosition ?? "50% 50%";

  const mediaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: isZoomedOut ? "contain" : "cover",
    objectPosition: isZoomedOut ? "center" : pos,
    transform: `scale(${z})`,
    transformOrigin: isZoomedOut ? "center center" : pos,
    filter: `sepia(${sepiaAmount}) saturate(0.85) contrast(1.05) brightness(0.94) blur(${blurAmount}px)`,
    display: "block",
  };

  return (
    <div
      style={{
        background: "#F8EFD6",
        padding: matSize,
        boxShadow:
          "0 14px 38px rgba(40,25,12,0.35), inset 0 0 0 1px rgba(40,25,12,0.15), inset 0 4px 10px rgba(40,25,12,0.15)",
        transform: `rotate(${rotate}deg)`,
        position: "relative",
        ...style,
      }}
    >
      {inkFrame && (
        <div
          style={{
            position: "absolute",
            inset: matSize - 3,
            border: "1px solid rgba(40,25,12,0.55)",
            outline: "1px solid rgba(40,25,12,0.25)",
            outlineOffset: 3,
            pointerEvents: "none",
            zIndex: 4,
          }}
        />
      )}

      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          clipPath: `circle(${clipRadius}% at 50% 50%)`,
        }}
      >
        {videoUrl ? (
          <ChronicleClip
            src={videoUrl}
            imageObjectPosition={objectPosition}
            imageZoom={zoom}
            muted={videoMuted}
            volume={videoVolume}
            durationInFrames={videoDurationInFrames}
            startInFrames={videoStartInFrames}
            style={mediaStyle}
          />
        ) : (
          <Img src={src} style={mediaStyle} />
        )}

        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(rgba(60,40,20,0.25) 1px, transparent 1px)",
            backgroundSize: "3px 3px",
            mixBlendMode: "multiply",
            opacity: 0.35,
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at center, transparent 55%, rgba(40,25,12,0.45) 100%)",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
};
