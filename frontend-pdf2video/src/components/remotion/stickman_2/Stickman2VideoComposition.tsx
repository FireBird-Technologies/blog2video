import { resolveFontFamily } from "../../../fonts/registry";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { STICKMAN_2_LAYOUT_REGISTRY as LAYOUT_REGISTRY, Stickman2LayoutType, SceneLayoutProps } from "./layouts";
import { LogoOverlay } from "../LogoOverlay";
import { BackgroundMusic } from "../BackgroundMusic";
import { CaptionTrack } from "../CaptionTrack";
import { getSceneDurationFrames } from "../playbackSpeed";
import { SceneDurationInFramesContext } from "../SceneDurationContext";

export interface Stickman2SceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  /** Spoken narration text — used for captions (may differ from on-screen narration). */
  narrationText?: string;
  layout: Stickman2LayoutType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layoutProps: Record<string, any>;
  durationSeconds: number;
  /** Spoken-audio length in seconds — for caption timing. */
  speechDurationSeconds?: number;
  imageUrl?: string;
  /** Stock-footage clip URL. Mutually exclusive with `imageUrl`. */
  videoUrl?: string;
  videoMuted?: boolean;
  videoVolume?: number;
  /** Normalised clip length; converted to frames for <Loop>. */
  videoDurationSeconds?: number;
  /** Start offset into the clip, in seconds (the adjust-modal trim). */
  videoStartSeconds?: number;
  voiceoverUrl?: string;
}

export interface Stickman2VideoCompositionProps {
  scenes: Stickman2SceneInput[];
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
  captionsEnabled?: boolean;
  captionPosition?: string;
  captionFontFamily?: string;
  captionFontSize?: number;
  captionOffset?: number;
}

export const Stickman2VideoComposition: React.FC<Stickman2VideoCompositionProps> = ({
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
  captionsEnabled,
  captionPosition,
  captionFontFamily,
  captionFontSize,
  captionOffset,
}) => {
  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#000000", fontFamily }}>
      {scenes.map((scene) => {
        const durationFrames = Math.max(
          1,
          Math.round((Number(scene.durationSeconds) || 5) * FPS),
        );
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          LAYOUT_REGISTRY[scene.layout] ?? LAYOUT_REGISTRY.night_walk;

        const focusX = Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusX ?? 50)));
        const focusY = Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusY ?? 50)));

        const layoutProps: SceneLayoutProps = {
          ...(scene.layoutProps as Record<string, unknown>),
          title: scene.title,
          narration: scene.narration,
          imageUrl: scene.imageUrl,
          videoUrl: scene.videoUrl,
          videoMuted: scene.videoMuted ?? true,
          videoVolume: scene.videoVolume ?? 0.35,
          videoDurationInFrames: scene.videoDurationSeconds
            ? Math.max(1, Math.round(scene.videoDurationSeconds * FPS))
            : undefined,
          videoStartInFrames: scene.videoStartSeconds
            ? Math.max(0, Math.round(scene.videoStartSeconds * FPS))
            : undefined,
          imageObjectPosition: `${focusX}% ${focusY}%`,
          imageZoom: Math.max(0.1, Number((scene.layoutProps as Record<string, unknown>)?.imageZoom ?? 1)),
          accentColor: accentColor || "#FFFFFF",
          bgColor: bgColor || "#000000",
          textColor: textColor || "#FFFFFF",
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
            <SceneDurationInFramesContext.Provider value={durationFrames}>
              <LayoutComponent {...layoutProps} />
            </SceneDurationInFramesContext.Provider>
            {scene.voiceoverUrl && <Audio src={scene.voiceoverUrl} />}
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
                    ? getSceneDurationFrames(scene.speechDurationSeconds, FPS, 1)
                    : undefined
                }
              />
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

      {bgmUrl && (
        <BackgroundMusic src={bgmUrl} volume={bgmVolume ?? 0.10} scenes={scenes} />
      )}
    </AbsoluteFill>
  );
};
