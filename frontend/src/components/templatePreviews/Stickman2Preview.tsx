import { useMemo, useState, useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
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
  const activeScene = STICKMAN2_PREVIEW_SCENES[activeSceneIndex];
  const fps = 30;
  // Hold the scene fully visible for the display window plus a 2s steady buffer,
  // with no trailing dark frames. The scene-switch effect below fires (at
  // durationSeconds) before this window ever loops, so the exit fade is never seen.
  const durationInFrames = Math.round((activeScene.durationSeconds + 2) * fps);
  const thumbnailFrame = Math.min(Math.max(0, durationInFrames - 1), 100);
  const config = getTemplateConfig("stickman_2");
  const Composition = config.component as React.ComponentType<any>;

  // Monochrome preview: white chalk strokes/text on a black night sky.
  const accentColor = "#FFFFFF";
  const bgColor = "#000000";
  const textColor = "#FFFFFF";

  const inputProps = useMemo(
    () => ({
      // Inflate the scene length handed to the composition so its built-in
      // exit fade-to-black is pushed well past the preview window (no dark dip).
      scenes: [{ ...activeScene, durationSeconds: activeScene.durationSeconds + 3 }],
      accentColor,
      bgColor,
      textColor,
      logo: null,
      logoPosition: "bottom_right",
      logoOpacity: 0,
      logoSize: 0,
      aspectRatio: "landscape",
    }),
    [activeScene, accentColor, bgColor, textColor],
  );

  useEffect(() => {
    if (!thumbnailMode) return;
    const p = playerRef.current;
    if (!p) return;
    let settled = false;
    const onFrame = () => {
      if (settled) return;
      const current = p.getCurrentFrame();
      if (current >= thumbnailFrame) {
        settled = true;
        p.pause();
        p.seekTo(thumbnailFrame);
      }
    };
    p.addEventListener("frameupdate", onFrame);
    return () => p.removeEventListener("frameupdate", onFrame);
  }, [thumbnailMode, thumbnailFrame, activeSceneIndex]);

  useEffect(() => {
    if (thumbnailMode) return;
    const ms = Math.max(500, Math.round(activeScene.durationSeconds * 1000));
    const t = setTimeout(() => {
      setActiveSceneIndex((i) => (i + 1) % STICKMAN2_PREVIEW_SCENES.length);
    }, ms);
    return () => clearTimeout(t);
  }, [activeSceneIndex, activeScene.durationSeconds, thumbnailMode]);

  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9", background: bgColor }}>
        <Player
          ref={playerRef}
          component={Composition}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          initialFrame={0}
          compositionWidth={1920}
          compositionHeight={1080}
          fps={fps}
          controls={false}
          autoPlay
          loop={!thumbnailMode}
          acknowledgeRemotionLicense
          style={{ width: "100%", height: "100%", display: "block" }}
        />

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-1">
          {STICKMAN2_PREVIEW_SCENES.map((scene, index) => {
            const isActive = index === activeSceneIndex;
            return (
              <button
                key={scene.id}
                onClick={() => setActiveSceneIndex(index)}
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
