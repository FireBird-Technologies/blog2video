<<<<<<< HEAD
=======
import { resolveFontFamily } from "../../../fonts/registry";
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { BLACKSWAN_LAYOUT_REGISTRY } from "./layouts";
import type { BlackswanLayoutProps, BlackswanLayoutType } from "./types";
import { LogoOverlay } from "../LogoOverlay";
<<<<<<< HEAD
=======
import { BackgroundMusic } from "../BackgroundMusic";
import { CaptionTrack } from "../CaptionTrack";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb

export interface BlackswanSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
<<<<<<< HEAD
  layout: BlackswanLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
=======
  /** Spoken narration text — used for captions (may differ from on-screen narration). */
  narrationText?: string;
  layout: BlackswanLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  /** Spoken-audio length in seconds — for caption timing. */
  speechDurationSeconds?: number;
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface BlackswanVideoCompositionProps {
  scenes: BlackswanSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
<<<<<<< HEAD
  aspectRatio?: string;
  fontFamily?: string;
=======
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
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
}

export const BlackswanVideoComposition: React.FC<
  BlackswanVideoCompositionProps
> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  logoOpacity,
  logoSize,
<<<<<<< HEAD
  aspectRatio,
  fontFamily,
}) => {
  const FPS = 30;
=======
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
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#000000", fontFamily }}>
      {scenes.map((scene) => {
<<<<<<< HEAD
        const durationFrames = Math.round(scene.durationSeconds * FPS);
=======
        const durationFrames = getSceneDurationFrames(
          scene.durationSeconds,
          FPS,
          resolvedPlaybackSpeed,
        );
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          BLACKSWAN_LAYOUT_REGISTRY[scene.layout] ??
          BLACKSWAN_LAYOUT_REGISTRY.neon_narrative;

        const layoutProps: BlackswanLayoutProps = {
          ...(scene.layoutProps as Record<string, unknown>),
          title: scene.title,
          narration: scene.narration,
          accentColor: accentColor || "#00E5FF",
          bgColor: bgColor || "#000000",
          textColor: textColor || "#DFFFFF",
          aspectRatio: aspectRatio || "landscape",
          imageUrl: scene.imageUrl,
<<<<<<< HEAD
=======
          imageObjectPosition: String(Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusX ?? 50)))) + "% " + String(Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusY ?? 50)))) + "%",
          imageZoom: Math.max(0.1, Number((scene.layoutProps as Record<string, unknown>)?.imageZoom ?? 1)),
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
          layoutType: scene.layout,
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
<<<<<<< HEAD
            {scene.voiceoverUrl && <Audio src={scene.voiceoverUrl} />}
=======
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
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
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
<<<<<<< HEAD
    </AbsoluteFill>
  );
};
=======
    
      {bgmUrl && (
        <BackgroundMusic src={bgmUrl} volume={bgmVolume ?? 0.10} scenes={scenes} />
      )}
    </AbsoluteFill>
  );
};

>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
