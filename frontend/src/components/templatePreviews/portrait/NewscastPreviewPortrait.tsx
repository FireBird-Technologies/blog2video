import { useMemo, useState, useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { getTemplateConfig } from "../../remotion/templateConfig";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Enlarged Logical Dimensions (9:16)
// Lower values here make the content (text/images) appear larger in the box
const INTERNAL_W = 240;
const INTERNAL_H = 426;

function ScaledCanvas({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      // Use layout width (offsetWidth), which is immune to ancestor CSS
      // transforms — the coverflow scales/rotates side cards, and
      // getBoundingClientRect() would return the foreshortened width and lock a
      // too-small internal scale (the card renders nearly empty).
      setScale(el.offsetWidth / INTERNAL_W);
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
    accentColor: T_COLORS.accent,
    bgColor: T_COLORS.bg,
    textColor: T_COLORS.text,
    aspectRatio: "portrait",
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
    <div style={{ width: "100%" }}>
      <ScaledCanvas>
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
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
            style={{ width: INTERNAL_W, height: INTERNAL_H }}
          />
          
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
        </div>
      </ScaledCanvas>
    </div>
  );
}