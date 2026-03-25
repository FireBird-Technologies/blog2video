import { useState, useEffect, useRef } from "react";
import type { CustomTemplateTheme } from "../../api/client";

const W = 640;
const H = 360;

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
  if (s === "glass") return { background: `linear-gradient(135deg, ${theme.colors.bg}ee, ${theme.colors.surface}cc)` };
  if (s === "neon") return { background: theme.colors.bg, boxShadow: `inset 0 0 100px ${theme.colors.accent}10` };
  if (s === "soft") return { background: `linear-gradient(135deg, ${theme.colors.bg}, ${theme.colors.surface})` };
  return { background: theme.colors.bg };
}

// ─── Slide 1: Cinematic title intro ─────────────────────────────────
// Dramatic blog-to-video hero with staggered text, floating shapes, gradient wash
function SlideCinematic({ active, theme, name }: { active: boolean; theme: CustomTemplateTheme; name?: string }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) { setPhase(0); return; }
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 400);
    const t3 = setTimeout(() => setPhase(3), 700);
    const t4 = setTimeout(() => setPhase(4), 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [active]);

  const a = theme.colors.accent;
  const title = name || "Your Brand";
  const words = title.split(" ");

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", ...bg(theme) }}>
      {/* Gradient wash */}
      <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: `radial-gradient(circle, ${a}20, transparent 70%)`, filter: "blur(40px)" }} />
      <div style={{ position: "absolute", bottom: -60, left: -60, width: 220, height: 220, borderRadius: "50%", background: `radial-gradient(circle, ${a}12, transparent 70%)`, filter: "blur(30px)" }} />

      {/* Floating geometric shapes */}
      <div style={{
        position: "absolute", top: 40, right: 60, width: 80, height: 80, borderRadius: "50%",
        border: `2px solid ${a}25`, opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? "scale(1) rotate(0deg)" : "scale(0.3) rotate(-90deg)",
        transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)",
      }} />
      <div style={{
        position: "absolute", top: 60, right: 110, width: 12, height: 12, borderRadius: "50%",
        backgroundColor: a, opacity: phase >= 2 ? 0.6 : 0, transform: phase >= 2 ? "scale(1)" : "scale(0)",
        transition: "all 0.5s ease 0.1s",
      }} />
      <div style={{
        position: "absolute", bottom: 80, right: 40, width: 40, height: 2, backgroundColor: `${a}30`,
        opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? "scaleX(1)" : "scaleX(0)",
        transition: "all 0.6s ease", transformOrigin: "left",
      }} />
      <div style={{
        position: "absolute", bottom: 60, right: 30, width: 60, height: 2, backgroundColor: `${a}20`,
        opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? "scaleX(1)" : "scaleX(0)",
        transition: "all 0.6s ease 0.1s", transformOrigin: "left",
      }} />

      {/* Content */}
      <div style={{ position: "absolute", left: 48, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 420 }}>
        {/* Accent line */}
        <div style={{
          width: phase >= 1 ? 50 : 0, height: 3, backgroundColor: a, borderRadius: 2, marginBottom: 20,
          transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)",
        }} />

        {/* Staggered word reveal */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0 12px", marginBottom: 16 }}>
          {words.map((word, i) => (
            <span key={i} style={{
              fontSize: 44, fontWeight: 800, color: theme.colors.text, lineHeight: 1.1,
              fontFamily: `${theme.fonts.heading}, system-ui, sans-serif`,
              letterSpacing: "-0.03em",
              opacity: phase >= i + 1 ? 1 : 0,
              transform: phase >= i + 1 ? "translateY(0)" : "translateY(24px)",
              transition: `opacity 0.5s ease ${i * 0.12}s, transform 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.12}s`,
            }}>
              {word}
            </span>
          ))}
        </div>

        {/* Subtitle with typing line */}
        <div style={{
          fontSize: 14, color: theme.colors.muted, fontFamily: `${theme.fonts.body}, system-ui, sans-serif`,
          opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? "translateY(0)" : "translateY(12px)",
          transition: "all 0.5s ease",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: a }} />
          Powered by your brand identity
        </div>

        {/* Color palette strip */}
        <div style={{
          display: "flex", gap: 6, marginTop: 20,
          opacity: phase >= 4 ? 1 : 0, transition: "opacity 0.5s ease",
        }}>
          {[theme.colors.accent, theme.colors.bg, theme.colors.text, theme.colors.surface, theme.colors.muted].map((c, i) => (
            <div key={i} style={{
              width: 18, height: 18, borderRadius: 4,
              backgroundColor: c, border: `1.5px solid ${theme.colors.text}10`,
              transform: phase >= 4 ? "translateY(0) scale(1)" : "translateY(8px) scale(0.6)",
              transition: `all 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.05}s`,
            }} />
          ))}
        </div>
      </div>

      {/* Bottom accent bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, height: 3,
        width: phase >= 2 ? "100%" : "0%", backgroundColor: a,
        transition: "width 1s cubic-bezier(0.16,1,0.3,1)",
      }} />
    </div>
  );
}

// ─── Slide 2: Metrics / data scene ──────────────────────────────────
// Animated counters, progress bars — looks like an actual video scene
function SlideMetrics({ active, theme }: { active: boolean; theme: CustomTemplateTheme }) {
  const [phase, setPhase] = useState(0);
  const [counts, setCounts] = useState([0, 0, 0]);

  const targets = [847, 12.4, 98];
  const labels = ["Blog posts converted", "Hours of video", "Brand accuracy"];
  const suffixes = ["", "h", "%"];

  useEffect(() => {
    if (!active) { setPhase(0); setCounts([0, 0, 0]); return; }
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 300);
    const t3 = setTimeout(() => setPhase(3), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active]);

  useEffect(() => {
    if (phase < 2) return;
    const steps = 30;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const progress = Math.min(step / steps, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCounts(targets.map((t) => Math.round(t * ease * 10) / 10));
      if (step >= steps) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, [phase]);

  const a = theme.colors.accent;
  const card = theme.colors.surface;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 44px", ...bg(theme) }}>
      {/* Decorative */}
      <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: `radial-gradient(circle, ${a}15, transparent 70%)` }} />

      {/* Section label */}
      <div style={{
        fontSize: 10, fontWeight: 700, color: a, letterSpacing: "0.14em", textTransform: "uppercase" as const,
        fontFamily: `${theme.fonts.body}, sans-serif`, marginBottom: 8,
        opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? "translateY(0)" : "translateY(8px)",
        transition: "all 0.4s ease",
      }}>
        Performance Overview
      </div>
      <div style={{
        fontSize: 26, fontWeight: 800, color: theme.colors.text, lineHeight: 1.2, marginBottom: 28,
        fontFamily: `${theme.fonts.heading}, system-ui, sans-serif`,
        opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? "translateY(0)" : "translateY(8px)",
        transition: "all 0.4s ease 0.1s",
      }}>
        Your content, amplified
      </div>

      {/* Metric cards */}
      <div style={{ display: "flex", gap: 16 }}>
        {targets.map((target, i) => (
          <div key={i} style={{
            flex: 1, padding: "18px 16px", borderRadius: theme.borderRadius,
            backgroundColor: card, border: `1px solid ${theme.colors.text}08`,
            opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? "translateY(0)" : "translateY(16px)",
            transition: `all 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.1}s`,
          }}>
            <div style={{
              fontSize: 32, fontWeight: 800, color: i === 2 ? a : theme.colors.text,
              fontFamily: `${theme.fonts.heading}, system-ui, sans-serif`, lineHeight: 1,
              fontFeatureSettings: "'tnum'",
            }}>
              {i === 1 ? counts[i].toFixed(1) : Math.round(counts[i])}{suffixes[i]}
            </div>
            <div style={{ fontSize: 11, color: theme.colors.muted, marginTop: 6, fontFamily: `${theme.fonts.body}, sans-serif`, fontWeight: 500 }}>
              {labels[i]}
            </div>
            {/* Progress bar */}
            <div style={{ marginTop: 10, height: 3, borderRadius: 2, backgroundColor: `${a}15`, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 2, backgroundColor: a,
                width: phase >= 3 ? `${(counts[i] / target) * 100}%` : "0%",
                transition: "width 1.2s cubic-bezier(0.16,1,0.3,1)",
              }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 3, backgroundColor: a }} />
    </div>
  );
}

