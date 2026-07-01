import { useMemo, useState, useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import PlayerScaledCanvas from "../PlayerScaledCanvas";
import { getTemplateConfig } from "../../remotion/templateConfig";

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

// Dot-grid paper background (mirrors WhiteboardBackground) so the container
// never flashes a flat color around the Player.
const WHITEBOARD_BG_IMAGE =
  "radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.02) 1px, transparent 1px)";

const WHITEBOARD_PREVIEW_SCENES: DemoScene[] = [
  {
    id: 1,
    order: 1,
    title: "Story Comes Alive",
    narration:
      "Hand-drawn markers, playful stick figures and clear story beats bring every idea to life.",
    layout: "drawn_title",
    layoutProps: {
      titleFontSize: 100,
      descriptionFontSize: 56,
    },
    durationSeconds: 7,
  },
  {
    id: 2,
    order: 2,
    title: "By the Numbers",
    narration: "A quick, side-by-side look at how each option really performed.",
    layout: "stats_chart",
    layoutProps: {
      stats: [
        { label: "Option A", value: "85%" },
        { label: "Option B", value: "62%" },
        { label: "Option C", value: "44%" },
      ],
      titleFontSize: 100,
      descriptionFontSize: 46,
    },
    durationSeconds: 7,
  },
  {
    id: 3,
    order: 3,
    title: "Make a Choice",
    narration: "Two very different mindsets — so which path will you choose to take?",
    layout: "comparison",
    layoutProps: {
      leftThought: "Ship it fast, speed beats everything!",
      rightThought: "Slow down — real quality always takes time!",
      titleFontSize: 90,
      descriptionFontSize: 36,
    },
    durationSeconds: 7,
  },
  {
    id: 4,
    order: 4,
    title: "The Impact",
    narration: "The numbers that tell the story of real, measurable impact.",
    layout: "stats_figures",
    layoutProps: {
      stats: [
        { value: "87%", label: "Engagement" },
        { value: "3×", label: "Faster" },
        { value: "10K+", label: "Users" },
      ],
      titleFontSize: 96,
      descriptionFontSize: 40,
    },
    durationSeconds: 7,
  },
  {
    id: 5,
    order: 5,
    title: "The Big Conversation",
    narration: "",
    layout: "speech_bubble_dialogue",
    layoutProps: {
      leftThought: "Hey, did you know about this?",
      rightThought: "No way — tell me more about it!",
      speakers: [{ label: "Alex" }, { label: "Jordan" }],
      titleFontSize: 90,
      descriptionFontSize: 38,
    },
    durationSeconds: 7,
  },
  {
    id: 6,
    order: 6,
    title: "Get Ready!",
    narration: "Just a few seconds left now until the big launch 🚀",
    layout: "countdown_timer",
    layoutProps: {
      stats: [{ value: "5" }],
      titleFontSize: 116,
      descriptionFontSize: 54,
    },
    durationSeconds: 7,
  },
];

export default function WhiteboardPreviewPortrait({ thumbnailMode = false }: { thumbnailMode?: boolean } = {}) {
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const fps = 30;
  const config = getTemplateConfig("whiteboard");
  const Composition = config.component as React.ComponentType<any>;
  const { accent: accentColor, bg: bgColor, text: textColor } = config.defaultColors;

  // Play the WHOLE timeline continuously (scene 1 → 2 → … → loop), exactly like the
  // real video, instead of mounting one isolated scene per Player window. The dots
  // just seek to a scene's start; auto-advance is driven by playback, not a timer.
  const sceneFrames = useMemo(
    () =>
      WHITEBOARD_PREVIEW_SCENES.map((s) =>
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
      scenes: WHITEBOARD_PREVIEW_SCENES,
      accentColor,
      bgColor,
      textColor,
      logo: null,
      logoPosition: "bottom_right",
      logoOpacity: 0,
      logoSize: 0,
      aspectRatio: "portrait",
    }),
    [accentColor, bgColor, textColor],
  );

  // Side cards are static: the moment a card is not the center card it pauses
  // and locks to the thumbnail frame, so only the centered card ever animates.
  // This fires both on initial mount as a side card and when a card is moved
  // away from center, freezing it immediately rather than letting it keep
  // rendering.
  useEffect(() => {
    if (!thumbnailMode) return;
    const pl = playerRef.current;
    if (!pl) return;
    pl.pause();
    pl.seekTo(thumbnailFrame);
  }, [thumbnailMode, thumbnailFrame]);

  // When the card reaches center, restart the timeline from the top so the
  // animation plays fresh — and stop it (the thumbnail effect above pauses it)
  // the moment it moves away.
  useEffect(() => {
    if (thumbnailMode) return;
    const pl = playerRef.current;
    if (!pl) return;
    setActiveSceneIndex(0);
    pl.seekTo(0);
    pl.play();
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
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: "9/16",
          backgroundColor: bgColor,
          backgroundImage: WHITEBOARD_BG_IMAGE,
          backgroundSize: "20px 20px, 12px 12px",
        }}
      >
        <PlayerScaledCanvas internalWidth={270} internalHeight={480}>
          <Player
            ref={playerRef}
            component={Composition}
            inputProps={inputProps}
            durationInFrames={durationInFrames}
            initialFrame={thumbnailMode ? thumbnailFrame : 0}
            compositionWidth={720}
            compositionHeight={1280}
            fps={fps}
            controls={false}
            autoPlay={!thumbnailMode}
            loop={!thumbnailMode}
            acknowledgeRemotionLicense
            style={{ width: "100%", height: "100%", display: "block" }}
          />
        </PlayerScaledCanvas>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-1">
          {WHITEBOARD_PREVIEW_SCENES.map((scene, index) => {
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
