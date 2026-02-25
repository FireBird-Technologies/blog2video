import { AbsoluteFill, Audio, Sequence } from "remotion";
import { NEWSPAPER_LAYOUT_REGISTRY } from "./layouts";
import type { NewspaperLayoutType, BlogLayoutProps } from "./types";
import { LogoOverlay } from "../LogoOverlay";

export interface NewspaperSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface NewspaperVideoCompositionProps {
  scenes: NewspaperSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  aspectRatio?: string;
}

export const NewspaperVideoComposition: React.FC<
  NewspaperVideoCompositionProps
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
    <AbsoluteFill style={{ backgroundColor: bgColor || "#FAFAF8" }}>
      {scenes.map((scene) => {
        const durationFrames = Math.max(
          1,
          Math.round(scene.durationSeconds * FPS)
        );
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          NEWSPAPER_LAYOUT_REGISTRY[scene.layout as NewspaperLayoutType] ||
          NEWSPAPER_LAYOUT_REGISTRY.article_lead;

        const layoutProps: BlogLayoutProps = {
          ...(scene.layoutProps as Partial<BlogLayoutProps>),
          title: scene.title,
          narration: scene.narration,
          imageUrl: scene.imageUrl,
          accentColor: accentColor || "#FFE34D",
          bgColor: bgColor || "#FAFAF8",
          textColor: textColor || "#111111",
          aspectRatio: (aspectRatio as "landscape" | "portrait") || "landscape",
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
