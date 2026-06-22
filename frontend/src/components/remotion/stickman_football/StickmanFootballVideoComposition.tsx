import { AbsoluteFill, Audio, Sequence } from "remotion";
import { STICKMAN_FOOTBALL_LAYOUT_REGISTRY as LAYOUT_REGISTRY, StickmanFootballLayoutType, SceneLayoutProps } from "./layouts";
import { LogoOverlay } from "../LogoOverlay";

export interface StickmanFootballSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: StickmanFootballLayoutType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layoutProps: Record<string, any>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface StickmanFootballVideoCompositionProps {
  scenes: StickmanFootballSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
}

export const StickmanFootballVideoComposition: React.FC<StickmanFootballVideoCompositionProps> = ({
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
}) => {
  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#FFFFFF", fontFamily }}>
      {scenes.map((scene) => {
        const durationFrames = Math.max(
          1,
          Math.round((Number(scene.durationSeconds) || 5) * FPS),
        );
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          LAYOUT_REGISTRY[scene.layout] ?? LAYOUT_REGISTRY.passing_play;

        const focusX = Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusX ?? 50)));
        const focusY = Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusY ?? 50)));

        const layoutProps: SceneLayoutProps = {
          ...(scene.layoutProps as Record<string, unknown>),
          title: scene.title,
          narration: scene.narration,
          imageUrl: scene.imageUrl ?? (scene.layoutProps as Record<string, unknown>)?.imageUrl as string | undefined,
          imageObjectPosition: `${focusX}% ${focusY}%`,
          imageZoom: Math.max(0.1, Number((scene.layoutProps as Record<string, unknown>)?.imageZoom ?? 1)),
          accentColor: accentColor || "#2E7D32",
          bgColor: bgColor || "#FFFFFF",
          textColor: textColor || "#111111",
          aspectRatio,
          sceneDurationInFrames: durationFrames,
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
            {scene.voiceoverUrl && <Audio src={scene.voiceoverUrl} />}
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
