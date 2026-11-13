/**
 * Crumpled Paper — render entry (remotion-video only).
 * Loads data.json, sizes the composition, and layers the project-wide overlays
 * (captions, logo, background music, talking-head avatar) over the shared
 * CrumpledVideoComposition.
 */
import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Sequence,
  continueRender,
  delayRender,
  staticFile,
} from "remotion";
import { AvatarOverlay } from "../../components/AvatarOverlay";
import { LogoOverlay } from "../../components/LogoOverlay";
import { BackgroundMusic } from "../../components/BackgroundMusic";
import { CaptionTrack } from "../../components/CaptionTrack";
import { resolveFontFamily } from "../../fonts/registry";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
import {
  CrumpledVideoComposition,
  computeCrumpledTimeline,
  type CrumpledScene,
} from "./CrumpledVideoComposition";
import { CRUMPLED_DEFAULTS } from "./crumpledStyle";

type SceneData = {
  id: number;
  order: number;
  title: string;
  narration: string;
  narrationText?: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  speechDurationSeconds?: number;
  voiceoverFile: string | null;
  avatarVideoFile?: string | null;
  avatarShape?: "circle" | "rounded" | "square";
  avatarSize?: number;
  avatarPosition?: "top_left" | "top_right" | "bottom_left" | "bottom_right";
  avatarBg?: string | null;
  avatarOpacity?: number;
  avatarShadow?: number;
  avatarFocusX?: number;
  avatarFocusY?: number;
  avatarZoom?: number;
  images?: string[];
  video?: string;
  videoMuted?: boolean;
  videoVolume?: number;
  videoDurationSeconds?: number;
  videoStartSeconds?: number;
};

type VideoData = {
  projectName: string;
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
  avatarShape?: "circle" | "rounded" | "square";
  avatarSize?: number;
  avatarPosition?: "top_left" | "top_right" | "bottom_left" | "bottom_right";
  avatarBg?: string | null;
  avatarOpacity?: number;
  avatarShadow?: number;
  scenes: SceneData[];
};

type VideoProps = Record<string, unknown> & { dataUrl: string };

const FPS = 30;

