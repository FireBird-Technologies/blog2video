import { useState, useEffect, useRef, useCallback, FC, ReactNode, CSSProperties } from "react";

/* ════════════════════════════════════════════════════════════
   SCALE WRAPPER — renders at 700×394 internally
════════════════════════════════════════════════════════════ */
const IW = 700 as const;
const IH = 394 as const;

interface ScaledCanvasProps {
  children: ReactNode;
}

const ScaledCanvas: FC<ScaledCanvasProps> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const upd = () => setScale(el.getBoundingClientRect().width / IW);
    upd();
    const obs = new ResizeObserver(upd);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ width: "100%", aspectRatio: `${IW}/${IH}`, position: "relative", overflow: "hidden", borderRadius: 14 }}
    >
      <div
        style={{
          width: IW,
          height: IH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "absolute",
        }}
      >
        {children}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════
   DESIGN TOKENS
════════════════════════════════════════════════════════════ */
const BG     = "#FAFAF8" as const;
const TEXT   = "#111111" as const;
const ACCENT = "#FFE34D" as const;
const BLUE   = "#2563EB" as const;

const H_FONT = "Georgia, 'Times New Roman', serif" as const;
const B_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif" as const;

/* ════════════════════════════════════════════════════════════
   ANIMATION TIMER — returns 0→1 over `ms`. Resets on active flip.
════════════════════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════════════════════
   PAPER BACKGROUND — grain filter + rect in same SVG
════════════════════════════════════════════════════════════ */
const PaperBg: FC = () => (
  <div style={{ position: "absolute", inset: 0, background: BG }}>
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      aria-hidden
    >
      <defs>
        <filter id="nbg" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves={4} stitchTiles="stitch" result="n" />
          <feColorMatrix type="saturate" values="0" in="n" result="g" />
          <feComponentTransfer in="g" result="f">
            <feFuncA type="linear" slope={0.022} />
          </feComponentTransfer>
          <feComposite in="f" in2="SourceGraphic" operator="over" />
        </filter>
      </defs>
      <rect width="100%" height="100%" filter="url(#nbg)" fill="white" />
    </svg>
  </div>
);

/* ════════════════════════════════════════════════════════════
   HIGHLIGHT SPAN — animated yellow sweep behind words
════════════════════════════════════════════════════════════ */
interface HlProps {
  children: ReactNode;
  progress: number;
  color?: string;
}

const Hl: FC<HlProps> = ({ children, progress, color = ACCENT }) => (
  <span
    style={{
      backgroundImage: `linear-gradient(${color},${color})`,
      backgroundSize: `${progress * 100}% 44%`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "0 72%",
      paddingLeft: 2,
      paddingRight: 2,
    }}
  >
    {children}
  </span>
);

/* ════════════════════════════════════════════════════════════
   SHARED SLIDE PROP
════════════════════════════════════════════════════════════ */
interface SlideProps {
  active: boolean;
}

