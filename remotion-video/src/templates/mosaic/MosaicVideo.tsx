import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  CalculateMetadataFunction,
  delayRender,
  continueRender,
} from "remotion";
import { MOSAIC_LAYOUT_REGISTRY } from "./layouts";
import { resolveFontFamily } from "../../fonts/registry";
import { MOSAIC_DEFAULT_FONT_FAMILY } from "./constants";
import type { MosaicLayoutType, MosaicLayoutProps } from "./types";
import { LogoOverlay } from "../../components/LogoOverlay";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";

interface SceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: MosaicLayoutType;
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

const MosaicTransition: React.FC<{ bgColor: string }> = ({ bgColor }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ backgroundColor: bgColor, opacity, zIndex: 10 }} />;
};

export const calculateMosaicMetadata: CalculateMetadataFunction<VideoProps> =
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

export const MosaicVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);
  // delayRender tells Remotion to wait before capturing any frame.
  // Required on Linux (HuggingFace/Cloud Run) where --enable-multiprocess-on-linux
  // spawns a fresh browser process per frame — without this, frames are captured
  // before the async fetch resolves and data stays null for every frame.
  const [dataHandle] = useState(() =>
    delayRender("Loading mosaic data", { timeoutInMilliseconds: 15_000 }),
  );

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then((d: VideoData) => {
        setData(d);
        continueRender(dataHandle);
      })
      .catch(() => {
        setData({
          projectName: "Mosaic Preview",
          accentColor: "#C26240",
          bgColor: "#EAE4DA",
          textColor: "#2A2A28",
          scenes: [
            {
              id: 1,
              order: 1,
              title: "Mosaic Template",
              narration: "Stone-cut storytelling with golden guide lines.",
              layout: "mosaic_text",
              layoutProps: {},
              durationSeconds: 5,
              voiceoverFile: null,
              images: [],
            },
          ],
        });
        continueRender(dataHandle);
      });
  }, [dataUrl]);

  const resolvedFontFamily = resolveFontFamily(data?.fontFamily ?? null);

  if (!data) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#EAE4DA",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#2A2A28",
          fontFamily: resolvedFontFamily ?? MOSAIC_DEFAULT_FONT_FAMILY,
        }}
      >
        Loading...
      </AbsoluteFill>
    );
  }

  const FPS = 30;
  const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
  let currentFrame = 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: data.bgColor || "#EAE4DA",
        fontFamily: resolvedFontFamily || MOSAIC_DEFAULT_FONT_FAMILY,
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
          MOSAIC_LAYOUT_REGISTRY[scene.layout] ||
          MOSAIC_LAYOUT_REGISTRY.mosaic_text;
        const imageUrl = scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;

        const layoutProps: MosaicLayoutProps = {
          ...(scene.layoutProps as Record<string, unknown>),
          title: scene.title,
          narration: scene.narration,
          accentColor: data.accentColor || "#C26240",
          bgColor: data.bgColor || "#EAE4DA",
          textColor: data.textColor || "#2A2A28",
          aspectRatio: data.aspectRatio || "landscape",
          imageUrl,
          imageObjectPosition: String(Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusX ?? 50)))) + "% " + String(Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusY ?? 50)))) + "%",
          imageZoom: Math.max(1, Number((scene.layoutProps as Record<string, unknown>)?.imageZoom ?? 1)),
          fontFamily: resolvedFontFamily || undefined,
        };

        return (
          <Sequence key={scene.id} from={startFrame} durationInFrames={durationFrames} name={scene.title}>
            <LayoutComponent {...layoutProps} />
            {scene.voiceoverFile && (
              <Audio src={staticFile(scene.voiceoverFile)} playbackRate={playbackSpeed} />
            )}
            {index < data.scenes.length - 1 && (
              <Sequence from={Math.max(0, durationFrames - 14)} durationInFrames={14}>
                <MosaicTransition bgColor={data.bgColor || "#EAE4DA"} />
              </Sequence>
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
