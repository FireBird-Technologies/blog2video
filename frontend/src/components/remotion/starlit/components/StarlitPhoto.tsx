import React from "react";
import {Img} from "remotion";
import type {SceneLayoutProps} from "../types";
import {StarlitClip} from "./StarlitClip";

/** The scene's photo, filling its parent, with the same crop / focus / zoom contract as every other Starlit
 * image (Adjust Image). The parent decides the shape (plate, disc, banner) and clips with overflow hidden. */
export const StarlitPhoto: React.FC<{scene: SceneLayoutProps; style?: React.CSSProperties}> = ({scene, style}) => {
  if (!scene.imageUrl && !scene.videoUrl) return null;
  const number = (value: unknown, fallback: number) => value == null || !Number.isFinite(Number(value)) ? fallback : Number(value);
  const zoom = Math.max(.1, Math.min(8, number(scene.imageZoom, 1)));
  const focus = scene.imageFocusX != null || scene.imageFocusY != null
    ? `${Math.max(0, Math.min(100, number(scene.imageFocusX, 50)))}% ${Math.max(0, Math.min(100, number(scene.imageFocusY, 50)))}%`
    : scene.imageObjectPosition || "50% 50%";
  if (scene.videoUrl) {
    return <StarlitClip src={scene.videoUrl} imageObjectPosition={focus} imageZoom={zoom} muted={scene.videoMuted} volume={scene.videoVolume} durationInFrames={scene.videoDurationInFrames} startInFrames={scene.videoStartInFrames} style={style} />;
  }
  return <Img src={scene.imageUrl!} style={{width: "100%", height: "100%", objectFit: zoom < 1 ? "contain" : "cover", objectPosition: zoom < 1 ? "center" : focus, transform: `scale(${zoom})`, transformOrigin: zoom < 1 ? "center center" : focus, ...style}} />;
};
