import { useMemo, useState, useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { getTemplateConfig } from "../../remotion/templateConfig";
import { MAGAZINE_PREVIEW_SCENES } from "../MagazinePreview";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Portrait canvas (9:16). Fixed-pixel Player inside a CSS-scaled box keeps
// Remotion's useElementSize stable under the carousel's ancestor transforms.
const INTERNAL_W = 270;
const INTERNAL_H = 480;

function ScaledCanvas({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const s = Math.max(el.offsetWidth / INTERNAL_W, el.offsetHeight / INTERNAL_H);
      if (s > 0) setScale(s);
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width: "100%", aspectRatio: `${INTERNAL_W}/${INTERNAL_H}`, overflow: "hidden", position: "relative" }}>
      <div style={{ width: INTERNAL_W, height: INTERNAL_H, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute" }}>
        {children}
      </div>
    </div>
  );
}

export default function MagazinePreviewPortrait({
  thumbnailMode = false,
}: { thumbnailMode?: boolean } = {}) {
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const playerRef = useRef<PlayerRef>(null);

  useEffect(() => {
    if (thumbnailMode) setActiveSceneIndex(0);
  }, [thumbnailMode]);

  const activeScene = MAGAZINE_PREVIEW_SCENES[activeSceneIndex];
  const fps = 30;

  const durationInFrames = useMemo(
    () => Math.max(1, Math.round((Number(activeScene.durationSeconds) || 5) * fps)),
    [activeScene],
  );
  const thumbnailFrame = Math.min(Math.max(0, durationInFrames - 1), 130);

  const config = getTemplateConfig("magazine");
  const Composition = config.component as React.ComponentType<any>;
  const { accent: accentColor, bg: bgColor, text: textColor } = config.defaultColors;

  const inputProps = useMemo(
    () => ({
      scenes: [activeScene],
      projectName: "Atlas Review",
      accentColor,
      bgColor,
      textColor,
      logo: null,
      logoPosition: "bottom_right",
      logoOpacity: 0,
      logoSize: 0,
      aspectRatio: "portrait",
    }),
    [activeScene, accentColor, bgColor, textColor],
  );

  useEffect(() => {
    if (!thumbnailMode) return;
    const p = playerRef.current;
    if (!p) return;
    p.pause();
    p.seekTo(thumbnailFrame);
  }, [thumbnailMode, thumbnailFrame, activeSceneIndex]);

  useEffect(() => {
    if (thumbnailMode) return;
    const ms = Math.max(500, Math.round((durationInFrames / fps) * 1000));
    const t = setTimeout(() => {
      setActiveSceneIndex((i) => (i + 1) % MAGAZINE_PREVIEW_SCENES.length);
    }, ms);
    return () => clearTimeout(t);
  }, [activeSceneIndex, durationInFrames, fps, thumbnailMode]);

  return (
      <div className="relative w-full overflow-hidden" style={{ background: bgColor }}>
        <ScaledCanvas>
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
        </ScaledCanvas>

        {!thumbnailMode && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-1">
            {MAGAZINE_PREVIEW_SCENES.map((scene, index) => {
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
        )}
      </div>
  );
}
