import { AbsoluteFill, Audio, Sequence } from "remotion";
import { GRIDCRAFT_LAYOUT_REGISTRY } from "./layouts";
import type { GridcraftLayoutType, GridcraftLayoutProps } from "./types";
import { LogoOverlay } from "../LogoOverlay";

export interface GridcraftSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: GridcraftLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface GridcraftVideoCompositionProps {
  scenes: GridcraftSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  aspectRatio?: string;
}

export const GridcraftVideoComposition: React.FC<
  GridcraftVideoCompositionProps
> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  logoOpacity,
  aspectRatio,
}) => {
  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#FAFAFA" }}>
      {scenes.map((scene) => {
        const durationFrames = Math.round(scene.durationSeconds * FPS);
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          GRIDCRAFT_LAYOUT_REGISTRY[scene.layout] ||
          GRIDCRAFT_LAYOUT_REGISTRY.editorial_body;

        const layoutProps: GridcraftLayoutProps = {
          title: scene.title,
          narration: scene.narration,
          imageUrl: scene.imageUrl,
          accentColor: accentColor || "#F97316",
          bgColor: bgColor || "#FAFAFA",
          textColor: textColor || "#171717",
          aspectRatio: aspectRatio || "landscape",
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

      {logo && (
        <LogoOverlay
          src={logo}
          position={logoPosition || "bottom_right"}
          maxOpacity={logoOpacity ?? 0.9}
          aspectRatio={aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};
