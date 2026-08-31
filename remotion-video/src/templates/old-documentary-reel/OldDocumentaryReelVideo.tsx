import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  CalculateMetadataFunction,
  delayRender,
  continueRender,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { DOCREEL_LAYOUT_REGISTRY as LAYOUT_REGISTRY, DocReelLayoutType, SceneLayoutProps } from "./layouts";
import { resolveFontFamily } from "../../fonts/registry";
import { LogoOverlay } from "../../components/LogoOverlay";
import { BackgroundMusic } from "../../components/BackgroundMusic";
import { CaptionTrack } from "../../components/CaptionTrack";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
import { pickDocReelTransition, DOCREEL_TRANSITION_FRAMES } from "./docReelTransitions";
import {
  DEFAULT_DOCREEL_ERA,
  DocReelEra,
  DOCREEL,
  DocReelThemeProvider,
  makeDocReelTheme,
} from "./docReelStyle";
import { SceneDurationInFramesContext } from "../SceneDurationContext";

interface SceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  narrationText?: string;
  layout: DocReelLayoutType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layoutProps: Record<string, any>;
  durationSeconds: number;
  speechDurationSeconds?: number;
  voiceoverFile: string | null;
  images: string[];
  video?: string;
  videoMuted?: boolean;
  videoVolume?: number;
  videoDurationSeconds?: number;
  videoStartSeconds?: number;
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
  logoSize?: string;
  aspectRatio?: string;
  playbackSpeed?: number;
  fontFamily?: string | null;
  bgmFile?: string | null;
  bgmVolume?: number;
  captionsEnabled?: boolean;
  captionPosition?: string;
  captionFontFamily?: string;
  captionFontSize?: string;
  captionOffset?: number;
  /** Reference era for the whole video: newsreel / home_movie / tape_dub. */
  era?: DocReelEra;
  scenes: SceneData[];
}

interface VideoProps extends Record<string, unknown> {
  dataUrl: string;
}

const FPS = 30;

// The docreel fonts (Oswald, Courier Prime) load asynchronously from their
// @fontsource CSS. Without gating, the render captures frame 0 with a
// fallback font, then snaps a few frames in. Hold the render until ready.
const useDocReelFontsLoaded = (): void => {
  const [handle] = useState(() => delayRender("docreel-fonts"));
  useEffect(() => {
    const fontsApi = (typeof document !== "undefined" ? document.fonts : undefined) as
      | FontFaceSet
      | undefined;
    if (!fontsApi) {
      continueRender(handle);
      return;
    }
    const load = (spec: string) => fontsApi.load(spec).catch(() => undefined);
    Promise.all([
      load('400 40px "Oswald"'),
      load('700 40px "Oswald"'),
      load('400 40px "Courier Prime"'),
      load('700 40px "Courier Prime"'),
    ])
      .then(() => fontsApi.ready)
      .catch(() => undefined)
      .finally(() => continueRender(handle));
  }, [handle]);
};

// Silent visual "hold" appended to the end of every non-last scene's visual
// window, mirroring the Sakura pattern. Mirror byte-identical across both trees.
const DOCREEL_EXTRA_HOLD_FRAMES = 30;

interface ResolvedScene {
  scene: SceneData;
  layoutKey: DocReelLayoutType;
  durationFrames: number;
  sequenceFrames: number;
}

const resolveScenes = (scenes: SceneData[], playbackSpeed: number): ResolvedScene[] =>
  scenes.map((scene, index, arr) => {
    const layoutKey: DocReelLayoutType =
      scene.layout in LAYOUT_REGISTRY ? scene.layout : ("docreel_title_card" as DocReelLayoutType);
    const durationFrames = getSceneDurationFrames(scene.durationSeconds, FPS, playbackSpeed);
    const sequenceFrames =
      index === arr.length - 1 ? durationFrames : durationFrames + DOCREEL_EXTRA_HOLD_FRAMES;
    return { scene, layoutKey, durationFrames, sequenceFrames };
  });

