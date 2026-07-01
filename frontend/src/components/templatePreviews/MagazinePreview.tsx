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

export default function MagazinePreview({
  thumbnailMode = false,
}: { thumbnailMode?: boolean } = {}) {
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const playerRef = useRef<PlayerRef>(null);

  useEffect(() => {
    if (thumbnailMode) setActiveSceneIndex(0);
  }, [thumbnailMode]);

  const activeScene = MAGAZINE_PREVIEW_SCENES[activeSceneIndex];
  const fps = 30;

  // Single scene → no transitions, so total frames is just the scene's own length.
  const durationInFrames = useMemo(
    () => Math.max(1, Math.round((Number(activeScene.durationSeconds) || 5) * fps)),
    [activeScene],
  );
  // Freeze a little past the intro so the cover/animation has settled.
  const thumbnailFrame = Math.min(Math.max(0, durationInFrames - 1), 130);

  const config = getTemplateConfig("magazine");
  const Composition = config.component as React.ComponentType<any>;

  const { accent: accentColor, bg: bgColor, text: textColor } = config.defaultColors;

  const inputProps = useMemo(
    () => ({
      scenes: [activeScene],
      projectName: "Atlas Review",
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
    p.pause();
    p.seekTo(thumbnailFrame);
  }, [thumbnailMode, thumbnailFrame, activeSceneIndex]);

  useEffect(() => {
    if (thumbnailMode) return;
    const ms = Math.max(500, Math.round((durationInFrames / fps) * 1000));
    const t = setTimeout(() => {
      setActiveSceneIndex((i) => (i + 1) % MAGAZINE_PREVIEW_SCENES.length);
    }, ms);
    return () => clearTimeout(t);
  }, [activeSceneIndex, durationInFrames, fps, thumbnailMode]);

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
          {MAGAZINE_PREVIEW_SCENES.map((scene, index) => {
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
