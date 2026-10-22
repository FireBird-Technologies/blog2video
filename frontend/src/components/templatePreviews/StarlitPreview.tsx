import { useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { getTemplateConfig } from "../remotion/templateConfig";
import PlayerScaledCanvas from "./PlayerScaledCanvas";
import { STARLIT_PREVIEW_SCENES } from "./starlitPreviewScenes";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function StarlitPreviewPlayer({
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
  const config = getTemplateConfig("starlit");
  const Composition = config.component as React.ComponentType<any>;
  const { accent: accentColor, bg: bgColor, text: textColor } = config.defaultColors;

  const sceneFrames = useMemo(
    () =>
      STARLIT_PREVIEW_SCENES.map((scene) =>
        Math.max(1, Math.round((Number(scene.durationSeconds) || 5) * fps)),
      ),
    [],
  );
  const sceneStartFrames = useMemo(() => {
    const starts: number[] = [];
    let frame = 0;
    for (const duration of sceneFrames) {
      starts.push(frame);
      frame += duration;
    }
    return starts;
  }, [sceneFrames]);
  const durationInFrames = useMemo(
    () => Math.max(1, sceneFrames.reduce((total, duration) => total + duration, 0)),
    [sceneFrames],
  );
  const thumbnailFrame = Math.min(durationInFrames - 1, 110);

  const inputProps = useMemo(
    () => ({
      scenes: STARLIT_PREVIEW_SCENES,
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
      setActiveSceneIndex((previous) =>
        previous === sceneIndex ? previous : sceneIndex,
      );
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
  const compositionWidth = portrait ? 1080 : 1920;
  const compositionHeight = portrait ? 1920 : 1080;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: bgColor }}
    >
      <PlayerScaledCanvas
        internalWidth={internalWidth}
        internalHeight={internalHeight}
      >
        <Player
          ref={playerRef}
          component={Composition}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          initialFrame={thumbnailMode ? thumbnailFrame : 0}
          compositionWidth={compositionWidth}
          compositionHeight={compositionHeight}
          fps={fps}
          controls={false}
          autoPlay={!thumbnailMode}
          loop={!thumbnailMode}
          acknowledgeRemotionLicense
          style={{
            width: internalWidth,
            height: internalHeight,
            display: "block",
          }}
        />
      </PlayerScaledCanvas>

      <div
        className={`absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/45 px-2 py-1 ${
          portrait ? "bottom-3" : "bottom-2"
        }`}
      >
        {STARLIT_PREVIEW_SCENES.map((scene, index) => {
          const isActive = index === activeSceneIndex;
          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => seekToScene(index)}
              disabled={thumbnailMode}
              className={`h-1.5 rounded-full transition-all ${
                isActive ? "w-5" : "w-1.5 bg-white/45 hover:bg-white/70"
              }`}
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

export default function StarlitPreview({
  thumbnailMode = false,
}: { thumbnailMode?: boolean } = {}) {
  return <StarlitPreviewPlayer thumbnailMode={thumbnailMode} />;
}
