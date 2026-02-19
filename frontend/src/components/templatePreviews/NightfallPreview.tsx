import { useState, useEffect, useRef } from "react";

// ─── Scale wrapper
const INTERNAL_W = 480;
const INTERNAL_H = 270;

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

// ─── Design tokens
const T = {
  bg: "#0A0A1A",
  accent: "#818CF8",
  accentGlow: "rgba(129,140,248,0.35)",
  text: "#E2E8F0",
  textMuted: "rgba(226,232,240,0.45)",
  glassBorder: "rgba(255,255,255,0.12)",
  glass: "rgba(255,255,255,0.07)",
};

function useFadeIn(delay = 0, active = true) {
  const [vis, setVis] = useState(false);
  useEffect(() => {
    if (!active) { setVis(false); return; }
    const t = setTimeout(() => setVis(true), delay);
    return () => clearTimeout(t);
  }, [delay, active]);
  return vis;
}

// ─── Background blobs (shared)
function GradientBg() {
  return (
    <>
      <div style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,74,255,0.22) 0%, transparent 70%)", filter: "blur(60px)", top: "-20%", left: "5%", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,100,220,0.18) 0%, transparent 70%)", filter: "blur(80px)", top: "30%", right: "-10%", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)", filter: "blur(60px)", bottom: "-10%", left: "20%", pointerEvents: "none" }} />
    </>
  );
}

