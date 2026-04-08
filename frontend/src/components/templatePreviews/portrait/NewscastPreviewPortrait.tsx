import { useMemo, useState, useEffect, useRef } from "react";
import { Player } from "@remotion/player";
import { getTemplateConfig } from "../../remotion/templateConfig";

/* eslint-disable @typescript-eslint/no-explicit-any */

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
    accentColor: T_COLORS.accent,
    bgColor: T_COLORS.bg,
    textColor: T_COLORS.text,
    aspectRatio: "portrait",
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
          
          {/* Minimal Navigation Dots */}
          <div style={{ 
            position: "absolute", 
            bottom: 16, 
            left: 0, 
            right: 0, 
            display: "flex", 
            justifyContent: "center", 
            gap: 6,
            zIndex: 10 
          }}>
            {NEWCAST_PREVIEW_SCENES.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === activeIdx ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === activeIdx ? T_COLORS.accent : "rgba(255,255,255,0.3)",
                  transition: "all 0.4s ease",
                }}
              />
            ))}
          </div>
        </div>
      </ScaledCanvas>

      <div style={{ textAlign: "center", marginTop: "16px" }}>
        <p style={{ color: "white", fontSize: "0.9rem", fontWeight: 600, margin: 0 }}>
          {activeScene.title}
        </p>
      </div>
    </div>
  );
}