import { useEffect, useState } from "react";
import { AvatarOverlay } from "../../components/AvatarOverlay";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  CalculateMetadataFunction,
} from "remotion";
import "../../fonts/nightfall-defaults";
import { NIGHTFALL_LAYOUT_REGISTRY } from "./layouts";
import { resolveFontFamily } from "../../fonts/registry";
import type { NightfallLayoutType, NightfallLayoutProps } from "./types";
import { LogoOverlay } from "../../components/LogoOverlay";
import { NightfallSceneTransition } from "./NightfallSceneTransition";
import { BackgroundMusic } from "../../components/BackgroundMusic";
import { CaptionTrack } from "../../components/CaptionTrack";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
import { SceneDurationInFramesContext } from "../SceneDurationContext";

// ─── Types ───────────────────────────────────────────────────

interface SceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  /** Spoken narration text — used for captions (may differ from on-screen `narration`/displayText). */
  narrationText?: string;
  layout: NightfallLayoutType;
  layoutProps: Record<string, any>;
  durationSeconds: number;
  /** Spoken-audio length in seconds (scene duration minus trailing pad) — for caption timing. */
  speechDurationSeconds?: number;
  voiceoverFile: string | null;
  avatarVideoFile?: string | null;
  /** Per-scene avatar presentation, already resolved by the backend
   *  (scene override ?? project ?? default). See services/remotion.py. */
  avatarShape?: "circle" | "rounded" | "square";
  avatarSize?: number;
  avatarPosition?: "top_left" | "top_right" | "bottom_left" | "bottom_right";
  avatarBg?: string | null;
  avatarOpacity?: number;
  avatarFocusX?: number;
  avatarFocusY?: number;
  avatarZoom?: number;
  images: string[];
  /** Stock-footage filename in public/. Mutually exclusive with `images`. */
  video?: string;
  videoMuted?: boolean;
  videoVolume?: number;
  /** Normalised clip length; converted to frames for <Loop>. */
  videoDurationSeconds?: number;
  /** Start offset into the clip, in seconds (the adjust-modal trim). */
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
  logoSize?: number | string;
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
  /** Avatar overlay presentation (see components/AvatarOverlay.tsx). */
  avatarShape?: "circle" | "rounded" | "square";
  avatarSize?: number;
  avatarPosition?: "top_left" | "top_right" | "bottom_left" | "bottom_right";
  avatarBg?: string | null;
  avatarOpacity?: number;
  avatarFocusX?: number;
  avatarFocusY?: number;
  avatarZoom?: number;
  scenes: SceneData[];
}

interface VideoProps extends Record<string, unknown> {
  dataUrl: string;
}

// ─── Metadata ─────────────────────────────────────────────────

export const calculateNightfallMetadata: CalculateMetadataFunction<VideoProps> =
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
      const totalFrames = sceneFrames.reduce((sum, f) => sum + f, 0);

      const isPortrait = data.aspectRatio === "portrait";

      return {
        durationInFrames: Math.max(totalFrames, FPS * 5),
        fps: FPS,
        width: isPortrait ? 1080 : 1920,
        height: isPortrait ? 1920 : 1080,
      };
    } catch (e) {
      console.warn("calculateNightfallMetadata fallback:", e);
      return {
        durationInFrames: FPS * 300,
        fps: FPS,
        width: 1920,
        height: 1080,
      };
    }
  };

// ─── Composition ───────────────────────────────────────────────

