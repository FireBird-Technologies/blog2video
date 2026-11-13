/**
 * Crumpled Paper — shared composition (render + browser preview).
 *
 * Scenes play back to back on a plain timeline (the sum of scene durations, so the
 * shared linear schedule in the frontend is already correct). Each layout owns its
 * exit — tear / rip / fold / crumple / paper airplane — inside its own file, played
 * in the scene's last frames onto the desk, so a scene looks the same in the full
 * video and when it is played on its own.
 *
 * Mirror byte-identical in both trees:
 *   remotion-video/src/templates/crumpled/
 *   frontend/src/components/remotion/crumpled/
 * The render entry (CrumpledVideo.tsx) and the preview wrapper
 * (CrumpledPreviewComposition.tsx) add logo / captions / music / avatar.
 */
import React from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender } from "remotion";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
import { SceneDurationInFramesContext } from "../SceneDurationContext";
import { CRUMPLED_LAYOUT_REGISTRY } from "./layouts";
import type { SceneLayoutProps } from "./types";
import { CRUMPLED_DEFAULTS, mix, CRUMPLED_DESK } from "./crumpledStyle";
import { HandheldCamera } from "./components/HandheldCamera";
import { CRUMPLED_DEFAULT_FONT } from "./typography";

export type CrumpledScene = {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  videoUrl?: string;
  videoMuted?: boolean;
  videoVolume?: number;
  /** Clip length — either in frames (render entry) or seconds (preview). */
  videoDurationInFrames?: number;
  videoDurationSeconds?: number;
  videoStartInFrames?: number;
  videoStartSeconds?: number;
  voiceoverUrl?: string;
};

