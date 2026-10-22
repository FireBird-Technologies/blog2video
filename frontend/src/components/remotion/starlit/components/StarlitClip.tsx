import React from "react";
import {Loop} from "remotion";
import {SmartVideo} from "../../SmartVideo";
import {useSceneDurationInFrames} from "../../SceneDurationContext";

/** Stock-footage replacement for Starlit's image slots. */
export function StarlitClip({
  src,
  imageObjectPosition,
  imageZoom,
  muted = true,
  volume = 0.35,
  durationInFrames,
  startInFrames = 0,
  style,
}: {
  src: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  muted?: boolean;
  volume?: number;
  durationInFrames?: number;
  startInFrames?: number;
  style?: React.CSSProperties;
}) {
  const sceneDurationInFrames = useSceneDurationInFrames();
  const position = imageObjectPosition ?? "50% 50%";
  const zoom = Math.max(0.1, imageZoom ?? 1);
  const isZoomedOut = zoom < 1;
  const start = Math.max(0, Math.round(startInFrames || 0));

  const video = (
    <SmartVideo
      src={src}
      muted={muted}
      volume={muted ? 0 : Math.max(0, Math.min(1, volume))}
      trimBefore={start || undefined}
      style={{
        width: "100%",
        height: "100%",
        objectFit: isZoomedOut ? "contain" : "cover",
        objectPosition: isZoomedOut ? "center" : position,
        transform: `scale(${zoom})`,
        transformOrigin: isZoomedOut ? "center center" : position,
        display: "block",
        ...style,
      }}
    />
  );

  const loopFrames = (() => {
    const clipLength =
      durationInFrames && durationInFrames > 0 ? Math.round(durationInFrames) : 0;
    if (clipLength <= 0) return undefined;
    const availableFrames = Math.max(1, clipLength - start);
    if (sceneDurationInFrames && sceneDurationInFrames > 0) {
      return Math.max(1, Math.min(Math.round(sceneDurationInFrames), availableFrames));
    }
    return availableFrames;
  })();

  return loopFrames ? (
    <Loop durationInFrames={loopFrames} layout="none">
      {video}
    </Loop>
  ) : (
    video
  );
}