export const NightfallVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then(setData)
      .catch(() => {
        setData({
          projectName: "Blog2Video Preview",
          accentColor: "#818CF8",
          bgColor: "#0A0A1A",
          textColor: "#E2E8F0",
          scenes: [
            {
              id: 1,
              order: 1,
              title: "Welcome",
              narration: "This is a preview of your Nightfall video.",
              layout: "glass_narrative",
              layoutProps: {},
              durationSeconds: 5,
              voiceoverFile: null,
              avatarVideoFile: null,
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
          backgroundColor: "#0A0A1A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#E2E8F0", fontSize: 36 }}>Loading...</p>
      </AbsoluteFill>
    );
  }

  const FPS = 30;
  const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
  let currentFrame = 0;
  const resolvedFontFamily = resolveFontFamily(data.fontFamily ?? null);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: data.bgColor || "#0A0A1A",
        fontFamily: resolvedFontFamily || undefined,
      }}
    >
      {data.scenes.map((scene, index) => {
        const durationFrames = getSceneDurationFrames(
          scene.durationSeconds,
          FPS,
          playbackSpeed,
        );
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          NIGHTFALL_LAYOUT_REGISTRY[scene.layout] ||
          NIGHTFALL_LAYOUT_REGISTRY.glass_narrative;

        const imageUrl =
          scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;
        const videoUrl = scene.video ? staticFile(scene.video) : undefined;
        const videoDurationInFrames = scene.videoDurationSeconds
          ? Math.max(1, Math.round(scene.videoDurationSeconds * FPS))
          : undefined;
        const videoStartInFrames = scene.videoStartSeconds
          ? Math.max(0, Math.round(scene.videoStartSeconds * FPS))
          : undefined;

        const rawLayoutProps = scene.layoutProps;

        // IMPORTANT: Ensure computed imageUrl wins over any stale scene.layoutProps.imageUrl
        const layoutProps: NightfallLayoutProps = {
          ...rawLayoutProps,
          title: scene.title,
          narration: scene.narration,
          accentColor: data.accentColor || "#818CF8",
          bgColor: data.bgColor || "#0A0A1A",
          textColor: data.textColor || "#E2E8F0",
          aspectRatio: data.aspectRatio || "landscape",
          imageUrl,
          videoUrl,
          videoMuted: scene.videoMuted ?? true,
          videoVolume: scene.videoVolume ?? 0.35,
          videoDurationInFrames,
          videoStartInFrames,
          imageObjectPosition: String(Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusX ?? 50)))) + "% " + String(Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusY ?? 50)))) + "%",
          imageZoom: Math.max(0.1, Number((scene.layoutProps as Record<string, unknown>)?.imageZoom ?? 1)),
          fontFamily: resolvedFontFamily || undefined,
        };

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <NightfallSceneTransition
              durationInFrames={durationFrames}
              sceneIndex={index}
              sceneCount={data.scenes.length}
              layoutType={scene.layout}
            >
              <SceneDurationInFramesContext.Provider value={durationFrames}>
                <LayoutComponent {...layoutProps} />
              </SceneDurationInFramesContext.Provider>
            </NightfallSceneTransition>

            {scene.voiceoverFile && (
              <Audio src={staticFile(scene.voiceoverFile)} playbackRate={playbackSpeed} />
            )}
            {scene.avatarVideoFile && (
              <AvatarOverlay src={staticFile(scene.avatarVideoFile)} aspectRatio={data.aspectRatio} shape={scene.avatarShape ?? data.avatarShape} size={scene.avatarSize ?? data.avatarSize} position={scene.avatarPosition ?? data.avatarPosition} bg={scene.avatarBg ?? data.avatarBg} opacity={scene.avatarOpacity ?? data.avatarOpacity} focusX={scene.avatarFocusX} focusY={scene.avatarFocusY} zoom={scene.avatarZoom} />
            )}

            {/* Captions — narration text, synced to this scene's voiceover window */}
            {data.captionsEnabled && (scene.narrationText || scene.narration) && (
              <CaptionTrack
                text={scene.narrationText || scene.narration}
                position={data.captionPosition || "bottom_center"}
                aspectRatio={data.aspectRatio || "landscape"}
                fontFamily={data.captionFontFamily ? (resolveFontFamily(data.captionFontFamily) || data.captionFontFamily) : (resolvedFontFamily || undefined)}
                fontSize={data.captionFontSize ? Number(data.captionFontSize) : undefined}
                offset={data.captionOffset ?? 0}
                speechDurationFrames={
                  scene.speechDurationSeconds
                    ? getSceneDurationFrames(scene.speechDurationSeconds, FPS, playbackSpeed)
                    : undefined
                }
              />
            )}
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

