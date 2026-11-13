/**
 * The scene's photo (or stock clip) as a print taped onto the crumpled sheet:
 * white border, slight tilt, soft drop shadow, two strips of masking tape.
 * Same crop / focus / zoom contract as every other built-in (Adjust Image).
 *
 * Mirror byte-identical in both trees (remotion-video + frontend).
 */
import React from "react";
import { Img, Loop } from "remotion";
import { SmartVideo } from "../../SmartVideo";
import { useSceneDurationInFrames } from "../../SceneDurationContext";
import type { SceneLayoutProps } from "../types";
import { type PaperPalette, withOpacity } from "../crumpledStyle";

const num = (value: unknown, fallback: number) =>
  value == null || !Number.isFinite(Number(value)) ? fallback : Number(value);

/** Media only (fills its parent). */
export const PaperMedia: React.FC<{ scene: SceneLayoutProps }> = ({ scene }) => {
  const sceneFrames = useSceneDurationInFrames();
  if (!scene.imageUrl && !scene.videoUrl) return null;
  const zoom = Math.max(0.1, Math.min(8, num(scene.imageZoom, 1)));
  const focus =
    scene.imageFocusX != null || scene.imageFocusY != null
      ? `${Math.max(0, Math.min(100, num(scene.imageFocusX, 50)))}% ${Math.max(0, Math.min(100, num(scene.imageFocusY, 50)))}%`
      : scene.imageObjectPosition || "50% 50%";
  const style: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: zoom < 1 ? "contain" : "cover",
    objectPosition: zoom < 1 ? "center" : focus,
    transform: `scale(${zoom})`,
    transformOrigin: zoom < 1 ? "center center" : focus,
    display: "block",
    // A touch of desaturation so photos sit on paper rather than glow off it.
    filter: "saturate(0.9) contrast(1.02)",
  };
  if (scene.videoUrl) {
    const start = Math.max(0, Math.round(scene.videoStartInFrames || 0));
    const muted = scene.videoMuted ?? true;
    const video = (
      <SmartVideo
        src={scene.videoUrl}
        muted={muted}
        volume={muted ? 0 : Math.max(0, Math.min(1, scene.videoVolume ?? 0.35))}
        trimBefore={start || undefined}
        style={style}
      />
    );
    const clipLength = scene.videoDurationInFrames && scene.videoDurationInFrames > 0 ? Math.round(scene.videoDurationInFrames) : 0;
    if (clipLength <= 0) return video;
    const available = Math.max(1, clipLength - start);
    const loop = sceneFrames && sceneFrames > 0 ? Math.max(1, Math.min(Math.round(sceneFrames), available)) : available;
    return (
      <Loop durationInFrames={loop} layout="none">
        {video}
      </Loop>
    );
  }
  return <Img src={scene.imageUrl!} style={style} />;
};

/** A taped print: border, tilt, shadow and two tape strips. */
export const TapedPrint: React.FC<{
  scene: SceneLayoutProps;
  palette: PaperPalette;
  width: number;
  height: number;
  tilt?: number;
  border?: number;
  style?: React.CSSProperties;
}> = ({ scene, palette, width, height, tilt = -2.5, border = 14, style }) => {
  const tapeW = Math.max(90, width * 0.26);
  const tapeH = Math.max(30, tapeW * 0.3);
  const tape = (left: string, rot: number): React.CSSProperties => ({
    position: "absolute",
    top: -tapeH * 0.48,
    left,
    width: tapeW,
    height: tapeH,
    background: palette.tape,
    transform: `translateX(-50%) rotate(${rot}deg)`,
    boxShadow: `0 1px 2px ${withOpacity(palette.ink, 0.12)}`,
    clipPath: "polygon(2% 8%, 8% 0, 16% 6%, 26% 0, 38% 5%, 50% 0, 62% 6%, 74% 0, 86% 5%, 96% 0, 100% 50%, 97% 92%, 88% 100%, 76% 94%, 64% 100%, 52% 95%, 40% 100%, 28% 94%, 16% 100%, 4% 95%, 0 50%)",
  });
  return (
    <div style={{ position: "relative", width, height, transform: `rotate(${tilt}deg)`, ...style }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: palette.highlight,
          padding: border,
          boxSizing: "border-box",
          boxShadow: `0 18px 34px ${withOpacity(palette.ink, 0.22)}, 0 2px 6px ${withOpacity(palette.ink, 0.16)}`,
        }}
      >
        <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: palette.crease }}>
          <PaperMedia scene={scene} />
        </div>
      </div>
      <div style={tape("18%", -8)} />
      <div style={tape("82%", 7)} />
    </div>
  );
};
