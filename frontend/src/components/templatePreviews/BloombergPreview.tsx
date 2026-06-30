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
const AMBER = "#FFB340";
const BG = "#000000";
const HEADER_BG = "#0F0A00";
const PANEL_BG = "#0A0800";
const BORDER = "#3A2E10";
const MUTED = "#7A5A20";
const POS = "#7BE495";
const NEG = "#FF5A54";
const FF = "'Share Tech Mono', monospace";

const TOP_H = 28;
const BOT_H = 22;

function Scanlines() {
  return (
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none",
      backgroundImage: "repeating-linear-gradient(to bottom, rgba(255,179,64,0.03) 0px, rgba(255,179,64,0.03) 1px, transparent 1px, transparent 3px)",
    }} />
  );
}

function CornerBrackets() {
  const arm = 14, w = 1.5, pad = 8;
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

function sparkPts(seed: number, trend: number, N = 20) {
  const pts: number[] = [];
  for (let i = 0; i < N; i++) {
    const noise = Math.sin((i + seed) * 1.37) * 0.4 + Math.sin((i + seed) * 0.61) * 0.25;
    pts.push(noise + (trend / 6) * (i / N));
  }
  return pts;
}

function Sparkline({ color, width, height, seed, trend }: { color: string; width: number; height: number; seed: number; trend: number }) {
  const pts = sparkPts(seed, trend);
  const minV = Math.min(...pts), maxV = Math.max(...pts), range = maxV - minV || 1;
  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * width;
    const y = height - ((v - minV) / range) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const lastY = height - ((pts[pts.length - 1] - minV) / range) * (height - 2) - 1;
  return (
    <svg width={width} height={height} style={{ flex: "0 0 auto" }}>
      <polyline points={coords} stroke={color} strokeWidth="1.5" fill="none" />
      <circle cx={width} cy={lastY} r="2" fill={color} />
    </svg>
  );
}

// ─── Slide bodies

function SlideTerminalBoot({ active }: { active: boolean }) {
  const [tick, setTick] = useState(0);
  const [progress, setProgress] = useState(0);
  const [linesDone, setLinesDone] = useState(0);
  const [cursorOn, setCursorOn] = useState(true);
  const [pulse, setPulse] = useState(0.7);

  const BOOT_LINES = [
    "LOADING EQUITY DATABASE",
    "LOADING FIXED INCOME",
    "LOADING FX / DERIVATIVES",
    "LOADING REAL-TIME FEEDS",
    "CALIBRATING CHARTS",
  ];

  useEffect(() => {
    if (!active) { setTick(0); setProgress(0); setLinesDone(0); return; }
    const id = setInterval(() => setTick((t) => t + 1), 80);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setProgress((p) => Math.min(100, p + 3.5)), 80);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const ids: ReturnType<typeof setTimeout>[] = [];
    BOOT_LINES.forEach((_, idx) => {
      ids.push(setTimeout(() => setLinesDone(idx + 1), idx * 320 + 200));
    });
    return () => ids.forEach(clearTimeout);
  }, [active]);

  useEffect(() => {
    const id = setInterval(() => setCursorOn((v) => !v), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setPulse(0.45 + 0.55 * Math.abs(Math.sin(Date.now() / 400))), 50);
    return () => clearInterval(id);
  }, []);

  const dots = tick % 3 === 0 ? "." : tick % 3 === 1 ? ".." : "...";
  const totalBars = 16;

  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: FF }}>
      <div style={{ width: "72%" }}>
        <div style={{ color: AMBER, fontSize: 13, letterSpacing: 3, textAlign: "center", marginBottom: 10 }}>
          BLOOMBERG TERMINAL
        </div>
        <div style={{ color: POS, fontSize: 7.5, letterSpacing: 2, marginBottom: 6 }}>
          CONNECTING TO MARKET DATA FEED{dots}
        </div>
        <div style={{
          backgroundColor: HEADER_BG, border: `1px solid ${BORDER}`, borderBottom: `2px solid ${AMBER}`,
          padding: "4px 10px", display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: AMBER, opacity: pulse, display: "inline-block" }} />
          <span style={{ color: AMBER, fontSize: 7, letterSpacing: 3, flex: 1 }}>SYSTEM BOOT · AUTHENTICATING</span>
          <div style={{ width: 70, height: 6, border: `1px solid ${AMBER}`, position: "relative" }}>
            <div style={{
              position: "absolute", top: 0, left: 0, bottom: 0,
              width: `${progress}%`,
              backgroundImage: `repeating-linear-gradient(90deg, ${AMBER} 0 3px, transparent 3px 4px)`,
            }} />
          </div>
          <span style={{ color: AMBER, fontSize: 7, letterSpacing: 1 }}>{Math.min(100, Math.round(progress))}%</span>
        </div>
        <div style={{ backgroundColor: PANEL_BG, border: `1px solid ${BORDER}`, borderTop: "none", padding: "8px 10px 10px" }}>
          {BOOT_LINES.map((line, i) => {
            const done = i < linesDone;
            const filling = i === linesDone && progress < 100;
            const filled = filling ? Math.round((progress / 100) * totalBars) : done ? totalBars : 0;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8,
                color: done ? AMBER : MUTED, fontSize: 8, lineHeight: 1.9, letterSpacing: 1,
                opacity: i < linesDone + 2 ? 1 : 0.25,
              }}>
                <span style={{ flex: "0 0 160px", fontSize: 7.5 }}>{line}</span>
                <div style={{ display: "flex", gap: 1.5, flex: "0 0 auto" }}>
                  {Array.from({ length: totalBars }).map((_, j) => (
                    <span key={j} style={{
                      display: "inline-block", width: 3.5, height: 7,
                      backgroundColor: j < filled ? AMBER : `${AMBER}22`,
                    }} />
                  ))}
                </div>
                <span style={{ flex: 1, textAlign: "right", color: done ? AMBER : MUTED, fontSize: 7, letterSpacing: 1 }}>
                  {done ? "OK" : filling ? `${Math.round(progress)}%` : "--"}
                </span>
              </div>
            );
          })}
          <div style={{ marginTop: 6, color: AMBER, fontSize: 7.5, letterSpacing: 1, opacity: linesDone >= BOOT_LINES.length ? 1 : 0 }}>
            ALL SYSTEMS NOMINAL.{" "}
            <span style={{ display: "inline-block", width: 5, height: 9, backgroundColor: cursorOn ? AMBER : "transparent", verticalAlign: "text-bottom" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

const TILES = [
  { value: "S&P 500", label: "INDEX", suffix: "+0.84%", pos: true },
  { value: "NASDAQ", label: "INDEX", suffix: "+1.12%", pos: true },
  { value: "DXY", label: "DOLLAR", suffix: "-0.22%", pos: false },
  { value: "10Y", label: "YIELD", suffix: "4.31%", pos: true },
];

function SlideTerminalDashboard({ active }: { active: boolean }) {
  const [vis, setVis] = useState<number[]>([]);
  const [flash, setFlash] = useState<number[]>([]);

  useEffect(() => {
    setVis([]); setFlash([]);
    if (!active) return;
    const ids: ReturnType<typeof setTimeout>[] = [];
    TILES.forEach((_, i) => {
      ids.push(setTimeout(() => {
        setVis((v) => [...v, i]);
        setFlash((f) => [...f, i]);
        setTimeout(() => setFlash((f) => f.filter((x) => x !== i)), 500);
      }, i * 180 + 150));
    });
    return () => ids.forEach(clearTimeout);
  }, [active]);

  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: BG, fontFamily: FF, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "6px 16px 0" }}>
        <span style={{ backgroundColor: AMBER, color: "#000", display: "inline-block", padding: "2px 10px 3px", fontSize: 13, letterSpacing: -0.5 }}>
          MARKET DASHBOARD
        </span>
      </div>
      <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 8, padding: "8px 16px", alignContent: "center", justifyContent: "center" }}>
        {TILES.map((tile, i) => {
          const isVis = vis.includes(i);
          const isFlash = flash.includes(i);
          const signColor = tile.suffix.startsWith("-") ? NEG : POS;
          return (
            <div key={i} style={{
              width: "46%", minHeight: 60,
              backgroundColor: isFlash ? AMBER : PANEL_BG,
              border: `1px solid ${isFlash ? AMBER : BORDER}`,
              borderTop: `2px solid ${isFlash ? "#000" : AMBER}`,
              padding: "8px 12px",
              display: "flex", flexDirection: "column", justifyContent: "space-between",
              opacity: isVis ? 1 : 0,
              transition: "opacity 0.25s ease, background-color 0.15s",
              position: "relative",
            }}>
              <div style={{ position: "absolute", top: 6, right: 6, width: 5, height: 5, backgroundColor: isVis && !isFlash ? AMBER : BORDER }} />
              <div style={{ color: isFlash ? "#000" : MUTED, fontSize: 7, letterSpacing: 3 }}>{tile.label}</div>
              <div style={{ color: isFlash ? "#000" : AMBER, fontSize: 18, lineHeight: 1 }}>{tile.value}</div>
              <div style={{ color: isFlash ? "#000" : signColor, fontSize: 10, letterSpacing: 1 }}>{tile.suffix}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TICKER_ROWS = [
  { text: "AAPL  +2.14%  $189.40", pos: true, change: 2.14 },
  { text: "NVDA  +4.88%  $847.20", pos: true, change: 4.88 },
  { text: "MSFT  +1.32%  $415.60", pos: true, change: 1.32 },
  { text: "TSLA  -1.74%  $172.30", pos: false, change: -1.74 },
  { text: "AMZN  +0.96%  $189.10", pos: true, change: 0.96 },
];

function SlideTerminalTicker({ active }: { active: boolean }) {
  const [offset, setOffset] = useState(0);
  const [vis, setVis] = useState<number[]>([]);

  useEffect(() => {
    setVis([]); setOffset(0);
    if (!active) return;
    const ids: ReturnType<typeof setTimeout>[] = [];
    TICKER_ROWS.forEach((_, i) => {
      ids.push(setTimeout(() => setVis((v) => [...v, i]), i * 150 + 200));
    });
    return () => ids.forEach(clearTimeout);
  }, [active]);

  useEffect(() => {
    const id = setInterval(() => setOffset((o) => (o + 1.5) % 800), 16);
    return () => clearInterval(id);
  }, []);

  const tapeText = TICKER_ROWS.map((r) => r.text).join("   ·   ");

  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: BG, fontFamily: FF, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 18, backgroundColor: "#0A0800", borderBottom: `1px solid ${BORDER}`, overflow: "hidden", display: "flex", alignItems: "center", flexShrink: 0 }}>
        <div style={{ whiteSpace: "nowrap", color: AMBER, fontSize: 8, letterSpacing: 2, transform: `translateX(${-offset}px)` }}>
          {tapeText}   ·   {tapeText}   ·   {tapeText}
        </div>
      </div>
      <div style={{ margin: "0 8%", height: 18, backgroundColor: HEADER_BG, borderBottom: `1px solid ${AMBER}`, display: "flex", alignItems: "center", padding: "0 10px", flexShrink: 0 }}>
        <span style={{ color: MUTED, fontSize: 7, letterSpacing: 3 }}>SYMBOL  ·  CHANGE  ·  PRICE  ·  TREND</span>
      </div>
      <div style={{ flex: 1, margin: "0 8%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 0 }}>
        {TICKER_ROWS.map((row, i) => {
          const color = row.pos ? POS : NEG;
          return (
            <div key={i} style={{
              backgroundColor: i % 2 === 0 ? PANEL_BG : BG,
              border: `1px solid ${BORDER}`, borderTop: "none",
              padding: "5px 10px",
              display: "flex", alignItems: "center", gap: 10,
              opacity: vis.includes(i) ? 1 : 0,
              transition: "opacity 0.25s ease",
            }}>
              <span style={{ display: "inline-block", width: 3, height: 16, backgroundColor: color, flex: "0 0 auto" }} />
              <svg width={9} height={9} viewBox="0 0 16 16" style={{ flex: "0 0 auto" }}>
                {row.pos
                  ? <polygon points="8,2 14,12 2,12" fill={color} />
                  : <polygon points="8,14 14,4 2,4" fill={color} />
                }
              </svg>
              <span style={{ color: row.pos ? AMBER : NEG, fontSize: 9, letterSpacing: 1, flex: 1 }}>{row.text}</span>
              <Sparkline color={color} width={55} height={16} seed={i} trend={row.change} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Slide metadata
const SLIDES = [
  { Body: SlideTerminalBoot,      topLabel: "BOOT SEQUENCE",   botLeft: "LIVE SESSION",  botRight: "CPU 42%  MEM 61%" },
  { Body: SlideTerminalDashboard, topLabel: "MARKET OVERVIEW", botLeft: "MARKET DATA",   botRight: undefined },
  { Body: SlideTerminalTicker,    topLabel: "EQUITY SCREENER", botLeft: "SCREENER",      botRight: "TICKS 00042" },
] as const;

const SLIDE_DURATION = 4000;
const TRANSITION_MS = 350;

function SlideDots({ total, current, onDotClick }: { total: number; current: number; onDotClick: (i: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 5, position: "absolute", bottom: 8, right: 12, zIndex: 10 }}>
      {Array.from({ length: total }, (_, i) => (
        <button key={i} onClick={() => onDotClick(i)} style={{
          width: i === current ? 16 : 6, height: 6, borderRadius: 3,
          background: i === current ? AMBER : `${AMBER}33`,
          border: "none", cursor: "pointer", padding: 0,
          transition: "all 0.3s ease",
        }} />
      ))}
    </div>
  );
}

export default function BloombergPreview({ thumbnailMode = false }: { thumbnailMode?: boolean } = {}) {
  // `displayed` is what the chrome (top/bottom bar) shows — only updates after transition settles
  const [displayed, setDisplayed] = useState(0);
  // `incoming` is the slide currently animating in
  const [incoming, setIncoming] = useState(0);
  // `outgoing` is the slide animating out (null when not transitioning)
  const [outgoing, setOutgoing] = useState<number | null>(null);
  // `animating` drives the CSS transforms
  const [animating, setAnimating] = useState(false);
  const [pulse, setPulse] = useState(0.7);
  const lockedRef = useRef(false);

  useEffect(() => {
    if (thumbnailMode) return;
    const id = setInterval(() => setPulse(0.4 + 0.6 * Math.abs(Math.sin(Date.now() / 350))), 50);
    return () => clearInterval(id);
  }, [thumbnailMode]);

  // Side cards play the first slide's intro once and rest on its settled state
  // (the auto-advance interval is gated off in thumbnail mode). Pinning to the
  // first slide also means it restarts from the top when it returns to center.
  useEffect(() => {
    lockedRef.current = false;
    setOutgoing(null);
    setAnimating(false);
    setDisplayed(0);
    setIncoming(0);
  }, [thumbnailMode]);

  // Auto-advance
  useEffect(() => {
    if (thumbnailMode) return;
    const id = setInterval(() => triggerTransition((displayed + 1) % SLIDES.length), SLIDE_DURATION);
    return () => clearInterval(id);
  }, [displayed, thumbnailMode]);

  function triggerTransition(to: number) {
    if (lockedRef.current || to === displayed) return;
    lockedRef.current = true;

    // Step 1: mount both slides with no animation (outgoing at 0, incoming at +100%)
    setOutgoing(displayed);
    setIncoming(to);
    setAnimating(false);

    // Step 2: one rAF later, enable CSS transitions and slide both
    requestAnimationFrame(() => {
      setAnimating(true);

      // Step 3: after transition completes, clean up
      setTimeout(() => {
        setDisplayed(to);
        setOutgoing(null);
        setAnimating(false);
        lockedRef.current = false;
      }, TRANSITION_MS + 20);
    });
  }

  const { topLabel, botLeft, botRight } = SLIDES[displayed];
  const easing = `cubic-bezier(0.4,0,0.2,1)`;
  const tx = `transform ${TRANSITION_MS}ms ${easing}`;

  return (
    <ScaledCanvas>
      <div style={{ width: "100%", height: "100%", position: "relative", backgroundColor: BG, fontFamily: FF, overflow: "hidden" }}>
        <Scanlines />
        <CornerBrackets />

        {/* TOP BAR — reads from `displayed`, never jumps */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: TOP_H,
          backgroundColor: HEADER_BG, borderBottom: `2px solid ${AMBER}`,
          display: "flex", alignItems: "center", padding: "0 16px", gap: 10,
          zIndex: 2, pointerEvents: "none",
        }}>
          <span style={{ color: MUTED, fontSize: 8, letterSpacing: 2 }}>{topLabel}</span>
          <div style={{ flex: 1 }} />
          <span style={{
            display: "inline-block", width: 7, height: 7, borderRadius: 4,
            backgroundColor: AMBER, opacity: pulse,
            boxShadow: `0 0 ${6 * pulse}px ${AMBER}`,
          }} />
          <span style={{ color: AMBER, fontSize: 8, letterSpacing: 2 }}>LIVE</span>
        </div>

        {/* BODY ZONE — slides happen inside here */}
        <div style={{ position: "absolute", top: TOP_H, left: 0, right: 0, bottom: BOT_H, overflow: "hidden" }}>
          {/* Outgoing slide — moves left */}
          {outgoing !== null && (() => {
            const { Body: OutBody } = SLIDES[outgoing];
            return (
              <div style={{
                position: "absolute", inset: 0,
                transform: animating ? "translateX(-100%)" : "translateX(0)",
                transition: animating ? tx : "none",
                willChange: "transform",
              }}>
                <OutBody active={false} />
              </div>
            );
          })()}

          {/* Incoming slide — moves from right to center */}
          {(() => {
            const { Body: InBody } = SLIDES[incoming];
            return (
              <div style={{
                position: "absolute", inset: 0,
                transform: animating ? "translateX(0)" : (outgoing !== null ? "translateX(100%)" : "translateX(0)"),
                transition: animating ? tx : "none",
                willChange: "transform",
              }}>
                {/* Remount when crossing between center/side so the intro
                    replays from the top on reaching center. */}
                <InBody key={`${incoming}-${thumbnailMode}`} active={!animating && outgoing === null} />
              </div>
            );
          })()}
        </div>

        {/* BOTTOM BAR — reads from `displayed`, never jumps */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: BOT_H,
          backgroundColor: HEADER_BG, borderTop: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", padding: "0 16px", gap: 12,
          zIndex: 2, pointerEvents: "none",
        }}>
          <span style={{ color: MUTED, fontSize: 7, letterSpacing: 2 }}>{botLeft}</span>
          {botRight && (
            <>
              <div style={{ flex: 1 }} />
              <span style={{ color: MUTED, fontSize: 7, letterSpacing: 2 }}>{botRight}</span>
            </>
          )}
        </div>

        <SlideDots total={SLIDES.length} current={displayed} onDotClick={(i) => triggerTransition(i)} />
      </div>
    </ScaledCanvas>
  );
}
