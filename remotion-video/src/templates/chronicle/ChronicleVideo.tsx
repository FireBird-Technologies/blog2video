import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  CalculateMetadataFunction,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import "../../fonts/chronicle-defaults";
import { CHRONICLE_BODY_FONT } from "../../fonts/chronicle-defaults";
import { CHRONICLE_LAYOUT_REGISTRY } from "./layouts";
import { resolveFontFamily } from "../../fonts/registry";
import type { ChronicleLayoutType, ChronicleLayoutProps } from "./types";
import { LogoOverlay } from "../../components/LogoOverlay";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
import { ChronicleChrome } from "./components/ChronicleChrome";
import { pickChronicleTransition } from "./transitions";

interface SceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  voiceoverFile: string | null;
  images: string[];
}

interface VideoData {
  projectName: string;
  heroImage?: string | null;
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number | string;
  aspectRatio?: string;
  playbackSpeed?: number;
  fontFamily?: string | null;
  scenes: SceneData[];
}

interface VideoProps extends Record<string, unknown> {
  dataUrl: string;
}

const LAYOUTS_WITHOUT_CHROME_FADE = new Set<ChronicleLayoutType>(["book_open"]);

const SCRIPTURE_LAYOUTS = new Set<ChronicleLayoutType>([
  "book_open",
  "illuminated_quote",
  "parchment_scroll",
  "decree_seal",
]);

// Per-layout minimum scene durations (in frames @ 30fps).
//
// Each chronicle layout has hardcoded animation timings. BookOpen has 5 acts
// (book settle 0-30, seal crack 32-54, cover open 60-100, title push-in
// 100-134, then a title burn-in + hold) plus an 18-frame outroFade. If
// `scene.durationSeconds` is shorter than the layout's natural arc, the
// content gets cut off mid-reveal and the next scene starts before the eye
// can read anything — which is exactly what feels "rushed."
//
// These floors guarantee every layout has enough room to (1) play its
// intro, (2) hold the content visibly, and (3) complete its outroFade —
// without rushing.
// Timeline of book_open's animation (frames @ 30fps, after my 1.55× slowdown):
//   0-30    book settles in (closed tome)
//   32-54   wax seal cracks
//   60-100  cover swings open (slow spring)
//   100-134 title page pushes in
//   112-172 title letters burn in (LOTR-style fiery glow ramp)
//   142     ink divider draws
//   155-245 subtitle/narration types out word-by-word (up to 90 frames)
//   180-200 small wax seal signature fades in
//   then    needs ~30 frames of comfortable hold before outroFade
//   final   18-frame outroFade
// Total: ~245 + 30 + 18 = ~293 → round up to 300 (10s) for safety. Anything
// shorter cuts off the subtitle mid-typing and the title barely holds.
const LAYOUT_MIN_FRAMES: Record<ChronicleLayoutType, number> = {
  book_open: 300,
  ending_socials: 200, // 6.7s — staggered title/narration/socials reveals + hold
  chronicle_timeline: 200, // staggered timeline items
  ledger_stats: 200, // staggered stat cells
  versus_folio: 200, // two staggered halves
  chronicle_data: 200, // chart draw-in + summary reveal
  chronicle_table: 200, // staggered ledger rows
  chapter_plate: 170,
  illuminated_quote: 170,
  parchment_scroll: 170,
  decree_seal: 170,
  map_reveal: 170,
};

const enforceLayoutMinimum = (frames: number, layout: ChronicleLayoutType) =>
  Math.max(frames, LAYOUT_MIN_FRAMES[layout] ?? 150);

// On the LAST scene, layouts run their fadeOut to opacity 0 with nothing
// after to overlap. Trim a small tail off the last scene's contributed
// duration so the video ends close to where content actually finishes.
// Only applied when there are MULTIPLE scenes — single-scene compositions
// (Template Studio previews) need their full window.
// Skip trimming when the last scene has voiceover: audio shares this duration
// and trimming clips narration before it finishes.
const LAST_SCENE_TAIL_TRIM_FRAMES = 60;
const trimLastScene = (frames: number) =>
  Math.max(Math.floor(frames * 0.65), frames - LAST_SCENE_TAIL_TRIM_FRAMES);
// Keep a tiny silent buffer before each non-last page transition.
const EXTRA_HOLD_FRAMES = 10;

const resolveLayoutKey = (raw: string): ChronicleLayoutType =>
  (raw as ChronicleLayoutType) in CHRONICLE_LAYOUT_REGISTRY
    ? (raw as ChronicleLayoutType)
    : ("parchment_scroll" as ChronicleLayoutType);

const computeSceneFrames = (
  scenes: SceneData[],
  fps: number,
  playbackSpeed: number,
): number[] =>
  scenes.map((s, idx, arr) => {
    const layout = resolveLayoutKey(s.layout);
    const raw = getSceneDurationFrames(s.durationSeconds, fps, playbackSpeed);
    const withMin = enforceLayoutMinimum(raw, layout);
    const isLastInMulti = idx === arr.length - 1 && arr.length > 1;
    const hasVoiceover = Boolean(s.voiceoverFile?.trim());
    return isLastInMulti && !hasVoiceover ? trimLastScene(withMin) : withMin;
  });

const computeSequenceFrames = (sceneFrames: number[]): number[] =>
  sceneFrames.map((frames, idx, arr) => (idx === arr.length - 1 ? frames : frames + EXTRA_HOLD_FRAMES));

