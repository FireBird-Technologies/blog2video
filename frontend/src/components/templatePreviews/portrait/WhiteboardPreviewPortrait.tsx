<<<<<<< HEAD
import { useState, useEffect, useRef, useCallback } from "react";

// ─── Portrait scale wrapper (9:16)
const INTERNAL_W = 270;
const INTERNAL_H = 480;

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
    <div ref={ref} style={{ width: "100%", aspectRatio: `${INTERNAL_W}/${INTERNAL_H}`, overflow: "hidden", position: "relative" }}>
      <div style={{ width: INTERNAL_W, height: INTERNAL_H, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute" }}>
        {children}
      </div>
    </div>
  );
}

/* ─── TOKENS ─────────────────────────────────────────────── */
const BG     = "#F7F3E8";
const TEXT   = "#1a1209";
const ACCENT = "#0a0a0a";
const FONT   = "'Patrick Hand', system-ui, sans-serif";

/* ─── ANIMATION TIMER ──────────────────────────────────── */
function useTimer(ms: number, active: boolean): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active) { setT(0); return; }
    const start = performance.now();
    let raf: number | undefined;
    const tick = (now: number) => {
      const next = Math.min((now - start) / ms, 1);
      setT(next);
      if (next < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf !== undefined) cancelAnimationFrame(raf); };
  }, [active, ms]);
  return t;
}

/* ─── PAPER BACKGROUND ───────────────────────────────────── */
function PaperBg() {
  return (
    <div style={{ position: "absolute", inset: 0, background: BG }}>
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(rgba(0,0,0,0.065) 1.2px, transparent 1.2px)",
        backgroundSize: "22px 22px",
      }} />
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
        <defs>
          <filter id="pgrain-p" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" result="noise"/>
            <feColorMatrix type="saturate" values="0" in="noise" result="gray"/>
            <feComponentTransfer in="gray" result="faded">
              <feFuncA type="linear" slope="0.055"/>
            </feComponentTransfer>
            <feComposite in="faded" in2="SourceGraphic" operator="over"/>
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#pgrain-p)" fill="white"/>
      </svg>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, transparent 52%, rgba(0,0,0,0.08))", pointerEvents: "none" }} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SLIDE 1 — DrawnTitle (portrait)
