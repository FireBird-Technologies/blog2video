import React, {useEffect, useState} from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  continueRender,
  delayRender,
  staticFile,
} from "remotion";
import {resolveFontFamily} from "../../fonts/registry";
import {getPlaybackSpeed, getSceneDurationFrames} from "../playbackSpeed";
import {
  StarlitVideoComposition,
  type StarlitScene,
} from "./StarlitVideoComposition";

type SceneData = {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  voiceoverFile: string | null;
  images?: string[];
  /** Stock-footage filename in public/. Mutually exclusive with `images`. */
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
  aspectRatio?: string;
  playbackSpeed?: number;
  fontFamily?: string | null;
  scenes: SceneData[];
};

type VideoProps = Record<string, unknown> & {dataUrl: string};

const FPS = 30;

export const calculateStarlitMetadata: CalculateMetadataFunction<VideoProps> =
  async ({props}) => {
    try {
      const url = staticFile(props.dataUrl.replace(/^\//, ""));
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch ${url}`);
      const data: VideoData = await response.json();
      const speed = getPlaybackSpeed(data.playbackSpeed);
      const totalFrames = data.scenes
        .map((scene) => getSceneDurationFrames(scene.durationSeconds, FPS, speed))
        .reduce((sum, frames) => sum + frames, 0);
      const portrait = data.aspectRatio === "portrait";
      return {
        durationInFrames: Math.max(totalFrames, FPS * 5),
        fps: FPS,
        width: portrait ? 1080 : 1920,
        height: portrait ? 1920 : 1080,
      };
    } catch {
      return {durationInFrames: FPS * 300, fps: FPS, width: 1920, height: 1080};
    }
  };

export const StarlitVideo: React.FC<VideoProps> = ({dataUrl}) => {
  const [data, setData] = useState<VideoData | null>(null);
  const [dataHandle] = useState(() => delayRender("starlit-data"));

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to fetch ${response.url}`);
        return response.json();
      })
      .then(setData)
      .catch(() => {
        setData({
          projectName: "Starlit Preview",
          accentColor: "#217cff",
          bgColor: "#000000",
          textColor: "#ffffff",
          scenes: [],
        });
      })
      .finally(() => continueRender(dataHandle));
  }, [dataHandle, dataUrl]);

  if (!data) return <AbsoluteFill style={{backgroundColor: "#000000"}} />;

  const scenes: StarlitScene[] = data.scenes.map((scene) => {
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
      imageUrl: !videoUrl && scene.images?.[0]
        ? staticFile(scene.images[0])
        : !videoUrl && typeof raw.imageUrl === "string"
          ? raw.imageUrl
          : undefined,
      videoUrl,
      videoMuted: scene.videoMuted ?? true,
      videoVolume: scene.videoVolume ?? 0.35,
      videoDurationInFrames: scene.videoDurationSeconds
        ? Math.max(1, Math.round(scene.videoDurationSeconds * FPS))
        : undefined,
      videoStartInFrames: scene.videoStartSeconds
        ? Math.max(0, Math.round(scene.videoStartSeconds * FPS))
        : undefined,
      voiceoverUrl: scene.voiceoverFile ? staticFile(scene.voiceoverFile) : undefined,
    };
  });

  return (
    <StarlitVideoComposition
      scenes={scenes}
      accentColor={data.accentColor || "#217cff"}
      bgColor={data.bgColor || "#000000"}
      textColor={data.textColor || "#ffffff"}
      aspectRatio={data.aspectRatio || "landscape"}
      fontFamily={resolveFontFamily(data.fontFamily ?? null) || undefined}
      playbackSpeed={data.playbackSpeed}
    />
  );
};