export const calculateChronicleMetadata: CalculateMetadataFunction<VideoProps> = async ({
  props,
}) => {
  const FPS = 30;
  try {
    const url = staticFile(props.dataUrl.replace(/^\//, ""));
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
    const data: VideoData = await res.json();

    const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
    const sceneFrames = computeSceneFrames(data.scenes, FPS, playbackSpeed);
    const sequenceFrames = computeSequenceFrames(sceneFrames);
    let totalFrames = sequenceFrames.reduce((sum, f) => sum + f, 0);
    for (let i = 0; i < data.scenes.length - 1; i++) {
      const fromLayout = resolveLayoutKey(data.scenes[i].layout);
      const toLayout = resolveLayoutKey(data.scenes[i + 1].layout);
      totalFrames -= pickChronicleTransition(i, fromLayout, toLayout).frames;
    }
    const isPortrait = data.aspectRatio === "portrait";

    return {
      durationInFrames: Math.max(totalFrames, FPS * 5),
      fps: FPS,
      width: isPortrait ? 1080 : 1920,
      height: isPortrait ? 1920 : 1080,
    };
  } catch {
    return {
      durationInFrames: FPS * 300,
      fps: FPS,
      width: 1920,
      height: 1080,
    };
  }
};

export const ChronicleVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then(setData)
      .catch(() => {
        setData({
          projectName: "Chronicle Preview",
          accentColor: "#B8860B",
          bgColor: "#F1E4C9",
          textColor: "#2A1810",
          scenes: [
            {
              id: 1,
              order: 1,
              title: "The Chronicle Begins",
              narration: "Turn the page and let the record speak.",
              layout: "book_open",
              layoutProps: {},
              durationSeconds: 6,
              voiceoverFile: null,
              images: [],
            },
          ],
        });
      });
  }, [dataUrl]);

  if (!data) return <AbsoluteFill style={{ backgroundColor: "#F1E4C9" }} />;

  const FPS = 30;
  const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
  const resolvedFontFamily = resolveFontFamily(data.fontFamily ?? null);
  const fallbackFontFamily = resolvedFontFamily || CHRONICLE_BODY_FONT;

  const sceneFrames = computeSceneFrames(data.scenes, FPS, playbackSpeed);
  const sequenceFrames = computeSequenceFrames(sceneFrames);
  const resolvedScenes = data.scenes.map((scene, idx) => ({
    scene,
    layoutKey: resolveLayoutKey(scene.layout),
    durationFrames: sceneFrames[idx],
    sequenceFrames: sequenceFrames[idx],
  }));

  // Compute scene start frames accounting for transition overlap (for audio sync).
  let runningFrame = 0;
  const sceneStartFrames: number[] = [];
  resolvedScenes.forEach((s, i) => {
    sceneStartFrames[i] = runningFrame;
    runningFrame += s.sequenceFrames;
    if (i < resolvedScenes.length - 1) {
      const nextLayout = resolvedScenes[i + 1].layoutKey;
      runningFrame -= pickChronicleTransition(i, s.layoutKey, nextLayout).frames;
    }
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: data.bgColor || "#F1E4C9",
        fontFamily: fallbackFontFamily,
      }}
    >
      <TransitionSeries>
        {resolvedScenes.map((s, index) => {
          const { scene, layoutKey, sequenceFrames } = s;
          const LayoutComponent = CHRONICLE_LAYOUT_REGISTRY[layoutKey];
          const imageUrl =
            scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;

          const rawProps = (scene.layoutProps ?? {}) as Record<string, unknown>;
          const focusX = Math.max(0, Math.min(100, Number(rawProps.imageFocusX ?? 50)));
          const focusY = Math.max(0, Math.min(100, Number(rawProps.imageFocusY ?? 50)));

          const layoutProps: ChronicleLayoutProps = {
            ...(rawProps as Partial<ChronicleLayoutProps>),
            title: scene.title,
            narration: scene.narration,
            accentColor: data.accentColor || "#B8860B",
            bgColor: data.bgColor || "#F1E4C9",
            textColor: data.textColor || "#2A1810",
            aspectRatio: (data.aspectRatio as "landscape" | "portrait") || "landscape",
            imageUrl,
            imageObjectPosition: `${focusX}% ${focusY}%`,
            imageZoom: Math.max(0.1, Number(rawProps.imageZoom ?? 1)),
            fontFamily: resolvedFontFamily || undefined,
          };

          const skipFade = LAYOUTS_WITHOUT_CHROME_FADE.has(layoutKey);
          const showScripture = SCRIPTURE_LAYOUTS.has(layoutKey);

          const sequence = (
            <TransitionSeries.Sequence
              key={`seq-${scene.id}-${index}`}
              durationInFrames={sequenceFrames}
            >
              <ChronicleChrome
                bgColor={data.bgColor || "#F1E4C9"}
                accentColor={data.accentColor || "#B8860B"}
                textColor={data.textColor || "#2A1810"}
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

      {resolvedScenes.map((s, index) => {
        if (!s.scene.voiceoverFile) return null;
        return (
          <Sequence
            key={`audio-${s.scene.id}-${index}`}
            from={sceneStartFrames[index]}
            durationInFrames={s.durationFrames}
          >
            <Audio src={staticFile(s.scene.voiceoverFile)} playbackRate={playbackSpeed} />
          </Sequence>
        );
      })}

      {data.logo && (
        <LogoOverlay
          src={staticFile(data.logo)}
          position={data.logoPosition || "bottom_right"}
          maxOpacity={data.logoOpacity ?? 0.9}
          size={data.logoSize || "default"}
          aspectRatio={data.aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};