// ─── Slide 3: Code / terminal scene ─────────────────────────────────
// Shows a mock code block that types in — looks like a dev-focused video scene
function SlideCode({ active, theme }: { active: boolean; theme: CustomTemplateTheme }) {
  const [phase, setPhase] = useState(0);
  const [lines, setLines] = useState(0);

  const codeLines = [
    { tokens: [{ text: "const ", color: theme.colors.muted }, { text: "video", color: theme.colors.text }, { text: " = ", color: theme.colors.muted }, { text: "await ", color: theme.colors.accent }, { text: "generate", color: theme.colors.text }, { text: "(", color: theme.colors.muted }] },
    { tokens: [{ text: "  brand", color: theme.colors.text }, { text: ": ", color: theme.colors.muted }, { text: `"${theme.fonts.heading}"`, color: theme.colors.accent }] },
    { tokens: [{ text: "  style", color: theme.colors.text }, { text: ": ", color: theme.colors.muted }, { text: `"${theme.style}"`, color: theme.colors.accent }] },
    { tokens: [{ text: "  scenes", color: theme.colors.text }, { text: ": ", color: theme.colors.muted }, { text: "12", color: theme.colors.accent }, { text: ",", color: theme.colors.muted }] },
    { tokens: [{ text: ")", color: theme.colors.muted }] },
  ];

  useEffect(() => {
    if (!active) { setPhase(0); setLines(0); return; }
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [active]);

  useEffect(() => {
    if (phase < 2) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setLines(i);
      if (i >= codeLines.length) clearInterval(interval);
    }, 220);
    return () => clearInterval(interval);
  }, [phase, codeLines.length]);

  const a = theme.colors.accent;
  const mono = `${theme.fonts.mono}, 'JetBrains Mono', monospace`;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", display: "flex", ...bg(theme) }}>
      {/* Left panel — code */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 36px" }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: a, letterSpacing: "0.14em", textTransform: "uppercase" as const,
          fontFamily: `${theme.fonts.body}, sans-serif`, marginBottom: 12,
          opacity: phase >= 1 ? 1 : 0, transition: "opacity 0.4s ease",
        }}>
          How it works
        </div>

        {/* Code block */}
        <div style={{
          backgroundColor: `${theme.colors.text}06`, borderRadius: theme.borderRadius,
          border: `1px solid ${theme.colors.text}08`, padding: "16px 18px",
          opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? "translateY(0)" : "translateY(10px)",
          transition: "all 0.5s ease",
        }}>
          {/* Terminal dots */}
          <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#FF5F57" }} />
            <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#FFBD2E" }} />
            <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#28CA41" }} />
          </div>
          {codeLines.map((line, i) => (
            <div key={i} style={{
              fontFamily: mono, fontSize: 13, lineHeight: 1.8,
              opacity: lines > i ? 1 : 0, transform: lines > i ? "translateX(0)" : "translateX(8px)",
              transition: "all 0.3s ease",
            }}>
              {line.tokens.map((tok, j) => (
                <span key={j} style={{ color: tok.color }}>{tok.text}</span>
              ))}
            </div>
          ))}
          {/* Cursor */}
          {lines < codeLines.length && phase >= 2 && (
            <span style={{ display: "inline-block", width: 8, height: 16, backgroundColor: a, opacity: 0.7, animation: "cplBlink 0.8s step-end infinite", verticalAlign: "middle" }} />
          )}
        </div>
      </div>

      {/* Right panel — output card */}
      <div style={{
        width: 200, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 24px",
        opacity: phase >= 2 && lines >= 3 ? 1 : 0, transform: phase >= 2 && lines >= 3 ? "translateX(0)" : "translateX(20px)",
        transition: "all 0.6s cubic-bezier(0.16,1,0.3,1)",
      }}>
        <div style={{
          width: "100%", borderRadius: theme.borderRadius, backgroundColor: theme.colors.surface,
          border: `1px solid ${theme.colors.text}08`, padding: "20px 16px", textAlign: "center",
        }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: `${a}20`, margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: a }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.colors.text, fontFamily: `${theme.fonts.heading}, sans-serif`, marginBottom: 4 }}>Ready</div>
          <div style={{ fontSize: 10, color: theme.colors.muted, fontFamily: `${theme.fonts.body}, sans-serif` }}>12 scenes generated</div>
          <div style={{
            marginTop: 12, padding: "6px 14px", borderRadius: theme.borderRadius / 2,
            backgroundColor: a, color: theme.colors.bg, fontSize: 11, fontWeight: 700,
            fontFamily: `${theme.fonts.body}, sans-serif`,
          }}>
            Watch Video
          </div>
        </div>
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
          width: i === current ? 18 : 5, height: 5, borderRadius: 3,
          background: i === current ? accent : `${accent}40`,
          transition: "all 0.3s ease",
        }} />
      ))}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────
const SLIDE_DURATION = 3500;
const TRANSITION_MS = 400;

interface Props {
  theme: CustomTemplateTheme;
  name?: string;
}

export default function CustomPreviewLandscape({ theme, name }: Props) {
  const slides = [SlideCinematic, SlideMetrics, SlideCode];
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

  // Re-trigger active state on slide change so CSS transition fires (mount at 0, then → 1)
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
      <style>{`@keyframes cplBlink { 0%,100%{opacity:.7} 50%{opacity:0} }`}</style>
    </ScaledCanvas>
  );
}
