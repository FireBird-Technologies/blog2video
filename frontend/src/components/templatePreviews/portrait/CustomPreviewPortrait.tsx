import { useState, useEffect, useRef } from "react";
import type { CustomTemplateTheme } from "../../../api/client";

const W = 270;
const H = 480;

function ScaledCanvas({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.getBoundingClientRect().width / W);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width: "100%", aspectRatio: `${W}/${H}`, overflow: "hidden", position: "relative" }}>
      <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute" }}>{children}</div>
    </div>
  );
}

function bg(theme: CustomTemplateTheme): React.CSSProperties {
  const s = theme.style;
  if (s === "glass") return { background: `linear-gradient(180deg, ${theme.colors.bg}ee, ${theme.colors.surface}cc)` };
  if (s === "neon") return { background: theme.colors.bg, boxShadow: `inset 0 0 80px ${theme.colors.accent}10` };
  if (s === "soft") return { background: `linear-gradient(180deg, ${theme.colors.bg}, ${theme.colors.surface})` };
  return { background: theme.colors.bg };
}

// ─── Slide 1: Cinematic vertical title ──────────────────────────────
function SlideTitleCard({ active, theme, name }: { active: boolean; theme: CustomTemplateTheme; name?: string }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) { setPhase(0); return; }
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 400);
    const t3 = setTimeout(() => setPhase(3), 700);
    const t4 = setTimeout(() => setPhase(4), 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [active]);

  const a = theme.colors.accent;
  const title = name || "Your Brand";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", ...bg(theme) }}>
      {/* Gradient orb */}
      <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, ${a}18, transparent 70%)`, filter: "blur(30px)" }} />
      <div style={{ position: "absolute", bottom: -40, left: -40, width: 140, height: 140, borderRadius: "50%", background: `radial-gradient(circle, ${a}10, transparent 70%)`, filter: "blur(20px)" }} />

      {/* Decorative ring */}
      <div style={{
        position: "absolute", top: 30, right: 24, width: 60, height: 60, borderRadius: "50%",
        border: `1.5px solid ${a}20`,
        opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? "scale(1)" : "scale(0.5)",
        transition: "all 0.6s cubic-bezier(0.16,1,0.3,1)",
      }} />
      <div style={{
        position: "absolute", top: 52, right: 46, width: 8, height: 8, borderRadius: "50%",
        backgroundColor: a, opacity: phase >= 3 ? 0.5 : 0,
        transition: "all 0.4s ease",
      }} />

      {/* Content — centered vertically */}
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        justifyContent: "center", alignItems: "center", padding: "0 30px", textAlign: "center",
      }}>
        {/* Accent line */}
        <div style={{
          width: phase >= 1 ? 40 : 0, height: 3, backgroundColor: a, borderRadius: 2, marginBottom: 20,
          transition: "width 0.5s cubic-bezier(0.16,1,0.3,1)",
        }} />

        {/* Title */}
        <div style={{
          fontSize: 36, fontWeight: 800, color: theme.colors.text, lineHeight: 1.1,
          fontFamily: `${theme.fonts.heading}, system-ui, sans-serif`,
          letterSpacing: "-0.03em",
          opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.5s cubic-bezier(0.16,1,0.3,1)",
        }}>
          {title}
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: 12, color: theme.colors.muted, marginTop: 12,
          fontFamily: `${theme.fonts.body}, system-ui, sans-serif`,
          opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? "translateY(0)" : "translateY(10px)",
          transition: "all 0.5s ease",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{
            padding: "2px 8px", borderRadius: theme.borderRadius / 2,
            backgroundColor: `${a}18`, color: a, fontSize: 10, fontWeight: 600,
            textTransform: "capitalize" as const,
          }}>
            {theme.style}
          </span>
          <span>template</span>
        </div>

        {/* Color palette */}
        <div style={{
          display: "flex", gap: 6, marginTop: 24,
          opacity: phase >= 4 ? 1 : 0, transition: "opacity 0.5s ease",
        }}>
          {[theme.colors.accent, theme.colors.bg, theme.colors.text, theme.colors.surface].map((c, i) => (
            <div key={i} style={{
              width: 16, height: 16, borderRadius: "50%", backgroundColor: c,
              border: `1.5px solid ${theme.colors.text}12`,
              transform: phase >= 4 ? "scale(1)" : "scale(0.5)",
              transition: `transform 0.3s ease ${i * 0.05}s`,
            }} />
          ))}
        </div>
      </div>

      {/* Bottom accent */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, height: 3,
        width: phase >= 2 ? "100%" : "0%", backgroundColor: a,
        transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
      }} />
    </div>
  );
}

// ─── Slide 2: Scene grid — shows multiple generated video scenes ────
function SlideSceneGrid({ active, theme }: { active: boolean; theme: CustomTemplateTheme }) {
  const [phase, setPhase] = useState(0);
  const [revealed, setRevealed] = useState<number[]>([]);

  useEffect(() => {
    if (!active) { setPhase(0); setRevealed([]); return; }
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 400);
    const timers = Array.from({ length: 6 }, (_, i) =>
      setTimeout(() => setRevealed((r) => [...r, i]), 500 + i * 120)
    );
    return () => { clearTimeout(t1); clearTimeout(t2); timers.forEach(clearTimeout); };
  }, [active]);

  const a = theme.colors.accent;
  const card = theme.colors.surface;

  const scenes = [
    { label: "Intro", accent: a },
    { label: "Problem", accent: `${a}cc` },
    { label: "Solution", accent: a },
    { label: "Features", accent: `${a}cc` },
    { label: "Demo", accent: a },
    { label: "CTA", accent: `${a}cc` },
  ];

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", ...bg(theme) }}>
      {/* Header */}
      <div style={{ padding: "24px 24px 16px", textAlign: "center" }}>
        <div style={{
          fontSize: 9, fontWeight: 700, color: a, letterSpacing: "0.14em", textTransform: "uppercase" as const,
          fontFamily: `${theme.fonts.body}, sans-serif`, marginBottom: 6,
          opacity: phase >= 1 ? 1 : 0, transition: "opacity 0.4s ease",
        }}>
          Generated Scenes
        </div>
        <div style={{
          fontSize: 22, fontWeight: 800, color: theme.colors.text, lineHeight: 1.2,
          fontFamily: `${theme.fonts.heading}, system-ui, sans-serif`,
          opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? "translateY(0)" : "translateY(8px)",
          transition: "all 0.4s ease 0.05s",
        }}>
          6 scenes ready
        </div>
      </div>

      {/* Scene grid 2x3 */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "0 20px", flex: 1,
        alignContent: "center",
      }}>
        {scenes.map((scene, i) => (
          <div key={i} style={{
            backgroundColor: card, borderRadius: theme.borderRadius * 0.7,
            border: `1px solid ${theme.colors.text}08`, overflow: "hidden",
            opacity: revealed.includes(i) ? 1 : 0,
            transform: revealed.includes(i) ? "scale(1)" : "scale(0.85)",
            transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
          }}>
            {/* Scene thumbnail */}
            <div style={{
              height: 48, background: `linear-gradient(135deg, ${scene.accent}20, ${scene.accent}08)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${scene.accent}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 0, height: 0, borderLeft: `6px solid ${scene.accent}60`, borderTop: "4px solid transparent", borderBottom: "4px solid transparent", marginLeft: 2 }} />
              </div>
            </div>
            {/* Scene label */}
            <div style={{ padding: "6px 8px" }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: theme.colors.text, fontFamily: `${theme.fonts.body}, sans-serif` }}>{scene.label}</div>
              <div style={{ fontSize: 7, color: theme.colors.muted, fontFamily: `${theme.fonts.body}, sans-serif`, marginTop: 1 }}>Scene {i + 1}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Timeline bar */}
      <div style={{ padding: "12px 20px 16px" }}>
        <div style={{ height: 3, borderRadius: 2, backgroundColor: `${a}15`, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 2, backgroundColor: a,
            width: phase >= 2 ? "100%" : "0%",
            transition: "width 1.8s cubic-bezier(0.16,1,0.3,1) 0.5s",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 8, color: theme.colors.muted, fontFamily: `${theme.fonts.mono}, monospace` }}>0:00</span>
          <span style={{ fontSize: 8, color: theme.colors.muted, fontFamily: `${theme.fonts.mono}, monospace` }}>1:42</span>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 3, backgroundColor: a }} />
    </div>
  );
}

