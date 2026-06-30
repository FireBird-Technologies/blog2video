import { useMemo, useState, useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
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

const STICKMAN_FOOTBALL_PREVIEW_SCENES: DemoScene[] = [
  {
    id: 1,
    order: 1,
    title: "Match Day Highlights",
    narration: "The big one kicks off under the lights.",
    layout: "kickoff_title",
    layoutProps: { subline: "Match Day — Highlights" },
    durationSeconds: 6,
  },
  {
    id: 2,
    order: 2,
    title: "Building From The Back",
    narration: "Crisp one-twos carve the midfield open.",
    layout: "passing_play",
    layoutProps: {
      stats: [
        { label: "Possession", value: "62%" },
        { label: "Passes", value: "418" },
        { label: "Shots", value: "14" },
        { label: "Pass Accuracy", value: "89%" },
      ],
    },
    durationSeconds: 7,
  },
  {
    id: 3,
    order: 3,
    title: "Free Kick Drama",
    narration: "The wall sets, the keeper guesses, the shot is saved.",
    layout: "freekick_setup",
    layoutProps: { shotLabel: "Top corner", kickerName: "Striker", kickerNumber: "#9" },
    durationSeconds: 7,
  },
  {
    id: 4,
    order: 4,
    title: "Worked Corner Routine",
    narration: "Short corner, flick on, lay off — the header flashes just wide.",
    layout: "corner_kick",
    layoutProps: {
      steps: [
        { label: "Corner", detail: "Inswinger" },
        { label: "Flick on", detail: "Near post" },
        { label: "Lay off", detail: "Edge of box" },
        { label: "Header", detail: "Just wide" },
      ],
    },
    durationSeconds: 7,
  },
  {
    id: 5,
    order: 5,
    title: "What A Goal!",
    narration: "Top corner — the keeper had no chance.",
    layout: "goal_moment",
    layoutProps: { goalLabel: "GOAL!", scoreline: "2 – 1", kickerName: "Striker", kickerNumber: "#9" },
    durationSeconds: 7,
  },
  {
    id: 6,
    order: 6,
    title: "By The Numbers",
    narration: "",
    layout: "match_stats",
    layoutProps: {
      stats: [
        { label: "Goals", value: "3" },
        { label: "Shots on Target", value: "8" },
        { label: "Possession", value: "57%" },
        { label: "Corners", value: "6" },
      ],
    },
    durationSeconds: 7,
  },
  {
    id: 7,
    order: 7,
    title: "Season Trend",
    narration: "Shots on target climb through the second half.",
    layout: "football_data_viz",
    layoutProps: {
      chartType: "line",
      chartSummary: "On-target shots peak after matchday three.",
      subtitle: "Matchday",
      yAxisLabel: "Shots",
      chartTable: {
        headers: ["Matchday", "Shots", "On Target"],
        rows: [
          ["MD 1", "11", "4"],
          ["MD 2", "14", "6"],
          ["MD 3", "16", "7"],
          ["MD 4", "13", "5"],
          ["MD 5", "18", "9"],
        ],
      },
      barPrimaryColor: "#2E7D32",
      barSecondaryColor: "#C0563B",
    },
    durationSeconds: 7,
  },
  {
    id: 8,
    order: 8,
    title: "League Table",
    narration: "The standings at a glance.",
    layout: "football_ticker",
    layoutProps: {
      tickerTitle: "Premier League",
      tickerFootnote: "Source: matchday data",
      tickerHighlightCol: 2,
      tickerTable: {
        headers: ["Team", "P", "GD", "Pts"],
        rows: [
          ["City FC", "28", "+24", "64"],
          ["United", "28", "+18", "58"],
          ["Rovers", "28", "+9", "49"],
          ["Athletic", "28", "-2", "41"],
          ["Wanderers", "28", "-11", "32"],
        ],
      },
    },
    durationSeconds: 7,
  },
  {
    id: 9,
    order: 9,
    title: "Champions!",
    narration: "Catch every match — follow the team.",
    layout: "ending_socials",
    layoutProps: {
      ctaButtonText: "Follow the team",
      websiteLink: "https://yourteam.com",
      socials: [
        { platform: "instagram", enabled: "true", label: "Instagram" },
        { platform: "youtube", enabled: "true", label: "YouTube" },
        { platform: "tiktok", enabled: "true", label: "TikTok" },
      ],
    },
    durationSeconds: 7,
  },
];

export default function StickmanFootballPreviewPortrait({ thumbnailMode = false }: { thumbnailMode?: boolean } = {}) {
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const fps = 30;
  const config = getTemplateConfig("stickman_football");
  const Composition = config.component as React.ComponentType<any>;
  const { accent: accentColor, bg: bgColor, text: textColor } = config.defaultColors;

  const sceneFrames = useMemo(
    () =>
      STICKMAN_FOOTBALL_PREVIEW_SCENES.map((s) =>
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
      scenes: STICKMAN_FOOTBALL_PREVIEW_SCENES,
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

  useEffect(() => {
    if (!thumbnailMode) return;
    const pl = playerRef.current;
    if (!pl) return;
    let settled = false;
    const onFrame = () => {
      if (settled) return;
      const current = pl.getCurrentFrame();
      if (current >= thumbnailFrame) {
        settled = true;
        pl.pause();
        pl.seekTo(thumbnailFrame);
      }
    };
    pl.addEventListener("frameupdate", onFrame);
    return () => pl.removeEventListener("frameupdate", onFrame);
  }, [thumbnailMode, thumbnailFrame]);

  useEffect(() => {
    if (thumbnailMode) return;
    const pl = playerRef.current;
    if (!pl) return;
    setActiveSceneIndex(0);
    pl.seekTo(0);
    pl.play();
  }, [thumbnailMode]);

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
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "9/16", background: bgColor }}>
        <Player
          ref={playerRef}
          component={Composition}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          initialFrame={0}
          compositionWidth={1080}
          compositionHeight={1920}
          fps={fps}
          controls={false}
          autoPlay
          loop={!thumbnailMode}
          acknowledgeRemotionLicense
          style={{ width: "100%", height: "100%", display: "block" }}
        />

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full bg-black/35 px-2 py-1">
          {STICKMAN_FOOTBALL_PREVIEW_SCENES.map((scene, index) => {
            const isActive = index === activeSceneIndex;
            return (
              <button
                key={scene.id}
                onClick={() => seekToScene(index)}
                disabled={thumbnailMode}
                className={`h-1.5 rounded-full transition-all ${isActive ? "w-4" : "w-1.5 bg-white/45 hover:bg-white/70"}`}
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
