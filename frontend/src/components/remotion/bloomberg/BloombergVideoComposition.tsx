import { AbsoluteFill, Audio, Sequence } from "remotion";
import { BLOOMBERG_LAYOUT_REGISTRY } from "./layouts";
import type { BloombergLayoutProps, BloombergLayoutType } from "./types";
import { LogoOverlay } from "../LogoOverlay";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
import {
  BLOOMBERG_TRANSITION_DURATION,
  BloombergTransition,
  pickBloombergTransition,
} from "./BloombergTransition";

export interface BloombergSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: BloombergLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  voiceoverUrl?: string;
}

export interface BloombergVideoCompositionProps {
  scenes: BloombergSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
  playbackSpeed?: number;
}

export const BloombergVideoComposition: React.FC<
  BloombergVideoCompositionProps
> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  logoOpacity,
  logoSize,
  aspectRatio,
  fontFamily,
  playbackSpeed,
}) => {
  const FPS = 30;
  const resolvedPlaybackSpeed = getPlaybackSpeed(playbackSpeed);
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#000000", fontFamily }}>
      {scenes.map((scene, index) => {
        const durationFrames = getSceneDurationFrames(
          scene.durationSeconds,
          FPS,
          resolvedPlaybackSpeed,
        );
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          BLOOMBERG_LAYOUT_REGISTRY[scene.layout] ??
          BLOOMBERG_LAYOUT_REGISTRY.terminal_narrative;

        const lp = (scene.layoutProps || {}) as Record<string, unknown>;
        const focusX = typeof lp.imageFocusX === "number" ? lp.imageFocusX : 50;
        const focusY = typeof lp.imageFocusY === "number" ? lp.imageFocusY : 50;
        const resolvedZoom = typeof lp.imageZoom === "number" ? lp.imageZoom : (scene.imageZoom ?? 1);

        const layoutProps: BloombergLayoutProps = {
          ...lp,
          title: scene.title,
          narration: scene.narration,
          accentColor: accentColor || "#5EA2FF",
          bgColor: bgColor || "#000000",
          textColor: textColor || "#FFB340",
          aspectRatio: aspectRatio || "landscape",
          imageUrl: scene.imageUrl,
          imageObjectPosition: scene.imageObjectPosition ?? `${focusX}% ${focusY}%`,
          imageZoom: resolvedZoom,
          layoutType: scene.layout,
          fontFamily,
        };

        const isLast = index === scenes.length - 1;
        const showTransition =
          !isLast && durationFrames > BLOOMBERG_TRANSITION_DURATION + 2;
        const transitionFrom = Math.max(
          0,
          durationFrames - BLOOMBERG_TRANSITION_DURATION,
        );
        const variant = pickBloombergTransition(scene.layout);

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <LayoutComponent {...layoutProps} />
            {scene.voiceoverUrl && (
              <Audio src={scene.voiceoverUrl} playbackRate={resolvedPlaybackSpeed} />
            )}
            {showTransition && (
              <Sequence
                from={transitionFrom}
                durationInFrames={BLOOMBERG_TRANSITION_DURATION}
                name={`transition:${variant}`}
              >
                <BloombergTransition
                  variant={variant}
                  accentColor={accentColor || "#5EA2FF"}
                  textColor={textColor || "#FFB340"}
                  bgColor={bgColor || "#000000"}
                  aspectRatio={aspectRatio || "landscape"}
                  fontFamily={fontFamily}
                />
              </Sequence>
            )}
          </Sequence>
        );
      })}

      {logo && (
        <LogoOverlay
          src={logo}
          position={logoPosition || "bottom_right"}
          maxOpacity={logoOpacity ?? 0.9}
          size={logoSize ?? 100}
          aspectRatio={aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};
