/**
 * Snowy Christmas — shared composition (render + browser preview).
 *
 * Scenes play back to back on a plain timeline (the sum of scene durations, so the
 * shared linear schedule in the frontend is already correct). Each layout owns its
 * exit — a snow gust whiteout, a sleigh swoop, a folding letter — inside its own
 * file, played in the scene's last frames, so a scene looks the same in the full
 * video and when it is played on its own.
 *
 * Mirror byte-identical in all three trees:
 *   remotion-video/src/templates/christmas/
 *   frontend/src/components/remotion/christmas/
 *   frontend-pdf2video/src/components/remotion/christmas/
 * The render entry (ChristmasVideo.tsx) and the preview wrapper
 * (ChristmasPreviewComposition.tsx) add logo / captions / music / avatar.
 */
import React from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender } from "remotion";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
import { SceneDurationInFramesContext } from "../SceneDurationContext";
import { CHRISTMAS_LAYOUT_REGISTRY } from "./layouts";
import type { SceneLayoutProps } from "./types";
import { CHRISTMAS_DEFAULTS, FESTIVE } from "./christmasStyle";
import { CHRISTMAS_BODY_FONT } from "./typography";
import { SceneLookContext, computeSceneLooks } from "./components/SceneLook";

export type ChristmasScene = {
  id: number;
  order: number;
  title: string;
  narration: string;
  /**
   * The scene's own Display text (DB `display_text`), unmixed with the voiceover.
   * Callers that only carry one text (Template Studio, demo players) omit it, and
   * `narration` is used instead.
   */
  displayText?: string;
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

export type ChristmasCompositionProps = {
  scenes: ChristmasScene[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  fontFamily?: string;
  playbackSpeed?: number;
};

const FPS = 30;
export const CHRISTMAS_HERO_LAYOUT = "santa_hero";
export const CHRISTMAS_FALLBACK_LAYOUT = "snowy_narration";

const resolveLayout = (layout: string): string =>
  layout in CHRISTMAS_LAYOUT_REGISTRY ? layout : CHRISTMAS_FALLBACK_LAYOUT;

const filled = (list: unknown, legacy: unknown): boolean =>
  (Array.isArray(list) && list.some((x) => String(x ?? "").trim())) || Boolean(String(legacy ?? "").trim());

/** The layout a scene is drawn with. A comparison saved without points on a side would
 *  be an empty divider, so it shows its title + text on the fallback layout instead. */
const resolveSceneLayout = (scene: { layout: string; layoutProps?: Record<string, unknown> }): string => {
  const layout = resolveLayout(String(scene.layout));
  if (layout !== "snow_compare" || !scene.layoutProps) return layout;
  const { leftPoints, leftText, rightPoints, rightText } = scene.layoutProps;
  return filled(leftPoints, leftText) && filled(rightPoints, rightText) ? layout : CHRISTMAS_FALLBACK_LAYOUT;
};

/** Hold the first frame until both faces (every weight the layouts use) are ready. */
const useChristmasFontsLoaded = (): void => {
  const [handle] = React.useState(() => delayRender("christmas-fonts"));
  React.useEffect(() => {
    const fontsApi = (typeof document !== "undefined" ? document.fonts : undefined) as FontFaceSet | undefined;
    if (!fontsApi) {
      continueRender(handle);
      return;
    }
    const load = (spec: string) => fontsApi.load(spec).catch(() => undefined);
    Promise.all([
      load('400 40px "Berkshire Swash"'),
      load('400 40px "Nunito"'),
      load('600 40px "Nunito"'),
      load('800 40px "Nunito"'),
    ])
      .then(() => fontsApi.ready)
      .catch(() => undefined)
      .finally(() => continueRender(handle));
  }, [handle]);
};

export interface ChristmasTimelineEntry {
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
export const computeChristmasTimeline = (
  scenes: Array<Pick<ChristmasScene, "layout" | "durationSeconds"> & Partial<Pick<ChristmasScene, "layoutProps">>>,
  playbackSpeed?: number,
): { entries: ChristmasTimelineEntry[]; totalFrames: number } => {
  const speed = getPlaybackSpeed(playbackSpeed);
  const entries: ChristmasTimelineEntry[] = [];
  let start = 0;
  scenes.forEach((s) => {
    const durationFrames = getSceneDurationFrames(Number(s.durationSeconds) || 5, FPS, speed);
    entries.push({ layout: resolveSceneLayout(s), start, durationFrames });
    start += durationFrames;
  });
  return { entries, totalFrames: Math.max(start, FPS * 5) };
};

export const computeChristmasVideoTotalFrames = (
  scenes: Array<Pick<ChristmasScene, "layout" | "durationSeconds"> & Partial<Pick<ChristmasScene, "layoutProps">>>,
  playbackSpeed?: number,
): number => computeChristmasTimeline(scenes, playbackSpeed).totalFrames;

export const ChristmasVideoComposition: React.FC<ChristmasCompositionProps> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  fontFamily,
  playbackSpeed,
}) => {
  useChristmasFontsLoaded();
  const paper = bgColor || CHRISTMAS_DEFAULTS.bg;
  const ink = textColor || CHRISTMAS_DEFAULTS.text;
  const accent = accentColor || CHRISTMAS_DEFAULTS.accent;
  const speed = getPlaybackSpeed(playbackSpeed);
  const { entries } = computeChristmasTimeline(scenes, playbackSpeed);
  const font = fontFamily?.trim() || CHRISTMAS_BODY_FONT;

  const buildLayoutProps = (scene: ChristmasScene, entry: ChristmasTimelineEntry): SceneLayoutProps => {
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
      displayText: scene.displayText ?? scene.narration ?? "",
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
      sceneVariant: typeof scene.id === "number" ? scene.id : undefined,
    };
  };

  // Each scene gets its own snow + pine look; neighbours never repeat.
  const looks = computeSceneLooks(entries.map((e) => e.layout));

  return (
    <AbsoluteFill style={{ backgroundColor: FESTIVE.snow, fontFamily: font }}>
      {scenes.map((scene, index) => {
        const entry = entries[index];
        const Layout = CHRISTMAS_LAYOUT_REGISTRY[entry.layout] ?? CHRISTMAS_LAYOUT_REGISTRY[CHRISTMAS_FALLBACK_LAYOUT];
        return (
          <Sequence key={`seq-${scene.id}-${index}`} from={entry.start} durationInFrames={entry.durationFrames} name={scene.title}>
            <SceneDurationInFramesContext.Provider value={entry.durationFrames}>
              <SceneLookContext.Provider value={looks[index]}>
                <Layout {...buildLayoutProps(scene, entry)} />
              </SceneLookContext.Provider>
            </SceneDurationInFramesContext.Provider>
          </Sequence>
        );
      })}

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
