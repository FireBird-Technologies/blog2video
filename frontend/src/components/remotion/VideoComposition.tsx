import { AbsoluteFill, Audio, Sequence } from "remotion";
import {
  LAYOUT_REGISTRY,
  LayoutType,
  SceneLayoutProps,
} from "./layouts";
import { LogoOverlay } from "./LogoOverlay";

export interface SceneInput {
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

export interface VideoCompositionProps {
  scenes: SceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  aspectRatio?: string;
}

export const VideoComposition: React.FC<VideoCompositionProps> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  aspectRatio,
}) => {
  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor }}>
      {scenes.map((scene) => {
        const durationFrames = Math.round(scene.durationSeconds * FPS);
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          LAYOUT_REGISTRY[scene.layout] || LAYOUT_REGISTRY.text_narration;

        const layoutProps: SceneLayoutProps = {
          title: scene.title,
          narration: scene.narration,
          imageUrl: scene.imageUrl,
          accentColor,
          bgColor,
          textColor,
          aspectRatio,
          ...scene.layoutProps,
        };

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <LayoutComponent {...layoutProps} />
            {scene.voiceoverUrl && <Audio src={scene.voiceoverUrl} />}
          </Sequence>
        );
      })}

      {/* Logo overlay — spans entire video */}
      {logo && (
        <LogoOverlay
          src={logo}
          position={logoPosition || "bottom_right"}
          aspectRatio={aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};
