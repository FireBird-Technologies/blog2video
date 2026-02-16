import { AbsoluteFill, Audio, Sequence } from "remotion";
import { NIGHTFALL_LAYOUT_REGISTRY } from "./layouts";
import type { NightfallLayoutType, NightfallLayoutProps } from "./types";
import { LogoOverlay } from "../LogoOverlay";

export interface NightfallSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: NightfallLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface NightfallVideoCompositionProps {
  scenes: NightfallSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  aspectRatio?: string;
}

export const NightfallVideoComposition: React.FC<
  NightfallVideoCompositionProps
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
    <AbsoluteFill style={{ backgroundColor: bgColor || "#0A0A1A" }}>
      {scenes.map((scene) => {
        const durationFrames = Math.round(scene.durationSeconds * FPS);
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          NIGHTFALL_LAYOUT_REGISTRY[scene.layout] ||
          NIGHTFALL_LAYOUT_REGISTRY.glass_narrative;

        const layoutProps: NightfallLayoutProps = {
          title: scene.title,
          narration: scene.narration,
          imageUrl: scene.imageUrl,
          accentColor: accentColor || "#818CF8",
          bgColor: bgColor || "#0A0A1A",
          textColor: textColor || "#E2E8F0",
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
