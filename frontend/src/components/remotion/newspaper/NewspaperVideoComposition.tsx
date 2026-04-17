import "../../../fonts/newspaper-defaults";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { NEWSPAPER_LAYOUT_REGISTRY } from "./layouts";
import type { NewspaperLayoutType, BlogLayoutProps } from "./types";
import { LogoOverlay } from "../LogoOverlay";
import { BackgroundMusic } from "../BackgroundMusic";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";

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
  logoSize?: number;
  bgmUrl?: string | null;
  bgmVolume?: number;
  aspectRatio?: string;
  fontFamily?: string;
  playbackSpeed?: number;
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
  logoSize,
  bgmUrl,
  bgmVolume,
  aspectRatio,
  fontFamily,
  playbackSpeed,
}) => {
  const FPS = 30;
  const resolvedPlaybackSpeed = getPlaybackSpeed(playbackSpeed);

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#FAFAF8", fontFamily }}>
      {scenes.map((scene, index) => {
        // --- STABLE FRAME CALCULATION ---
        // Calculate the start frame by summing durations of all previous scenes
        const startFrame = scenes
          .slice(0, index)
          .reduce(
            (acc, s) =>
              acc + getSceneDurationFrames(s.durationSeconds, FPS, resolvedPlaybackSpeed),
            0,
          );

        const durationFrames = getSceneDurationFrames(
          scene.durationSeconds,
          FPS,
          resolvedPlaybackSpeed,
        );

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
          fontFamily,
        };

        return (
          <Sequence
            // Use a stable key + index to prevent remounting
            key={`${scene.id}-${index}`} 
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            {/* IMPORTANT: Wrap in a div to ensure the LayoutComponent 
               receives a fresh coordinate system from the Sequence 
            */}
            <AbsoluteFill>
               <LayoutComponent {...layoutProps} />
               {scene.voiceoverUrl && (
                 <Audio src={scene.voiceoverUrl} playbackRate={resolvedPlaybackSpeed} />
               )}
            </AbsoluteFill>
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
    
      {bgmUrl && (
        <BackgroundMusic src={bgmUrl} volume={bgmVolume ?? 0.10} />
      )}
    </AbsoluteFill>
  );
};