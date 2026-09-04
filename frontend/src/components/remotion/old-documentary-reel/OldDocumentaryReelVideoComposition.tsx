import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  delayRender,
  continueRender,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import {
  DOCREEL_LAYOUT_REGISTRY as LAYOUT_REGISTRY,
  DocReelLayoutType,
  SceneLayoutProps,
} from "./layouts";
import { LogoOverlay } from "../LogoOverlay";
import { AvatarOverlay } from "../AvatarOverlay";
import { BackgroundMusic } from "../BackgroundMusic";
import { CaptionTrack } from "../CaptionTrack";
import { resolveFontFamily } from "../../../fonts/registry";
import {
  pickDocReelTransition,
  DOCREEL_TRANSITION_FRAMES,
} from "./docReelTransitions";
import {
  DEFAULT_DOCREEL_ERA,
  DocReelEra,
  DocReelThemeProvider,
  makeDocReelTheme,
} from "./docReelStyle";
import { SceneDurationInFramesContext } from "../SceneDurationContext";
import type { CompositionSchedule, SceneScheduleEntry } from "../sceneSchedule";

export interface DocReelSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  narrationText?: string;
  layout: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layoutProps: Record<string, any>;
  durationSeconds: number;
  speechDurationSeconds?: number;
  imageUrl?: string;
  videoUrl?: string;
  videoMuted?: boolean;
  videoVolume?: number;
  videoDurationSeconds?: number;
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

export interface OldDocumentaryReelVideoCompositionProps {
  scenes: DocReelSceneInput[];
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
  /** Reference era for the whole video: newsreel / home_movie / tape_dub. */
  era?: DocReelEra;
}

const FPS = 30;

