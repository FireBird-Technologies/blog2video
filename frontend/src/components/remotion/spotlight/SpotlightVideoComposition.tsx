import { AbsoluteFill, Audio, Sequence } from "remotion";
import { SPOTLIGHT_LAYOUT_REGISTRY } from "./layouts";
import type { SpotlightLayoutType, SpotlightLayoutProps } from "./types";
import { LogoOverlay } from "../LogoOverlay";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";

export interface SpotlightSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: SpotlightLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface SpotlightVideoCompositionProps {
  scenes: SpotlightSceneInput[];
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

export const SpotlightVideoComposition: React.FC<
  SpotlightVideoCompositionProps
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
          SPOTLIGHT_LAYOUT_REGISTRY[scene.layout] ||
          SPOTLIGHT_LAYOUT_REGISTRY.statement;

        const layoutProps: SpotlightLayoutProps = {
          ...scene.layoutProps,
          title: scene.title,
          narration: scene.narration,
          accentColor: accentColor || "#EF4444",
          bgColor: bgColor || "#000000",
          textColor: textColor || "#FFFFFF",
          aspectRatio: aspectRatio || "landscape",
          imageUrl: scene.imageUrl,
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
