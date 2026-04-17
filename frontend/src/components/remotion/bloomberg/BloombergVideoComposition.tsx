import { AbsoluteFill, Audio, Sequence } from "remotion";
import { BLOOMBERG_LAYOUT_REGISTRY } from "./layouts";
import type { BloombergLayoutProps, BloombergLayoutType } from "./types";
import { LogoOverlay } from "../LogoOverlay";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";

export interface BloombergSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: BloombergLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
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
      {scenes.map((scene) => {
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

        const layoutProps: BloombergLayoutProps = {
          ...(scene.layoutProps as Record<string, unknown>),
          title: scene.title,
          narration: scene.narration,
          accentColor: accentColor || "#5EA2FF",
          bgColor: bgColor || "#000000",
          textColor: textColor || "#FFB340",
          aspectRatio: aspectRatio || "landscape",
          imageUrl: scene.imageUrl,
          layoutType: scene.layout,
          fontFamily,
        };

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