// The docreel fonts (Oswald, Courier Prime) load asynchronously from their
// @fontsource CSS. Without gating, the render captures frame 0 with a
// fallback font, then snaps a few frames in. Hold the render until ready.
const useDocReelFontsLoaded = (): void => {
  const [handle] = React.useState(() => delayRender("docreel-fonts"));
  React.useEffect(() => {
    const fontsApi = (
      typeof document !== "undefined" ? document.fonts : undefined
    ) as FontFaceSet | undefined;
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

// Silent visual "hold" appended to regular non-last scenes.
const DOCREEL_EXTRA_HOLD_FRAMES = 30;

interface ResolvedDocReelScene {
  scene: DocReelSceneInput;
  layoutKey: DocReelLayoutType;
  durationFrames: number;
  sequenceFrames: number;
}

const transitionFramesForPair = (
  index: number,
  currentLayout: DocReelLayoutType,
  nextLayout: DocReelLayoutType,
  currentFrames: number,
  nextFrames: number,
): number => {
  const nominal = pickDocReelTransition(index, currentLayout, nextLayout).frames;
  const cap = Math.floor(Math.min(currentFrames, nextFrames) * 0.25);
  return Math.max(1, Math.min(nominal, cap));
};

const resolveScenes = (scenes: DocReelSceneInput[]): ResolvedDocReelScene[] => {
  const resolved = scenes.map((scene, index, arr) => {
    const layoutKey: DocReelLayoutType =
      (scene.layout as DocReelLayoutType) in LAYOUT_REGISTRY
        ? (scene.layout as DocReelLayoutType)
        : ("docreel_title_card" as DocReelLayoutType);
    const durationFrames = Math.max(
      1,
      Math.round((Number(scene.durationSeconds) || 5) * FPS),
    );
    const sequenceFrames =
      index === arr.length - 1
        ? durationFrames
        : durationFrames + DOCREEL_EXTRA_HOLD_FRAMES;
    return { scene, layoutKey, durationFrames, sequenceFrames };
  });

  // A TransitionSeries transition overlaps the tail of its outgoing sequence.
  // Give the countdown exactly that overlap as its sequence extension, so the
  // next scene starts at countdown.durationFrames — precisely one second after
  // its audio ends, because the backend stores audio duration + 1s.
  return resolved.map((entry, index) => {
    if (entry.layoutKey !== "docreel_countdown" || index === resolved.length - 1) {
      return entry;
    }
    const next = resolved[index + 1];
    return {
      ...entry,
      sequenceFrames:
        entry.durationFrames +
        transitionFramesForPair(
          index,
          entry.layoutKey,
          next.layoutKey,
          entry.durationFrames,
          next.durationFrames,
        ),
    };
  });
};
// Each transition effect has its own ideal length (a splice flash is a quick
// stutter, a light leak needs room to bloom) — pickDocReelTransition's `frames`
// is the nominal target here, still capped to 25% of the shorter adjacent
// scene so a very short scene can't be swallowed by its own transition.
const boundaryFrames = (
  resolved: ReturnType<typeof resolveScenes>,
  index: number,
): number => {
  if (index < 0 || index >= resolved.length - 1) {
    return DOCREEL_TRANSITION_FRAMES;
  }
  return transitionFramesForPair(
    index,
    resolved[index].layoutKey,
    resolved[index + 1].layoutKey,
    resolved[index].durationFrames,
    resolved[index + 1].durationFrames,
  );
};

export const computeDocReelSchedule = (
  scenes: DocReelSceneInput[],
): CompositionSchedule => {
  if (scenes.length === 0) return { scenes: [], totalFrames: FPS * 5 };
  const resolved = resolveScenes(scenes);
  const boundaryAt = (i: number) =>
    i >= 0 && i < resolved.length - 1 ? boundaryFrames(resolved, i) : 0;

  const entries: SceneScheduleEntry[] = [];
  let running = 0;
  resolved.forEach((s, i) => {
    entries.push({
      start: running,
      duration: s.durationFrames,
      enterFrames: boundaryAt(i - 1),
      exitFrames: boundaryAt(i),
    });
    running += s.sequenceFrames - boundaryAt(i);
  });

  return { scenes: entries, totalFrames: Math.max(running, FPS * 5) };
};

export const computeDocReelVideoTotalFrames = (
  scenes: DocReelSceneInput[],
): number => computeDocReelSchedule(scenes).totalFrames;

export const OldDocumentaryReelVideoComposition: React.FC<
  OldDocumentaryReelVideoCompositionProps
> = ({
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
  era,
}) => {
  useDocReelFontsLoaded();

  // Single source of truth for every color the template paints. At the shipped
  // defaults this returns today's exact values; the moment the user changes any
  // of the three, every previously-hardcoded area derives from their choice.
  const theme = React.useMemo(
    () => makeDocReelTheme({ bgColor, textColor, accentColor }),
    [bgColor, textColor, accentColor],
  );

  const resolved = resolveScenes(scenes);
  const sceneStartFrames = computeDocReelSchedule(scenes).scenes.map(
    (e) => e.start,
  );
  const activeEra = era ?? DEFAULT_DOCREEL_ERA;

  const buildLayoutProps = (
    scene: DocReelSceneInput,
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
      videoUrl: scene.videoUrl,
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
      accentColor: theme.accent,
      bgColor: theme.bg,
      textColor: theme.text,
      aspectRatio,
      sceneDurationInFrames: durationFrames,
      fontFamily,
      era: activeEra,
    };
  };

  const captionSequence = (
    scene: DocReelSceneInput,
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
    <DocReelThemeProvider value={theme}>
      <AbsoluteFill style={{ backgroundColor: theme.bg, fontFamily }}>
        <TransitionSeries>
          {resolved.map((s, index) => {
            const { scene, layoutKey, durationFrames, sequenceFrames } = s;
            const LayoutComponent =
              LAYOUT_REGISTRY[layoutKey] ?? LAYOUT_REGISTRY.docreel_title_card;
            const layoutProps = buildLayoutProps(scene, durationFrames);

            const sequence = (
              <TransitionSeries.Sequence
                key={`seq-${scene.id}-${index}`}
                durationInFrames={sequenceFrames}
              >
                <SceneDurationInFramesContext.Provider value={durationFrames}>
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

        {resolved.map((s, index) => {
          if (!s.scene.voiceoverUrl) return null;
          return (
            <Sequence
              key={`audio-${s.scene.id}-${index}`}
              from={sceneStartFrames[index]}
              durationInFrames={s.durationFrames}
            >
              <Audio src={s.scene.voiceoverUrl} />
              {s.scene.avatarUrl ? (
                <AvatarOverlay
                  src={s.scene.avatarUrl}
                  aspectRatio={aspectRatio || "landscape"}
                  shape={s.scene.avatarShape}
                  size={s.scene.avatarSize}
                  position={s.scene.avatarPosition}
                  bg={s.scene.avatarBg}
                  opacity={s.scene.avatarOpacity}
                  focusX={s.scene.avatarFocusX}
                  focusY={s.scene.avatarFocusY}
                  zoom={s.scene.avatarZoom}
                />
              ) : null}
            </Sequence>
          );
        })}

        {resolved.map((s, index) =>
          captionSequence(
            s.scene,
            index,
            sceneStartFrames[index],
            s.durationFrames,
          ),
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
          <BackgroundMusic
            src={bgmUrl}
            volume={bgmVolume ?? 0.1}
            scenes={scenes}
          />
        )}
      </AbsoluteFill>
    </DocReelThemeProvider>
  );
};
