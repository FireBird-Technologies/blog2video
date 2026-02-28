import { useState, useEffect, useRef } from "react";

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

const ACCENT = "#F97316";
const WHITE = "#FFFFFF";
const DARK = "#171717";
const MUTED = "#6B7280";
const BG = "linear-gradient(135deg, #fde8d8 0%, #fef3e2 50%, #e8f4fd 100%)";

function glassStyle(accent: boolean): React.CSSProperties {
  return {
    background: accent ? "rgba(249,115,22,0.72)" : "rgba(255,255,255,0.55)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    border: accent ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.7)",
    boxShadow: accent
      ? "0 8px 32px rgba(249,115,22,0.25), inset 0 1px 0 rgba(255,255,255,0.3)"
      : "0 4px 24px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)",
    borderRadius: 12,
    padding: "10px 12px",
    color: accent ? WHITE : DARK,
  };
}

function useStagger(count: number, delayMs: number, active: boolean) {
  const [vis, setVis] = useState<number[]>([]);
  useEffect(() => {
    setVis([]);
    if (!active) return;
    const timers = Array.from({ length: count }, (_, i) =>
      setTimeout(() => setVis((v) => [...v, i]), i * delayMs + 120)
    );
    return () => timers.forEach(clearTimeout);
  }, [active, count, delayMs]);
  return vis;
}

function Blobs() {
  return (
    <>
      <div style={{ position: "absolute", width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,115,22,0.28) 0%, transparent 70%)", top: "-10%", left: "-15%", filter: "blur(40px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, rgba(251,191,36,0.18) 0%, transparent 70%)", bottom: "-5%", right: "-10%", filter: "blur(40px)", pointerEvents: "none" }} />
    </>
  );
}

function SlideBentoHero({ active }: { active: boolean }) {
  const vis = useStagger(3, 90, active);
  const pop = (i: number): React.CSSProperties => ({
    opacity: vis.includes(i) ? 1 : 0,
    transform: vis.includes(i) ? "scale(1)" : "scale(0.88)",
    transition: "opacity 0.3s ease, transform 0.3s ease",
  });

  return (
    <div style={{ width: "100%", height: "100%", background: BG, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Blobs />
      <div style={{ width: "88%", position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "auto auto", gap: 6 }}>
        <div style={{ ...glassStyle(true), gridColumn: "1 / -1", display: "flex", flexDirection: "column", justifyContent: "flex-end", ...pop(0) }}>
          <div style={{ fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase" as const, opacity: 0.75, marginBottom: 4, fontWeight: 300 }}>Template System</div>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1, fontFamily: "Georgia, serif" }}>Gridcraft</div>
          <div style={{ fontSize: 9, opacity: 0.8, marginTop: 4, fontWeight: 300 }}>Bento editorial in motion</div>
        </div>
        <div style={{ ...glassStyle(false), display: "flex", alignItems: "center", justifyContent: "center", ...pop(1) }}>
          <span style={{ fontSize: 22 }}>🎨</span>
        </div>
        <div style={{ ...glassStyle(false), display: "flex", flexDirection: "column", justifyContent: "center", ...pop(2) }}>
          <div style={{ fontSize: 8, color: MUTED, fontWeight: 300 }}>Version</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: DARK }}>1.0</div>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: "⚡", label: "Instant Deploy" },
  { icon: "🔒", label: "Zero Trust" },
  { icon: "📊", label: "Live Analytics" },
  { icon: "🔄", label: "Auto Scale" },
  { icon: "🧩", label: "Composable" },
  { icon: "🌍", label: "Global Edge" },
];

function SlideBentoFeatures({ active }: { active: boolean }) {
  const vis = useStagger(6, 70, active);
  return (
    <div style={{ width: "100%", height: "100%", background: BG, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Blobs />
      <div style={{ width: "90%", position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr 1fr", gap: 6 }}>
        {FEATURES.map((f, i) => (
          <div key={i} style={{
            ...glassStyle(i === 2),
            opacity: vis.includes(i) ? 1 : 0,
            transform: vis.includes(i) ? "scale(1)" : "scale(0.88)",
            transition: "opacity 0.3s ease, transform 0.3s ease",
          }}>
            <div style={{ fontSize: 16, marginBottom: 3 }}>{f.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 700 }}>{f.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const KPIS = [
  { num: 99.99, suffix: "%", label: "Uptime SLA", accent: true },
  { num: 15, suffix: "ms", label: "P95 Latency", accent: false },
  { num: 3.2, suffix: "×", label: "Cost Savings", accent: false },
];

function KpiCell({ num, suffix, label, accent, delay, active }: { num: number; suffix: string; label: string; accent: boolean; delay: number; active: boolean }) {
  const [counter, setCounter] = useState(0);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    if (!active) { setCounter(0); setVis(false); return; }
    const t = setTimeout(() => {
      setVis(true);
      const dur = 800;
      const start = Date.now();
      const tick = () => {
        const p = Math.min((Date.now() - start) / dur, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        setCounter(Math.round(num * ease * 100) / 100);
        if (p < 1) requestAnimationFrame(tick);
        else setCounter(num);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(t);
  }, [active, num, delay]);

  return (
    <div style={{
      ...glassStyle(accent),
      display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", gap: 2,
      opacity: vis ? 1 : 0, transform: vis ? "scale(1)" : "scale(0.88)",
      transition: `opacity 0.3s ease ${delay}ms, transform 0.3s ease ${delay}ms`,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" as const }}>
        {counter}{suffix}
      </div>
      <div style={{ fontSize: 8, opacity: accent ? 0.8 : undefined, color: !accent ? MUTED : undefined, textTransform: "uppercase" as const, letterSpacing: "0.06em", fontWeight: 300 }}>
        {label}
      </div>
    </div>
  );
}

function SlideKpiGrid({ active }: { active: boolean }) {
  return (
    <div style={{ width: "100%", height: "100%", background: BG, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Blobs />
      <div style={{ width: "90%", position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {KPIS.map((kpi, i) => <KpiCell key={i} {...kpi} delay={i * 100 + 80} active={active} />)}
      </div>
    </div>
  );
}

function SlideDots({ total, current, onDotClick }: { total: number; current: number; onDotClick: (i: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
      {Array.from({ length: total }, (_, i) => (
        <button key={i} onClick={() => onDotClick(i)} style={{
          width: i === current ? 12 : 5, height: 5, borderRadius: 3,
          background: i === current ? ACCENT : "rgba(249,115,22,0.25)",
          border: "none", cursor: "pointer", padding: 0,
          transition: "all 0.3s ease",
        }} />
      ))}
    </div>
  );
}

const SLIDES = [SlideBentoHero, SlideBentoFeatures, SlideKpiGrid];
const SLIDE_DURATION = 3500;

export default function GridcraftPreviewPortrait() {
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
