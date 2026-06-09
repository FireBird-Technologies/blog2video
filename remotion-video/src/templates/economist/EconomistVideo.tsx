import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  CalculateMetadataFunction,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import "../../fonts/economist-defaults";
import { ECONOMIST_SERIF_FONT } from "../../fonts/economist-defaults";
import { ECONOMIST_LAYOUT_REGISTRY } from "./layouts";
import { resolveFontFamily } from "../../fonts/registry";
import type { EconomistLayoutType, EconomistLayoutProps } from "./types";
import { LogoOverlay } from "../../components/LogoOverlay";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
import { EconomistChrome } from "./components/EconomistChrome";
import { pickEconomistTransition } from "./transitions";
import { ECONOMIST_COLORS, LAYOUT_MIN_FRAMES } from "./constants";

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

// cover_reveal owns its own dramatic opening; it skips the chrome fade.
const LAYOUTS_WITHOUT_CHROME_FADE = new Set<EconomistLayoutType>(["cover_reveal"]);

// Full-bleed scenes own the whole canvas — no page frame / footer furniture.
// Full-bleed scenes that own the whole canvas and draw their own masthead — they
// suppress the shared top/bottom chrome furniture. section_divider now joins the
// furniture-bearing scenes; ending_socials draws its own centred red masthead so
// it stays minimal to avoid a double-masthead clash.
const MINIMAL_CHROME_LAYOUTS = new Set<EconomistLayoutType>([
  "cover_reveal",
  "image_feature",
  "ending_socials",
]);

const enforceLayoutMinimum = (frames: number, layout: EconomistLayoutType) =>
  Math.max(frames, LAYOUT_MIN_FRAMES[layout] ?? 150);

// Trim a small tail off the LAST scene in a multi-scene video so the final
// layout's fade-out lines up with the video end. Skipped for single-scene
// compositions (Template Studio previews) and when the last scene has audio.
const LAST_SCENE_TAIL_TRIM_FRAMES = 60;
const trimLastScene = (frames: number) =>
  Math.max(Math.floor(frames * 0.65), frames - LAST_SCENE_TAIL_TRIM_FRAMES);
// A tiny silent buffer before each non-last transition.
const EXTRA_HOLD_FRAMES = 10;

const resolveLayoutKey = (raw: string): EconomistLayoutType =>
  (raw as EconomistLayoutType) in ECONOMIST_LAYOUT_REGISTRY
    ? (raw as EconomistLayoutType)
    : ("leader_article" as EconomistLayoutType);

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
  sceneFrames.map((frames, idx, arr) =>
    idx === arr.length - 1 ? frames : frames + EXTRA_HOLD_FRAMES,
  );

export const calculateEconomistMetadata: CalculateMetadataFunction<VideoProps> = async ({
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
      totalFrames -= pickEconomistTransition(i, fromLayout, toLayout).frames;
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

export const EconomistVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then(setData)
      .catch(() => {
        setData({
          projectName: "Economist Preview",
          accentColor: ECONOMIST_COLORS.accent,
          bgColor: ECONOMIST_COLORS.paper,
          textColor: ECONOMIST_COLORS.ink,
          scenes: [
            {
              id: 1,
              order: 1,
              title: "A Starship enterprise",
              narration: "The week in business, finance and economics.",
              layout: "cover_reveal",
              layoutProps: {},
              durationSeconds: 10,
              voiceoverFile: null,
              images: [],
            },
          ],
        });
      });
  }, [dataUrl]);

  if (!data) return <AbsoluteFill style={{ backgroundColor: ECONOMIST_COLORS.paper }} />;

  const FPS = 30;
  const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
  const resolvedFontFamily = resolveFontFamily(data.fontFamily ?? null);
  const fallbackFontFamily = resolvedFontFamily || ECONOMIST_SERIF_FONT;

  const isPortrait = data.aspectRatio === "portrait";
  const canvasW = isPortrait ? 1080 : 1920;
  const canvasH = isPortrait ? 1920 : 1080;

  const sceneFrames = computeSceneFrames(data.scenes, FPS, playbackSpeed);
  const sequenceFrames = computeSequenceFrames(sceneFrames);
  const resolvedScenes = data.scenes.map((scene, idx) => ({
    scene,
    layoutKey: resolveLayoutKey(scene.layout),
    durationFrames: sceneFrames[idx],
    sequenceFrames: sequenceFrames[idx],
  }));

  // Scene start frames accounting for transition overlap (for audio sync).
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
        backgroundColor: data.bgColor || ECONOMIST_COLORS.paper,
        fontFamily: fallbackFontFamily,
      }}
    >
      <TransitionSeries>
        {resolvedScenes.map((s, index) => {
          const { scene, layoutKey, sequenceFrames } = s;
          const LayoutComponent = ECONOMIST_LAYOUT_REGISTRY[layoutKey];
          const imageUrl =
            scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;

          const rawProps = (scene.layoutProps ?? {}) as Record<string, unknown>;
          const focusX = Math.max(0, Math.min(100, Number(rawProps.imageFocusX ?? 50)));
          const focusY = Math.max(0, Math.min(100, Number(rawProps.imageFocusY ?? 50)));

          const layoutProps: EconomistLayoutProps = {
            ...(rawProps as Partial<EconomistLayoutProps>),
            title: scene.title,
            narration: scene.narration,
            accentColor: data.accentColor || ECONOMIST_COLORS.accent,
            bgColor: data.bgColor || ECONOMIST_COLORS.paper,
            textColor: data.textColor || ECONOMIST_COLORS.ink,
            aspectRatio: (data.aspectRatio as "landscape" | "portrait") || "landscape",
            imageUrl,
            imageObjectPosition: `${focusX}% ${focusY}%`,
            imageZoom: Math.max(0.1, Number(rawProps.imageZoom ?? 1)),
            fontFamily: resolvedFontFamily || undefined,
          };

          const skipFade = LAYOUTS_WITHOUT_CHROME_FADE.has(layoutKey);
          const minimal = MINIMAL_CHROME_LAYOUTS.has(layoutKey);

          const sequence = (
            <TransitionSeries.Sequence
              key={`seq-${scene.id}-${index}`}
              durationInFrames={sequenceFrames}
            >
              <EconomistChrome
                bgColor={data.bgColor || ECONOMIST_COLORS.paper}
                accentColor={data.accentColor || ECONOMIST_COLORS.accent}
                textColor={data.textColor || ECONOMIST_COLORS.ink}
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
