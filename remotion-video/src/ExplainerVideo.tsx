import { useEffect, useState } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
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
  scenes: SceneData[];
}

export const ExplainerVideo: React.FC<{ dataUrl: string }> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then(setData)
      .catch(() => {
        // Fallback data for preview
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

        const hasImages = scene.images.length > 0;
        const SceneComponent = hasImages ? ImageScene : TextScene;

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            {/* Scene content */}
            <SceneComponent
              title={scene.title}
              narration={scene.narration}
              imageUrl={
                hasImages ? staticFile(scene.images[0]) : undefined
              }
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
