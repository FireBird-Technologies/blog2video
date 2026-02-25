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
import { MATRIX_LAYOUT_REGISTRY } from "./layouts";
import type { MatrixLayoutType, MatrixLayoutProps } from "./types";
import { LogoOverlay } from "../../components/LogoOverlay";

// ─── Types ───────────────────────────────────────────────────

interface SceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: MatrixLayoutType;
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

/** Matrix-style transition — glitch distort + green flash + fade to black */
const MatrixTransition: React.FC = () => {
  const frame = useCurrentFrame();

  // Phase 1 (frames 0-3): Green scanline flash with glitch offset
  const flashProgress = interpolate(frame, [0, 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 2 (frames 3-8): Scale up + fade to black
  const fadeProgress = interpolate(frame, [3, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scale = interpolate(frame, [2, 8], [1, 1.12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Glitch horizontal offset during flash phase
  const glitchX = frame < 3 ? Math.sin(frame * 8) * 6 : 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: flashProgress < 1 ? "#00FF4133" : "#000000",
        opacity: flashProgress < 1 ? flashProgress : fadeProgress,
        transform: `scale(${scale}) translateX(${glitchX}px)`,
        boxShadow: flashProgress < 1
          ? `0 0 60px #00FF4144, inset 0 0 120px #00FF4122`
          : "none",
      }}
    />
  );
};

// ─── Metadata ─────────────────────────────────────────────────

export const calculateMatrixMetadata: CalculateMetadataFunction<VideoProps> =
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
      console.warn("calculateMatrixMetadata fallback:", e);
      return {
        durationInFrames: FPS * 300,
        fps: FPS,
        width: 1920,
        height: 1080,
      };
    }
  };

// ─── Composition ───────────────────────────────────────────────

export const MatrixVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then(setData)
      .catch(() => {
        setData({
          projectName: "Blog2Video Preview",
          accentColor: "#00FF41",
          bgColor: "#000000",
          textColor: "#00FF41",
          scenes: [
            {
              id: 1,
              order: 1,
              title: "System Online",
              narration: "Welcome to the Matrix.",
              layout: "terminal_text",
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
        <p
          style={{
            color: "#00FF41",
            fontSize: 28,
            fontFamily: "'Fira Code', 'Courier New', monospace",
          }}
        >
          {">"} Loading...
        </p>
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
          MATRIX_LAYOUT_REGISTRY[scene.layout] ||
          MATRIX_LAYOUT_REGISTRY.terminal_text;

        const imageUrl =
          scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;

        const layoutProps: MatrixLayoutProps = {
          ...scene.layoutProps,
          title: scene.title,
          narration: scene.narration,
          accentColor: data.accentColor || "#00FF41",
          bgColor: data.bgColor || "#000000",
          textColor: data.textColor || "#00FF41",
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
              <Sequence from={durationFrames - 8} durationInFrames={8}>
                <MatrixTransition />
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
