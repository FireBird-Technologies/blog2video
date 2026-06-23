import React from "react";
import "../../../fonts/economist-defaults";
import { ECONOMIST_SERIF_FONT } from "../../../fonts/economist-defaults";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { ECONOMIST_LAYOUT_REGISTRY } from "./layouts";
import type { EconomistLayoutType, EconomistLayoutProps } from "./types";
import { LogoOverlay } from "../LogoOverlay";
import { BackgroundMusic } from "../BackgroundMusic";
import { CaptionTrack } from "../CaptionTrack";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
import { EconomistChrome } from "./components/EconomistChrome";
import { pickEconomistTransition } from "./transitions";
import { ECONOMIST_COLORS, LAYOUT_MIN_FRAMES } from "./constants";

export interface EconomistSceneInput {
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

export interface EconomistVideoCompositionProps {
  scenes: EconomistSceneInput[];
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
}

// cover_reveal owns its own dramatic opening; it skips the chrome fade.
const LAYOUTS_WITHOUT_CHROME_FADE = new Set<EconomistLayoutType>(["cover_reveal"]);

// Full-bleed scenes own the whole canvas — no page frame / footer furniture.
// Full-bleed scenes that own the whole canvas and draw their own masthead — they
// suppress the shared top/bottom chrome furniture. section_divider now joins the
// furniture-bearing scenes; ending_socials draws its own *centred* red masthead
// (which doesn't clash with the top-left chrome wordmark) so it now shows the
// shared chrome frame too.
const MINIMAL_CHROME_LAYOUTS = new Set<EconomistLayoutType>([
  "cover_reveal",
  "image_feature",
]);

const enforceLayoutMinimum = (frames: number, layout: EconomistLayoutType) =>
  Math.max(frames, LAYOUT_MIN_FRAMES[layout] ?? 150);

const LAST_SCENE_TAIL_TRIM_FRAMES = 60;
const trimLastScene = (frames: number) =>
  Math.max(Math.floor(frames * 0.65), frames - LAST_SCENE_TAIL_TRIM_FRAMES);
const EXTRA_HOLD_FRAMES = 10;

const resolveLayoutKey = (raw: string): EconomistLayoutType =>
  (raw as EconomistLayoutType) in ECONOMIST_LAYOUT_REGISTRY
    ? (raw as EconomistLayoutType)
    : ("leader_article" as EconomistLayoutType);

/**
 * Compute the exact total video duration (in frames) the TransitionSeries will
 * produce. Must stay in sync with the resolvedScenes calculation below. Used by
 * VideoPreview to set the Player's durationInFrames (no dead tail).
 */
export const computeEconomistVideoTotalFrames = (
  scenes: EconomistSceneInput[],
  playbackSpeed?: number,
): number => {
  const FPS = 30;
  const resolvedPlaybackSpeed = getPlaybackSpeed(playbackSpeed);

  if (scenes.length === 0) return FPS * 5;

  const resolved = scenes.map((scene, idx, arr) => {
    const layoutKey = resolveLayoutKey(scene.layout);
    const raw = getSceneDurationFrames(scene.durationSeconds, FPS, resolvedPlaybackSpeed);
    const withMin = enforceLayoutMinimum(raw, layoutKey);
    const isLastInMulti = idx === arr.length - 1 && arr.length > 1;
    const trimTail = isLastInMulti && !scene.voiceoverUrl?.trim();
    const durationFrames = trimTail ? trimLastScene(withMin) : withMin;
    const sequenceFrames = isLastInMulti ? durationFrames : durationFrames + EXTRA_HOLD_FRAMES;
    return { layoutKey, durationFrames, sequenceFrames };
  });

  let total = resolved.reduce((sum, s) => sum + s.sequenceFrames, 0);
  for (let i = 0; i < resolved.length - 1; i++) {
    total -= pickEconomistTransition(i, resolved[i].layoutKey, resolved[i + 1].layoutKey).frames;
  }
  return Math.max(total, FPS * 5);
};

export const EconomistVideoComposition: React.FC<EconomistVideoCompositionProps> = ({
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
}) => {
  const FPS = 30;
  const resolvedPlaybackSpeed = getPlaybackSpeed(playbackSpeed);
  const fallbackFontFamily = fontFamily || ECONOMIST_SERIF_FONT;

  const isPortrait = aspectRatio === "portrait";
  const canvasW = isPortrait ? 1080 : 1920;
  const canvasH = isPortrait ? 1920 : 1080;

  const resolvedScenes = scenes.map((scene, idx, arr) => {
    const layoutKey = resolveLayoutKey(scene.layout);
    const raw = getSceneDurationFrames(scene.durationSeconds, FPS, resolvedPlaybackSpeed);
    const withMin = enforceLayoutMinimum(raw, layoutKey);
    const isLastInMulti = idx === arr.length - 1 && arr.length > 1;
    const trimTail = isLastInMulti && !scene.voiceoverUrl?.trim();
    const durationFrames = trimTail ? trimLastScene(withMin) : withMin;
    const sequenceFrames = isLastInMulti ? durationFrames : durationFrames + EXTRA_HOLD_FRAMES;
    return { scene, layoutKey, durationFrames, sequenceFrames };
  });

  // Scene start frames so we can position voiceover audio absolutely.
  let runningFrame = 0;
  const sceneStartFrames: number[] = [];
  resolvedScenes.forEach((s, i) => {
    sceneStartFrames[i] = runningFrame;
    runningFrame += s.sequenceFrames;
    if (i < resolvedScenes.length - 1) {
      const nextLayout = resolvedScenes[i + 1].layoutKey;
      runningFrame -= pickEconomistTransition(i, s.layoutKey, nextLayout).frames;
    }
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor || ECONOMIST_COLORS.paper,
        fontFamily: fallbackFontFamily,
      }}
    >
      <TransitionSeries>
        {resolvedScenes.map((s, index) => {
          const { scene, layoutKey, sequenceFrames } = s;
          const LayoutComponent = ECONOMIST_LAYOUT_REGISTRY[layoutKey];

          const rawProps = (scene.layoutProps ?? {}) as Record<string, unknown>;
          const focusX = Math.max(0, Math.min(100, Number(rawProps.imageFocusX ?? 50)));
          const focusY = Math.max(0, Math.min(100, Number(rawProps.imageFocusY ?? 50)));

          const layoutProps: EconomistLayoutProps = {
            ...(rawProps as Partial<EconomistLayoutProps>),
            title: scene.title,
            narration: scene.narration,
            imageUrl: scene.imageUrl,
            imageObjectPosition: `${focusX}% ${focusY}%`,
            imageZoom: Math.max(0.1, Number(rawProps.imageZoom ?? 1)),
            accentColor: accentColor || ECONOMIST_COLORS.accent,
            bgColor: bgColor || ECONOMIST_COLORS.paper,
            textColor: textColor || ECONOMIST_COLORS.ink,
            aspectRatio: (aspectRatio as "landscape" | "portrait") || "landscape",
            fontFamily,
          };

          const skipFade = LAYOUTS_WITHOUT_CHROME_FADE.has(layoutKey);
          const minimal = MINIMAL_CHROME_LAYOUTS.has(layoutKey);

          const sequence = (
            <TransitionSeries.Sequence
              key={`seq-${scene.id}-${index}`}
              durationInFrames={sequenceFrames}
            >
              <EconomistChrome
                bgColor={bgColor || ECONOMIST_COLORS.paper}
                accentColor={accentColor || ECONOMIST_COLORS.accent}
                textColor={textColor || ECONOMIST_COLORS.ink}
                sectionLabel={layoutProps.sectionLabel}
                dateline={layoutProps.dateline}
                wordmark={layoutProps.wordmark}
                minimal={minimal}
                disableFade={skipFade}
                sceneIndex={index}
                sceneCount={resolvedScenes.length}
              >
                <LayoutComponent {...layoutProps} />
              </EconomistChrome>
            </TransitionSeries.Sequence>
          );

          if (index === resolvedScenes.length - 1) {
            return sequence;
          }

          const nextLayout = resolvedScenes[index + 1].layoutKey;
          const choice = pickEconomistTransition(index, layoutKey, nextLayout, canvasW, canvasH);

          return (
            <React.Fragment key={`scene-${scene.id}-${index}`}>
              {sequence}
              <TransitionSeries.Transition
                presentation={choice.presentation}
                timing={linearTiming({ durationInFrames: choice.frames })}
              />
            </React.Fragment>
          );
        })}
      </TransitionSeries>

      {resolvedScenes.map((s, index) => {
        if (!s.scene.voiceoverUrl) return null;
        return (
          <Sequence
            key={`audio-${s.scene.id}-${index}`}
            from={sceneStartFrames[index]}
            durationInFrames={s.durationFrames}
          >
            <Audio src={s.scene.voiceoverUrl} playbackRate={resolvedPlaybackSpeed} />
            {captionsEnabled && (s.scene.narrationText || s.scene.narration) && (
              <CaptionTrack
                text={s.scene.narrationText || s.scene.narration}
                position={captionPosition || "bottom_center"}
                aspectRatio={aspectRatio || "landscape"}
                fontFamily={fontFamily || undefined}
                speechDurationFrames={
                  s.scene.speechDurationSeconds
                    ? getSceneDurationFrames(s.scene.speechDurationSeconds, FPS, resolvedPlaybackSpeed)
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
