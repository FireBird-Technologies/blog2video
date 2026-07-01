import { useMemo, useState, useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import PlayerScaledCanvas from "./PlayerScaledCanvas";
import { getTemplateConfig } from "../remotion/templateConfig";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DemoScene {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
}

const STICKMAN2_PREVIEW_SCENES: DemoScene[] = [
  {
    id: 1,
    order: 1,
    title: "Stick Man After Dark",
    narration: "Glowing chalk stories under the night sky.",
    layout: "chalk_title",
    layoutProps: {},
    durationSeconds: 6,
  },
  {
    id: 2,
    order: 2,
    title: "Two Minds, One Sky",
    narration: "",
    layout: "lantern_dialogue",
    layoutProps: {
      leftBubble: "Did you see that?",
      rightBubble: "A shooting star!",
      speakers: [{ label: "Sam" }, { label: "Max" }],
    },
    durationSeconds: 7,
  },
  {
    id: 3,
    order: 3,
    title: "By the Numbers",
    narration: "",
    layout: "constellation_stats",
    layoutProps: {
      stats: [
        { label: "Stars", value: "150" },
        { label: "Hours", value: "24" },
        { label: "Phases", value: "8" },
      ],
    },
    durationSeconds: 7,
  },
  {
    id: 4,
    order: 4,
    title: "Follow Along",
    narration: "Catch the next chapter under the stars.",
    layout: "ending_socials",
    layoutProps: {
      ctaButtonText: "Explore more on",
      websiteLink: "https://yourwebsite.com",
      socials: [
        { platform: "instagram", enabled: "true", label: "Instagram" },
        { platform: "youtube", enabled: "true", label: "YouTube" },
        { platform: "linkedin", enabled: "true", label: "LinkedIn" },
        { platform: "tiktok", enabled: "true", label: "TikTok" },
      ],
    },
    durationSeconds: 7,
  },
];

export default function Stickman2Preview({ thumbnailMode = false }: { thumbnailMode?: boolean } = {}) {
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const fps = 30;
  const config = getTemplateConfig("stickman_2");
  const Composition = config.component as React.ComponentType<any>;

  // Monochrome preview: white chalk strokes/text on a black night sky.
  const accentColor = "#FFFFFF";
  const bgColor = "#000000";
  const textColor = "#FFFFFF";

  // Play the WHOLE timeline continuously (scene 1 → 2 → … → loop), exactly like the
  // real video, instead of mounting one isolated scene per Player window. The dots
  // just seek to a scene's start; auto-advance is driven by playback, not a timer.
  const sceneFrames = useMemo(
    () =>
      STICKMAN2_PREVIEW_SCENES.map((s) =>
        Math.max(1, Math.round((Number(s.durationSeconds) || 5) * fps)),
      ),
    [fps],
  );
  const sceneStartFrames = useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    for (const f of sceneFrames) {
      starts.push(acc);
      acc += f;
    }
    return starts;
  }, [sceneFrames]);
  const durationInFrames = useMemo(
    () => Math.max(1, sceneFrames.reduce((a, b) => a + b, 0)),
    [sceneFrames],
  );
  const thumbnailFrame = Math.min(Math.max(0, durationInFrames - 1), 100);

  const inputProps = useMemo(
    () => ({
      scenes: STICKMAN2_PREVIEW_SCENES,
      accentColor,
      bgColor,
      textColor,
      logo: null,
      logoPosition: "bottom_right",
      logoOpacity: 0,
      logoSize: 0,
      aspectRatio: "landscape",
    }),
    [accentColor, bgColor, textColor],
  );

  useEffect(() => {
    if (!thumbnailMode) return;
    const p = playerRef.current;
    if (!p) return;
    p.pause();
    p.seekTo(thumbnailFrame);
  }, [thumbnailMode, thumbnailFrame]);

  // When the card reaches center, restart the timeline from the top so the
  // animation plays fresh — and stop it (the thumbnail effect above pauses it)
  // the moment it moves away.
  useEffect(() => {
    if (thumbnailMode) return;
    const p = playerRef.current;
    if (!p) return;
    setActiveSceneIndex(0);
    p.seekTo(0);
    p.play();
  }, [thumbnailMode]);

  // Keep the active-dot highlight in sync with which scene is currently playing.
  useEffect(() => {
    if (thumbnailMode) return;
    const pl = playerRef.current;
    if (!pl) return;
    const onFrame = () => {
      const f = pl.getCurrentFrame();
      let idx = 0;
      for (let i = sceneStartFrames.length - 1; i >= 0; i--) {
        if (f >= sceneStartFrames[i]) {
          idx = i;
          break;
        }
      }
      setActiveSceneIndex((prev) => (prev === idx ? prev : idx));
    };
    pl.addEventListener("frameupdate", onFrame);
    return () => pl.removeEventListener("frameupdate", onFrame);
  }, [thumbnailMode, sceneStartFrames]);

  // Clicking a dot seeks the continuous timeline to that scene's start.
  const seekToScene = (index: number) => {
    setActiveSceneIndex(index);
    const pl = playerRef.current;
    if (pl) {
      pl.seekTo(sceneStartFrames[index] ?? 0);
      if (!thumbnailMode) pl.play();
    }
  };

  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9", background: bgColor }}>
        <PlayerScaledCanvas>
          <Player
            ref={playerRef}
            component={Composition}
            inputProps={inputProps}
            durationInFrames={durationInFrames}
            initialFrame={thumbnailMode ? thumbnailFrame : 0}
            compositionWidth={1920}
            compositionHeight={1080}
            fps={fps}
            controls={false}
            autoPlay={!thumbnailMode}
            loop={!thumbnailMode}
            acknowledgeRemotionLicense
            style={{ width: "100%", height: "100%", display: "block" }}
          />
        </PlayerScaledCanvas>

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-1">
          {STICKMAN2_PREVIEW_SCENES.map((scene, index) => {
            const isActive = index === activeSceneIndex;
            return (
              <button
                key={scene.id}
                onClick={() => seekToScene(index)}
                disabled={thumbnailMode}
                className={`h-1.5 rounded-full transition-all ${isActive ? "w-5" : "w-1.5 bg-white/45 hover:bg-white/70"}`}
                style={isActive ? { background: accentColor } : undefined}
                aria-label={`Preview ${scene.title} layout`}
                title={scene.title}
                type="button"
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
