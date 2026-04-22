import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  CalculateMetadataFunction,
} from "remotion";
import "../../fonts/chronicle-defaults";
import { CHRONICLE_BODY_FONT } from "../../fonts/chronicle-defaults";
import { CHRONICLE_LAYOUT_REGISTRY } from "./layouts";
import { resolveFontFamily } from "../../fonts/registry";
import type { ChronicleLayoutType, ChronicleLayoutProps } from "./types";
import { LogoOverlay } from "../../components/LogoOverlay";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
import { ChronicleChrome } from "./components/ChronicleChrome";

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

// book_open owns its own dramatic opening animation and doesn't need the
// chrome's fade-in on top of it; every other layout gets the subtle fade.
const LAYOUTS_WITHOUT_CHROME_FADE = new Set<ChronicleLayoutType>(["book_open"]);

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
  let currentFrame = 0;
  const resolvedFontFamily = resolveFontFamily(data.fontFamily ?? null);
  const fallbackFontFamily = resolvedFontFamily || CHRONICLE_BODY_FONT;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: data.bgColor || "#F1E4C9",
        fontFamily: fallbackFontFamily,
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

        const layoutKey = (scene.layout as ChronicleLayoutType) in CHRONICLE_LAYOUT_REGISTRY
          ? (scene.layout as ChronicleLayoutType)
          : "parchment_scroll";
        const LayoutComponent = CHRONICLE_LAYOUT_REGISTRY[layoutKey];
        const imageUrl = scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;

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

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <ChronicleChrome
              bgColor={data.bgColor || "#F1E4C9"}
              accentColor={data.accentColor || "#B8860B"}
              textColor={data.textColor || "#2A1810"}
              disablePageTurn={skipFade}
            >
              <LayoutComponent {...layoutProps} />
            </ChronicleChrome>
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
