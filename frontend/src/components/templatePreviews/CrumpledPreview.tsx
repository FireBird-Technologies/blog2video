import { useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { getTemplateConfig } from "../remotion/templateConfig";
import { computeCrumpledTimeline } from "../remotion/crumpled/CrumpledVideoComposition";
import PlayerScaledCanvas from "./PlayerScaledCanvas";
import { CRUMPLED_PREVIEW_SCENES } from "./crumpledPreviewScenes";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function CrumpledPreviewPlayer({
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
  const config = getTemplateConfig("crumpled");
  const Composition = config.component as React.ComponentType<any>;
  const { accent: accentColor, bg: bgColor, text: textColor } = config.defaultColors;

  // Same timeline the composition renders from (back-to-back; transitions are padded in).
  const timeline = useMemo(() => computeCrumpledTimeline(CRUMPLED_PREVIEW_SCENES), []);
  const sceneStartFrames = useMemo(() => timeline.entries.map((e) => e.start), [timeline]);
  const durationInFrames = Math.max(1, timeline.totalFrames);
  // Last settled frame of the 6s opening: sheet unfolded, title + subtitle written,
  // just before the transition into scene 2 begins (frame 180).
  const thumbnailFrame = Math.min(durationInFrames - 1, 178);

  const inputProps = useMemo(
    () => ({
      scenes: CRUMPLED_PREVIEW_SCENES,
      accentColor,
      bgColor,
      textColor,
      logo: null,
      logoPosition: "bottom_right",
      logoOpacity: 0,
      logoSize: 0,
      aspectRatio: orientation,
    }),
    [accentColor, bgColor, orientation, textColor],
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
        {CRUMPLED_PREVIEW_SCENES.map((scene, index) => {
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

export default function CrumpledPreview({ thumbnailMode = false }: { thumbnailMode?: boolean } = {}) {
  return <CrumpledPreviewPlayer thumbnailMode={thumbnailMode} />;
}
