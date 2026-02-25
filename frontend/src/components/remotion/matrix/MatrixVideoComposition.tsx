import { AbsoluteFill, Audio, Sequence } from "remotion";
import { MATRIX_LAYOUT_REGISTRY } from "./layouts";
import type { MatrixLayoutType, MatrixLayoutProps } from "./types";
import { LogoOverlay } from "../LogoOverlay";

export interface MatrixSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: MatrixLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface MatrixVideoCompositionProps {
  scenes: MatrixSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: string;
  aspectRatio?: string;
}

export const MatrixVideoComposition: React.FC<
  MatrixVideoCompositionProps
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
}) => {
  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#000000" }}>
      {scenes.map((scene) => {
        const durationFrames = Math.round(scene.durationSeconds * FPS);
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          MATRIX_LAYOUT_REGISTRY[scene.layout] ||
          MATRIX_LAYOUT_REGISTRY.terminal_text;

        const layoutProps: MatrixLayoutProps = {
          ...scene.layoutProps,
          title: scene.title,
          narration: scene.narration,
          accentColor: accentColor || "#00FF41",
          bgColor: bgColor || "#000000",
          textColor: textColor || "#00FF41",
          aspectRatio: aspectRatio || "landscape",
          imageUrl: scene.imageUrl,
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
          size={logoSize || "default"}
          aspectRatio={aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};
