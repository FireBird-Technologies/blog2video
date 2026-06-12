import { useMemo, useState, useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { getTemplateConfig } from "../remotion/templateConfig";
import { computeEconomistVideoTotalFrames } from "../remotion/economist/EconomistVideoComposition";

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

const ECONOMIST_PREVIEW_SCENES: DemoScene[] = [
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
];

export default function EconomistPreview({
  thumbnailMode = false,
}: { thumbnailMode?: boolean } = {}) {
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const playerRef = useRef<PlayerRef>(null);

  useEffect(() => {
    if (thumbnailMode) setActiveSceneIndex(0);
  }, [thumbnailMode]);

  const activeScene = ECONOMIST_PREVIEW_SCENES[activeSceneIndex];
  const fps = 30;

  const durationInFrames = useMemo(
    () => computeEconomistVideoTotalFrames([activeScene], 1),
    [activeScene],
  );
  const thumbnailFrame = Math.min(Math.max(0, durationInFrames - 1), 120);

  const config = getTemplateConfig("economist");
  const Composition = config.component as React.ComponentType<any>;

  const { accent: accentColor, bg: bgColor, text: textColor } = config.defaultColors;

  const inputProps = useMemo(
    () => ({
      scenes: [activeScene],
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
    const ms = Math.max(500, Math.round((durationInFrames / fps) * 1000));
    const t = setTimeout(() => {
      setActiveSceneIndex((i) => (i + 1) % ECONOMIST_PREVIEW_SCENES.length);
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
          {ECONOMIST_PREVIEW_SCENES.map((scene, index) => {
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
