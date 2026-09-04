import { resolveFontFamily } from "../../../fonts/registry";
import { AvatarOverlay } from "../AvatarOverlay";
import React from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import { SPOTLIGHT_LAYOUT_REGISTRY } from "./layouts";
import { pickSpotlightTransition } from "./transitions";
import type { SpotlightLayoutType, SpotlightLayoutProps } from "./types";
import { LogoOverlay } from "../LogoOverlay";
import { BackgroundMusic } from "../BackgroundMusic";
import { CaptionTrack } from "../CaptionTrack";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
import type { CompositionSchedule, SceneScheduleEntry } from "../sceneSchedule";

export interface SpotlightSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  /** Spoken narration text — used for captions (may differ from on-screen narration). */
  narrationText?: string;
  layout: SpotlightLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  /** Spoken-audio length in seconds — for caption timing. */
  speechDurationSeconds?: number;
  imageUrl?: string;
  videoUrl?: string;
  videoMuted?: boolean;
  videoVolume?: number;
  /** Normalised clip length, in seconds; converted to frames for <Loop>. */
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

export interface SpotlightVideoCompositionProps {
  scenes: SpotlightSceneInput[];
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

/**
 * The composition's real timeline: transitions in a TransitionSeries OVERLAP their
 * neighbours, so each scene starts earlier than a back-to-back sum implies.
 *
 * Single source of truth — the component renders from this, and slide export reads
 * it too, so a slide can never be sampled from the wrong scene.
 */
export const computeSpotlightSchedule = (
  scenes: SpotlightSceneInput[],
  playbackSpeed?: number,
  aspectRatio?: string,
): CompositionSchedule => {
  const FPS = 30;
  if (scenes.length === 0) return { scenes: [], totalFrames: FPS * 5 };

  const resolvedPlaybackSpeed = getPlaybackSpeed(playbackSpeed);
  const isPortrait = aspectRatio === "portrait";
  const w = isPortrait ? 1080 : 1920;
  const h = isPortrait ? 1920 : 1080;

  const durations = scenes.map((s) =>
    getSceneDurationFrames(s.durationSeconds, FPS, resolvedPlaybackSpeed),
  );
  const transitionAt = (i: number) =>
    i >= 0 && i < scenes.length - 1
      ? pickSpotlightTransition(i, scenes[i].layout, scenes[i + 1].layout, w, h).frames
      : 0;

  const entries: SceneScheduleEntry[] = [];
  let running = 0;
  durations.forEach((duration, i) => {
    entries.push({
      start: running,
      duration,
      enterFrames: transitionAt(i - 1),
      exitFrames: transitionAt(i),
    });
    running += duration - transitionAt(i);
  });

  return { scenes: entries, totalFrames: Math.max(running, FPS * 5) };
};

export const SpotlightVideoComposition: React.FC<
  SpotlightVideoCompositionProps
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

  // Scene start frames (audio sync) come from the shared schedule, so the render
  // and slide export cannot disagree about where a scene begins.
  const sceneStartFrames = computeSpotlightSchedule(
    scenes,
    playbackSpeed,
    aspectRatio,
  ).scenes.map((s) => s.start);

  const buildLayoutProps = (scene: SpotlightSceneInput): SpotlightLayoutProps => ({
    ...scene.layoutProps,
    title: scene.title,
    narration: scene.narration,
    accentColor: accentColor || "#EF4444",
    bgColor: bgColor || "#000000",
    textColor: textColor || "#FFFFFF",
    aspectRatio: aspectRatio || "landscape",
    imageUrl: scene.imageUrl,
    imageObjectPosition:
      String(Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusX ?? 50)))) +
      "% " +
      String(Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusY ?? 50)))) +
      "%",
    imageZoom: Math.max(0.1, Number((scene.layoutProps as Record<string, unknown>)?.imageZoom ?? 1)),
    videoUrl: scene.videoUrl,
    videoMuted: scene.videoMuted ?? true,
    videoVolume: scene.videoVolume ?? 0.35,
    videoDurationInFrames: scene.videoDurationSeconds
      ? Math.max(1, Math.round(scene.videoDurationSeconds * FPS))
      : undefined,
    videoStartInFrames: scene.videoStartSeconds
      ? Math.max(0, Math.round(scene.videoStartSeconds * FPS))
      : undefined,
    fontFamily,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#000000", fontFamily }}>
      <TransitionSeries>
        {scenes.map((scene, index) => {
          const LayoutComponent =
            SPOTLIGHT_LAYOUT_REGISTRY[scene.layout] ||
            SPOTLIGHT_LAYOUT_REGISTRY.statement;

          const sequence = (
            <TransitionSeries.Sequence
              key={`seq-${scene.id}-${index}`}
              durationInFrames={sceneFrames[index]}
            >
              <LayoutComponent {...buildLayoutProps(scene)} />
            </TransitionSeries.Sequence>
          );

          if (index === scenes.length - 1) return sequence;

          const choice = pickSpotlightTransition(
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
            {scene.avatarUrl ? <AvatarOverlay src={scene.avatarUrl} aspectRatio={aspectRatio || "landscape"} shape={scene.avatarShape} size={scene.avatarSize} position={scene.avatarPosition} bg={scene.avatarBg} opacity={scene.avatarOpacity} focusX={scene.avatarFocusX} focusY={scene.avatarFocusY} zoom={scene.avatarZoom} /> : null}
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