export type CrumpledCompositionProps = {
  scenes: CrumpledScene[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  fontFamily?: string;
  playbackSpeed?: number;
};

const FPS = 30;
export const CRUMPLED_HERO_LAYOUT = "paper_hero";
export const CRUMPLED_FALLBACK_LAYOUT = "sketch_narration";

const resolveLayout = (layout: string): string =>
  layout in CRUMPLED_LAYOUT_REGISTRY ? layout : CRUMPLED_FALLBACK_LAYOUT;

/** Hold the first frame until Caveat (every weight the layouts use) is ready. */
const useCrumpledFontsLoaded = (): void => {
  const [handle] = React.useState(() => delayRender("crumpled-fonts"));
  React.useEffect(() => {
    const fontsApi = (typeof document !== "undefined" ? document.fonts : undefined) as FontFaceSet | undefined;
    if (!fontsApi) {
      continueRender(handle);
      return;
    }
    const load = (spec: string) => fontsApi.load(spec).catch(() => undefined);
    Promise.all([load('400 40px "Caveat"'), load('500 40px "Caveat"'), load('600 40px "Caveat"'), load('700 40px "Caveat"')])
      .then(() => fontsApi.ready)
      .catch(() => undefined)
      .finally(() => continueRender(handle));
  }, [handle]);
};

export interface CrumpledTimelineEntry {
  layout: string;
  /** Scene start on the global timeline (back-to-back). */
  start: number;
  /** Scene's own length (visuals, audio and captions). */
  durationFrames: number;
}

/**
 * The composition's timeline. Single source of truth for the component, the render
 * entry's metadata and the preview wrapper's overlays.
 */
export const computeCrumpledTimeline = (
  scenes: Array<Pick<CrumpledScene, "layout" | "durationSeconds">>,
  playbackSpeed?: number,
): { entries: CrumpledTimelineEntry[]; totalFrames: number } => {
  const speed = getPlaybackSpeed(playbackSpeed);
  const entries: CrumpledTimelineEntry[] = [];
  let start = 0;
  scenes.forEach((s) => {
    const durationFrames = getSceneDurationFrames(Number(s.durationSeconds) || 5, FPS, speed);
    entries.push({ layout: resolveLayout(String(s.layout)), start, durationFrames });
    start += durationFrames;
  });
  return { entries, totalFrames: Math.max(start, FPS * 5) };
};

export const computeCrumpledVideoTotalFrames = (
  scenes: Array<Pick<CrumpledScene, "layout" | "durationSeconds">>,
  playbackSpeed?: number,
): number => computeCrumpledTimeline(scenes, playbackSpeed).totalFrames;

export const CrumpledVideoComposition: React.FC<CrumpledCompositionProps> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  fontFamily,
  playbackSpeed,
}) => {
  useCrumpledFontsLoaded();
  const paper = bgColor || CRUMPLED_DEFAULTS.bg;
  const ink = textColor || CRUMPLED_DEFAULTS.text;
  const accent = accentColor || CRUMPLED_DEFAULTS.accent;
  const speed = getPlaybackSpeed(playbackSpeed);
  const { entries } = computeCrumpledTimeline(scenes, playbackSpeed);
  const font = fontFamily?.trim() || CRUMPLED_DEFAULT_FONT;

  const buildLayoutProps = (scene: CrumpledScene, entry: CrumpledTimelineEntry): SceneLayoutProps => {
    const raw = (scene.layoutProps || {}) as Record<string, unknown>;
    const videoUrl = scene.videoUrl || (typeof raw.videoUrl === "string" ? raw.videoUrl : undefined);
    const frames = (inFrames: unknown, inSeconds: unknown, min: number) =>
      typeof inFrames === "number"
        ? inFrames
        : typeof inSeconds === "number" && inSeconds > 0
          ? Math.max(min, Math.round(inSeconds * FPS))
          : undefined;
    return {
      ...(raw as unknown as SceneLayoutProps),
      title: scene.title,
      narration: scene.narration,
      imageUrl: videoUrl ? undefined : scene.imageUrl || (typeof raw.imageUrl === "string" ? raw.imageUrl : undefined),
      videoUrl,
      videoMuted: scene.videoMuted ?? (typeof raw.videoMuted === "boolean" ? raw.videoMuted : true),
      videoVolume: scene.videoVolume ?? (typeof raw.videoVolume === "number" ? raw.videoVolume : 0.35),
      videoDurationInFrames: frames(scene.videoDurationInFrames, scene.videoDurationSeconds, 1),
      videoStartInFrames: frames(scene.videoStartInFrames, scene.videoStartSeconds, 0),
      accentColor: accent,
      bgColor: paper,
      textColor: ink,
      aspectRatio,
      fontFamily,
      sceneDurationInFrames: entry.durationFrames,
      paperVariant: typeof scene.id === "number" ? scene.id : undefined,
    };
  };

  return (
    <AbsoluteFill style={{ backgroundColor: CRUMPLED_DESK, fontFamily: font }}>
      {/* Every scene is "filmed" with one continuous handheld camera. */}
      <HandheldCamera>
      {scenes.map((scene, index) => {
        const entry = entries[index];
        const Layout = CRUMPLED_LAYOUT_REGISTRY[entry.layout] ?? CRUMPLED_LAYOUT_REGISTRY[CRUMPLED_FALLBACK_LAYOUT];
        return (
          <Sequence key={`seq-${scene.id}-${index}`} from={entry.start} durationInFrames={entry.durationFrames} name={scene.title}>
            <SceneDurationInFramesContext.Provider value={entry.durationFrames}>
              <Layout {...buildLayoutProps(scene, entry)} />
            </SceneDurationInFramesContext.Provider>
          </Sequence>
        );
      })}
      </HandheldCamera>

      {/* Voiceover on the same back-to-back timeline — never overlaps between scenes. */}
      {scenes.map((scene, index) =>
        scene.voiceoverUrl ? (
          <Sequence key={`audio-${scene.id}-${index}`} from={entries[index].start} durationInFrames={entries[index].durationFrames}>
            <Audio src={scene.voiceoverUrl} playbackRate={speed} />
          </Sequence>
        ) : null,
      )}
    </AbsoluteFill>
  );
};
