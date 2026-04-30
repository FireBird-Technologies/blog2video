import { useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  ChronicleVideoComposition,
  type ChronicleSceneInput,
} from "../remotion/chronicle/ChronicleVideoComposition";

const INTERNAL_W = 480;
const INTERNAL_H = 270;
const FPS = 30;

const ACCENT = "#B8860B";
const TEXT = "#2A1810";
const BG = "#F1E4C9";

function ScaledCanvas({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.getBoundingClientRect().width / INTERNAL_W);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        width: "100%",
        aspectRatio: `${INTERNAL_W}/${INTERNAL_H}`,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          width: INTERNAL_W,
          height: INTERNAL_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "absolute",
        }}
      >
        {children}
      </div>
    </div>
  );
}

const PREVIEW_SCENES: ChronicleSceneInput[] = [
  {
    id: 1,
    order: 1,
    title: "Chronicle",
    narration: "Of ages past, tales unfold upon aged parchment.",
    layout: "book_open",
    layoutProps: { titleFontSize: 96, descriptionFontSize: 30 },
    durationSeconds: 3.4,
  },
  {
    id: 2,
    order: 2,
    title: "Terra Incognita",
    narration: "The cartographers of old charted rivers and borders with patient ink, leaving blank only what they dared not claim.",
    layout: "map_reveal",
    layoutProps: { titleFontSize: 48, descriptionFontSize: 22 },
    imageUrl: "/assets/antique-map-eastern.jpg",
    durationSeconds: 3.2,
  },
  {
    id: 3,
    order: 3,
    title: "The Carolinas Mapped",
    narration: "County by county, the new world was named and fixed upon parchment for generations to read.",
    layout: "map_reveal",
    layoutProps: { titleFontSize: 48, descriptionFontSize: 22 },
    imageUrl: "/assets/antique-map-carolina.jpg",
    durationSeconds: 3.0,
  },
  {
    id: 4,
    order: 4,
    title: "The Ancient Writ",
    narration: "Words set down in an age before printing, preserved across centuries in ink and vellum.",
    layout: "parchment_scroll",
    layoutProps: { titleFontSize: 58, descriptionFontSize: 26, category: "Sacred Texts" },
    imageUrl: "/assets/ancient-manuscript.jpg",
    durationSeconds: 3.0,
  },
  {
    id: 5,
    order: 5,
    title: "The World Below",
    narration: "From above the clouds, the chronicler saw every kingdom and coastline laid bare.",
    layout: "map_reveal",
    layoutProps: { titleFontSize: 48, descriptionFontSize: 22 },
    imageUrl: "/assets/earth-blue-marble.jpg",
    durationSeconds: 3.0,
  },
];

function totalDurationFrames(scenes: ChronicleSceneInput[], fps: number): number {
  return scenes.reduce((sum, s) => sum + Math.round(s.durationSeconds * fps), 0);
}

function sceneStarts(scenes: ChronicleSceneInput[], fps: number): number[] {
  let acc = 0;
  return scenes.map((s) => {
    const start = acc;
    acc += Math.round(s.durationSeconds * fps);
    return start;
  });
}

function sceneIndexAtFrame(
  frame: number,
  scenes: ChronicleSceneInput[],
  fps: number,
  total: number,
): number {
  const f = ((frame % total) + total) % total;
  const starts = sceneStarts(scenes, fps);
  for (let i = starts.length - 1; i >= 0; i--) {
    if (f >= starts[i]) return i;
  }
  return 0;
}

function SlideDots({
  total,
  current,
  onDotClick,
}: {
  total: number;
  current: number;
  onDotClick: (i: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 5,
        position: "absolute",
        bottom: 9,
        right: 11,
        zIndex: 10,
      }}
    >
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Scene ${i + 1}`}
          onClick={() => onDotClick(i)}
          style={{
            width: i === current ? 16 : 6,
            height: 6,
            borderRadius: 3,
            background: i === current ? ACCENT : `${ACCENT}55`,
            border: "none",
            cursor: "pointer",
            padding: 0,
            transition: "all 0.3s ease",
            boxShadow: i === current ? `0 0 6px ${ACCENT}99` : "none",
          }}
        />
      ))}
    </div>
  );
}

export default function ChroniclePreview() {
  const playerRef = useRef<PlayerRef>(null);
  const [sceneIndex, setSceneIndex] = useState(0);

  const durationInFrames = useMemo(
    () => totalDurationFrames(PREVIEW_SCENES, FPS),
    [],
  );
  const starts = useMemo(() => sceneStarts(PREVIEW_SCENES, FPS), []);

  const inputProps = useMemo(
    () => ({
      scenes: PREVIEW_SCENES,
      accentColor: ACCENT,
      bgColor: BG,
      textColor: TEXT,
      aspectRatio: "landscape" as const,
    }),
    [],
  );

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onFrame = () => {
      const frame = p.getCurrentFrame();
      setSceneIndex(sceneIndexAtFrame(frame, PREVIEW_SCENES, FPS, durationInFrames));
    };
    p.addEventListener("frameupdate", onFrame);
    onFrame();
    return () => p.removeEventListener("frameupdate", onFrame);
  }, [durationInFrames]);

  const seekToScene = (i: number) => {
    const p = playerRef.current;
    if (!p) return;
    const start = starts[i] ?? 0;
    p.seekTo(start);
    p.play();
    setSceneIndex(i);
  };

  return (
    <ScaledCanvas>
      <div style={{ width: "100%", height: "100%", position: "relative", background: BG }}>
        <Player
          ref={playerRef}
          component={ChronicleVideoComposition}
          durationInFrames={durationInFrames}
          compositionWidth={1920}
          compositionHeight={1080}
          fps={FPS}
          inputProps={inputProps}
          controls={false}
          autoPlay
          loop
          acknowledgeRemotionLicense
          style={{
            width: INTERNAL_W,
            height: INTERNAL_H,
            display: "block",
          }}
        />
        <SlideDots
          total={PREVIEW_SCENES.length}
          current={sceneIndex}
          onDotClick={seekToScene}
        />
      </div>
    </ScaledCanvas>
  );
}
