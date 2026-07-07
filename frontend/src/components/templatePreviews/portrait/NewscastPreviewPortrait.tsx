import { useMemo, useState, useEffect, useRef } from "react";
<<<<<<< HEAD
import { Player } from "@remotion/player";
=======
import { Player, type PlayerRef } from "@remotion/player";
import PlayerScaledCanvas from "../PlayerScaledCanvas";
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
import { getTemplateConfig } from "../../remotion/templateConfig";

/* eslint-disable @typescript-eslint/no-explicit-any */

<<<<<<< HEAD
// ─── Enlarged Logical Dimensions (9:16)
// Lower values here make the content (text/images) appear larger in the box
const INTERNAL_W = 240; 
const INTERNAL_H = 426; 
const AUTO_PLAY_DURATION = 5000; // Switch every 5 seconds

function ScaledCanvas({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setScale(rect.width / INTERNAL_W);
    };
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
        maxWidth: "400px", // Simple rectangle width
        margin: "0 auto",
        aspectRatio: `${INTERNAL_W}/${INTERNAL_H}`, 
        overflow: "hidden", 
        position: "relative",
        backgroundColor: "#000",
      }}
    >
      <div style={{ 
        width: INTERNAL_W, 
        height: INTERNAL_H, 
        transform: `scale(${scale})`, 
        transformOrigin: "top left", 
        position: "absolute" 
      }}>
        {children}
      </div>
    </div>
  );
}
=======
const INTERNAL_W = 270;
const INTERNAL_H = 480;
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb

const NEWCAST_PREVIEW_SCENES = [
  {
    id: 1,
    title: "Opening",
    durationSeconds: 7,
    layout: "opening",
    layoutProps: {
      title: "Newscast Portrait",
      tickerItems: ["BREAKING", "LIVE COVERAGE"],
      lowerThirdTag: "LIVE",
      lowerThirdHeadline: "Portrait Preview",
      lowerThirdSub: "Cinematic vertical opener",
    },
  },
  {
    id: 2,
    title: "Narrative",
    durationSeconds: 8,
    layout: "anchor_narrative",
    layoutProps: {
      title: "Vertical Storytelling",
      category: "WORLD AFFAIRS",
      tickerItems: ["CONTEXT", "ANALYSIS"],
      lowerThirdTag: "BRIEFING",
      lowerThirdHeadline: "Story Beat",
      lowerThirdSub: "Editorial glass cards for mobile",
    },
  },
  {
    id: 3,
    title: "Metrics",
    durationSeconds: 7,
    layout: "live_metrics_board",
    layoutProps: {
      metrics: [
        { value: "98", label: "Mobile Reach", suffix: "%" },
        { value: "15", label: "Direct Feeds", suffix: "" },
      ],
      tickerItems: ["DATA", "MARKETS"],
      lowerThirdTag: "DATA",
      lowerThirdHeadline: "Key Metrics",
      lowerThirdSub: "Vertical data visualization",
    },
  },
  {
    id: 4,
    title: "Quote",
    durationSeconds: 7,
    layout: "headline_insight",
    layoutProps: {
      quote: "The future of news is vertical, kinetic, and verified.",
      highlightWord: "vertical",
      attribution: "— Editorial Board · 2026",
      tickerItems: ["QUOTE", "INSIGHT"],
      lowerThirdTag: "TAKEAWAY",
      lowerThirdHeadline: "Key Insight",
      lowerThirdSub: "Kinetic typography for Reels/TikTok",
    },
  },
];

const T_COLORS = { accent: "#E82020", bg: "#060614", text: "#B8C8E0" };

<<<<<<< HEAD
export default function NewscastPreviewPortrait() {
  const [activeIdx, setActiveIdx] = useState(0);
  const activeScene = NEWCAST_PREVIEW_SCENES[activeIdx];
  
  const fps = 30;
  const durationInFrames = Math.round(activeScene.durationSeconds * fps) + 45;
  const config = getTemplateConfig("newscast");
  const Composition = config.component as React.ComponentType<any>;

  // ─── Automatic Switching ───
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % NEWCAST_PREVIEW_SCENES.length);
    }, AUTO_PLAY_DURATION);
    return () => clearInterval(timer);
  }, []);

  const inputProps = useMemo(() => ({
    ...activeScene.layoutProps,
    scenes: [activeScene],
=======
const FPS = 30;
function sceneFrames(s: { durationSeconds: number }): number {
  return Math.round(s.durationSeconds * FPS) + 45;
}

export default function NewscastPreviewPortrait({ thumbnailMode = false }: { thumbnailMode?: boolean } = {}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const config = getTemplateConfig("newscast");
  const Composition = config.component as React.ComponentType<any>;

  // Pass ALL scenes at once so Remotion cuts between them internally — the Player
  // props never change, so it never remounts (avoids the per-scene flicker).
  const sceneOffsets = useMemo(() => {
    const offs: number[] = [];
    let acc = 0;
    for (const s of NEWCAST_PREVIEW_SCENES) { offs.push(acc); acc += sceneFrames(s); }
    return offs;
  }, []);
  const durationInFrames = useMemo(
    () => NEWCAST_PREVIEW_SCENES.reduce((sum, s) => sum + sceneFrames(s), 0),
    [],
  );
  const thumbnailFrame = Math.min(Math.max(0, durationInFrames - 1), 100);

  const inputProps = useMemo(() => ({
    scenes: NEWCAST_PREVIEW_SCENES,
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
    accentColor: T_COLORS.accent,
    bgColor: T_COLORS.bg,
    textColor: T_COLORS.text,
    aspectRatio: "portrait",
<<<<<<< HEAD
  }), [activeScene]);

  return (
    <div style={{ width: "100%" }}>
      <ScaledCanvas>
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          <Player
            key={activeIdx} // Remounts to reset animations on switch
            component={Composition}
            inputProps={inputProps}
            durationInFrames={durationInFrames}
            compositionWidth={1080}
            compositionHeight={1920}
            fps={fps}
            controls={false}
            autoPlay
            loop
            acknowledgeRemotionLicense
            style={{ width: "100%", height: "100%" }}
          />
=======
  }), []);

  // Side (thumbnail) cards park on a static frame and never play, so off-center
  // Players don't keep rendering ~30fps each (the carousel slowdown).
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    if (thumbnailMode) {
      p.pause();
      p.seekTo(thumbnailFrame);
      return;
    }
    setActiveIdx(0);
    p.seekTo(0);
    p.play();
  }, [thumbnailMode, thumbnailFrame]);

  // Keep the active dot in sync with playback.
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
      setActiveIdx((prev) => (prev === idx ? prev : idx));
    };
    p.addEventListener("frameupdate", onFrame);
    return () => p.removeEventListener("frameupdate", onFrame);
  }, [thumbnailMode, sceneOffsets]);

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: T_COLORS.bg }}>
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
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
          
          {/* Compact navigation dots — no scene titles */}
          <div
            style={{
              position: "absolute",
              bottom: 10,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              gap: 3,
              zIndex: 10,
            }}
          >
            {NEWCAST_PREVIEW_SCENES.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === activeIdx ? 10 : 3,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: i === activeIdx ? T_COLORS.accent : "rgba(255,255,255,0.3)",
                  transition: "all 0.4s ease",
                }}
              />
            ))}
          </div>
<<<<<<< HEAD
        </div>
      </ScaledCanvas>
=======
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
    </div>
  );
}