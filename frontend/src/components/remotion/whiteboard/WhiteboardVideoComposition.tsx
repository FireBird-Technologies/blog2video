import { resolveFontFamily } from "../../../fonts/registry";
import { AvatarOverlay } from "../AvatarOverlay";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { WHITEBOARD_LAYOUT_REGISTRY } from "./layouts";
import type { WhiteboardLayoutType, WhiteboardLayoutProps } from "./types";
import { LogoOverlay } from "../LogoOverlay";
import { BackgroundMusic } from "../BackgroundMusic";
import { CaptionTrack } from "../CaptionTrack";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
import { SceneDurationInFramesContext } from "../SceneDurationContext";

export interface WhiteboardSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  /** Spoken narration text — used for captions (may differ from on-screen narration). */
  narrationText?: string;
  layout: WhiteboardLayoutType;
  layoutProps: Record<string, unknown>;
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
  avatarUrl?: string;
  /** Per-scene avatar overrides; undefined = inherit the project setting. */
  avatarShape?: "circle" | "rounded" | "square";
  avatarSize?: number;
  avatarPosition?: "top_left" | "top_right" | "bottom_left" | "bottom_right";
  avatarBg?: string | null;
  avatarOpacity?: number;
  avatarFocusX?: number;
  avatarFocusY?: number;
  avatarZoom?: number;
}

export interface WhiteboardVideoCompositionProps {
  scenes: WhiteboardSceneInput[];
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

export const WhiteboardVideoComposition: React.FC<
  WhiteboardVideoCompositionProps
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
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#F7F3E8", fontFamily }}>
      {scenes.map((scene) => {
        const durationFrames = getSceneDurationFrames(
          scene.durationSeconds,
          FPS,
          resolvedPlaybackSpeed,
        );
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          WHITEBOARD_LAYOUT_REGISTRY[scene.layout] ||
          WHITEBOARD_LAYOUT_REGISTRY.marker_story;

        const layoutProps: WhiteboardLayoutProps = {
          ...scene.layoutProps,
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
          imageObjectPosition: String(Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusX ?? 50)))) + "% " + String(Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusY ?? 50)))) + "%",
          imageZoom: Math.max(0.1, Number((scene.layoutProps as Record<string, unknown>)?.imageZoom ?? 1)),
          accentColor: accentColor || "#1F2937",
          bgColor: bgColor || "#F7F3E8",
          textColor: textColor || "#111827",
          aspectRatio: aspectRatio || "landscape",
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
            {scene.voiceoverUrl && (
              <Audio src={scene.voiceoverUrl} playbackRate={resolvedPlaybackSpeed} />
            )}
            {scene.avatarUrl && (
              <AvatarOverlay src={scene.avatarUrl} aspectRatio={aspectRatio || "landscape"} shape={scene.avatarShape} size={scene.avatarSize} position={scene.avatarPosition} bg={scene.avatarBg} opacity={scene.avatarOpacity} focusX={scene.avatarFocusX} focusY={scene.avatarFocusY} zoom={scene.avatarZoom} />
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

