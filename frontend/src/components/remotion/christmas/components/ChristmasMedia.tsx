/**
 * The scene's photo (or stock clip), filling its parent. Same crop / focus / zoom
 * contract as every other built-in (Adjust Image), plus a round bauble frame.
 *
 * Mirror byte-identical in all three trees.
 */
import React from "react";
import { Img, Loop } from "remotion";
import { SmartVideo } from "../../SmartVideo";
import { useSceneDurationInFrames } from "../../SceneDurationContext";
import type { SceneLayoutProps } from "../types";
import { FESTIVE, mix, withOpacity, type WinterPalette } from "../christmasStyle";

const num = (value: unknown, fallback: number) =>
  value == null || !Number.isFinite(Number(value)) ? fallback : Number(value);

export const hasMedia = (scene: SceneLayoutProps) => Boolean(scene.imageUrl || scene.videoUrl);

/** Media only (fills its parent). */
export const ChristmasMedia: React.FC<{ scene: SceneLayoutProps }> = ({ scene }) => {
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

/**
 * A glass Christmas bauble holding the media: gold cap + hook, accent rim, a glossy
 * highlight and a hanging ribbon. `size` is the ball's diameter.
 */
export const OrnamentFrame: React.FC<{
  scene: SceneLayoutProps;
  pal: WinterPalette;
  size: number;
  /** Swing angle in degrees (pivot at the ribbon top). */
  swing?: number;
  ribbon?: number;
  style?: React.CSSProperties;
}> = ({ scene, pal, size, swing = 0, ribbon = 0, style }) => {
  const rim = Math.max(8, size * 0.035);
  const capW = size * 0.24;
  const capH = size * 0.1;
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size + capH + ribbon,
        transform: `rotate(${swing}deg)`,
        transformOrigin: "50% 0%",
        ...style,
      }}
    >
      {ribbon > 0 ? (
        <div style={{ position: "absolute", left: "50%", top: 0, width: 4, height: ribbon, marginLeft: -2, background: pal.accent }} />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: (size - capW) / 2,
          top: ribbon,
          width: capW,
          height: capH,
          borderRadius: `${capH * 0.3}px ${capH * 0.3}px 4px 4px`,
          background: `linear-gradient(90deg, ${mix(FESTIVE.gold, "#7a5a10", 0.3)}, ${FESTIVE.goldLight}, ${FESTIVE.gold})`,
          boxShadow: `0 2px 4px ${pal.shadow}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: ribbon + capH * 0.82,
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          border: `${rim}px solid ${pal.accent}`,
          boxSizing: "border-box",
          background: pal.snowShade,
          boxShadow: `0 ${size * 0.05}px ${size * 0.09}px ${pal.shadow}, inset 0 0 ${size * 0.08}px ${withOpacity(pal.accentDark, 0.6)}`,
        }}
      >
        <ChristmasMedia scene={scene} />
        {/* glass gloss */}
        <div
          style={{
            position: "absolute",
            left: "14%",
            top: "10%",
            width: "34%",
            height: "22%",
            borderRadius: "50%",
            background: "radial-gradient(closest-side, rgba(255,255,255,0.7), rgba(255,255,255,0))",
            transform: "rotate(-28deg)",
          }}
        />
      </div>
    </div>
  );
};
