import { useMemo, useState, useEffect } from "react";
import { Player } from "@remotion/player";
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

const NEWCAST_PREVIEW_SCENES: DemoScene[] = [
  {
    id: 1,
    order: 1,
    title: "Opening",
    durationSeconds: 7,
    narration: "Newscast opening with cinematic title and ticker.",
    layout: "opening",
    layoutProps: {
      title: "Newscast Broadcast Desk",
      tickerItems: ["BREAKING", "LIVE COVERAGE", "WORLD DESK", "UPDATES"],
      lowerThirdTag: "LIVE",
      lowerThirdHeadline: "Template preview",
      lowerThirdSub: "Cinematic opener with map backdrop, chrome, and glass stack",
    },
  },
  {
    id: 2,
    order: 2,
    title: "Narrative",
    durationSeconds: 8,
    narration: "Anchor narrative block for explanatory story sections.",
    layout: "anchor_narrative",
    layoutProps: {
      title: "Anchor Narrative for briefings",
      category: "WORLD AFFAIRS",
      tickerItems: ["CONTEXT", "ANALYSIS", "ON THE RECORD"],
      lowerThirdTag: "BRIEFING",
      lowerThirdHeadline: "Main story beat",
      lowerThirdSub: "Narrative glass card with editorial pacing",
    },
  },
  {
    id: 3,
    order: 3,
    title: "Metrics",
    durationSeconds: 7,
    narration: "Metric board for stats and hard numbers.",
    layout: "live_metrics_board",
    layoutProps: {
      metrics: [
        { value: "48", label: "Markets up", suffix: "%" },
        { value: "12", label: "Nations signed", suffix: "" },
      ],
      tickerItems: ["DATA", "MARKETS", "NUMBERS"],
      lowerThirdTag: "DATA",
      lowerThirdHeadline: "Key figures",
      lowerThirdSub: "On-air metrics with glow treatment",
    },
  },
  {
    id: 4,
    order: 4,
    title: "Quote",
    durationSeconds: 7,
    narration: "Kinetic insight quote for key takeaways.",
    layout: "headline_insight",
    layoutProps: {
      quote: "The story is not the headline — it is the verification behind it.",
      highlightWord: "verification",
      attribution: "— Editor in Chief · March 2026",
      tickerItems: ["QUOTE", "INSIGHT"],
      lowerThirdTag: "TAKEAWAY",
      lowerThirdHeadline: "Key line",
      lowerThirdSub: "Pull quote with kinetic emphasis",
    },
  },
];

const TEMPLATE_COLORS = { accent: "#E82020", bg: "#060614", text: "#B8C8E0" } as const;
const AUTO_SWITCH_INTERVAL = 6000; // Switch scenes every 6 seconds

export default function NewscastPreview() {
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);

  // ─── Auto Scene Switch Logic ───
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSceneIndex((prev) => (prev + 1) % NEWCAST_PREVIEW_SCENES.length);
    }, AUTO_SWITCH_INTERVAL);

    return () => clearInterval(timer);
  }, []);

  const activeScene = NEWCAST_PREVIEW_SCENES[activeSceneIndex];
  const fps = 30;
  const durationInFrames = Math.round(activeScene.durationSeconds * fps) + 45;
  const config = getTemplateConfig("newscast");
  const Composition = config.component as React.ComponentType<any>;

  const inputProps = useMemo(
    () => ({
      ...activeScene.layoutProps, // Spread props directly if template expects them at root
      scenes: [activeScene],
      accentColor: TEMPLATE_COLORS.accent,
      bgColor: TEMPLATE_COLORS.bg,
      textColor: TEMPLATE_COLORS.text,
      logo: null,
      logoPosition: "bottom_right",
      logoOpacity: 0,
      logoSize: 0,
      aspectRatio: "landscape",
    }),
    [activeScene]
  );

  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden shadow-2xl rounded-xl" style={{ aspectRatio: "16/9", background: TEMPLATE_COLORS.bg }}>
        <Player
          key={activeSceneIndex} // CRITICAL: Restarts animation on scene change
          component={Composition}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          compositionWidth={1920}
          compositionHeight={1080}
          fps={fps}
          controls={false}
          autoPlay
          loop
          acknowledgeRemotionLicense
          style={{ width: "100%", height: "100%", display: "block" }}
        />

        {/* Navigation dots — compact, no scene titles */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full bg-black/35 backdrop-blur-sm px-2 py-1 border border-white/10">
          {NEWCAST_PREVIEW_SCENES.map((scene, index) => {
            const isActive = index === activeSceneIndex;
            return (
              <button
                key={scene.id}
                onClick={() => setActiveSceneIndex(index)}
                className={`rounded-full transition-all duration-500 ${
                  isActive
                    ? "h-0.5 w-3 bg-red-500 shadow-[0_0_6px_rgba(232,32,32,0.5)]"
                    : "h-[3px] w-[3px] bg-white/35 hover:bg-white/55"
                }`}
                aria-label={`Preview scene ${index + 1} of ${NEWCAST_PREVIEW_SCENES.length}`}
                type="button"
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}