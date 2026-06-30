import { resolveFontFamily } from "../../../fonts/registry";
import "../../../fonts/newspaper-defaults";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { NEWSPAPER_LAYOUT_REGISTRY } from "./layouts";
import type { NewspaperLayoutType, BlogLayoutProps } from "./types";
import { LogoOverlay } from "../LogoOverlay";
import { BackgroundMusic } from "../BackgroundMusic";
import { CaptionTrack } from "../CaptionTrack";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";

export interface NewspaperSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  /** Spoken narration text — used for captions (may differ from on-screen narration). */
  narrationText?: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  /** Spoken-audio length in seconds — for caption timing. */
  speechDurationSeconds?: number;
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
  captionsEnabled?: boolean;
  captionPosition?: string;
  captionFontFamily?: string;
  captionFontSize?: number;
  captionOffset?: number;
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
  captionsEnabled,
  captionPosition,
  captionFontFamily,
  captionFontSize,
  captionOffset,
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
          imageObjectPosition: String(Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusX ?? 50)))) + "% " + String(Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusY ?? 50)))) + "%",
          imageZoom: Math.max(0.1, Number((scene.layoutProps as Record<string, unknown>)?.imageZoom ?? 1)),
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
               {captionsEnabled && (scene.narrationText || scene.narration) && (
                 <CaptionTrack
                   text={scene.narrationText || scene.narration}
                   position={captionPosition || "bottom_center"}
                   aspectRatio={aspectRatio || "landscape"}
                   fontFamily={captionFontFamily ? (resolveFontFamily(captionFontFamily) || captionFontFamily) : (fontFamily || undefined)}
                fontSize={captionFontSize || undefined}
                   offset={captionOffset ?? 0}
                   speechDurationFrames={
                     scene.speechDurationSeconds
                       ? getSceneDurationFrames(scene.speechDurationSeconds, FPS, resolvedPlaybackSpeed)
                       : undefined
                   }
                 />
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
        <BackgroundMusic src={bgmUrl} volume={bgmVolume ?? 0.10} scenes={scenes} />
      )}
    </AbsoluteFill>
  );
};
