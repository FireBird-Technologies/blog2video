import { AbsoluteFill, Audio, Sequence } from "remotion";
import { WHITEBOARD_LAYOUT_REGISTRY } from "./layouts";
import type { WhiteboardLayoutType, WhiteboardLayoutProps } from "./types";
import { LogoOverlay } from "../LogoOverlay";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";

export interface WhiteboardSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: WhiteboardLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface WhiteboardVideoCompositionProps {
  scenes: WhiteboardSceneInput[];
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

export const WhiteboardVideoComposition: React.FC<
  WhiteboardVideoCompositionProps
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
    <AbsoluteFill style={{ backgroundColor: bgColor || "#F7F3E8", fontFamily }}>
      {scenes.map((scene) => {
        const durationFrames = getSceneDurationFrames(
          scene.durationSeconds,
          FPS,
          resolvedPlaybackSpeed,
        );
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          WHITEBOARD_LAYOUT_REGISTRY[scene.layout] ||
          WHITEBOARD_LAYOUT_REGISTRY.marker_story;

        const layoutProps: WhiteboardLayoutProps = {
          ...scene.layoutProps,
          title: scene.title,
          narration: scene.narration,
          imageUrl: scene.imageUrl,
          accentColor: accentColor || "#1F2937",
          bgColor: bgColor || "#F7F3E8",
          textColor: textColor || "#111827",
          aspectRatio: aspectRatio || "landscape",
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