/* ════════════════════════════════════════════════════════════
   SLIDE 1 — NewsHeadline
════════════════════════════════════════════════════════════ */
const SlideNewsHeadline: FC<SlideProps> = ({ active }) => {
  const t        = useTimer(3000, active);
  const catOp    = prog(t, 0,    0.14);
  const headOp   = prog(t, 0.06, 0.32);
  const headY    = (1 - headOp) * 36;
  const hlP      = prog(t, 0.24, 0.50);
  const hrW      = prog(t, 0.32, 0.52);
  const narOp    = prog(t, 0.42, 0.62);
  const bylineOp = prog(t, 0.54, 0.72);

  return (
    <div
      style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "6% 10%", fontFamily: B_FONT,
      }}
    >
      {/* Category */}
      <div style={{ opacity: catOp, marginBottom: 18 }}>
        <div
          style={{
            display: "inline-block", fontSize: 14, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase", color: TEXT,
            paddingBottom: 5, borderBottom: `2.5px solid ${TEXT}`,
          }}
        >
          Politics
        </div>
      </div>

      {/* Headline */}
      <div
        style={{
          fontFamily: H_FONT, fontSize: 60, fontWeight: 700,
          lineHeight: 1.08, color: TEXT, opacity: headOp,
          transform: `translateY(${headY}px)`, marginBottom: 24,
        }}
      >
        Partial <Hl progress={hlP}>government</Hl> shutdown begins as <Hl progress={hlP}>funding</Hl> lapses
      </div>

      {/* Rule */}
      <div style={{ height: 1, background: TEXT, opacity: 0.1, width: `${hrW * 100}%`, marginBottom: 20 }} />

      {/* Sub-head */}
      <div
        style={{
          fontFamily: B_FONT, fontSize: 22, color: TEXT,
          opacity: narOp * 0.8, lineHeight: 1.5, marginBottom: 18, maxWidth: "80%",
        }}
      >
        Despite a Senate deal, the House failed to pass the bill before midnight.
      </div>

      {/* Byline */}
      <div
        style={{
          fontSize: 15, color: TEXT, opacity: bylineOp * 0.65,
          display: "flex", gap: 10, alignItems: "center",
        }}
      >
        <span style={{ color: BLUE, fontWeight: 600 }}>By Caitlin Yilek, Stefan Becket</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>January 31, 2026 / CBS News</span>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════
   SLIDE 2 — ArticleLead
════════════════════════════════════════════════════════════ */
const LEAD_TEXT =
  "Lawmakers failed to pass a short-term spending bill before the midnight deadline, triggering a partial government shutdown that will affect hundreds of thousands of federal workers starting today.";

const SlideArticleLead: FC<SlideProps> = ({ active }) => {
  const t        = useTimer(3200, active);
  const ruleW    = prog(t, 0,    0.16) * 100;
  const labelOp  = prog(t, 0.08, 0.22);
  const dropOp   = prog(t, 0.12, 0.28);
  const dropY    = (1 - dropOp) * 14;
  const bodyProg = prog(t, 0.20, 0.75);
  const visChars = Math.floor(LEAD_TEXT.length * bodyProg);
  const pullOp   = prog(t, 0.55, 0.72);
  const pullX    = (1 - pullOp) * 70;
  const numP     = prog(t, 0.66, 0.85);

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "6% 9%", fontFamily: B_FONT }}>
      {/* Top rule + label */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ height: 3, background: TEXT, width: `${ruleW}%`, marginBottom: 8 }} />
        <div
          style={{
            fontSize: 14, fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase", color: TEXT, opacity: labelOp,
          }}
        >
          The Story
        </div>
      </div>

      {/* Body + pull stat */}
      <div style={{ flex: 1, display: "flex", gap: 36, alignItems: "flex-start" }}>
        {/* Article text */}
        <div style={{ flex: 1, fontSize: 22, color: TEXT, lineHeight: 1.65 }}>
          <span
            style={{
              float: "left", fontFamily: H_FONT, fontSize: 88, fontWeight: 700,
              lineHeight: 0.78, marginRight: 8, marginTop: 6, color: TEXT,
              opacity: dropOp, transform: `translateY(${dropY}px)`, display: "inline-block",
            }}
          >
            L
          </span>
          {LEAD_TEXT.slice(1, visChars)}
          {visChars > 1 && visChars < LEAD_TEXT.length && (
            <span
              style={{
                display: "inline-block", width: 2, height: "1em",
                background: TEXT, opacity: 0.4, marginLeft: 2, verticalAlign: "text-bottom",
              }}
            />
          )}
        </div>

        {/* Pull stat */}
        <div
          style={{
            width: 185, flexShrink: 0, opacity: pullOp,
            transform: `translateX(${pullX}px)`,
            borderLeft: `4px solid ${ACCENT}`,
            paddingLeft: 16, paddingTop: 4, alignSelf: "center",
          }}
        >
          <div style={{ fontFamily: H_FONT, fontSize: 60, fontWeight: 700, color: TEXT, lineHeight: 1, marginBottom: 8 }}>
            {Math.round(800 * numP)}K
          </div>
          <div style={{ fontSize: 14, color: TEXT, opacity: 0.65, lineHeight: 1.4 }}>federal workers affected</div>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════
   SLIDE 3 — PullQuote
