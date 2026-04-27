import React from "react";
import "../../../fonts/chronicle-defaults";
import { CHRONICLE_BODY_FONT } from "../../../fonts/chronicle-defaults";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import type { TransitionPresentation } from "@remotion/transitions";
import { flip } from "@remotion/transitions/flip";
import { CHRONICLE_LAYOUT_REGISTRY } from "./layouts";
import type { ChronicleLayoutType, ChronicleLayoutProps } from "./types";
import { LogoOverlay } from "../LogoOverlay";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
import { ChronicleChrome } from "./components/ChronicleChrome";
import { pageCurl } from "./transitions/pageCurl";

export interface ChronicleSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface ChronicleVideoCompositionProps {
  scenes: ChronicleSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
  playbackSpeed?: number;
}

// book_open owns its own dramatic opening animation; every other layout
// just gets a subtle chrome fade-in.
const LAYOUTS_WITHOUT_CHROME_FADE = new Set<ChronicleLayoutType>(["book_open"]);

// These layouts get the illuminated-manuscript scripture overlay in addition
// to the always-on parchment.
const SCRIPTURE_LAYOUTS = new Set<ChronicleLayoutType>([
  "book_open",
  "illuminated_quote",
  "parchment_scroll",
  "decree_seal",
]);

// Hero boundaries get the dramatic page-curl; everything else gets flip.
const HERO_LAYOUTS_FROM = new Set<ChronicleLayoutType>(["book_open"]);
const HERO_LAYOUTS_TO = new Set<ChronicleLayoutType>(["ending_socials"]);

const TRANSITION_FRAMES_FLIP = 22;
const TRANSITION_FRAMES_CURL = 32;

export const ChronicleVideoComposition: React.FC<ChronicleVideoCompositionProps> = ({
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
  playbackSpeed,
}) => {
  const FPS = 30;
  const resolvedPlaybackSpeed = getPlaybackSpeed(playbackSpeed);
  const fallbackFontFamily = fontFamily || CHRONICLE_BODY_FONT;

  const resolvedScenes = scenes.map((scene) => {
    const layoutKey = (scene.layout as ChronicleLayoutType) in CHRONICLE_LAYOUT_REGISTRY
      ? (scene.layout as ChronicleLayoutType)
      : ("parchment_scroll" as ChronicleLayoutType);
    const durationFrames = getSceneDurationFrames(
      scene.durationSeconds,
      FPS,
      resolvedPlaybackSpeed,
    );
    return { scene, layoutKey, durationFrames };
  });

  // Compute scene start frames so we can position voiceover audio absolutely.
  let runningFrame = 0;
  const sceneStartFrames: number[] = [];
  resolvedScenes.forEach((s, i) => {
    sceneStartFrames[i] = runningFrame;
    runningFrame += s.durationFrames;
    // Each transition overlaps both scenes by `frames`, so the next scene starts
    // `frames` earlier than the naive sum. TransitionSeries handles this internally
    // for layout, but we still need it for matching audio Sequence positions.
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
        backgroundColor: bgColor || "#F1E4C9",
        fontFamily: fallbackFontFamily,
      }}
    >
      <TransitionSeries>
        {resolvedScenes.map((s, index) => {
          const { scene, layoutKey, durationFrames } = s;
          const LayoutComponent = CHRONICLE_LAYOUT_REGISTRY[layoutKey];

          const rawProps = (scene.layoutProps ?? {}) as Record<string, unknown>;
          const focusX = Math.max(0, Math.min(100, Number(rawProps.imageFocusX ?? 50)));
          const focusY = Math.max(0, Math.min(100, Number(rawProps.imageFocusY ?? 50)));

          const layoutProps: ChronicleLayoutProps = {
            ...(rawProps as Partial<ChronicleLayoutProps>),
            title: scene.title,
            narration: scene.narration,
            imageUrl: scene.imageUrl,
            imageObjectPosition: `${focusX}% ${focusY}%`,
            imageZoom: Math.max(1, Number(rawProps.imageZoom ?? 1)),
            accentColor: accentColor || "#B8860B",
            bgColor: bgColor || "#F1E4C9",
            textColor: textColor || "#2A1810",
            aspectRatio: (aspectRatio as "landscape" | "portrait") || "landscape",
            fontFamily,
          };

          const skipFade = LAYOUTS_WITHOUT_CHROME_FADE.has(layoutKey);
          const showScripture = SCRIPTURE_LAYOUTS.has(layoutKey);

          const sequence = (
            <TransitionSeries.Sequence
              key={`seq-${scene.id}-${index}`}
              durationInFrames={durationFrames}
            >
              <ChronicleChrome
                bgColor={bgColor || "#F1E4C9"}
                accentColor={accentColor || "#B8860B"}
                textColor={textColor || "#2A1810"}
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

      {/* Voiceover audio — positioned absolutely so it stays in sync regardless of transition overlap. */}
      {resolvedScenes.map((s, index) => {
        if (!s.scene.voiceoverUrl) return null;
        return (
          <Sequence
            key={`audio-${s.scene.id}-${index}`}
            from={sceneStartFrames[index]}
            durationInFrames={s.durationFrames}
          >
            <Audio src={s.scene.voiceoverUrl} playbackRate={resolvedPlaybackSpeed} />
          </Sequence>
        );
      })}

      {logo && (
        <LogoOverlay
          src={logo}
          position={logoPosition || "bottom_right"}
          maxOpacity={logoOpacity ?? 0.9}
          size={logoSize ?? 100}
          aspectRatio={aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};
