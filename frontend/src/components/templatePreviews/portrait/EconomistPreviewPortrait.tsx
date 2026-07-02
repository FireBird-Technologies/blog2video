import { useMemo, useState, useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import PlayerScaledCanvas from "../PlayerScaledCanvas";
import { getTemplateConfig } from "../../remotion/templateConfig";
import { computeEconomistVideoTotalFrames } from "../../remotion/economist/EconomistVideoComposition";

/* eslint-disable @typescript-eslint/no-explicit-any */

const INTERNAL_W = 270;
const INTERNAL_H = 480;

const ECONOMIST_PREVIEW_SCENES = [
  {
    id: 1,
    order: 1,
    title: "A Starship enterprise",
    durationSeconds: 8,
    narration: "The week in business, finance and economics.",
    layout: "cover_reveal",
    layoutProps: {
      wordmark: "The Economist",
      dateline: "MAY 23RD–29TH 2026",
      teasers: ["We calculate the MAGA tax", "NATO: time for Plan B", "Are economists amoral?"],
    },
  },
  {
    id: 2,
    order: 2,
    title: "End of a losing streak",
    durationSeconds: 8,
    narration: "Latin America and the Caribbean, % agreeing",
    layout: "chart_line",
    layoutProps: {
      sectionLabel: "FINANCE",
      panelNumber: "2",
      emphasizeZero: false,
      highlightSeries: ["Preferred", "Satisfied"],
      seriesColors: ["#F0746E", "#E3120B"],
      labelMode: "inline",
      source: "Source: Latinobarómetro",
      chartTable: {
        headers: ["Year", "Preferred", "Satisfied"],
        rows: [
          ["1995", 52, 30],
          ["2000", 48, 25],
          ["05", 53, 31],
          ["10", 55, 38],
          ["15", 46, 28],
          ["20", 44, 18],
          ["24", 47, 29],
        ],
      },
    },
  },
  {
    id: 3,
    order: 3,
    title: "Should the Fed cut rates?",
    durationSeconds: 9,
    narration: "",
    layout: "pros_cons",
    layoutProps: {
      sectionLabel: "LEADERS",
      intro:
        "The central bank faces its most delicate decision in years. Here are the arguments for and against easing now.",
      pros: [
        { lead: "GROWTH IS COOLING", body: "Hiring has slowed and manufacturing output has contracted." },
        { lead: "INFLATION NEAR TARGET", body: "Core PCE has drifted to 2.4%, near the 2% goal." },
      ],
      cons: [
        { lead: "SERVICES STAY HOT", body: "Wage growth in services keeps underlying inflation sticky." },
        { lead: "CREDIBILITY AT STAKE", body: "Cutting too soon risks a second wave of inflation." },
      ],
    },
  },
  {
    id: 4,
    order: 4,
    title: "By the numbers",
    durationSeconds: 7,
    narration: "The American economy in four figures",
    layout: "key_indicators",
    layoutProps: {
      sectionLabel: "ECONOMIC DATA",
      indicators: [
        { value: "2.4%", label: "Core inflation", delta: "-0.3pp" },
        { value: "4.1%", label: "Unemployment", delta: "+0.2pp" },
        { value: "$1.9trn", label: "Budget deficit", delta: "+5.4%" },
        { value: "2.1%", label: "GDP growth", delta: "+0.1pp" },
      ],
    },
  },
] as const;

function buildSceneOffsets(scenes: typeof ECONOMIST_PREVIEW_SCENES): number[] {
  const fps = 30;
  const offsets: number[] = [];
  let cursor = 0;
  for (const scene of scenes) {
    offsets.push(cursor);
    cursor += Math.round(scene.durationSeconds * fps);
  }
  return offsets;
}

export default function EconomistPreviewPortrait({ thumbnailMode = false }: { thumbnailMode?: boolean } = {}) {
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const fps = 30;

  const config = getTemplateConfig("economist");
  const Composition = config.component as React.ComponentType<any>;
  const { accent: accentColor, bg: bgColor, text: textColor } = config.defaultColors;

  const durationInFrames = useMemo(
    () => computeEconomistVideoTotalFrames(ECONOMIST_PREVIEW_SCENES as any, 1),
    [],
  );

  const thumbnailFrame = useMemo(() => Math.min(60, durationInFrames - 1), [durationInFrames]);

  const inputProps = useMemo(
    () => ({
      scenes: ECONOMIST_PREVIEW_SCENES as any,
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

  const sceneOffsets = useMemo(() => buildSceneOffsets(ECONOMIST_PREVIEW_SCENES), []);

  // Thumbnail (side) cards: park on a static frame and never play, so off-center
  // Players don't keep rendering ~30fps each (the carousel slowdown).
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    if (thumbnailMode) {
      p.pause();
      p.seekTo(thumbnailFrame);
      return;
    }
    setActiveSceneIndex(0);
    p.seekTo(0);
    p.play();
  }, [thumbnailMode, thumbnailFrame]);

  useEffect(() => {
    if (thumbnailMode) return;
    const p = playerRef.current;
    if (!p) return;
    const onFrame = () => {
      const f = p.getCurrentFrame();
      let idx = 0;
      for (let i = sceneOffsets.length - 1; i >= 0; i--) {
        if (f >= sceneOffsets[i]) { idx = i; break; }
      }
      setActiveSceneIndex((prev) => (prev === idx ? prev : idx));
    };
    p.addEventListener("frameupdate", onFrame);
    return () => p.removeEventListener("frameupdate", onFrame);
  }, [thumbnailMode, sceneOffsets]);

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: bgColor }}>
      <PlayerScaledCanvas internalWidth={INTERNAL_W} internalHeight={INTERNAL_H}>
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
          style={{ width: INTERNAL_W, height: INTERNAL_H, display: "block" }}
        />
      </PlayerScaledCanvas>

        {!thumbnailMode && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-1">
            {ECONOMIST_PREVIEW_SCENES.map((scene, index) => {
              const isActive = index === activeSceneIndex;
              return (
                <button
                  key={scene.id}
                  onClick={() => { playerRef.current?.seekTo(sceneOffsets[index]); }}
                  className={`h-1.5 rounded-full transition-all ${isActive ? "w-5" : "w-1.5 bg-white/45 hover:bg-white/70"}`}
                  style={isActive ? { background: accentColor } : undefined}
                  aria-label={`Preview ${scene.title} layout`}
                  title={scene.title}
                  type="button"
                />
              );
            })}
          </div>
        )}
    </div>
  );
}
