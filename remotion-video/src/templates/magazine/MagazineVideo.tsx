import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  CalculateMetadataFunction,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { MAGAZINE_LAYOUT_REGISTRY as LAYOUT_REGISTRY, MagazineLayoutType, SceneLayoutProps } from "./layouts";
import { resolveFontFamily } from "../../fonts/registry";
import { LogoOverlay } from "../../components/LogoOverlay";
import { BackgroundMusic } from "../../components/BackgroundMusic";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
import { pickMagazineTransition } from "./transitions";

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
  bgmFile?: string | null;
  bgmVolume?: number;
  scenes: SceneData[];
}

interface VideoProps extends Record<string, unknown> {
  dataUrl: string;
}

// Extra hold added to each scene so it stays up through the (now slower)
// transition overlap. Must be >= the largest transition duration in
// transitions/index.ts (currently 42) or narration gets clipped.
const EXTRA_HOLD_FRAMES = 42;

const resolveLayoutKey = (raw: string): MagazineLayoutType =>
  (raw as MagazineLayoutType) in LAYOUT_REGISTRY
    ? (raw as MagazineLayoutType)
    : "feature_spread";

export const calculateMagazineMetadata: CalculateMetadataFunction<VideoProps> =
  async ({ props }) => {
    const FPS = 30;
    try {
      const url = staticFile(props.dataUrl.replace(/^\//, ""));
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}`);
      const data: VideoData = await res.json();

      const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
      const sceneFrames = data.scenes.map((s) =>
        getSceneDurationFrames(s.durationSeconds, FPS, playbackSpeed),
      );
      const sequenceFrames = sceneFrames.map((f, i, arr) =>
        i === arr.length - 1 ? f : f + EXTRA_HOLD_FRAMES,
      );

      let totalFrames = sequenceFrames.reduce((sum, f) => sum + f, 0);
      for (let i = 0; i < data.scenes.length - 1; i++) {
        const fromLayout = resolveLayoutKey(data.scenes[i].layout);
        const toLayout = resolveLayoutKey(data.scenes[i + 1].layout);
        const rawFrames = pickMagazineTransition(i, fromLayout, toLayout).frames;
        const safeFrames = Math.max(1, Math.min(rawFrames, Math.floor(sequenceFrames[i] / 2), Math.floor(sequenceFrames[i + 1] / 2)));
        totalFrames -= safeFrames;
      }

      const isPortrait = data.aspectRatio === "portrait";
      return {
        durationInFrames: Math.max(totalFrames, FPS * 5),
        fps: FPS,
        width: isPortrait ? 1080 : 1920,
        height: isPortrait ? 1920 : 1080,
      };
    } catch {
      return { durationInFrames: FPS * 300, fps: FPS, width: 1920, height: 1080 };
    }
  };

export const MagazineVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then(setData)
      .catch(() => {
        setData({
          projectName: "Preview",
          accentColor: "#E63946",
          bgColor: "#FDFCFB",
          textColor: "#1A1A1A",
          scenes: [],
        });
      });
  }, [dataUrl]);

  if (!data) {
    return <AbsoluteFill style={{ backgroundColor: "#FDFCFB" }} />;
  }

  const FPS = 30;
  const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
  const resolvedFontFamily = resolveFontFamily(data.fontFamily ?? null);
  const isPortrait = data.aspectRatio === "portrait";
  const canvasW = isPortrait ? 1080 : 1920;

  const sceneFrames = data.scenes.map((s) =>
    getSceneDurationFrames(s.durationSeconds, FPS, playbackSpeed),
  );
  const sequenceFrames = sceneFrames.map((f, i, arr) =>
    i === arr.length - 1 ? f : f + EXTRA_HOLD_FRAMES,
  );

  const resolvedScenes = data.scenes.map((scene, idx) => ({
    scene,
    layoutKey: resolveLayoutKey(scene.layout),
    durationFrames: sceneFrames[idx],
    sequenceFrames: sequenceFrames[idx],
  }));

  let runningFrame = 0;
  const sceneStartFrames: number[] = [];
  resolvedScenes.forEach((s, i) => {
    sceneStartFrames[i] = runningFrame;
    runningFrame += s.sequenceFrames;
    if (i < resolvedScenes.length - 1) {
      const nextLayout = resolvedScenes[i + 1].layoutKey;
      const rawFrames = pickMagazineTransition(i, s.layoutKey, nextLayout).frames;
      const safeFrames = Math.max(1, Math.min(rawFrames, Math.floor(s.sequenceFrames / 2), Math.floor(resolvedScenes[i + 1].sequenceFrames / 2)));
      runningFrame -= safeFrames;
    }
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: data.bgColor || "#FDFCFB",
        fontFamily: resolvedFontFamily || undefined,
      }}
    >
      <TransitionSeries>
        {resolvedScenes.map((s, index) => {
          const { scene, layoutKey, sequenceFrames: seqFrames } = s;
          const LayoutComponent = LAYOUT_REGISTRY[layoutKey];
          const imageUrl =
            scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;

          const rawProps = (scene.layoutProps ?? {}) as Record<string, unknown>;
          const focusX = Math.max(0, Math.min(100, Number(rawProps.imageFocusX ?? 50)));
          const focusY = Math.max(0, Math.min(100, Number(rawProps.imageFocusY ?? 50)));

          const layoutProps: SceneLayoutProps = {
            ...(rawProps as Partial<SceneLayoutProps>),
            title: scene.title,
            narration: scene.narration,
            accentColor: data.accentColor || "#D71921",
            bgColor: data.bgColor || "#FFFFFF",
            textColor: data.textColor || "#111111",
            aspectRatio: data.aspectRatio || "landscape",
            sceneDurationInFrames: s.durationFrames,
            imageUrl,
            imageObjectPosition: `${focusX}% ${focusY}%`,
            imageZoom: Math.max(0.1, Number(rawProps.imageZoom ?? 1)),
            fontFamily: resolvedFontFamily || undefined,
            pageNumber: index + 1 < 10 ? `0${index + 1}` : String(index + 1),
            brandName: data.projectName,
          };

          const sequence = (
            <TransitionSeries.Sequence
              key={`seq-${scene.id}-${index}`}
              durationInFrames={seqFrames}
            >
              <LayoutComponent {...layoutProps} />
            </TransitionSeries.Sequence>
          );

          if (index === resolvedScenes.length - 1) {
            return sequence;
          }

          const nextLayout = resolvedScenes[index + 1].layoutKey;
          const choice = pickMagazineTransition(
            index,
            layoutKey,
            nextLayout,
            canvasW,
            data.accentColor || "#E63946",
          );
          // Clamp so the transition never exceeds either adjacent sequence length.
          // Remotion throws a hard error if it does.
          const safeFrames = Math.max(1, Math.min(
            choice.frames,
            Math.floor(seqFrames / 2),
            Math.floor(sequenceFrames[index + 1] / 2),
          ));

          return (
            <React.Fragment key={`scene-${scene.id}-${index}`}>
              {sequence}
              <TransitionSeries.Transition
                presentation={choice.presentation}
                timing={linearTiming({ durationInFrames: safeFrames })}
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

      {data.bgmFile && (
        <BackgroundMusic src={staticFile(data.bgmFile)} volume={data.bgmVolume ?? 0.10} scenes={data.scenes} />
      )}
    </AbsoluteFill>
  );
};
