import { useMemo, useState, useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { getTemplateConfig } from "../../remotion/templateConfig";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Portrait canvas wrapper (9:16). Fixed-pixel internal size + a CSS scale on
// THIS element keeps Remotion's <Player> (which measures its own container via
// useElementSize) stable under the carousel's ancestor scale()/rotateY() — a
// plain width/height:100% Player re-measures against the transformed box and
// flickers / collapses. (Same pattern as Blackswan/Newscast portraits.)
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

const FPS = 30;
// Per-scene frame budget the preview composition uses (duration + padding).
function sceneFrames(s: DemoScene): number {
  return Math.round(s.durationSeconds * FPS) + 45;
}

export default function MosaicPreviewPortrait({ thumbnailMode = false }: { thumbnailMode?: boolean } = {}) {
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const config = getTemplateConfig("mosaic");
  const Composition = config.component as React.ComponentType<any>;
  const { accent: accentColor, bg: bgColor, text: textColor } = config.defaultColors;

  // Pass ALL scenes at once so Remotion's TransitionSeries cuts between them
  // internally — the Player props never change, so it never remounts (no flicker).
  const sceneOffsets = useMemo(() => {
    const offs: number[] = [];
    let acc = 0;
    for (const s of MOSAIC_PREVIEW_SCENES) { offs.push(acc); acc += sceneFrames(s); }
    return offs;
  }, []);
  const durationInFrames = useMemo(
    () => MOSAIC_PREVIEW_SCENES.reduce((sum, s) => sum + sceneFrames(s), 0),
    [],
  );
  const thumbnailFrame = Math.min(Math.max(0, durationInFrames - 1), 100);

  const inputProps = useMemo(
    () => ({
      scenes: MOSAIC_PREVIEW_SCENES,
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

  // Keep the active dot in sync with playback (no scene-swap → no remount).
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
    <ScaledCanvas>
      <div style={{ width: "100%", height: "100%", position: "relative", background: bgColor }}>
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

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-1">
          {MOSAIC_PREVIEW_SCENES.map((scene, index) => {
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
    </ScaledCanvas>
  );
}
