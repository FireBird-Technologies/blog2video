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

const NEWSPAPER_PREVIEW_SCENES: DemoScene[] = [
  {
    id: 1,
    order: 1,
    title: "Partial government shutdown begins as funding lapses",
    narration:
      "Despite a Senate deal, the House failed to pass the bill before midnight.",
    layout: "news_headline",
    layoutProps: {
      category: "Politics",
      highlightWords: ["government", "funding"],
      stats: [{ label: "By Caitlin Yilek, Stefan Becket · January 31, 2026 / CBS News" }],
      titleFontSize: 90,
      descriptionFontSize: 45,
    },
    durationSeconds: 7,
  },
  {
    id: 2,
    order: 2,
    title: "The Story",
    narration:
      "Lawmakers failed to pass a short-term spending bill before the midnight deadline, triggering a partial government shutdown that will affect hundreds of thousands of federal workers starting today.",
    layout: "article_lead",
    layoutProps: {
      stats: [{ value: "800K", label: "federal workers affected" }],
      titleFontSize: 90,
      descriptionFontSize: 45,
    },
    durationSeconds: 7,
  },
  {
    id: 3,
    order: 3,
    title:
      "Real people will feel real consequences starting tomorrow morning.",
    narration: "— Senate Majority Leader",
    layout: "pull_quote",
    layoutProps: {
      stats: [{ label: "January 30, 2026" }],
      titleFontSize: 80,
      descriptionFontSize: 40,
    },
    durationSeconds: 7,
  },
  {
    id: 4,
    order: 4,
    title: "By the Numbers",
    narration: "",
    layout: "data_snapshot",
    layoutProps: {
      stats: [
        { value: "800K", label: "Federal workers affected" },
        { value: "47%", label: "Agencies impacted" },
        { value: "32", label: "Days until next deadline" },
        { value: "$6B", label: "Daily economic cost" },
      ],
      titleFontSize: 80,
      descriptionFontSize: 36,
    },
    durationSeconds: 7,
  },
  {
    id: 5,
    order: 5,
    title: "Fact Check",
    narration:
      "⚠ Context needed — no evidence supports the claim based on historical precedent.",
    layout: "fact_check",
    layoutProps: {
      leftThought: "The shutdown will only last a few hours.",
      rightThought:
        "Past shutdowns have averaged 16 days. Essential services may be suspended indefinitely.",
      stats: [{ label: "CLAIMED" }, { label: "THE FACTS" }],
      titleFontSize: 75,
      descriptionFontSize: 35,
    },
    durationSeconds: 7,
  },
  {
    id: 6,
    order: 6,
    title: "How We Got Here",
    narration: "",
    layout: "news_timeline",
    layoutProps: {
      stats: [
        { value: "Sep 30", label: "Fiscal year deadline passes without a budget" },
        { value: "Oct 15", label: "House passes short-term CR — Senate delays vote" },
        { value: "Jan 19", label: "Senate reaches bipartisan deal on 45-day extension" },
        { value: "Jan 31", label: "Midnight deadline missed — partial shutdown begins" },
        { value: "Feb 3", label: "Emergency session called to negotiate reopening" },
      ],
      titleFontSize: 75,
      descriptionFontSize: 34,
    },
    durationSeconds: 7,
  },
];

export default function NewsPaperPreviewPortrait({ thumbnailMode = false }: { thumbnailMode?: boolean } = {}) {
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const fps = 30;
  const config = getTemplateConfig("newspaper");
  const Composition = config.component as React.ComponentType<any>;
  const { accent: accentColor, bg: bgColor, text: textColor } = config.defaultColors;

  // Play the WHOLE timeline continuously (scene 1 → 2 → … → loop), exactly like the
  // real video, instead of mounting one isolated scene per Player window. The dots
  // just seek to a scene's start; auto-advance is driven by playback, not a timer.
  const sceneFrames = useMemo(
    () =>
      NEWSPAPER_PREVIEW_SCENES.map((s) =>
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
      scenes: NEWSPAPER_PREVIEW_SCENES,
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
    <PlayerScaledCanvas internalWidth={270} internalHeight={480}>
      <div
        className="relative overflow-hidden"
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: bgColor,
          backgroundImage: 'url("/vintage-news.avif")',
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
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
          style={{ width: 270, height: 480, display: "block" }}
        />

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-1">
          {NEWSPAPER_PREVIEW_SCENES.map((scene, index) => {
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
    </PlayerScaledCanvas>
  );
}
