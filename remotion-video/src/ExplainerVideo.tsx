import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  staticFile,
  interpolate,
  useCurrentFrame,
  CalculateMetadataFunction,
} from "remotion";
import { TextScene } from "./components/TextScene";
import { ImageScene } from "./components/ImageScene";
import { TransitionWipe } from "./components/Transitions";

interface SceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  visualDescription: string;
  durationSeconds: number;
  voiceoverFile: string | null;
  images: string[];
}

interface VideoData {
  projectName: string;
  heroImage?: string | null;
  scenes: SceneData[];
}

interface VideoProps {
  dataUrl: string;
}

// ─── Calculate actual duration from data.json ────────────────

export const calculateVideoMetadata: CalculateMetadataFunction<VideoProps> =
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
      // Add a small buffer (2s) for transitions
      const totalFrames = Math.ceil((totalSeconds + 2) * FPS);

      return {
        durationInFrames: Math.max(totalFrames, FPS * 5), // at least 5s
        fps: FPS,
        width: 1920,
        height: 1080,
      };
    } catch (e) {
      console.warn("calculateVideoMetadata fallback:", e);
      return {
        durationInFrames: FPS * 300, // 5 min fallback -- no artificial cap
        fps: FPS,
        width: 1920,
        height: 1080,
      };
    }
  };

// ─── Hero Scene: banner image fade-in, no text ──────────────

const HeroScene: React.FC<{ imageFile: string }> = ({ imageFile }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 40], [0, 1], {
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, 60], [1.08, 1.0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0f172a" }}>
      <Img
        src={staticFile(imageFile)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity,
          transform: `scale(${scale})`,
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Main composition ────────────────────────────────────────

export const ExplainerVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then(setData)
      .catch(() => {
        setData({
          projectName: "Blog2Video Preview",
          scenes: [
            {
              id: 1,
              order: 1,
              title: "Welcome",
              narration: "This is a preview of your Blog2Video project.",
              visualDescription: "Title card",
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
          backgroundColor: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "white", fontSize: 36 }}>Loading...</p>
      </AbsoluteFill>
    );
  }

  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0f172a" }}>
      {data.scenes.map((scene, index) => {
        const durationFrames = Math.round(scene.durationSeconds * FPS);
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        // First scene with heroImage: full-screen image fade-in, no text
        const isHeroScene =
          index === 0 && data.heroImage && scene.images.length > 0;

        const hasImages = scene.images.length > 0;
        const SceneComponent = hasImages ? ImageScene : TextScene;

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            {isHeroScene ? (
              <HeroScene imageFile={data.heroImage!} />
            ) : (
              <SceneComponent
                title={scene.title}
                narration={scene.narration}
                imageUrl={
                  hasImages ? staticFile(scene.images[0]) : undefined
                }
              />
            )}

            {/* Voiceover audio */}
            {scene.voiceoverFile && (
              <Audio src={staticFile(scene.voiceoverFile)} />
            )}

            {/* Transition overlay */}
            {index < data.scenes.length - 1 && (
              <Sequence
                from={durationFrames - 15}
                durationInFrames={15}
              >
                <TransitionWipe />
              </Sequence>
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
