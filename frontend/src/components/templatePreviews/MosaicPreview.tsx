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

const MOSAIC_PREVIEW_SCENES: DemoScene[] = [
  {
    id: 1,
    order: 1,
    title: "Mosaic Title",
    durationSeconds: 7,
    narration: "Warm stone tessera fields with terracotta linework.",
    layout: "mosaic_title",
    layoutProps: {},
  },
  {
    id: 2,
    order: 2,
    title: "Mosaic Stream",
    durationSeconds: 8,
    narration: "Handcrafted editorial layouts on soft beige.",
    layout: "mosaic_stream",
    layoutProps: {
      items: [
        "Lay warm stone pattern",
        "Inlay fine terracotta linework",
        "Blend soft cream and earthen tones",
      ],
    },
  },
  {
    id: 3,
    order: 3,
    title: "Mosaic Metric",
    durationSeconds: 7,
    narration: "Precision crafted in every tessera tile.",
    layout: "mosaic_metric",
    layoutProps: {
      metrics: [{ value: "97", label: "craft precision", suffix: "%" }],
    },
  },
];

// Use the template-configured default colors so previews match defaults

export default function MosaicPreview() {
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const activeScene = MOSAIC_PREVIEW_SCENES[activeSceneIndex];
  const fps = 30;
  const durationInFrames = Math.round(activeScene.durationSeconds * fps) + 45;
  const config = getTemplateConfig("mosaic");
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
    const ms = Math.max(500, Math.round(activeScene.durationSeconds * 1000));
    const t = setTimeout(() => {
      setActiveSceneIndex((i) => (i + 1) % MOSAIC_PREVIEW_SCENES.length);
    }, ms);
    return () => clearTimeout(t);
  }, [activeSceneIndex, activeScene.durationSeconds]);

  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9", background: bgColor }}>
        <Player
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

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-1">
          {MOSAIC_PREVIEW_SCENES.map((scene, index) => {
            const isActive = index === activeSceneIndex;
            return (
              <button
                key={scene.id}
                onClick={() => setActiveSceneIndex(index)}
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
