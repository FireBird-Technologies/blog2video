import { useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { getTemplateConfig } from "../remotion/templateConfig";
import { computeChristmasTimeline } from "../remotion/christmas/ChristmasVideoComposition";
import PlayerScaledCanvas from "./PlayerScaledCanvas";
import { CHRISTMAS_PREVIEW_SCENES } from "./christmasPreviewScenes";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function ChristmasPreviewPlayer({
  thumbnailMode = false,
  orientation = "landscape",
}: {
  thumbnailMode?: boolean;
  orientation?: "landscape" | "portrait";
}) {
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const fps = 30;
  const portrait = orientation === "portrait";
  const config = getTemplateConfig("christmas");
  const Composition = config.component as React.ComponentType<any>;
  const { accent: accentColor, bg: bgColor, text: textColor } = config.defaultColors;

  // Poster / static thumbnail only: the opening runs 12s instead of 6s. The sleigh's
  // flight scales with the scene length (the sign + text keep their fixed timing), so
  // a frame exists where the text is fully in AND Santa is mid-sky on his left → right
  // pass. The live (playing) preview keeps the normal scenes.
  // Portrait: the near-pass team is wider than the frame, so the poster shrinks it
  // (hidden `sleighScale`) and stretches the opening to 15.5s, putting the WHOLE team —
  // Santa and both reindeer — centred in the sky at the poster frame.
  const scenes = useMemo(
    () =>
      thumbnailMode
        ? CHRISTMAS_PREVIEW_SCENES.map((s, i) =>
            i === 0
              ? portrait
                ? { ...s, durationSeconds: 15.5, layoutProps: { ...s.layoutProps, sleighScale: 0.62 } }
                : { ...s, durationSeconds: 12 }
              : s,
          )
        : CHRISTMAS_PREVIEW_SCENES,
    [thumbnailMode, portrait],
  );
  // Same timeline the composition renders from (back-to-back; transitions are padded in).
  const timeline = useMemo(() => computeChristmasTimeline(scenes), [scenes]);
  const sceneStartFrames = useMemo(() => timeline.entries.map((e) => e.start), [timeline]);
  const durationInFrames = Math.max(1, timeline.totalFrames);
  // Poster frame: the sign has settled with its title + line written (done by ~104),
  // and Santa's sleigh team is mid-pass, heading left → right across the sky above it
  // — Santa and both reindeer in frame (landscape: 12s opening; portrait: 15.5s with a
  // smaller team).
  const thumbnailFrame = Math.min(durationInFrames - 1, 106);

  const inputProps = useMemo(
    () => ({
      scenes,
      accentColor,
      bgColor,
      textColor,
      logo: null,
      logoPosition: "bottom_right",
      logoOpacity: 0,
      logoSize: 0,
      aspectRatio: orientation,
    }),
    [accentColor, bgColor, orientation, textColor, scenes],
  );

  useEffect(() => {
    if (!thumbnailMode) return;
    const player = playerRef.current;
    if (!player) return;
    player.pause();
    player.seekTo(thumbnailFrame);
  }, [thumbnailFrame, thumbnailMode]);

  useEffect(() => {
    if (thumbnailMode) return;
    const player = playerRef.current;
    if (!player) return;
    setActiveSceneIndex(0);
    player.seekTo(0);
    player.play();
  }, [thumbnailMode]);

  useEffect(() => {
    if (thumbnailMode) return;
    const player = playerRef.current;
    if (!player) return;
    const onFrame = () => {
      const currentFrame = player.getCurrentFrame();
      let sceneIndex = 0;
      for (let index = sceneStartFrames.length - 1; index >= 0; index -= 1) {
        if (currentFrame >= sceneStartFrames[index]) {
          sceneIndex = index;
          break;
        }
      }
      setActiveSceneIndex((previous) => (previous === sceneIndex ? previous : sceneIndex));
    };
    player.addEventListener("frameupdate", onFrame);
    return () => player.removeEventListener("frameupdate", onFrame);
  }, [sceneStartFrames, thumbnailMode]);

  const seekToScene = (index: number) => {
    setActiveSceneIndex(index);
    const player = playerRef.current;
    if (!player) return;
    player.seekTo(sceneStartFrames[index] ?? 0);
    if (!thumbnailMode) player.play();
  };

  const internalWidth = portrait ? 270 : 480;
  const internalHeight = portrait ? 480 : 270;

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: bgColor }}>
      <PlayerScaledCanvas internalWidth={internalWidth} internalHeight={internalHeight}>
        <Player
          ref={playerRef}
          component={Composition}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          initialFrame={thumbnailMode ? thumbnailFrame : 0}
          compositionWidth={portrait ? 1080 : 1920}
          compositionHeight={portrait ? 1920 : 1080}
          fps={fps}
          controls={false}
          autoPlay={!thumbnailMode}
          loop={!thumbnailMode}
          acknowledgeRemotionLicense
          style={{ width: internalWidth, height: internalHeight, display: "block" }}
        />
      </PlayerScaledCanvas>

      <div
        className={`absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/35 px-2 py-1 ${
          portrait ? "bottom-3" : "bottom-2"
        }`}
      >
        {CHRISTMAS_PREVIEW_SCENES.map((scene, index) => {
          const isActive = index === activeSceneIndex;
          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => seekToScene(index)}
              disabled={thumbnailMode}
              className={`h-1.5 rounded-full transition-all ${isActive ? "w-5" : "w-1.5 bg-white/55 hover:bg-white/80"}`}
              style={isActive ? { background: accentColor } : undefined}
              aria-label={`Preview ${scene.title} layout`}
              title={scene.title}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function ChristmasPreview({ thumbnailMode = false }: { thumbnailMode?: boolean } = {}) {
  return <ChristmasPreviewPlayer thumbnailMode={thumbnailMode} />;
}
