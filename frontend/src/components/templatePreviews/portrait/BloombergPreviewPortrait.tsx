import { useState, useEffect, useRef } from "react";

// ─── Portrait scale wrapper (9:16)
const INTERNAL_W = 270;
const INTERNAL_H = 480;

function ScaledCanvas({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const s = el.offsetWidth / INTERNAL_W;
      if (s > 0) setScale(s);
    };
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

// ─── Design tokens (matches BloombergPreview.tsx)
const AMBER = "#FFB340";
const BG = "#000000";
const HEADER_BG = "#0F0A00";
const PANEL_BG = "#0A0800";
const BORDER = "#3A2E10";
const MUTED = "#7A5A20";
const POS = "#7BE495";
const NEG = "#FF5A54";
const FF = "'Share Tech Mono', monospace";

const TOP_H = 22;
const BOT_H = 16;

function Scanlines() {
  return (
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none",
      backgroundImage: "repeating-linear-gradient(to bottom, rgba(255,179,64,0.03) 0px, rgba(255,179,64,0.03) 1px, transparent 1px, transparent 3px)",
    }} />
  );
}

function CornerBrackets() {
  const arm = 10, w = 1.5, pad = 6;
  const bracket = (style: React.CSSProperties) => (
    <div style={{ position: "absolute", width: arm, height: arm, ...style }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: arm, height: w, backgroundColor: AMBER }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: w, height: arm, backgroundColor: AMBER }} />
    </div>
  );
  return (
    <>
      {bracket({ top: pad, left: pad })}
      {bracket({ top: pad, right: pad, transform: "scaleX(-1)" })}
      {bracket({ bottom: pad, left: pad, transform: "scaleY(-1)" })}
      {bracket({ bottom: pad, right: pad, transform: "scale(-1,-1)" })}
    </>
  );
}

