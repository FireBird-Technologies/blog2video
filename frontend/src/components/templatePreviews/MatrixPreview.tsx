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
const ACCENT = "#00FF41";
const BLACK = "#000000";
const MUTED = "#00FF4166";
const FONT = "'Fira Code', 'Courier New', monospace";

// ─── Digital rain background (lightweight CSS version for preview)
function RainBackground() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: 0.25 }}>
      {Array.from({ length: 20 }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${i * 5}%`,
            top: -20,
            fontSize: 11,
            fontFamily: FONT,
            color: ACCENT,
            lineHeight: 1.3,
            opacity: 0.3 + Math.random() * 0.5,
            animation: `matrixFall ${2 + Math.random() * 3}s linear ${Math.random() * 2}s infinite`,
            whiteSpace: "pre",
          }}
        >
          {"アイウ01\nカキク23\nサシス45\nタチツ67\nナニヌ89\nハヒフAB\nマミムCD".split("\n").join("\n")}
        </div>
      ))}
      <style>{`
        @keyframes matrixFall {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(350px); }
        }
      `}</style>
    </div>
  );
}

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

// ─── Glitch text decode hook
function useGlitchText(active: boolean, text: string, delay = 0) {
  const GLITCH = "アイウ0123!@#$%";
  const [display, setDisplay] = useState("");

  useEffect(() => {
    if (!active) { setDisplay(""); return; }
    let raf: number;
    let frameCount = 0;
    const chars = text.split("");
    const framesPerChar = 3;

    function tick() {
      frameCount++;
      const revealed = Math.floor((frameCount - delay / 16) / framesPerChar);
      const result = chars.map((ch, i) => {
        if (ch === " ") return " ";
        if (i < revealed) return ch;
        if (i < revealed + 4 && frameCount > delay / 16) {
          return GLITCH[Math.floor(Math.random() * GLITCH.length)];
        }
        return " ";
      }).join("");
      setDisplay(result);
      if (revealed < chars.length + 4) {
        raf = requestAnimationFrame(tick);
      } else {
        setDisplay(text);
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, text, delay]);

  return display;
}

// ─── Slide 1: Matrix Title (character decode)
function SlideMatrixTitle({ active }: { active: boolean }) {
  const decoded = useGlitchText(active, "SYSTEM ONLINE", 200);
  const subS = useSpring(active, { stiffness: 160, damping: 20, delay: 800 });

  return (
    <div style={{ width: "100%", height: "100%", background: BLACK, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <RainBackground />
      <div style={{ textAlign: "center", padding: "0 48px", position: "relative", zIndex: 1 }}>
        <div style={{
          fontSize: 48, fontWeight: 700, color: ACCENT, letterSpacing: "-0.02em", lineHeight: 1.1,
          fontFamily: FONT, textTransform: "uppercase" as const,
          textShadow: `0 0 20px ${ACCENT}88, 0 0 40px ${ACCENT}44`,
        }}>
          {decoded || "\u00A0"}
        </div>
        <div style={{
          marginTop: 12, fontSize: 11, fontWeight: 400, color: MUTED,
          letterSpacing: "0.08em",
          opacity: subS, transform: `translateY(${(1 - subS) * 12}px)`,
          fontFamily: FONT,
        }}>
          Digital rain on a black void
        </div>
      </div>
    </div>
  );
}

// ─── Slide 2: Data Stream (terminal list)
const LIST_ITEMS = ["Lightning fast performance", "Zero config setup", "Built-in analytics"];

function SlideDataStream({ active }: { active: boolean }) {
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
      <RainBackground />
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16, position: "relative", zIndex: 1 }}>
        {LIST_ITEMS.map((item, i) => {
          const shown = i <= current;
          const dimmed = shown && i < current;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 14,
              transform: shown ? "translateX(0)" : "translateX(60px)",
              opacity: shown ? (dimmed ? 0.3 : 1) : 0,
              transition: "transform 0.4s cubic-bezier(.17,.67,.22,1.2), opacity 0.35s ease",
            }}>
              <span style={{
                fontSize: 18, fontWeight: 700, color: ACCENT, minWidth: 55,
                fontFamily: FONT,
                textShadow: `0 0 8px ${ACCENT}66`,
              }}>
                {">"} {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{
                fontSize: 20, fontWeight: 400, color: ACCENT,
                fontFamily: FONT, letterSpacing: "0.01em",
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

// ─── Slide 3: Cipher Metric (number decode)
function SlideCipherMetric({ active }: { active: boolean }) {
  const num = useCountUp(active, 97, 1200);
  const cardS = useSpring(active, { stiffness: 160, damping: 20, delay: 900 });
  const glowPulse = active ? 0.7 + Math.sin(Date.now() * 0.003) * 0.3 : 0;

  return (
    <div style={{ width: "100%", height: "100%", background: BLACK, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <RainBackground />
      <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{
          fontSize: 100, fontWeight: 700, color: ACCENT, letterSpacing: "-0.03em",
          lineHeight: 1, fontFamily: FONT,
          textShadow: `0 0 ${20 * glowPulse}px ${ACCENT}88, 0 0 ${40 * glowPulse}px ${ACCENT}44`,
        }}>
          {active ? num : 0}
          <span style={{ color: MUTED, fontSize: 50 }}>%</span>
        </div>
        <div style={{
          marginTop: 16,
          border: `1px solid ${ACCENT}44`,
          padding: "10px 28px", display: "inline-block",
          opacity: cardS, transform: `translateY(${(1 - cardS) * 10}px)`,
        }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: ACCENT, letterSpacing: "0.12em",
            textTransform: "uppercase" as const, fontFamily: FONT,
          }}>
            System Uptime
          </div>
          <div style={{ fontSize: 10, color: MUTED, marginTop: 3, fontFamily: FONT }}>
            Based on 12,000+ requests
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
          background: i === current ? ACCENT : `${ACCENT}44`,
          border: "none", cursor: "pointer", padding: 0,
          transition: "all 0.3s ease",
        }} />
      ))}
    </div>
  );
}

// ─── Main
const SLIDES = [SlideMatrixTitle, SlideDataStream, SlideCipherMetric];
const SLIDE_DURATION = 3500;

export default function MatrixPreview() {
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
