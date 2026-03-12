import { useState, useEffect, useRef, useMemo } from "react";

// ── Preview palette
const ACCENT = "#007AFF";
const BG     = "#F5F5F7";
const TEXT   = "#1D1D1F";
const YELLOW = "#FFD60A";

const INTERNAL_W = 480;
const INTERNAL_H = 270;

// ─────────────────────────────────────────────────
// ScaledCanvas & Core Helpers
// ─────────────────────────────────────────────────
function ScaledCanvas({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

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

function useFrame(active: boolean, fps = 30, maxFrames = 150): number {
  const [frame, setFrame] = useState(0);
  const rafRef   = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) { setFrame(0); return; }
    startRef.current = null;
    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const f = Math.min(Math.floor(((ts - startRef.current) / 1000) * fps), maxFrames);
      setFrame(f);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active, fps, maxFrames]);

  return frame;
}

function springVal(frame: number, delay = 0, damping = 20, stiffness = 100): number {
  const f = Math.max(0, frame - delay);
  const w = Math.sqrt(stiffness);
  const d = damping / (2 * Math.sqrt(stiffness));
  if (d < 1) {
    const wd = w * Math.sqrt(1 - d * d);
    return 1 - Math.exp(-d * w * f / 30) * (Math.cos(wd * f / 30) + (d * w / wd) * Math.sin(wd * f / 30));
  }
  return 1 - Math.exp(-w * f / 30) * (1 + w * f / 30);
}