══════════════════════════════════════════════════════════ */
function SlideDrawnTitle({ active }: { active: boolean }) {
  const t = useTimer(2600, active);
  const title = "Story Comes\nAlive";
  const nar   = "Hand-drawn markers & story beats.";
  const tc = Math.min(title.length, Math.floor(t / 0.5 * title.length));
  const nc = Math.min(nar.length, Math.max(0, Math.floor((t - 0.42) / 0.55 * nar.length)));
  const lw = Math.max(0, Math.min(1, (t - 0.36) / 0.28));

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 20px", fontFamily: FONT }}>
      <div style={{ color: TEXT, fontWeight: 700, fontSize: 36, lineHeight: 1.15, textAlign: "center", whiteSpace: "pre-line" }}>
        {title.slice(0, tc)}
        {tc < title.length && <span style={{ opacity: 0.3 }}>|</span>}
      </div>
      <svg viewBox="0 0 220 14" style={{ width: "min(220px, 80%)", height: 14, marginTop: 10 }} preserveAspectRatio="none">
        <defs>
          <filter id="ul-p" x="-3%" y="-60%" width="106%" height="220%">
            <feTurbulence type="fractalNoise" baseFrequency="0.05 0.3" numOctaves="3" seed="6" result="w"/>
            <feDisplacementMap in="SourceGraphic" in2="w" scale="2" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </defs>
        <path d="M0,7 Q55,4 110,8 Q165,12 220,6" fill="none" stroke={ACCENT} strokeWidth={9} strokeOpacity={0.2} strokeLinecap="round" filter="url(#ul-p)" strokeDasharray={260} strokeDashoffset={260*(1-lw)}/>
        <path d="M0,7 Q55,4 110,8 Q165,12 220,6" fill="none" stroke={ACCENT} strokeWidth={4.5} strokeLinecap="round" filter="url(#ul-p)" strokeDasharray={260} strokeDashoffset={260*(1-lw)}/>
      </svg>
      <div style={{ marginTop: 16, color: TEXT, fontSize: 14, fontWeight: 500, textAlign: "center", maxWidth: 220, lineHeight: 1.5 }}>
        {nar.slice(0, nc)}
        {nc > 0 && nc < nar.length && <span style={{ opacity: 0.3 }}>|</span>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SLIDE 2 — StatsChart (portrait)
══════════════════════════════════════════════════════════ */
const BARS = [
  { label: "Option A", pct: 85 },
  { label: "Option B", pct: 62 },
  { label: "Option C", pct: 44 },
];

function SlideStatsChart({ active }: { active: boolean }) {
  const t = useTimer(2400, active);
  const titleOp = Math.min(1, t * 3.5);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "5% 14%", gap: 20, fontFamily: FONT }}>
      <div style={{ textAlign: "center", opacity: titleOp }}>
        <div style={{ color: TEXT, fontWeight: 700, fontSize: 28 }}>By the Numbers</div>
        <div style={{ color: TEXT, fontSize: 13, opacity: 0.78, marginTop: 4 }}>A quick look at the results</div>
      </div>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
        {BARS.map((bar, i) => {
          const delay = 0.28 + i * 0.2;
          const barT = Math.max(0, Math.min(1, (t - delay) / 0.36));
          const rowOp = Math.max(0, Math.min(1, (t - delay) * 7));
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, opacity: rowOp }}>
              <span style={{ color: TEXT, fontSize: 12, fontWeight: 600, minWidth: 56 }}>{bar.label}</span>
              <div style={{ flex: 1, height: 20, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.06)", overflow: "hidden", border: `2px solid ${ACCENT}`, position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, width: `${bar.pct * barT}%`, backgroundColor: ACCENT, opacity: 0.18, borderRadius: 4 }} />
                <div style={{ width: `${bar.pct * barT}%`, height: "100%", backgroundColor: ACCENT, borderRadius: 4 }} />
              </div>
              <span style={{ color: ACCENT, fontSize: 13, fontWeight: 800, minWidth: 34, textAlign: "right", opacity: barT }}>{bar.pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SLIDE 3 — StatsFigures (portrait)
══════════════════════════════════════════════════════════ */
const STATS = [
  { value: "87%", label: "Engagement" },
  { value: "3×",  label: "Faster" },
  { value: "10K+", label: "Users" },
];

function SlideStatsFigures({ active }: { active: boolean }) {
  const t = useTimer(2500, active);
  const titleOp = Math.min(1, t * 3.5);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "5% 10%", gap: 20, fontFamily: FONT }}>
      <div style={{ textAlign: "center", opacity: titleOp }}>
        <div style={{ color: TEXT, fontWeight: 700, fontSize: 28 }}>The Impact</div>
        <div style={{ color: TEXT, fontSize: 13, opacity: 0.78, marginTop: 4 }}>Numbers that tell the story</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
        {STATS.map((s, i) => {
          const delay = 0.28 + i * 0.18;
          const cardT = Math.max(0, Math.min(1, (t - delay) / 0.34));
          const cardOp = Math.max(0, Math.min(1, (t - delay) * 6));
          const dash = 400, dashOff = dash * (1 - cardT);
          return (
            <div key={i} style={{
              position: "relative", width: "100%", height: 64,
              backgroundColor: "rgba(255,255,255,0.55)",
              boxShadow: "0 4px 14px rgba(0,0,0,0.07)", borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0 18px", opacity: cardOp,
            }}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}
                fill="none">
                <defs>
                  <filter id={`inkC-p${i}`} x="-6%" y="-6%" width="112%" height="112%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed={i+2} result="w"/>
                    <feDisplacementMap in="SourceGraphic" in2="w" scale="2" xChannelSelector="R" yChannelSelector="G"/>
                  </filter>
                </defs>
                <g filter={`url(#inkC-p${i})`}>
                  <rect x={2} y={2} width={96} height={96} rx={10} stroke={ACCENT} strokeWidth={7} strokeOpacity={0.18}/>
                  <rect x={2} y={2} width={96} height={96} rx={10} stroke={ACCENT} strokeWidth={3} strokeDasharray={dash} strokeDashoffset={dashOff}/>
                </g>
              </svg>
              <span style={{ color: TEXT, fontSize: 14, fontWeight: 600, fontFamily: FONT }}>{s.label}</span>
              <span style={{ color: ACCENT, fontSize: 28, fontWeight: 800, fontFamily: FONT, lineHeight: 1 }}>{s.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   NAV DOTS
══════════════════════════════════════════════════════════ */
function NavDots({ total, current, onDotClick }: { total: number; current: number; onDotClick: (i: number) => void }) {
  return (
    <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5, zIndex: 10 }}>
      {Array.from({ length: total }, (_, i) => (
        <button key={i} onClick={() => onDotClick(i)} style={{
          width: i === current ? 16 : 5, height: 5, borderRadius: 3,
          background: i === current ? ACCENT : "rgba(26,18,9,0.2)",
          border: "none", cursor: "pointer", padding: 0,
          transition: "all 0.3s ease",
        }} />
      ))}
    </div>
  );
}

/* ─── SLIDE LABEL BADGE ─────────────────────────────────── */
const SLIDE_NAMES = ["Drawn Title", "Stats Chart", "Stat Cards"];

function SlideBadge({ name }: { name: string }) {
  return (
    <div style={{
      position: "absolute", top: 10, left: 10, zIndex: 10,
      background: "rgba(255,255,255,0.78)",
      border: `1.5px solid rgba(212,66,10,0.22)`,
      borderRadius: 20, padding: "3px 10px",
      fontFamily: FONT, fontSize: 10, fontWeight: 600, color: TEXT,
    }}>
      {name}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════ */
const SLIDES = [SlideDrawnTitle, SlideStatsChart, SlideStatsFigures];
const SLIDE_DURATION = 4000;

export default function WhiteboardPreviewPortrait() {
  const [current, setCurrent]   = useState(0);
  const [visible, setVisible]   = useState(true);
  const transitioningRef        = useRef(false);
  const timeoutRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRef              = useRef(0);

  useEffect(() => { currentRef.current = current; }, [current]);

  const goTo = useCallback((i: number) => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;
    setVisible(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setCurrent(i);
      setVisible(true);
      transitioningRef.current = false;
      timeoutRef.current = null;
    }, 200);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      goTo((currentRef.current + 1) % SLIDES.length);
    }, SLIDE_DURATION);
    return () => clearInterval(id);
  }, [goTo]);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const SlideComp = SLIDES[current];

  return (
    <ScaledCanvas>
      <PaperBg />
      <div style={{
        position: "absolute", inset: 0,
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.97)",
        transition: "opacity 0.2s ease, transform 0.2s ease",
      }}>
        <SlideComp active={visible} />
      </div>
      <SlideBadge name={SLIDE_NAMES[current]} />
      <NavDots total={SLIDES.length} current={current} onDotClick={goTo} />
    </ScaledCanvas>
  );
}
=======
import { useMemo, useState, useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import PlayerScaledCanvas from "../PlayerScaledCanvas";
import { getTemplateConfig } from "../../remotion/templateConfig";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DemoScene {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
}

// Dot-grid paper background (mirrors WhiteboardBackground) so the container
// never flashes a flat color around the Player.
const WHITEBOARD_BG_IMAGE =
  "radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.02) 1px, transparent 1px)";

const WHITEBOARD_PREVIEW_SCENES: DemoScene[] = [
  {
    id: 1,
    order: 1,
    title: "Story Comes Alive",
    narration:
      "Hand-drawn markers, playful stick figures and clear story beats bring every idea to life.",
    layout: "drawn_title",
    layoutProps: {
      titleFontSize: 100,
      descriptionFontSize: 56,
    },
    durationSeconds: 7,
  },
  {
    id: 2,
    order: 2,
    title: "By the Numbers",
    narration: "A quick, side-by-side look at how each option really performed.",
    layout: "stats_chart",
    layoutProps: {
      stats: [
        { label: "Option A", value: "85%" },
        { label: "Option B", value: "62%" },
        { label: "Option C", value: "44%" },
      ],
      titleFontSize: 100,
      descriptionFontSize: 46,
    },
    durationSeconds: 7,
  },
  {
    id: 3,
    order: 3,
    title: "Make a Choice",
    narration: "Two very different mindsets — so which path will you choose to take?",
    layout: "comparison",
    layoutProps: {
      leftThought: "Ship it fast, speed beats everything!",
      rightThought: "Slow down — real quality always takes time!",
      titleFontSize: 90,
      descriptionFontSize: 36,
    },
    durationSeconds: 7,
  },
  {
    id: 4,
    order: 4,
    title: "The Impact",
    narration: "The numbers that tell the story of real, measurable impact.",
    layout: "stats_figures",
    layoutProps: {
      stats: [
        { value: "87%", label: "Engagement" },
        { value: "3×", label: "Faster" },
        { value: "10K+", label: "Users" },
      ],
      titleFontSize: 96,
      descriptionFontSize: 40,
    },
    durationSeconds: 7,
  },
  {
    id: 5,
    order: 5,
    title: "The Big Conversation",
    narration: "",
    layout: "speech_bubble_dialogue",
    layoutProps: {
      leftThought: "Hey, did you know about this?",
      rightThought: "No way — tell me more about it!",
      speakers: [{ label: "Alex" }, { label: "Jordan" }],
      titleFontSize: 90,
      descriptionFontSize: 38,
    },
    durationSeconds: 7,
  },
  {
    id: 6,
    order: 6,
    title: "Get Ready!",
    narration: "Just a few seconds left now until the big launch 🚀",
    layout: "countdown_timer",
    layoutProps: {
      stats: [{ value: "5" }],
      titleFontSize: 116,
      descriptionFontSize: 54,
    },
    durationSeconds: 7,
  },
];

export default function WhiteboardPreviewPortrait({ thumbnailMode = false }: { thumbnailMode?: boolean } = {}) {
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const fps = 30;
  const config = getTemplateConfig("whiteboard");
  const Composition = config.component as React.ComponentType<any>;
  const { accent: accentColor, bg: bgColor, text: textColor } = config.defaultColors;

  // Play the WHOLE timeline continuously (scene 1 → 2 → … → loop), exactly like the
  // real video, instead of mounting one isolated scene per Player window. The dots
  // just seek to a scene's start; auto-advance is driven by playback, not a timer.
  const sceneFrames = useMemo(
    () =>
      WHITEBOARD_PREVIEW_SCENES.map((s) =>
        Math.max(1, Math.round((Number(s.durationSeconds) || 5) * fps)),
      ),
    [fps],
  );
  const sceneStartFrames = useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    for (const f of sceneFrames) {
      starts.push(acc);
      acc += f;
    }
    return starts;
  }, [sceneFrames]);
  const durationInFrames = useMemo(
    () => Math.max(1, sceneFrames.reduce((a, b) => a + b, 0)),
    [sceneFrames],
  );
  const thumbnailFrame = Math.min(Math.max(0, durationInFrames - 1), 100);

  const inputProps = useMemo(
    () => ({
      scenes: WHITEBOARD_PREVIEW_SCENES,
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

  // Side cards are static: the moment a card is not the center card it pauses
  // and locks to the thumbnail frame, so only the centered card ever animates.
  // This fires both on initial mount as a side card and when a card is moved
  // away from center, freezing it immediately rather than letting it keep
  // rendering.
  useEffect(() => {
    if (!thumbnailMode) return;
    const pl = playerRef.current;
    if (!pl) return;
    pl.pause();
    pl.seekTo(thumbnailFrame);
  }, [thumbnailMode, thumbnailFrame]);

  // When the card reaches center, restart the timeline from the top so the
  // animation plays fresh — and stop it (the thumbnail effect above pauses it)
  // the moment it moves away.
  useEffect(() => {
    if (thumbnailMode) return;
    const pl = playerRef.current;
    if (!pl) return;
    setActiveSceneIndex(0);
    pl.seekTo(0);
    pl.play();
  }, [thumbnailMode]);

  // Keep the active-dot highlight in sync with which scene is currently playing.
  useEffect(() => {
    if (thumbnailMode) return;
    const pl = playerRef.current;
    if (!pl) return;
    const onFrame = () => {
      const f = pl.getCurrentFrame();
      let idx = 0;
      for (let i = sceneStartFrames.length - 1; i >= 0; i--) {
        if (f >= sceneStartFrames[i]) {
          idx = i;
          break;
        }
      }
      setActiveSceneIndex((prev) => (prev === idx ? prev : idx));
    };
    pl.addEventListener("frameupdate", onFrame);
    return () => pl.removeEventListener("frameupdate", onFrame);
  }, [thumbnailMode, sceneStartFrames]);

  // Clicking a dot seeks the continuous timeline to that scene's start.
  const seekToScene = (index: number) => {
    setActiveSceneIndex(index);
    const pl = playerRef.current;
    if (pl) {
      pl.seekTo(sceneStartFrames[index] ?? 0);
      if (!thumbnailMode) pl.play();
    }
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{
        backgroundColor: bgColor,
        backgroundImage: WHITEBOARD_BG_IMAGE,
        backgroundSize: "20px 20px, 12px 12px",
      }}
    >
        <PlayerScaledCanvas internalWidth={270} internalHeight={480}>
          <Player
            ref={playerRef}
            component={Composition}
            inputProps={inputProps}
            durationInFrames={durationInFrames}
            initialFrame={thumbnailMode ? thumbnailFrame : 0}
            compositionWidth={720}
            compositionHeight={1280}
            fps={fps}
            controls={false}
            autoPlay={!thumbnailMode}
            loop={!thumbnailMode}
            acknowledgeRemotionLicense
            style={{ width: 270, height: 480, display: "block" }}
          />
        </PlayerScaledCanvas>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-1">
          {WHITEBOARD_PREVIEW_SCENES.map((scene, index) => {
            const isActive = index === activeSceneIndex;
            return (
              <button
                key={scene.id}
                onClick={() => seekToScene(index)}
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
  );
}
>>>>>>> 8b6ac7366adf74401e1a4f6ca60a4b50c9b30acb
