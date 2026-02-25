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
import { NIGHTFALL_LAYOUT_REGISTRY } from "./layouts";
import type { NightfallLayoutType, NightfallLayoutProps } from "./types";
import { LogoOverlay } from "../../components/LogoOverlay";

// ─── Types ───────────────────────────────────────────────────

interface SceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: NightfallLayoutType;
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
  scenes: SceneData[];
}

interface VideoProps extends Record<string, unknown> {
  dataUrl: string;
}

// Dark transition for nightfall (matches dark bg)
const NightfallTransition: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0A0A1A",
        opacity: progress,
      }}
    />
  );
};

// ─── Metadata ─────────────────────────────────────────────────

export const calculateNightfallMetadata: CalculateMetadataFunction<VideoProps> =
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
      console.warn("calculateNightfallMetadata fallback:", e);
      return {
        durationInFrames: FPS * 300,
        fps: FPS,
        width: 1920,
        height: 1080,
      };
    }
  };

// ─── Composition ───────────────────────────────────────────────

export const NightfallVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then(setData)
      .catch(() => {
        setData({
          projectName: "Blog2Video Preview",
          accentColor: "#818CF8",
          bgColor: "#0A0A1A",
          textColor: "#E2E8F0",
          scenes: [
            {
              id: 1,
              order: 1,
              title: "Welcome",
              narration: "This is a preview of your Nightfall video.",
              layout: "glass_narrative",
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
          backgroundColor: "#0A0A1A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#E2E8F0", fontSize: 36 }}>Loading...</p>
      </AbsoluteFill>
    );
  }

  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: data.bgColor || "#0A0A1A" }}>
      {data.scenes.map((scene, index) => {
        const durationFrames = Math.round(scene.durationSeconds * FPS);
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          NIGHTFALL_LAYOUT_REGISTRY[scene.layout] ||
          NIGHTFALL_LAYOUT_REGISTRY.glass_narrative;

        const imageUrl =
          scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;

        // IMPORTANT: Ensure computed imageUrl wins over any stale scene.layoutProps.imageUrl
        const layoutProps: NightfallLayoutProps = {
          ...scene.layoutProps,
          title: scene.title,
          narration: scene.narration,
          accentColor: data.accentColor || "#818CF8",
          bgColor: data.bgColor || "#0A0A1A",
          textColor: data.textColor || "#E2E8F0",
          aspectRatio: data.aspectRatio || "landscape",
          imageUrl,
        };

        // Debug: Log layoutProps for data_visualization scenes
        if (scene.layout === "data_visualization") {
          console.log("[NightfallVideo] data_visualization scene:", {
            layout: scene.layout,
            layoutProps: scene.layoutProps,
            mergedLayoutProps: layoutProps,
          });
        }

        // Debug: Log imageUrl for glass_image scenes
        if (scene.layout === "glass_image") {
          console.log("[NightfallVideo] glass_image scene:", {
            layout: scene.layout,
            sceneImages: scene.images,
            imageUrl,
            layoutProps: layoutProps,
          });
        }

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
                <NightfallTransition />
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
