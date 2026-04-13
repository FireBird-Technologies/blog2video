import { useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import "@fontsource/righteous/400.css";
import {
  BlackswanVideoComposition,
  type BlackswanSceneInput,
} from "../remotion/blackswan/BlackswanVideoComposition";

// ─── Canvas wrapper (16:9 preview card) ─────────────────────────────────────
const INTERNAL_W = 480;
const INTERNAL_H = 270;
const FPS = 30;

const ACCENT = "#00E5FF";
const TEXT = "#DFFFFF";
const BG = "#000000";

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

/** Short carousel: hero, code matrix, dive insight, signal split — same registry as full renders. */
const PREVIEW_SCENES: BlackswanSceneInput[] = [
  {
    id: 1,
    order: 1,
    title: "BLACKSWAN",
    narration: "Neon depth. Cinematic motion. Your story, frame by frame.",
    layout: "droplet_intro",
    layoutProps: {},
    durationSeconds: 3,
  },
  {
    id: 2,
    order: 2,
    title: "Reactor",
    narration: "Compose the pipeline. Stream the frames. Ship the cut.",
    layout: "reactor_code",
    layoutProps: {
      codeLanguage: "ts",
      codeLines: [
        "// blackswan — matrix stream",
        "const signal = await ingest(url);",
        "const story = compose(signal, { neon: true });",
        "export const frames = render(story);",
      ],
    },
    durationSeconds: 2.8,
  },
  {
    id: 3,
    order: 3,
    title: "Dive insight",
    narration: "The flock reads the current. The quote anchors the beat.",
    layout: "dive_insight",
    layoutProps: {
      quote: "What you measure is what moves.",
      highlightWord: "measure",
    },
    durationSeconds: 3,
  },
  {
    id: 4,
    order: 4,
    title: "Signal split",
    narration: "Two lenses on the same truth — compare, then commit.",
    layout: "signal_split",
    layoutProps: {
      leftLabel: "Draft",
      rightLabel: "Ship",
      leftDescription: "Fast iteration loops",
      rightDescription: "Stable, reviewable output",
    },
    durationSeconds: 2.8,
  },
];

function totalDurationFrames(scenes: BlackswanSceneInput[], fps: number): number {
  return scenes.reduce((sum, s) => sum + Math.round(s.durationSeconds * fps), 0);
}

function sceneStarts(scenes: BlackswanSceneInput[], fps: number): number[] {
  let acc = 0;
  return scenes.map((s) => {
    const start = acc;
    acc += Math.round(s.durationSeconds * fps);
    return start;
  });
}

function sceneIndexAtFrame(frame: number, scenes: BlackswanSceneInput[], fps: number, total: number): number {
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
            background: i === current ? ACCENT : `${ACCENT}33`,
            border: "none",
            cursor: "pointer",
            padding: 0,
            transition: "all 0.3s ease",
            boxShadow: i === current ? `0 0 6px ${ACCENT}` : "none",
          }}
        />
      ))}
    </div>
  );
}

export default function BlackswanPreview() {
  const playerRef = useRef<PlayerRef>(null);
  const [sceneIndex, setSceneIndex] = useState(0);

  const durationInFrames = useMemo(
    () => totalDurationFrames(PREVIEW_SCENES, FPS),
    []
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
    []
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
          component={BlackswanVideoComposition}
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
