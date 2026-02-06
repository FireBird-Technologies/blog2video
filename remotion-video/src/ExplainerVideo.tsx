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
import { TransitionWipe } from "./components/Transitions";

// ─── AI-generated scene components ───────────────────────────
import Scene1 from "./components/generated/Scene1";
import Scene2 from "./components/generated/Scene2";
import Scene3 from "./components/generated/Scene3";
import Scene4 from "./components/generated/Scene4";
import Scene5 from "./components/generated/Scene5";
import Scene6 from "./components/generated/Scene6";
import Scene7 from "./components/generated/Scene7";
import Scene8 from "./components/generated/Scene8";
import Scene9 from "./components/generated/Scene9";

const SCENE_COMPONENTS: Record<number, React.FC<{ title: string; narration: string; imageUrl?: string }>> = {
  1: Scene1,
  2: Scene2,
  3: Scene3,
  4: Scene4,
  5: Scene5,
  6: Scene6,
  7: Scene7,
  8: Scene8,
  9: Scene9,
};

// ─── Types ───────────────────────────────────────────────────

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
      const totalFrames = Math.ceil((totalSeconds + 2) * FPS);

      return {
        durationInFrames: Math.max(totalFrames, FPS * 5),
        fps: FPS,
        width: 1920,
        height: 1080,
      };
    } catch (e) {
      console.warn("calculateVideoMetadata fallback:", e);
      return {
        durationInFrames: FPS * 300,
        fps: FPS,
        width: 1920,
        height: 1080,
      };
    }
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

        // Use the AI-generated component for this scene's order,
        // falling back to TextScene if not available.
        const GeneratedComponent = SCENE_COMPONENTS[scene.order] || TextScene;
        const hasImages = scene.images.length > 0;
        const imageUrl = hasImages ? staticFile(scene.images[0]) : undefined;

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <GeneratedComponent
              title={scene.title}
              narration={scene.narration}
              imageUrl={imageUrl}
            />

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
