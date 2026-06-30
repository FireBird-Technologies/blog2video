import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  staticFile,
  useVideoConfig,
  CalculateMetadataFunction,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { MAGAZINE_LAYOUT_REGISTRY as LAYOUT_REGISTRY, MagazineLayoutType, SceneLayoutProps } from "./layouts";
import { signatureMoveFor, MagDimsContext } from "./magazineStyle";
import type { MagazineCameraMove, MagazineTransitionName } from "./types";
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

const resolveLayoutKey = (raw: string): MagazineLayoutType =>
  (raw as MagazineLayoutType) in LAYOUT_REGISTRY
    ? (raw as MagazineLayoutType)
    : "text_narration";

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
      // Per-boundary transition length (0 for the last scene). Each scene holds
      // for exactly its own outgoing transition — must mirror the render's
      // sequenceFrames so the total duration lines up (no black tail / truncated
      // last scene). frames is independent of width/accent, so undefined is fine.
      const transitionFrames = data.scenes.map((scene, i, arr) => {
        if (i === arr.length - 1) return 0;
        const fromLayout = resolveLayoutKey(scene.layout);
        const toLayout = resolveLayoutKey(arr[i + 1].layout);
        const fromExit = scene.layoutProps?.exitTransition as MagazineTransitionName | undefined;
        const toEnter = arr[i + 1].layoutProps?.enterTransition as MagazineTransitionName | undefined;
        return pickMagazineTransition(i, fromLayout, toLayout, undefined, undefined, toEnter, fromExit).frames;
      });
      const sequenceFrames = sceneFrames.map((f, i) => f + transitionFrames[i]);

      let totalFrames = sequenceFrames.reduce((sum, f) => sum + f, 0);
      for (let i = 0; i < data.scenes.length - 1; i++) {
        const safeFrames = Math.max(1, Math.min(transitionFrames[i], Math.floor(sequenceFrames[i] / 2), Math.floor(sequenceFrames[i + 1] / 2)));
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
  // Real output size — may be forced smaller than the 1080p design canvas at
  // render time (e.g. 1280×720 via --width/--height).
  const { width: outW, height: outH } = useVideoConfig();

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
  const canvasH = isPortrait ? 1920 : 1080;

  const sceneFrames = data.scenes.map((s) =>
    getSceneDurationFrames(s.durationSeconds, FPS, playbackSpeed),
  );
  const layoutKeys = data.scenes.map((s) => resolveLayoutKey(s.layout));

  // One transition per boundary (null for the last scene). Reused for the hold,
  // safeFrames and the rendered presentation so pickMagazineTransition runs once.
  const transitionChoices = data.scenes.map((scene, i, arr) => {
    if (i === arr.length - 1) return null;
    const fromExit = scene.layoutProps?.exitTransition as MagazineTransitionName | undefined;
    const toEnter = arr[i + 1].layoutProps?.enterTransition as MagazineTransitionName | undefined;
    return pickMagazineTransition(i, layoutKeys[i], layoutKeys[i + 1], canvasW, data.accentColor || "#E63946", toEnter, fromExit);
  });

  // Hold each scene for exactly its own outgoing transition so the page-turn
  // overlaps the hold (not the narration) and the next scene's voiceover begins
  // the instant this one ends — no dead air. (A fixed max-length hold padded
  // every scene by the longest transition, leaving silence on shorter boundaries.)
  const sequenceFrames = sceneFrames.map(
    (f, i) => f + (transitionChoices[i]?.frames ?? 0),
  );

  const resolvedScenes = data.scenes.map((scene, idx) => ({
    scene,
    layoutKey: layoutKeys[idx],
    durationFrames: sceneFrames[idx],
    sequenceFrames: sequenceFrames[idx],
  }));

  let runningFrame = 0;
  const sceneStartFrames: number[] = [];
  resolvedScenes.forEach((s, i) => {
    sceneStartFrames[i] = runningFrame;
    runningFrame += s.sequenceFrames;
    if (i < resolvedScenes.length - 1) {
      const rawFrames = transitionChoices[i]!.frames;
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
      {/* Design canvas: author every spread at a fixed 1080p size, then uniformly
          scale it to fill the real output so 720p/480p renders are identical to
          1080p (no clipped bands, deterministic auto-fit). Provider hands the
          design size to layout/transition math via useMagDims. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: canvasW,
          height: canvasH,
          transform: `scale(${outW / canvasW}, ${outH / canvasH})`,
          transformOrigin: "top left",
        }}
      >
        <MagDimsContext.Provider value={{ width: canvasW, height: canvasH }}>
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
            establishingShot: index === 0,
            brandName: data.projectName,
            // First scene cranes in; otherwise the per-layout signature move,
            // unless the scene explicitly sets its own cameraMove.
            cameraMove:
              (rawProps.cameraMove as MagazineCameraMove | undefined) ??
              (index === 0 ? "crane_down" : signatureMoveFor(layoutKey, index + 1)),
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

          const choice = transitionChoices[index]!;
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
                timing={linearTiming({
                  durationInFrames: safeFrames,
                  easing: Easing.inOut(Easing.cubic),
                })}
              />
            </React.Fragment>
          );
        })}
          </TransitionSeries>
        </MagDimsContext.Provider>
      </div>

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
