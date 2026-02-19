import { useState, useEffect, useRef } from "react";

// ─── Scale wrapper (same pattern as other template previews)
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
const ACCENT = "#EF4444";
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const MUTED = "#666666";

function useSpring(
  active: boolean,
  options: { stiffness?: number; damping?: number; delay?: number } = {}
) {
  const { stiffness = 200, damping = 18, delay = 0 } = options;
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) { setValue(0); return; }
    let start: number | null = null;
    let raf: number;
    let vel = 0;
    let pos = 0;

    function tick(t: number) {
      if (!start) start = t + delay;
      if (t < start) { raf = requestAnimationFrame(tick); return; }
      const force = -stiffness * (pos - 1) - damping * vel;
      vel += force * (1 / 60);
      pos += vel * (1 / 60);
      setValue(pos);
      if (Math.abs(pos - 1) > 0.001 || Math.abs(vel) > 0.001) {
        raf = requestAnimationFrame(tick);
      } else {
        setValue(1);
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, delay, stiffness, damping]);

  return value;
}

function useCountUp(active: boolean, target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) { setVal(0); return; }
    let start: number | null = null;
    let raf: number;
    function tick(t: number) {
      if (!start) start = t;
      const p = Math.min((t - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * target));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setVal(target);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);
  return val;
}

// ─── Slide 1: Impact Title (slam-in)
function SlideImpactTitle({ active }: { active: boolean }) {
  const s = useSpring(active, { stiffness: 210, damping: 16 });
  const subS = useSpring(active, { stiffness: 160, damping: 20, delay: 400 });
  const scale = active ? 0.6 + s * 0.4 + Math.sin(s * Math.PI) * 0.05 : 0.6;

  return (
    <div style={{ width: "100%", height: "100%", background: BLACK, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", padding: "0 48px", position: "relative", zIndex: 1 }}>
        <div style={{
          fontSize: 52, fontWeight: 900, color: WHITE, letterSpacing: "-0.03em", lineHeight: 1.05,
          transform: `scale(${Math.max(scale, 0.3)})`, opacity: Math.min(s * 2, 1),
          fontFamily: "'Arial Black', Arial, sans-serif", textTransform: "uppercase" as const,
        }}>
          THE FUTURE<br />
          <span style={{ color: ACCENT }}>IS NOW</span>
        </div>
        <div style={{
          marginTop: 10, fontSize: 11, fontWeight: 300, color: MUTED,
          letterSpacing: "0.15em", textTransform: "uppercase" as const,
          opacity: subS, transform: `translateY(${(1 - subS) * 12}px)`,
          fontFamily: "Arial, sans-serif",
        }}>
          Bold statements for the modern era
        </div>
      </div>
    </div>
  );
}

// ─── Slide 2: Cascade List (stacking items)
const LIST_ITEMS = ["Lightning fast performance", "Zero config setup required", "Built-in analytics dashboard"];

function SlideCascadeList({ active }: { active: boolean }) {
  const [current, setCurrent] = useState(-1);

  useEffect(() => {
    if (!active) { setCurrent(-1); return; }
    let i = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const go = () => {
      setCurrent(i);
      i++;
      if (i < LIST_ITEMS.length) timers.push(setTimeout(go, 500));
    };
    timers.push(setTimeout(go, 200));
    return () => timers.forEach(clearTimeout);
  }, [active]);

  return (
    <div style={{ width: "100%", height: "100%", background: BLACK, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", padding: "0 40px" }}>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
        {LIST_ITEMS.map((item, i) => {
          const shown = i <= current;
          const dimmed = shown && i < current;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 16,
              transform: shown ? "translateX(0)" : "translateX(60px)",
              opacity: shown ? (dimmed ? 0.3 : 1) : 0,
              transition: "transform 0.4s cubic-bezier(.17,.67,.22,1.2), opacity 0.35s ease",
            }}>
              <span style={{
                fontSize: 20, fontWeight: 900, color: ACCENT, minWidth: 32,
                fontFamily: "'Arial Black', sans-serif",
              }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{
                fontSize: 22, fontWeight: 700, color: WHITE,
                fontFamily: "Arial, sans-serif", letterSpacing: "-0.01em",
              }}>
                {item}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Slide 3: Stat Stage (number spotlight)
function SlideStatStage({ active }: { active: boolean }) {
  const num = useCountUp(active, 97, 1200);
  const cardS = useSpring(active, { stiffness: 160, damping: 20, delay: 900 });

  return (
    <div style={{ width: "100%", height: "100%", background: BLACK, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontSize: 100, fontWeight: 900, color: WHITE, letterSpacing: "-0.05em",
          lineHeight: 1, fontFamily: "'Arial Black', sans-serif",
        }}>
          {active ? num : 0}
          <span style={{ color: ACCENT, fontSize: 50 }}>%</span>
        </div>
        <div style={{
          marginTop: 16, background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 4, padding: "10px 28px", display: "inline-block",
          opacity: cardS, transform: `translateY(${(1 - cardS) * 10}px)`,
        }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: WHITE, letterSpacing: "0.12em",
            textTransform: "uppercase" as const, fontFamily: "Arial, sans-serif",
          }}>
            Customer Satisfaction
          </div>
          <div style={{ fontSize: 10, color: MUTED, marginTop: 3, fontFamily: "Arial, sans-serif" }}>
            Based on 12,000+ reviews
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Slide indicator dots
function SlideDots({ total, current, onDotClick }: { total: number; current: number; onDotClick: (i: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 5, position: "absolute", bottom: 10, right: 12, zIndex: 10 }}>
      {Array.from({ length: total }, (_, i) => (
        <button key={i} onClick={() => onDotClick(i)} style={{
          width: i === current ? 16 : 6, height: 6, borderRadius: 3,
          background: i === current ? ACCENT : "rgba(239,68,68,0.3)",
          border: "none", cursor: "pointer", padding: 0,
          transition: "all 0.3s ease",
        }} />
      ))}
    </div>
  );
}

// ─── Main
const SLIDES = [SlideImpactTitle, SlideCascadeList, SlideStatStage];
const SLIDE_DURATION = 3500;

export default function SpotlightPreview() {
  const [current, setCurrent] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setActive(true), 200);
    return () => clearTimeout(t);
  }, []);

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
