import { useMemo, useState, useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import PlayerScaledCanvas from "./PlayerScaledCanvas";
import { getTemplateConfig } from "../remotion/templateConfig";
import { computeSakuraVideoTotalFrames } from "../remotion/sakura/SakuraVideoComposition";
import { SAKURA_PREVIEW_SCENES } from "./sakuraPreviewScenes";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function SakuraPreview({
  thumbnailMode = false,
}: { thumbnailMode?: boolean } = {}) {
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const fps = 30;
  const config = getTemplateConfig("sakura");
  const Composition = config.component as React.ComponentType<any>;
  const { accent: accentColor, bg: bgColor, text: textColor } = config.defaultColors;

  // Play the WHOLE Sakura timeline (intro → stat → quote → ending → loop) WITH
  // the template's own petal transitions — exactly like the real video. The
  // composition renders the TransitionSeries internally; we only need its total
  // length so the Player's declared duration matches (no clipped/raced scenes).
  const durationInFrames = useMemo(
    () => Math.max(1, computeSakuraVideoTotalFrames(SAKURA_PREVIEW_SCENES)),
    [],
  );

  // Approximate per-scene start frames for the dot indicator. Sakura doesn't
  // export a start-frame array (it plans overlaps internally), and the small
  // transition overlap only shifts a boundary by a few frames — close enough to
  // keep the active dot in sync while scrubbing.
  const sceneStartFrames = useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    for (const s of SAKURA_PREVIEW_SCENES) {
      starts.push(acc);
      acc += Math.max(1, Math.round((Number(s.durationSeconds) || 5) * fps));
    }
    return starts;
  }, []);

  // Freeze on a settled intro frame for the static thumbnail.
  const thumbnailFrame = Math.min(Math.max(0, durationInFrames - 1), 80);

  const inputProps = useMemo(
    () => ({
      scenes: SAKURA_PREVIEW_SCENES,
      accentColor,
      bgColor,
      textColor,
      logo: null,
      logoPosition: "bottom_right",
      logoOpacity: 0,
      logoSize: 0,
      aspectRatio: "landscape",
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
    <div className="w-full">
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9", background: bgColor }}>
        <PlayerScaledCanvas>
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
        </PlayerScaledCanvas>

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-1">
          {SAKURA_PREVIEW_SCENES.map((scene, index) => {
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
    </div>
  );
}