// ─── Slide 3: Stats / impact ────────────────────────────────────────
function SlideImpact({ active, theme }: { active: boolean; theme: CustomTemplateTheme }) {
  const [phase, setPhase] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) { setPhase(0); setCount(0); return; }
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 400);
    const t3 = setTimeout(() => setPhase(3), 700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active]);

  useEffect(() => {
    if (phase < 2) return;
    let n = 0;
    const id = setInterval(() => {
      n += 4;
      setCount(Math.min(n, 98));
      if (n >= 98) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [phase]);

  const a = theme.colors.accent;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "0 28px", textAlign: "center", ...bg(theme) }}>
      {/* Decorative */}
      <div style={{ position: "absolute", top: -40, left: -40, width: 120, height: 120, borderRadius: "50%", background: `radial-gradient(circle, ${a}15, transparent 70%)` }} />

      <div style={{
        fontSize: 9, fontWeight: 700, color: a, letterSpacing: "0.14em", textTransform: "uppercase" as const,
        fontFamily: `${theme.fonts.body}, sans-serif`,
        opacity: phase >= 1 ? 1 : 0, transition: "opacity 0.4s ease",
      }}>
        Brand Match Score
      </div>

      {/* Circular progress */}
      <div style={{
        position: "relative", width: 120, height: 120,
        opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? "scale(1)" : "scale(0.8)",
        transition: "all 0.5s cubic-bezier(0.16,1,0.3,1)",
      }}>
        <svg viewBox="0 0 120 120" style={{ width: 120, height: 120, transform: "rotate(-90deg)" }}>
          <circle cx="60" cy="60" r="50" fill="none" stroke={`${a}15`} strokeWidth="6" />
          <circle cx="60" cy="60" r="50" fill="none" stroke={a} strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 50}`}
            strokeDashoffset={`${2 * Math.PI * 50 * (1 - count / 100)}`}
            style={{ transition: "stroke-dashoffset 0.1s linear" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <span style={{
            fontSize: 36, fontWeight: 800, color: theme.colors.text,
            fontFamily: `${theme.fonts.heading}, system-ui, sans-serif`,
            fontFeatureSettings: "'tnum'", lineHeight: 1,
          }}>
            {count}%
          </span>
          <span style={{ fontSize: 9, color: theme.colors.muted, fontFamily: `${theme.fonts.body}, sans-serif`, marginTop: 2 }}>accuracy</span>
        </div>
      </div>

      {/* Mini stats */}
      <div style={{ display: "flex", gap: 16, opacity: phase >= 3 ? 1 : 0, transition: "opacity 0.5s ease" }}>
        {[{ label: "Colors", value: "5" }, { label: "Fonts", value: "3" }, { label: "Scenes", value: "12" }].map((stat, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: theme.colors.text, fontFamily: `${theme.fonts.heading}, sans-serif`, lineHeight: 1 }}>{stat.value}</div>
            <div style={{ fontSize: 8, color: theme.colors.muted, fontFamily: `${theme.fonts.body}, sans-serif`, marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 3, backgroundColor: a }} />
    </div>
  );
}

// ─── Dots ────────────────────────────────────────────────────────────
function SlideDots({ total, current, accent }: { total: number; current: number; accent: string }) {
  return (
    <div style={{ display: "flex", gap: 5, position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: i === current ? 16 : 5, height: 5, borderRadius: 3,
          background: i === current ? accent : `${accent}40`,
          transition: "all 0.3s ease",
        }} />
      ))}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────
const SLIDE_DURATION = 3500;

interface Props {
  theme: CustomTemplateTheme;
  name?: string;
}

const TRANSITION_MS = 400;

export default function CustomPreviewPortrait({ theme, name }: Props) {
  const slides = [SlideTitleCard, SlideSceneGrid, SlideImpact];
  const [current, setCurrent] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setActive(true), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
    }, SLIDE_DURATION);
    return () => clearInterval(id);
  }, [slides.length]);

  // Re-trigger active state on slide change so CSS transition fires
  useEffect(() => {
    setActive(false);
    const t = setTimeout(() => setActive(true), 30);
    return () => clearTimeout(t);
  }, [current]);

  return (
    <ScaledCanvas>
      <div style={{ width: "100%", height: "100%", position: "relative" }}>
        {/* All slides mounted as overlapping layers for smooth crossfade */}
        {slides.map((SlideComp, idx) => (
          <div
            key={idx}
            style={{
              position: "absolute",
              inset: 0,
              opacity: idx === current && active ? 1 : 0,
              transform: idx === current && active ? "scale(1)" : idx === current ? "scale(0.98)" : "scale(1.02)",
              transition: `opacity ${TRANSITION_MS}ms ease-out, transform ${TRANSITION_MS}ms ease-out`,
              zIndex: idx === current ? 2 : 1,
              pointerEvents: idx === current ? "auto" : "none",
            }}
          >
            <SlideComp active={idx === current && active} theme={theme} name={name} />
          </div>
        ))}
        <SlideDots total={slides.length} current={current} accent={theme.colors.accent} />
      </div>
    </ScaledCanvas>
  );
}
