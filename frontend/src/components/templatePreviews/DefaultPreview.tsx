import { useState, useEffect, useRef } from "react";

// ─── Scale wrapper: renders content at fixed internal size, scales to container
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
    <div
      ref={ref}
      style={{ width: "100%", aspectRatio: `${INTERNAL_W}/${INTERNAL_H}`, overflow: "hidden", position: "relative" }}
    >
      <div style={{ width: INTERNAL_W, height: INTERNAL_H, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute" }}>
        {children}
      </div>
    </div>
  );
}

// ─── Shared colors (matches default template meta.json)
const PURPLE = "#7C3AED";
const WHITE = "#FFFFFF";
const DARK = "#111827";
const MUTED = "#6B7280";
const PURPLE_LIGHT = "rgba(124,58,237,0.08)";

// ─── Slide 1: Hero
function SlideHero({ active }: { active: boolean }) {
  const [titleVis, setTitleVis] = useState(false);
  const [barW, setBarW] = useState(0);
  const [subVis, setSubVis] = useState(false);

  useEffect(() => {
    if (!active) { setTitleVis(false); setBarW(0); setSubVis(false); return; }
    const t1 = setTimeout(() => setBarW(100), 100);
    const t2 = setTimeout(() => setTitleVis(true), 300);
    const t3 = setTimeout(() => setSubVis(true), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active]);

  return (
    <div style={{ width: "100%", height: "100%", background: WHITE, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 48px" }}>
      {/* Decorative circles */}
      <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", border: `2px solid ${PURPLE}18` }} />
      <div style={{ position: "absolute", top: 20, right: 20, width: 80, height: 80, borderRadius: "50%", border: `2px solid ${PURPLE}12` }} />
      <div style={{ position: "absolute", bottom: -20, left: -20, width: 100, height: 100, borderRadius: "50%", backgroundColor: PURPLE_LIGHT }} />

      {/* Accent bar */}
      <div style={{ width: barW, height: 4, backgroundColor: PURPLE, borderRadius: 2, marginBottom: 20, transition: "width 0.5s cubic-bezier(0.16,1,0.3,1)" }} />

      {/* Title */}
      <div style={{
        fontSize: 38, fontWeight: 800, color: DARK, lineHeight: 1.2,
        fontFamily: "Inter, system-ui, sans-serif",
        opacity: titleVis ? 1 : 0, transform: titleVis ? "translateY(0)" : "translateY(24px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
        letterSpacing: "-0.02em",
      }}>
        Geometric Explainer
      </div>

      {/* Subtitle */}
      <div style={{
        fontSize: 16, color: MUTED, marginTop: 12, fontFamily: "Inter, system-ui, sans-serif", fontWeight: 400,
        opacity: subVis ? 1 : 0, transform: subVis ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}>
        Turning complex topics into clear visuals
      </div>

      {/* Bottom bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 4, backgroundColor: PURPLE }} />
    </div>
  );
}

// ─── Slide 2: Bullet list
const BULLETS = ["AI-powered script generation", "Automatic scene detection", "Professional narration voices"];

function SlideBullets({ active }: { active: boolean }) {
  const [visible, setVisible] = useState<number[]>([]);
  const [titleVis, setTitleVis] = useState(false);

  useEffect(() => {
    if (!active) { setVisible([]); setTitleVis(false); return; }
    const t0 = setTimeout(() => setTitleVis(true), 100);
    const timers = BULLETS.map((_, i) =>
      setTimeout(() => setVisible((v) => [...v, i]), 300 + i * 200)
    );
    return () => { clearTimeout(t0); timers.forEach(clearTimeout); };
  }, [active]);

  return (
    <div style={{ width: "100%", height: "100%", background: WHITE, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 48px" }}>
      {/* Decorative circle */}
      <div style={{ position: "absolute", top: -50, right: -50, width: 200, height: 200, borderRadius: "50%", border: `2px solid ${PURPLE}15` }} />

      {/* Title */}
      <div style={{
        fontSize: 26, fontWeight: 700, color: DARK, marginBottom: 24, fontFamily: "Inter, system-ui, sans-serif",
        opacity: titleVis ? 1 : 0, transition: "opacity 0.4s ease",
      }}>
        Key Features
      </div>

      {/* Bullets */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {BULLETS.map((b, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 14,
            opacity: visible.includes(i) ? 1 : 0,
            transform: visible.includes(i) ? "translateX(0)" : "translateX(-32px)",
            transition: "opacity 0.4s ease, transform 0.4s ease",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, backgroundColor: PURPLE_LIGHT,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <span style={{ color: PURPLE, fontWeight: 700, fontSize: 13, fontFamily: "Inter, sans-serif" }}>{i + 1}</span>
            </div>
            <span style={{ color: DARK, fontSize: 18, fontFamily: "Inter, system-ui, sans-serif", fontWeight: 500 }}>{b}</span>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 4, backgroundColor: PURPLE }} />
    </div>
  );
}

// ─── Slide 3: Metric
function useCountUp(target: number, duration = 1200, active = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) { setVal(0); return; }
    let start: number | null = null;
    let raf: number;
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min((t - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * target));
      if (p < 1) raf = requestAnimationFrame(step);
      else setVal(target);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);
  return val;
}

function SlideMetric({ active }: { active: boolean }) {
  const num = useCountUp(97, 1200, active);
  const [labelVis, setLabelVis] = useState(false);

  useEffect(() => {
    if (!active) { setLabelVis(false); return; }
    const t = setTimeout(() => setLabelVis(true), 900);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <div style={{ width: "100%", height: "100%", background: WHITE, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      {/* Background decoration */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 200, height: 200, borderRadius: "50%", border: `2px solid ${PURPLE}10` }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 150, height: 150, borderRadius: "50%", border: `2px solid ${PURPLE}08` }} />

      {/* Big number */}
      <div style={{ fontSize: 72, fontWeight: 800, color: PURPLE, lineHeight: 1, fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "-0.04em", position: "relative", zIndex: 1 }}>
        {active ? num : 0}
        <span style={{ fontSize: 36, color: DARK, fontWeight: 700 }}>%</span>
      </div>

      {/* Label */}
      <div style={{
        fontSize: 18, color: DARK, fontWeight: 600, marginTop: 12, fontFamily: "Inter, system-ui, sans-serif",
        opacity: labelVis ? 1 : 0, transform: labelVis ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}>
        Viewer Retention
      </div>
      <div style={{
        fontSize: 13, color: MUTED, marginTop: 6, fontFamily: "Inter, system-ui, sans-serif",
        opacity: labelVis ? 1 : 0, transition: "opacity 0.5s ease 0.1s",
      }}>
        Average across 10,000+ videos
      </div>

      {/* Bottom bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 4, backgroundColor: PURPLE }} />
    </div>
  );
}

// ─── Slide indicator dots
function SlideDots({ total, current, onDotClick }: { total: number; current: number; onDotClick: (i: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 5, position: "absolute", bottom: 12, right: 14, zIndex: 10 }}>
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          onClick={() => onDotClick(i)}
          style={{
            width: i === current ? 16 : 6, height: 6, borderRadius: 3,
            background: i === current ? PURPLE : "rgba(124,58,237,0.25)",
            border: "none", cursor: "pointer", padding: 0,
            transition: "all 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

// ─── Main
const SLIDES = [SlideHero, SlideBullets, SlideMetric];
const SLIDE_DURATION = 3500;

export default function DefaultPreview() {
  const [current, setCurrent] = useState(0);
  const [active, setActive] = useState(false);

  // Start first slide after mount
  useEffect(() => {
    const t = setTimeout(() => setActive(true), 200);
    return () => clearTimeout(t);
  }, []);

  // Auto-cycle
  useEffect(() => {
    const id = setInterval(() => {
      setActive(false);
      setTimeout(() => {
        setCurrent((c) => (c + 1) % SLIDES.length);
        setActive(true);
      }, 150);
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
