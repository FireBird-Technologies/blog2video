import React from "react";
import { AbsoluteFill } from "remotion";
import { DEFAULT_NEWSCAST_ACCENT, toRgba } from "./themeUtils";
import { ZoomCropImg } from "./components/ZoomCropImg";
import { ZoomCropVideo } from "./components/ZoomCropVideo";

/**
 * Shared "photo plate" background used by NEWSCAST layouts.
 * It fills the scene and adds a navy/red editorial overlay for readability.
 * Empty areas when imageZoom < 1 are transparent — the composition's base
 * background and the editorial overlay above handle visual consistency.
 *
 * The plate holds EITHER a still or a stock clip; `videoUrl` wins when both are
 * somehow present, and the overlays are identical either way so readability of
 * the chrome above does not depend on which one is showing.
 */
export const NewsCastLayoutImageBackground: React.FC<{
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  accentColor?: string;
  videoUrl?: string;
  videoMuted?: boolean;
  videoVolume?: number;
  videoDurationInFrames?: number;
  videoStartInFrames?: number;
}> = ({
  imageUrl,
  imageObjectPosition,
  imageZoom,
  accentColor,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
}) => {
  if (!imageUrl && !videoUrl) return null;

  // 1.04× overscan so plate edges never show seams; multiplied with scene zoom.
  const plateZoom = 1.04 * Math.max(0.1, imageZoom ?? 1);

  return (
    <AbsoluteFill aria-hidden style={{ zIndex: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        {videoUrl ? (
          <ZoomCropVideo
            src={videoUrl}
            imageObjectPosition={imageObjectPosition}
            imageZoom={plateZoom}
            muted={videoMuted ?? true}
            volume={videoVolume ?? 0.35}
            durationInFrames={videoDurationInFrames}
            startInFrames={videoStartInFrames}
          />
        ) : (
          <ZoomCropImg
            src={imageUrl!}
            imageObjectPosition={imageObjectPosition}
            imageZoom={plateZoom}
            alt=""
          />
        )}
      </div>
      {/* Editorial overlays (navy to reduce bright photos) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(6,6,20,0.82) 0%, rgba(10,42,110,0.25) 45%, rgba(6,6,20,0.78) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 25% 18%, ${toRgba(
            accentColor || DEFAULT_NEWSCAST_ACCENT,
            0.18,
          )} 0%, transparent 55%)`,
          opacity: 0.9,
        }}
      />
    </AbsoluteFill>
  );
};
