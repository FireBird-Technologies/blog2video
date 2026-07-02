import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  CalculateMetadataFunction,
} from "remotion";
import { SAKURA_LAYOUT_REGISTRY as LAYOUT_REGISTRY, SakuraLayoutType, SceneLayoutProps } from "./layouts";
import { resolveFontFamily } from "../../fonts/registry";
import { LogoOverlay } from "../../components/LogoOverlay";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";

interface SceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: SakuraLayoutType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  logoSize?: string;
  aspectRatio?: string;
  playbackSpeed?: number;
  fontFamily?: string | null;
  scenes: SceneData[];
}

interface VideoProps extends Record<string, unknown> {
  dataUrl: string;
}

export const calculateSakuraMetadata: CalculateMetadataFunction<VideoProps> =
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
      const totalFrames = sceneFrames.reduce((a, b) => a + b, 0);
      const isPortrait = data.aspectRatio === "portrait";
      return {
        durationInFrames: Math.max(totalFrames, FPS * 5),
        fps: FPS,
        width: isPortrait ? 1080 : 1920,
        height: isPortrait ? 1920 : 1080,
      };
    } catch {
      return { durationInFrames: FPS * 300, fps: FPS, width: 1920, height: 1080 };
    }
  };

export const SakuraVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then(setData)
      .catch(() => {
        setData({
          projectName: "Preview",
          accentColor: "#C0143C",
          bgColor: "#FDF6F0",
          textColor: "#2A0A12",
          scenes: [],
        });
      });
  }, [dataUrl]);

  if (!data) {
    return (
      <AbsoluteFill style={{ backgroundColor: "#FDF6F0" }}>
        <p style={{ color: "#2A0A12", fontSize: 36, margin: "auto" }}>Loading...</p>
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
        backgroundColor: data.bgColor || "#FDF6F0",
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
          LAYOUT_REGISTRY[scene.layout] || LAYOUT_REGISTRY.sakura_section;

        const imageUrl =
          scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;

        const focusX = Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusX ?? 50)));
        const focusY = Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusY ?? 50)));

        const layoutProps: SceneLayoutProps = {
          ...(scene.layoutProps as Record<string, unknown>),
          title: scene.title,
          narration: scene.narration,
          accentColor: data.accentColor || "#C0143C",
          bgColor: data.bgColor || "#FDF6F0",
          textColor: data.textColor || "#2A0A12",
          aspectRatio: data.aspectRatio || "landscape",
          sceneDurationInFrames: durationFrames,
          imageUrl,
          imageObjectPosition: `${focusX}% ${focusY}%`,
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
