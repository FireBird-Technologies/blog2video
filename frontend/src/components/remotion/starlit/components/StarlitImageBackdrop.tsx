import React, {useId} from "react";
import {AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import type {SceneLayoutProps} from "../types";
import {StarlitClip} from "./StarlitClip";
import {parseThemeColor} from "./themeColor";

/** Same focus/zoom contract as Sakura and Newspaper, with a readable space wash. */
export const StarlitImageBackdrop: React.FC<{scene: SceneLayoutProps; feature?: boolean}> = ({scene, feature = false}) => {
  const id = `starlit-photo-${useId().replace(/:/g, "")}`;
  const frame = useCurrentFrame();
  const {height, width, fps} = useVideoConfig();
  if (!scene.imageUrl && !scene.videoUrl) return null;
  const number = (value: unknown, fallback: number) => value == null || !Number.isFinite(Number(value)) ? fallback : Number(value);
  const zoom = Math.max(.1, Math.min(8, number(scene.imageZoom, 1)));
  const focus = scene.imageFocusX != null || scene.imageFocusY != null
    ? `${Math.max(0, Math.min(100, number(scene.imageFocusX, 50)))}% ${Math.max(0, Math.min(100, number(scene.imageFocusY, 50)))}%`
    : scene.imageObjectPosition || "50% 50%";
  const opacity = feature ? .8 : .38;
  const bg = scene.bgColor || "#000000";
  const portrait = scene.aspectRatio === "portrait" || height > width;
  const entrance = interpolate(frame, [0, Math.max(1, fps * .65)], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const accent = scene.accentColor || "#217cff";
  const rgb = (value: string, fallback: number[]) => {
    const parsed = parseThemeColor(value);
    return parsed ? parsed.map((v) => v / 255) : fallback;
  };
  const light = rgb(scene.textColor || "#ffffff", [1, 1, 1]);
  const dark = rgb(bg, [0, 0, 0]);
  const mid = rgb(accent, light);
  const imageMask = feature
    ? portrait ? "linear-gradient(180deg, transparent 16%, #000 49%, #000 100%)"
      : "linear-gradient(90deg, transparent 20%, #000 59%, #000 100%)"
    : undefined;
  return <AbsoluteFill style={{pointerEvents: "none", overflow: "hidden"}}>
    {feature ? <svg width="0" height="0" aria-hidden="true" style={{position: "absolute"}}>
      <defs><filter id={id} colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="table" tableValues={`${dark[0]} ${mid[0]} ${light[0]}`} />
          <feFuncG type="table" tableValues={`${dark[1]} ${mid[1]} ${light[1]}`} />
          <feFuncB type="table" tableValues={`${dark[2]} ${mid[2]} ${light[2]}`} />
        </feComponentTransfer>
      </filter></defs>
    </svg> : null}
    <AbsoluteFill style={{opacity: (feature ? .7 : opacity) * entrance, maskImage: imageMask, WebkitMaskImage: imageMask}}>
      {scene.videoUrl ? <StarlitClip src={scene.videoUrl} imageObjectPosition={focus} imageZoom={zoom} muted={scene.videoMuted} volume={scene.videoVolume} durationInFrames={scene.videoDurationInFrames} startInFrames={scene.videoStartInFrames} style={{filter: feature ? `url(#${id}) contrast(1.12)` : undefined}} /> : <Img src={scene.imageUrl!} style={{width: "100%", height: "100%", objectFit: zoom < 1 ? "contain" : "cover", objectPosition: zoom < 1 ? "center" : focus, transform: `scale(${zoom})`, transformOrigin: zoom < 1 ? "center center" : focus, filter: feature ? `url(#${id}) contrast(1.12)` : undefined}} />}
    </AbsoluteFill>
    <AbsoluteFill style={{background: feature
      ? portrait ? `linear-gradient(180deg, color-mix(in srgb, ${bg} 40%, transparent) 0%, color-mix(in srgb, ${bg} 30%, transparent) 30%, transparent 59%)`
        : `linear-gradient(90deg, color-mix(in srgb, ${bg} 42%, transparent) 0%, color-mix(in srgb, ${bg} 30%, transparent) 32%, transparent 63%)`
      : `radial-gradient(ellipse at center, color-mix(in srgb, ${bg} 38%, transparent), color-mix(in srgb, ${bg} 8%, transparent))`}} />
    {feature ? (() => {
      // A broad, diffuse nebula light that stays for the whole scene: no bright centre and no shape of
      // its own, drawn as a full-frame gradient that fades smoothly to nothing.
      const glowX = portrait ? 50 : 64;
      const glowY = portrait ? 66 : 48;
      const breathe = 1 + .05 * Math.sin((frame / fps) * 1.3);
      const reach = Math.min(width, height) * .62 * breathe;
      return <AbsoluteFill style={{opacity: entrance * .5, background: `radial-gradient(circle ${reach}px at ${glowX}% ${glowY}%, color-mix(in srgb, color-mix(in srgb, ${accent} 70%, white) 46%, transparent) 0%, color-mix(in srgb, ${accent} 40%, transparent) 26%, color-mix(in srgb, ${accent} 20%, transparent) 50%, color-mix(in srgb, ${accent} 8%, transparent) 74%, color-mix(in srgb, ${accent} 2%, transparent) 92%, transparent 100%)`}} />;
    })() : null}
  </AbsoluteFill>;
};
