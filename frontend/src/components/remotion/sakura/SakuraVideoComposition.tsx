import React from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { SAKURA_LAYOUT_REGISTRY as LAYOUT_REGISTRY, SakuraLayoutType, SceneLayoutProps } from "./layouts";
import { LogoOverlay } from "../LogoOverlay";
import { BackgroundMusic } from "../BackgroundMusic";
import { CaptionTrack } from "../CaptionTrack";
import { resolveFontFamily } from "../../../fonts/registry";
import { pickSakuraTransition, SAKURA_TRANSITION_FRAMES } from "./sakuraTransitions";

export interface SakuraSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  /** Spoken narration text — used for captions (may differ from on-screen narration). */
  narrationText?: string;
  layout: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layoutProps: Record<string, any>;
  durationSeconds: number;
  /** Spoken-audio length in seconds — for caption timing. */
  speechDurationSeconds?: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface SakuraVideoCompositionProps {
  scenes: SakuraSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
  bgmUrl?: string | null;
  bgmVolume?: number;
  captionsEnabled?: boolean;
  captionPosition?: string;
  captionFontFamily?: string;
  captionFontSize?: number;
  captionOffset?: number;
}

const FPS = 30;

// Silent visual "hold" (~3s @ 30fps) appended to the END of every non-last Sakura scene's visual
// window so each page gets a beat to breathe before its transition. Carries NO voiceover and NO
// caption — audio/captions stay on the base scene window; only the TransitionSeries.Sequence length
// and the total duration grow by it. Last scene gets no hold. 90 > max transition overlap (75), so
// the hold always fully clears the boundary. Mirror byte-identical across all three Sakura trees.
const SAKURA_EXTRA_HOLD_FRAMES = 45;

// Resolve per-scene layout + duration frames once (shared by the render and the
// duration computation so they stay in sync).
const resolveScenes = (scenes: SakuraSceneInput[]) =>
  scenes.map((scene, index, arr) => {
    const layoutKey: SakuraLayoutType =
      (scene.layout as SakuraLayoutType) in LAYOUT_REGISTRY
        ? (scene.layout as SakuraLayoutType)
        : ("sakura_section" as SakuraLayoutType);
    const durationFrames = Math.max(1, Math.round((Number(scene.durationSeconds) || 5) * FPS));
    const sequenceFrames =
      index === arr.length - 1 ? durationFrames : durationFrames + SAKURA_EXTRA_HOLD_FRAMES;
    return { scene, layoutKey, durationFrames, sequenceFrames };
  });

// A TransitionSeries transition may not exceed either neighbouring sequence, and
// two adjacent transitions may not jointly exceed the sequence between them.
// Clamp each boundary's overlap so short scenes degrade gracefully.
const boundaryFrames = (
  resolved: ReturnType<typeof resolveScenes>,
  index: number,
): number => {
  const nominal = pickSakuraTransition(
    index,
    resolved[index]?.layoutKey,
    resolved[index + 1]?.layoutKey,
  ).frames;
  const here = resolved[index]?.durationFrames ?? nominal;
  const next = resolved[index + 1]?.durationFrames ?? nominal;
  // A scene carries a transition on BOTH its head and tail, so cap each boundary at
  // ~1/4 of the shorter neighbour — that leaves at least ~half the scene as a static
  // hold even when both ends overlap. Otherwise short scenes flash by mid-transition.
  const cap = Math.floor(Math.min(here, next) * 0.25);
  return Math.max(1, Math.min(nominal, cap));
};

/**
 * Total video length in frames. Because TransitionSeries OVERLAPS neighbouring
 * scenes by the transition length, the total is Σ durationFrames − Σ boundary
 * overlaps. Kept in sync with the render loop below.
 */
export const computeSakuraVideoTotalFrames = (scenes: SakuraSceneInput[]): number => {
  if (scenes.length === 0) return FPS * 5;
  const resolved = resolveScenes(scenes);
  let total = resolved.reduce((sum, s) => sum + s.sequenceFrames, 0);
  for (let i = 0; i < resolved.length - 1; i++) {
    total -= boundaryFrames(resolved, i);
  }
  return Math.max(total, FPS * 5);
};

export const SakuraVideoComposition: React.FC<SakuraVideoCompositionProps> = ({
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
  bgmUrl,
  bgmVolume,
  captionsEnabled,
  captionPosition,
  captionFontFamily,
  captionFontSize,
  captionOffset,
}) => {
  const resolved = resolveScenes(scenes);

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

  const buildLayoutProps = (
    scene: SakuraSceneInput,
    durationFrames: number,
  ): SceneLayoutProps => {
    const raw = scene.layoutProps as Record<string, unknown>;
    const focusX = Math.max(0, Math.min(100, Number(raw?.imageFocusX ?? 50)));
    const focusY = Math.max(0, Math.min(100, Number(raw?.imageFocusY ?? 50)));
    return {
      ...raw,
      title: scene.title,
      narration: scene.narration,
      imageUrl: scene.imageUrl,
      imageObjectPosition: `${focusX}% ${focusY}%`,
      imageZoom: Math.max(0.1, Number(raw?.imageZoom ?? 1)),
      accentColor: accentColor || "#C0143C",
      bgColor: bgColor || "#FDF6F0",
      textColor: textColor || "#2A0A12",
      aspectRatio,
      sceneDurationInFrames: durationFrames,
      fontFamily,
    };
  };

  // On-screen captions for a scene, synced to its voiceover window. Rendered in an
  // absolutely-positioned Sequence so it stays in step with the overlap-adjusted
  // scene starts — matching how the magazine composition renders captions.
  const captionSequence = (
    scene: SakuraSceneInput,
    index: number,
    startFrame: number,
    durationFrames: number,
  ) => {
    const text = scene.narrationText || scene.narration;
    if (!captionsEnabled || !text) return null;
    return (
      <Sequence
        key={`caption-${scene.id}-${index}`}
        from={startFrame}
        durationInFrames={durationFrames}
      >
        <CaptionTrack
          text={text}
          position={captionPosition || "bottom_center"}
          aspectRatio={aspectRatio || "landscape"}
          fontFamily={
            captionFontFamily
              ? resolveFontFamily(captionFontFamily) || captionFontFamily
              : fontFamily || undefined
          }
          fontSize={captionFontSize || undefined}
          offset={captionOffset ?? 0}
          speechDurationFrames={
            scene.speechDurationSeconds
              ? Math.round(scene.speechDurationSeconds * FPS)
              : undefined
          }
        />
      </Sequence>
    );
  };

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#FDF6F0", fontFamily }}>
      <TransitionSeries>
        {resolved.map((s, index) => {
          const { scene, layoutKey, durationFrames, sequenceFrames } = s;
          const LayoutComponent = LAYOUT_REGISTRY[layoutKey] ?? LAYOUT_REGISTRY.sakura_section;
          const layoutProps = buildLayoutProps(scene, durationFrames);

          const sequence = (
            <TransitionSeries.Sequence
              key={`seq-${scene.id}-${index}`}
              durationInFrames={sequenceFrames}
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
            accentColor,
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
      {resolved.map((s, index) => {
        if (!s.scene.voiceoverUrl) return null;
        return (
          <Sequence
            key={`audio-${s.scene.id}-${index}`}
            from={sceneStartFrames[index]}
            durationInFrames={s.durationFrames}
          >
            <Audio src={s.scene.voiceoverUrl} />
          </Sequence>
        );
      })}

      {/* On-screen captions, one Sequence per scene, synced to the voiceover window. */}
      {resolved.map((s, index) =>
        captionSequence(s.scene, index, sceneStartFrames[index], s.durationFrames),
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