const lerp = (t: number, a: number, b: number) => a + Math.max(0, Math.min(1, t)) * (b - a);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ══════════════════════════════════════════════════
// SLIDE 1 — HeroImage (Increased Orbit Radius)
// ══════════════════════════════════════════════════
function SlideHeroImage({ active }: { active: boolean }) {
  const frame = useFrame(active);
  const titleS = springVal(frame, 5, 40, 80);
  const narrationS = springVal(frame, 15, 40, 80);
  const contentOp = springVal(frame, 0, 30, 60);

  const t = frame * 0.05; 
  // INCREASED RADIUS: Moved from 160x90 to 210x110
  const radiusX = 210; 
  const radiusY = 110;
  
  const planeX = Math.cos(t) * radiusX;
  const planeY = Math.sin(t) * radiusY;
  const angle = (Math.atan2(radiusY * Math.cos(t), -radiusX * Math.sin(t)) * 180) / Math.PI + 90;

  return (
    <div style={{ width: "100%", height: "100%", background: BG, display: "flex", overflow: "hidden", position: "relative", fontFamily: "sans-serif" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", position: "relative" }}>
        <div style={{ 
          position: "absolute", 
          zIndex: 10, 
          transform: `translate(${planeX}px, ${planeY}px) rotate(${angle}deg)`,
          opacity: lerp(contentOp, 0, 1)
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill={ACCENT}>
            <path d="M21,16L21,14L13,9L13,3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z" />
          </svg>
        </div>
        <div style={{ textAlign: "center", zIndex: 1, maxWidth: '65%' }}>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: TEXT, margin: 0, textTransform: "uppercase", opacity: lerp(titleS, 0, 1), transform: `scale(${lerp(titleS, 0.8, 1)})` }}>
            Launch Ready
          </h1>
          <p style={{ fontSize: 13, color: TEXT, opacity: lerp(narrationS, 0, 0.7), marginTop: 10, lineHeight: 1.4, transform: `translateY(${lerp(narrationS, 10, 0)}px)` }}>
            Crafting high-impact visual stories through automated motion design and precision.
          </p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// SLIDE 2 — TextNarration (Octagon Hatching + Fade Out)
// ══════════════════════════════════════════════════
function SlideTextNarration({ active }: { active: boolean }) {
  const frame = useFrame(active);
  const blowStart = 80;
  const blowProgress = clamp((frame - blowStart) / 55, 0, 1);
  const colors = [TEXT, ACCENT, YELLOW];

  // FEWER LINES: Reduced from 12 to 4 per corner
  const octLines = useMemo(() => {
    return Array.from({ length: 4 }).map(() => 
      Array.from({ length: 4 }).map((_, i) => {
        const x = 60 + (i * 35); 
        const y = 60 + (i * 35);
        const width = Math.sqrt(x*x + y*y);
        const angle = Math.atan2(y, -x) * (180 / Math.PI);
        return { x, y, width, angle, color: colors[i % colors.length] };
      })
    );
  }, []);

  const getBlowProps = (seed: number) => {
    const angle = (Math.sin(seed) * Math.PI * 2);
    const dist = 140 + Math.abs(Math.cos(seed) * 180);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, rotate: Math.sin(seed * 3) * 540 };
  };

  return (
    <div style={{ width: "100%", height: "100%", background: BG, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
      
      {/* 4 Corner Hatching (Fades out with blowProgress) */}
      {[
        { top: 0, left: 0, sx: 1, sy: 1 },
        { top: 0, right: 0, sx: -1, sy: 1 },
        { bottom: 0, left: 0, sx: 1, sy: -1 },
        { bottom: 0, right: 0, sx: -1, sy: -1 }
      ].map((pos, cornerIdx) => (
        <div key={cornerIdx} style={{ 
            position: "absolute", 
            top: pos.top, left: pos.left, right: pos.right, bottom: pos.bottom,
            width: 200, height: 200, 
            transform: `scale(${pos.sx}, ${pos.sy})`,
            opacity: 1 - blowProgress // FADE OUT
        }}>
          {octLines[cornerIdx].map((line, i) => (
            <div key={i} style={{
              position: 'absolute',
              top: 0,
              left: line.x,
              width: line.width,
              height: 2.5,
              background: line.color,
              opacity: 0.6,
              transformOrigin: '0% 0%',
              transform: `rotate(${line.angle}deg)`,
            }} />
          ))}
        </div>
      ))}

      <div style={{ textAlign: "center", maxWidth: "85%", display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
        {words_array.map((word, wi) => (
          <div key={wi} style={{ display: "flex", marginRight: 10 }}>
            {word.split("").map((char, ci) => {
              const seed = (wi * 17) + ci;
              const props = getBlowProps(seed);
              const delay = (wi * 2 + ci) * 0.012;
              const p = clamp((blowProgress - delay) * 1.6, 0, 1);
              return (
                <span key={ci} style={{
                  display: "inline-block",
                  fontSize: 22,
                  fontWeight: 300,
                  color: TEXT,
                  transform: `translate(${p * props.x}px, ${p * props.y}px) rotate(${p * props.rotate}deg)`,
                  opacity: 1 - p,
                  whiteSpace: 'pre'
                }}>
                  {char}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
const words_array = "Every detail is engineered for maximum emotional resonance.".split(" ");

// ══════════════════════════════════════════════════
// SLIDE 3 — Metric
// ══════════════════════════════════════════════════
function SlideMetric({ active }: { active: boolean }) {
  const frame = useFrame(active);
  const spring = springVal(frame, 10, 25, 80);
  const count = Math.floor(lerp(spring, 0, 97));
  const size = 165;
  const radius = (size - 12) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (spring * 0.97) * circ;

  return (
    <div style={{ width: "100%", height: "100%", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
       <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
            <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={`${TEXT}11`} strokeWidth={12} />
            <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={ACCENT} strokeWidth={12} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
          </svg>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44, fontWeight: 900, color: TEXT }}>{count}%</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: ACCENT, letterSpacing: 2 }}>RETENTION</div>
          </div>
       </div>
    </div>
  );
}

export default function TemplatePreview() {
  const [current, setCurrent] = useState(0);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setActive(false);
      setTimeout(() => {
        setCurrent(c => (c + 1) % 3);
        setActive(true);
      }, 150);
    }, 5100);
    return () => clearInterval(id);
  }, []);

  const SLIDES = [SlideHeroImage, SlideTextNarration, SlideMetric];
  const ActiveSlide = SLIDES[current];

  return <ScaledCanvas><ActiveSlide active={active} /></ScaledCanvas>;
}