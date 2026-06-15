import { AbsoluteFill, Audio, Sequence } from "remotion";
import {
  LAYOUT_REGISTRY,
  LayoutType,
  SceneLayoutProps,
} from "./layouts";
import { LogoOverlay } from "../LogoOverlay";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";


export interface DefaultSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: LayoutType;
  layoutProps: Record<string, any>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface DefaultVideoCompositionProps {
  scenes: DefaultSceneInput[];
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

export const DefaultVideoComposition: React.FC<DefaultVideoCompositionProps> = ({
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
    <AbsoluteFill style={{ backgroundColor: bgColor, fontFamily: fontFamily }}>
      {scenes.map((scene, sceneIndex) => {
        const durationFrames = getSceneDurationFrames(
          scene.durationSeconds,
          FPS,
          resolvedPlaybackSpeed,
        );
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          LAYOUT_REGISTRY[scene.layout] || LAYOUT_REGISTRY.text_narration;

        const rawLayoutProps = scene.layoutProps;

        const lp = scene.layoutProps as Record<string, unknown>;
        const imageFocusX = Number(lp?.imageFocusX ?? 50);
        const imageFocusY = Number(lp?.imageFocusY ?? 50);
        const imageObjectPosition = `${Math.max(0, Math.min(100, imageFocusX))}% ${Math.max(0, Math.min(100, imageFocusY))}%`;
        const imageZoom = Math.max(0.1, Number(lp?.imageZoom ?? 1));

        const layoutProps: SceneLayoutProps = {
          ...(rawLayoutProps as Record<string, unknown>),
          title: scene.title,
          narration: scene.narration,
          imageUrl: scene.imageUrl,
          imageObjectPosition,
          imageZoom,
          accentColor,
          bgColor,
          textColor,
          aspectRatio,
          fontFamily,
          sceneIndex,
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

      {/* Logo overlay — spans entire video */}
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
