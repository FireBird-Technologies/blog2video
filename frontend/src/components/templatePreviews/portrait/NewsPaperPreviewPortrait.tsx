import { useState, useEffect, useRef, useCallback, FC, ReactNode } from "react";

/* ── Portrait scale wrapper (9:16) ── */
const IW = 270 as const;
const IH = 480 as const;

const ScaledCanvas: FC<{ children: ReactNode }> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(0.5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // offsetWidth = layout width, immune to the coverflow's scale/rotate.
    const upd = () => setScale(el.offsetWidth / IW);
    upd();
    const obs = new ResizeObserver(upd);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width: "100%", aspectRatio: `${IW}/${IH}`, position: "relative", overflow: "hidden", borderRadius: 14 }}>
      <div style={{ width: IW, height: IH, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute" }}>
        {children}
      </div>
    </div>
  );
};

/* ── Design tokens (match NewsPaperPreview) — yellow accent only, no blue ── */
const BG     = "#FAFAF8" as const;
const TEXT   = "#111111" as const;
const ACCENT = "#FFE34D" as const;
const H_FONT = "Georgia, 'Times New Roman', serif" as const;
const B_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif" as const;

function useTimer(ms: number, active: boolean): number {
  const [t, setT] = useState<number>(0);
  useEffect(() => {
    if (!active) { setT(0); return; }
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const next = Math.min((now - start) / ms, 1);
      setT(next);
      if (next < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, ms]);
  return t;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const prog  = (t: number, a: number, b: number): number => clamp((t - a) / (b - a), 0, 1);

const PaperBg: FC = () => (
  <div style={{ position: "absolute", inset: 0, background: BG }}>
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
      <defs>
        <filter id="nbgp" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves={4} stitchTiles="stitch" result="n" />
          <feColorMatrix type="saturate" values="0" in="n" result="g" />
          <feComponentTransfer in="g" result="f"><feFuncA type="linear" slope={0.022} /></feComponentTransfer>
          <feComposite in="f" in2="SourceGraphic" operator="over" />
        </filter>
      </defs>
      <rect width="100%" height="100%" filter="url(#nbgp)" fill="white" />
    </svg>
  </div>
);

const Hl: FC<{ children: ReactNode; progress: number }> = ({ children, progress }) => (
  <span style={{
    backgroundImage: `linear-gradient(${ACCENT},${ACCENT})`,
    backgroundSize: `${progress * 100}% 44%`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "0 72%",
    paddingLeft: 2,
    paddingRight: 2,
  }}>
    {children}
  </span>
);

const Masthead: FC<{ op: number }> = ({ op }) => (
  <div style={{ opacity: op, textAlign: "center", borderBottom: `2.5px solid ${TEXT}`, paddingBottom: 8, marginBottom: 14 }}>
    <div style={{ fontFamily: H_FONT, fontSize: 28, fontWeight: 700, letterSpacing: "-0.01em", color: TEXT }}>The Chronicle</div>
    <div style={{ fontSize: 8, letterSpacing: "0.3em", textTransform: "uppercase", color: `${TEXT}99`, marginTop: 3 }}>
      Est. 1887 · Morning Edition
    </div>
  </div>
);

/* ── SLIDE 1 — masthead + headline ── */
const SlideHeadline: FC<{ active: boolean }> = ({ active }) => {
  const t = useTimer(3000, active);
  const mastOp = prog(t, 0, 0.12);
  const catOp = prog(t, 0.08, 0.2);
  const headOp = prog(t, 0.12, 0.4);
  const headY = (1 - headOp) * 30;
  const hlP = prog(t, 0.34, 0.62);
  const narOp = prog(t, 0.5, 0.72);
  const bylineOp = prog(t, 0.62, 0.82);

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "24px 20px", fontFamily: B_FONT }}>
      <Masthead op={mastOp} />
      <div style={{ opacity: catOp, marginBottom: 12 }}>
        <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: TEXT, paddingBottom: 4, borderBottom: `2.5px solid ${TEXT}` }}>
          Politics
        </span>
      </div>
      <div style={{ fontFamily: H_FONT, fontSize: 36, fontWeight: 700, lineHeight: 1.1, color: TEXT, opacity: headOp, transform: `translateY(${headY}px)`, marginBottom: 16 }}>
        Partial <Hl progress={hlP}>government</Hl> shutdown begins as <Hl progress={hlP}>funding</Hl> lapses
      </div>
      <div style={{ fontFamily: H_FONT, fontSize: 15, lineHeight: 1.45, color: `${TEXT}cc`, opacity: narOp, marginBottom: 16 }}>
        Agencies brace for furloughs as negotiations stall past the midnight deadline.
      </div>
      <div style={{ opacity: bylineOp, fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: `${TEXT}88` }}>
        By Caitlin Yilek, Stefan Becket
      </div>
    </div>
  );
};

