import { useMemo, useState, useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import PlayerScaledCanvas from "../PlayerScaledCanvas";
import { getTemplateConfig } from "../../remotion/templateConfig";
import {
  planMagazineBoundaries,
  resolveMagazineLayout,
} from "../../remotion/magazine/MagazineVideoComposition";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DemoScene {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
}

// Curated from the existing sample issue in remotion-video/public/mag-allscenes.json
// ("Atlas Review"), trimmed to a few visually distinct layouts for the preview cycle.
const MAGAZINE_PREVIEW_SCENES: DemoScene[] = [
  {
    id: 1,
    order: 1,
    title: "The Quiet Revolution",
    narration: "Inside the studios reshaping how we live and work.",
    layout: "magazine_cover",
    layoutProps: {},
    durationSeconds: 3,
  },
  {
    id: 2,
    order: 2,
    title: "The Shape of Things to Come",
    narration: "Inside the studios redrawing how we live and work.",
    layout: "feature",
    layoutProps: {
      sectionLabel: "FEATURE",
      body:
        "On a wet Tuesday in a converted east-London warehouse, eleven people are arguing about a margin. It is the kind of room where the future of a magazine is decided one hairline rule at a time — where a redesign is less a grand gesture than a thousand small, stubborn judgements.",
      keyPoints: [
        { value: "Attention is the scarce resource" },
        { value: "Craft outlasts ornament" },
        { value: "Detail is the whole job" },
      ],
    },
    durationSeconds: 8,
  },
  {
    id: 3,
    order: 3,
    title: "By the Numbers",
    narration: "The redesign, measured.",
    layout: "by_the_numbers",
    layoutProps: {
      stats: [
        { value: "2.4M", label: "Monthly readers" },
        { value: "98%", label: "Renewal rate" },
        { value: "150+", label: "Countries" },
        { value: "47", label: "Issues in print" },
      ],
    },
    durationSeconds: 3,
  },
  {
    id: 4,
    order: 4,
    title: "It starts with the grid, and ends with the reader.",
    narration: "— Mara Voss",
    layout: "editorial_quote",
    layoutProps: { attribution: "Mara Voss, Editor" },
    durationSeconds: 3,
  },
  {
    id: 5,
    order: 5,
    title: "Where does a redesign actually begin?",
    narration: "We sat down with the team behind the redesign.",
    layout: "interview_qa",
    layoutProps: {
      leftSpeaker: "Mara Voss",
      rightSpeaker: "Art Director",
      exchanges: [
        {
          q: "Where does a redesign actually begin?",
          a: "It begins long before anything is drawn. We spent weeks simply reading the old magazine, page by page, asking where the eye stalled and where it flew.",
        },
        {
          q: "What was the hardest constraint?",
          a: "Type, always. A magazine lives or dies on its body text. The headline can sing, but the body must disappear into the reading.",
        },
        {
          q: "How do you know when it's finished?",
          a: "There's a moment when a spread stops feeling designed and starts feeling inevitable, as if it could not have been any other way. That is the signal to stop.",
        },
      ],
    },
    durationSeconds: 8,
  },
];

export default function MagazinePreviewPortrait({
  thumbnailMode = false,
}: { thumbnailMode?: boolean } = {}) {
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const fps = 30;
  const config = getTemplateConfig("magazine");
  const Composition = config.component as React.ComponentType<any>;
  const { accent: accentColor, bg: bgColor, text: textColor } = config.defaultColors;

  // Play the WHOLE timeline continuously (cover → feature → … → loop) WITH the
  // magazine's black-bridged 3D page transitions — exactly like the real video —
  // instead of mounting one isolated static scene per Player window. Duration and
  // per-scene start frames come from the SAME planner the composition uses, so the
  // Player's declared length matches the composition (no clipped/raced pages).
  const { durationInFrames, sceneStartFrames } = useMemo(() => {
    const per = MAGAZINE_PREVIEW_SCENES.map((s) =>
      Math.max(1, Math.round((Number(s.durationSeconds) || 5) * fps)),
    );
    const layoutKeys = MAGAZINE_PREVIEW_SCENES.map((s) => resolveMagazineLayout(s.layout));
    const { totalFrames, startFrames } = planMagazineBoundaries(layoutKeys, per, accentColor);
    return { durationInFrames: Math.max(1, totalFrames), sceneStartFrames: startFrames };
  }, [accentColor, fps]);

  // Freeze on the settled cover for the static thumbnail.
  // Freeze near the start of the opening cover for the static thumbnail/poster.
  // Frame 0 is still inside the black intro bridge, so land a beat later once the
  // cover has faded in.
  const thumbnailFrame = 30;

  const inputProps = useMemo(
    () => ({
      scenes: MAGAZINE_PREVIEW_SCENES,
      projectName: "Atlas Review",
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

  // Side cards are static: the moment a card is not the centered/live card it
  // pauses and locks to the thumbnail frame, so only the live card ever animates.
  useEffect(() => {
    if (!thumbnailMode) return;
    const pl = playerRef.current;
    if (!pl) return;
    pl.pause();
    pl.seekTo(thumbnailFrame);
  }, [thumbnailMode, thumbnailFrame]);

  // When the card becomes live, restart the timeline from the top so the
  // animation plays fresh — the thumbnail effect above pauses it once it leaves.
  useEffect(() => {
    if (thumbnailMode) return;
    const pl = playerRef.current;
    if (!pl) return;
    setActiveSceneIndex(0);
    pl.seekTo(0);
    pl.play();
  }, [thumbnailMode]);

  // Keep the active dot in sync with which scene is currently on screen.
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
    <div className="relative w-full h-full overflow-hidden" style={{ background: bgColor }}>
        <PlayerScaledCanvas internalWidth={270} internalHeight={480}>
          <Player
            ref={playerRef}
            component={Composition}
            inputProps={inputProps}
            durationInFrames={durationInFrames}
            initialFrame={thumbnailMode ? thumbnailFrame : 0}
            compositionWidth={1080}
            compositionHeight={1920}
            fps={fps}
            controls={false}
            autoPlay={!thumbnailMode}
            loop={!thumbnailMode}
            acknowledgeRemotionLicense
            style={{ width: 270, height: 480, display: "block" }}
          />
        </PlayerScaledCanvas>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-1">
          {MAGAZINE_PREVIEW_SCENES.map((scene, index) => {
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
  );
}
