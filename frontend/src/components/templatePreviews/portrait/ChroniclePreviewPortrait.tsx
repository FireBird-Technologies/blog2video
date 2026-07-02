import { useMemo, useState, useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import PlayerScaledCanvas from "../PlayerScaledCanvas";
import { getTemplateConfig } from "../../remotion/templateConfig";
import { computeChronicleVideoTotalFrames } from "../../remotion/chronicle/ChronicleVideoComposition";

/* eslint-disable @typescript-eslint/no-explicit-any */

const INTERNAL_W = 270;
const INTERNAL_H = 480;
const FPS = 30;

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
    title: "The Ancient Writ",
    durationSeconds: 8,
    narration:
      "Words set down in an age before printing, preserved across centuries in ink and vellum.",
    layout: "parchment_scroll",
    layoutProps: { titleFontSize: 58, descriptionFontSize: 26, category: "Sacred Texts" },
    imageUrl: "/assets/ancient-manuscript.jpg",
  },
  {
    id: 4,
    order: 4,
    title: "The World Below",
    durationSeconds: 7,
    narration: "From above the clouds, the chronicler saw every kingdom and coastline laid bare.",
    layout: "map_reveal",
    layoutProps: { titleFontSize: 48, descriptionFontSize: 22 },
    imageUrl: "/assets/earth-blue-marble.jpg",
  },
];

export default function ChroniclePreviewPortrait({ thumbnailMode = false }: { thumbnailMode?: boolean } = {}) {
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const playerRef = useRef<PlayerRef>(null);

  const config = getTemplateConfig("chronicle");
  const Composition = config.component as React.ComponentType<any>;
  const { accent: accentColor, bg: bgColor, text: textColor } = config.defaultColors;

  // Pass ALL scenes at once (Remotion handles the cuts internally) so the Player
  // props are stable and it never remounts — no flicker.
  const sceneOffsets = useMemo(() => {
    const offs: number[] = [];
    let acc = 0;
    for (const s of CHRONICLE_PREVIEW_SCENES) {
      offs.push(acc);
      acc += computeChronicleVideoTotalFrames([s], 1);
    }
    return offs;
  }, []);
  const durationInFrames = useMemo(
    () => computeChronicleVideoTotalFrames(CHRONICLE_PREVIEW_SCENES, 1),
    [],
  );
  const thumbnailFrame = Math.min(Math.max(0, durationInFrames - 1), 100);

  const inputProps = useMemo(
    () => ({
      scenes: CHRONICLE_PREVIEW_SCENES,
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
          fps={FPS}
          controls={false}
          autoPlay={!thumbnailMode}
          loop={!thumbnailMode}
          acknowledgeRemotionLicense
          style={{ width: INTERNAL_W, height: INTERNAL_H, display: "block" }}
        />
      </PlayerScaledCanvas>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-1">
          {CHRONICLE_PREVIEW_SCENES.map((scene, index) => {
            const isActive = index === activeSceneIndex;
            return (
              <button
                key={scene.id}
                onClick={() => { if (!thumbnailMode) playerRef.current?.seekTo(sceneOffsets[index]); }}
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
