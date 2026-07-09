import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  CalculateMetadataFunction,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { SAKURA_LAYOUT_REGISTRY as LAYOUT_REGISTRY, SakuraLayoutType, SceneLayoutProps } from "./layouts";
import { resolveFontFamily } from "../../fonts/registry";
import { LogoOverlay } from "../../components/LogoOverlay";
import { BackgroundMusic } from "../../components/BackgroundMusic";
import { CaptionTrack } from "../../components/CaptionTrack";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
import { pickSakuraTransition, SAKURA_TRANSITION_FRAMES } from "./sakuraTransitions";

interface SceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  /** Spoken narration text — used for captions (may differ from on-screen narration). */
  narrationText?: string;
  layout: SakuraLayoutType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layoutProps: Record<string, any>;
  durationSeconds: number;
  /** Spoken-audio length in seconds (scene duration minus trailing pad) — for caption timing. */
  speechDurationSeconds?: number;
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
  scenes: SceneData[];
}

interface VideoProps extends Record<string, unknown> {
  dataUrl: string;
}

const FPS = 30;

// Silent visual "hold" (~3s @ 30fps) appended to the END of every non-last Sakura scene's visual
// window so each page gets a beat to breathe before its transition. Carries NO voiceover and NO
// caption — audio/captions stay on the base scene window; only the TransitionSeries.Sequence length
// and the total duration grow by it. Last scene gets no hold. 90 > max transition overlap (75), so
// the hold always fully clears the boundary. Mirror byte-identical across all three Sakura trees.
const SAKURA_EXTRA_HOLD_FRAMES = 45;

interface ResolvedScene {
  scene: SceneData;
  layoutKey: SakuraLayoutType;
  durationFrames: number; // base window — drives audio, captions, boundary cap
  sequenceFrames: number; // base + silent hold — drives the visual TransitionSeries.Sequence + total
}

const resolveScenes = (scenes: SceneData[], playbackSpeed: number): ResolvedScene[] =>
  scenes.map((scene, index, arr) => {
    const layoutKey: SakuraLayoutType =
      scene.layout in LAYOUT_REGISTRY ? scene.layout : ("sakura_section" as SakuraLayoutType);
    const durationFrames = getSceneDurationFrames(scene.durationSeconds, FPS, playbackSpeed);
    const sequenceFrames =
      index === arr.length - 1 ? durationFrames : durationFrames + SAKURA_EXTRA_HOLD_FRAMES;
    return { scene, layoutKey, durationFrames, sequenceFrames };
  });

// A TransitionSeries transition may not exceed either neighbouring sequence.
// Clamp each boundary's overlap so short scenes degrade gracefully. Kept identical
// to the frontend SakuraVideoComposition accounting.
const boundaryFrames = (resolved: ResolvedScene[], index: number): number => {
  const nominal = pickSakuraTransition(
    index,
    resolved[index]?.layoutKey,
    resolved[index + 1]?.layoutKey,
  ).frames;
  const here = resolved[index]?.durationFrames ?? nominal;
  const next = resolved[index + 1]?.durationFrames ?? nominal;
  // A scene carries a transition on BOTH head and tail, so cap each boundary at ~1/4
  // of the shorter neighbour — leaves ~half the scene as a static hold even when both
  // ends overlap. Kept identical to the frontend SakuraVideoComposition accounting.
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

export const calculateSakuraMetadata: CalculateMetadataFunction<VideoProps> =
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

export const SakuraVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then(setData)
      .catch(() => {
        setData({
          projectName: "Preview",
          accentColor: "#C0143C",
          bgColor: "#FDF6F0",
          textColor: "#2A0A12",
          scenes: [],
        });
      });
  }, [dataUrl]);

  if (!data) {
    return (
      <AbsoluteFill style={{ backgroundColor: "#FDF6F0" }}>
        <p style={{ color: "#2A0A12", fontSize: 36, margin: "auto" }}>Loading...</p>
      </AbsoluteFill>
    );
  }

  const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
  const resolvedFontFamily = resolveFontFamily(data.fontFamily ?? null);
  const resolved = resolveScenes(data.scenes, playbackSpeed);

  // Absolute scene start frames (for voiceover audio), accounting for overlaps.
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
    const focusX = Math.max(0, Math.min(100, Number(raw?.imageFocusX ?? 50)));
    const focusY = Math.max(0, Math.min(100, Number(raw?.imageFocusY ?? 50)));
    return {
      ...raw,
      title: scene.title,
      narration: scene.narration,
      accentColor: data.accentColor || "#C0143C",
      bgColor: data.bgColor || "#FDF6F0",
      textColor: data.textColor || "#2A0A12",
      aspectRatio: data.aspectRatio || "landscape",
      sceneDurationInFrames: durationFrames,
      imageUrl,
      imageObjectPosition: `${focusX}% ${focusY}%`,
      imageZoom: Math.max(0.1, Number(raw?.imageZoom ?? 1)),
      fontFamily: resolvedFontFamily || undefined,
    };
  };

  // On-screen captions for a scene, synced to its voiceover window. Rendered in an
  // absolutely-positioned Sequence so it stays in step with the overlap-adjusted
  // scene starts — matching how the magazine composition renders captions.
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
    <AbsoluteFill
      style={{
        backgroundColor: data.bgColor || "#FDF6F0",
        fontFamily: resolvedFontFamily || undefined,
      }}
    >
      <TransitionSeries>
        {resolved.map((r, index) => {
          const { scene, layoutKey } = r;
          const LayoutComponent = LAYOUT_REGISTRY[layoutKey] || LAYOUT_REGISTRY.sakura_section;
          const layoutProps = buildLayoutProps(r);

          const sequence = (
            <TransitionSeries.Sequence
              key={`seq-${scene.id}-${index}`}
              durationInFrames={r.sequenceFrames}
            >
              <LayoutComponent {...layoutProps} />
            </TransitionSeries.Sequence>
          );

          if (index === resolved.length - 1) {
            return sequence;
          }

          const frames = boundaryFrames(resolved, index);
          const { presentation } = pickSakuraTransition(
            index,
            layoutKey,
            resolved[index + 1].layoutKey,
            data.accentColor || "#C0143C",
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

      {/* Voiceover audio — absolutely positioned so it stays in sync despite overlaps. */}
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

      {/* On-screen captions, one Sequence per scene, synced to the voiceover window. */}
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
  );
};
