import { useMemo, useState, useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { getTemplateConfig } from "../remotion/templateConfig";
import { computeChronicleVideoTotalFrames } from "../remotion/chronicle/ChronicleVideoComposition";

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

const CHRONICLE_PREVIEW_SCENES: DemoScene[] = [
  {
    id: 1,
    order: 1,
    title: "Chronicle",
    durationSeconds: 7,
    narration: "Of ages past, tales unfold upon aged parchment.",
    layout: "book_open",
    layoutProps: { titleFontSize: 96, descriptionFontSize: 30 },
  },
  {
    id: 2,
    order: 2,
    title: "Terra Incognita",
    durationSeconds: 8,
    narration:
      "The cartographers of old charted rivers and borders with patient ink, leaving blank only what they dared not claim.",
    layout: "map_reveal",
    layoutProps: { titleFontSize: 48, descriptionFontSize: 22 },
    imageUrl: "/assets/antique-map-eastern.jpg",
  },
  {
    id: 3,
    order: 3,
    title: "The Carolinas Mapped",
    durationSeconds: 7,
    narration:
      "County by county, the new world was named and fixed upon parchment for generations to read.",
    layout: "map_reveal",
    layoutProps: { titleFontSize: 48, descriptionFontSize: 22 },
    imageUrl: "/assets/antique-map-carolina.jpg",
  },
  {
    id: 4,
    order: 4,
    title: "The Ancient Writ",
    durationSeconds: 8,
    narration:
      "Words set down in an age before printing, preserved across centuries in ink and vellum.",
    layout: "parchment_scroll",
    layoutProps: { titleFontSize: 58, descriptionFontSize: 26, category: "Sacred Texts" },
    imageUrl: "/assets/ancient-manuscript.jpg",
  },
  {
    id: 5,
    order: 5,
    title: "The World Below",
    durationSeconds: 7,
    narration: "From above the clouds, the chronicler saw every kingdom and coastline laid bare.",
    layout: "map_reveal",
    layoutProps: { titleFontSize: 48, descriptionFontSize: 22 },
    imageUrl: "/assets/earth-blue-marble.jpg",
  },
];

export default function ChroniclePreview({
  thumbnailMode = false,
}: { thumbnailMode?: boolean } = {}) {
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const playerRef = useRef<PlayerRef>(null);

  useEffect(() => {
    if (thumbnailMode) setActiveSceneIndex(0);
  }, [thumbnailMode]);

  const activeScene = CHRONICLE_PREVIEW_SCENES[activeSceneIndex];
  const fps = 30;

  const durationInFrames = useMemo(
    () => computeChronicleVideoTotalFrames([activeScene], 1),
    [activeScene],
  );
  const thumbnailFrame = Math.min(Math.max(0, durationInFrames - 1), 100);

  const config = getTemplateConfig("chronicle");
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
      setActiveSceneIndex((i) => (i + 1) % CHRONICLE_PREVIEW_SCENES.length);
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
          {CHRONICLE_PREVIEW_SCENES.map((scene, index) => {
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
