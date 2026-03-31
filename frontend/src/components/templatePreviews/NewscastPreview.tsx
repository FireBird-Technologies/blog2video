import { useState, useEffect, useRef } from "react";

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

const BG = "#060614";
const RED = "#E82020";
const BLUE = "#1E5FD4";
const GOLD = "#D4AA50";
const STEEL = "#B8C8E0";
const PANEL = "rgba(10,42,110,0.35)";

function useFadeIn(delay = 0, active = true) {
  const [vis, setVis] = useState(false);
  useEffect(() => {
    if (!active) {
      setVis(false);
      return;
    }
    const t = setTimeout(() => setVis(true), delay);
    return () => clearTimeout(t);
  }, [delay, active]);
  return vis;
}

function GridBg() {
  return (
    <>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.08,
          backgroundImage:
            "linear-gradient(rgba(30,95,212,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(30,95,212,0.35) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: "-8%",
          top: "8%",
          width: 220,
          height: 220,
          borderRadius: "50%",
          border: "1px solid rgba(30,95,212,0.2)",
          opacity: 0.45,
          boxShadow: "inset 0 0 40px rgba(30,95,212,0.15)",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: "2%",
          top: "12%",
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: "radial-gradient(circle at 35% 35%, rgba(30,95,212,0.12) 0%, transparent 65%)",
        }}
      />
    </>
  );
}

function SlideBreakingHero({ active }: { active: boolean }) {
  const titleVis = useFadeIn(120, active);
  const subVis = useFadeIn(500, active);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: BG,
        position: "relative",
        overflow: "hidden",
        fontFamily: '"Oswald", "Arial Narrow", sans-serif',
      }}
    >
      <GridBg />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: RED, boxShadow: `0 0 16px ${RED}` }} />
      <div style={{ position: "absolute", top: 10, right: 12, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: RED }} />
        <span style={{ fontSize: 9, fontWeight: 700, color: STEEL, letterSpacing: 3, fontFamily: '"Rajdhani", sans-serif' }}>LIVE</span>
      </div>
      <div style={{ position: "absolute", top: 36, left: 0, right: 0, textAlign: "center", padding: "0 28px", zIndex: 2 }}>
        <div
          style={{
            display: "inline-block",
            padding: "4px 10px",
            border: `1px solid ${RED}`,
            color: RED,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
            marginBottom: 12,
            opacity: titleVis ? 1 : 0,
            transform: titleVis ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 0.55s ease, transform 0.55s ease",
          }}
        >
          BREAKING NEWS
        </div>
        <div
          style={{
            fontSize: 38,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "#fff",
            textTransform: "uppercase",
            opacity: titleVis ? 1 : 0,
            transform: titleVis ? "scale(1)" : "scale(0.96)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
            textShadow: "0 0 40px rgba(232,32,32,0.35)",
          }}
        >
          GLOBAL <span style={{ color: RED }}>SUMMIT</span>
        </div>
        <div
          style={{
            width: 120,
            height: 2,
            margin: "14px auto",
            background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
            opacity: titleVis ? 1 : 0,
            transition: "opacity 0.5s ease",
          }}
        />
        <div
          style={{
            fontSize: 12,
            fontWeight: 300,
            color: STEEL,
            fontFamily: '"Barlow Condensed", sans-serif',
            letterSpacing: "0.06em",
            maxWidth: 360,
            margin: "0 auto",
            opacity: subVis ? 1 : 0,
            transform: subVis ? "translateY(0)" : "translateY(6px)",
            transition: "opacity 0.55s ease, transform 0.55s ease",
          }}
        >
          Live broadcast package — lower third, ticker, glass panels
        </div>
      </div>
    </div>
  );
}

function SlideGlassNarrative({ active }: { active: boolean }) {
  const cardVis = useFadeIn(100, active);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: BG,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 36px",
        fontFamily: '"Oswald", "Arial Narrow", sans-serif',
      }}
    >
      <GridBg />
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: PANEL,
          border: "1px solid rgba(200,220,255,0.22)",
          borderTop: `3px solid ${RED}`,
          borderRadius: 10,
          padding: "16px 18px",
          backdropFilter: "blur(8px)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
          opacity: cardVis ? 1 : 0,
          transform: cardVis ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 0.55s ease, transform 0.55s ease",
        }}
      >
        <div style={{ fontSize: 8, fontWeight: 700, color: RED, letterSpacing: 3, fontFamily: '"Rajdhani", sans-serif' }}>WORLD AFFAIRS</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", textTransform: "uppercase", marginTop: 8, lineHeight: 1.15 }}>
          Leaders agree on framework
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            lineHeight: 1.45,
            color: STEEL,
            fontFamily: '"Barlow Condensed", sans-serif',
            fontWeight: 400,
          }}
        >
          Officials sign a binding accord after overnight sessions. The deal includes verification and sector-wide targets.
        </div>
      </div>
    </div>
  );
}

const METRICS = [
  { value: "142", label: "NATIONS", suffix: "" },
  { value: "40", label: "CUT", suffix: "%" },
];

function SlideGlowMetrics({ active }: { active: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: BG,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        padding: "0 32px",
        fontFamily: '"Oswald", sans-serif',
      }}
    >
      <GridBg />
      {METRICS.map((m, i) => (
        <div
          key={m.label}
          style={{
            flex: 1,
            maxWidth: 160,
            background: PANEL,
            border: "1px solid rgba(200,220,255,0.2)",
            borderTop: `3px solid ${i === 0 ? RED : BLUE}`,
            borderRadius: 10,
            padding: "14px 12px",
            textAlign: "center",
            opacity: active ? 1 : 0.4,
            transform: active ? "translateY(0)" : "translateY(6px)",
            transition: `opacity 0.5s ease ${i * 80}ms, transform 0.5s ease ${i * 80}ms`,
          }}
        >
          <div style={{ fontSize: 36, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
            {m.value}
            <span style={{ fontSize: 16, color: GOLD }}>{m.suffix}</span>
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, color: STEEL, letterSpacing: 2, marginTop: 4, fontFamily: '"Rajdhani", sans-serif' }}>{m.label}</div>
        </div>
      ))}
    </div>
  );
}

function SlideDots({ total, current, onDotClick }: { total: number; current: number; onDotClick: (i: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 5, position: "absolute", bottom: 10, right: 12, zIndex: 10 }}>
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onDotClick(i)}
          style={{
            width: i === current ? 16 : 6,
            height: 6,
            borderRadius: 3,
            background: i === current ? RED : "rgba(232,32,32,0.25)",
            border: "none",
            cursor: "pointer",
            padding: 0,
            transition: "all 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

const SLIDES = [SlideBreakingHero, SlideGlassNarrative, SlideGlowMetrics];
const SLIDE_DURATION = 3500;

export default function NewscastPreview() {
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
    setTimeout(() => {
      setCurrent(i);
      setActive(true);
    }, 100);
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