════════════════════════════════════════════════════════════ */
const QUOTE_TEXT =
  "This is not a political game. Real people will feel real consequences starting tomorrow morning.";

const SlidePullQuote: FC<SlideProps> = ({ active }) => {
  const t        = useTimer(3000, active);
  const barH     = prog(t, 0,    0.20) * 100;
  const qmOp     = prog(t, 0.06, 0.24);
  const qmS      = 0.4 + qmOp * 0.6;
  const words    = QUOTE_TEXT.split(" ");
  const wordP    = prog(t, 0.16, 0.58);
  const visWords = Math.floor(words.length * wordP);
  const attrOp   = prog(t, 0.56, 0.72);
  const srcOp    = prog(t, 0.64, 0.78);

  return (
    <div
      style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "6% 10%", fontFamily: B_FONT,
      }}
    >
      <div style={{ display: "flex", gap: 28, alignItems: "flex-start", maxWidth: 820, width: "100%" }}>
        {/* Vertical accent bar */}
        <div
          style={{
            width: 6, flexShrink: 0, background: ACCENT,
            alignSelf: "stretch", clipPath: `inset(0 0 ${100 - barH}% 0)`,
            minHeight: 50, borderRadius: 2,
          }}
        />

        <div style={{ flex: 1 }}>
          {/* Opening quote mark */}
          <div
            style={{
              fontFamily: H_FONT, fontSize: 100, lineHeight: 0.58,
              color: ACCENT, opacity: qmOp,
              transform: `scale(${qmS})`, transformOrigin: "left top",
              marginBottom: 10, userSelect: "none",
            }}
          >
            &#8220;
          </div>

          {/* Quote text */}
          <div
            style={{
              fontFamily: H_FONT, fontSize: 36, fontWeight: 400,
              lineHeight: 1.4, color: TEXT, marginBottom: 28, letterSpacing: "-0.01em",
            }}
          >
            {words.slice(0, visWords).join(" ")}
            {visWords < words.length && visWords > 0 && (
              <span
                style={{
                  display: "inline-block", width: 2, height: "0.9em",
                  background: TEXT, opacity: 0.35, marginLeft: 4, verticalAlign: "middle",
                }}
              />
            )}
          </div>

          {/* Attribution */}
          <div style={{ opacity: attrOp }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: TEXT, marginBottom: 4 }}>
              — Senate Majority Leader
            </div>
            <div style={{ fontSize: 14, color: TEXT, opacity: srcOp * 0.55, letterSpacing: "0.04em" }}>
              January 30, 2026
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════
   SLIDE 4 — DataSnapshot
════════════════════════════════════════════════════════════ */
interface StatItem {
  value:  number;
  suffix: string;
  label:  string;
  prefix?: string;
}

const DS_STATS: StatItem[] = [
  { value: 800, suffix: "K",  label: "Federal workers affected" },
  { value: 47,  suffix: "%",  label: "Agencies impacted" },
  { value: 32,  suffix: "",   label: "Days until next deadline" },
  { value: 6,   suffix: "B",  prefix: "$", label: "Daily economic cost" },
];

