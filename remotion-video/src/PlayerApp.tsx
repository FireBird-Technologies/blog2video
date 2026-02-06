import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Player } from "@remotion/player";
import { ExplainerVideo, calculateVideoMetadata } from "./ExplainerVideo";

const FPS = 30;

interface VideoData {
  projectName: string;
  scenes: { durationSeconds: number }[];
}

const PlayerApp: React.FC = () => {
  const [duration, setDuration] = useState(FPS * 30); // 30s fallback

  useEffect(() => {
    // Fetch data.json to compute actual duration
    fetch("/data.json")
      .then((r) => r.json())
      .then((data: VideoData) => {
        const totalSec = data.scenes.reduce(
          (sum, s) => sum + (s.durationSeconds || 5),
          0
        );
        setDuration(Math.max(Math.ceil((totalSec + 2) * FPS), FPS * 5));
      })
      .catch(() => {
        // keep fallback
      });
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
      }}
    >
      <Player
        component={ExplainerVideo}
        inputProps={{ dataUrl: "/data.json" }}
        durationInFrames={duration}
        compositionWidth={1920}
        compositionHeight={1080}
        fps={FPS}
        controls
        autoPlay={false}
        loop={false}
        style={{
          width: "100%",
          height: "100%",
        }}
        acknowledgeRemotionLicense
      />
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<PlayerApp />);