// Each transition effect has its own ideal length (a splice flash is a quick
// stutter, a light leak needs room to bloom) — pickDocReelTransition's `frames`
// is the nominal target here, still capped to 25% of the shorter adjacent
// scene so a very short scene can't be swallowed by its own transition.
const boundaryFrames = (resolved: ResolvedScene[], index: number): number => {
  const nominal =
    index >= 0 && index < resolved.length - 1
      ? pickDocReelTransition(
          index,
          resolved[index].layoutKey,
          resolved[index + 1].layoutKey,
        ).frames
      : DOCREEL_TRANSITION_FRAMES;
  const here = resolved[index]?.durationFrames ?? nominal;
  const next = resolved[index + 1]?.durationFrames ?? nominal;
  const cap = Math.floor(Math.min(here, next) * 0.25);
  return Math.max(1, Math.min(nominal, cap));
};

const computeTotalFrames = (resolved: ResolvedScene[]): number => {
  if (resolved.length === 0) return FPS * 5;
  let total = resolved.reduce((sum, s) => sum + s.sequenceFrames, 0);
  for (let i = 0; i < resolved.length - 1; i++) {
    total -= boundaryFrames(resolved, i);
  }
  return Math.max(total, FPS * 5);
};

export const calculateDocReelMetadata: CalculateMetadataFunction<VideoProps> =
  async ({ props }) => {
    try {
      const url = staticFile(props.dataUrl.replace(/^\//, ""));
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}`);
      const data: VideoData = await res.json();
      const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
      const resolved = resolveScenes(data.scenes, playbackSpeed);
      const isPortrait = data.aspectRatio === "portrait";
      return {
        durationInFrames: computeTotalFrames(resolved),
        fps: FPS,
        width: isPortrait ? 1080 : 1920,
        height: isPortrait ? 1920 : 1080,
      };
    } catch {
      return { durationInFrames: FPS * 300, fps: FPS, width: 1920, height: 1080 };
    }
  };

export const OldDocumentaryReelVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);

  useDocReelFontsLoaded();

  // Built before the early return below: hooks cannot run conditionally.
  const theme = React.useMemo(
    () =>
      makeDocReelTheme({
        bgColor: data?.bgColor,
        textColor: data?.textColor,
        accentColor: data?.accentColor,
      }),
    [data?.bgColor, data?.textColor, data?.accentColor],
  );

  const [dataHandle] = useState(() => delayRender("docreel-data"));
  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then(setData)
      .catch(() => {
        setData({
          projectName: "Preview",
          accentColor: DOCREEL.accent,
          bgColor: DOCREEL.bg,
          textColor: DOCREEL.text,
          scenes: [],
        });
      })
      .finally(() => continueRender(dataHandle));
  }, [dataUrl, dataHandle]);

  if (!data) {
    return (
      <AbsoluteFill style={{ backgroundColor: DOCREEL.bg }}>
        <p style={{ color: DOCREEL.text, fontSize: 36, margin: "auto" }}>Loading...</p>
      </AbsoluteFill>
    );
  }

  const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
  const resolvedFontFamily = resolveFontFamily(data.fontFamily ?? null);
  const resolved = resolveScenes(data.scenes, playbackSpeed);
  const activeEra = data.era ?? DEFAULT_DOCREEL_ERA;

  let runningFrame = 0;
  const sceneStartFrames: number[] = [];
  resolved.forEach((s, i) => {
    sceneStartFrames[i] = runningFrame;
    runningFrame += s.sequenceFrames;
    if (i < resolved.length - 1) {
      runningFrame -= boundaryFrames(resolved, i);
    }
  });

  const buildLayoutProps = (r: ResolvedScene): SceneLayoutProps => {
    const { scene, durationFrames } = r;
    const raw = scene.layoutProps as Record<string, unknown>;
    const imageUrl = scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;
    const videoUrl = scene.video ? staticFile(scene.video) : undefined;
    const focusX = Math.max(0, Math.min(100, Number(raw?.imageFocusX ?? 50)));
    const focusY = Math.max(0, Math.min(100, Number(raw?.imageFocusY ?? 50)));
    return {
      ...raw,
      title: scene.title,
      narration: scene.narration,
      accentColor: theme.accent,
      bgColor: theme.bg,
      textColor: theme.text,
      aspectRatio: data.aspectRatio || "landscape",
      sceneDurationInFrames: durationFrames,
      imageUrl,
      videoUrl,
      videoMuted: scene.videoMuted ?? true,
      videoVolume: scene.videoVolume ?? 0.35,
      videoDurationInFrames: scene.videoDurationSeconds
        ? Math.max(1, Math.round(scene.videoDurationSeconds * FPS))
        : undefined,
      videoStartInFrames: scene.videoStartSeconds
        ? Math.max(0, Math.round(scene.videoStartSeconds * FPS))
        : undefined,
      imageObjectPosition: `${focusX}% ${focusY}%`,
      imageZoom: Math.max(0.1, Number(raw?.imageZoom ?? 1)),
      fontFamily: resolvedFontFamily || undefined,
      era: activeEra,
    };
  };

  const captionSequence = (
    scene: SceneData,
    index: number,
    startFrame: number,
    durationFrames: number,
  ) => {
    const text = scene.narrationText || scene.narration;
    if (!data.captionsEnabled || !text) return null;
    return (
      <Sequence
        key={`caption-${scene.id}-${index}`}
        from={startFrame}
        durationInFrames={durationFrames}
      >
        <CaptionTrack
          text={text}
          position={data.captionPosition || "bottom_center"}
          aspectRatio={data.aspectRatio || "landscape"}
          fontFamily={
            data.captionFontFamily
              ? resolveFontFamily(data.captionFontFamily) || data.captionFontFamily
              : resolvedFontFamily || undefined
          }
          fontSize={data.captionFontSize ? Number(data.captionFontSize) : undefined}
          offset={data.captionOffset ?? 0}
          speechDurationFrames={
            scene.speechDurationSeconds
              ? getSceneDurationFrames(scene.speechDurationSeconds, FPS, playbackSpeed)
              : undefined
          }
        />
      </Sequence>
    );
  };

  return (
    <DocReelThemeProvider value={theme}>
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        fontFamily: resolvedFontFamily || undefined,
      }}
    >
      <TransitionSeries>
        {resolved.map((r, index) => {
          const { scene, layoutKey } = r;
          const LayoutComponent = LAYOUT_REGISTRY[layoutKey] || LAYOUT_REGISTRY.docreel_title_card;
          const layoutProps = buildLayoutProps(r);

          const sequence = (
            <TransitionSeries.Sequence
              key={`seq-${scene.id}-${index}`}
              durationInFrames={r.sequenceFrames}
            >
              <SceneDurationInFramesContext.Provider value={r.durationFrames}>
                <LayoutComponent {...layoutProps} />
              </SceneDurationInFramesContext.Provider>
            </TransitionSeries.Sequence>
          );

          if (index === resolved.length - 1) {
            return sequence;
          }

          const frames = boundaryFrames(resolved, index);
          const { presentation } = pickDocReelTransition(
            index,
            layoutKey,
            resolved[index + 1].layoutKey,
          );

          return (
            <React.Fragment key={`scene-${scene.id}-${index}`}>
              {sequence}
              <TransitionSeries.Transition
                presentation={presentation}
                timing={linearTiming({ durationInFrames: frames })}
              />
            </React.Fragment>
          );
        })}
      </TransitionSeries>

      {resolved.map((r, index) => {
        if (!r.scene.voiceoverFile) return null;
        return (
          <Sequence
            key={`audio-${r.scene.id}-${index}`}
            from={sceneStartFrames[index]}
            durationInFrames={r.durationFrames}
          >
            <Audio src={staticFile(r.scene.voiceoverFile)} playbackRate={playbackSpeed} />
          </Sequence>
        );
      })}

      {resolved.map((r, index) =>
        captionSequence(r.scene, index, sceneStartFrames[index], r.durationFrames),
      )}

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
    </DocReelThemeProvider>
  );
};