/* ── SLIDE 2 — article lead (drop cap + columns) ── */
const SlideArticleLead: FC<{ active: boolean }> = ({ active }) => {
  const t = useTimer(3000, active);
  const labelOp = prog(t, 0, 0.16);
  const capOp = prog(t, 0.1, 0.34);
  const bodyOp = prog(t, 0.3, 0.7);

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px 22px", fontFamily: B_FONT }}>
      <div style={{ opacity: labelOp, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: TEXT, borderLeft: `4px solid ${ACCENT}`, paddingLeft: 8, marginBottom: 16 }}>
        The Lead
      </div>
      <div style={{ fontFamily: H_FONT, fontSize: 15, lineHeight: 1.55, color: TEXT, opacity: bodyOp }}>
        <span style={{ float: "left", fontSize: 64, lineHeight: 0.8, fontWeight: 700, paddingRight: 8, paddingTop: 4, color: TEXT, opacity: capOp }}>
          W
        </span>
        ashington awoke to shuttered offices and idled workers as lawmakers failed to reach a deal. The standoff, months in the making, now ripples across every federal agency and the millions who rely on them.
      </div>
    </div>
  );
};

/* ── SLIDE 3 — pull quote ── */
const SlidePullQuote: FC<{ active: boolean }> = ({ active }) => {
  const t = useTimer(3000, active);
  const barH = prog(t, 0.05, 0.4);
  const qmOp = prog(t, 0.1, 0.3);
  const quoteOp = prog(t, 0.25, 0.7);
  const attrOp = prog(t, 0.6, 0.85);

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", padding: "24px 24px", fontFamily: B_FONT }}>
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ width: 6, flexShrink: 0, background: ACCENT, height: `${barH * 100}%`, alignSelf: "stretch", borderRadius: 3 }} />
        <div>
          <div style={{ fontFamily: H_FONT, fontSize: 56, lineHeight: 0.5, color: ACCENT, opacity: qmOp, marginBottom: 8 }}>“</div>
          <div style={{ fontFamily: H_FONT, fontStyle: "italic", fontSize: 24, lineHeight: 1.3, color: TEXT, opacity: quoteOp }}>
            Every hour of delay carries a cost we cannot recover.
          </div>
          <div style={{ opacity: attrOp, marginTop: 16, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: `${TEXT}88` }}>
            — Budget Committee Chair
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── SLIDE 4 — data snapshot ── */
const SlideDataSnapshot: FC<{ active: boolean }> = ({ active }) => {
  const t = useTimer(3000, active);
  const labelOp = prog(t, 0, 0.18);
  const numP = prog(t, 0.1, 0.6);
  const ulW = prog(t, 0.4, 0.72) * 100;
  const rows = [
    { v: 72, label: "agencies affected" },
    { v: 38, label: "of staff furloughed" },
    { v: 12, label: "days until back pay" },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px 22px", fontFamily: B_FONT }}>
      <div style={{ opacity: labelOp, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: TEXT, marginBottom: 4 }}>
        By the numbers
      </div>
      <div style={{ height: 4, background: ACCENT, borderRadius: 2, width: `${ulW}%`, marginBottom: 18 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {rows.map((r, i) => (
          <div key={i}>
            <div style={{ fontFamily: H_FONT, fontSize: 44, fontWeight: 700, lineHeight: 1, color: TEXT }}>
              {Math.round(numP * r.v)}<span style={{ fontSize: 24 }}>%</span>
            </div>
            <div style={{ fontSize: 12, color: `${TEXT}aa`, marginTop: 2 }}>{r.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── SLIDE 5 — timeline ── */
const SlideTimeline: FC<{ active: boolean }> = ({ active }) => {
  const t = useTimer(3200, active);
  const labelOp = prog(t, 0, 0.16);
  const spineH = prog(t, 0.1, 0.7) * 100;
  const events = [
    { time: "11:58 PM", text: "Final vote fails on the floor" },
    { time: "12:00 AM", text: "Funding officially lapses" },
    { time: "6:00 AM", text: "Agencies issue furlough notices" },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px 22px", fontFamily: B_FONT }}>
      <div style={{ opacity: labelOp, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: TEXT, marginBottom: 18 }}>
        How it unfolded
      </div>
      <div style={{ position: "relative", paddingLeft: 22 }}>
        <div style={{ position: "absolute", left: 5, top: 4, width: 2.5, height: `${spineH}%`, background: ACCENT }} />
        {events.map((e, i) => {
          const dotOp = prog(t, 0.2 + i * 0.18, 0.4 + i * 0.18);
          const latest = i === events.length - 1;
          return (
            <div key={i} style={{ position: "relative", marginBottom: 20, opacity: dotOp }}>
              <div style={{
                position: "absolute", left: -22, top: 2, width: 12, height: 12, borderRadius: "50%",
                background: latest ? ACCENT : BG, border: `2.5px solid ${latest ? ACCENT : TEXT}`,
                boxShadow: latest ? `0 0 0 3px ${ACCENT}44` : "none",
              }} />
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: latest ? `${TEXT}` : `${TEXT}99` }}>{e.time}</div>
              <div style={{ fontFamily: H_FONT, fontSize: 14, lineHeight: 1.3, color: TEXT, marginTop: 2 }}>{e.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SLIDES = [SlideHeadline, SlideArticleLead, SlidePullQuote, SlideDataSnapshot, SlideTimeline];
const SLIDE_NAMES = ["Headline", "Article Lead", "Pull Quote", "By the numbers", "Timeline"];
const SLIDE_DURATION = 3400;

function NavDots({ total, current, onDotClick }: { total: number; current: number; onDotClick: (i: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 5, position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
      {Array.from({ length: total }, (_, i) => (
        <button key={i} type="button" onClick={() => onDotClick(i)} style={{
          width: i === current ? 16 : 6, height: 6, borderRadius: 3,
          background: i === current ? TEXT : `${TEXT}33`, border: "none", cursor: "pointer", padding: 0, transition: "all 0.3s ease",
        }} />
      ))}
    </div>
  );
}

export default function NewsPaperPreviewPortrait({ thumbnailMode = false }: { thumbnailMode?: boolean } = {}) {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);
  const currentRef = useRef(0);
  const transRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { currentRef.current = current; }, [current]);

  useEffect(() => {
    setCurrent(0);
    if (thumbnailMode) { setVisible(true); return; }
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(t);
  }, [thumbnailMode]);

  const goTo = useCallback((i: number): void => {
    if (transRef.current) return;
    transRef.current = true;
    setVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCurrent(i);
      setVisible(true);
      transRef.current = false;
      timerRef.current = null;
    }, 200);
  }, []);

  useEffect(() => {
    if (thumbnailMode) return;
    const id = setInterval(() => goTo((currentRef.current + 1) % SLIDES.length), SLIDE_DURATION);
    return () => clearInterval(id);
  }, [goTo, thumbnailMode]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const SlideComp = SLIDES[current];

  return (
    <ScaledCanvas>
      <PaperBg />
      <div style={{ position: "absolute", inset: 0, opacity: visible ? 1 : 0, transform: visible ? "scale(1)" : "scale(0.97)", transition: "opacity 0.2s ease, transform 0.2s ease" }}>
        <SlideComp active={visible} />
      </div>
      <div style={{ position: "absolute", top: 10, right: 12, fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase", color: `${TEXT}66`, fontFamily: B_FONT }}>
        {SLIDE_NAMES[current]}
      </div>
      <NavDots total={SLIDES.length} current={current} onDotClick={goTo} />
    </ScaledCanvas>
  );
}
