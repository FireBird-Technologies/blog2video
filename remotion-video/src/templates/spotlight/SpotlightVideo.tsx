import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useVideoConfig,
  CalculateMetadataFunction,
} from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import { SPOTLIGHT_LAYOUT_REGISTRY } from "./layouts";
import { pickSpotlightTransition } from "./transitions";
import { resolveFontFamily } from "../../fonts/registry";
import type { SpotlightLayoutType, SpotlightLayoutProps } from "./types";
import { LogoOverlay } from "../../components/LogoOverlay";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";

// ─── Types ───────────────────────────────────────────────────

interface SceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: SpotlightLayoutType;
  layoutProps: Record<string, any>;
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
  scenes: SceneData[];
}

interface VideoProps extends Record<string, unknown> {
  dataUrl: string;
}

// ─── Metadata ─────────────────────────────────────────────────
// Transitions OVERLAP adjacent scenes (TransitionSeries consumes `frames` from
// the boundary), so the composition is shorter than the naive sum of scene
// durations. Subtract every transition's frame cost — keyed by index so this
// matches pickSpotlightTransition() in the render exactly.

export const calculateSpotlightMetadata: CalculateMetadataFunction<VideoProps> =
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
      let totalFrames = sceneFrames.reduce((sum, f) => sum + f, 0);
      for (let i = 0; i < data.scenes.length - 1; i++) {
        totalFrames -= pickSpotlightTransition(
          i,
          data.scenes[i].layout,
          data.scenes[i + 1].layout,
        ).frames;
      }

      const isPortrait = data.aspectRatio === "portrait";

      return {
        durationInFrames: Math.max(totalFrames, FPS * 5),
        fps: FPS,
        width: isPortrait ? 1080 : 1920,
        height: isPortrait ? 1920 : 1080,
      };
    } catch (e) {
      console.warn("calculateSpotlightMetadata fallback:", e);
      return {
        durationInFrames: FPS * 300,
        fps: FPS,
        width: 1920,
        height: 1080,
      };
    }
  };

// ─── Composition ───────────────────────────────────────────────

export const SpotlightVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);
  const { width, height } = useVideoConfig();

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then(setData)
      .catch(() => {
        setData({
          projectName: "Blog2Video Preview",
          accentColor: "#EF4444",
          bgColor: "#000000",
          textColor: "#FFFFFF",
          scenes: [
            {
              id: 1,
              order: 1,
              title: "Welcome",
              narration: "This is a preview of your Spotlight video.",
              layout: "statement",
              layoutProps: {},
              durationSeconds: 5,
              voiceoverFile: null,
              images: [],
            },
          ],
        });
      });
  }, [dataUrl]);

  if (!data) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#000000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#FFFFFF", fontSize: 36 }}>Loading...</p>
      </AbsoluteFill>
    );
  }

  const FPS = 30;
  const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
  const resolvedFontFamily = resolveFontFamily(data.fontFamily ?? null);

  const sceneFrames = data.scenes.map((s) =>
    getSceneDurationFrames(s.durationSeconds, FPS, playbackSpeed),
  );

  // Scene start frames accounting for transition overlap (for audio sync).
  const sceneStartFrames: number[] = [];
  let runningFrame = 0;
  data.scenes.forEach((_, i) => {
    sceneStartFrames[i] = runningFrame;
    runningFrame += sceneFrames[i];
    if (i < data.scenes.length - 1) {
      runningFrame -= pickSpotlightTransition(
        i,
        data.scenes[i].layout,
        data.scenes[i + 1].layout,
        width,
        height,
      ).frames;
    }
  });

  const buildLayoutProps = (scene: SceneData): SpotlightLayoutProps => {
    const imageUrl =
      scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;
    return {
      ...scene.layoutProps,
      title: scene.title,
      narration: scene.narration,
      accentColor: data.accentColor || "#EF4444",
      bgColor: data.bgColor || "#000000",
      textColor: data.textColor || "#FFFFFF",
      aspectRatio: data.aspectRatio || "landscape",
      imageUrl,
      imageObjectPosition:
        String(Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusX ?? 50)))) +
        "% " +
        String(Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusY ?? 50)))) +
        "%",
      imageZoom: Math.max(0.1, Number((scene.layoutProps as Record<string, unknown>)?.imageZoom ?? 1)),
      fontFamily: resolvedFontFamily || undefined,
    };
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: data.bgColor || "#000000",
        fontFamily: resolvedFontFamily || undefined,
      }}
    >
      <TransitionSeries>
        {data.scenes.map((scene, index) => {
          const LayoutComponent =
            SPOTLIGHT_LAYOUT_REGISTRY[scene.layout] ||
            SPOTLIGHT_LAYOUT_REGISTRY.statement;

          const sequence = (
            <TransitionSeries.Sequence
              key={`seq-${scene.id}-${index}`}
              durationInFrames={sceneFrames[index]}
            >
              <LayoutComponent {...buildLayoutProps(scene)} />
            </TransitionSeries.Sequence>
          );

          if (index === data.scenes.length - 1) return sequence;

          const choice = pickSpotlightTransition(
            index,
            scene.layout,
            data.scenes[index + 1].layout,
            width,
            height,
          );
          return (
            <React.Fragment key={`scene-${scene.id}-${index}`}>
              {sequence}
              <TransitionSeries.Transition
                presentation={choice.presentation}
                timing={choice.timing}
              />
            </React.Fragment>
          );
        })}
      </TransitionSeries>

      {/* Audio runs on its own overlap-adjusted timeline. */}
      {data.scenes.map((scene, index) =>
        scene.voiceoverFile ? (
          <Sequence
            key={`audio-${scene.id}-${index}`}
            from={sceneStartFrames[index]}
            durationInFrames={sceneFrames[index]}
          >
            <Audio src={staticFile(scene.voiceoverFile)} playbackRate={playbackSpeed} />
          </Sequence>
        ) : null,
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
    </AbsoluteFill>
  );
};

