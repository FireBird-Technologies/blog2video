import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  CalculateMetadataFunction,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { WHITEBOARD_LAYOUT_REGISTRY } from "./layouts";
import type { WhiteboardLayoutType, WhiteboardLayoutProps } from "./types";
import { LogoOverlay } from "../../components/LogoOverlay";

interface SceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: WhiteboardLayoutType;
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
  aspectRatio?: string;
  scenes: SceneData[];
}

interface VideoProps {
  dataUrl: string;
}

const WhiteboardTransition: React.FC<{ bgColor: string }> = ({ bgColor }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ backgroundColor: bgColor, opacity: op, zIndex: 10 }} />;
};

export const calculateWhiteboardMetadata: CalculateMetadataFunction<VideoProps> =
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

export const WhiteboardVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then(setData)
      .catch(() => {
        setData({
          projectName: "Whiteboard Preview",
          accentColor: "#1F2937",
          bgColor: "#F7F3E8",
          textColor: "#111827",
          scenes: [
            {
              id: 1,
              order: 1,
              title: "A Story Begins",
              narration: "Every big shift starts with one clear moment.",
              layout: "drawn_title",
              layoutProps: {},
              durationSeconds: 5,
              voiceoverFile: null,
              images: [],
            },
          ],
        });
      });
  }, [dataUrl]);

  if (!data) return <AbsoluteFill style={{ backgroundColor: "#F7F3E8" }} />;

  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: data.bgColor || "#F7F3E8" }}>
      {data.scenes.map((scene, index) => {
        const durationFrames = Math.max(1, Math.round((Number(scene.durationSeconds) || 5) * FPS));
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          WHITEBOARD_LAYOUT_REGISTRY[scene.layout] || WHITEBOARD_LAYOUT_REGISTRY.marker_story;
        const imageUrl = scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;

        const layoutProps: WhiteboardLayoutProps = {
          ...scene.layoutProps,
          title: scene.title,
          narration: scene.narration,
          accentColor: data.accentColor || "#1F2937",
          bgColor: data.bgColor || "#F7F3E8",
          textColor: data.textColor || "#111827",
          aspectRatio: data.aspectRatio || "landscape",
          imageUrl,
        };

        return (
          <Sequence key={scene.id} from={startFrame} durationInFrames={durationFrames} name={scene.title}>
            <LayoutComponent {...layoutProps} />
            {scene.voiceoverFile && <Audio src={staticFile(scene.voiceoverFile)} />}
            {index < data.scenes.length - 1 && (
              <Sequence from={Math.max(0, durationFrames - 14)} durationInFrames={14}>
                <WhiteboardTransition bgColor={data.bgColor || "#F7F3E8"} />
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
          aspectRatio={data.aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};
