import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  CalculateMetadataFunction,
  continueRender,
  delayRender,
} from "remotion";
import { BLOOMBERG_LAYOUT_REGISTRY } from "./layouts";
import type { BloombergLayoutProps, BloombergLayoutType } from "./types";
import { resolveFontFamily } from "../../fonts/registry";
import { LogoOverlay } from "../../components/LogoOverlay";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";

interface SceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: BloombergLayoutType;
  layoutProps: Record<string, any>;
  durationSeconds: number;
  voiceoverFile: string | null;
  images: string[];
}

interface VideoData {
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
  scenes: SceneData[];
}

interface VideoProps extends Record<string, unknown> {
  dataUrl: string;
}

export const calculateBloombergMetadata: CalculateMetadataFunction<VideoProps> =
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
    } catch {
      return {
        durationInFrames: FPS * 300,
        fps: FPS,
        width: 1920,
        height: 1080,
      };
    }
  };

const BLOOMBERG_PREVIEW_FALLBACK: VideoData = {
  projectName: "Bloomberg Terminal Preview",
  accentColor: "#5EA2FF",
  bgColor: "#000000",
  textColor: "#FFB340",
  scenes: [
    {
      id: 1,
      order: 1,
      title: "MBN> System Ready",
      narration: "Bloomberg terminal session initialized.",
      layout: "terminal_boot",
      layoutProps: {},
      durationSeconds: 5,
      voiceoverFile: null,
      images: [],
    },
  ],
};

export const BloombergVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);

  useEffect(() => {
    const handle = delayRender("bloomberg-video-data");
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      continueRender(handle);
    };

    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then((json) => {
        setData(json as VideoData);
      })
      .catch(() => {
        setData(BLOOMBERG_PREVIEW_FALLBACK);
      })
      .finally(done);

    return () => {
      done();
    };
  }, [dataUrl]);

  const resolvedFontFamily = resolveFontFamily(data?.fontFamily ?? null);

  if (!data) {
    return <AbsoluteFill style={{ backgroundColor: "#000000" }} />;
  }

  const FPS = 30;
  const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
  let currentFrame = 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: data.bgColor || "#000000",
        fontFamily: resolvedFontFamily || undefined,
      }}
    >
      {data.scenes.map((scene) => {
        const durationFrames = getSceneDurationFrames(
          scene.durationSeconds,
          FPS,
          playbackSpeed,
        );
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          BLOOMBERG_LAYOUT_REGISTRY[scene.layout] ??
          BLOOMBERG_LAYOUT_REGISTRY.terminal_narrative;

        const imageUrl =
          scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;

        const layoutProps: BloombergLayoutProps = {
          ...scene.layoutProps,
          title: scene.title,
          narration: scene.narration,
          accentColor: data.accentColor || "#5EA2FF",
          bgColor: data.bgColor || "#000000",
          textColor: data.textColor || "#FFB340",
          aspectRatio: data.aspectRatio || "landscape",
          imageUrl,
          layoutType: scene.layout,
          fontFamily: resolvedFontFamily || undefined,
        };

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <LayoutComponent {...layoutProps} />
            {scene.voiceoverFile && (
              <Audio src={staticFile(scene.voiceoverFile)} playbackRate={playbackSpeed} />
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
    </AbsoluteFill>
  );
};
