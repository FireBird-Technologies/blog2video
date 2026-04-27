import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  CalculateMetadataFunction,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import type { TransitionPresentation } from "@remotion/transitions";
import { flip } from "@remotion/transitions/flip";
import "../../fonts/chronicle-defaults";
import { CHRONICLE_BODY_FONT } from "../../fonts/chronicle-defaults";
import { CHRONICLE_LAYOUT_REGISTRY } from "./layouts";
import { resolveFontFamily } from "../../fonts/registry";
import type { ChronicleLayoutType, ChronicleLayoutProps } from "./types";
import { LogoOverlay } from "../../components/LogoOverlay";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
import { ChronicleChrome } from "./components/ChronicleChrome";
import { pageCurl } from "./transitions/pageCurl";

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
  logoSize?: string;
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

const HERO_LAYOUTS_FROM = new Set<ChronicleLayoutType>(["book_open"]);
const HERO_LAYOUTS_TO = new Set<ChronicleLayoutType>(["ending_socials"]);

const TRANSITION_FRAMES_FLIP = 22;
const TRANSITION_FRAMES_CURL = 32;

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
    const sceneFrames = data.scenes.map((s) =>
      getSceneDurationFrames(s.durationSeconds, FPS, playbackSpeed),
    );
    let totalFrames = sceneFrames.reduce((sum, f) => sum + f, 0);
    // Subtract overlap of each transition between adjacent scenes.
    for (let i = 0; i < data.scenes.length - 1; i++) {
      const fromLayout = (data.scenes[i].layout as ChronicleLayoutType);
      const toLayout = (data.scenes[i + 1].layout as ChronicleLayoutType);
      const isHero =
        HERO_LAYOUTS_FROM.has(fromLayout) || HERO_LAYOUTS_TO.has(toLayout);
      totalFrames -= isHero ? TRANSITION_FRAMES_CURL : TRANSITION_FRAMES_FLIP;
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

  const resolvedScenes = data.scenes.map((scene) => {
    const layoutKey = (scene.layout as ChronicleLayoutType) in CHRONICLE_LAYOUT_REGISTRY
      ? (scene.layout as ChronicleLayoutType)
      : ("parchment_scroll" as ChronicleLayoutType);
    const durationFrames = getSceneDurationFrames(
      scene.durationSeconds,
      FPS,
      playbackSpeed,
    );
    return { scene, layoutKey, durationFrames };
  });

  // Compute scene start frames accounting for transition overlap (for audio sync).
  let runningFrame = 0;
  const sceneStartFrames: number[] = [];
  resolvedScenes.forEach((s, i) => {
    sceneStartFrames[i] = runningFrame;
    runningFrame += s.durationFrames;
    if (i < resolvedScenes.length - 1) {
      const nextLayout = resolvedScenes[i + 1].layoutKey;
      const isHero =
        HERO_LAYOUTS_FROM.has(s.layoutKey) || HERO_LAYOUTS_TO.has(nextLayout);
      runningFrame -= isHero ? TRANSITION_FRAMES_CURL : TRANSITION_FRAMES_FLIP;
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
          const { scene, layoutKey, durationFrames } = s;
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
            imageZoom: Math.max(1, Number(rawProps.imageZoom ?? 1)),
            fontFamily: resolvedFontFamily || undefined,
          };

          const skipFade = LAYOUTS_WITHOUT_CHROME_FADE.has(layoutKey);
          const showScripture = SCRIPTURE_LAYOUTS.has(layoutKey);

          const sequence = (
            <TransitionSeries.Sequence
              key={`seq-${scene.id}-${index}`}
              durationInFrames={durationFrames}
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
          const isHero =
            HERO_LAYOUTS_FROM.has(layoutKey) || HERO_LAYOUTS_TO.has(nextLayout);
          const transitionFrames = isHero
            ? TRANSITION_FRAMES_CURL
            : TRANSITION_FRAMES_FLIP;

          return (
            <React.Fragment key={`scene-${scene.id}-${index}`}>
              {sequence}
              <TransitionSeries.Transition
                presentation={
                  (isHero
                    ? pageCurl({ direction: "right-to-left", perspective: 2200 })
                    : flip({ direction: "from-right", perspective: 1600 })) as TransitionPresentation<Record<string, unknown>>
                }
                timing={linearTiming({ durationInFrames: transitionFrames })}
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
