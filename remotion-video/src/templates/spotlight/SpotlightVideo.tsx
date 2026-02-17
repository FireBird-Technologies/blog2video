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
import { SPOTLIGHT_LAYOUT_REGISTRY } from "./layouts";
import type { SpotlightLayoutType, SpotlightLayoutProps } from "./types";
import { LogoOverlay } from "../../components/LogoOverlay";

// ─── Types ───────────────────────────────────────────────────

interface SceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: SpotlightLayoutType;
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

// Black transition for spotlight (matches black bg)
const SpotlightTransition: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000000",
        opacity: progress,
      }}
    />
  );
};

// ─── Metadata ─────────────────────────────────────────────────

export const calculateSpotlightMetadata: CalculateMetadataFunction<VideoProps> =
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
      console.warn("calculateSpotlightMetadata fallback:", e);
      return {
        durationInFrames: FPS * 300,
        fps: FPS,
        width: 1920,
        height: 1080,
      };
    }
  };

// ─── Composition ───────────────────────────────────────────────

export const SpotlightVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then(setData)
      .catch(() => {
        setData({
          projectName: "Blog2Video Preview",
          accentColor: "#EF4444",
          bgColor: "#000000",
          textColor: "#FFFFFF",
          scenes: [
            {
              id: 1,
              order: 1,
              title: "SPOTLIGHT",
              narration: "This is a preview of your Spotlight video.",
              layout: "statement",
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
          backgroundColor: "#000000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#FFFFFF", fontSize: 36 }}>Loading...</p>
      </AbsoluteFill>
    );
  }

  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: data.bgColor || "#000000" }}>
      {data.scenes.map((scene, index) => {
        const durationFrames = Math.round(scene.durationSeconds * FPS);
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          SPOTLIGHT_LAYOUT_REGISTRY[scene.layout] ||
          SPOTLIGHT_LAYOUT_REGISTRY.statement;

        const imageUrl =
          scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;

        const layoutProps: SpotlightLayoutProps = {
          ...scene.layoutProps,
          title: scene.title,
          narration: scene.narration,
          accentColor: data.accentColor || "#EF4444",
          bgColor: data.bgColor || "#000000",
          textColor: data.textColor || "#FFFFFF",
          aspectRatio: data.aspectRatio || "landscape",
          imageUrl,
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
                <SpotlightTransition />
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
