import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  CalculateMetadataFunction,
} from "remotion";
import { MOSAIC_LAYOUT_REGISTRY } from "./layouts";
import { resolveFontFamily } from "../../fonts/registry";
import { MOSAIC_DEFAULT_FONT_FAMILY } from "./constants";
import type { MosaicLayoutType, MosaicLayoutProps } from "./types";
import { LogoOverlay } from "../../components/LogoOverlay";

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
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: string;
  aspectRatio?: string;
  fontFamily?: string | null;
  scenes: SceneData[];
}

interface VideoProps extends Record<string, unknown> {
  dataUrl: string;
}

export const calculateMosaicMetadata: CalculateMetadataFunction<VideoProps> =
  async ({ props }) => {
    const FPS = 30;
    try {
      const url = staticFile(props.dataUrl.replace(/^\//, ""));
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}`);
      const data: VideoData = await res.json();

      const totalSeconds = data.scenes.reduce((sum, s) => sum + (s.durationSeconds || 5), 0);
      const totalFrames = Math.ceil(totalSeconds * FPS);
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

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then(setData)
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
      });
  }, [dataUrl]);

  const resolvedFontFamily = resolveFontFamily(data?.fontFamily ?? null);
  const FPS = 30;
  let currentFrame = 0;

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

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#EAE4DA",
        fontFamily: resolvedFontFamily || MOSAIC_DEFAULT_FONT_FAMILY,
      }}
    >
      {data.scenes.map((scene) => {
        const durationFrames = Math.max(1, Math.round((Number(scene.durationSeconds) || 5) * FPS));
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          MOSAIC_LAYOUT_REGISTRY[scene.layout] ||
          MOSAIC_LAYOUT_REGISTRY.mosaic_text;
        const imageUrl = scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;

        // Force cream/beige palette for mosaic template
        const mosaicBg = "#EAE4DA";
        const mosaicText = "#2A2A28";
        const mosaicAccent = data.accentColor || "#C26240";

        const layoutProps: MosaicLayoutProps = {
          ...(scene.layoutProps as Record<string, unknown>),
          title: scene.title,
          narration: scene.narration,
          accentColor: mosaicAccent,
          bgColor: mosaicBg,
          textColor: mosaicText,
          aspectRatio: data.aspectRatio || "landscape",
          imageUrl,
          fontFamily: resolvedFontFamily || MOSAIC_DEFAULT_FONT_FAMILY,
        };

        return (
          <Sequence key={scene.id} from={startFrame} durationInFrames={durationFrames} name={scene.title}>
            <LayoutComponent {...layoutProps} />
            {scene.voiceoverFile && <Audio src={staticFile(scene.voiceoverFile)} />}
          </Sequence>
        );
      })}

      {data.logo ? (
        <LogoOverlay
          src={staticFile(data.logo)}
          position={data.logoPosition || "bottom_right"}
          maxOpacity={data.logoOpacity ?? 0.9}
          size={data.logoSize || "default"}
          aspectRatio={data.aspectRatio || "landscape"}
        />
      ) : null}
    </AbsoluteFill>
  );
};
