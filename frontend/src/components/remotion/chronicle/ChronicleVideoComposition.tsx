import React from "react";
import "../../../fonts/chronicle-defaults";
import { CHRONICLE_BODY_FONT } from "../../../fonts/chronicle-defaults";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { CHRONICLE_LAYOUT_REGISTRY } from "./layouts";
import type { ChronicleLayoutType, ChronicleLayoutProps } from "./types";
import { LogoOverlay } from "../LogoOverlay";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
import { ChronicleChrome } from "./components/ChronicleChrome";
import { pickChronicleTransition } from "./transitions";

export interface ChronicleSceneInput {
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

export interface ChronicleVideoCompositionProps {
  scenes: ChronicleSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
  playbackSpeed?: number;
}

// book_open owns its own dramatic opening animation; every other layout
// just gets a subtle chrome fade-in.
const LAYOUTS_WITHOUT_CHROME_FADE = new Set<ChronicleLayoutType>(["book_open"]);

// These layouts get the illuminated-manuscript scripture overlay in addition
// to the always-on parchment.
const SCRIPTURE_LAYOUTS = new Set<ChronicleLayoutType>([
  "book_open",
  "illuminated_quote",
  "parchment_scroll",
  "decree_seal",
]);

// Per-layout minimum scene durations (in frames @ 30fps). Each chronicle
// layout has hardcoded animation timings; if the scene's `durationSeconds`
// is shorter than the layout's natural arc, content gets cut off mid-reveal
// and the next scene starts before the eye can read anything (= "rushed").
// These floors guarantee enough room to play intro + hold + outroFade.
// book_open: settle (0-30) + seal crack (32-54) + cover open (60-100) +
// title push-in (100-134) + LOTR title burn (112-172) + ink divider (142) +
// subtitle typing (155-245) + wax seal fade (180-200) + ~30f hold + 18f
// outroFade ≈ 293f → round to 300 (10s) for headroom. Shorter durations
// cut off the subtitle mid-typing.
const LAYOUT_MIN_FRAMES: Record<ChronicleLayoutType, number> = {
  book_open: 300,
  ending_socials: 200,
  chronicle_timeline: 200,
  ledger_stats: 200,
  versus_folio: 200,
  chapter_plate: 170,
  illuminated_quote: 170,
  parchment_scroll: 170,
  decree_seal: 170,
  map_reveal: 170,
};

const enforceLayoutMinimum = (frames: number, layout: ChronicleLayoutType) =>
  Math.max(frames, LAYOUT_MIN_FRAMES[layout] ?? 150);

// Trim a small tail off the LAST scene's contributed duration in multi-scene
// videos so the final layout's outroFade lines up with the video end. Skipped
// for single-scene compositions (Template Studio previews) so layouts get
// their full window. Also skipped when the last scene has voiceover — trimming
// uses the same duration as the <Audio> Sequence and would clip narration.
const LAST_SCENE_TAIL_TRIM_FRAMES = 60;
const trimLastScene = (frames: number) =>
  Math.max(Math.floor(frames * 0.65), frames - LAST_SCENE_TAIL_TRIM_FRAMES);

/**
 * Compute the exact total video duration (in frames) that TransitionSeries
 * will produce for a Chronicle composition. Must stay in sync with the
 * resolvedScenes calculation inside ChronicleVideoComposition.
 *
 * Used by VideoPreview to set the Player's durationInFrames so it matches
 * the actual rendered length (no brown tail).
 */
export const computeChronicleVideoTotalFrames = (
  scenes: ChronicleSceneInput[],
  playbackSpeed?: number,
): number => {
  const FPS = 30;
  const resolvedPlaybackSpeed = getPlaybackSpeed(playbackSpeed);

  if (scenes.length === 0) return FPS * 5;

  const resolved = scenes.map((scene, idx, arr) => {
    const layoutKey = (scene.layout as ChronicleLayoutType) in CHRONICLE_LAYOUT_REGISTRY
      ? (scene.layout as ChronicleLayoutType)
      : ("parchment_scroll" as ChronicleLayoutType);
    const raw = getSceneDurationFrames(scene.durationSeconds, FPS, resolvedPlaybackSpeed);
    const withMin = enforceLayoutMinimum(raw, layoutKey);
    const isLastInMulti = idx === arr.length - 1 && arr.length > 1;
    const trimTail =
      isLastInMulti && !scene.voiceoverUrl?.trim();
    return {
      layoutKey,
      durationFrames: trimTail ? trimLastScene(withMin) : withMin,
    };
  });

  let total = resolved.reduce((sum, s) => sum + s.durationFrames, 0);
  for (let i = 0; i < resolved.length - 1; i++) {
    total -= pickChronicleTransition(i, resolved[i].layoutKey, resolved[i + 1].layoutKey).frames;
  }
  return Math.max(total, FPS * 5);
};

export const ChronicleVideoComposition: React.FC<ChronicleVideoCompositionProps> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  logoOpacity,
  logoSize,
  aspectRatio,
  fontFamily,
  playbackSpeed,
}) => {
  const FPS = 30;
  const resolvedPlaybackSpeed = getPlaybackSpeed(playbackSpeed);
  const fallbackFontFamily = fontFamily || CHRONICLE_BODY_FONT;

  const resolvedScenes = scenes.map((scene, idx, arr) => {
    const layoutKey = (scene.layout as ChronicleLayoutType) in CHRONICLE_LAYOUT_REGISTRY
      ? (scene.layout as ChronicleLayoutType)
      : ("parchment_scroll" as ChronicleLayoutType);
    const raw = getSceneDurationFrames(
      scene.durationSeconds,
      FPS,
      resolvedPlaybackSpeed,
    );
    const withMin = enforceLayoutMinimum(raw, layoutKey);
    const isLastInMulti = idx === arr.length - 1 && arr.length > 1;
    const trimTail =
      isLastInMulti && !scene.voiceoverUrl?.trim();
    const durationFrames = trimTail ? trimLastScene(withMin) : withMin;
    return { scene, layoutKey, durationFrames };
  });

  // Compute scene start frames so we can position voiceover audio absolutely.
  let runningFrame = 0;
  const sceneStartFrames: number[] = [];
  resolvedScenes.forEach((s, i) => {
    sceneStartFrames[i] = runningFrame;
    runningFrame += s.durationFrames;
    if (i < resolvedScenes.length - 1) {
      const nextLayout = resolvedScenes[i + 1].layoutKey;
      runningFrame -= pickChronicleTransition(i, s.layoutKey, nextLayout).frames;
    }
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor || "#F1E4C9",
        fontFamily: fallbackFontFamily,
      }}
    >
      <TransitionSeries>
        {resolvedScenes.map((s, index) => {
          const { scene, layoutKey, durationFrames } = s;
          const LayoutComponent = CHRONICLE_LAYOUT_REGISTRY[layoutKey];

          const rawProps = (scene.layoutProps ?? {}) as Record<string, unknown>;
          const focusX = Math.max(0, Math.min(100, Number(rawProps.imageFocusX ?? 50)));
          const focusY = Math.max(0, Math.min(100, Number(rawProps.imageFocusY ?? 50)));

          const layoutProps: ChronicleLayoutProps = {
            ...(rawProps as Partial<ChronicleLayoutProps>),
            title: scene.title,
            narration: scene.narration,
            imageUrl: scene.imageUrl,
            imageObjectPosition: `${focusX}% ${focusY}%`,
            imageZoom: Math.max(1, Number(rawProps.imageZoom ?? 1)),
            accentColor: accentColor || "#B8860B",
            bgColor: bgColor || "#F1E4C9",
            textColor: textColor || "#2A1810",
            aspectRatio: (aspectRatio as "landscape" | "portrait") || "landscape",
            fontFamily,
          };

          const skipFade = LAYOUTS_WITHOUT_CHROME_FADE.has(layoutKey);
          const showScripture = SCRIPTURE_LAYOUTS.has(layoutKey);

          const sequence = (
            <TransitionSeries.Sequence
              key={`seq-${scene.id}-${index}`}
              durationInFrames={durationFrames}
            >
              <ChronicleChrome
                bgColor={bgColor || "#F1E4C9"}
                accentColor={accentColor || "#B8860B"}
                textColor={textColor || "#2A1810"}
                disablePageTurn={skipFade}
                showScripture={showScripture}
              >
                <LayoutComponent {...layoutProps} />
              </ChronicleChrome>
            </TransitionSeries.Sequence>
          );

          if (index === resolvedScenes.length - 1) {
            return sequence;
          }

          const nextLayout = resolvedScenes[index + 1].layoutKey;
          const choice = pickChronicleTransition(index, layoutKey, nextLayout);

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

      {/* Voiceover audio — positioned absolutely so it stays in sync regardless of transition overlap. */}
      {resolvedScenes.map((s, index) => {
        if (!s.scene.voiceoverUrl) return null;
        return (
          <Sequence
            key={`audio-${s.scene.id}-${index}`}
            from={sceneStartFrames[index]}
            durationInFrames={s.durationFrames}
          >
            <Audio src={s.scene.voiceoverUrl} playbackRate={resolvedPlaybackSpeed} />
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
    </AbsoluteFill>
  );
};
