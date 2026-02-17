import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  CalculateMetadataFunction,
} from "remotion";
import { GRIDCRAFT_LAYOUT_REGISTRY } from "./layouts";
import type { GridcraftLayoutType, GridcraftLayoutProps } from "./types";
import { LogoOverlay } from "../../components/LogoOverlay";

// ─── Types ───────────────────────────────────────────────────

interface SceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: GridcraftLayoutType;
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
  aspectRatio?: string;
  scenes: SceneData[];
}

interface VideoProps {
  dataUrl: string;
}

// Clean white transition for gridcraft (matches light bg)
const GridcraftTransition: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FAFAFA",
        opacity: progress,
      }}
    />
  );
};

// ─── Metadata ─────────────────────────────────────────────────

export const calculateGridcraftMetadata: CalculateMetadataFunction<VideoProps> =
  async ({ props }) => {
    const FPS = 30;
    try {
      const url = staticFile(props.dataUrl.replace(/^\//, ""));
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}`);
      const data: VideoData = await res.json();

      const totalSeconds = data.scenes.reduce(
        (sum, s) => sum + (s.durationSeconds || 5),
        0
      );
      const totalFrames = Math.ceil((totalSeconds + 2) * FPS);

      const isPortrait = data.aspectRatio === "portrait";

      return {
        durationInFrames: Math.max(totalFrames, FPS * 5),
        fps: FPS,
        width: isPortrait ? 1080 : 1920,
        height: isPortrait ? 1920 : 1080,
      };
    } catch (e) {
      console.warn("calculateGridcraftMetadata fallback:", e);
      return {
        durationInFrames: FPS * 300,
        fps: FPS,
        width: 1920,
        height: 1080,
      };
    }
  };

// ─── Composition ───────────────────────────────────────────────

export const GridcraftVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then(setData)
      .catch(() => {
        setData({
          projectName: "Blog2Video Preview",
          accentColor: "#F97316",
          bgColor: "#FAFAFA",
          textColor: "#171717",
          scenes: [
            {
              id: 1,
              order: 1,
              title: "Welcome",
              narration: "This is a preview of your Gridcraft video.",
              layout: "editorial_body",
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
          backgroundColor: "#FAFAFA",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#171717", fontSize: 36 }}>Loading...</p>
      </AbsoluteFill>
    );
  }

  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: data.bgColor || "#FAFAFA" }}>
      {data.scenes.map((scene, index) => {
        const durationFrames = Math.round(scene.durationSeconds * FPS);
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          GRIDCRAFT_LAYOUT_REGISTRY[scene.layout] ||
          GRIDCRAFT_LAYOUT_REGISTRY.editorial_body;

        const imageUrl =
          scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;

        const layoutProps: GridcraftLayoutProps = {
          title: scene.title,
          narration: scene.narration,
          imageUrl,
          accentColor: data.accentColor || "#F97316",
          bgColor: data.bgColor || "#FAFAFA",
          textColor: data.textColor || "#171717",
          aspectRatio: data.aspectRatio || "landscape",
          ...scene.layoutProps,
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
              <Audio src={staticFile(scene.voiceoverFile)} />
            )}

            {index < data.scenes.length - 1 && (
              <Sequence from={durationFrames - 15} durationInFrames={15}>
                <GridcraftTransition />
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