// ─── Slide 1: Cinematic Title
function SlideCinematicTitle({ active }: { active: boolean }) {
  const titleVis = useFadeIn(200, active);
  const lineVis = useFadeIn(600, active);
  const subVis = useFadeIn(900, active);

  return (
    <div style={{ width: "100%", height: "100%", background: T.bg, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <GradientBg />
      <div style={{ textAlign: "center", padding: "0 60px", position: "relative", zIndex: 1 }}>
        <div style={{
          fontSize: 56, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.03em", color: T.text,
          textShadow: `0 0 60px ${T.accentGlow}`, fontFamily: "Georgia, serif",
          opacity: titleVis ? 1 : 0, transform: titleVis ? "translateY(0)" : "translateY(18px)",
          transition: "opacity 0.65s cubic-bezier(0.16,1,0.3,1), transform 0.65s cubic-bezier(0.16,1,0.3,1)",
        }}>
          Nightfall
        </div>
        <div style={{
          height: 1, width: "60%", margin: "16px auto",
          background: `linear-gradient(90deg, transparent, ${T.glassBorder}, transparent)`,
          boxShadow: `0 0 16px ${T.accentGlow}`,
          opacity: lineVis ? 1 : 0, transition: "opacity 0.5s ease",
        }} />
        <div style={{
          fontSize: 14, fontWeight: 300, color: T.textMuted, letterSpacing: "0.04em",
          opacity: subVis ? 1 : 0, transform: subVis ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}>
          Dark cinematic glass — a premium experience
        </div>
      </div>
    </div>
  );
}

// ─── Slide 2: Glass Stack (key insights)
const STACK_ITEMS = [
  "AI systems are layered compositions of specialized models",
  "RLHF aligns outputs to human preference distributions",
  "Retrieval augmentation bridges parametric memory",
];

function SlideGlassStack({ active }: { active: boolean }) {
  const [visItems, setVisItems] = useState<number[]>([]);
  const [titleVis, setTitleVis] = useState(false);

  useEffect(() => {
    if (!active) { setVisItems([]); setTitleVis(false); return; }
    const t0 = setTimeout(() => setTitleVis(true), 100);
    const timers = STACK_ITEMS.map((_, i) =>
      setTimeout(() => setVisItems((v) => [...v, i]), 300 + i * 200)
    );
    return () => { clearTimeout(t0); timers.forEach(clearTimeout); };
  }, [active]);

  return (
    <div style={{ width: "100%", height: "100%", background: T.bg, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 40px" }}>
      <GradientBg />
      <div style={{ width: "100%", maxWidth: 380, position: "relative", zIndex: 1 }}>
        <div style={{
          fontSize: 13, color: T.accent, letterSpacing: "0.08em", textTransform: "uppercase" as const,
          marginBottom: 16, opacity: titleVis ? 1 : 0, transition: "opacity 0.4s ease",
        }}>Key Insights</div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
          {STACK_ITEMS.map((item, i) => (
            <div key={i} style={{
              background: T.glass, backdropFilter: "blur(20px)",
              border: `1px solid ${T.glassBorder}`, borderRadius: 14,
              padding: "14px 18px", marginLeft: i * 14, marginBottom: i < STACK_ITEMS.length - 1 ? -4 : 0,
              zIndex: STACK_ITEMS.length - i, position: "relative" as const,
              opacity: visItems.includes(i) ? 1 : 0,
              transform: visItems.includes(i) ? "translateY(0)" : "translateY(16px)",
              transition: "opacity 0.4s ease, transform 0.4s ease",
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent, boxShadow: `0 0 8px ${T.accentGlow}`, flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: "rgba(226,232,240,0.85)", lineHeight: 1.5, fontFamily: "system-ui, sans-serif" }}>{item}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Slide 3: Glow Metrics
const METRICS = [
  { value: 97, suffix: "%", label: "Accuracy" },
  { value: 3, suffix: "ms", label: "Latency" },
  { value: 10, suffix: "×", label: "Throughput" },
];

function GlowCard({ value, suffix, label, delay, active }: { value: number; suffix: string; label: string; delay: number; active: boolean }) {
  const [num, setNum] = useState(0);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    if (!active) { setNum(0); setVis(false); return; }
    const t = setTimeout(() => {
      setVis(true);
      let start: number | null = null;
      const step = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / 1200, 1);
        setNum(Math.round((1 - Math.pow(1 - p, 3)) * value));
        if (p < 1) requestAnimationFrame(step);
        else setNum(value);
      };
      requestAnimationFrame(step);
    }, delay);
    return () => clearTimeout(t);
  }, [active, value, delay]);

  return (
    <div style={{
      background: T.glass, backdropFilter: "blur(20px)", border: `1px solid ${T.glassBorder}`,
      borderRadius: 18, padding: "20px 22px", textAlign: "center" as const, flex: 1,
      opacity: vis ? 1 : 0, transform: vis ? "scale(1)" : "scale(0.9)",
      transition: "opacity 0.5s ease, transform 0.5s cubic-bezier(0.16,1,0.3,1)",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        border: `2px solid ${T.accent}`,
        boxShadow: `0 0 20px ${T.accentGlow}, inset 0 0 12px ${T.accentGlow}`,
        margin: "0 auto 12px",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.text, letterSpacing: "-0.02em" }}>
          {num}{suffix}
        </div>
      </div>
      <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
        {label}
      </div>
    </div>
  );
}

function SlideGlowMetrics({ active }: { active: boolean }) {
  return (
    <div style={{ width: "100%", height: "100%", background: T.bg, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 32px" }}>
      <GradientBg />
      <div style={{ display: "flex", gap: 14, width: "100%", position: "relative", zIndex: 1 }}>
        {METRICS.map((m, i) => <GlowCard key={i} {...m} delay={i * 120 + 200} active={active} />)}
      </div>
    </div>
  );
}

// ─── Dots
function SlideDots({ total, current, onDotClick }: { total: number; current: number; onDotClick: (i: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 5, position: "absolute", bottom: 10, right: 12, zIndex: 10 }}>
      {Array.from({ length: total }, (_, i) => (
        <button key={i} onClick={() => onDotClick(i)} style={{
          width: i === current ? 16 : 6, height: 6, borderRadius: 3,
          background: i === current ? T.accent : "rgba(129,140,248,0.25)",
          border: "none", cursor: "pointer", padding: 0,
          transition: "all 0.3s ease",
        }} />
      ))}
    </div>
  );
}

// ─── Main
const SLIDES = [SlideCinematicTitle, SlideGlassStack, SlideGlowMetrics];
const SLIDE_DURATION = 3500;

export default function NightfallPreview() {
  const [current, setCurrent] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setActive(true), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setActive(false);
      setTimeout(() => { setCurrent((c) => (c + 1) % SLIDES.length); setActive(true); }, 150);
    }, SLIDE_DURATION);
    return () => clearInterval(id);
  }, []);

  const handleDot = (i: number) => {
    setActive(false);
    setTimeout(() => { setCurrent(i); setActive(true); }, 100);
  };

  const SlideComp = SLIDES[current];

  return (
    <ScaledCanvas>
      <div style={{ width: "100%", height: "100%", position: "relative" }}>
        <SlideComp active={active} />
        <SlideDots total={SLIDES.length} current={current} onDotClick={handleDot} />
      </div>
    </ScaledCanvas>
  );
}