export const calculateCrumpledMetadata: CalculateMetadataFunction<VideoProps> = async ({ props }) => {
  try {
    const url = staticFile(props.dataUrl.replace(/^\//, ""));
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    const data: VideoData = await response.json();
    const portrait = data.aspectRatio === "portrait";
    return {
      durationInFrames: computeCrumpledTimeline(data.scenes, data.playbackSpeed).totalFrames,
      fps: FPS,
      width: portrait ? 1080 : 1920,
      height: portrait ? 1920 : 1080,
    };
  } catch {
    return { durationInFrames: FPS * 300, fps: FPS, width: 1920, height: 1080 };
  }
};

export const CrumpledVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);
  const [dataHandle] = useState(() => delayRender("crumpled-data"));

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to fetch ${response.url}`);
        return response.json();
      })
      .then(setData)
      .catch(() =>
        setData({
          projectName: "Crumpled Paper Preview",
          accentColor: CRUMPLED_DEFAULTS.accent,
          bgColor: CRUMPLED_DEFAULTS.bg,
          textColor: CRUMPLED_DEFAULTS.text,
          scenes: [],
        }),
      )
      .finally(() => continueRender(dataHandle));
  }, [dataHandle, dataUrl]);

  if (!data) return <AbsoluteFill style={{ backgroundColor: CRUMPLED_DEFAULTS.bg }} />;

  const speed = getPlaybackSpeed(data.playbackSpeed);
  const aspectRatio = data.aspectRatio || "landscape";
  const fontFamily = resolveFontFamily(data.fontFamily ?? null) || undefined;
  const { entries } = computeCrumpledTimeline(data.scenes, data.playbackSpeed);

  const scenes: CrumpledScene[] = data.scenes.map((scene) => {
    const raw = scene.layoutProps || {};
    const videoUrl = scene.video ? staticFile(scene.video) : undefined;
    return {
      id: scene.id,
      order: scene.order,
      title: scene.title,
      narration: scene.narration,
      layout: scene.layout,
      layoutProps: raw,
      durationSeconds: scene.durationSeconds,
      imageUrl:
        !videoUrl && scene.images?.[0]
          ? staticFile(scene.images[0])
          : !videoUrl && typeof raw.imageUrl === "string"
            ? raw.imageUrl
            : undefined,
      videoUrl,
      videoMuted: scene.videoMuted ?? true,
      videoVolume: scene.videoVolume ?? 0.35,
      videoDurationInFrames: scene.videoDurationSeconds ? Math.max(1, Math.round(scene.videoDurationSeconds * FPS)) : undefined,
      videoStartInFrames: scene.videoStartSeconds ? Math.max(0, Math.round(scene.videoStartSeconds * FPS)) : undefined,
      voiceoverUrl: scene.voiceoverFile ? staticFile(scene.voiceoverFile) : undefined,
    };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: data.bgColor || CRUMPLED_DEFAULTS.bg }}>
      <CrumpledVideoComposition
        scenes={scenes}
        accentColor={data.accentColor || CRUMPLED_DEFAULTS.accent}
        bgColor={data.bgColor || CRUMPLED_DEFAULTS.bg}
        textColor={data.textColor || CRUMPLED_DEFAULTS.text}
        aspectRatio={aspectRatio}
        fontFamily={fontFamily}
        playbackSpeed={data.playbackSpeed}
      />

      {data.scenes.map((scene, index) => {
        const entry = entries[index];
        const text = scene.narrationText || scene.narration;
        return (
          <React.Fragment key={`overlay-${scene.id}-${index}`}>
            {scene.avatarVideoFile ? (
              <Sequence from={entry.start} durationInFrames={entry.durationFrames}>
                <AvatarOverlay
                  src={staticFile(scene.avatarVideoFile)}
                  aspectRatio={aspectRatio}
                  shape={scene.avatarShape ?? data.avatarShape}
                  size={scene.avatarSize ?? data.avatarSize}
                  position={scene.avatarPosition ?? data.avatarPosition}
                  bg={scene.avatarBg ?? data.avatarBg}
                  opacity={scene.avatarOpacity ?? data.avatarOpacity}
                  shadow={scene.avatarShadow ?? data.avatarShadow}
                  focusX={scene.avatarFocusX}
                  focusY={scene.avatarFocusY}
                  zoom={scene.avatarZoom}
                />
              </Sequence>
            ) : null}
            {data.captionsEnabled && text ? (
              <Sequence from={entry.start} durationInFrames={entry.durationFrames}>
                <CaptionTrack
                  text={text}
                  position={data.captionPosition || "bottom_center"}
                  aspectRatio={aspectRatio}
                  fontFamily={
                    data.captionFontFamily
                      ? resolveFontFamily(data.captionFontFamily) || data.captionFontFamily
                      : fontFamily
                  }
                  fontSize={data.captionFontSize ? Number(data.captionFontSize) : undefined}
                  offset={data.captionOffset ?? 0}
                  speechDurationFrames={
                    scene.speechDurationSeconds ? getSceneDurationFrames(scene.speechDurationSeconds, FPS, speed) : undefined
                  }
                />
              </Sequence>
            ) : null}
          </React.Fragment>
        );
      })}

      {data.logo ? (
        <LogoOverlay
          src={staticFile(data.logo)}
          position={data.logoPosition || "bottom_right"}
          maxOpacity={data.logoOpacity ?? 0.9}
          size={data.logoSize || "default"}
          aspectRatio={aspectRatio}
        />
      ) : null}

      {data.bgmFile ? (
        <BackgroundMusic src={staticFile(data.bgmFile)} volume={data.bgmVolume ?? 0.1} scenes={data.scenes} />
      ) : null}
    </AbsoluteFill>
  );
};