// ─── Slide 1: Boot
function SlideBoot({ active }: { active: boolean }) {
  const [progress, setProgress] = useState(0);
  const [linesDone, setLinesDone] = useState(0);
  const [cursorOn, setCursorOn] = useState(true);
  const [pulse, setPulse] = useState(0.7);

  const BOOT_LINES = [
    "LOADING EQUITY DB",
    "LOADING FIXED INCOME",
    "LOADING FX / DERIV",
    "LOADING LIVE FEEDS",
    "CALIBRATING CHARTS",
  ];

  useEffect(() => {
    if (!active) { setProgress(0); setLinesDone(0); return; }
    const id = setInterval(() => setProgress((p) => Math.min(100, p + 4)), 80);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const ids: ReturnType<typeof setTimeout>[] = [];
    BOOT_LINES.forEach((_, i) => ids.push(setTimeout(() => setLinesDone(i + 1), i * 320 + 200)));
    return () => ids.forEach(clearTimeout);
  }, [active]);

  useEffect(() => { const id = setInterval(() => setCursorOn((v) => !v), 500); return () => clearInterval(id); }, []);
  useEffect(() => { const id = setInterval(() => setPulse(0.45 + 0.55 * Math.abs(Math.sin(Date.now() / 400))), 50); return () => clearInterval(id); }, []);

  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: FF, padding: "0 20px" }}>
      <div style={{ color: AMBER, fontSize: 10, letterSpacing: 3, textAlign: "center", marginBottom: 10 }}>BLOOMBERG TERMINAL</div>
      <div style={{ width: "100%" }}>
        <div style={{ backgroundColor: HEADER_BG, border: `1px solid ${BORDER}`, borderBottom: `2px solid ${AMBER}`, padding: "3px 8px", display: "flex", alignItems: "center", gap: 6, marginBottom: 0 }}>
          <span style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: AMBER, opacity: pulse, display: "inline-block" }} />
          <span style={{ color: AMBER, fontSize: 6, letterSpacing: 2, flex: 1 }}>AUTHENTICATING</span>
          <div style={{ width: 50, height: 5, border: `1px solid ${AMBER}`, position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${progress}%`, backgroundImage: `repeating-linear-gradient(90deg, ${AMBER} 0 2px, transparent 2px 3px)` }} />
          </div>
          <span style={{ color: AMBER, fontSize: 6 }}>{Math.min(100, Math.round(progress))}%</span>
        </div>
        <div style={{ backgroundColor: PANEL_BG, border: `1px solid ${BORDER}`, borderTop: "none", padding: "6px 8px 8px" }}>
          {BOOT_LINES.map((line, i) => {
            const done = i < linesDone;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, color: done ? AMBER : MUTED, fontSize: 7, lineHeight: 1.9, letterSpacing: 1, opacity: i < linesDone + 2 ? 1 : 0.25 }}>
                <span style={{ flex: 1, fontSize: 6.5 }}>{line}</span>
                <span style={{ color: done ? AMBER : MUTED, fontSize: 6 }}>{done ? "OK" : "--"}</span>
              </div>
            );
          })}
          <div style={{ marginTop: 4, color: AMBER, fontSize: 6.5, letterSpacing: 1, opacity: linesDone >= BOOT_LINES.length ? 1 : 0 }}>
            ALL SYSTEMS NOMINAL.{" "}
            <span style={{ display: "inline-block", width: 4, height: 8, backgroundColor: cursorOn ? AMBER : "transparent", verticalAlign: "text-bottom" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Slide 2: Dashboard (2×2 grid)
const TILES = [
  { value: "S&P 500", suffix: "+0.84%", pos: true },
  { value: "NASDAQ", suffix: "+1.12%", pos: true },
  { value: "DXY", suffix: "-0.22%", pos: false },
  { value: "10Y YLD", suffix: "4.31%", pos: true },
];

function SlideDashboard({ active }: { active: boolean }) {
  const [vis, setVis] = useState<number[]>([]);

  useEffect(() => {
    setVis([]);
    if (!active) return;
    const ids: ReturnType<typeof setTimeout>[] = [];
    TILES.forEach((_, i) => ids.push(setTimeout(() => setVis((v) => [...v, i]), i * 180 + 150)));
    return () => ids.forEach(clearTimeout);
  }, [active]);

  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: BG, fontFamily: FF, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "6px 12px 0" }}>
        <span style={{ backgroundColor: AMBER, color: "#000", display: "inline-block", padding: "1px 8px 2px", fontSize: 9, letterSpacing: -0.5 }}>MARKET DASHBOARD</span>
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "8px 12px", alignContent: "center" }}>
        {TILES.map((tile, i) => {
          const isVis = vis.includes(i);
          const signColor = tile.suffix.startsWith("-") ? NEG : POS;
          return (
            <div key={i} style={{ backgroundColor: PANEL_BG, border: `1px solid ${BORDER}`, borderTop: `2px solid ${AMBER}`, padding: "6px 8px", display: "flex", flexDirection: "column", gap: 3, opacity: isVis ? 1 : 0, transition: "opacity 0.25s ease" }}>
              <div style={{ color: MUTED, fontSize: 5.5, letterSpacing: 2 }}>INDEX</div>
              <div style={{ color: AMBER, fontSize: 13, lineHeight: 1 }}>{tile.value}</div>
              <div style={{ color: signColor, fontSize: 8, letterSpacing: 1 }}>{tile.suffix}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Slide 3: Ticker
const TICKER_ROWS = [
  { text: "AAPL", change: "+2.14%", price: "$189.40", pos: true },
  { text: "NVDA", change: "+4.88%", price: "$847.20", pos: true },
  { text: "MSFT", change: "+1.32%", price: "$415.60", pos: true },
  { text: "TSLA", change: "-1.74%", price: "$172.30", pos: false },
  { text: "AMZN", change: "+0.96%", price: "$189.10", pos: true },
];

function SlideTicker({ active }: { active: boolean }) {
  const [vis, setVis] = useState<number[]>([]);

  useEffect(() => {
    setVis([]);
    if (!active) return;
    const ids: ReturnType<typeof setTimeout>[] = [];
    TICKER_ROWS.forEach((_, i) => ids.push(setTimeout(() => setVis((v) => [...v, i]), i * 150 + 200)));
    return () => ids.forEach(clearTimeout);
  }, [active]);

  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: BG, fontFamily: FF, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "6px 12px 0" }}>
        <span style={{ backgroundColor: AMBER, color: "#000", display: "inline-block", padding: "1px 8px 2px", fontSize: 9, letterSpacing: -0.5 }}>EQUITY SCREENER</span>
      </div>
      <div style={{ margin: "6px 12px 0", height: 14, backgroundColor: HEADER_BG, borderBottom: `1px solid ${AMBER}`, display: "flex", alignItems: "center", padding: "0 8px" }}>
        <span style={{ color: MUTED, fontSize: 5.5, letterSpacing: 2 }}>SYMBOL · CHANGE · PRICE</span>
      </div>
      <div style={{ flex: 1, margin: "0 12px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {TICKER_ROWS.map((row, i) => {
          const color = row.pos ? POS : NEG;
          return (
            <div key={i} style={{ backgroundColor: i % 2 === 0 ? PANEL_BG : BG, border: `1px solid ${BORDER}`, borderTop: "none", padding: "5px 8px", display: "flex", alignItems: "center", gap: 6, opacity: vis.includes(i) ? 1 : 0, transition: "opacity 0.25s ease" }}>
              <svg width={7} height={7} viewBox="0 0 16 16" style={{ flex: "0 0 auto" }}>
                {row.pos ? <polygon points="8,2 14,12 2,12" fill={color} /> : <polygon points="8,14 14,4 2,4" fill={color} />}
              </svg>
              <span style={{ color: AMBER, fontSize: 8, letterSpacing: 1, flex: "0 0 36px" }}>{row.text}</span>
              <span style={{ color, fontSize: 7.5, flex: 1 }}>{row.change}</span>
              <span style={{ color: MUTED, fontSize: 7 }}>{row.price}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Slide metadata
const SLIDES = [
  { Body: SlideBoot,      topLabel: "BOOT SEQUENCE",   botLeft: "LIVE SESSION" },
  { Body: SlideDashboard, topLabel: "MARKET OVERVIEW", botLeft: "MARKET DATA" },
  { Body: SlideTicker,    topLabel: "EQUITY SCREENER", botLeft: "TICKS 00042" },
] as const;

const SLIDE_DURATION = 4000;
const TRANSITION_MS = 350;

export default function BloombergPreviewPortrait() {
  const [displayed, setDisplayed] = useState(0);
  const [incoming, setIncoming] = useState(0);
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const [pulse, setPulse] = useState(0.7);
  const lockedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setPulse(0.4 + 0.6 * Math.abs(Math.sin(Date.now() / 350))), 50);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => triggerTransition((displayed + 1) % SLIDES.length), SLIDE_DURATION);
    return () => clearInterval(id);
  }, [displayed]);

  function triggerTransition(to: number) {
    if (lockedRef.current || to === displayed) return;
    lockedRef.current = true;
    setOutgoing(displayed);
    setIncoming(to);
    setAnimating(false);
    requestAnimationFrame(() => {
      setAnimating(true);
      setTimeout(() => {
        setDisplayed(to);
        setOutgoing(null);
        setAnimating(false);
        lockedRef.current = false;
      }, TRANSITION_MS + 20);
    });
  }

  const { topLabel, botLeft } = SLIDES[displayed];
  const easing = `cubic-bezier(0.4,0,0.2,1)`;
  const tx = `transform ${TRANSITION_MS}ms ${easing}`;

  return (
    <ScaledCanvas>
      <div style={{ width: "100%", height: "100%", position: "relative", backgroundColor: BG, fontFamily: FF, overflow: "hidden" }}>
        <Scanlines />
        <CornerBrackets />

        {/* TOP BAR */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: TOP_H, backgroundColor: HEADER_BG, borderBottom: `2px solid ${AMBER}`, display: "flex", alignItems: "center", padding: "0 12px", gap: 8, zIndex: 2, pointerEvents: "none" }}>
          <span style={{ color: MUTED, fontSize: 6.5, letterSpacing: 2 }}>{topLabel}</span>
          <div style={{ flex: 1 }} />
          <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: 3, backgroundColor: AMBER, opacity: pulse, boxShadow: `0 0 ${6 * pulse}px ${AMBER}` }} />
          <span style={{ color: AMBER, fontSize: 6.5, letterSpacing: 2 }}>LIVE</span>
        </div>

        {/* BODY ZONE */}
        <div style={{ position: "absolute", top: TOP_H, left: 0, right: 0, bottom: BOT_H, overflow: "hidden" }}>
          {outgoing !== null && (() => {
            const { Body: OutBody } = SLIDES[outgoing];
            return (
              <div style={{ position: "absolute", inset: 0, transform: animating ? "translateX(-100%)" : "translateX(0)", transition: animating ? tx : "none", willChange: "transform" }}>
                <OutBody active={false} />
              </div>
            );
          })()}
          {(() => {
            const { Body: InBody } = SLIDES[incoming];
            return (
              <div style={{ position: "absolute", inset: 0, transform: animating ? "translateX(0)" : (outgoing !== null ? "translateX(100%)" : "translateX(0)"), transition: animating ? tx : "none", willChange: "transform" }}>
                <InBody active={!animating && outgoing === null} />
              </div>
            );
          })()}
        </div>

        {/* BOTTOM BAR */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: BOT_H, backgroundColor: HEADER_BG, borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", padding: "0 12px", zIndex: 2, pointerEvents: "none" }}>
          <span style={{ color: MUTED, fontSize: 5.5, letterSpacing: 2 }}>{botLeft}</span>
        </div>

        {/* Slide dots */}
        <div style={{ display: "flex", gap: 4, position: "absolute", bottom: BOT_H + 6, right: 10, zIndex: 10 }}>
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => triggerTransition(i)} style={{ width: i === displayed ? 12 : 5, height: 5, borderRadius: 3, background: i === displayed ? AMBER : `${AMBER}33`, border: "none", cursor: "pointer", padding: 0, transition: "all 0.3s ease" }} />
          ))}
        </div>
      </div>
    </ScaledCanvas>
  );
}