const SlideDataSnapshot: FC<SlideProps> = ({ active }) => {
  const t       = useTimer(3000, active);
  const titleOp = prog(t, 0,    0.18);
  const ruleW   = prog(t, 0.04, 0.22) * 100;

  return (
    <div
      style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        padding: "5% 9%", gap: 26, fontFamily: B_FONT,
      }}
    >
      {/* Header */}
      <div style={{ opacity: titleOp }}>
        <div style={{ fontFamily: H_FONT, fontSize: 48, fontWeight: 700, color: TEXT, lineHeight: 1.1, marginBottom: 10 }}>
          By the Numbers
        </div>
        <div style={{ height: 2, background: TEXT, opacity: 0.1, width: `${ruleW}%` }} />
      </div>

      {/* Cards */}
      <div style={{ flex: 1, display: "flex", gap: 18, alignItems: "stretch" }}>
        {DS_STATS.map((s, i) => {
          const delay   = 0.12 + i * 0.10;
          const cardOp  = prog(t, delay,        delay + 0.16);
          const cardY   = (1 - cardOp) * 28;
          const ulW     = prog(t, delay + 0.08, delay + 0.24) * 100;
          const numP2   = prog(t, delay + 0.04, delay + 0.28);
          const num     = Math.round(s.value * numP2);
          const display = (s.prefix ?? "") + num + s.suffix;

          return (
            <div
              key={i}
              style={{
                flex: 1, opacity: cardOp, transform: `translateY(${cardY}px)`,
                backgroundColor: "rgba(255,255,255,0.75)",
                border: "1px solid rgba(0,0,0,0.07)", borderRadius: 8,
                padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                display: "flex", flexDirection: "column", gap: 0,
              }}
            >
              <div style={{ fontFamily: H_FONT, fontSize: 50, fontWeight: 700, color: TEXT, lineHeight: 1, marginBottom: 10 }}>
                {display}
              </div>
              <div style={{ height: 4, background: ACCENT, borderRadius: 2, width: `${ulW}%`, marginBottom: 10 }} />
              <div style={{ fontSize: 15, color: TEXT, opacity: 0.65, lineHeight: 1.3 }}>{s.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════
   SLIDE 5 — FactCheck
════════════════════════════════════════════════════════════ */
const SlideFactCheck: FC<SlideProps> = ({ active }) => {
  const t        = useTimer(3200, active);
  const hdrOp   = prog(t, 0,    0.14);
  const leftX   = (1 - prog(t, 0.08, 0.32)) * -55;
  const leftOp  = prog(t, 0.08, 0.28);
  const rightX  = (1 - prog(t, 0.14, 0.38)) * 55;
  const rightOp = prog(t, 0.14, 0.34);
  const divH    = prog(t, 0.26, 0.44) * 100;
  const verdOp  = prog(t, 0.44, 0.58);
  const hlSweep = prog(t, 0.18, 0.42);

  const badgeHl: CSSProperties = {
    backgroundImage:    `linear-gradient(${ACCENT},${ACCENT})`,
    backgroundSize:     `${hlSweep * 100}% 100%`,
    backgroundRepeat:   "no-repeat",
    backgroundPosition: "0 0",
    paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3,
  };

  return (
    <div
      style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        padding: "5% 8%", gap: 22, fontFamily: B_FONT,
      }}
    >
      {/* Header */}
      <div style={{ opacity: hdrOp }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <svg width={32} height={32} viewBox="0 0 34 34" fill="none">
            <circle cx="14" cy="14" r="10" stroke={TEXT} strokeWidth="3" />
            <line x1="22" y1="22" x2="31" y2="31" stroke={TEXT} strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div style={{ fontFamily: H_FONT, fontSize: 46, fontWeight: 700, color: TEXT, lineHeight: 1 }}>
            Fact Check
          </div>
        </div>
        <div style={{ height: 2, background: TEXT, opacity: 0.1, width: "100%" }} />
      </div>

      {/* Two columns */}
      <div style={{ flex: 1, display: "flex", gap: 0, alignItems: "stretch", position: "relative" }}>
        {/* Left — CLAIMED */}
        <div
          style={{
            flex: 1, opacity: leftOp,
            transform: `translateX(${leftX}px)`, paddingRight: 30,
          }}
        >
          <div
            style={{
              display: "inline-block", fontSize: 12, fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase", color: TEXT,
              ...badgeHl, marginBottom: 14,
            }}
          >
            CLAIMED
          </div>
          <div style={{ fontFamily: H_FONT, fontSize: 26, color: TEXT, lineHeight: 1.45, fontStyle: "italic" }}>
            "The shutdown will only last a few hours."
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            width: 1, flexShrink: 0, background: TEXT, opacity: 0.13,
            alignSelf: "stretch", clipPath: `inset(0 0 ${100 - divH}% 0)`,
          }}
        />

        {/* Right — THE FACTS */}
        <div
          style={{
            flex: 1, opacity: rightOp,
            transform: `translateX(${rightX}px)`, paddingLeft: 30,
          }}
        >
          <div
            style={{
              display: "inline-block", fontSize: 12, fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase", color: TEXT,
              border: `1.5px solid ${TEXT}`,
              paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3,
              opacity: 0.65, marginBottom: 14,
            }}
          >
            THE FACTS
          </div>
          <div style={{ fontSize: 22, color: TEXT, lineHeight: 1.55 }}>
            Past shutdowns have averaged 16 days. Essential services may be suspended indefinitely.
          </div>
        </div>
      </div>

      {/* Verdict */}
      <div
        style={{
          opacity: verdOp, borderTop: `2px solid ${ACCENT}`,
          paddingTop: 14, fontSize: 17, fontWeight: 600, color: TEXT,
        }}
      >
        ⚠ Context needed — no evidence supports the claim based on historical precedent.
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════
   SLIDE 6 — NewsTimeline
════════════════════════════════════════════════════════════ */
interface TimelineItem {
  date: string;
  text: string;
}

const TL_ITEMS: TimelineItem[] = [
  { date: "Sep 30", text: "Fiscal year deadline passes without a budget" },
  { date: "Oct 15", text: "House passes short-term CR — Senate delays vote" },
  { date: "Jan 19", text: "Senate reaches bipartisan deal on 45-day extension" },
  { date: "Jan 31", text: "Midnight deadline missed — partial shutdown begins" },
  { date: "Feb 3",  text: "Emergency session called to negotiate reopening" },
];

const ITEM_START = 0.14 as const;
const ITEM_STEP  = 0.13 as const;

const SlideNewsTimeline: FC<SlideProps> = ({ active }) => {
  const t       = useTimer(3400, active);
  const titleOp = prog(t, 0,    0.16);
  const ruleW   = prog(t, 0.04, 0.20) * 100;
  const spineH  = prog(t, 0.12, ITEM_START + TL_ITEMS.length * ITEM_STEP + 0.08) * 100;

  return (
    <div
      style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        padding: "5% 9%", gap: 22, fontFamily: B_FONT,
      }}
    >
      {/* Header */}
      <div style={{ opacity: titleOp }}>
        <div style={{ fontFamily: H_FONT, fontSize: 46, fontWeight: 700, color: TEXT, lineHeight: 1.1, marginBottom: 10 }}>
          How We Got Here
        </div>
        <div style={{ height: 2, background: TEXT, opacity: 0.1, width: `${ruleW}%` }} />
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, display: "flex", position: "relative" }}>
        {/* Spine */}
        <div
          style={{
            width: 2, flexShrink: 0, background: `${TEXT}18`,
            alignSelf: "stretch", marginRight: 26,
            position: "relative", overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute", top: 0, left: 0, right: 0,
              height: `${spineH}%`, background: ACCENT,
            }}
          />
        </div>

        {/* Items */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {TL_ITEMS.map((item, i) => {
            const s      = ITEM_START + i * ITEM_STEP;
            const dotS   = prog(t, s,        s + 0.06);
            const dateOp = prog(t, s,        s + 0.10);
            const textX  = (1 - prog(t, s + 0.02, s + 0.14)) * 18;
            const textOp = prog(t, s + 0.02, s + 0.12);
            const latest = i === TL_ITEMS.length - 1;

            return (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 18, position: "relative" }}>
                {/* Dot */}
                <div
                  style={{
                    position: "absolute", left: -26 - 1 - 6, top: 4,
                    width: 12, height: 12, borderRadius: "50%",
                    background: latest ? ACCENT : BG,
                    border: `2.5px solid ${latest ? ACCENT : TEXT}`,
                    opacity: latest ? dotS : dotS * 0.6,
                    transform: `scale(${dotS})`,
                    boxShadow: latest ? `0 0 0 3px ${ACCENT}44` : "none",
                  }}
                />
                {/* Date */}
                <div
                  style={{
                    fontSize: 13, fontWeight: 700,
                    color: latest ? ACCENT : TEXT,
                    opacity: dateOp * (latest ? 1 : 0.55),
                    whiteSpace: "nowrap", minWidth: 56,
                    letterSpacing: "0.04em", marginTop: 2,
                  }}
                >
                  {item.date}
                </div>
                {/* Text */}
                <div
                  style={{
                    fontSize: 17, color: TEXT,
                    opacity: textOp * (latest ? 1 : 0.82),
                    transform: `translateX(${textX}px)`,
                    lineHeight: 1.4, fontWeight: latest ? 600 : 400,
                    borderLeft: `3px solid ${latest ? ACCENT : "transparent"}`,
                    paddingLeft: latest ? 10 : 0,
                  }}
                >
                  {item.text}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════
   NAV DOTS
════════════════════════════════════════════════════════════ */
interface NavDotsProps {
  total:      number;
  current:    number;
  onDotClick: (i: number) => void;
}

const NavDots: FC<NavDotsProps> = ({ total, current, onDotClick }) => (
  <div
    style={{
      position: "absolute", bottom: 12, left: "50%",
      transform: "translateX(-50%)", display: "flex", gap: 7, zIndex: 10,
    }}
  >
    {Array.from({ length: total }, (_, i) => (
      <button
        key={i}
        onClick={() => onDotClick(i)}
        style={{
          width:      i === current ? 22 : 7,
          height:     7,
          borderRadius: 4,
          background: i === current ? TEXT : `${TEXT}28`,
          border:     "none",
          cursor:     "pointer",
          padding:    0,
          transition: "all 0.3s ease",
        }}
      />
    ))}
  </div>
);

/* ════════════════════════════════════════════════════════════
   SLIDE BADGE
════════════════════════════════════════════════════════════ */
const SLIDE_NAMES = ["Headline", "Article Lead", "Pull Quote", "Data Snapshot", "Fact Check", "Timeline"] as const;

interface SlideBadgeProps {
  name: string;
}

const SlideBadge: FC<SlideBadgeProps> = ({ name }) => (
  <div
    style={{
      position: "absolute", top: 13, left: 14, zIndex: 10,
      background: "rgba(255,255,255,0.85)",
      border: "1.5px solid rgba(0,0,0,0.1)",
      borderRadius: 20, padding: "4px 13px",
      fontFamily: B_FONT, fontSize: 12, fontWeight: 600,
      color: TEXT, letterSpacing: "0.04em",
    }}
  >
    {name}
  </div>
);

/* ════════════════════════════════════════════════════════════
   MAIN EXPORT
════════════════════════════════════════════════════════════ */
type SlideComponent = FC<SlideProps>;

const SLIDES: SlideComponent[] = [
  SlideNewsHeadline,
  SlideArticleLead,
  SlidePullQuote,
  SlideDataSnapshot,
  SlideFactCheck,
  SlideNewsTimeline,
];

const SLIDE_DURATION = 4200 as const;

const Blog2VideoPreview: FC = () => {
  const [current, setCurrent] = useState<number>(0);
  const [visible, setVisible] = useState<boolean>(true);
  const transRef   = useRef<boolean>(false);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRef = useRef<number>(0);

  useEffect(() => { currentRef.current = current; }, [current]);

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
    const id = setInterval(() => goTo((currentRef.current + 1) % SLIDES.length), SLIDE_DURATION);
    return () => clearInterval(id);
  }, [goTo]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const SlideComp = SLIDES[current];

  return (
    <ScaledCanvas>
      <PaperBg />

      <div
        style={{
          position: "absolute", inset: 0,
          opacity:   visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.97)",
          transition: "opacity 0.2s ease, transform 0.2s ease",
        }}
      >
        <SlideComp active={visible} />
      </div>

      <SlideBadge name={SLIDE_NAMES[current]} />
      <NavDots total={SLIDES.length} current={current} onDotClick={goTo} />
    </ScaledCanvas>
  );
};

export default Blog2VideoPreview;