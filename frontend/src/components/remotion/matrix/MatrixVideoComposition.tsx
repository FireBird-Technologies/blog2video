import { resolveFontFamily } from "../../../fonts/registry";
import React from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import { MATRIX_LAYOUT_REGISTRY } from "./layouts";
import { pickMatrixTransition } from "./transitions";
import type { MatrixLayoutType, MatrixLayoutProps } from "./types";
import { LogoOverlay } from "../LogoOverlay";
import { BackgroundMusic } from "../BackgroundMusic";
import { CaptionTrack } from "../CaptionTrack";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";

export interface MatrixSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  /** Spoken narration text — used for captions (may differ from on-screen narration). */
  narrationText?: string;
  layout: MatrixLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  /** Spoken-audio length in seconds — for caption timing. */
  speechDurationSeconds?: number;
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
  const isPortrait = aspectRatio === "portrait";
  const w = isPortrait ? 1080 : 1920;
  const h = isPortrait ? 1920 : 1080;

  const sceneFrames = scenes.map((s) =>
    getSceneDurationFrames(s.durationSeconds, FPS, resolvedPlaybackSpeed),
  );

  // Scene start frames accounting for transition overlap (audio sync).
  const sceneStartFrames: number[] = [];
  let runningFrame = 0;
  scenes.forEach((_, i) => {
    sceneStartFrames[i] = runningFrame;
    runningFrame += sceneFrames[i];
    if (i < scenes.length - 1) {
      runningFrame -= pickMatrixTransition(
        i,
        scenes[i].layout,
        scenes[i + 1].layout,
        w,
        h,
      ).frames;
    }
  });

  const buildLayoutProps = (scene: MatrixSceneInput): MatrixLayoutProps => ({
    ...scene.layoutProps,
    title: scene.title,
    narration: scene.narration,
    accentColor: accentColor || "#00FF41",
    bgColor: bgColor || "#000000",
    textColor: textColor || "#00FF41",
    aspectRatio: aspectRatio || "landscape",
    imageUrl: scene.imageUrl,
    imageObjectPosition:
      String(Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusX ?? 50)))) +
      "% " +
      String(Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusY ?? 50)))) +
      "%",
    imageZoom: Math.max(0.1, Number((scene.layoutProps as Record<string, unknown>)?.imageZoom ?? 1)),
    fontFamily,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#000000", fontFamily }}>
      <TransitionSeries>
        {scenes.map((scene, index) => {
          const LayoutComponent =
            MATRIX_LAYOUT_REGISTRY[scene.layout] ||
            MATRIX_LAYOUT_REGISTRY.terminal_text;

          const sequence = (
            <TransitionSeries.Sequence
              key={`seq-${scene.id}-${index}`}
              durationInFrames={sceneFrames[index]}
            >
              <LayoutComponent {...buildLayoutProps(scene)} />
            </TransitionSeries.Sequence>
          );

          if (index === scenes.length - 1) return sequence;

          const choice = pickMatrixTransition(
            index,
            scene.layout,
            scenes[index + 1].layout,
            w,
            h,
          );
          return (
            <React.Fragment key={`scene-${scene.id}-${index}`}>
              {sequence}
              <TransitionSeries.Transition
                presentation={choice.presentation}
                timing={choice.timing}
              />
            </React.Fragment>
          );
        })}
      </TransitionSeries>

      {scenes.map((scene, index) =>
        scene.voiceoverUrl ? (
          <Sequence
            key={`audio-${scene.id}-${index}`}
            from={sceneStartFrames[index]}
            durationInFrames={sceneFrames[index]}
          >
            <Audio src={scene.voiceoverUrl} playbackRate={resolvedPlaybackSpeed} />
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
        ) : null,
      )}

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
